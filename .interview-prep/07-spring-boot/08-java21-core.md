# 08 — Core Java 21

The language questions that come up alongside the Spring ones. This project is
on **Java 21**, so records, sealed types, pattern matching, and virtual threads
are all fair game.

---

## Records — used everywhere here

```java
// application/domain/User.java
public record User(UUID id, String username, String email,
                   String passwordHash, Set<String> roles) { }

// You get, generated:
//   a canonical constructor
//   accessors named id(), username()   <- NOT getId(). Records aren't beans.
//   equals/hashCode over ALL components
//   toString
// The class is final, the fields are final. Immutable by construction.
```

```java
// COMPACT CONSTRUCTOR — validation and normalisation:
public record RegisterCommand(String username, String email,
                              String password, String confirmEmail) {
    public RegisterCommand {           // no parameter list, no assignments
        Objects.requireNonNull(username);
        username = username.trim().toLowerCase();   // assigning to the PARAM
    }                                               // rewrites the field
    public boolean emailsMatching() { return email.equals(confirmEmail); }
}
```

**⚠️ Records are shallowly immutable.** `Set<String> roles` is a final
*reference* to a possibly mutable set. Defensive-copy in the compact
constructor if it matters:

```java
public record User(UUID id, String username, Set<String> roles) {
    public User { roles = Set.copyOf(roles); }   // now genuinely immutable
}
```

**Where records don't fit:** JPA entities. JPA needs a no-arg constructor and
setters for proxying and dirty checking. That's part of why this codebase has
`UserEntity` (a class) separate from `User` (a record) — see
`02-architecture-hexagonal.md`.

---

## Java serialization, `serialVersionUID`, and RMI

Java serialization converts an object into bytes so it can be stored or sent
somewhere. Deserialization reconstructs the object from those bytes later.

`serialVersionUID` is the compatibility identifier Java uses when it
serializes and later deserializes an object:

```java
class InvalidAppCategoryException extends RuntimeException
    implements Serializable {
    private static final long serialVersionUID = 1L;
}
```

`RuntimeException` already implements `Serializable`; explicitly writing it
here is therefore optional. The `1L` is simply the initial version number.

Typical use cases include:

- HTTP session replication between application instances
- distributed caches
- Java RMI
- serialized queues or files
- restarting an application that stored serialized objects

Java RMI (Remote Method Invocation) is an older Java-to-Java RPC mechanism.
It lets one JVM call methods on an object living in another JVM. Arguments,
return values, and exceptions may be serialized and sent over the network.

Normally keep `serialVersionUID` at `1L` while the serialized form remains
compatible. Change it deliberately, for example to `2L`, when making an
incompatible serialization change:

```java
private static final long serialVersionUID = 2L;
```

For application exceptions such as `InvalidAppCategoryException`, which are
only converted to HTTP error responses and never stored or sent through Java
serialization, it is mainly present to silence the compiler warning and will
usually remain `1L` permanently.

---

## `Optional` — the rules

```java
// ✅ A RETURN TYPE meaning "may legitimately be absent".
Optional<User> findByUsername(String username);

// ❌ Never a field — it isn't Serializable (this is exactly why CacheConfig
//    uses JSON rather than JDK serialization).
// ❌ Never a parameter — the caller then has to build an Optional to call you.
// ❌ Never Optional<List<T>> — return an empty list.
```

```java
// The idiomatic chain, straight from AuthService.login:
User user = users.findByUsername(command.username())
        .filter(u -> hasher.matches(command.password(), u.passwordHash()))
        .orElseThrow(() -> new InvalidAuthorizationException(
                "invalid_credentials", "Invalid username or password"));
// Note: the SAME error whether the user doesn't exist or the password is
// wrong. Different messages let an attacker enumerate valid usernames.
```

```java
opt.get()                    // ❌ throws if empty. If you're calling this,
                             //    you've defeated the point.
opt.orElse(expensive())      // ⚠️ ALWAYS evaluates expensive(), even on a hit
opt.orElseGet(() -> ...)     // ✅ lazy — only on a miss
opt.map(...).flatMap(...)    // flatMap when the mapper returns an Optional
opt.ifPresentOrElse(a, b)
```

---

## `equals` / `hashCode`

The contract, which is what gets asked:

1. Equal objects **must** have equal hash codes.
2. Unequal objects *may* share a hash code (a collision).
3. Both must be consistent while the object is in a hash-based collection.

```java
// ⚠️ THE ENTITY TRAP — and why @Data on an @Entity is a bug.
@Entity @Data                      // ❌ generates equals/hashCode over ALL fields
public class UserEntity {
    @Id @GeneratedValue private UUID id;     // NULL before persist
    @OneToMany private Set<Role> roles;      // LAZY — touching it loads or throws
}
// set.add(entity)   -> hashed with id == null
// repository.save() -> id assigned, hash CHANGES
// set.contains(entity) -> false. The object is lost inside its own set.
```

The correct entity implementation: a **business key** if one exists, otherwise
a constant `hashCode` and an `equals` on id that handles null:

```java
@Override public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof UserEntity other)) return false;   // pattern matching
    return id != null && id.equals(other.id);
}
@Override public int hashCode() { return getClass().hashCode(); }
// Constant hash: correct (equal objects share it) but every entity lands in
// one bucket, so keep collections of entities small.
```

Records handle all of this for you — another reason the domain model is a
record.

---

## Streams

```java
// From GlobalExceptionControllerAdvice:
HttpStatus status = STATUS_MAPPING.entrySet().stream()
        .filter(e -> e.getKey().isAssignableFrom(exception.getClass()))
        .map(Map.Entry::getValue)
        .findFirst()                       // SHORT-CIRCUITS — stops at the first
        .orElse(HttpStatus.INTERNAL_SERVER_ERROR);
```

```java
// Intermediate (lazy)  : map, filter, sorted, distinct, limit, peek
// Terminal (runs it)   : collect, forEach, reduce, findFirst, anyMatch, count
// ⚠️ Without a terminal operation, NOTHING EXECUTES. A stream you never
//    collect is dead code that looks like it works.

.collect(Collectors.toList())    // mutable
.toList()                        // Java 16+, IMMUTABLE — prefer it
.collect(Collectors.groupingBy(User::username))
.collect(Collectors.joining(", "))
```

**⚠️ Never `parallelStream()` in a request path.** It uses the shared
`ForkJoinPool.commonPool`, so one slow parallel stream degrades every other one
in the JVM — and it loses the `SecurityContextHolder` ThreadLocal, so
authentication silently vanishes.

---

## Thread states

```
NEW ──start()──► RUNNABLE ◄──────────────────────────┐
                    │                                 │
     ┌──────────────┼───────────────┐                 │ gets monitor / notified / time passes
     ▼              ▼               ▼                 │
  BLOCKED        WAITING       TIMED_WAITING ─────────┘
     │              │               │
     └──────────────┴───────────────┘
                    │
              run() ends or throws
                    ▼
               TERMINATED
```

| State | Meaning | How you get there |
|---|---|---|
| **NEW** | Created, not started | `new Thread(r)` |
| **RUNNABLE** | Running, or ready and waiting for a CPU (Java doesn't separate those) | `start()` |
| **BLOCKED** | Waiting to enter a `synchronized` block: another thread owns the monitor | `synchronized (obj)` when it's taken |
| **WAITING** | Waiting forever for another thread's action | `obj.wait()`, `thread.join()`, `LockSupport.park()`, `lock.lock()` on `ReentrantLock` |
| **TIMED_WAITING** | Same, with a timeout | `Thread.sleep(ms)`, `wait(ms)`, `join(ms)`, `tryLock(t)` |
| **TERMINATED** | Finished (normally or by exception). A thread can't be restarted | `run()` returns or throws |

- `BLOCKED` is only for `synchronized`. Waiting on a `ReentrantLock` shows as `WAITING`.
- `Thread.State` has no "running" or "sleeping". Those are `RUNNABLE` and `TIMED_WAITING`.
- `thread.getState()` shows it, and `jstack` thread dumps print it. That's how you find deadlocks (threads stuck in `BLOCKED`).

**`join()`:** `t.join()` makes the **calling** thread wait until `t` has finished,
then the caller resumes by itself. It doesn't resume or wake `t`. `t.join(2000)`
waits at most 2 seconds and returns even if `t` is still running. The caller is
`WAITING` (`TIMED_WAITING` with a timeout). The explicit wake-ups are
`notify()` and `LockSupport.unpark(thread)`. For a pool task, `Future.get()` does
the same job.

**Stopping a thread:** it normally ends **by itself** when `run()` returns or
throws, so **no flag is needed when the work is finite** (a fixed job, or a loop
over a list):

```java
void run() { doWork(); sendEmail(); }                        // returns -> TERMINATED, nothing to stop
void run() { for (Message m : batch) process(m); }           // finite loop -> ends -> TERMINATED
```

A stop request is only for a loop that never ends on its own:

```java
void run() { while (true) { doWork(); } }     // runs until the JVM exits: needs a way out

private volatile boolean running = true;      // volatile: other threads must SEE the change
void run()  { while (running) { doWork(); } } // flag ends the loop -> run() returns -> TERMINATED
void stop() { running = false; }              // call from another thread
```

**Calling `stop()` from another thread:** threads share **objects**, not local
variables. Keep a reference to the worker and call its method:

```java
class Worker implements Runnable {
    private volatile boolean running = true;           // INSTANCE field: one flag per worker
    public void run()  { while (running) { doWork(); } }   // worker thread reads it
    public void stop() { running = false; }                // any thread may call it
}

Worker w = new Worker();     // keep the reference, or nothing can call w.stop()
new Thread(w).start();       // the thread runs w.run(): it reads w.running
w.stop();                    // main thread sets the same w.running -> loop ends
```

A `static` flag would be one flag for **all** workers (`a.stop()` would stop `b`
too). A local variable can't be shared; with a lambda use an `AtomicBoolean` and
`set(false)`.

Use `interrupt()` instead (or as well) when the loop blocks in
`sleep`/`wait`/`take()`, because a flag can't wake a parked thread. Other ways a
thread ends: an uncaught exception (usually a bug), or the JVM exiting (daemon
threads die mid-work). Java has no safe force-kill; `Thread.stop()` is
deprecated. With pools use `shutdown()` then `awaitTermination()`.

---

## Virtual threads (Java 21)

The headline feature, and this project's Boot version supports it:

```properties
spring.threads.virtual.enabled=true
```

```java
// Platform thread : ~1 MB stack, an OS thread. ~a few thousand max.
// Virtual thread  : a few hundred BYTES, scheduled by the JVM onto a small
//                   pool of carriers. Millions are fine.
//
// The point: blocking a virtual thread is CHEAP. It unmounts from its carrier
// and the carrier runs something else. So thread-per-request stops being the
// bottleneck, and you get WebFlux-like scalability with ordinary blocking code.
```

**Where it helps here:** `session` and `chat` are I/O-bound (JDBC, Redis, MinIO)
and written in blocking style. Virtual threads raise their concurrency ceiling
with a one-line property and no rewrite.

**What to know before claiming it:**

- **`synchronized` pins** the virtual thread to its carrier (fixed in later JDKs
  via JEP 491, but 21 has it). A synchronized block around I/O throttles you
  back to the carrier count. Use `ReentrantLock`.
- **It doesn't help CPU-bound work.** You still only have N cores.
- **Your connection pool is still the real limit.** A million virtual threads
  all waiting on 10 Hikari connections is still 10 concurrent queries. Virtual
  threads move the bottleneck; they don't remove it.

---

## Pattern matching & sealed types

```java
// instanceof pattern — used in the equals above
if (o instanceof UserEntity other) { return id.equals(other.id); }

// Switch patterns (21) + sealed hierarchies: exhaustive, compiler-checked.
public sealed interface ChatEvent permits MessageSent, UserJoined, UserLeft {}

String describe(ChatEvent e) {
    return switch (e) {                       // no `default` needed —
        case MessageSent m -> "msg: " + m.text();   // the compiler knows the
        case UserJoined  u -> u.user() + " joined"; // list is complete
        case UserLeft    u -> u.user() + " left";
    };
    // Add a 4th permitted type and this STOPS COMPILING until you handle it.
    // That's the value: exhaustiveness you can't forget.
}
```

`chat/application/domain/event/types/` is exactly this shape.

---

## Concurrency essentials

```java
// The collections question:
HashMap                 // not thread-safe. Concurrent writes can corrupt it.
Collections.synchronizedMap  // one lock for everything. Correct, slow.
ConcurrentHashMap       // lock striping. What you want.
                        // ⚠️ get/put are each atomic, but
                        //    `if (!map.containsKey(k)) map.put(k, v)` is NOT.
                        //    Use computeIfAbsent / putIfAbsent.
```

```java
// This matters directly for ChatWebSocketHandler's sessionId -> session map:
private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
// Sockets connect and disconnect on different threads concurrently.
```

```java
volatile      // visibility only: reads see the latest write. NOT atomicity —
              // volatile int i; i++ is still a lost-update race.
AtomicInteger // atomic read-modify-write via CAS
```

---

## 🧠 Hooks

- **Records: final, immutable, `equals`/`hashCode` free — but shallow.** Copy your collections.
- **`Optional` is a return type.** Never a field, never a parameter.
- **`orElseGet` is lazy; `orElse` always evaluates.**
- **`@Data` on an `@Entity` breaks `hashCode` the moment an id is assigned.**
- **No terminal operation = the stream never runs.**
- **Never `parallelStream()` in a request** — shared pool, and it loses ThreadLocals.
- **Virtual threads make blocking cheap** — but `synchronized` pins, and your connection pool is still the ceiling.
- **Sealed + switch = exhaustiveness the compiler enforces.**
