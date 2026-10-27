# 10 — AWS Services

What each piece of this stack becomes on AWS, and the trap in each one.
`04-crossplane/` covers provisioning them declaratively; this file is about
**which service, and what breaks**.

---

## The stack, translated

| Local | AWS | Note |
|---|---|---|
| 3× `postgres:16` | **RDS for PostgreSQL** (3 instances) | or Aurora. One per service — keep the boundary |
| `redis:7-alpine` | **ElastiCache for Redis** | serverless tier exists; cluster mode changes client config |
| `minio` | **S3** | swap one adapter — `MinioAvatarStorage` → `S3AvatarStorage` |
| `jaeger` | **X-Ray**, or self-hosted Jaeger / Grafana Tempo | OTLP works with all three |
| `prometheus` | **AMP** (Managed Prometheus) + **AMG** (Grafana) | or keep it in-cluster |
| `discovery` (Eureka) | **nothing** | EKS Services replace it — see `06-full-stack-cluster/stack/04-discovery.yaml` |
| Kafka | **MSK** (or MSK Serverless) | see `09-kafka.md` |
| the cluster | **EKS** | + Karpenter for nodes |
| Ingress | **ALB** via AWS Load Balancer Controller | NLB for the LiveKit UDP/TCP path |
| Secrets | **Secrets Manager** / SSM Parameter Store | surfaced via External Secrets Operator |
| images | **ECR** | |
| DNS / TLS | **Route 53** + **ACM** | ACM certs terminate at the ALB |

---

## IAM — the part that's actually asked

**Roles, not users.** An IAM *user* has long-lived access keys; a *role* is
assumed and gives temporary credentials. Static keys in a container is the
finding every security review opens with.

### IRSA — how a pod gets AWS credentials

The single most important EKS concept, and the one people fumble.

```yaml
# 1. The ServiceAccount is annotated with a role ARN.
apiVersion: v1
kind: ServiceAccount
metadata:
  name: session
  namespace: inarow
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/inarow-session
```

```
2. EKS runs an OIDC provider. A mutating webhook injects a projected
   ServiceAccount TOKEN into the pod, plus AWS_ROLE_ARN and
   AWS_WEB_IDENTITY_TOKEN_FILE.
3. The AWS SDK finds those, calls sts:AssumeRoleWithWebIdentity, and gets
   TEMPORARY credentials that it rotates automatically.
4. The IAM role's TRUST POLICY names the OIDC provider AND the exact
   namespace:serviceaccount — so only that pod identity can assume it.
```

```json
// The trust policy condition that does the real work:
"Condition": {
  "StringEquals": {
    "oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE:sub":
      "system:serviceaccount:inarow:session"
  }
}
// ⚠️ Use "sub" with the exact namespace:serviceaccount. A wildcard here means
// ANY pod in the cluster can assume the role, which quietly defeats the whole
// mechanism.
```

**No access keys anywhere. Credentials rotate automatically. Permissions are
scoped per workload, not per node** — that last part is the pitch: the older
approach (node instance profiles) gave every pod on a node the same
permissions.

*(EKS Pod Identity is the newer, simpler alternative — no OIDC trust policy
juggling. Worth naming as "the current direction" if asked.)*

---

## RDS

```
Multi-AZ            = a synchronous standby in another AZ. HA, NOT read scaling —
                      the standby serves no traffic. Failover ~60-120s, same DNS.
Read replica        = asynchronous. Read scaling, and it CAN lag. Never read
                      your own write from a replica.
Aurora              = storage-layer replication, faster failover, replicas share
                      one volume so lag is milliseconds. Costs more.
```

**⚠️ The connection-pool trap, again, and it's the best RDS answer:**
HikariCP is **per pod**. 10 connections × 8 replicas × 3 services = 240, and a
`db.t3.medium` allows a few hundred *total*. Autoscaling then exhausts the
database — it presents as a database outage and it's arithmetic.

Two fixes: size `maximum-pool-size` against **max** replicas, or put **RDS
Proxy** in front. RDS Proxy also holds connections open across a failover, which
turns a 60-second outage into a pause.

Other things worth knowing:
- **Parameter groups** hold `max_connections`, `work_mem`, etc. Some changes
  need a reboot.
- **Encryption at rest must be set at creation.** You cannot enable it later —
  you restore a snapshot into a new encrypted instance.
- **Automated backups + PITR** to any second in the retention window.
- **Never make it publicly accessible.** Private subnets, security group
  allowing 5432 only from the node/pod security group.

---

## S3 — replacing MinIO

This is the cleanest demonstration of the hexagonal payoff in the whole project:

```java
// application/port/AvatarStorage.java — unchanged.
public interface AvatarStorage {
    String store(UUID userId, byte[] content, String contentType);
}

// infrastructure/storage/S3AvatarStorage.java — the ONLY new file.
@Component
@RequiredArgsConstructor
public class S3AvatarStorage implements AvatarStorage {
    private final S3Client s3;      // credentials via IRSA — no keys in config

    @Override
    public String store(UUID userId, byte[] content, String contentType) {
        String key = "avatars/%s".formatted(userId);
        s3.putObject(PutObjectRequest.builder()
                .bucket(bucket).key(key).contentType(contentType).build(),
            RequestBody.fromBytes(content));
        return publicUrl + "/" + key;
    }
}
// UserService doesn't change. Its tests don't change. Delete the Minio bean.
```

**Presigned URLs — the pattern to volunteer:**

```java
// Instead of uploading THROUGH your service (2 MB through a JVM, holding a
// thread, counted against your pod's memory), hand the browser a signed URL
// and let it PUT straight to S3.
PresignedPutObjectRequest presigned = presigner.presignPutObject(r -> r
        .signatureDuration(Duration.ofMinutes(5))
        .putObjectRequest(b -> b.bucket(bucket).key(key)));
```

Your service does an authorization check and signs; the bytes never touch it.
It also makes `spring.servlet.multipart.max-file-size` and the nginx
`proxy-body-size` limit irrelevant — two configuration traps deleted.

Also: **storage classes + lifecycle rules** (transition to IA after 30 days),
**versioning** (recover from an overwrite), **block public access** on by
default — serve via **CloudFront + OAC** rather than making the bucket public.
SSE-S3 encryption is on by default now.

---

## ElastiCache

Redis for the `CachingUserStore` cache (`05-caching-redis.md`).

- **Cluster mode disabled** = one shard, replicas for HA. A normal Redis client
  works.
- **Cluster mode enabled** = data sharded across shards; the **client must be
  cluster-aware**, and multi-key operations only work within a slot. Switching
  is not transparent — Lettuce needs different configuration.
- **It's a cache: make it optional.** If Redis is unreachable, requests should
  fall through to Postgres, not 500. Spring's default `CacheErrorHandler`
  propagates the exception — override it to log and continue.

---

## Secrets Manager vs Parameter Store

| | Secrets Manager | SSM Parameter Store |
|---|---|---|
| Cost | ~$0.40/secret/month | free (standard tier) |
| Rotation | **built in**, with Lambda | DIY |
| Use for | DB passwords, API keys | config, feature flags |

Both reach pods the same way — **External Secrets Operator** syncs them into a
real Kubernetes Secret (see the commented `ExternalSecret` in
`06-full-stack-cluster/stack/01-config-and-secrets.yaml`).

⚠️ **Rotation doesn't restart your pods.** ESO updates the Secret; env vars were
injected once at container start, so nothing changes until a rollout. Pair it
with Reloader, or mount the secret as a file and re-read it.

---

## Networking

```
Route 53 → ALB (ACM cert) → EKS node → ingress controller → Service → pod
```

- **ALB** = layer 7 (host/path routing, WAF). **NLB** = layer 4, static IPs,
  and the only option for UDP — which is what LiveKit needs (`08-livekit.yaml`).
- **The AWS Load Balancer Controller** turns an `Ingress` into an ALB, or a
  `Service type=LoadBalancer` into an NLB.
- **`target-type: ip`** sends traffic straight to pod IPs instead of hopping
  through a NodePort. Fewer hops, and it preserves the client IP.
- ⚠️ **One `Service type=LoadBalancer` = one load balancer = one monthly bill.**
  That's the whole economic reason Ingress exists.
- Private subnets for nodes and databases; **VPC endpoints** for S3/ECR so that
  traffic doesn't leave via a NAT gateway (NAT data charges are a classic
  surprise line on the bill).

---

## Observability

- **Container Insights / CloudWatch Logs** — stdout from every pod, via Fluent
  Bit as a DaemonSet.
- **X-Ray** vs your Jaeger: both speak OTLP if you run the **ADOT Collector**.
  The practical answer is to send OTLP to a collector and keep the backend
  swappable — which is exactly what `MANAGEMENT_OTLP_TRACING_ENDPOINT` already
  does. Nothing in the app changes.
- **AMP + AMG** for managed Prometheus/Grafana if you don't want to run the
  StatefulSet in `10-observability.yaml`.

---

## SQS / SNS / EventBridge — and when to prefer them over Kafka

| | Use for |
|---|---|
| **SQS** | a work queue. At-least-once, no ordering (unless FIFO). Zero ops. |
| **SNS** | fan-out to N subscribers. Often SNS → several SQS queues. |
| **EventBridge** | event bus with content-based routing and AWS-service sources. |
| **MSK / Kafka** | a durable, **replayable** log with many independent consumers. |

**The honest recommendation for a small team:** if you need a queue, SQS is
right — zero operational cost, and a Kafka cluster is a full-time job. Choose
Kafka when you specifically need **replay**, **ordering per key**, or several
teams independently consuming the same stream. `09-kafka.md` makes the same
argument about this project.

---

## EKS specifics worth knowing

- **Karpenter over the Cluster Autoscaler** — it provisions right-sized nodes
  directly from pending pods' requirements, in ~60s, instead of scaling
  fixed-shape node groups.
- **Fargate** for pods removes node management, but: no DaemonSets (so your log
  agent needs a different approach), no `hostNetwork` (so **LiveKit can't run on
  it**), and per-pod pricing.
- **The zonal-volume trap**, which shows up as a stuck database pod: an EBS
  volume lives in one AZ. If the pod reschedules to another AZ it stays
  `Pending` with "volume node affinity conflict". `volumeBindingMode:
  WaitForFirstConsumer` — provision the disk *after* scheduling — prevents it
  (see `02-databases.yaml`).
- **VPC CNI gives each pod a real VPC IP**, so security groups apply to pods and
  you can exhaust subnet IPs. Plan CIDRs; prefix delegation raises pod density.

---

## Cost, briefly — a question that catches people out

The four biggest line items on a stack like this, and the fix for each:

1. **NAT Gateway data processing** — VPC endpoints for S3/ECR/Secrets Manager.
2. **One load balancer per Service** — one ALB + Ingress routing instead.
3. **Over-provisioned RDS running 24/7** — right-size; non-prod on a schedule.
4. **100% trace sampling** — the reason
   `MANAGEMENT_TRACING_SAMPLING_PROBABILITY` is `1.0` in dev and should be
   0.01–0.1 in production.

---

## 🧠 Hooks

- **IRSA: ServiceAccount annotation → OIDC → `AssumeRoleWithWebIdentity` → temporary credentials.** No static keys, scoped per workload.
- **Multi-AZ is availability; read replicas are scale.** Different problems.
- **The connection pool is per pod** — replicas × pool can exhaust RDS.
- **Presigned URLs keep the bytes out of your JVM entirely.**
- **Rotating a secret doesn't restart your pods.**
- **One `type=LoadBalancer` = one bill.** That's why Ingress exists.
- **EBS volumes are zonal** — `WaitForFirstConsumer`.
- **SQS unless you need replay.** Then Kafka.
- **Swapping MinIO for S3 is one adapter** — that's the architecture paying off.
