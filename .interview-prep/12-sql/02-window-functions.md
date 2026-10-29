# 02 — Window Functions and Analytical SQL

## Grouping versus windows

`GROUP BY` reduces the input to one row per group. A window function calculates over related rows while retaining each input row. This makes windows useful for ranking, running totals, moving averages, gaps, and comparisons with a prior row.

```sql
SELECT customer_id, order_id, created_at, amount,
       ROW_NUMBER() OVER (
           PARTITION BY customer_id
           ORDER BY created_at DESC, order_id DESC
       ) AS rn
FROM orders;
```

The second sort key makes ordering deterministic when timestamps tie.

## Ranking functions

- `ROW_NUMBER()` assigns a unique sequence, even among ties.
- `RANK()` gives peers the same rank and leaves gaps.
- `DENSE_RANK()` gives peers the same rank without gaps.

To return one latest row per customer, rank then filter in an outer query or a CTE:

```sql
WITH ranked AS (
    SELECT o.*,
           ROW_NUMBER() OVER (
               PARTITION BY customer_id
               ORDER BY created_at DESC, order_id DESC
           ) AS rn
    FROM orders o
)
SELECT * FROM ranked WHERE rn = 1;
```

Some engines support `QUALIFY` to filter window results directly; it is not universal SQL syntax.

## Window frames: the running-total trap

```sql
SUM(amount) OVER (
    PARTITION BY account_id
    ORDER BY posted_at, transaction_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
) AS balance_so_far
```

An ordered window's default frame can include all peer rows with the same ordering value. Explicit `ROWS` gives row-by-row behavior. `RANGE` groups peers based on ordering values. Define the frame when duplicates or ties affect the result.

## Navigation and cohort patterns

`LAG` and `LEAD` compare neighboring rows in a partition; `FIRST_VALUE` and `LAST_VALUE` select frame values. Note that `LAST_VALUE` often needs an explicit frame extending to `UNBOUNDED FOLLOWING`; otherwise it may return the current row's value.

```sql
LAG(status) OVER (
    PARTITION BY account_id
    ORDER BY changed_at, change_id
)
```

Use these to find state transitions, gaps, and period-over-period changes. Decide how NULLs should behave, and include a tie-breaker for stable results.

## Avoid double counting

If a query joins facts at different grains, aggregate each fact set to the target grain before joining. For example, aggregate order totals to customer-month and refunds to customer-month separately, then join those monthly results. Joining raw orders to raw refund rows can create a many-to-many multiplication.

## Pagination

`LIMIT` without a total order is nondeterministic. For stable pagination, order by a unique key as the final tie-breaker. Keyset pagination avoids scanning/skipping a growing offset:

```sql
SELECT order_id, created_at
FROM orders
WHERE (created_at, order_id) < (:last_created_at, :last_order_id)
ORDER BY created_at DESC, order_id DESC
FETCH FIRST 50 ROWS ONLY;
```

Tuple comparison syntax varies by database. The general requirement is a stable cursor over the same ordering columns, with matching index support where appropriate.

