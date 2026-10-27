# Interview Questions — Java & Spring

Grouped by topic. Answers are the **short spoken version** — what you'd actually
say — with the trap noted where there is one.

Questions marked ⭐ are the ones that come up most.

---

## Spring core

**⭐ How does Spring Boot auto-configuration work?**
Boot reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
from every jar on the classpath, then applies each configuration class only if
its conditions pass — `@ConditionalOnClass`, `@ConditionalOnMissingBean`,
`@ConditionalOnProperty`. Auto-configurations are applied **last**, after your
beans, which is what makes `@ConditionalOnMissingBean` work: your bean always
wins. `common-utils` in this project uses exactly that to wire JWT security into
any service that depends on it.

**Why constructor injection over field injection?**
The fields can be `final`, so the object is immutable and can never exist
half-built; the class is testable with `new` and no reflection; a nine-argument
constructor visibly shouts that the class does too much, where field injection
hides it; and circular dependencies fail loudly at startup instead of resolving
into a half-initialised bean.

**⭐ What's the difference between `@Component`, `@Service`, and `@Repository`?**
To the container, `@Component` and `@Service` are identical — `@Service` is
documentation. `@Repository` is genuinely different: it adds exception
translation, converting vendor exceptions (Hibernate, raw SQLState) into
Spring's `DataAccessException` hierarchy.

**What scope are beans by default, and when would you change it?**
Singleton — one instance per container, and it must therefore be **stateless
and thread-safe**. `prototype` gives a new instance per injection; `request` and
`session` are web scopes. Injecting a prototype into a singleton doesn't do what
people expect: the singleton resolves it once and keeps it forever.

**Why does `@Configuration` use a CGLIB proxy?**
So that calling one `@Bean` method from another returns the **singleton** rather
than constructing a second object. With `@Configuration(proxyBeanMethods = false)`
or on a plain `@Component`, you'd silently get two instances of something you
believe is a singleton.

**⭐ Explain the proxy problem in one sentence.**
Spring wraps your bean in a proxy and callers hold the proxy — so a call from
one method of a class to another method of the same class never leaves the
object, never touches the proxy, and any annotation on the target
(`@Transactional`, `@Cacheable`, `@Async`, `@PreAuthorize`) silently does
nothing.

**How do you fix it?**
Make the call cross a bean boundary: move the annotated method to another
`@Service`/`@Component` and inject it. The caller then holds the proxy. Worse
options: self-inject with `@Lazy`, `AopContext.currentProxy()`, or AspectJ
weaving. It also fails silently on `private`/`final`/`static` methods, objects
made with `new`, a missing `@EnableAsync`/`@EnableCaching`/`@EnableMethodSecurity`,
and `@Async` methods that return something other than `void` or `Future`.
See `01-annotations.md` §0.

---

## Transactions & JPA

**⭐ Why didn't my `@Transactional` work?**
Four candidates, in order of likelihood: self-invocation; the method isn't
`public`; a **checked** exception was thrown (only `RuntimeException` and
`Error` roll back by default); or you're on the `jakarta.transaction` annotation
and expecting Spring-only attributes like `rollbackFor` to apply.

**What's `REQUIRES_NEW` for, and what's the risk?**
Running something that must survive the caller's rollback — an audit record, for
instance. The risk is that it takes a **second connection** from the pool while
the first is still held, so a loop of `REQUIRES_NEW` calls with a pool of 10
deadlocks at 5 concurrent requests.

**⭐ What is the N+1 problem and how do you fix it?**
One query loads N rows, then touching a lazy association fires one more query
per row. Fixes: `JOIN FETCH` or `@EntityGraph` for a specific query; **batch
fetching** (`hibernate.default_batch_fetch_size`) as an application-wide
default, which is what this project uses; or a projection so you never load the
entity. The trap: you cannot safely paginate a fetch-joined collection —
Hibernate pulls the whole result into memory and only warns.

**Why is `FetchType.EAGER` bad?**
It applies to *every* query of that entity, including ones that don't need the
association, and you can't turn it off per query. LAZY plus an explicit fetch
where needed is strictly more flexible. Note `@ManyToOne` defaults to EAGER —
override it.

**What's `open-in-view` and why turn it off?**
It keeps the Hibernate session open for the whole request so lazy loads "work"
in the view layer. It's on by default. Turn it off: it fires queries from your
presentation layer, holds a database connection for the entire request, and
hides N+1s until production. The `LazyInitializationException`s it reveals were
always bugs.

**⭐ `ddl-auto=update` vs Flyway?**
`update` only ever adds — it won't drop a column, change a type, or add an
index, and you can't review it before it runs. You end up with a schema nobody
can reproduce. Flyway owns the schema with reviewed, versioned, checksummed
migrations, and `ddl-auto=validate` makes the app refuse to start if the entities
and schema disagree.

**What makes a migration safe during a rolling deploy?**
Backward compatibility. Old and new pods run simultaneously against one schema,
so `DROP COLUMN` shipped with the code that stopped using it means 500s for the
length of the rollout. Expand in one release, contract in a later one.

**How do concurrent pods not corrupt each other running Flyway?**
Flyway takes a database lock (`pg_advisory_lock` on Postgres) — one pod
migrates, the rest wait, then all find the schema current.

---

## Caching

**⭐ Walk me through `@Cacheable`.**
Spring proxies the bean; on call it builds a key from the arguments via SpEL,
checks the cache, and returns the hit **without executing the method**. On a
miss it runs the method and stores the result. `@CachePut` always runs the
method and updates the cache — that's the difference. `@CacheEvict` removes.
None of it does anything without `@EnableCaching`.

**Why is the cache a separate `CachingUserStore` bean instead of annotations on
`UserService`?**
Three reasons: it keeps `UserService` free of Spring so it stays in the
framework-free application layer; it composes, because the decorator implements
the same port as the thing it wraps; and — the real one — it **avoids
self-invocation**. Any internal call inside `UserService` to its own
`@Cacheable` method would bypass the proxy and silently not cache.

**⭐ Why Redis rather than an in-process cache?**
Multiple replicas need a **shared** cache. With Caffeine, an evict on pod-A
leaves pod-B serving stale data until its TTL — and you'd never see it locally
where you run one instance. The cost is a ~1 ms network hop instead of ~100 ns.

**What goes wrong with caching?**
Stampede (a hot key expires and every request misses at once → lock or use
probabilistic early expiry); penetration (lookups for a key that never exists
always reach the DB → cache a short-lived tombstone); avalanche (everything
expires together → jitter the TTL). And eviction isn't transactional: if the
commit succeeds and the evict fails, you're stale until the TTL.

---

## Security

**⭐ How does Spring Security actually work?**
It's a chain of servlet filters that runs **before** the DispatcherServlet. Our
`JwtFilter` validates the Bearer token and puts an `Authentication` into the
`SecurityContextHolder`; later, `AuthorizationFilter` enforces the rules from
`authorizeHttpRequests`. The practical consequence is that `@ControllerAdvice`
can't catch a security failure — no controller was ever reached.

**⭐ Why access tokens *and* refresh tokens?**
A JWT is verified by signature alone, with no database lookup — that's why it
scales, and also why it **can't be revoked**. So you keep it short-lived (15
minutes) and pair it with a refresh token stored in Postgres, which is
revocable. Logout deletes the refresh row; the access token stays valid for up
to 15 minutes, and that's the accepted trade-off.

**Is a JWT encrypted?**
No — signed. The payload is base64 and anyone can read it. Never put secrets in
claims.

**HS256 vs RS256?**
HS256 is symmetric: one key signs and verifies, so **every service that
validates can also forge**. Acceptable inside one trust boundary, which is what
this project does. RS256 is asymmetric — only the issuer holds the private key,
everyone else verifies with the public key, and rotation via JWKS becomes a
non-event. That's the upgrade I'd make.

**How do you authenticate a WebSocket?**
The browser's WebSocket API can't set headers, so there's no
`Authorization: Bearer`. We authenticate in the handshake interceptor from a
query parameter and stash the user id in the session attributes. Two caveats
worth raising: a token in a query string leaks into logs — a short-lived
single-use ticket is better — and the token is checked **once**, so a
six-hour connection is never re-validated when it expires.

**`hasRole` vs `hasAuthority`?**
`hasRole('ADMIN')` checks for the authority `ROLE_ADMIN` — the prefix is added
for you. `hasAuthority('ADMIN')` checks the literal string. Mixing them gives
you a rule that never matches.

**Why is CSRF disabled here?**
CSRF protects cookie-based auth, where the browser attaches credentials
automatically. With a Bearer token in a header, a cross-site request can't read
the token to attach it, so the attack doesn't apply. Disabling CSRF on a
cookie-session app *would* be a vulnerability.

---

## Architecture

**⭐ Explain hexagonal architecture using your project.**
The application layer defines **ports** — `UserStore`, `TokenIssuer`,
`AvatarStorage` — and contains the domain model and use cases with no Spring,
no JPA, no Jackson. Infrastructure implements those interfaces:
`JpaUserStore`, `JwtTokenIssuer`, `MinioAvatarStorage`. Dependencies point
inward, so business logic never imports a framework. The interface is owned by
the code that *uses* it, not the code that implements it — that's what inverts
the dependency.

**What does it actually buy you?**
Concretely, three things. `AuthServiceTest` constructs the service with `new`
and in-memory fakes — no Spring context, milliseconds per test. Swapping MinIO
for S3 is one new adapter. And scaling `chat` horizontally is one new adapter
too: `EventGateway` is already a port, so replacing the in-memory implementation
with Redis pub/sub doesn't touch `ChatService` at all. That last one is an
architecture decision paying off as a deployment fix.

**Isn't mapping entity → domain just duplication?**
They change for different reasons: the entity changes when the schema changes,
the domain record when business rules change. Returning entities leaks
`LazyInitializationException` into controllers and publishes schema changes as
API changes. That said — for a CRUD service with no real domain rules, it *is*
overhead, and I'd skip it.

**How do you stop the boundary eroding?**
One `@Autowired UserRepository` in a service and it's gone. Make it a failing
test — ArchUnit asserting that nothing in `..application..` depends on
`..infrastructure..`.

---

## Microservices

**⭐ On Kubernetes, do you still need Eureka?**
No, and running both is worse than either. A Service already does registration,
health-gating, and load balancing — one layer down, in ~1 second. Eureka's
heartbeat plus eviction plus client cache is up to ~2 minutes of routing to dead
pods, it bypasses your readiness probes because `lb://` dials pod IPs directly,
and self-preservation mode makes it serve stale instances *deliberately* during
a rolling deploy. `lb://SESSION` becomes `http://session:8081`.

**Why one database per service?**
It's the boundary that makes them services. Share a database and you get
cross-service JOINs coupling the teams, one migration lock, one connection pool,
and one failure domain — you keep the operational cost of microservices and lose
the benefit.

**How do you trace a request across six services?**
Micrometer Tracing propagates a trace id via W3C `traceparent` headers; each
service exports spans over OTLP to Jaeger. `management.tracing.sampling.probability`
controls the rate — 1.0 in dev, 1–10% in production, because at 100% the trace
backend becomes your largest cost and the exporter starts adding latency.

**Where's the connection-pool trap in Kubernetes?**
The pool is **per pod**. Ten connections × eight replicas × three services is
240, and Postgres defaults to `max_connections=100`. Autoscaling then takes down
the database — it looks like a database problem and it's arithmetic. Size
against max replicas, or put PgBouncer in front.

**Why is the gateway reactive but the services aren't?**
The gateway is I/O-bound — it mostly waits on downstream calls, so Netty's
event loop handles thousands of concurrent connections on a few threads.
`session` does blocking JDBC anyway, so a servlet stack fits it. The rule is
never to block an event-loop thread: one blocking call in a gateway filter
stalls every request sharing that loop.

---

## Java

**⭐ Records vs classes — when do you use each?**
Records for immutable value carriers: DTOs, commands, results, domain values.
You get the constructor, accessors, `equals`/`hashCode`, and `toString` free,
and the type is final. Classes where you need mutability or framework
requirements — JPA entities need a no-arg constructor and setters, so they can't
be records.

**Are records fully immutable?**
Shallowly. A `Set<String>` component is a final *reference* to a possibly
mutable set. Defensive-copy in the compact constructor with `Set.copyOf`.

**⭐ What breaks if `hashCode` is inconsistent?**
The object gets lost in hash-based collections. The classic case is `@Data` on a
JPA entity: you add it to a `HashSet` while `id` is null, `save()` assigns the
id, the hash changes, and `contains()` now returns false for the object that's
sitting inside the set.

**`orElse` vs `orElseGet`?**
`orElse` always evaluates its argument, even on a hit. `orElseGet` takes a
supplier and only runs it on a miss. If the fallback is expensive or throws,
that's the difference between working and not.

**⭐ What are virtual threads and what do they change?**
Java 21 threads managed by the JVM rather than the OS — a few hundred bytes
instead of ~1 MB, so millions are viable. Blocking becomes cheap: the virtual
thread unmounts from its carrier and the carrier runs something else. So
thread-per-request stops being the scalability ceiling and you get WebFlux-like
throughput from ordinary blocking code, with one property.
The caveats: `synchronized` **pins** the thread to its carrier in 21 — use
`ReentrantLock`; it does nothing for CPU-bound work; and your connection pool is
still the real limit.

**`ConcurrentHashMap` vs `synchronizedMap`?**
`synchronizedMap` wraps everything in one lock — correct, and a bottleneck.
`ConcurrentHashMap` uses lock striping so writers to different buckets don't
contend. The trap: individual operations are atomic, but
`if (!containsKey(k)) put(k, v)` is two operations and races. Use
`computeIfAbsent`.

**`volatile` vs `AtomicInteger`?**
`volatile` gives **visibility** only — reads see the latest write. It does not
give atomicity: `volatile int i; i++` is still a lost-update race, because
that's a read, a modify, and a write. `AtomicInteger` does the whole
read-modify-write atomically via CAS.

---

## Testing

**⭐ Why Testcontainers instead of H2?**
Because you'd be testing a different database than you ship. H2 lacks Postgres's
`jsonb`, `ON CONFLICT`, exact constraint SQLStates, and locking semantics —
and Postgres-flavoured Flyway migrations often won't even run. A suite that
passes on H2 and fails on Postgres has negative value. It also means every run
validates that the migrations produce the schema the entities expect.

**Fake or mock?**
A fake is a working implementation with a shortcut — `InMemoryUserStore` backed
by a `HashMap` that actually enforces uniqueness — so the test proves behaviour.
A mock is scripted, so it tends to assert your *implementation*: change
`existsByUsername` to `findByUsername` with identical behaviour and the mock
test fails. Mocks are right for things you can't run — Twilio, payments.

**What's the `@DataJpaTest` trap?**
It replaces your DataSource with an embedded database by default, so you're
silently back to testing H2. `@AutoConfigureTestDatabase(replace = NONE)`.

---

## Kafka

**⭐ How does Kafka guarantee ordering?**
Per **partition**, never across a topic. A message's partition is
`hash(key) % partitions`, so anything that must stay in order must share a key —
for chat, the conversation id. Different conversations then spread across
partitions and process in parallel.

**⭐ How many consumers can read a partition?**
Exactly one per consumer group. So the partition count is your concurrency
ceiling — running 10 consumer pods against a 3-partition topic leaves 7
permanently idle. And you can't reduce partitions later; adding them changes
`hash(key) % n`, so existing keys move and ordering breaks across the boundary.

**Can you get exactly-once?**
Within Kafka, yes — idempotent producer plus transactions. End to end, no: the
moment you write to Postgres or call Twilio you're outside the transaction. The
real answer is **at-least-once with idempotent consumers** — dedupe on a
business key backed by a unique constraint, not an in-memory set.

**⭐ What's the dual-write problem?**
Saving to the database and publishing to Kafka in the same method. There's no
shared transaction: the DB commits and the publish fails, so they're
permanently inconsistent — and `@Transactional` won't roll back a Kafka send.
Fix with the **outbox pattern**: write the row and an outbox row in one
transaction, and let a relay (or Debezium reading the WAL) publish from the
outbox. That's at-least-once, which is why consumers must be idempotent.

**`acks=all` — is that enough to not lose data?**
No. It means all *in-sync* replicas, and the ISR can shrink to just the leader
if replicas fall behind — so it silently degrades to `acks=1`. You need
`min.insync.replicas=2` with `replication.factor=3` so the write fails loudly
instead.

**⭐ Your consumers keep rebalancing in a loop. Why?**
The listener takes longer than `max.poll.interval.ms` (default 5 minutes)
between polls, so the broker considers the consumer dead and reassigns the
partition. The new owner reprocesses the same batch, takes just as long, and it
rebalances again — the group never progresses. Lower `max.poll.records`, raise
the interval, or move the slow work off the listener thread.

**What happens to a message that always fails?**
Without a dead-letter topic it blocks the partition forever — nothing behind it
is processed. `DefaultErrorHandler` with a `DeadLetterPublishingRecoverer` and a
bounded backoff retries N times, publishes to `.DLT`, and moves on.

**Why does the deserializer need wrapping?**
A malformed message fails *before* your listener runs, so the error handler
never sees it and the consumer crash-loops on the same offset.
`ErrorHandlingDeserializer` turns it into a failed record the DLT can catch.

**Retention vs compaction?**
`delete` keeps N days/GB then drops — for events. `compact` keeps the latest
value per key forever — for state, so a new consumer can replay from the start
and rebuild it. A null value is a tombstone. Note Kafka retains by **time, not
until consumed**: a consumer down longer than the window loses messages.

**Kafka or RabbitMQ or SQS?**
Kafka is a durable, replayable log that many independent consumer groups can
read. RabbitMQ is a smart router that forgets once acked. SQS is a managed queue
with zero ops. If you need replay, ordering per key, or several teams reading
the same stream — Kafka. Otherwise SQS is almost always the better trade, because
running Kafka is a full-time job.

---

## PostgreSQL

**⭐ A query got slow. Walk me through it.**
`EXPLAIN (ANALYZE, BUFFERS)` — `ANALYZE` runs it so I see actuals, not
estimates. I check three things: the scan type (a `Seq Scan` on a big table with
a selective `WHERE` means a missing index), estimated vs **actual** rows (an
order-of-magnitude gap means stale statistics, so the planner is choosing
badly — `ANALYZE` the table), and the join type. To find *which* query in the
first place, `pg_stat_statements` sorted by `calls × mean_exec_time`, because a
5 ms query run a million times costs more than a 2-second report run twice.

**⭐ Which columns need an index that people forget?**
Foreign keys. A `UNIQUE` constraint creates an index automatically; a
**foreign key does not**. So `messages.conversation_id` gets a sequential scan
on every lookup, and deletes on the parent table scan too.

**How do you order a composite index?**
Equality columns first, then the range or sort column —
`(conversation_id, created_at DESC)`. It also serves queries on
`conversation_id` alone, which makes a separate single-column index redundant.
What it can't serve is a query on `created_at` alone, because that skips the
leftmost column.

**⭐ What's wrong with `OFFSET` pagination?**
Postgres generates and discards every skipped row, so page 2,000 reads 100,000
rows to return 50 — it degrades linearly and testing never catches it because
nobody scrolls that far. It's also unstable: an insert between requests shifts
everything, so users see duplicates or gaps. Keyset pagination —
`WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 50` —
is constant time at any depth and stable. The `id` in the tuple breaks
timestamp ties.

**Why does my table keep growing when the row count doesn't?**
MVCC. Postgres never updates in place — an `UPDATE` writes a new row version
and marks the old dead, and a `DELETE` only marks. Those dead tuples are bloat
until autovacuum reclaims them, and the default only triggers at 20% dead,
which on a 50M-row table is 10M dead rows. Lower
`autovacuum_vacuum_scale_factor` on write-heavy tables.

**`VACUUM` vs `VACUUM FULL`?**
`VACUUM` reclaims space for **reuse** — the file doesn't shrink. `VACUUM FULL`
rewrites the table and does shrink it, but takes an `ACCESS EXCLUSIVE` lock that
blocks everything. Never on a live table — `pg_repack` does it online.

**What's Postgres's default isolation level, and what does it prevent?**
`READ COMMITTED`. Worth knowing that Postgres has **no dirty reads at any
level** — `READ UNCOMMITTED` is accepted but behaves as `READ COMMITTED`, so
the generic textbook table doesn't apply. And if you raise to `REPEATABLE READ`
or `SERIALIZABLE`, transactions can abort with a serialization failure
(`40001`) — that's the contract, so the application **must** retry. Raising the
level without retry logic just turns anomalies into runtime errors.

**Two requests read a balance and both write. How do you stop the lost update?**
Pessimistic — `SELECT … FOR UPDATE` to lock up front, which is right when
conflicts are common. Or optimistic — a `@Version` column, so the `UPDATE` has
`AND version = ?` and zero rows updated means someone beat you. Optimistic is
right for most web traffic where conflicts are rare.

**⭐ How do multiple pods poll the same outbox table without fighting?**
`SELECT … FOR UPDATE SKIP LOCKED`. Each poller locks a different batch instead
of blocking on the same rows — it turns a table into a safe work queue with no
extra infrastructure. That's the relay half of the outbox pattern.

**How do you fix a deadlock?**
By making everything acquire locks in a **consistent order** — ascending id, for
instance. Retrying alone just deadlocks again. Postgres detects the cycle and
kills one transaction with `40P01`.

**⭐ What makes a migration dangerous?**
Locks. `CREATE INDEX` takes a write lock for the whole build — use
`CREATE INDEX CONCURRENTLY`. And the real killer is the **lock queue**: an
`ALTER TABLE` waiting behind one long-running `SELECT` blocks every subsequent
query on that table, because they queue behind the pending exclusive lock. A
"quick" migration takes the service down. Always `SET lock_timeout` so it fails
instead of blocking.

**`json` or `jsonb`?**
`jsonb` — parsed, binary, and GIN-indexable, so you can do `metadata @> '{...}'`
efficiently. `json` keeps the raw text and only matters if you need the exact
original bytes. But `jsonb` isn't a substitute for schema design: you lose type
checking, foreign keys, and NOT NULL, and the planner estimates poorly inside
it. If you filter on a key in every request, promote it to a real column.

**Any downside to UUID primary keys?**
Yes, and it's measurable on high-insert tables. UUIDv4 is random, so every
insert lands on a random B-tree page — page splits, index bloat, poor cache
locality, more WAL, versus a sequential key that always appends. UUIDs are still
right for distributed generation and for not leaking row counts in URLs, but
**UUIDv7** is time-ordered and gives you both. Also store as `uuid`, never
`varchar(36)`.

**Why can't I just raise `max_connections`?**
Each connection is a separate OS process using several MB. Past roughly
cores × 2–4 you lose throughput to context switching, so more connections make
it slower. The fix is pooling — and remember the pool is per pod, so
pool × replicas × services is the number that has to fit.

---

## AWS

**⭐ How does a pod get AWS credentials without access keys?**
IRSA. The ServiceAccount is annotated with a role ARN; EKS runs an OIDC
provider and injects a projected token into the pod; the SDK calls
`sts:AssumeRoleWithWebIdentity` and gets temporary, auto-rotating credentials.
The role's trust policy pins the exact `system:serviceaccount:<ns>:<name>`, so
only that workload can assume it — permissions are scoped per pod rather than
per node, which is what the old instance-profile approach couldn't do.

**Multi-AZ or read replica?**
Different problems. Multi-AZ is a **synchronous standby for availability** — it
serves no traffic. A read replica is **asynchronous, for read scaling**, and it
can lag, so never read your own write from one.

**⭐ Your service autoscaled and the database fell over. Why?**
The connection pool is per pod. Ten connections × eight replicas × three
services is 240 against an instance that allows a few hundred total. Size the
pool against max replicas, or put RDS Proxy in front — which also holds
connections open across a failover.

**How would you move avatar uploads off your service?**
Presigned S3 URLs. The service authorizes and signs a URL; the browser PUTs
directly to S3. The bytes never touch the JVM, which removes the multipart size
limit, the nginx body-size limit, and the memory cost all at once.

**What's involved in swapping MinIO for S3 here?**
One new adapter implementing the existing `AvatarStorage` port, plus deleting
the Minio bean. `UserService` and its tests don't change — that's the hexagonal
boundary paying off.

**Secrets Manager or Parameter Store?**
Secrets Manager for credentials — it has built-in rotation, and costs ~$0.40 per
secret per month. Parameter Store (standard tier) is free and fine for config.
Either way External Secrets Operator syncs them into a Kubernetes Secret. The
trap: **rotation doesn't restart your pods**, and env vars are read once at
container start, so nothing changes until a rollout.

**Why is my database pod stuck in Pending?**
Almost always the zonal-volume trap — an EBS volume lives in one AZ, and if the
pod is scheduled to a node in another it can't attach ("volume node affinity
conflict"). `volumeBindingMode: WaitForFirstConsumer` fixes it by provisioning
the disk after the pod is scheduled.

**Where does the money go on a stack like this?**
NAT Gateway data processing (fix with VPC endpoints for S3/ECR), one load
balancer per `type=LoadBalancer` Service (fix with a single ALB + Ingress),
over-provisioned RDS running 24/7, and 100% trace sampling. That last one is why
sampling is 1.0 in dev and 1–10% in production.

---

## The "what would you change?" question

Have three ready. Good ones for this codebase:

1. **RS256 instead of HS256** — today every service that validates a token can
   also forge one.
2. **A shared event bus for `chat`** — it can't run more than one replica,
   because socket sessions live in an in-memory map. `EventGateway` is already a
   port, so it's one adapter.
3. **`STATUS_MAPPING` uses `Map.ofEntries` + `findFirst`**, which is unordered.
   It's fine while the exception hierarchy is flat, but the day someone adds a
   subclass of an already-mapped exception, which status wins is
   non-deterministic.

Naming a real weakness in your own code — with the reason it hasn't bitten yet —
is a much stronger signal than claiming there isn't one.
