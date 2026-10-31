-- =============================================================
-- SQL DEBUGGING CHEAT SHEET (PostgreSQL)
-- Tables used in examples: users(id, name, active, last_login),
--                          orders(id, user_id, total, created_at)
-- =============================================================


-- =============================================================
-- 1. WRONG RESULTS
-- =============================================================

-- 1.1 Build the query up in steps, checking output after each one
SELECT * FROM users LIMIT 10;                        -- is the base data what I think?
SELECT * FROM users u JOIN orders o ON o.user_id = u.id LIMIT 10;   -- add join, check row count
-- then add WHERE, then GROUP BY, then the rest

-- 1.2 Use CTEs to isolate steps (run each one on its own)
WITH recent AS (
    SELECT * FROM orders WHERE created_at > now() - interval '7 days'
)
SELECT * FROM recent;                                -- debug this step, then add the next

-- 1.3 Compare row counts: duplicates after a join?
SELECT count(*) AS total_rows, count(DISTINCT id) AS distinct_ids
FROM orders;

-- 1.4 Find duplicates
SELECT user_id, count(*)
FROM orders
GROUP BY user_id
HAVING count(*) > 1;

-- 1.5 Find orphans / unmatched rows (anti-join)
SELECT o.*
FROM orders o
LEFT JOIN users u ON u.id = o.user_id
WHERE u.id IS NULL;

-- 1.6 NULL handling (most "missing rows" bugs)
--   NULL = NULL is not true -> use IS NULL / IS NOT NULL
SELECT * FROM orders WHERE user_id IS NULL;
--   NULL-safe equality
SELECT * FROM orders a JOIN orders b ON a.user_id IS NOT DISTINCT FROM b.user_id;
--   NOT IN returns nothing if the subquery contains a NULL -> use NOT EXISTS
SELECT u.* FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
--   See what a value would be without NULL
SELECT COALESCE(total, 0) FROM orders;
--   count(col) skips NULLs, count(*) does not
SELECT count(*), count(user_id) FROM orders;

-- 1.7 Check types and stray whitespace
SELECT pg_typeof(name), name, length(name), name = trim(name) AS is_trimmed
FROM users;

-- 1.8 WHERE on the right table of a LEFT JOIN turns it into an INNER JOIN
--   BAD: drops users without big orders
SELECT u.name, o.total
FROM users u LEFT JOIN orders o ON o.user_id = u.id
WHERE o.total > 30;
--   GOOD: condition in ON keeps all users
SELECT u.name, o.total
FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.total > 30;


-- =============================================================
-- 2. SLOW QUERIES
-- =============================================================

-- 2.1 EXPLAIN: plan only, does not run the query
EXPLAIN
SELECT * FROM orders WHERE user_id = 1;

-- 2.2 EXPLAIN ANALYZE: runs it, shows real times and row counts
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 1;

-- 2.3 Add I/O info
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 1;

-- 2.4 EXPLAIN ANALYZE really executes writes -> wrap in a transaction and roll back
BEGIN;
EXPLAIN ANALYZE UPDATE orders SET total = total + 1 WHERE user_id = 1;
ROLLBACK;

-- What to look for in the plan:
--   Seq Scan on a big table              -> probably a missing index
--   Estimated rows far from actual rows  -> stale stats, run ANALYZE
--   Rows Removed by Filter is huge       -> filter not using an index
--   Nested Loop with large outer side    -> wrong join strategy / missing index
--   Sort or Hash spilling to disk        -> work_mem too low / too many rows

-- 2.5 Refresh planner statistics
ANALYZE orders;

-- 2.6 Index the join / filter columns (Postgres does not index FKs automatically)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);

-- 2.7 Slowest queries overall (needs the pg_stat_statements extension)
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- 2.8 What is running right now / what is blocked
SELECT pid, state, wait_event_type, now() - query_start AS running_for, query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY running_for DESC;

-- psql only (not SQL):  \timing   -> runtime per statement
-- Server config:        auto_explain -> logs plans of slow queries
-- Visualisers:          explain.depesz.com, explain.dalibo.com


-- =============================================================
-- 3. SAFE HABITS
-- =============================================================

-- 3.1 Test writes as a SELECT first (same WHERE), check the rows
SELECT * FROM users WHERE last_login < '2025-01-01';
-- ...then turn it into the UPDATE/DELETE

-- 3.2 Try changes inside a transaction
BEGIN;
UPDATE users SET active = false WHERE last_login < '2025-01-01';
SELECT count(*) FROM users WHERE active = false;     -- sanity check
ROLLBACK;                                            -- or COMMIT; when sure

-- 3.3 RETURNING shows what a write actually changed
UPDATE users
SET active = false
WHERE last_login < '2025-01-01'
RETURNING id, name;

-- 3.4 LIMIT while exploring
SELECT * FROM orders LIMIT 100;

-- 3.5 Read the error position: "LINE 3: ... ^" points at the character,
--     the real mistake is often just before it (missing comma, trailing
--     comma before FROM).


-- =============================================================
-- 4. COMMON ERRORS
-- =============================================================
--   column "x" must appear in the GROUP BY clause
--       -> non-aggregated column in SELECT is missing from GROUP BY
--   column reference "id" is ambiguous
--       -> same column in both tables, qualify it: u.id / o.id
--   operator does not exist: integer = text
--       -> type mismatch, cast: col::int or CAST(col AS int)
--   fewer rows than expected
--       -> INNER JOIN dropping rows, WHERE on nullable column, NULL comparison
--   more rows than expected
--       -> one-to-many join duplicating rows
--   division by zero
--       -> NULLIF(denominator, 0)
SELECT total / NULLIF(0, 0) FROM orders;             -- returns NULL instead of erroring


-- =============================================================
-- 5. FROM APPLICATION CODE
-- =============================================================
-- Log the actual SQL + parameters the app sends (SQLAlchemy: create_engine(..., echo=True)),
-- then paste that exact query into psql and run it there. Many bugs are the app
-- building a different query than you thought.
