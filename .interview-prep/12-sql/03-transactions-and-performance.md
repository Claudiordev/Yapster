# 03 — Transactions, Indexes, and Query Plans

## Transactions and anomalies

A transaction gives a unit of atomic work. Isolation defines which concurrent effects are visible; names like `READ COMMITTED` and `SERIALIZABLE` have engine-specific implementations.

- **Dirty read:** observe another transaction's uncommitted data.
- **Non-repeatable read:** reread one row and see a committed change.
- **Phantom:** repeat a predicate query and see rows added or removed by another transaction.
- **Write skew:** concurrent transactions each observe a valid state and make individually valid writes that together violate a cross-row invariant.

Do not rely on an application-level read/check/write to protect uniqueness or cross-row rules. Use a unique/check/exclusion constraint, suitable locking, or serializable isolation with retries. A serialization failure means retry the whole transaction, not just the last statement.

Keep transactions short and avoid network calls while holding locks. Know the lock scope and deadlock behavior of the database you use. A deadlock victim can be retried only if the whole operation is safe to repeat.

## Index tradeoffs

An index is an access path, not a command to the optimizer. Selectivity, table size, clustering, statistics, and requested ordering all affect whether it is useful. Every index consumes storage and adds work to inserts, updates, deletes, and maintenance.

- A composite B-tree on `(a, b)` commonly supports predicates starting with `a`; a predicate only on `b` may not benefit. Verify the target engine's rules.
- Put columns used for equality/range/order based on the actual query workload; there is no universal column order.
- Partial, covering, expression, bitmap, and inverted indexes have engine-specific behavior.
- Foreign keys enforce integrity but do not necessarily create an index on the referencing side.
- Low-cardinality columns are not automatically bad index keys; combinations, clustering, and workload matter.

Avoid nonsargable predicates when possible. For example, applying a function to an indexed timestamp may prevent a simple range scan; express a half-open range instead or use a supported expression index.

## Read the execution plan

Use the database's explain facility and, when safe, its actual-execution mode. Compare estimated and actual rows at each node. Large estimation errors can produce poor join order, memory allocation, and algorithm choices.

Look for:

- Full scans that process many rows before filtering.
- Nested loops whose inner side runs unexpectedly many times.
- Hash or sort spills to disk.
- Large sorts that could be avoided by a suitable access path.
- Join row multiplication that indicates a grain or key problem.
- Excessive data scanned or transferred versus rows returned.

A full scan may be the right plan for a small table or a query returning a large fraction of it. Do not optimize based on the operator name alone.

## CTEs, partitioning, and pagination

CTEs make multi-step logic easier to read. Whether the engine inlines or materializes a CTE is version- and engine-dependent; inspect the plan rather than assuming a CTE is an optimization fence.

Partitioning can aid pruning, lifecycle management, and large-table maintenance when queries align with the partition key. It adds operational complexity and does not magically make every query faster.

Use keyset pagination for deep pages and stable navigation under concurrent inserts. `OFFSET` may require the engine to walk past discarded rows, and changing data can shift page boundaries.

## Dialect awareness

SQL is standardized but engines differ in data types, JSON support, locking, isolation, index types, `QUALIFY`, `LIMIT`/`FETCH`, DDL transactions, and query planning. In interviews, state your assumed engine before making a dialect-specific claim. Snowflake, for example, is a cloud data warehouse with micro-partition pruning and a different tuning model from a row-store OLTP database.

