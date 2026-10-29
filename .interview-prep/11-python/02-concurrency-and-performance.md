# 02 — Concurrency and Performance

## Pick the concurrency model from the bottleneck

**Threads** are useful for overlapping blocking I/O and integrating synchronous libraries. In conventional CPython, the GIL generally prevents multiple threads from executing Python bytecode at the same time, but threads can still make progress while another waits and native extensions may release the GIL.

**Processes** can use multiple CPU cores for Python work. They add startup, memory, and serialization costs, so batch work sensibly and avoid copying huge object graphs between processes. Use top-level, picklable worker functions where the platform requires them.

**`asyncio`** is cooperative concurrency for lots of I/O waits. It is not a CPU parallelism mechanism. One synchronous call that blocks the event loop can stall every task on that loop. Use async-native clients or deliberately offload blocking work.

## Async correctness

- Coroutines do not run until awaited or scheduled. Keep references to created tasks and collect their results or exceptions.
- Use structured concurrency (`TaskGroup` in modern Python) where task lifetimes belong together.
- Cancellation is delivered at suspension points. Use `try/finally` for cleanup and re-raise cancellation after cleanup.
- Apply timeouts around external calls. Retries should be bounded, use backoff/jitter, and only repeat operations that are safe or idempotent.
- An `asyncio.Lock` coordinates tasks on an event loop; it is not a cross-thread or cross-process lock.

## Thread safety and shared state

The GIL does not protect a business invariant spanning several operations. For example, “check then update” is not an atomic transaction just because each dictionary operation is protected internally. Use a lock, a thread-safe queue, immutable messages, or a single-owner actor-style design. Define a consistent lock order and avoid holding locks across slow I/O.

## Find the real bottleneck

Start with a production-shaped workload and measure latency, throughput, memory, CPU, and dependency wait time. Profile before changing code. Big-O identifies how growth behaves; profiling tells you which cost matters at actual sizes.

Common bottlenecks include repeated serialization, per-row network calls, excessive object allocation, unbounded buffering, inefficient database queries, and contention. Batching and streaming can help, but add backpressure and failure-handling requirements.

## Operational patterns worth naming

- Set explicit connect/read/overall timeouts; a timeout should be shorter than the caller's remaining deadline.
- Bound worker pools, queues, request sizes, and fan-out. Unbounded concurrency converts a slow dependency into memory exhaustion.
- Propagate request IDs and deadlines across service boundaries.
- Make retries observable and distinguish retryable errors from permanent failures.
- Treat a queue as a buffer, not as extra capacity. If producers permanently outpace consumers, the queue only postpones failure.

