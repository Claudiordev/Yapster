# SQL Practice Scenarios: Debug, Build, Fix

Hands-on scenarios for PostgreSQL. Each one has a task, a query that is broken in a realistic way, how to find the problem, and the fix.

## Setup

Load the practice database from `SQL_PRACTICE_SETUP.sql`:

```bash
createdb practice
psql -d practice -f SQL_PRACTICE_SETUP.sql
psql -d practice            # then run the scenarios below
```

Tables: `users`, `products`, `orders` (200k rows), `order_items` (~400k rows), `accounts`. There are no indexes except primary keys. Re-running the setup file resets everything.

Try each scenario yourself first: run the broken query, form a theory, and only then read the debug and fix parts.

## The debugging loop

1. **Reproduce** with the smallest query that shows the problem.
2. **Compare to a known truth**, like a simpler query, a `count(*)`, or a hand-checked row.
3. **Isolate**: remove joins and filters one at a time until the result changes.
4. **Form one theory**, change one thing, and rerun.
5. **For slow queries**, use `EXPLAIN (ANALYZE, BUFFERS)` before and after every change.

---

# Part A: Wrong results or errors

## A1. Revenue is double what it should be (join fan-out)

**Task:** paid revenue and order count per country.

```sql
SELECT u.country,
       sum(o.total) AS revenue,
       count(*)     AS orders
FROM users u
JOIN orders o       ON o.user_id = u.id
JOIN order_items i  ON i.order_id = o.id
WHERE o.status = 'paid'
GROUP BY u.country;
```

**Symptom:** revenue and order counts look about twice as big as they should be.

**Debug:**

```sql
-- the truth, without the items join
SELECT sum(total), count(*) FROM orders WHERE status = 'paid' AND user_id IS NOT NULL;

-- the suspect: rows vs distinct orders after the join
SELECT count(*) AS rows_after_join, count(DISTINCT o.id) AS real_orders
FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.status = 'paid';
```

`rows_after_join` is larger than `real_orders`. An order with 3 items becomes 3 rows, so `o.total` gets summed 3 times.

**Fix:** don't join `order_items` if you don't need it:

```sql
SELECT u.country, sum(o.total) AS revenue, count(*) AS orders
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.status = 'paid'
GROUP BY u.country;
```

If you do need item data, aggregate it down to one row per order **before** joining:

```sql
WITH units AS (
    SELECT order_id, sum(qty) AS units
    FROM order_items
    GROUP BY order_id
)
SELECT u.country, sum(o.total) AS revenue, count(*) AS orders, sum(un.units) AS units
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN units un ON un.order_id = o.id
WHERE o.status = 'paid'
GROUP BY u.country;
```

**Lesson:** joining one-to-many multiplies the "one" side. Aggregate the "many" side first.

## A2. Users with zero orders disappeared (and the zeros show as 1)

**Task:** every user with their number of paid orders, including 0.

```sql
SELECT u.id, u.name, count(*) AS paid_orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.status = 'paid'
GROUP BY u.id, u.name;
```

**Symptom:** users 951 and above (who never ordered) are missing. Fix that alone and they show `1` instead of `0`.

**Debug:**

```sql
SELECT count(*) FROM users;                                  -- 1003
SELECT count(DISTINCT id) FROM (<broken query>) t;           -- fewer
```

**Two bugs:**

1. `WHERE o.status = 'paid'` runs after the join. Unmatched users have `o.status = NULL`, which fails the filter, so the `LEFT JOIN` behaves like an inner join.
2. `count(*)` counts the row itself, even when the right side is all `NULL`.

**Fix:**

```sql
SELECT u.id, u.name, count(o.id) AS paid_orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'paid'   -- filter in ON
GROUP BY u.id, u.name
ORDER BY paid_orders, u.id;
```

**Lesson:** filters on the optional table go in `ON`. Count a column from that table (`count(o.id)`), not `count(*)`.

## A3. "Users who never ordered" returns nothing (NOT IN with NULL)

**Task:** list users who have never placed an order.

```sql
SELECT id, name
FROM users
WHERE id NOT IN (SELECT user_id FROM orders);
```

**Symptom:** 0 rows, but users 951+ clearly have no orders.

**Debug:**

```sql
SELECT count(*) FROM orders WHERE user_id IS NULL;     -- guest orders exist
```

`id NOT IN (1, 2, NULL)` evaluates to unknown for every id, so no row passes.

**Fix (any of these):**

```sql
-- best: NOT EXISTS is NULL-safe
SELECT u.id, u.name
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- anti-join
SELECT u.id, u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;

-- or remove the NULLs from the subquery
WHERE id NOT IN (SELECT user_id FROM orders WHERE user_id IS NOT NULL)
```

**Lesson:** avoid `NOT IN (subquery)` when the column can be `NULL`. Use `NOT EXISTS`.

## A4. March is missing its last day (BETWEEN with timestamps)

**Task:** count orders placed in March 2026.

```sql
SELECT count(*)
FROM orders
WHERE created_at BETWEEN '2026-03-01' AND '2026-03-31';
```

**Symptom:** the number is lower than expected.

**Debug:**

```sql
SELECT count(*) FROM orders
WHERE created_at >= '2026-03-31' AND created_at < '2026-04-01';   -- a whole day
```

`'2026-03-31'` means `2026-03-31 00:00:00`, so `BETWEEN` includes only orders at exactly midnight on the 31st. The rest of that day is cut off.

**Fix:** use a half-open range.

```sql
SELECT count(*)
FROM orders
WHERE created_at >= '2026-03-01'
  AND created_at <  '2026-04-01';
```

**Lesson:** for dates and timestamps, use `>= start AND < next_start`, never `BETWEEN`.

## A5. Refund rate is always 0 (integer division)

**Task:** refund percentage of all orders.

```sql
SELECT count(*) FILTER (WHERE status = 'refunded') / count(*) AS refund_rate
FROM orders;
```

**Symptom:** `0`.

**Debug:**

```sql
SELECT pg_typeof(count(*));                 -- bigint
SELECT 1 / 5, 1 / 5.0;                      -- 0 and 0.2000
```

`bigint / bigint` truncates to a whole number.

**Fix:**

```sql
SELECT round(100.0 * count(*) FILTER (WHERE status = 'refunded') / count(*), 1) AS refund_pct
FROM orders;
```

Multiplying by `100.0` first makes the math numeric.

## A6. Three errors that explain themselves

**1. Selecting a column that isn't grouped**

```sql
SELECT u.country, u.name, count(*) FROM users u GROUP BY u.country;
-- ERROR: column "u.name" must appear in the GROUP BY clause or be used in an aggregate function
```
Fix: group by it too, or remove it, or aggregate it (`min(u.name)`).

**2. Ambiguous column**

```sql
SELECT id, total FROM users u JOIN orders o ON o.user_id = u.id;
-- ERROR: column reference "id" is ambiguous
```
Fix: qualify it: `u.id` or `o.id`. Do this for every column in a join.

**3. Aggregate in WHERE**

```sql
SELECT user_id, count(*) FROM orders WHERE count(*) > 300 GROUP BY user_id;
-- ERROR: aggregate functions are not allowed in WHERE
```
Fix: use `HAVING`.

```sql
SELECT user_id, count(*) FROM orders GROUP BY user_id HAVING count(*) > 300;
```

## A7. Duplicate emails (find, clean, prevent)

**Task:** find users sharing an email, keep the oldest, and make it impossible to happen again.

**Find:**

```sql
SELECT lower(email) AS email, count(*), array_agg(id ORDER BY id) AS ids
FROM users
WHERE email IS NOT NULL
GROUP BY lower(email)
HAVING count(*) > 1;
```

**Clean up** (inside a transaction, so you can check first):

```sql
BEGIN;

DELETE FROM users
WHERE id IN (
    SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY lower(email) ORDER BY id) AS rn
        FROM users
        WHERE email IS NOT NULL
    ) t
    WHERE rn > 1
)
RETURNING id, email;

-- looks right?  COMMIT;   otherwise ROLLBACK;
```

If the duplicates have orders, the foreign key blocks the delete. In that case first `UPDATE orders SET user_id = <kept id>` for those users.

**Prevent:**

```sql
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
```

Multiple `NULL` emails are still allowed, since `NULL` never equals `NULL`.

---

# Part B: Writing queries

Try each one before reading the solution.

## B1. Top 3 customers per country by paid spend

```sql
WITH spend AS (
    SELECT u.id, u.name, u.country, sum(o.total) AS spent
    FROM users u
    JOIN orders o ON o.user_id = u.id
    WHERE o.status = 'paid'
    GROUP BY u.id
),
ranked AS (
    SELECT *, row_number() OVER (PARTITION BY country ORDER BY spent DESC, id) AS rn
    FROM spend
)
SELECT country, name, spent
FROM ranked
WHERE rn <= 3
ORDER BY country, rn;
```

Technique: window function in a CTE, then filter the rank in the outer query (window functions can't go in `WHERE`).

## B2. Monthly revenue with month-over-month change

```sql
WITH monthly AS (
    SELECT date_trunc('month', created_at) AS month, sum(total) AS revenue
    FROM orders
    WHERE status = 'paid'
    GROUP BY 1
)
SELECT to_char(month, 'YYYY-MM') AS month,
       revenue,
       round(100.0 * (revenue - lag(revenue) OVER (ORDER BY month))
             / NULLIF(lag(revenue) OVER (ORDER BY month), 0), 1) AS mom_pct
FROM monthly
ORDER BY month;
```

Technique: `lag()` looks at the previous row. `NULLIF` avoids dividing by zero. The first month is `NULL` because it has no previous month.

## B3. Latest order per user

```sql
SELECT DISTINCT ON (user_id) user_id, id, status, total, created_at
FROM orders
WHERE user_id IS NOT NULL
ORDER BY user_id, created_at DESC;
```

Technique: Postgres `DISTINCT ON` keeps the first row per user, and the `ORDER BY` decides which row is first. The portable version uses `row_number() ... WHERE rn = 1`.

## B4. Users whose refund rate is above the overall rate

```sql
SELECT user_id,
       count(*) AS orders,
       round(100 * avg((status = 'refunded')::int), 1) AS refund_pct
FROM orders
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING avg((status = 'refunded')::int) > (SELECT avg((status = 'refunded')::int) FROM orders)
ORDER BY refund_pct DESC
LIMIT 20;
```

Technique: casting a boolean to `int` turns `avg` into a rate. `HAVING` compares a group's aggregate with a scalar subquery.

## B5. Daily revenue for the last 14 days, including days with no orders, plus a running total

```sql
SELECT d::date AS day,
       coalesce(sum(o.total), 0) AS revenue,
       sum(coalesce(sum(o.total), 0)) OVER (ORDER BY d) AS running_total
FROM generate_series(current_date - 13, current_date, interval '1 day') d
LEFT JOIN orders o
       ON o.created_at >= d
      AND o.created_at <  d + interval '1 day'
      AND o.status = 'paid'
GROUP BY d
ORDER BY d;
```

Technique: `generate_series` creates the calendar, so empty days still appear. The `LEFT JOIN` condition stays in `ON` (see A2). A window function runs over the grouped result.

## B6. Which products are bought together most often?

```sql
SELECT a.product_id AS product_a,
       b.product_id AS product_b,
       count(*)     AS together
FROM order_items a
JOIN order_items b
  ON b.order_id = a.order_id
 AND b.product_id > a.product_id        -- each pair once, no self-pairs
GROUP BY 1, 2
ORDER BY together DESC
LIMIT 10;
```

Technique: self join. `>` avoids counting `(1,2)` and `(2,1)` separately.

---

# Part C: Slow queries

Always compare `EXPLAIN (ANALYZE, BUFFERS)` before and after.

## C1. Looking up one user's orders (missing index)

```sql
DROP INDEX IF EXISTS idx_orders_user_id;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 42;
```

**Look for:** `Seq Scan` (or `Parallel Seq Scan`) on `orders`, a huge `Rows Removed by Filter`, and a large `shared hit/read` count, all to return about 210 rows.

**Fix:**

```sql
CREATE INDEX idx_orders_user_id ON orders (user_id);
ANALYZE orders;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 42;       -- Index or Bitmap scan, far fewer buffers
```

**Next step, filter and sort together:**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 42 ORDER BY created_at DESC LIMIT 10;
-- uses the index but still has a Sort node

CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
-- rerun: no Sort node, stops after 10 rows

DROP INDEX idx_orders_user_id;                 -- now redundant, the composite covers it
```

**Lesson:** index the filter column first, then the sort column. The composite index serves both.

## C2. A function on the column hides the index

```sql
CREATE INDEX idx_orders_created_at ON orders (created_at);

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM orders WHERE created_at::date = current_date - 5;
```

**Look for:** `Seq Scan`. The index is on `created_at`, but the query searches on `created_at::date`, which is a different expression.

**Fix:** rewrite as a range on the raw column:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM orders
WHERE created_at >= current_date - 5
  AND created_at <  current_date - 4;
```

The same applies to `lower(email) = ...` (create `ON users (lower(email))`), `date_trunc(...)`, arithmetic like `total + 1 = 50`, and comparing mismatched types.

## C3. Correlated subqueries (hidden N+1)

Run this with `idx_orders_user_id` and `idx_orders_user_created` dropped, then run it again with an index back.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.id, u.name,
       (SELECT count(*)        FROM orders o WHERE o.user_id = u.id) AS orders,
       (SELECT max(created_at) FROM orders o WHERE o.user_id = u.id) AS last_order
FROM users u;
```

**Look for:** `SubPlan` nodes with `loops=1003`. Each loop scans the orders table, and `actual time` is per loop, so multiply by `loops`.

**Fix:** one pass with a join and a group:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT u.id, u.name, count(o.id) AS orders, max(o.created_at) AS last_order
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name;
```

**Lesson:** a subquery in `SELECT` runs once per row. Prefer a join with `GROUP BY`, or a CTE that aggregates once.

## C4. Deep pagination with OFFSET

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 150000;
```

**Look for:** it reads and throws away 150,000 rows to return 20, and the cost grows with the page number.

**Fix:** keyset pagination, remembering the last id from the previous page:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE id > 150000 ORDER BY id LIMIT 20;
```

It uses the primary-key index and costs the same on any page. The tradeoff is that you can't jump to "page 7,500", only next/previous.

## C5. Bad row estimates (stale statistics)

```sql
DROP TABLE IF EXISTS events;
CREATE TABLE events AS
SELECT g AS id, 'a'::text AS kind FROM generate_series(1, 100000) g;
ANALYZE events;                                    -- stats say: all rows are 'a'

UPDATE events SET kind = 'b' WHERE id <= 90000;    -- stats are now wrong

EXPLAIN ANALYZE SELECT * FROM events WHERE kind = 'b';
```

**Look for:** `rows=` in the estimate is tiny, while `actual rows=90000`. The planner thinks `'b'` is rare. This leads to bad join and scan choices in bigger queries.

(If autovacuum already ran, the estimate will be correct. Rerun the steps quickly.)

**Fix:**

```sql
ANALYZE events;
EXPLAIN ANALYZE SELECT * FROM events WHERE kind = 'b';    -- estimate now close to 90000
```

**Lesson:** after bulk loads or large updates, run `ANALYZE`. A big gap between estimated and actual rows is the first clue.

---

# Part D: Safe fixes and concurrency

## D1. Bulk update without regret

**Task:** cancel all `pending` orders older than 30 days.

```sql
-- 1. look before you touch
SELECT count(*), min(created_at), max(created_at)
FROM orders
WHERE status = 'pending' AND created_at < now() - interval '30 days';

-- 2. do it in a transaction and inspect
BEGIN;

UPDATE orders
SET status = 'cancelled'
WHERE status = 'pending'
  AND created_at < now() - interval '30 days'
RETURNING id, user_id, created_at;          -- see what changed

SELECT status, count(*) FROM orders GROUP BY status;     -- sanity check

ROLLBACK;     -- or COMMIT; once the numbers match step 1
```

**Lesson:** `SELECT` first with the same `WHERE`, then `BEGIN`, `RETURNING`, check, then `COMMIT` or `ROLLBACK`. On a very large table, update in batches (for example 10,000 ids at a time) to keep locks short.

## D2. Lost update: two withdrawals, one deduction

Open **two** psql sessions (A and B). Account 1 has 100.

| Step | Session A | Session B |
|---|---|---|
| 1 | `BEGIN; SELECT balance FROM accounts WHERE id = 1;` (100) | |
| 2 | | `BEGIN; SELECT balance FROM accounts WHERE id = 1;` (100) |
| 3 | `UPDATE accounts SET balance = 100 - 50 WHERE id = 1; COMMIT;` | |
| 4 | | `UPDATE accounts SET balance = 100 - 50 WHERE id = 1; COMMIT;` |

Two withdrawals of 50 happened, but the balance is 50, not 0. The app read, calculated, and wrote back, so the second write overwrote the first.

**Fix 1: atomic update, no read-then-write:**

```sql
UPDATE accounts
SET balance = balance - 50
WHERE id = 1 AND balance >= 50
RETURNING balance;
-- 0 rows returned = insufficient funds
```

**Fix 2: lock the row while you work with it:**

```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;   -- B waits here until A commits
-- decide in the app...
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
COMMIT;
```

The `CHECK (balance >= 0)` constraint is a last line of defense, but it fails the second request with an error instead of handling it gracefully.

Reset with: `UPDATE accounts SET balance = 100;`

## D3. Deadlock

Two sessions, account rows 1 and 2:

| Step | Session A | Session B |
|---|---|---|
| 1 | `BEGIN; UPDATE accounts SET balance = balance - 10 WHERE id = 1;` | |
| 2 | | `BEGIN; UPDATE accounts SET balance = balance - 10 WHERE id = 2;` |
| 3 | `UPDATE accounts SET balance = balance + 10 WHERE id = 2;` (waits) | |
| 4 | | `UPDATE accounts SET balance = balance + 10 WHERE id = 1;` (deadlock) |

After about a second Postgres aborts one with `ERROR: deadlock detected`. Each transaction holds the row the other one wants.

**Fix:** always touch rows in the same order (for example lowest id first), and keep transactions short. Then one transaction simply waits for the other.

```sql
-- transfer: lock both rows in id order up front
BEGIN;
SELECT id FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE;
UPDATE accounts SET balance = balance - 10 WHERE id = 1;
UPDATE accounts SET balance = balance + 10 WHERE id = 2;
COMMIT;
```

---

## Symptom to cause

| Symptom | First suspect |
|---|---|
| Totals too big | One-to-many join fan-out (A1) |
| Rows missing after a `LEFT JOIN` | Filter on the right table in `WHERE` (A2) |
| `NOT IN` returns nothing | `NULL` in the subquery (A3) |
| Last day of a range missing | `BETWEEN` with timestamps (A4) |
| Ratio is 0 | Integer division (A5) |
| Slow, `Seq Scan` on a big table | Missing index (C1) or function on the column (C2) |
| `SubPlan` with a large `loops` | Correlated subquery (C3) |
| Slow on later pages | `OFFSET` pagination (C4) |
| Estimated rows far from actual | Stale stats, run `ANALYZE` (C5) |
| Wrong balance or count under load | Read-modify-write race (D2) |
| `deadlock detected` | Inconsistent lock order (D3) |

🧠 **Hook:** *Compare against a simpler query you trust, change one thing at a time, and for performance let EXPLAIN (ANALYZE, BUFFERS) be the judge.*
