# 11 — PostgreSQL

`03-data-jpa-transactions.md` is the ORM side. This is the **database** side —
what Hibernate is doing underneath, and what breaks when the table gets big.

Three Postgres 16 instances here: `session` (users, servers, refresh tokens),
`chat` (conversations, messages), `comms` (SMS records). The `chat` message
table is the one that grows without limit, so it's the worked example
throughout.

---

## Indexes

### B-tree — the default, and 95% of what you need

```sql
CREATE INDEX idx_users_username ON users (username);
-- Supports:  = , < , > , BETWEEN , IN , ORDER BY , and LIKE 'prefix%'
-- Does NOT support:  LIKE '%substring%'   (no anchored prefix -> seq scan)
```

⚠️ **A UNIQUE constraint creates an index; a foreign key does NOT.**
That's the most common missing index in any schema — `messages.conversation_id`
has an FK, and without an explicit index every `WHERE conversation_id = ?`
*and* every `DELETE` on the parent does a sequential scan.

### Composite indexes and the leftmost-prefix rule

```sql
-- The index that actually matters for chat:
CREATE INDEX idx_messages_conv_created
    ON messages (conversation_id, created_at DESC);

-- USES the index:
WHERE conversation_id = ?                            -- leftmost column ✅
WHERE conversation_id = ? ORDER BY created_at DESC   -- both, in order ✅
-- Does NOT use it:
WHERE created_at > ?                                 -- skips the leftmost ❌
```

> **Rule: equality columns first, then the range/sort column.** A composite
> index on `(a, b)` also serves queries on `a` alone — so it makes a separate
> index on `a` redundant. That's how you cut index count.

### Partial — index only the rows you query

```sql
-- Refresh tokens: you only ever look up ones that haven't been revoked.
CREATE INDEX idx_refresh_active ON refresh_tokens (token_value)
    WHERE revoked = false;
-- Smaller, so it stays in memory, and writes to revoked rows don't touch it.
```

### Covering — an index-only scan

```sql
CREATE INDEX idx_users_lookup ON users (username) INCLUDE (id, email);
-- Postgres answers straight from the index without visiting the table.
-- ⚠️ Only if the visibility map says the page is all-visible — which means
-- autovacuum has to have run. An "index-only scan" that still shows
-- "Heap Fetches: 12000" in EXPLAIN is a vacuum problem, not an index problem.
```

### GIN — for `jsonb`, arrays, and full-text

```sql
CREATE INDEX idx_msg_search ON messages
    USING GIN (to_tsvector('english', body));
SELECT * FROM messages
 WHERE to_tsvector('english', body) @@ plainto_tsquery('english', 'deploy');
-- This is what makes `LIKE '%word%'` unnecessary. GIN is bigger and slower to
-- write than B-tree, and worth it for search.
```

### The cost nobody mentions

**Every index slows down every write** — an `INSERT` updates the table *and*
every index on it. Six indexes on a hot table means six extra writes per row.
Find the unused ones:

```sql
SELECT relname, indexrelname, idx_scan
  FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY relname;
```

---

## `EXPLAIN` — how to actually read it

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM messages WHERE conversation_id = '...' ORDER BY created_at DESC LIMIT 50;
```

`EXPLAIN` alone shows the *plan*. **`ANALYZE` runs it and shows reality** —
that's the one you want. `BUFFERS` shows cache hits vs disk reads.

```
Limit  (cost=0.43..8.20 rows=50 width=180) (actual time=0.02..0.14 rows=50 loops=1)
  ->  Index Scan Backward using idx_messages_conv_created on messages
        Index Cond: (conversation_id = '...')
        Buffers: shared hit=53
Planning Time: 0.1 ms
Execution Time: 0.2 ms
```

**Read it inside-out**, and check these three things:

1. **Scan type.** `Seq Scan` on a large table with a selective `WHERE` = missing
   index. (`Seq Scan` on a *small* table is correct — don't "fix" it.)
2. **`rows` estimated vs `actual`.** An order-of-magnitude gap means stale
   statistics → the planner is choosing badly → `ANALYZE messages;`.
3. **Join type.** `Nested Loop` is right for few rows, disastrous for many;
   `Hash Join` for big unsorted sets; `Merge Join` when both sides are sorted.

| Node | Means |
|---|---|
| `Seq Scan` | read every row |
| `Index Scan` | walk the index, fetch each row from the heap |
| `Index Only Scan` | answered from the index alone (needs vacuum) |
| `Bitmap Heap Scan` | many matches — collect them, then read pages in order |
| `Sort` with `external merge Disk` | **`work_mem` too small** — it spilled to disk |

```sql
-- Find what to look at in the first place (needs pg_stat_statements):
SELECT calls, mean_exec_time, query FROM pg_stat_statements
 ORDER BY mean_exec_time * calls DESC LIMIT 10;
-- Sort by TOTAL time, not mean: a 5 ms query run a million times costs more
-- than a 2-second report run twice.
```

---

## Pagination — the one that breaks in production

Chat has an unbounded message table, so this is the most relevant performance
item in the whole file.

```sql
-- ❌ OFFSET. Postgres must generate and DISCARD every skipped row.
SELECT * FROM messages WHERE conversation_id = ?
 ORDER BY created_at DESC OFFSET 100000 LIMIT 50;
-- Reads 100,050 rows to return 50. Gets linearly slower the deeper you scroll,
-- and it's fine in testing where nobody scrolls past page 3.
-- Second bug: if a new message arrives between pages, everything shifts and
-- the user sees a duplicate or misses one.

-- ✅ KEYSET / cursor pagination. Constant time at any depth.
SELECT * FROM messages
 WHERE conversation_id = ?
   AND (created_at, id) < (?, ?)      -- the last row of the previous page
 ORDER BY created_at DESC, id DESC
 LIMIT 50;
-- Uses idx_messages_conv_created directly. Page 10,000 costs the same as
-- page 1, and it's stable under concurrent inserts.
```

The tuple comparison `(created_at, id) < (?, ?)` is what breaks ties when two
messages share a timestamp — without the `id` you can drop or repeat rows.

**This is exactly the shape a chat "load older messages" endpoint wants**, which
is why `Pageable`/`OFFSET` is the wrong default here.

---

## MVCC, bloat, and VACUUM

> **Postgres never updates a row in place.** An `UPDATE` writes a *new* row
> version and marks the old one dead. A `DELETE` just marks it dead. Readers
> never block writers and writers never block readers — that's MVCC, and this
> is the price.

Dead rows accumulate = **bloat**: the table gets physically bigger, scans read
more pages, and performance degrades even though `count(*)` hasn't changed.

**autovacuum** reclaims them. It's on by default, and on a write-heavy table it
is frequently not aggressive enough:

```sql
-- Default: vacuum after 20% of the table is dead. On a 50M-row messages table
-- that's 10M dead rows before it even starts.
ALTER TABLE messages SET (autovacuum_vacuum_scale_factor = 0.02);

SELECT relname, n_dead_tup, last_autovacuum FROM pg_stat_user_tables
 ORDER BY n_dead_tup DESC;
```

- `VACUUM` reclaims space **for reuse**; it doesn't shrink the file.
- `VACUUM FULL` **does** shrink it — and takes an `ACCESS EXCLUSIVE` lock,
  blocking everything. Never on a live table; use `pg_repack`.
- `ANALYZE` updates planner statistics. Stale stats = bad plans.
- **Transaction ID wraparound**: a long-idle transaction blocks vacuuming, XIDs
  approach the 2-billion limit, and Postgres will eventually refuse writes to
  protect itself. Monitor `idle in transaction` — a connection leak in the app
  is the usual cause, and Hikari's `leakDetectionThreshold` catches it.

---

## Isolation and locking

```
READ COMMITTED   ← Postgres default. Each STATEMENT sees a fresh snapshot.
REPEATABLE READ    the whole TRANSACTION sees one snapshot.
SERIALIZABLE       as if transactions ran one at a time (SSI).
```

⚠️ Postgres has **no dirty reads at any level** — `READ UNCOMMITTED` is accepted
and behaves as `READ COMMITTED`. Don't recite the generic textbook table.

⚠️ `REPEATABLE READ` and `SERIALIZABLE` can abort with a **serialization
failure** (`40001`). That's not a bug — it's the contract, and the application
**must retry**. Raising the isolation level without adding retry logic just
converts anomalies into runtime errors.

### The lost update, and the two fixes

```sql
-- Two requests both read balance=100, both write 90. One update vanishes.

-- (a) PESSIMISTIC: take the lock up front.
SELECT * FROM accounts WHERE id = ? FOR UPDATE;   -- blocks other writers
-- JPA: @Lock(LockModeType.PESSIMISTIC_WRITE)

-- (b) OPTIMISTIC: detect the conflict at write time.
UPDATE accounts SET balance = 90, version = version + 1
 WHERE id = ? AND version = 3;                    -- 0 rows updated = conflict
-- JPA: @Version (see 03-data-jpa-transactions.md)
```

Optimistic is right when conflicts are rare (most web apps); pessimistic when
they're common or retrying is expensive.

### `SKIP LOCKED` — the outbox relay in one query

```sql
-- Exactly what the outbox pattern from 09-kafka.md needs. Multiple relay pods
-- poll the same table; each grabs a different batch instead of blocking.
SELECT * FROM outbox WHERE published_at IS NULL
 ORDER BY created_at LIMIT 100
 FOR UPDATE SKIP LOCKED;
```

This turns a table into a safe work queue with no extra infrastructure — worth
knowing before reaching for a message broker.

### Deadlocks

Two transactions grabbing the same rows in **opposite order**. Postgres detects
it and kills one with `40P01`.

> **The fix is ordering, not retrying:** always lock rows in a consistent
> order (e.g. ascending id). Retrying alone means you deadlock again.

---

## `jsonb`

```sql
ALTER TABLE messages ADD COLUMN metadata jsonb;
CREATE INDEX idx_msg_meta ON messages USING GIN (metadata);
SELECT * FROM messages WHERE metadata @> '{"type":"system"}';
```

`jsonb` is parsed, binary, indexable. `json` stores the raw text and is only
right if you need the exact original bytes preserved.

**Use it for genuinely variable data** — third-party webhook payloads, feature
flags. **Not as a way to avoid designing a schema:** you lose type checking,
foreign keys, and NOT NULL, and the planner estimates poorly inside it. If you
query a key in every request, promote it to a real column.

---

## Constraints belong in the database

```sql
ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username);
```

The app already checks `existsByUsername` before inserting (`AuthService`) —
and that check is a **race**: two concurrent registrations both see "free" and
both insert. Only the unique constraint stops it. The app check is for a nice
error message; the constraint is for correctness.

```java
// So catch the violation as well as checking first:
try { users.create(...); }
catch (DataIntegrityViolationException e) {   // @Repository translates 23505
    throw new ConflictException("username_taken", "Username is already in use");
}
```

Same for foreign keys, `CHECK`, and `NOT NULL`: the database is the only place
a rule can't be bypassed by a second service, a script, or a race.

---

## UUID primary keys — a real cost in this schema

Every entity here uses `@GeneratedValue(strategy = GenerationType.UUID)`, i.e.
**UUIDv4 — random**.

```
BIGSERIAL   sequential -> new rows append to the rightmost B-tree page.
            Dense index, few page splits, excellent cache locality.
UUIDv4      random -> every insert lands on a random page. Page splits,
            index bloat, poor cache hit rate, more WAL. Measurable on
            high-insert tables — which `messages` is.
UUIDv7      time-ordered (RFC 9562). UUID uniqueness with B-tree locality.
```

UUIDs are still the right call for distributed id generation and for not
leaking row counts in URLs. But **know the trade-off**, and know that **UUIDv7
is the modern answer** — Hibernate 6.5+ supports it directly:

```java
@Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.TIME)
private UUID id;
```

Also: store as `uuid`, never `varchar(36)` — 16 bytes vs 37, and correct
comparison semantics.

---

## Partitioning — when `messages` gets big

```sql
CREATE TABLE messages (
    id uuid, conversation_id uuid, body text, created_at timestamptz
) PARTITION BY RANGE (created_at);

CREATE TABLE messages_2026_07 PARTITION OF messages
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

Queries with `created_at` in the `WHERE` touch only the relevant partitions
(**partition pruning**), indexes stay small, and dropping old data becomes
`DROP TABLE partition` — instant, versus a `DELETE` that generates millions of
dead rows for autovacuum to clean up.

⚠️ The partition key **must** be in the primary key, and queries that omit it
scan every partition. Don't reach for this before ~50–100M rows.

---

## Migrations that lock the table

The operational half of Flyway (`03-data-jpa-transactions.md` covers the
versioning half). Every one of these has caused an outage somewhere:

```sql
-- ❌ Locks the table against writes for the whole build.
CREATE INDEX idx_messages_conv ON messages (conversation_id);
-- ✅ No write lock. Slower, can't run inside a transaction, and can leave an
--    INVALID index if it fails — check for it and retry.
CREATE INDEX CONCURRENTLY idx_messages_conv ON messages (conversation_id);
```

```sql
-- ❌ Pre-PG11 this rewrote the whole table. Modern Postgres handles a constant
--    default cheaply, but a VOLATILE default still rewrites.
ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active';
-- ✅ Safe pattern: add nullable -> backfill in batches -> add NOT VALID
--    constraint -> VALIDATE (takes only a SHARE UPDATE EXCLUSIVE lock).
```

⚠️ **The lock queue is the real killer.** An `ALTER TABLE` waiting behind one
long-running `SELECT` blocks *every subsequent query* on that table, because
they queue behind the pending exclusive lock. A "quick" migration takes the
whole service down. Always set a timeout so it fails instead:

```sql
SET lock_timeout = '5s';
```

---

## Connections

```sql
SHOW max_connections;   -- default 100
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

**Each connection is a separate OS process (~5–10 MB).** Postgres does not scale
by adding connections — past roughly `cores × 2–4` you lose throughput to
context switching.

This is the same trap from `03` and `10-aws.md`, and it's worth being able to
state as arithmetic: **pool size × replicas × services vs `max_connections`.**
10 × 8 × 3 = 240 against a default of 100. Fix by sizing the pool against max
replicas, or with PgBouncer / RDS Proxy in transaction-pooling mode.

⚠️ PgBouncer in **transaction** mode breaks anything session-scoped —
prepared statements, `SET`, advisory locks, `LISTEN/NOTIFY`. It's not a
transparent drop-in.

---

## Useful queries to have memorised

```sql
-- What's running right now, longest first
SELECT pid, now()-query_start AS dur, state, query FROM pg_stat_activity
 WHERE state <> 'idle' ORDER BY dur DESC;

-- Who is blocking whom
SELECT pid, pg_blocking_pids(pid), query FROM pg_stat_activity
 WHERE cardinality(pg_blocking_pids(pid)) > 0;

-- Table + index sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
  FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;

-- Cache hit ratio: should be > 0.99
SELECT sum(heap_blks_hit)/(sum(heap_blks_hit)+sum(heap_blks_read)) FROM pg_statio_user_tables;

SELECT pg_cancel_backend(pid);     -- cancel the query
SELECT pg_terminate_backend(pid);  -- kill the connection
```

---

## 🧠 Hooks

- **A UNIQUE constraint indexes; a FOREIGN KEY does not.** The most common missing index.
- **Composite index: equality columns first, range/sort last.** `(a,b)` also serves `a`.
- **`EXPLAIN (ANALYZE, BUFFERS)`** — and compare **estimated vs actual rows**.
- **`OFFSET` reads and discards everything before it.** Keyset pagination is constant-time.
- **Postgres never updates in place** — hence dead rows, bloat, and autovacuum.
- **`VACUUM FULL` takes an exclusive lock.** Never on a live table.
- **`READ COMMITTED` is the default and there are no dirty reads at any level.**
- **`SERIALIZABLE` means you must handle `40001` retries.**
- **`FOR UPDATE SKIP LOCKED`** turns a table into a work queue.
- **Deadlocks are fixed by consistent lock ordering, not retries.**
- **`CREATE INDEX CONCURRENTLY`**, and `SET lock_timeout` on every migration.
- **UUIDv4 keys fragment B-trees** — UUIDv7 if inserts are hot.
- **Connections are processes.** Pool × replicas × services vs `max_connections`.
