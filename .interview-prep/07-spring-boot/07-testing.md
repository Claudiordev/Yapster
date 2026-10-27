# 07 — Testing

What this repo actually does: fakes for unit tests, Testcontainers for
integration tests.

---

## The pyramid, with costs attached

```
        ╱╲        few    IT / E2E        @SpringBootTest + Testcontainers
       ╱  ╲              seconds each, real Postgres, real HTTP
      ╱────╲
     ╱      ╲     some   SLICE           @WebMvcTest, @DataJpaTest
    ╱        ╲           ~1s, one layer, rest mocked
   ╱──────────╲
  ╱            ╲  many   UNIT            plain JUnit, no Spring at all
 ╱──────────────╲        ~1ms, business logic only
```

**The rule:** if a test needs a Spring context to check a business rule, the
architecture leaked. `AuthServiceTest` runs with `new AuthService(...)` — no
context, no database — and that's a direct consequence of the ports in
`application/`.

---

## Unit tests: fakes, not mocks

```java
class AuthServiceTest {

    private AuthService service;
    private InMemoryUserStore users;

    @BeforeEach
    void setUp() {
        users = new InMemoryUserStore();          // a real implementation
        service = new AuthService(                // ...just a constructor
                users,
                new InMemoryRefreshTokenStore(),
                new BCryptPasswordHasher(),
                new FakeTokenIssuer(),
                jwtProperties);
    }

    @Test
    void register_rejects_duplicate_username() {
        service.registerUser(new RegisterCommand("claudio", "a@b.c", "pw", "a@b.c"));

        assertThatThrownBy(() ->
                service.registerUser(new RegisterCommand("claudio", "x@y.z", "pw", "x@y.z")))
            .isInstanceOf(UsernameTaken.class);
    }
}
```

**Fake vs mock — a real distinction, and a good interview answer:**

```java
// FAKE: a working implementation with a shortcut (a HashMap instead of a DB).
//       It ENFORCES the rules, so the test proves behaviour.
class InMemoryUserStore implements UserStore {
    private final Map<UUID, User> byId = new HashMap<>();
    public boolean existsByUsername(String u) {
        return byId.values().stream().anyMatch(x -> x.username().equals(u));
    }
}

// MOCK: you script the answers.
when(userStore.existsByUsername("claudio")).thenReturn(true);
verify(userStore).create(any(), any(), any());
// ⚠️ This asserts your implementation back at you. Refactor AuthService to
// call findByUsername() instead of existsByUsername() — same behaviour,
// same outcome — and the test fails. That's a test coupled to internals.
```

Mocks are still right for things you can't run: a Twilio client, a payment
gateway, anything non-deterministic or with real side effects.

```java
@ExtendWith(MockitoExtension.class)     // JUnit 5. (@RunWith is JUnit 4.)
class SomethingTest {
    @Mock  SmsSender sender;            // a mock
    @InjectMocks CommsService service;  // constructor-injected with the mocks
}
```

---

## Integration tests: Testcontainers

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
class AuthFlowIT {

    // `static` so ONE container is shared by every test in the class.
    // Non-static = a fresh container per test method = a very slow suite.
    @Container
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16")
                    .withDatabaseName("test");

    @Container
    static GenericContainer<?> redis =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    // The container's port is RANDOM (to avoid collisions), so it can't be in
    // application.properties. @DynamicPropertySource injects it before the
    // context starts.
    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",      postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
        r.add("spring.data.redis.host",     redis::getHost);
        r.add("spring.data.redis.port",     () -> redis.getMappedPort(6379));
        //                                     ^ suppliers, evaluated lazily
        //                                       AFTER the container starts
    }

    @Test
    void register_then_login_then_refresh() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("""
                            {"username":"claudio","email":"a@b.c",
                             "confirmEmail":"a@b.c","password":"password1"}"""))
               .andExpect(status().isCreated());
    }
}
```

**Why not H2?** Because you'd be testing against a different database than you
ship. H2 doesn't have Postgres's `jsonb`, its `ON CONFLICT`, its exact
constraint-violation SQLStates, or its locking behaviour — and Flyway migrations
written in Postgres SQL often won't even run. A test suite that passes on H2 and
fails on Postgres has negative value.

**This also validates the Flyway migrations on every run**, which is worth
saying: `ddl-auto=validate` means the app won't start unless the migrations
produce exactly the schema the entities expect. The integration test proves that
before a deploy does.

---

## Slice tests

```java
// Web layer only. No database, no services — fast.
@WebMvcTest(UsersController.class)
class UsersControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean UserService userService;   // (was @MockBean, deprecated in 3.4)

    @Test
    void returns_404_when_missing() throws Exception {
        when(userService.byId(any())).thenThrow(new NotFoundException("not_found", "no"));
        mockMvc.perform(get("/api/v1/user/{id}", UUID.randomUUID()))
               .andExpect(status().isNotFound())
               .andExpect(jsonPath("$.code").value("not_found"));
    }
}
// ⚠️ @WebMvcTest does NOT load your SecurityFilterChain by default in the way
// you'd expect — add @Import(Security.class) or use
// @AutoConfigureMockMvc(addFilters = false) deliberately. Silently testing
// with security disabled is a common trap.
```

```java
// JPA layer only, with a real database via Testcontainers.
@DataJpaTest
@AutoConfigureTestDatabase(replace = NONE)   // ⚠️ WITHOUT THIS, Boot swaps in
class UserRepositoryTest { ... }             // an embedded H2 and you're back
                                             // to testing the wrong database.
// @DataJpaTest wraps each test in a transaction and ROLLS BACK afterwards —
// which is fast and isolated, but means you never see what a real commit does
// (constraint checks deferred to commit, triggers, etc.).
```

---

## Running the ITs here (Docker 29 / WSL)

This repo's integration tests need a running Docker daemon. Three things that
have bitten this setup before:

```bash
# 1. Docker 29 advertises an API version Testcontainers' client may not know.
#    Pin it:
export DOCKER_HOST=unix:///var/run/docker.sock
echo "api.version=1.44" >> ~/.testcontainers.properties

# 2. Ryuk (the cleanup sidecar) can fail under Docker Desktop + WSL:
echo "ryuk.disabled=true" >> ~/.testcontainers.properties
#    Trade-off: containers are no longer auto-reaped — clean up with
#    `docker ps -a | grep testcontainers`.

# 3. Shared modules must be installed first, or the reactor can't resolve them:
./mvnw -q -pl common-utils -am install -DskipTests
./mvnw -pl session test -Dtest=AuthFlowIT
```

---

## Test naming and structure

```java
@Test
void register_rejects_duplicate_username() { ... }
// method_condition_expectedResult. Reads as a sentence in the failure report,
// which is when you actually read it.

@Test
void login_returns_tokens() {
    // GIVEN — arrange
    users.save(existingUser);
    // WHEN  — the single action under test
    LoginResult result = service.login(new LoginCommand("claudio", "password1"));
    // THEN  — assert
    assertThat(result.accessToken()).isNotBlank();
}
```

**One behaviour per test.** A test asserting five things fails on the first and
hides the other four.

---

## What's worth testing in this codebase

| Layer | Test with | Assert |
|---|---|---|
| `AuthService`, `UserService` | plain JUnit + fakes | business rules: duplicate username, email mismatch, wrong password, token rotation |
| `JpaUserStore` | `@DataJpaTest` + Testcontainers | the entity↔domain mapping, and that derived queries do what their name says |
| `CachingUserStore` | plain JUnit + a counting fake | that a second `findById` doesn't hit the delegate, and `update` evicts |
| Controllers | `@WebMvcTest` | status codes, JSON shape, validation rejections |
| Auth flow | `@SpringBootTest` + Testcontainers | register → login → refresh end to end, against real Postgres |
| Flyway | any Testcontainers test | that migrations apply and match the entities |

---

## 🧠 Hooks

- **If a business-rule test needs a Spring context, the boundary leaked.**
- **Fakes assert behaviour; mocks assert your implementation.**
- **`static @Container`** — one container per class, not per method.
- **`@DynamicPropertySource`** because container ports are random.
- **Never H2 when you ship Postgres.**
- **`@DataJpaTest` silently swaps in an embedded DB** unless you set `replace = NONE`.
- **Testcontainers ITs also prove your Flyway migrations match your entities.**
