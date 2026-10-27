# 05 — Caching with Redis

`CachingUserStore` is the most interesting class in this repo for an interview,
because every design decision in it has a defensible reason.

---

## The class

```java
/**
 * Caching decorator around JpaUserStore. Implements the same UserStore port
 * and wraps the real one.
 */
@Primary                 // anything asking for UserStore gets THIS
@Component
public class CachingUserStore implements UserStore {

    static final String USERS_CACHE = "users";
    private final UserStore delegate;

    // ⚠️ Inject the CONCRETE JpaUserStore, not the UserStore interface —
    // the interface would resolve to this @Primary bean and it would wrap
    // ITSELF. Infinite recursion, or a startup failure if Spring detects it.
    public CachingUserStore(JpaUserStore delegate) { this.delegate = delegate; }

    @Override
    @Cacheable(value = USERS_CACHE, key = "#id", unless = "#result == null")
    public Optional<User> findById(UUID id) { return delegate.findById(id); }

    @Override
    @CacheEvict(value = USERS_CACHE, key = "#user.id()")
    public User update(User user) { return delegate.update(user); }

    // everything else: plain pass-through, not cached
}
```

---

## Why a decorator instead of `@Cacheable` on `UserService`

Three reasons, and the third is the one that impresses.

**1. `UserService` stays framework-free.** It's in `application/`, which imports
no Spring. Annotating it would drag `spring-context` into the domain layer and
break the dependency rule (see `02-architecture-hexagonal.md`).

**2. It composes.** `CachingUserStore` wraps `JpaUserStore` because both
implement the same port. You could add a `MetricsUserStore` the same way,
without either knowing about the other.

**3. It dodges the self-invocation trap — and this is the real argument.**

```java
// If the annotations were on UserService:
@Service
public class UserService {
    @Cacheable("users")
    public User byId(UUID id) { ... }

    public Server addMember(UUID serverId, UUID userId) {
        User u = this.byId(userId);   // ❌ SELF-INVOCATION. Never leaves the
        ...                           //    object, never hits the proxy,
    }                                 //    NOT CACHED. Silently.
}
```

`@Cacheable`, like `@Transactional`, works via a proxy. An internal call is
invisible to it. Because the cache lives on a **separate bean**, every path
into the store goes through the proxy — including lookups the service makes
while doing something else. That's a correctness difference, not a style one.

---

## The SpEL detail people get wrong

```java
@Cacheable(value = "users", key = "#id", unless = "#result == null")
public Optional<User> findById(UUID id) { ... }
```

**Spring unwraps `Optional` before evaluating SpEL.** So `#result` is the bare
`User` — or `null` when the Optional is empty — and never the `Optional` itself.

- `unless = "#result == null"` → correct: a miss isn't cached.
- `unless = "#result.isEmpty()"` → calls `User.isEmpty()`. Doesn't exist. Fails
  at runtime, inside the cache interceptor, with a confusing stack trace.

```java
// key   — SpEL over ARGUMENTS:  #id, #user.id(), #root.methodName
// condition — evaluated BEFORE the call, on the arguments (skip caching small
//             results, etc.)
// unless    — evaluated AFTER the call, on the RESULT
```

---

## Why Redis, not Caffeine

> **Because the services run multiple replicas and need a *shared* cache.**

With an in-process cache (Caffeine), `@CacheEvict` on pod-A clears only pod-A.
Pod-B keeps serving the stale user until its TTL expires. Half your reads are
wrong, non-deterministically, and it's unreproducible locally where you run one
instance.

The trade-off, stated honestly: Redis costs a network round trip (~1 ms) where
Caffeine costs ~100 ns, and Redis can go down. The correct answer for many
systems is **both** — Caffeine as L1 with a short TTL, Redis as L2 — but only
if you can tolerate the L1 staleness window.

---

## The cache configuration, line by line

```java
@Configuration
@EnableCaching          // without this, every @Cacheable is a no-op
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory cf,
                                          ObjectMapper bootObjectMapper) {
        // Reuse Boot's ObjectMapper (it already has the jdk8 + parameter-names
        // modules registered) but COPY it before adding default typing — never
        // mutate a shared bean.
        ObjectMapper cacheMapper = bootObjectMapper.copy().activateDefaultTyping(
                BasicPolymorphicTypeValidator.builder().allowIfBaseType(Object.class).build(),
                ObjectMapper.DefaultTyping.EVERYTHING,
                JsonTypeInfo.As.PROPERTY);

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(5))
                .disableCachingNullValues()
                .computePrefixWith(name -> "session:" + name + ":v1:")
                .serializeValuesWith(SerializationPair.fromSerializer(
                        new GenericJackson2JsonRedisSerializer(cacheMapper)));

        return RedisCacheManager.builder(cf).cacheDefaults(base).build();
    }
}
```

**Each decision, and why:**

| Choice | Reason |
|---|---|
| **JSON, not JDK serialization** | The domain `User` is a record holding `Optional` and `Set`. `Optional` is **not** `Serializable` — JDK serialization throws. Jackson handles it. JSON is also readable in `redis-cli` and survives a class-shape change better. |
| **Default typing** | Writes a `@class` hint into the JSON so a record deserialises back to its real type instead of a `LinkedHashMap`. |
| **`entryTtl(5 min)`** | The default cache manager has **no TTL** — entries live forever and Redis grows until it evicts or OOMs. Every cache needs a TTL. |
| **`disableCachingNullValues()`** | Don't store misses. (Note the trade-off: this leaves you open to cache **penetration** — repeated lookups for an id that doesn't exist always hit Postgres. If that's an attack vector, cache a tombstone with a short TTL instead.) |
| **`session:<cache>:v1:` prefix** | Namespacing so a shared Redis doesn't collide across services, and a **version bump orphans old-shape entries** instead of deserialising them into the new class and failing. |

⚠️ **Default typing is a known deserialization-gadget risk** if the cache
contents are attacker-controlled. Here Redis is internal and only this service
writes it, so it's acceptable — but the `BasicPolymorphicTypeValidator` is what
bounds it, and you should say that rather than pretend the risk isn't there.

---

## Invalidation

> There are only two hard things in computer science: cache invalidation and
> naming things.

```java
@CacheEvict(value = USERS_CACHE, key = "#user.id()")
public User update(User user) { return delegate.update(user); }
// Keyed by the SAME UUID @Cacheable uses. If those two keys ever drift, the
// cache silently serves stale data for the whole TTL, and nothing errors.
```

⚠️ **The eviction is not transactional.** If `update` commits and the evict
fails (Redis blip), the cache is stale until the TTL. And by default the evict
happens *before* the transaction commits, so a concurrent read can re-populate
the cache with the OLD row and then the new one commits — stale again.
`@CacheEvict(beforeInvocation = false)` is the default but still fires at method
return, not at commit; a `TransactionalEventListener` on `AFTER_COMMIT` is the
rigorous fix.

**Patterns worth naming:**

| Pattern | What |
|---|---|
| **Cache-aside** | App checks cache → miss → load → populate. What `@Cacheable` does. |
| **Write-through** | Write to cache and DB together. `@CachePut`. |
| **Write-behind** | Write to cache, flush to DB async. Fast, can lose data. |

And the three failure modes:

- **Stampede** — a hot key expires and 500 concurrent requests all miss and all
  hit Postgres. Fix: a short lock, or probabilistic early expiry.
- **Penetration** — lookups for a key that never exists always reach the DB.
  Fix: cache the negative result briefly, or a bloom filter.
- **Avalanche** — everything expires at once because it was all loaded at once.
  Fix: jitter the TTL.

---

## What should *not* be cached

`findByUsername`, `existsByUsername`, and `existsByEmail` are deliberately
pass-through:

- `existsBy*` are used in the **registration uniqueness check**. A stale
  "false" lets a duplicate username through. Correctness beats the ~1 ms saved.
- `findByUsername` is on the **login** path, which is already dominated by
  BCrypt (intentionally ~100 ms). Caching a 1 ms query underneath that is
  pointless — and it would mean caching the password hash.

Being able to explain what you *chose not to* cache is a better signal than
caching everything.

---

## 🧠 Hooks

- **Cache on a separate bean, not on the service** — composes, keeps the domain clean, and avoids self-invocation.
- **`@Primary` decorator wrapping the concrete delegate** — inject the class, not the interface, or it wraps itself.
- **Spring unwraps `Optional` before SpEL** — `#result` is the bare value.
- **Redis over Caffeine because evictions must be seen by every replica.**
- **Every cache needs a TTL** — the default manager has none.
- **Version your key prefix** so a shape change orphans old entries.
- **The evict is not transactional.**
