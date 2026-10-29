# 04 — PostgreSQL Query Scenarios and Function Debugging

These examples use PostgreSQL syntax and a small sales schema. The joins, grouping, and window-function patterns apply broadly, but routine syntax and diagnostics vary by database.

## 1. Build the sample schema

```sql
CREATE TABLE customers (
    customer_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email       text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    order_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint NOT NULL REFERENCES customers(customer_id),
    status      text NOT NULL CHECK (
        status IN ('pending', 'completed', 'cancelled')
    ),
    order_date  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    item_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id    bigint NOT NULL REFERENCES orders(order_id),
    product     text NOT NULL,
    quantity    integer NOT NULL CHECK (quantity > 0),
    unit_price  numeric(12, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE payments (
    payment_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id    bigint NOT NULL REFERENCES orders(order_id),
    status      text NOT NULL CHECK (
        status IN ('pending', 'settled', 'failed', 'refunded')
    ),
    amount      numeric(12, 2) NOT NULL CHECK (amount >= 0),
    paid_at     timestamptz
);

CREATE INDEX idx_orders_customer_date
    ON orders (customer_id, order_date DESC);

CREATE INDEX idx_order_items_order
    ON order_items (order_id);

CREATE INDEX idx_payments_order
    ON payments (order_id);
```

The grain is important: one customer can have many orders; one order can have many items and many payment attempts. A join across both child tables can multiply rows.

## 2. LEFT JOIN: keep customers with no matching orders

Question: return every customer and their completed orders since a date, including customers with no completed orders.

```sql
SELECT
    c.customer_id,
    c.email,
    o.order_id,
    o.order_date,
    o.status
FROM customers AS c
LEFT JOIN orders AS o
    ON o.customer_id = c.customer_id
   AND o.status = 'completed'
   AND o.order_date >= TIMESTAMPTZ '2026-01-01 00:00:00+00'
ORDER BY c.customer_id, o.order_date DESC NULLS LAST;
```

The status and date predicates are in ON because they decide which orders match. Moving them to WHERE would discard NULL-extended rows and remove customers with no matching order.

## 3. Anti-join: customers with no completed orders

```sql
SELECT
    c.customer_id,
    c.email
FROM customers AS c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders AS o
    WHERE o.customer_id = c.customer_id
      AND o.status = 'completed'
);
```

NOT EXISTS expresses “no matching row” directly and avoids the NULL trap that can make NOT IN behave unexpectedly.

## 4. Join fan-out: why a revenue query can be wrong

This query looks plausible, but its sums can be inflated:

```sql
-- BUG: two items and two payments create four joined rows for this order.
SELECT
    o.customer_id,
    COUNT(DISTINCT o.order_id) AS order_count,
    SUM(i.quantity * i.unit_price) AS item_revenue,
    SUM(p.amount) FILTER (WHERE p.status = 'settled') AS settled_amount
FROM orders AS o
LEFT JOIN order_items AS i ON i.order_id = o.order_id
LEFT JOIN payments AS p ON p.order_id = o.order_id
GROUP BY o.customer_id;
```

For example, an order with 2 item rows and 2 payment rows produces 4 joined rows. DISTINCT fixes the order count here, but it does not fix either SUM.

Aggregate each child table to one row per order **before** joining:

```sql
WITH item_totals AS (
    SELECT
        i.order_id,
        SUM(i.quantity * i.unit_price) AS item_total
    FROM order_items AS i
    GROUP BY i.order_id
),
payment_totals AS (
    SELECT
        p.order_id,
        SUM(p.amount) FILTER (WHERE p.status = 'settled') AS settled_total
    FROM payments AS p
    GROUP BY p.order_id
),
order_totals AS (
    SELECT
        o.order_id,
        o.customer_id,
        o.status,
        o.order_date,
        COALESCE(i.item_total, 0) AS item_total,
        COALESCE(p.settled_total, 0) AS settled_total
    FROM orders AS o
    LEFT JOIN item_totals AS i ON i.order_id = o.order_id
    LEFT JOIN payment_totals AS p ON p.order_id = o.order_id
)
SELECT
    c.customer_id,
    c.email,
    COUNT(ot.order_id) FILTER (WHERE ot.status = 'completed')
        AS completed_orders,
    COALESCE(
        SUM(ot.item_total) FILTER (WHERE ot.status = 'completed'),
        0
    ) AS completed_item_revenue,
    COALESCE(SUM(ot.settled_total), 0) AS settled_payments
FROM customers AS c
LEFT JOIN order_totals AS ot ON ot.customer_id = c.customer_id
GROUP BY c.customer_id, c.email
ORDER BY completed_item_revenue DESC, c.customer_id;
```

This produces one row per customer. Item revenue and settled payments remain separate business measures; do not assume the amount charged must equal the current item total when refunds, discounts, or partial payments exist.

## 5. Latest three orders per customer

Question: return each customer's three most recent orders, with deterministic ordering when timestamps tie.

```sql
WITH ranked_orders AS (
    SELECT
        o.order_id,
        o.customer_id,
        o.status,
        o.order_date,
        ROW_NUMBER() OVER (
            PARTITION BY o.customer_id
            ORDER BY o.order_date DESC, o.order_id DESC
        ) AS row_num
    FROM orders AS o
)
SELECT
    customer_id,
    order_id,
    status,
    order_date
FROM ranked_orders
WHERE row_num <= 3
ORDER BY customer_id, row_num;
```

Use ROW_NUMBER for at most N rows per customer. Use RANK or DENSE_RANK when ties should share a rank. PostgreSQL does not allow filtering a window result in the same query's WHERE, so calculate it in a CTE/subquery first.

## 6. Month-over-month completed sales

This first aggregates to one row per month, then uses LAG to compare adjacent months that have data:

```sql
WITH monthly_sales AS (
    SELECT
        date_trunc('month', o.order_date)::date AS month,
        SUM(i.quantity * i.unit_price) AS revenue
    FROM orders AS o
    JOIN order_items AS i ON i.order_id = o.order_id
    WHERE o.status = 'completed'
      AND o.order_date >= TIMESTAMPTZ '2025-01-01 00:00:00+00'
      AND o.order_date <  TIMESTAMPTZ '2026-01-01 00:00:00+00'
    GROUP BY date_trunc('month', o.order_date)::date
),
compared AS (
    SELECT
        month,
        revenue,
        LAG(revenue) OVER (ORDER BY month) AS previous_month_revenue
    FROM monthly_sales
)
SELECT
    month,
    revenue,
    previous_month_revenue,
    revenue - previous_month_revenue AS change_amount,
    ROUND(
        100.0 * (revenue - previous_month_revenue)
        / NULLIF(previous_month_revenue, 0),
        2
    ) AS change_percent
FROM compared
ORDER BY month;
```

Months with no orders do not appear here. To report zero-activity months too, generate a month series and LEFT JOIN the aggregated sales onto it.

## 7. Find duplicates before adding a uniqueness rule

Suppose email addresses should be unique regardless of case or surrounding spaces. Find existing conflicts first:

```sql
SELECT
    lower(btrim(email)) AS normalized_email,
    COUNT(*) AS rows_with_email,
    ARRAY_AGG(customer_id ORDER BY created_at, customer_id) AS customer_ids
FROM customers
GROUP BY lower(btrim(email))
HAVING COUNT(*) > 1
ORDER BY rows_with_email DESC;
```

Do not delete duplicate customer rows until you understand their foreign-key references. A production deduplication often chooses a canonical customer, repoints related rows, then removes the duplicate in a reviewed transaction. After resolving the data, enforce the rule:

```sql
CREATE UNIQUE INDEX uq_customers_normalized_email
    ON customers (lower(btrim(email)));
```

## 8. Create and call a useful SQL function

An SQL-language function is a good fit for a small reusable expression:

```sql
CREATE OR REPLACE FUNCTION normalize_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
    SELECT lower(btrim(p_email));
$$;

SELECT normalize_email('  Ada@Example.com  ');
```

IMMUTABLE is appropriate here because the output depends only on the input. STRICT means NULL input returns NULL without running the body.

Here is a read-only table-valued function for a customer's count, item revenue, and settled payments. Each measure is calculated at its own grain, so item and payment rows do not multiply one another:

```sql
CREATE OR REPLACE FUNCTION customer_order_summary(p_customer_id bigint)
RETURNS TABLE (
    order_count       bigint,
    item_revenue      numeric,
    settled_payments  numeric
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        (
            SELECT COUNT(*)
            FROM orders AS o
            WHERE o.customer_id = p_customer_id
        ),
        COALESCE(
            (
                SELECT SUM(i.quantity * i.unit_price)
                FROM orders AS o
                JOIN order_items AS i ON i.order_id = o.order_id
                WHERE o.customer_id = p_customer_id
                  AND o.status = 'completed'
            ),
            0
        ),
        COALESCE(
            (
                SELECT SUM(p.amount)
                FROM orders AS o
                JOIN payments AS p ON p.order_id = o.order_id
                WHERE o.customer_id = p_customer_id
                  AND p.status = 'settled'
            ),
            0
        );
$$;

SELECT *
FROM customer_order_summary(42);
```

STABLE is appropriate for a read-only function that consults tables and should return a consistent result within one statement. Do not label a table-reading function IMMUTABLE.

## 9. Debug a function with a join-counting bug

Here is a realistic bug: the function claims to count completed orders, but the join returns one row per item, so it counts order lines instead.

```sql
CREATE OR REPLACE FUNCTION completed_order_count(p_customer_id bigint)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)
    FROM orders AS o
    JOIN order_items AS i ON i.order_id = o.order_id
    WHERE o.customer_id = p_customer_id
      AND o.status = 'completed';
$$;
```

Call it and inspect its SQL definition:

```sql
SELECT completed_order_count(42);

SELECT pg_get_functiondef(
    'public.completed_order_count(bigint)'::regprocedure
);
```

Then inspect the rows at the join's grain:

```sql
SELECT
    o.order_id,
    COUNT(i.item_id) AS item_rows
FROM orders AS o
JOIN order_items AS i ON i.order_id = o.order_id
WHERE o.customer_id = 42
  AND o.status = 'completed'
GROUP BY o.order_id
ORDER BY o.order_id;
```

Fix it by counting from the table that already has one row per order. No join is required:

```sql
CREATE OR REPLACE FUNCTION completed_order_count(p_customer_id bigint)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)
    FROM orders AS o
    WHERE o.customer_id = p_customer_id
      AND o.status = 'completed';
$$;
```

Debugging lesson: confirm the row grain after each join before trusting COUNT or SUM.

## 10. PL/pgSQL messages and error diagnostics

Use RAISE NOTICE temporarily to print values during a function call. Remove noisy diagnostics or lower their level after debugging:

```sql
CREATE OR REPLACE FUNCTION debug_completed_order_count(p_customer_id bigint)
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM orders AS o
    WHERE o.customer_id = p_customer_id
      AND o.status = 'completed';

    RAISE NOTICE 'customer_id=%, completed_orders=%',
        p_customer_id, v_count;

    RETURN v_count;
END;
$$;

SELECT debug_completed_order_count(42);
```

When catching an error to add diagnostic context, preserve and re-raise it instead of silently returning a made-up success value:

```sql
CREATE OR REPLACE FUNCTION divide_amount(p_amount numeric, p_divisor numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_message text;
    v_detail  text;
    v_hint    text;
BEGIN
    IF p_divisor = 0 THEN
        RAISE EXCEPTION 'divisor must not be zero'
            USING ERRCODE = '22012';
    END IF;

    RETURN p_amount / p_divisor;
EXCEPTION
    WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
            v_message = MESSAGE_TEXT,
            v_detail  = PG_EXCEPTION_DETAIL,
            v_hint    = PG_EXCEPTION_HINT;

        RAISE NOTICE 'divide_amount failed: %, detail: %, hint: %',
            v_message, v_detail, v_hint;
        RAISE;
END;
$$;

SELECT divide_amount(10, 0);
```

The final RAISE rethrows the original error. In production, avoid logging sensitive parameter values.

## 11. Debug performance with EXPLAIN

Run the exact query with representative parameters and data:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    o.order_id,
    o.order_date
FROM orders AS o
WHERE o.customer_id = 42
ORDER BY o.order_date DESC
LIMIT 20;
```

Read actual versus estimated rows, repeated loops, scans, sort steps, and buffer reads. A sequential scan is not automatically wrong; it can be best for small tables or queries returning many rows. Check for stale planner statistics with ANALYZE when estimates are badly off.

EXPLAIN ANALYZE **executes** the statement. For a data-changing statement, run it in a transaction and roll back when you are only measuring:

```sql
BEGIN;

EXPLAIN (ANALYZE, BUFFERS)
UPDATE orders
SET status = 'cancelled'
WHERE status = 'pending'
  AND order_date < now() - INTERVAL '90 days';

ROLLBACK;
```

For functions, explain the underlying SELECT separately as well as the function call. SQL functions may be inlined in some cases; PL/pgSQL execution can have different planning behavior.

## Interview debugging checklist

1. State the intended output grain: one row per customer, order, or month?
2. Check key cardinality and count rows after each join.
3. Move conditions between ON and WHERE only after deciding whether unmatched left rows must remain.
4. Check NULL behavior: COUNT(column), NOT IN, COALESCE, and comparisons.
5. Aggregate each one-to-many relation before joining it to another one-to-many relation.
6. Test empty input, duplicate rows, tied timestamps, NULLs, and boundary dates.
7. Inspect the function definition and run its body query independently with a known input.
8. Use EXPLAIN (ANALYZE, BUFFERS) on representative data; remember ANALYZE runs the statement.
9. Use RAISE NOTICE or GET STACKED DIAGNOSTICS while debugging PL/pgSQL; rethrow unexpected errors.
10. Fix correctness before adding indexes. Then verify the execution plan.

## References

- [PostgreSQL joins and table expressions](https://www.postgresql.org/docs/16/queries-table-expressions.html)
- [PostgreSQL window functions](https://www.postgresql.org/docs/16/functions-window.html)
- [CREATE FUNCTION](https://www.postgresql.org/docs/16/sql-createfunction.html)
- [PL/pgSQL errors and messages](https://www.postgresql.org/docs/16/plpgsql-errors-and-messages.html)
- [EXPLAIN](https://www.postgresql.org/docs/16/using-explain.html)
- [Functions versus procedures](https://www.postgresql.org/docs/18/xproc.html)

