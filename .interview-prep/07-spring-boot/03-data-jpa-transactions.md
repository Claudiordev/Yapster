# 03 — JPA, Transactions, Flyway

The layer that produces the most production incidents and the most interview
questions.

---

## The persistence context, in one paragraph

The `EntityManager` holds a **persistence context** — a first-level cache of
managed entities, scoped to the transaction. Inside it, entities are *managed*:
Hibernate tracks changes and, at flush, writes the diff automatically. Outside
it, they're *detached*: changes go nowhere, and touching a lazy field throws.

```java
@Transactional
public void rename(UUID id, String name) {
    UserEntity u = repo.findById(id).orElseThrow();   // loaded + snapshot taken: "alice"
    u.setUsername(name);                               // only the Java object changes: "bob"
    // NO repo.save(u) NEEDED. `u` is managed; DIRTY CHECKING writes the UPDATE
    // at flush/commit. This surprises people coming from JDBC.
}   // <- method ends, transaction commits: flush compares with the snapshot, sends the UPDATE
```

**When the save happens:** nothing hits the database at `setUsername`, it's a
plain setter. When `findById` loads the entity, Hibernate keeps a **snapshot**
of its values. Before the commit it **flushes**: compares each managed entity
with its snapshot, queues an `UPDATE` for the ones that differ, sends the SQL,
then commits. A flush can also happen earlier: with the default `FlushMode.AUTO`
Hibernate flushes before a query that pending changes could affect, and
`repo.flush()` / `saveAndFlush()` force it.

```
Before the commit, Hibernate runs a flush:

flush:
  for each managed entity:
      compare current values with the snapshot
      different? -> it's "dirty" -> queue an UPDATE
  send the queued SQL to the database

then:  COMMIT
```

**Flush can also happen earlier.** With the default `FlushMode.AUTO`, Hibernate
flushes before running a query that could be affected by pending changes:

```java
u.setUsername("bob");
repo.findByUsername("bob");     // Hibernate flushes the UPDATE first, so this query sees the change
```

Without that early flush, the query would hit the database before the `UPDATE`
and miss the user you just renamed. The flush isn't a commit: the `UPDATE` is
sent but can still be rolled back.

**`save()` does not flush.** It only makes the entity managed (an `INSERT` for a
new one, a `merge` for a detached one). The SQL goes out at the next flush or
commit. Only `repo.flush()` or `saveAndFlush()` force it right away:

```java
repo.save(u);            // managed, SQL may not have run yet
repo.flush();            // sends the pending SQL now (still inside the transaction)
repo.saveAndFlush(u);    // save + flush in one call
```

One exception: with `GenerationType.IDENTITY` ids, Hibernate must run the
`INSERT` during `save()` to get the generated id. That is the insert only, and
other pending changes still wait for the flush. Use `flush()` when you need
database errors (a unique-constraint violation, say) to surface at a specific
line instead of at commit.

It only works on a **managed** entity inside a **transaction**. With no
transaction (including `@Transactional` skipped by self-invocation), the change
is silently lost. A detached or `new` entity needs `save()`.

```java
// Entity states — worth being able to name:
//   TRANSIENT  new UserEntity()        not in the context, no db row
//   MANAGED    findById(...) inside a tx  tracked, dirty-checked
//   DETACHED   returned from a closed tx  changes ignored, lazy loads throw
//   REMOVED    repo.delete(u)             deleted at flush
```

| State | What it is | Does Hibernate track it? |
|---|---|---|
| **TRANSIENT** | A plain Java object from `new`. Never saved, no database row | No. Changes are ignored until you `save()` it |
| **MANAGED** | Loaded or saved **inside a transaction**. Hibernate keeps a snapshot | **Yes.** Dirty-checked, written at flush/commit |
| **DETACHED** | It has a database row, but the transaction or session that loaded it is closed | No. Setter changes go nowhere, and touching an unloaded lazy field throws `LazyInitializationException` |
| **REMOVED** | Marked for deletion by `repo.delete(...)` | Yes, until the flush sends the `DELETE` |

**How a MANAGED entity becomes DETACHED:**

```java
// 1. The transaction ends (the normal way)
@Transactional
public UserEntity load(UUID id) { return repo.findById(id).get(); }  // MANAGED
// <- method returns, commit, persistence context closes: the caller gets a DETACHED entity

// 2. em.detach(u): detach just one, even inside the transaction
em.detach(u);          // later setters on u are not saved

// 3. em.clear(): detach everything (big batch jobs; flush() first, pending changes are dropped)
em.clear();

// 4. em.close(): only if you manage the EntityManager yourself
```

With `open-in-view=true` (the Boot default) the session stays open for the whole
web request, so lazy loads in the controller still work, but there is no flush
without a transaction, so changes still aren't saved.

**Back to MANAGED:** `repo.save(u)` on a detached entity does a `merge` and
returns a **managed copy**. The original `u` stays detached, so use the returned object.

### The action queue: `save()` and `delete()` only queue SQL

Hibernate doesn't run SQL when you call `save()`, a setter or `delete()`. It
puts an **action** on an internal queue (the `ActionQueue`) and runs the queue at
**flush**.

```java
@Transactional
void demo() {
    var a = new UserEntity();            // TRANSIENT
    a.setUsername("new-guy");
    repo.save(a);                        // TRANSIENT -> MANAGED, INSERT queued (not sent yet)

    var b = repo.findById(id).get();
    b.setUsername("changed");            // UPDATE queued at flush (found by dirty checking)

    repo.delete(repo.findById(old).get());   // DELETE queued
}   // flush: the queue is executed, then COMMIT
```

```
Queue while the method runs        Order at flush (fixed by Hibernate, NOT your call order)
  INSERT user "new-guy"            1. INSERTs
  UPDATE user set username=...     2. UPDATEs
  DELETE user (old)                3. collection removals / updates / inserts
                                   4. DELETEs   <- last
```

What follows from that:
- **SQL order is not your code order.** Inserts run before updates, and deletes run last.
- **The delete-then-insert trap:** `repo.delete(old); repo.save(new)` with the same unique value (same email, say) sends the `INSERT` before the `DELETE`, so you get a unique-constraint violation. Fix it by calling `repo.flush()` after the delete.
- **Errors show up late.** A constraint violation from a queued `INSERT` appears at the flush, not on the `save()` line. Call `flush()` where you want it to fail early.
- **Batching:** with `hibernate.jdbc.batch_size`, queued inserts and updates of the same kind are sent together in batches.
- **`IDENTITY` ids skip the wait:** the `INSERT` must run during `save()` to get the generated id, so that one isn't queued (this also switches off insert batching).
- **Rollback is free:** if an exception hits before the flush, the queue is thrown away and nothing was sent.

---

## `@Transactional` — the four traps

```java
// (1) SELF-INVOCATION. The #1 question.
@Service
public class OrderService {
    public void process() {
        this.save();     // ❌ direct call — never leaves the object, so the
                         //    proxy never sees it. NO TRANSACTION. Silent.
    }
    @Transactional public void save() { ... }
}
```

Why: Spring wraps the bean in a proxy. Callers hold the *proxy*; `this` is the
*target*. The fix is to move the method to another bean (correct), or inject
self (works, ugly), or use AspectJ weaving (heavy).

```java
// (2) ROLLBACK RULES. Rolls back on RuntimeException and Error ONLY.
//     A CHECKED exception COMMITS the transaction. Reliably surprising.
@Transactional                              // IOException -> COMMITS
@Transactional(rollbackFor = Exception.class)   // now it rolls back
```

```java
// (3) PUBLIC METHODS ONLY (with the default proxy mode).
//     private/protected/package-private @Transactional is silently ignored.
```

```java
// (4) TWO ANNOTATIONS WITH THE SAME NAME.
import jakarta.transaction.Transactional;                        // JTA
import org.springframework.transaction.annotation.Transactional; // Spring
// Both start a transaction. Only the SPRING one supports
// propagation / isolation / readOnly / rollbackFor.
// AuthService imports the jakarta one — fine, but you can't tune it, and
// `rollbackFor` is unavailable. Know which one you're looking at.
```

### Propagation — the two that matter

```java
REQUIRED      // default: join the caller's transaction, or start one
REQUIRES_NEW  // SUSPEND the caller's, run in a brand-new one, resume

// REQUIRES_NEW is how you write an audit row that survives a rollback:
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void auditFailedLogin(String username) { ... }
// ⚠️ It uses a SECOND connection from the pool while the first is held open.
// A pool of 10 and a loop calling this = deadlock at 5 concurrent requests.
```

### Isolation — know what each prevents

| Level | Prevents |
|---|---|
| `READ_UNCOMMITTED` | nothing (dirty reads possible) |
| `READ_COMMITTED` | dirty reads ← **Postgres default** |
| `REPEATABLE_READ` | + non-repeatable reads |
| `SERIALIZABLE` | + phantom reads |

Postgres's `READ_COMMITTED` is right for ~95% of work. Raising it globally to
"be safe" costs throughput and invites serialization failures you must retry.

---

## SQL locks — what they protect

A transaction can lock database data so another transaction cannot make a
conflicting change at the same time. A lock is held until `COMMIT` or
`ROLLBACK`.

```sql
BEGIN;

SELECT *
FROM account
WHERE account_id = :id
FOR UPDATE;                         -- row write lock

-- read the balance, calculate the new balance, update it
UPDATE account SET balance = balance - 50 WHERE account_id = :id;

COMMIT;                             -- releases the lock
```

`FOR UPDATE` is not an ordinary read. It reads the row and locks it. A second
transaction trying to update, delete, or `SELECT ... FOR UPDATE` that row waits
until the first transaction finishes:

These two queries are therefore different:

```sql
SELECT *
FROM app_category_catalogue_lock;
-- ordinary read: does not take a write lock

SELECT *
FROM app_category_catalogue_lock
WHERE lock_id = 1
FOR UPDATE;
-- read this row and lock it for writing until the transaction ends
```

`FOR UPDATE` is the part that requests the lock. The query is still a
`SELECT`, but it has a write-locking side effect. It only works inside an open
transaction and only locks rows returned by the query.

```text
Transaction A: BEGIN; SELECT ... FOR UPDATE;  -- gets the lock
Transaction B: BEGIN; SELECT ... FOR UPDATE;  -- waits
Transaction A: COMMIT;                        -- unlocks
Transaction B:                                  -- continues
```

A normal `SELECT` may still read the old committed version in PostgreSQL;
locks mainly coordinate conflicting writes. The row must exist: `FOR UPDATE`
on an empty result locks nothing.

### Common lock types

| Lock | What it locks | Typical SQL | Typical use |
|---|---|---|---|
| Row lock | Selected rows | `SELECT ... FOR UPDATE` | Update one account, order, seat, or job |
| Table lock | An entire table | `LOCK TABLE account IN ... MODE` | A deliberate table-wide operation |
| Shared/read row lock | Selected rows for shared reading | `SELECT ... FOR SHARE` | Several readers may coordinate; writers wait |
| Exclusive/write row lock | Selected rows for writing | `SELECT ... FOR UPDATE` | Other conflicting readers/writers wait |

PostgreSQL has several table-lock modes with different conflict rules. Avoid
table locks in normal request code: they block more work than necessary and are
database-specific. Prefer a row lock or a database constraint.

### Use case: two users modify the same record

Without a lock, both requests can read quantity `10`, both calculate `15`, and
the second update overwrites the first. Lock the row while calculating:

```sql
BEGIN;
SELECT quantity FROM product WHERE product_id = 42 FOR UPDATE;
UPDATE product SET quantity = quantity + 5 WHERE product_id = 42;
COMMIT;
```

For ordinary CRUD, optimistic locking is often better: add a version column
and let the second update fail instead of making it wait:

```java
@Version
private long version;
```

Use pessimistic locking when the operation must serialize immediately or the
row is highly contended. Use `@Version` when conflicts are uncommon and the
caller can retry or report a conflict.

### Use case: bank balance or inventory

The lock protects the read-modify-write sequence, not just the final update:

```sql
BEGIN;
SELECT balance FROM account WHERE account_id = 7 FOR UPDATE;
-- check that balance >= 50 in application code
UPDATE account SET balance = balance - 50 WHERE account_id = 7;
COMMIT;
```

For a simple inventory decrement, one atomic SQL statement plus a constraint
can be even better:

```sql
UPDATE stock
SET available = available - 1
WHERE product_id = 42 AND available > 0;
```

Check the affected-row count. `1` means it reserved stock; `0` means it was
already unavailable. A lock is not a replacement for a `CHECK`, `UNIQUE`, or
foreign-key constraint.

### Use case: reserve a seat

```sql
BEGIN;
SELECT status FROM seat WHERE seat_id = 18 FOR UPDATE;
-- only change it when status = 'AVAILABLE'
UPDATE seat SET status = 'RESERVED', reserved_by = :user_id
WHERE seat_id = 18;
COMMIT;
```

The second buyer waits, then sees `RESERVED` and receives a conflict instead of
both buyers receiving the same seat.

### Use case: process a job once with multiple workers

`SKIP LOCKED` is useful for a queue. Each worker takes different rows instead
of waiting for rows another worker already claimed:

```sql
BEGIN;

SELECT job_id
FROM jobs
WHERE status = 'READY'
ORDER BY job_id
FOR UPDATE SKIP LOCKED
LIMIT 10;

UPDATE jobs SET status = 'RUNNING' WHERE job_id IN (...);
COMMIT;
```

`SKIP LOCKED` is for work distribution, not for normal business reads. The
claim and status update must be in a transaction, and jobs need retry/timeout
handling if a worker crashes.

### Use case: category ordering

Category display orders are a property of the whole catalogue. Locking one
category row is not enough: another request could insert or reorder a different
row. A permanent singleton row gives every mutation one stable lock target:

```sql
BEGIN;

SELECT lock_id
FROM app_category_catalogue_lock
WHERE lock_id = 1
FOR UPDATE;

-- create, delete, or reorder app_category rows

COMMIT;
```

The lock row is not a category. It is a technical row that acts as a database
mutex. It remains available even when the category table is empty or when a
category such as `GENERAL` is deleted.

### Hibernate / Spring Data JPA

Spring Data maps a pessimistic repository lock to `SELECT ... FOR UPDATE`:

```java
public interface AccountRepository extends JpaRepository<AccountEntity, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from AccountEntity a where a.id = :id")
    Optional<AccountEntity> findForUpdate(@Param("id") UUID id);
}
```

The caller must be inside a transaction. Otherwise the database connection
can release the lock as soon as the query returns:

```java
@Transactional
public void withdraw(UUID accountId, BigDecimal amount) {
    AccountEntity account = accounts.findForUpdate(accountId).orElseThrow();
    account.withdraw(amount);       // managed entity; Hibernate flushes it
}                                    // commit releases the lock
```

Other JPA lock modes:

```java
@Lock(LockModeType.PESSIMISTIC_READ)   // shared/read lock
@Lock(LockModeType.PESSIMISTIC_WRITE)  // exclusive/write lock
@Lock(LockModeType.OPTIMISTIC)         // use @Version checking
```

Database-specific options such as `NOWAIT` and `SKIP LOCKED` usually require a
native query:

```java
@Query(value = """
    select * from jobs
    where status = 'READY'
    order by job_id
    for update skip locked
    limit :limit
    """, nativeQuery = true)
List<JobEntity> claimableJobs(int limit);
```

Remember:

- Keep locked transactions short; never wait for a remote HTTP call while
  holding a database lock.
- Always lock rows in a consistent order to reduce deadlocks.
- A deadlock is detected by the database and one transaction is aborted; the
  application should retry safe transactions.
- A lock coordinates concurrent work; constraints enforce data correctness.

---

## N+1 — the question you will be asked

```java
// 1 query for the users...
List<UserEntity> users = repo.findAll();
for (UserEntity u : users) {
    u.getRoles().size();     // ...+1 query PER USER. 100 users = 101 queries.
}
```

**Four fixes, and the trade-off of each:**

```java
// (1) JOIN FETCH — one query, exactly what you need.
@Query("select distinct u from UserEntity u left join fetch u.roles")
List<UserEntity> findAllWithRoles();
// ⚠️ `distinct` is required: the join duplicates the user row per role.
// ⚠️ You CANNOT paginate a fetch-joined collection safely — Hibernate warns
//    "firstResult/maxResults specified with collection fetch; applying in
//    memory" and pulls the WHOLE table into the JVM. Silent OOM at scale.

// (2) @EntityGraph — the same thing, declaratively.
@EntityGraph(attributePaths = {"roles"})
Optional<UserEntity> findWithRolesById(UUID id);

// (3) BATCH FETCHING — what THIS repo uses:
//     spring.jpa.properties.hibernate.default_batch_fetch_size=16
//     Turns 100 extra queries into ~7 (IN-clauses of 16). No distinct needed,
//     and pagination still works. The best default for a whole application.

// (4) A PROJECTION — don't load the entity at all.
public interface UserSummary { UUID getId(); String getUsername(); }
List<UserSummary> findAllProjectedBy();
```

**How to detect it:** `spring.jpa.show-sql=true` in dev, or fail the build with
`datasource-proxy`/Hypersistence Utils asserting a query count per test.

---

## `FetchType` and the exception everyone has seen

```java
@ManyToOne(fetch = FetchType.LAZY)    // ✅ always. Default for @ManyToOne is EAGER
@OneToMany                            // already LAZY by default
```

**Never `EAGER`.** It loads the association on *every* query of that entity,
including ones that don't need it, and you cannot turn it off per-query. LAZY
plus an explicit fetch where needed is strictly more flexible.

```java
// LazyInitializationException: touching a lazy field after the transaction
// closed (i.e. in the controller, or during JSON serialisation).
//
// The correct fix: load what you need INSIDE the transaction and map to a DTO
// there. Which the hexagonal structure already forces — JpaUserStore maps
// Entity -> domain record inside the adapter.
//
// The wrong fixes:
//   spring.jpa.open-in-view=true  (Boot's DEFAULT, and it should be off)
//     Keeps the session open for the whole request so lazy loads "work" — by
//     firing queries from your view layer, holding a DB connection for the
//     entire request, and hiding N+1s until production.
//   Hibernate.initialize(...)     manual, easy to forget
```

```properties
spring.jpa.open-in-view=false
# Worth setting explicitly and being able to explain. It will surface
# LazyInitializationExceptions — that's the point: they were always bugs.
```

---

## Flyway, and `ddl-auto`

```properties
spring.jpa.hibernate.ddl-auto=validate   # compare entities to schema, FAIL if
                                         # they differ. Never write DDL.
spring.flyway.enabled=true               # Flyway owns the schema. Full stop.
```

| `ddl-auto` | Does |
|---|---|
| `none` | nothing |
| `validate` | **checks and fails on mismatch** ← use this |
| `update` | tries to patch the schema — **never in production** |
| `create` / `create-drop` | drops your data. Tests only. |

> **Why `update` is dangerous:** it only ever adds. It won't drop a column,
> won't change a type, won't add an index, and it can't be reviewed before it
> runs. You end up with a schema nobody can reproduce and no history of how it
> got there.

```
session/src/main/resources/db/migration/
├── V1__baseline.sql
├── V2__add_refresh_tokens.sql
└── V3__add_user_avatar_url.sql
```

- Migrations are **immutable once merged**. Flyway stores a checksum in
  `flyway_schema_history`; editing an applied file fails validation on the next
  boot for everyone. Fix forward with `V4__`.
- `V` = versioned (once, in order). `R__` = repeatable (re-runs when its
  checksum changes — views, functions).
- **Backward compatibility is the operational rule.** During a rolling deploy,
  old and new code run against one schema simultaneously. Expand in one release
  (add a nullable column, dual-write), contract in a later one (drop the old).
  Shipping `DROP COLUMN` with the code that stopped using it means 500s for the
  duration of the rollout.
- Concurrent pods are safe: Flyway takes a `pg_advisory_lock`, so one migrates
  and the rest wait.

---

## Connection pool (HikariCP)

```properties
spring.datasource.hikari.maximum-pool-size=10   # default. Sizing rule of thumb:
                                                # ((core_count * 2) + spindles)
spring.datasource.hikari.minimum-idle=10        # = max, to avoid churn
spring.datasource.hikari.connection-timeout=30000  # wait for a connection
spring.datasource.hikari.max-lifetime=1800000      # < the DB's idle timeout!
```

**The Kubernetes-specific trap:** the pool is **per pod**. 10 connections ×
8 replicas × 3 services = 240 connections, and Postgres's default
`max_connections` is 100. Autoscaling then takes down the database, which looks
like a database problem and is actually a maths problem. Either size the pool
against `max_replicas`, or put PgBouncer in front.

---

## Locking: optimistic vs pessimistic

**The problem both solve: the lost update.** Two requests read the same row,
both change it, the second write silently overwrites the first.

```
A reads balance=100     B reads balance=100
A writes 90             B writes 80      <- A's change is gone, no error
```

### Optimistic: assume conflicts are rare, detect them at write time

No database lock is held. A `@Version` column is checked when you save.

```java
@Entity
public class ServerEntity {
    @Id UUID id;
    private String name;

    @Version                    // Hibernate adds `AND version = ?` to the UPDATE
    private long version;       // and increments it
}
```

```sql
UPDATE server SET name = ?, version = 4 WHERE id = ? AND version = 3;
-- 0 rows updated -> someone else saved first -> ObjectOptimisticLockingFailureException
```

How to use it: nothing extra on the repository. Handle the failure by retrying
or telling the user.

```java
// retry: re-read, re-apply, save again (needs spring-retry, or a loop)
@Retryable(retryFor = ObjectOptimisticLockingFailureException.class, maxAttempts = 3)
@Transactional
public void rename(UUID id, String name) {
    var s = repo.findById(id).orElseThrow();   // fresh read each attempt
    s.setName(name);
}                                              // flush -> version check
```

⚠️ `@Retryable` must wrap the `@Transactional` method from **outside** (another
bean), or each retry reuses a dead transaction. Same proxy rule as always.

For a web form, return **409 Conflict** ("someone else edited this, reload") by
mapping the exception in `@ControllerAdvice`. If the version travels with the
DTO (`ETag` / `If-Match`), you also catch edits made between page load and save.

Use cases: profile and settings edits, renaming a server or chat, admin
screens. Conflicts are rare and a retry is cheap.

### Pessimistic: assume conflicts are likely, lock the row up front

The database row is locked until the transaction ends. Others **wait**.

```java
public interface AccountRepository extends JpaRepository<Account, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)            // SELECT ... FOR UPDATE
    @Query("select a from Account a where a.id = :id")
    Optional<Account> findForUpdate(UUID id);
}

@Transactional                                       // REQUIRED: the lock lives as long as the tx
public void withdraw(UUID id, long amount) {
    var a = repo.findForUpdate(id).orElseThrow();    // others block here
    a.debit(amount);
}                                                    // commit releases the lock
```

Modes: `PESSIMISTIC_WRITE` = `FOR UPDATE` (nobody else reads-for-update or
writes). `PESSIMISTIC_READ` = shared lock (others may read, nobody writes).

Add a timeout so a stuck holder doesn't hang everyone:
`@QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))`.

Use cases: balances, stock and inventory counters, seat or ticket booking,
anything where conflicts are frequent or a retry is costly or has side effects.
Work queues use `FOR UPDATE SKIP LOCKED` (see `11-postgresql.md`).

### Which one?

| | Optimistic | Pessimistic |
|---|---|---|
| Mechanism | `@Version`, check on write | `FOR UPDATE`, lock on read |
| Holds a DB lock | No | Yes, until commit |
| On conflict | Exception -> retry or 409 | Others wait (or time out) |
| Best when | Conflicts are rare (most web apps) | Conflicts are common or retries are expensive |
| Risks | Retry storms under heavy contention | Waiting, deadlocks, long locks hurt throughput |

Pessimistic rules: keep the transaction **short** (no HTTP calls or user
think-time while holding a lock), and lock rows in a consistent order to avoid
deadlocks.

---

## 🧠 Hooks

- **Dirty checking means you don't call `save()`** on a managed entity.
- **Self-invocation kills `@Transactional`.** Silently.
- **Checked exceptions COMMIT.**
- **`EAGER` is never the answer; batch fetching is the best global default.**
- **`open-in-view=false`** — the exceptions it reveals were always bugs.
- **Flyway owns the schema; `ddl-auto=validate` enforces it.**
- **Migrations must be backward compatible** — old and new pods share one schema.
- **The pool is per pod.** Replicas × pool size can exceed `max_connections`.
- **Optimistic = `@Version`, detect at write, retry or 409. Pessimistic = `FOR UPDATE`, others wait.** Optimistic by default; pessimistic for hot rows.
