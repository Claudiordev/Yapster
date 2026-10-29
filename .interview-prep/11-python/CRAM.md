# 30-Minute Cram — Senior Python

*Read top to bottom. Bold lines are the ones to say out loud.*

## The mental model

- Python is **dynamic, strongly typed, and multi-paradigm**. Names refer to objects; assignment binds a name, it does not copy the object.
- **Mutability belongs to objects, not variables.** Aliasing explains most surprising behavior.
- The language favors explicit protocols: iteration, context management, descriptors, and special methods let user types work with built-ins.
- Senior answers connect the language feature to correctness, concurrency, performance, and maintainability.

## Values, identity, and mutability

- `==` asks whether values are equal; `is` asks whether two names refer to the same object. Use `is None`, not `== None`.
- Mutable: `list`, `dict`, `set`, most user objects. Immutable: `int`, `float`, `str`, `tuple` (though a tuple can contain mutable objects), `frozenset`.
- A shallow copy copies the outer container; nested objects remain shared. `deepcopy` is not a default fix: it can be expensive and may copy objects that should remain shared.
- **Never use a mutable default argument.** Defaults are evaluated once when `def` executes. Use `None` and allocate inside.
- `dict` preserves insertion order; sets do not promise a useful order. Hash keys must have stable equality and hash for their lifetime.

## Functions and scope

- Functions are first-class objects. Closures capture bindings from enclosing scopes; `nonlocal` rebinds an enclosing local, while `global` targets the module namespace.
- Default arguments, closures, and loop variables are common late-binding traps. Capture a loop value explicitly when creating callbacks.
- Decorators wrap callables. Preserve metadata with `functools.wraps`; be clear about ordering and whether the wrapper changes the signature or behavior.
- Prefer small pure functions at boundaries. Avoid surprising mutation and ambient global state.

## Iteration and data handling

- An **iterable** can produce an iterator; an **iterator** has `__next__` and is consumed. A generator function returns a lazy iterator and resumes at each `yield`.
- Generators reduce peak memory for streaming work, but they are one-shot and errors may occur during consumption, not creation.
- Comprehensions are clear for simple transforms; use a loop when logic, side effects, or debugging becomes nontrivial.
- `itertools` provides lazy composition; `collections` has purpose-built containers such as `Counter`, `deque`, and `defaultdict`.
- Sort stability means equal keys retain their prior relative order. `key=` is usually clearer and faster than comparator logic.

## Exceptions and resource safety

- Catch the narrowest exception you can handle. Do not swallow errors with `except Exception: pass`.
- Add context with exception chaining: `raise DomainError(...) from exc`.
- Use `with` for resources whose lifetime must be bounded: files, locks, transactions, and custom resources. A context manager's `__exit__` can suppress an exception, so use that deliberately.
- Cleanup belongs in `finally` or context managers, not after a statement that may fail.

## Objects, typing, and API design

- Python supports duck typing; protocols describe the operations a consumer needs. Runtime behavior is still dynamic unless explicitly checked.
- Type hints improve tooling and communication; they are not automatically enforced at runtime. Use `Protocol` for structural contracts and `TypedDict` for typed dictionary shapes.
- `dataclass` generates common methods; `frozen=True` prevents field rebinding but does not deep-freeze contained objects.
- Prefer composition to deep inheritance. Keep public APIs small and make invalid states hard to construct.
- `__slots__` can reduce per-instance memory and constrain attributes, but affects flexibility and inheritance; measure before using it.

## Concurrency — choose by bottleneck

| Work | Usual fit | Main caveat |
|---|---|---|
| I/O-bound, many concurrent waits | `asyncio` | Every blocking call must be made nonblocking or moved to a thread/process |
| I/O-bound, simpler synchronous libraries | threads / `ThreadPoolExecutor` | Shared mutable state needs synchronization |
| CPU-bound Python bytecode | `multiprocessing` / process pool | Serialization and process startup cost; data must cross process boundaries |
| CPU-heavy native libraries | threads may scale | Depends on whether native code releases the GIL |

- In conventional CPython builds, the **GIL limits simultaneous execution of Python bytecode by threads**; it does not make compound operations or application logic thread-safe.
- Async tasks are cooperative: they switch at `await`. CPU-heavy code or blocking I/O in the event loop stalls unrelated tasks.
- Cancellation is part of async correctness. Clean up in `finally`; do not leave tasks unobserved.
- Locks protect invariants, not individual lines. Keep critical sections short and define lock ordering to avoid deadlocks.

## Performance and production

- **Profile first.** Know algorithmic complexity, then use a profiler and representative data before micro-optimizing.
- Avoid quadratic copying in loops, unbounded queues, loading huge result sets, and N+1 network/database calls.
- Bound concurrency and memory: timeouts, queue limits, pagination/streaming, retries with backoff and jitter, and idempotency where retries can repeat writes.
- Use structured logs and metrics; do not log secrets or entire sensitive payloads.
- Depend on explicit, pinned project environments and reproducible builds. Keep secrets out of source and test the installed package, not only the working directory.

## Testing and review

- Test behavior at boundaries: normal cases, invalid input, failure paths, and concurrency where relevant.
- `pytest` fixtures manage setup; use parametrization for input matrices. Patch at the lookup site only when a real boundary cannot be used.
- A fake models useful behavior; a mock verifies an interaction. Prefer observable outcomes over asserting implementation details.
- Use linters, formatters, type checking, and dependency/security scanning as feedback, not substitutes for design review.

## The senior-level answer pattern

For a design question: **state the invariant → describe the simplest design → identify failure modes → explain how you would measure and test it.**

