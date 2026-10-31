# SQL Joins

A join combines rows from two tables based on a related column, usually a foreign key matching a primary key.

## Example tables

```
users                    orders
id | name                id | user_id | total
1  | Ana                 1  | 1       | 50
2  | Ben                 2  | 1       | 20
3  | Cy                  3  | 2       | 75
                         4  | NULL    | 10     -- order with no user
```

Ana has 2 orders, Ben has 1, Cy has none, and one order has no user.

## INNER JOIN

Only rows with a match on both sides.

```sql
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON o.user_id = u.id;
```
```
Ana | 50
Ana | 20
Ben | 75
```

Cy (no orders) and the orphan order are dropped. `JOIN` alone means `INNER JOIN`.

## LEFT JOIN (LEFT OUTER)

All rows from the left table, plus matches from the right. Where there is no match, the right columns are `NULL`.

```sql
SELECT u.name, o.total
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;
```
```
Ana | 50
Ana | 20
Ben | 75
Cy  | NULL
```

Finding rows with **no** match:

```sql
SELECT u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;      -- users with no orders: Cy
```

## RIGHT JOIN

The mirror of LEFT: all rows from the right table.

```sql
SELECT u.name, o.total
FROM users u
RIGHT JOIN orders o ON o.user_id = u.id;
```
```
Ana  | 50
Ana  | 20
Ben  | 75
NULL | 10
```

## LEFT vs RIGHT

The only difference is which table is guaranteed to keep all its rows.

- **LEFT JOIN** keeps every row from the table **before** the `JOIN` keyword. Unmatched right-side columns become `NULL`.
- **RIGHT JOIN** keeps every row from the table **after** it. Unmatched left-side columns become `NULL`.

They are interchangeable. Swapping the table order turns one into the other, so these return the same rows:

```sql
FROM users u  RIGHT JOIN orders o ON ...
FROM orders o LEFT  JOIN users u  ON ...
```

In practice almost everyone writes `LEFT JOIN` only. The "main" table comes first and optional ones are added after it, which reads top to bottom. To pick one, look at the table that must keep all its rows and use the side it's on.

## FULL OUTER JOIN

All rows from both sides, with `NULL` where there is no match.

```sql
SELECT u.name, o.total
FROM users u
FULL OUTER JOIN orders o ON o.user_id = u.id;
```

Returns Cy with `NULL` total and the orphan order with `NULL` name. MySQL does not support it; emulate with `LEFT JOIN ... UNION ... RIGHT JOIN`.

## CROSS JOIN

Every row paired with every row (Cartesian product). No `ON` clause.

```sql
SELECT u.name, s.size
FROM users u
CROSS JOIN sizes s;      -- 3 users x N sizes
```

Useful for generating combinations, dangerous on big tables.

## SELF JOIN

A table joined to itself, using aliases. Typical for hierarchies.

```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

## Quick reference

| Join | Keeps |
|---|---|
| `INNER` | Matches only |
| `LEFT` | All left + matches |
| `RIGHT` | All right + matches |
| `FULL` | Everything from both |
| `CROSS` | All combinations |

## Gotchas

- **`ON` vs `WHERE` with outer joins:** a filter on the right table in `WHERE` turns a LEFT JOIN into an INNER JOIN, because the `NULL` rows get filtered out. Put the condition in `ON` to keep the left rows.

  ```sql
  LEFT JOIN orders o ON o.user_id = u.id AND o.total > 30
  ```
- **Duplicates:** joining one-to-many multiplies rows (one row per order). Use `GROUP BY` for one row per user.
- **`NULL` never equals `NULL`**, so `NULL` keys don't join to each other.
- **`USING (col)`** is shorthand when both tables share the column name: `JOIN orders USING (user_id)`.
- **Index the join columns** (foreign keys). Postgres doesn't create FK indexes automatically.
- Use `EXPLAIN ANALYZE` to see the strategy: nested loop, hash join, or merge join.

🧠 **Hook:** *LEFT or RIGHT just names the table that keeps all its rows. Write LEFT, put that table first.*
