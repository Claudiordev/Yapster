# 01 — SQL Semantics, Joins, and Aggregation

## Begin with row grain

Before writing a query, state what one output row represents. Then identify the key that uniquely identifies that grain and check whether each join preserves it. This prevents a common reporting bug: summing an order amount after joining to multiple order lines or tags.

If the question is only whether a related row exists, use a semi-join shape rather than adding related rows to the result:

```sql
SELECT c.customer_id
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.customer_id
      AND o.status = 'paid'
);
```

For an anti-join, prefer `NOT EXISTS` when the subquery could contain NULLs:

```sql
SELECT c.customer_id
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.customer_id
);
```

`NOT IN` has NULL-sensitive three-valued semantics. If the subquery returns even one NULL, comparisons may become `UNKNOWN` and filter out rows unexpectedly.

## Logical query processing

The useful mental model is:

1. Build rows from `FROM` and joins.
2. Filter individual rows with `WHERE`.
3. Form groups and calculate aggregates.
4. Filter groups with `HAVING`.
5. Calculate select expressions, including window functions.
6. Apply `DISTINCT`, ordering, and row limiting.

It is a semantic model, not a promise that the database physically runs operations in this order. The optimizer may reorder operations while preserving the result.

## NULL is unknown, not a value

`NULL = NULL` is not true; it is unknown. Use `IS NULL` / `IS NOT NULL`. Comparisons and filters retain only true rows, so unknown conditions do not pass a `WHERE` clause.

- `COUNT(*)` counts rows, including rows with NULL columns.
- `COUNT(x)` counts non-NULL `x` values.
- `AVG(x)` ignores NULL values; replacing NULL with zero changes the meaning and denominator.
- `COALESCE` is useful for presentation/defaulting, but should not erase the distinction between missing and zero too early.
- `NULLIF(a, b)` can turn a special value into NULL, for example to avoid division by zero.

## Outer joins and predicate placement

```sql
-- Keep every customer; only attach paid orders when present.
SELECT c.customer_id, o.order_id
FROM customers c
LEFT JOIN orders o
  ON o.customer_id = c.customer_id
 AND o.status = 'paid';
```

Moving `o.status = 'paid'` to `WHERE` removes rows where `o` is NULL, making the query behave like an inner join for that predicate. Ask whether the condition filters matched rows or the final output rows.

## Aggregation patterns

Conditional aggregation can compute several metrics per group:

```sql
SELECT customer_id,
       COUNT(*) AS total_orders,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
       SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid_amount
FROM orders
GROUP BY customer_id;
```

The `ELSE 0` choice is deliberate here: an empty matching set yields zero. If NULL means unknown or incomplete, preserve that meaning instead. Some engines support aggregate `FILTER (WHERE ...)`; use dialect-specific syntax only when the target is known.

## Set operations

- `UNION ALL` concatenates results and preserves duplicates.
- `UNION` removes duplicates, requiring extra work and sometimes masking upstream duplication.
- `INTERSECT` and `EXCEPT` compare distinct result rows in many engines; check exact dialect semantics when duplicates matter.
- Branches should have compatible column counts and types. Add explicit casts when type inference is ambiguous.

## Safe time filters

Prefer half-open intervals:

```sql
WHERE created_at >= :start_at
  AND created_at <  :end_at
```

Adjacent windows then meet without overlap, and a timestamp's precision does not require guessing the final instant of a day. Use UTC or a well-defined timezone convention at storage and query boundaries.

