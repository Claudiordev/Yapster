# EXPLAIN ANALYZE and BUFFERS (PostgreSQL)

`EXPLAIN ANALYZE` tells you how long each part of a query took. `BUFFERS` tells you **why**: how much data it touched and where that data came from.

```sql
EXPLAIN                      SELECT * FROM orders WHERE user_id = 1;   -- plan only, doesn't run
EXPLAIN ANALYZE              SELECT * FROM orders WHERE user_id = 1;   -- runs it, real times and rows
EXPLAIN (ANALYZE, BUFFERS)   SELECT * FROM orders WHERE user_id = 1;   -- plus I/O info
```

`EXPLAIN ANALYZE` really executes the query. For writes, wrap it in a transaction and roll back:

```sql
BEGIN;
EXPLAIN (ANALYZE, BUFFERS) UPDATE orders SET total = total + 1 WHERE user_id = 1;
ROLLBACK;
```

## 1. What BUFFERS shows

Postgres reads data in 8 KB pages ("buffers"). Each plan node reports:

```
Buffers: shared hit=120 read=3400 dirtied=5 written=2
```

| Field | Meaning |
|---|---|
| `shared hit` | Pages found in Postgres's memory cache (fast) |
| `shared read` | Pages fetched from disk or the OS cache (slow) |
| `dirtied` | Pages modified by the query |
| `written` | Pages the query itself had to write out |
| `temp read/written` | Spilled to temp files on disk (sort/hash too big for `work_mem`) |

A query can be slow because it read a lot (many buffers), because it read from disk (high `read`), or because it spilled (`temp`). Time alone can't tell those apart.

The first run is often slow (cold cache) and the second fast. `hit` vs `read` makes that visible, so run it twice and trust the second run for normal production behavior.

## 2. How to read a plan

1. Find the node with the biggest **actual time**. It is per loop, so total = `time x loops`.
2. Check its **Buffers**: lots of `read` means disk, `temp` means spill, big `hit` means lots of in-memory work.
3. Compare **estimated vs actual rows** at that node.
4. Apply one fix, rerun `EXPLAIN (ANALYZE, BUFFERS)`, and compare.

## 3. What to look for, and the fix

| Sign in the plan | Likely cause | Fix |
|---|---|---|
| `Seq Scan` on a big table, few rows returned | Missing index | `CREATE INDEX` |
| Estimated rows far from actual rows | Stale or weak statistics | `ANALYZE table` |
| `Rows Removed by Filter` is huge | Filter can't use the index | Matching or composite index |
| `Sort Method: external merge Disk: ...` | Sort spilled to disk | Raise `work_mem`, return fewer rows |
| Nested Loop with a large outer side | Bad join choice or missing index | Index join column, fix estimates |
| Node with a very large `loops` | N+1 pattern inside the query | Rewrite as a join or `IN` |
| Many buffers for few rows | Scanning far more than needed | Narrower filter, better index, avoid `SELECT *` |

## 4. Cases with fixes

### Seq Scan on a big table with a selective filter

```
Seq Scan on orders  (actual time=0.02..180.5 rows=2 loops=1)
  Filter: (user_id = 1)
  Rows Removed by Filter: 999998
  Buffers: shared read=8200
```

It read 8,200 pages to return 2 rows.

```sql
CREATE INDEX idx_orders_user_id ON orders (user_id);
```

After the fix: `Index Scan using idx_orders_user_id ... Buffers: shared hit=4`.

A Seq Scan is the right plan for a small table, or when the query returns most of the rows. An index won't help there.

### Estimated rows far from actual rows

```
Index Scan ... (cost=... rows=1) (actual ... rows=50000 loops=1)
```

The planner guessed 1 and got 50,000, so it may have chosen a bad join or scan.

```sql
ANALYZE orders;                                              -- refresh stats
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;   -- more detail on skewed columns
-- correlated columns: CREATE STATISTICS ...
```

### Huge `Rows Removed by Filter` even with an index

The index doesn't match the filter.

```sql
WHERE lower(email) = 'a@b.com'      -- plain index on email is not used
-- fix: CREATE INDEX ON users (lower(email));

WHERE status = 'paid' AND created_at > '2025-01-01'
-- fix: CREATE INDEX ON orders (status, created_at);

WHERE user_id = 1::text             -- type mismatch prevents index use
-- fix: compare with matching types
```

### Sort or Hash spilling to disk

```
Sort Method: external merge  Disk: 52000kB
Buffers: temp read=6500 written=6500
```

```sql
SET work_mem = '64MB';              -- for this session
```

Or return fewer rows, or add an index that already provides the sort order.

### Nested Loop with a big outer side

```
Nested Loop (actual rows=1000000 loops=1)
  -> Seq Scan on users
  -> Index Scan on orders (loops=1000000)
```

A million index lookups. Check the join column is indexed, run `ANALYZE`, and find out why the planner expected fewer rows. A Hash Join is often the faster plan here.

### A node with a large `loops` count

`actual time` is per loop. `loops=50000` at 0.1 ms each is 5 seconds in total. This is the N+1 pattern inside the query, so rewrite it as a join or `IN`.

### Too many buffers for the rows returned

Returning 10 rows with `shared hit=500000` means the query scans far more than it needs. Narrow the filter, add a better index, or avoid `SELECT *` on wide tables.

## 5. Other tools

- `pg_stat_statements`: which queries cost the most overall.
- `auto_explain`: logs plans of slow queries automatically.
- `\timing` in psql: runtime per statement.
- explain.depesz.com, explain.dalibo.com: paste a plan to visualise it.

🧠 **Hook:** *Time says a query is slow, BUFFERS says why: too many pages read, read from disk, or spilled to temp. Fix one thing, rerun, compare.*
