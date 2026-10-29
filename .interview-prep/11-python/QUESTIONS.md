# Interview Questions — Senior Python

Answers are the short spoken version. Expand with a concrete example from your own work.

## Language fundamentals

**⭐ What does it mean that Python passes arguments by object reference?**
Names are bound to objects, and a call binds parameters to the same objects the caller supplied. Rebinding a parameter is local; mutating a shared mutable object is visible to the caller. I make mutation explicit in APIs and avoid it where callers might assume a value is copied.

**⭐ Why are mutable default arguments dangerous?**
Defaults are evaluated once when the function is defined, so a list or dictionary can be shared across calls. I use a `None` sentinel and allocate a fresh object inside the function.

**What is the difference between `is` and `==`?**
`is` tests identity; `==` tests value equality. I use identity for `None` and other singletons, and equality for values. Identity of interned strings or small integers is not a program contract.

**Shallow copy versus deep copy?**
A shallow copy duplicates the outer container and shares nested objects. A deep copy recursively copies, which can be costly or semantically wrong for resources and intentionally shared objects. I first ask what ownership and sharing the API promises.

**Iterable versus iterator versus generator?**
An iterable can create an iterator; an iterator is consumed one value at a time; a generator is a concise, lazy iterator implementation. Laziness saves memory but is one-shot and moves failures to iteration time.

**How do Python decorators work?**
A decorator takes a callable and returns a callable, usually wrapping it. I preserve metadata with `functools.wraps`, consider signature and exception behavior, and use decorators when the cross-cutting behavior is clear and consistent.

## Types and design

**Are type hints enforced at runtime?**
No, not by Python itself. They are a contract for readers, IDEs, and static checkers. Runtime validation is separate and belongs at untrusted boundaries when needed.

**Protocol versus abstract base class?**
A protocol describes a structural contract: a type qualifies by providing the needed operations. An ABC is nominal and can provide shared implementation or enforce subclass registration. I choose based on whether shared behavior and explicit inheritance matter.

**When would you use a dataclass?**
For a data-focused type where generated initialization and comparison make the intent clearer. Frozen dataclasses prevent rebinding fields but are shallow; I still consider mutability, validation, and whether the type has meaningful behavior.

## Concurrency and performance

**⭐ Explain the GIL and when you would use threads, processes, or asyncio.**
In standard CPython, the GIL generally serializes Python bytecode execution between threads, so threads are useful for concurrent I/O, processes for CPU-heavy Python, and asyncio for many cooperative I/O waits. I confirm the bottleneck first; native libraries may release the GIL, and process overhead can dominate small jobs.

**Does the GIL make Python code thread-safe?**
No. It does not make multi-step invariants atomic. I protect shared state with synchronization or avoid sharing mutable state.

**What makes async code accidentally slow?**
Blocking I/O or CPU-heavy work inside the event loop. It prevents all other tasks on that loop from progressing. I use async clients, offload blocking work, set timeouts, and monitor event-loop lag.

**How do you approach a slow Python service?**
Measure first: request traces, dependency latency, CPU, memory, and representative profiles. Then fix the dominant cause—often an N+1 call, unbounded work, repeated serialization, or poor algorithmic growth—and re-measure.

**How do you make retries safe?**
Bound attempts, use backoff and jitter, set a deadline, classify retryable failures, and ensure writes are idempotent or carry an idempotency key. Retries without those constraints amplify outages.

## Senior practice

**How do you decide whether to add an abstraction?**
I look for a stable concept or repeated policy that benefits multiple callers. I keep the interface smaller than the implementation and avoid generic frameworks built around hypothetical future needs.

**How do you test code that calls an external service?**
Keep business rules testable with a fake or injected port; add focused contract/integration tests against the real boundary where feasible. I verify observable behavior and important failure cases, not every internal call.

**Tell me how you handle a production incident in a Python service.**
First reduce user impact and establish what changed. Use logs, metrics, traces, and resource signals to form a testable hypothesis; contain the failure; then fix the cause, add regression coverage, and document operational follow-up.

