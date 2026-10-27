# 02 — Hexagonal Architecture (Ports & Adapters)

The structure this codebase is built on. Be able to draw it, defend it, and say
where it's *not* worth it.

---

## The one rule

> **Dependencies point inward. `infrastructure` imports `application`.
> `application` imports nothing from `infrastructure`.**

Everything else follows from that.

```
                     ┌──────────────────────────────────┐
   HTTP ──────────►  │  infrastructure/controllers      │  DRIVING side
   WebSocket ─────►  │  infrastructure/socket           │  (things that call you)
                     └───────────────┬──────────────────┘
                                     │ calls
                     ┌───────────────▼──────────────────┐
                     │  application/service             │
                     │    AuthService, UserService      │  ← NO Spring web,
                     │  application/domain              │    NO JPA, NO Jackson
                     │    User, RefreshToken (records)  │
                     │  application/port                │
                     │    UserStore, TokenIssuer,       │  ← INTERFACES, owned
                     │    PasswordHasher, AvatarStorage │    by the inside
                     └───────────────┬──────────────────┘
                                     │ implemented by
                     ┌───────────────▼──────────────────┐
                     │  infrastructure/persistence      │  DRIVEN side
                     │    JpaUserStore, CachingUserStore│  (things you call)
                     │  infrastructure/security         │
                     │    JwtTokenIssuer, BCryptHasher  │
                     │  infrastructure/storage          │
                     │    MinioAvatarStorage            │
                     └──────────────────────────────────┘
```

---

## The counter-intuitive bit: who owns the interface

```java
// application/port/UserStore.java
// The interface lives with the code that USES it, not the code that
// IMPLEMENTS it. This is the whole trick, and it's what makes the arrow
// point inward.
//
// Note the vocabulary: no `save`, no `findAll`, no `Pageable`. The port is
// phrased in terms of what the USE CASE needs — not in terms of what a
// database can do. If the port looks like JpaRepository, you've just renamed
// your ORM and gained nothing.
public interface UserStore {
    Optional<User> findById(UUID id);
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    User create(String username, String email, String passwordHash);
    User update(User user);
    List<User> searchByUsername(String usernameQuery, int page, int size);
}
```

```java
// infrastructure/persistence/JpaUserStore.java
// The adapter is the ONLY place that knows JPA exists. It also translates
// between UserEntity (a table row) and User (the domain record).
@Component
public class JpaUserStore implements UserStore {
    private final UserRepository repo;      // Spring Data lives here and nowhere else

    @Override
    public Optional<User> findById(UUID id) {
        return repo.findById(id).map(this::toDomain);   // Entity -> domain
    }
}
```

**Say this in the interview:**
> *"The port is defined by the consumer. `application` declares what it needs;
> `infrastructure` supplies it. That's what inverts the dependency — otherwise
> your business logic imports Hibernate and the layering is decorative."*

---

## Why the domain model is not the entity

```java
// application/domain/User.java — a record. Immutable, no annotations, no
// framework. This is what the business logic reasons about.
public record User(UUID id, String username, String email,
                   String passwordHash, Set<String> roles) { }
```

```java
// infrastructure/entity/UserEntity.java — a table row. Mutable (JPA needs
// setters + a no-arg ctor), annotated, with lazy collections and an identity
// lifecycle.
@Entity @Table(name = "users")
@Getter @Setter @NoArgsConstructor
public class UserEntity { ... }
```

*"Isn't that duplication?"* — the standard objection, and the answer is that
they change for **different reasons**:

| | `UserEntity` | `User` |
|---|---|---|
| Changes when | the schema changes | the business rules change |
| Mutable | yes (JPA requires it) | no |
| Lifecycle | managed/detached; lazy loading | none, it's a value |
| Leaks | `LazyInitializationException` outside a transaction | nothing |

Return entities from services and you get: `LazyInitializationException` in the
controller, the password hash serialised into JSON because someone added a
field, and every schema rename rippling into your business code.

**Where to be honest:** for a CRUD service with no real domain rules, this
mapping is pure cost. Say so — knowing when *not* to apply a pattern is what
separates it from cargo-culting.

---

## The payoff, concretely

**1. Unit tests need no Spring at all.**

```java
// From the actual test suite — hand-written fakes, not Mockito.
class AuthServiceTest {
    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(              // just a constructor call
                new InMemoryUserStore(),        // implements UserStore
                new InMemoryRefreshTokenStore(),
                new BCryptPasswordHasher(),
                new FakeTokenIssuer(),
                props);
    }
    // Runs in milliseconds. No context, no @SpringBootTest, no database.
}
```

A fake beats a mock here: `InMemoryUserStore` actually *enforces* the uniqueness
rules, so a test proves behaviour rather than "these methods were called in this
order". Mockito tests tend to assert your implementation back at you.

**2. Swapping an adapter is a one-file change.**

`MinioAvatarStorage` → `S3AvatarStorage`: implement `AvatarStorage`, delete the
old bean. `UserService` doesn't change, and neither do its tests.

**3. It's exactly why scaling `chat` is a small change.**

`EventGateway` is a port. Today `WebSocketEventGateway` writes to a local map,
which is why chat can't run more than one replica (see
`06-full-stack-cluster/stack/06-chat.yaml`). Adding a `RedisEventGateway` that
publishes to pub/sub makes it horizontally scalable — and `ChatService` doesn't
change at all.

**That last one is the best version of this answer**, because it's an
architecture decision paying off in a deployment problem.

---

## The naming difference between `session` and `chat`

Both are hexagonal; they name things differently, and the interviewer may notice.

```
session/                              chat/
  application/                          application/
    domain/                               domain/chat/, domain/event/
    port/           <- flat               port/persistence/, port/socket/
    service/                              service/
  infrastructure/                       infrastructure/
    persistence/    <- adapters           adapter/persistence/, adapter/socket/
    controllers/                          controller/
```

`chat` groups ports by the *kind* of thing on the other side (persistence vs
socket), which scales better once you have more than a handful. `session` is
flat, which is fine at six ports. Neither is wrong — but be able to say **"the
inconsistency is real; `chat` is the newer convention"** rather than pretending
it was planned.

---

## ⚠️ `.gitignore` bites this structure

The repo's `.gitignore` contains a bare `service/` line intended for a
top-level module. Git patterns without a leading slash match **at any depth**,
so `application/service/` gets ignored too — silently.

```gitignore
service/     # ❌ matches application/service/ in every module
/service/    # ✅ anchored to the repo root only
```

This is a genuinely good "tell me about a debugging session" story: the code
compiles locally, and the class is simply absent from the clone.
`git check-ignore -v <path>` tells you which rule did it.

---

## When NOT to do this

Worth volunteering — it shows judgment rather than dogma:

- **A CRUD service with no domain rules.** Controller → repository is fine. The
  port and the mapper are ceremony around `findById`.
- **A short-lived service.** The payoff is in year two.
- **A team that won't hold the line.** One `@Autowired UserRepository` in a
  service and the boundary is gone. It's a discipline, and it needs enforcement
  — ArchUnit can make it a failing test:

```java
@Test
void application_layer_must_not_depend_on_infrastructure() {
    noClasses().that().resideInAPackage("..application..")
        .should().dependOnClassesThat().resideInAPackage("..infrastructure..")
        .check(new ClassFileImporter().importPackages("com.claudiordese.session"));
}
```

---

## 🧠 Hooks

- **The port is owned by the code that uses it**, not the code that implements it.
- **If the port looks like `JpaRepository`, you've renamed your ORM.**
- **Entity ≠ domain model.** They change for different reasons.
- **If you need Spring to unit test business logic, the boundary leaked.**
- **The real payoff shows up at deploy time** — `EventGateway` is why scaling chat is one new adapter.
