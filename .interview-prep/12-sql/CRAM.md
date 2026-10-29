# 30-Minute Cram — Senior SQL

*Read top to bottom. Bold lines are the ones to say out loud.*

## The core idea

**SQL describes the result you want; the optimizer chooses a plan.** Senior SQL work is being precise about row grain, NULL behavior, ordering, and constraints, then measuring the actual plan on representative data.

## Query semantics

Approximate logical order: `FROM` / `JOIN` → `WHERE` → `GROUP BY` → `HAVING` → window expressions / `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT` / `FETCH`. This explains why a select alias often cannot be used in `WHERE`, and why `WHERE` filters rows before aggregation while `HAVING` filters groups.

- SQL uses three-valued logic: `TRUE`, `FALSE`, `UNKNOWN`. `NULL = NULL` is unknown; use `IS NULL`.
- `COUNT(*)` counts rows; `COUNT(column)` skips NULLs. Most aggregates ignore NULL inputs.
- `NOT IN (subquery)` can return no rows if the subquery yields a NULL. `NOT EXISTS` is usually safer for anti-joins.
- `CASE` evaluates conditions in order. `COALESCE` returns the first non-NULL value; be careful not to turn “unknown” into a misleading zero.

## Joins and grain

- State the grain first: “one row per order” or “one row per customer-month.” Every join can change it.
- A one-to-many join duplicates the one-side row. Aggregate before joining or use `EXISTS` if only testing presence.
- A predicate on the nullable side in `WHERE` removes unmatched rows from a `LEFT JOIN`; put it in `ON` if unmatched left rows must remain.
- Join on keys with understood uniqueness and nullability. Avoid accidental many-to-many joins.
- Use `UNION ALL` unless duplicate elimination is required; `UNION` adds work and can hide data-quality problems.

## Aggregates and windows

- `GROUP BY` collapses rows to one per group. A window function keeps the input rows and adds a value across a frame.
- `ROW_NUMBER` gives a unique sequence; `RANK` has gaps after ties; `DENSE_RANK` does not.
- For deterministic top-N, include a stable tie-breaker in `ORDER BY`.
- Window frames matter. Running totals should say `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`; the default frame may include peers with equal sort values.
- Use conditional aggregation (`SUM(CASE WHEN ... THEN 1 ELSE 0 END)`) or dialect-supported `FILTER` to compute several metrics in one pass.

## Modeling and integrity

- Primary keys identify rows; foreign keys protect relationships; `UNIQUE`, `NOT NULL`, and `CHECK` constraints make invariants durable.
- Normalize transactional data to avoid update anomalies. Denormalize deliberately for read paths, with ownership and refresh rules.
- Store timestamps with a clear timezone convention; use half-open ranges (`>= start AND < end`) for time windows.
- Use `DECIMAL`/`NUMERIC` for exact monetary arithmetic, not binary floating point.
- Indexes speed selected reads but cost storage and write work. Index foreign-key lookup columns when access patterns justify it; an FK does not automatically imply an index in every engine.

## Transactions and concurrency

- A transaction groups work atomically; isolation controls what concurrent transactions can observe.
- Know dirty reads, non-repeatable reads, phantoms, and write skew. The engine's named isolation level may differ in implementation.
- Protect invariants with constraints or correct locking/isolation—not only an application-side “check then insert.”
- Keep transactions short. Long transactions hold locks/resources and can delay cleanup or block writers.
- Retry serialization/deadlock failures around the **whole transaction**, and only when the operation is safe to retry.

## Performance

- Read the plan: estimated vs actual rows, join order/algorithm, scans, sorts, spills, loops, and I/O. A sequential scan can be optimal for a small table or low-selectivity predicate.
- Composite B-tree indexes generally help from their leading columns; match predicates and sort order, but do not cargo-cult the leftmost-prefix rule across every engine/index type.
- Avoid wrapping indexed columns in functions when a range predicate or expression index can express the query better.
- Select only needed columns. Large `OFFSET` pagination gets slower and can skip/duplicate rows under concurrent writes; keyset pagination uses a stable ordered cursor.
- CTEs improve readability; whether they inline or materialize depends on the database and version.
- Partitioning helps specific pruning/maintenance patterns; it is not a substitute for good query design or indexes.

## The senior-level answer pattern

**Describe the row grain → show correct semantics → state the invariant and indexes → inspect the plan and runtime → explain concurrency and failure behavior.**

