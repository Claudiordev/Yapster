# SQL GROUP BY

`GROUP BY` puts rows into groups that share the same value, then collapses each group into **one result row**. You normally use it with aggregate functions like `count`, `sum`, `avg`, `min`, and `max`, which calculate one number per group.

## Sample data

```sql
SELECT * FROM orders;
```
```
id | user_id | status   | total
1  | 1       | paid     | 50
2  | 1       | paid     | 20
3  | 2       | refunded | 75
4  | 2       | paid     | 30
5  | 3       | paid     | 90
6  | 3       | pending  | 10
```

## Without GROUP BY: one answer for the whole table

```sql
SELECT count(*) AS orders, sum(total) AS revenue
FROM orders;
```
```
orders | revenue
6      | 275
```

## With GROUP BY: one answer per group

```sql
SELECT user_id, count(*) AS orders, sum(total) AS spent
FROM orders
GROUP BY user_id
ORDER BY user_id;
```
```
user_id | orders | spent
1       | 2      | 70
2       | 2      | 105
3       | 2      | 100
```

What happened internally:

```
user_id 1:  rows (50, 20)        -> count 2, sum 70
user_id 2:  rows (75, 30)        -> count 2, sum 105
user_id 3:  rows (90, 10)        -> count 2, sum 100
```

Six rows went in and three came out. The per-order details (id, status) are gone, because each group became one row. The three user sums (70 + 105 + 100) add up to the 275 from the first query.

## Group by a different column

```sql
SELECT status, count(*) AS orders, sum(total) AS revenue, avg(total) AS avg_order
FROM orders
GROUP BY status
ORDER BY status;
```
```
status   | orders | revenue | avg_order
paid     | 4      | 190     | 47.5
pending  | 1      | 10      | 10
refunded | 1      | 75      | 75
```

## Group by several columns

Each unique combination becomes a group:

```sql
SELECT user_id, status, count(*) AS orders, sum(total) AS spent
FROM orders
GROUP BY user_id, status
ORDER BY user_id, status;
```
```
user_id | status   | orders | spent
1       | paid     | 2      | 70
2       | paid     | 1      | 30
2       | refunded | 1      | 75
3       | paid     | 1      | 90
3       | pending  | 1      | 10
```

User 2 now has two rows, because `(2, paid)` and `(2, refunded)` are different groups.

## WHERE filters rows before grouping

```sql
SELECT user_id, sum(total) AS spent
FROM orders
WHERE status = 'paid'
GROUP BY user_id
ORDER BY user_id;
```
```
user_id | spent
1       | 70
2       | 30
3       | 90
```

Only paid orders are grouped. User 2's refunded 75 is not counted.

## HAVING filters groups after grouping

```sql
SELECT user_id, sum(total) AS spent
FROM orders
GROUP BY user_id
HAVING sum(total) > 80
ORDER BY user_id;
```
```
user_id | spent
2       | 105
3       | 100
```

User 1 (70) is dropped because their group's sum fails the condition.

## The rule behind the common error

Every column in `SELECT` must be either in `GROUP BY` or inside an aggregate, because each group becomes a single row and a row can only hold one value per column.

```sql
SELECT user_id, status, sum(total)
FROM orders
GROUP BY user_id;
-- ERROR: column "orders.status" must appear in the GROUP BY clause
--        or be used in an aggregate function
```

User 1 has only `paid`, but user 2 has both `paid` and `refunded`. Postgres can't pick one `status` for that single row. Fix it by adding `status` to `GROUP BY`, removing it, or aggregating it (`min(status)`).

## Notes

- Row order after `GROUP BY` is not guaranteed, so add `ORDER BY`.
- `NULL` values form their own group.
- `count(*)` counts rows in the group, and `count(col)` skips `NULL`s.
- Execution order is `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `ORDER BY`.
- To keep every row and still show a per-group number, use a window function with `PARTITION BY` instead.

🧠 **Hook:** *GROUP BY sorts rows into buckets and keeps one row per bucket. WHERE filters before the buckets, HAVING filters the buckets.*
