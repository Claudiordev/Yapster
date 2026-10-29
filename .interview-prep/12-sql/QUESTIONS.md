# Interview Questions — Senior SQL

Answers are the short spoken version. State the assumed database if behavior is dialect-specific.

## Semantics

**⭐ Why can a `LEFT JOIN` unexpectedly behave like an inner join?**
If I filter the nullable-side columns in `WHERE`, unmatched rows have NULLs and fail that predicate. If the condition controls which matches attach while all left rows remain, put it in `ON`.

**Why is `NOT IN` risky with NULLs?**
SQL comparisons use three-valued logic. If the subquery includes NULL, a nonmatch may evaluate to unknown, which `WHERE` drops. I use `NOT EXISTS` when I mean “no matching row.”

**What is the difference between `WHERE` and `HAVING`?**
`WHERE` filters input rows before grouping. `HAVING` filters groups after aggregates are computed. Query optimizers can still reorder physical work when semantics allow it.

**`COUNT(*)` versus `COUNT(column)`?**
The first counts rows; the second counts non-NULL values in the column. That difference matters after outer joins and when measuring completeness.

**⭐ How do you prevent a join from inflating a sum?**
I establish the intended grain and key cardinality first. If both sides are one-to-many, I aggregate each side to the target grain before joining, or use `EXISTS` when I only need to test presence.

## Analytical SQL

**Group by versus window function?**
Grouping collapses rows to a group result; a window computes over related rows and keeps each row. I use windows for ranking, running calculations, and prior/next row comparisons.

**`ROW_NUMBER`, `RANK`, and `DENSE_RANK`?**
`ROW_NUMBER` assigns unique positions. `RANK` gives ties the same rank with gaps; `DENSE_RANK` gives ties the same rank without gaps. I add a stable tie-breaker when results must be deterministic.

**What is the default window-frame trap?**
An ordered frame may include peer rows with equal ordering values, depending on the dialect. For row-by-row running totals I explicitly specify `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` and a deterministic order.

**How do you get the latest row per entity?**
Use `ROW_NUMBER()` partitioned by entity and ordered by timestamp descending plus a unique tie-breaker; filter to row one in an outer query or dialect-specific `QUALIFY`.

## Modeling and performance

**How do you choose an index?**
From important query predicates, joins, ordering, and actual data distribution. I verify selectivity and the plan, account for write/storage cost, and avoid adding an index solely because a column appears in a `WHERE` clause.

**When is a full table scan good?**
For small tables or when a query needs a large fraction of rows, sequential access can be cheaper than many random lookups. I compare actual work, not just the scan label.

**How do you investigate a slow query?**
Capture a representative plan with actual row counts and I/O where available. Find estimate errors, row multiplication, repeated nested-loop work, spills, and unnecessary scans; then test one change and compare runtime and resource use.

**Why is keyset pagination often better than `OFFSET`?**
Deep offsets can make the engine walk and discard many rows, and concurrent writes can shift page boundaries. A cursor over stable ordered keys gives predictable next-page work and ordering.

## Transactions

**How do you enforce a rule such as “at most one active subscription per user”?**
Prefer a database constraint that represents the invariant—such as a unique key or partial unique index when supported—so concurrent requests cannot both pass an application check. The exact DDL depends on the engine.

**What do you do after a deadlock or serialization error?**
Let the database abort the transaction, then retry the entire transaction with bounded backoff if the operation is idempotent or otherwise safe. I also review lock order and transaction duration to reduce recurrence.

**What does ACID mean in practice?**
Atomicity groups changes, consistency preserves defined invariants, isolation controls concurrent visibility, and durability preserves committed work. The database constraints and transaction design determine which business invariants actually hold.

