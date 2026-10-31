# SQL Queries: HAVING and Friends

Core query clauses with examples (PostgreSQL syntax).

## Example tables

```
users                              orders
id | name | country | created_at   id | user_id | total | status    | created_at
1  | Ana  | SE      | 2025-01-10   1  | 1       | 50    | paid      | 2025-02-01
2  | Ben  | SE      | 2025-03-05   2  | 1       | 20    | paid      | 2025-02-15
3  | Cy   | NO      | 2025-04-20   3  | 2       | 75    | refunded  | 2025-03-10
4  | Dee  | NO      | 2025-05-02   4  | 3       | 30    | paid      | 2025-04-25
                                   5  | 3       | 90    | paid      | 2025-05-01
```

## 1. Order of a query

Written order:

```sql
SELECT   ...
FROM     ...
JOIN     ...
WHERE    ...
GROUP BY ...
HAVING   ...
ORDER BY ...
LIMIT    ...
```

Logical execution order (why aliases don't work in `WHERE`):

```
FROM / JOIN -> WHERE -> GROUP BY -> HAVING -> SELECT -> DISTINCT -> ORDER BY -> LIMIT
```

## 2. SELECT, WHERE, ORDER BY, LIMIT

```sql
SELECT name, country
FROM users
WHERE country = 'SE'
ORDER BY name DESC
LIMIT 10 OFFSET 0;
```

Common `WHERE` operators:

```sql
WHERE total > 30 AND status = 'paid'
WHERE country IN ('SE', 'NO')
WHERE total BETWEEN 20 AND 80           -- inclusive on both ends
WHERE name LIKE 'A%'                    -- starts with A
WHERE name ILIKE 'a%'                   -- case-insensitive (Postgres)
WHERE user_id IS NULL                   -- never use = NULL
WHERE NOT (status = 'refunded')
```

## 3. DISTINCT

```sql
SELECT DISTINCT country FROM users;                   -- unique countries
SELECT count(DISTINCT user_id) FROM orders;           -- how many users ordered
SELECT DISTINCT ON (user_id) *                        -- Postgres: first row per user
FROM orders
ORDER BY user_id, created_at DESC;                    -- = latest order per user
```

## 4. Aggregate functions

```sql
SELECT
    count(*)        AS orders,
    count(user_id)  AS with_user,       -- skips NULLs
    sum(total)      AS revenue,
    avg(total)      AS avg_order,
    min(total)      AS smallest,
    max(total)      AS largest
FROM orders
WHERE status = 'paid';
```

## 5. GROUP BY

One row per group.

```sql
SELECT user_id, count(*) AS orders, sum(total) AS spent
FROM orders
GROUP BY user_id;
```
```
user_id | orders | spent
1       | 2      | 70
2       | 1      | 75
3       | 2      | 120
```

Group by several columns, or by an expression:

```sql
SELECT country, status, count(*)
FROM users u JOIN orders o ON o.user_id = u.id
GROUP BY country, status;

SELECT date_trunc('month', created_at) AS month, sum(total)
FROM orders
GROUP BY 1                              -- 1 = first SELECT column
ORDER BY 1;
```

Every non-aggregated column in `SELECT` must appear in `GROUP BY`.

## 6. HAVING

`HAVING` filters **groups** after aggregation. `WHERE` filters **rows** before it.

```sql
-- users with more than 1 order
SELECT user_id, count(*) AS orders
FROM orders
GROUP BY user_id
HAVING count(*) > 1;
```
```
user_id | orders
1       | 2
3       | 2
```

```sql
-- users who spent more than 100 in total
SELECT user_id, sum(total) AS spent
FROM orders
GROUP BY user_id
HAVING sum(total) > 100;               -- user 3
```

Use both together. `WHERE` first narrows rows, `HAVING` then narrows groups:

```sql
-- among PAID orders only, users whose total is over 60
SELECT user_id, sum(total) AS spent
FROM orders
WHERE status = 'paid'                  -- row filter (before grouping)
GROUP BY user_id
HAVING sum(total) > 60                 -- group filter (after grouping)
ORDER BY spent DESC;
```

| | `WHERE` | `HAVING` |
|---|---|---|
| Filters | Rows | Groups |
| Runs | Before `GROUP BY` | After `GROUP BY` |
| Can use aggregates | No | Yes |
| Can use column aliases | No | No (in Postgres) |

Rule of thumb: if the condition doesn't need an aggregate, put it in `WHERE`. It's faster because fewer rows get grouped.

### Common HAVING patterns

```sql
-- duplicates: emails used more than once
SELECT email, count(*)
FROM users
GROUP BY email
HAVING count(*) > 1;

-- groups with at least N members
HAVING count(*) >= 5

-- compare an aggregate to another aggregate
HAVING avg(total) > (SELECT avg(total) FROM orders)

-- multiple conditions
HAVING count(*) > 1 AND sum(total) > 50

-- filtered aggregate inside HAVING
HAVING count(*) FILTER (WHERE status = 'refunded') > 0
```

## 7. FILTER and conditional aggregates

Count or sum only some rows, inside one query.

```sql
SELECT
    count(*)                                  AS all_orders,
    count(*) FILTER (WHERE status = 'paid')   AS paid,
    sum(total) FILTER (WHERE status = 'paid') AS paid_revenue
FROM orders;

-- portable version with CASE
SELECT sum(CASE WHEN status = 'paid' THEN total ELSE 0 END) AS paid_revenue
FROM orders;
```

## 8. CASE

If/else inside a query.

```sql
SELECT
    id, total,
    CASE
        WHEN total >= 80 THEN 'large'
        WHEN total >= 40 THEN 'medium'
        ELSE 'small'
    END AS size
FROM orders;
```

## 9. JOIN + GROUP BY

```sql
-- every user with their order count (including users with 0)
SELECT u.name, count(o.id) AS orders, COALESCE(sum(o.total), 0) AS spent
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name
ORDER BY spent DESC;
```

Use `count(o.id)`, not `count(*)`, so users with no orders show 0 instead of 1.

```sql
-- users with no orders
SELECT u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name
HAVING count(o.id) = 0;
```

## 10. Subqueries

```sql
-- in WHERE
SELECT * FROM orders
WHERE total > (SELECT avg(total) FROM orders);

-- IN
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders WHERE status = 'refunded');

-- EXISTS (usually the safest and fastest for "has any")
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- NOT EXISTS (safe with NULLs, unlike NOT IN)
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- in FROM (derived table)
SELECT country, avg(spent)
FROM (
    SELECT u.country, sum(o.total) AS spent
    FROM users u JOIN orders o ON o.user_id = u.id
    GROUP BY u.id, u.country
) per_user
GROUP BY country;
```

## 11. CTEs (WITH)

Name a step so the query reads top to bottom.

```sql
WITH per_user AS (
    SELECT user_id, sum(total) AS spent
    FROM orders
    WHERE status = 'paid'
    GROUP BY user_id
)
SELECT u.name, p.spent
FROM per_user p
JOIN users u ON u.id = p.user_id
WHERE p.spent > 60
ORDER BY p.spent DESC;
```

## 12. Window functions

Compute across rows **without collapsing** them (unlike `GROUP BY`).

```sql
SELECT
    user_id, id, total,
    sum(total) OVER (PARTITION BY user_id)                       AS user_total,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at) AS nth_order,
    rank() OVER (ORDER BY total DESC)                            AS overall_rank,
    lag(total) OVER (PARTITION BY user_id ORDER BY created_at)   AS prev_total,
    sum(total) OVER (ORDER BY created_at)                        AS running_total
FROM orders;
```

Top N per group:

```sql
SELECT *
FROM (
    SELECT o.*, row_number() OVER (PARTITION BY user_id ORDER BY total DESC) AS rn
    FROM orders o
) t
WHERE rn = 1;                           -- biggest order per user
```

Window functions can't go in `WHERE`, so filter in an outer query as above.

## 13. Set operations

```sql
SELECT id FROM users WHERE country = 'SE'
UNION                                   -- combine, remove duplicates (UNION ALL keeps them)
SELECT id FROM users WHERE created_at > '2025-04-01';

INTERSECT                               -- rows in both
EXCEPT                                  -- rows in the first but not the second
```

## 14. NULL helpers

```sql
COALESCE(a, b, 'default')               -- first non-NULL
NULLIF(x, 0)                            -- NULL if x = 0 (avoids division by zero)
x IS DISTINCT FROM y                    -- NULL-safe inequality
```

## 15. Dates and strings

```sql
now(), current_date
created_at >= now() - interval '7 days'
date_trunc('month', created_at)
extract(year FROM created_at)
to_char(created_at, 'YYYY-MM-DD')

lower(name), upper(name), length(name), trim(name)
name || ' from ' || country             -- concatenate
substring(name FROM 1 FOR 2)
```

## 16. INSERT, UPDATE, DELETE

```sql
INSERT INTO users (name, country) VALUES ('Eli', 'DK') RETURNING id;

INSERT INTO users (name, country)
VALUES ('Ana', 'SE')
ON CONFLICT (name) DO UPDATE SET country = EXCLUDED.country;   -- upsert

UPDATE orders SET status = 'refunded' WHERE id = 3 RETURNING *;

DELETE FROM orders WHERE status = 'refunded' AND created_at < '2025-01-01';
```

Test the `WHERE` as a `SELECT` first, and wrap risky changes in `BEGIN; ... ROLLBACK;`.

## 17. Quick reference

| Need | Use |
|---|---|
| Filter rows | `WHERE` |
| Filter groups by an aggregate | `HAVING` |
| One row per group | `GROUP BY` |
| Unique values | `DISTINCT` |
| Sort | `ORDER BY ... ASC/DESC` |
| Top N | `ORDER BY ... LIMIT n` |
| Count only some rows | `FILTER (WHERE ...)` or `CASE` |
| If/else | `CASE WHEN ... THEN ... END` |
| Name a step | `WITH ... AS (...)` |
| Aggregate without collapsing rows | Window function `OVER (...)` |
| "Has any / has none" | `EXISTS` / `NOT EXISTS` |

🧠 **Hook:** *WHERE filters rows before grouping, HAVING filters groups after. If there's no aggregate in the condition, it belongs in WHERE.*
