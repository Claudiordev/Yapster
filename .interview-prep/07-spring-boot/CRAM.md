# 30-Minute Cram — Java & Spring

*Read top to bottom. Bold lines are the ones to say out loud.*

---

## The one idea

> **Most Spring annotations are implemented as a proxy around your bean.
> Self-invocation bypasses the proxy, so the annotation silently does nothing.**

`@Transactional`, `@Cacheable`, `@Async`, `@PreAuthorize` — all the same failure.
This single sentence answers about six different questions.

---

## Annotations that actually matter

| | Does |
|---|---|
| `@SpringBootApplication` | `@Configuration` + `@EnableAutoConfiguration` + `@ComponentScan` (**downward from its own package only**) |
| `@Component/@Service` | identical to Spring. `@Service` is documentation |
| `@Repository` | **+ exception translation** (vendor → `DataAccessException`) |
| `@Configuration` | `@Bean` methods are CGLIB-proxied → calling one returns the **singleton** |
| `@Primary` | breaks the tie when two beans implement one interface |
| `@ConditionalOnMissingBean` | "only if the user didn't define one" — works because auto-config runs **last** |
| `@ConfigurationProperties` | type-safe config, relaxed binding (`minio.access-key` = `MINIO_ACCESS_KEY`) |
| `@Valid` | **without it, nothing is validated.** Silently |
| `@Validated` (on class) | needed for constraints on `@RequestParam`/`@PathVariable` |

---

## Transactions — the 4 traps

1. **Self-invocation** → no transaction.
2. **Checked exceptions COMMIT.** Only `RuntimeException`/`Error` roll back.
   → `rollbackFor = Exception.class`
3. **Public methods only.**
4. **Two annotations, same name.** `jakarta.transaction` has no `propagation`,
   `isolation`, `readOnly`, or `rollbackFor`.

`REQUIRES_NEW` takes a **second connection** → pool exhaustion under load.
Postgres default isolation is `READ_COMMITTED`, and that's right ~95% of the time.

---

## JPA

- **Dirty checking** — a managed entity is written at flush; no `save()` needed.
- **N+1**: 1 query + 1 per row. Fix with `JOIN FETCH` / `@EntityGraph` /
  **`default_batch_fetch_size`** (what this repo uses) / a projection.
- ⚠️ **You cannot paginate a fetch-joined collection** — Hibernate loads it all
  into memory and only warns.
- **Never `EAGER`.** `@ManyToOne` defaults to it — override it.
- **`open-in-view=false`.** It's on by default; it hides N+1s and holds a
  connection for the whole request.
- **`@Enumerated(EnumType.STRING)`, always.** ORDINAL stores the index.
- **`@Data` on an `@Entity` is a bug** — `hashCode` changes when the id is
  assigned, and the object is lost inside its own `HashSet`.
- **`ddl-auto=validate` + Flyway.** `update` only ever adds and can't be reviewed.
- **Migrations must be backward compatible** — old and new pods share one schema.
- **The connection pool is per pod.** replicas × pool > `max_connections`.

---

## Caching

```java
@Primary @Component
class CachingUserStore implements UserStore {
    CachingUserStore(JpaUserStore delegate) { ... }   // CONCRETE, or it wraps itself

    @Cacheable(value="users", key="#id", unless="#result == null")
    Optional<User> findById(UUID id) { ... }

    @CacheEvict(value="users", key="#user.id()")
    User update(User user) { ... }
}
```

- **Decorator, not annotations on the service** → domain stays framework-free,
  it composes, and **it avoids self-invocation**.
- **Spring unwraps `Optional` before SpEL** → `#result` is the bare value.
- **Redis not Caffeine**: replicas need a **shared** cache, or an evict on one
  pod leaves the others stale.
- **Every cache needs a TTL** — the default manager has none.
- `@Cacheable` **skips** the method on a hit; `@CachePut` **always** runs it.

---

## Security

```
request → [ CorsFilter → CsrfFilter → JwtFilter → … → AuthorizationFilter ] → DispatcherServlet → controller
```

- **Filters run before controllers** → **`@ControllerAdvice` cannot catch a 401/403.**
- **A JWT is signed, not encrypted.** Anyone can read the claims.
- **Stateless = unrevocable** → short access token (15 min) + revocable refresh
  token in Postgres. Logout deletes the refresh row.
- **HS256 is symmetric** → every validator can also forge. RS256 fixes it.
- **`hasRole('ADMIN')` checks `ROLE_ADMIN`.**
- **`SecurityContextHolder` is a ThreadLocal** — lost across `@Async` and
  `parallelStream`.
- **WebSockets can't send headers** → authenticate at handshake, and it's
  **never re-checked** for the life of the connection.
- CSRF is disabled because Bearer tokens aren't attached automatically by the
  browser — the attack doesn't apply.

---

## Architecture

```
application/            ← NO Spring, NO JPA
  domain/               records
  port/                 UserStore, TokenIssuer, AvatarStorage, EventGateway
  service/              AuthService, UserService
infrastructure/         ← adapters implement the ports
  persistence/ security/ storage/ controllers/
```

- **Dependencies point inward.** `infrastructure` → `application`, never back.
- **The port is owned by the code that USES it.** That's the inversion.
- **If the port looks like `JpaRepository`, you've renamed your ORM.**
- **Entity ≠ domain model** — they change for different reasons.
- **The payoff to quote:** `EventGateway` is a port, so making `chat` scale
  horizontally is one new Redis adapter and zero changes to `ChatService`.

---

## Java 21

- **Records**: final, immutable, free `equals`/`hashCode` — but **shallow**
  (`Set.copyOf` in the compact constructor).
- **`Optional`** = return type only. Never a field (not `Serializable`), never
  a parameter. **`orElseGet` is lazy; `orElse` always evaluates.**
- **No terminal op = the stream never runs.** `.toList()` over
  `collect(toList())`.
- **Never `parallelStream()` in a request** — shared `commonPool`, loses ThreadLocals.
- **Virtual threads**: blocking becomes cheap, thread-per-request scales.
  ⚠️ `synchronized` **pins** in 21 (use `ReentrantLock`), no help for CPU-bound
  work, **and the connection pool is still the ceiling**.
- **`volatile` = visibility, not atomicity.** `i++` still races.
- **`ConcurrentHashMap`**: ops are atomic, `containsKey` + `put` is not →
  `computeIfAbsent`.
- **Sealed + switch** = compiler-enforced exhaustiveness.

---

## Testing

- **Unit**: `new AuthService(...)` with **fakes**. No Spring. Milliseconds.
  **If a business-rule test needs a context, the boundary leaked.**
- **Fake vs mock**: a fake enforces the rules and proves behaviour; a mock
  asserts your implementation back at you.
- **Testcontainers, never H2** — different SQL, different constraint codes, and
  your Flyway migrations may not even run. It also proves migrations match the
  entities.
- `static @Container` = one per class. `@DynamicPropertySource` because the port
  is random.
- **`@DataJpaTest` silently swaps in an embedded DB** → `replace = NONE`.

---

## Errors

- **One exception class per HTTP status**; the specific reason is a `code`
  field, not a subclass.
- One `@ControllerAdvice` maps class → status → **`ProblemDetail` (RFC 7807)**.
- It cannot catch anything thrown in a **filter**.

---

## Microservices

| Compose | Kubernetes |
|---|---|
| a service | Deployment + Service |
| `environment:` | ConfigMap + Secret |
| `depends_on` | **nothing** — readiness probes + retry |
| **Eureka** | **redundant — a Service *is* service discovery** |

- **`lb://SESSION` → `http://session:8081`.**
- **Database per service** — the boundary that makes them services.
- **Tracing**: W3C `traceparent` → OTLP → Jaeger. Sample 1–10% in prod.
- **Gateway is reactive because it's I/O-bound** — never block the event loop.

---

## Kafka

- **Ordering is per PARTITION.** `hash(key) % partitions` → same key, same
  partition. Key by conversation / order id.
- **One partition → exactly one consumer per group.** Partition count *is* your
  concurrency ceiling. Extra pods idle.
- **Consumer groups SHARE work.** Broadcast to every instance needs a group
  **per instance**.
- **At-least-once + idempotent consumers.** Exactly-once dies the moment you
  write to Postgres.
- **`acks=all` + `min.insync.replicas=2`** — `acks=all` alone degrades to
  `acks=1` when the ISR shrinks.
- **⭐ Never dual-write DB + Kafka.** → **Outbox**: both rows, one transaction;
  a relay (or Debezium/CDC) publishes.
- **No DLT = a poison message blocks the partition forever.**
- **Slow listener > `max.poll.interval.ms` → endless rebalance loop.**
- **`ErrorHandlingDeserializer`**, or a bad message crash-loops on one offset.
- **Retention is by TIME, not until consumed.** `compact` keeps latest-per-key.
- **Consumer lag** is the scaling signal (KEDA), not CPU.

---

## PostgreSQL

- **UNIQUE creates an index. FOREIGN KEY does NOT.** ← most common missing index.
- **Composite index: equality first, range/sort last.** `(a,b)` also serves `a`
  alone. `WHERE b = ?` alone uses **nothing**.
- **`EXPLAIN (ANALYZE, BUFFERS)`** — check **estimated vs actual rows** (a big
  gap = stale stats → `ANALYZE`), and scan/join type.
- **⭐ `OFFSET 100000` reads and throws away 100,000 rows.** Keyset:
  `WHERE (created_at, id) < (?, ?) ORDER BY … LIMIT 50` — constant time, stable
  under inserts.
- **No in-place updates** → dead rows → **bloat** → autovacuum. Default triggers
  at 20% dead; lower `autovacuum_vacuum_scale_factor` on hot tables.
- **`VACUUM` reuses space, `VACUUM FULL` shrinks it and takes an ACCESS
  EXCLUSIVE lock.** Never live — `pg_repack`.
- **`READ COMMITTED` default; no dirty reads at ANY level in Postgres.**
- **`SERIALIZABLE`/`REPEATABLE READ` can abort with `40001` — you MUST retry.**
- **`FOR UPDATE SKIP LOCKED`** = a work queue in one query (the outbox relay).
- **Deadlock (`40P01`) → fix the lock ORDER**, not by retrying.
- **`CREATE INDEX CONCURRENTLY`** + **`SET lock_timeout`** on every migration —
  an `ALTER` behind one long `SELECT` blocks the whole table.
- **`jsonb` not `json`** (binary, GIN-indexable). Not a substitute for a schema.
- **UUIDv4 PKs fragment the B-tree** (random inserts). UUIDv7 = ordered.
- **Connections are OS processes.** pool × replicas × services vs
  `max_connections` (default 100).

---

## AWS

- **⭐ IRSA**: SA annotation → OIDC → `AssumeRoleWithWebIdentity` → temporary
  credentials. **No static keys**, scoped per pod not per node. Trust policy
  pins `system:serviceaccount:ns:name`.
- **Multi-AZ = availability** (standby serves nothing). **Read replica = scale**
  (async, lags — don't read your own write).
- **⭐ Pool is per pod.** replicas × pool > RDS max_connections → outage. RDS
  Proxy, or size against max replicas.
- **S3 presigned URLs** — bytes never touch your JVM; multipart + nginx body
  limits become irrelevant.
- **MinIO → S3 = one adapter.** The port doesn't change.
- **Rotating a secret does NOT restart pods** (env read once at start).
- **EBS is zonal** → `WaitForFirstConsumer` or Pending forever.
- **One `type=LoadBalancer` = one bill** → that's why Ingress exists.
- **SQS unless you need replay**; then Kafka/MSK.
- Cost: NAT data · one LB per service · idle RDS · 100% trace sampling.

---

# THE 10 LINES TO WALK IN WITH

1. **Spring annotations are proxies — self-invocation silently skips them.**
2. **Checked exceptions commit; only unchecked roll back.**
3. **No `@Valid`, no validation.**
4. **`@Data` on an entity breaks `hashCode` when the id is assigned.**
5. **Flyway owns the schema; `validate` enforces it; migrations must be backward compatible.**
6. **Cache as a decorator on a separate bean — composes, and dodges self-invocation.**
7. **A JWT is signed, not encrypted, and can't be revoked — hence refresh tokens.**
8. **Security filters run before controllers, so `@ControllerAdvice` can't catch a 401.**
9. **The port belongs to the layer that uses it. If you need Spring to unit test business logic, the boundary leaked.**
10. **Virtual threads make blocking cheap — but the connection pool is still the ceiling.**
11. **Kafka orders per partition; never dual-write to the DB and Kafka — use the outbox.**
12. **IRSA gives pods temporary AWS credentials with no static keys** — and the connection pool is *still* per pod.

---

*Deeper: `01-annotations.md` · `02-architecture-hexagonal.md` ·
`03-data-jpa-transactions.md` · `04-security-jwt.md` · `05-caching-redis.md` ·
`06-web-and-errors.md` · `07-testing.md` · `08-java21-core.md` ·
`09-kafka.md` · `10-aws.md` ·
**`QUESTIONS.md`** (~60 Q&A). Infra: `06-full-stack-cluster/`.*
