# 01 — The Annotation Catalog

Every annotation in this codebase. What it *actually* does, and where it bites.

> **The one mental model that explains half of these:** most Spring annotations
> work by putting a **proxy** around your bean. The proxy intercepts calls from
> *outside*. A call from one method of a class to another method of the same
> class never leaves the object, so it never touches the proxy — and the
> annotation silently does nothing. `@Transactional`, `@Cacheable`, `@Async`,
> `@PreAuthorize` all share this failure mode.

---

## 0. The proxy rule: the call must go from one bean to another

The annotation only fires when the call **crosses a bean boundary**: the caller
holds the *proxy* of another Spring bean. A call on `this` stays inside the real
object and skips the proxy.

```
caller bean ──► [ PROXY ] ──► real object
                   │
                   └─ runs the annotation logic: open tx / check cache / hop thread / check role
```

```java
// ❌ Same class: this.load() never touches the proxy -> NO cache
@Service
class UserService {
    public UserDto profile(Long id) { return load(id); }

    @Cacheable("users")
    public UserDto load(Long id) { ... }
}

// ✅ Annotated method lives on ANOTHER bean; the caller gets it injected (= the proxy)
@Service
class UserReader {
    @Cacheable("users")
    public UserDto load(Long id) { ... }
}

@Service
class UserService {
    private final UserReader reader;                       // injected = the PROXY
    UserDto profile(Long id) { return reader.load(id); }   // crosses the proxy -> cached
}
```

The same shape for the other three:

```java
@Service class Mailer {
    @Async                                          // needs @EnableAsync
    public CompletableFuture<Void> send(String to) { ... }
}

@Service class AdminOps {
    @PreAuthorize("hasRole('ADMIN')")               // needs @EnableMethodSecurity
    public void deleteUser(Long id) { ... }
}

@RestController class AdminController {
    private final AdminOps ops;
    private final Mailer mailer;

    @DeleteMapping("/users/{id}")
    void delete(@PathVariable Long id) {
        ops.deleteUser(id);        // role checked
        mailer.send("x@y.com");    // runs on another thread
    }
}
```

### `@Async` in detail: it needs `@EnableAsync` and an executor

`@Async` hands the method to an **executor** (a thread pool) so it runs on
another thread. No `@EnableAsync` means no proxy and no async. The executor is
the pool that does the work. If you don't define one, Boot 3.x uses
`applicationTaskExecutor`: **8 core threads and an unbounded queue**. It never
rejects work, so slow tasks just pile up in memory behind each other. Tune it
with `spring.task.execution.pool.*` or define your own. Defining one `Executor`
bean replaces the default, so plain `@Async` uses it; the name in
`@Async("mailExecutor")` only matters when you have several executors.

```java
@Configuration
@EnableAsync                                  // 1. turns the proxy on
class AsyncConfig {
    @Bean
    Executor mailExecutor() {                 // 2. the thread pool that runs the work
        var ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(4);
        ex.setMaxPoolSize(8);
        ex.setQueueCapacity(100);
        ex.setThreadNamePrefix("mail-");
        return ex;
    }
}

@Service
class Mailer {
    @Async("mailExecutor")                    // 3. pick the pool by bean name
    public CompletableFuture<Void> sendWelcome(String to) { ... }
}
```

Same-class call: still works, but synchronous, on the caller's thread, with no error.

```java
@Async public void a()                         { }   // fire and forget
@Async public CompletableFuture<String> b()    { }   // caller can .join / .thenApply
@Async public String c()                       { }   // caller gets null
```

**What to do with the `CompletableFuture`.** It returns immediately: it's a
handle to a result that isn't ready yet, not an HTTP response.

```java
// 1. React when it finishes (non-blocking, the usual choice)
mailer.sendWelcome(email)
      .thenRun(() -> log.info("sent"))
      .exceptionally(ex -> { log.error("failed", ex); return null; });
// also: thenAccept (use the value), thenApply (transform), whenComplete (both)

// 2. Wait for it (blocks this thread)
String receipt = mailer.sendReceipt(u).join();

// 3. Wait for several that ran in parallel
CompletableFuture.allOf(a, b).join();

// 4. Return it from a controller: the HTTP caller waits for the response,
//    but no request thread is blocked while the work runs
@GetMapping("/report")
CompletableFuture<ReportDto> report() {
    return reports.build();      // Spring MVC completes the response when the future completes
}

// 5. Ignore it (fire and forget): failures are only logged, so handle them
//    inside the async method or with an AsyncUncaughtExceptionHandler
```

Because it runs on another thread:
- **Exceptions** from a `void` method are only logged. Return `CompletableFuture`, or set an `AsyncUncaughtExceptionHandler`.
- **Transactions** don't carry over. Trigger it after commit with `@TransactionalEventListener(phase = AFTER_COMMIT)`.
- **Security context and MDC** (trace ids) are thread-local and are lost. Wrap the executor with `DelegatingSecurityContextAsyncTaskExecutor`.
- With virtual threads on (`spring.threads.virtual.enabled=true`), Boot swaps the default executor for a virtual-thread one. `@EnableAsync` and the bean-to-bean rule still apply.

**What is MDC?** The Mapped Diagnostic Context is a small `Map<String,String>`
that your logging library (SLF4J/Logback) keeps **per thread**. You put values
in once, and every log line on that thread can print them automatically.

```java
MDC.put("traceId", "abc123");            // e.g. in a filter, once per request
log.info("saving user");                 // pattern: %d %X{traceId} %msg
                                         // -> 12:01:03 abc123 saving user
MDC.clear();                             // pool threads are reused, always clear
```

It's backed by a `ThreadLocal`, so a new thread starts with a blank map and the
`traceId` is lost inside `@Async`. Copy it across with a `TaskDecorator`:

```java
ex.setTaskDecorator(task -> {
    Map<String, String> ctx = MDC.getCopyOfContextMap();   // caller thread
    return () -> {
        try { if (ctx != null) MDC.setContextMap(ctx); task.run(); }   // worker thread
        finally { MDC.clear(); }
    };
});
```

Security has the same problem and the same fix:
`DelegatingSecurityContextAsyncTaskExecutor` copies the `SecurityContext`.

**Other ways the annotation silently does nothing:**

| Cause | Why |
|---|---|
| Caller and annotated method are in the **same bean** | The call never crosses the proxy (the main rule above) |
| Method is `private`, `final` or `static` | The proxy can't override it |
| Object made with `new` | It isn't a bean, so it has no proxy |
| Missing `@EnableAsync`, `@EnableCaching` or `@EnableMethodSecurity` | No proxy is created at all |
| `@Async` method returns something other than `void` or `Future` | The caller gets `null` instead of the result |

**If you must stay in one class** (all worse than extracting a bean):
1. Inject yourself: `@Lazy private UserService self;` then `self.load(id)`.
2. `AopContext.currentProxy()`, which needs `@EnableAspectJAutoProxy(exposeProxy = true)`.
3. AspectJ weaving (`mode = ASPECTJ`), which changes the bytecode so there is no proxy to skip.

Interview answer: **extract the annotated method into another bean.** It's also
cleaner design: the cache or security concern gets its own class (see
`05-caching-redis.md`).

---

## 1. Bootstrapping

```java
// ONE annotation that is really three:
//   @Configuration        - this class can define @Bean methods
//   @EnableAutoConfiguration - scan the classpath and configure what it finds
//   @ComponentScan        - find @Component/@Service/@Repository BELOW this package
@SpringBootApplication
public class SessionApplication {
    public static void main(String[] args) {
        SpringApplication.run(SessionApplication.class, args);
    }
}
// ⚠️ @ComponentScan starts at THIS class's package and goes DOWN.
// com.claudiordese.session.* is scanned. com.claudiordese.exceptions
// (in common-utils) is NOT — it's a sibling, not a child.
// So how does GlobalExceptionControllerAdvice get registered in every service?
// Not by component scan. By AUTO-CONFIGURATION — see section 9.
```

**Interview:** *"How does auto-configuration work?"*
Boot reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
from every jar, then applies each class only if its `@Conditional`s pass —
`@ConditionalOnClass`, `@ConditionalOnMissingBean`, `@ConditionalOnProperty`.
That's why adding a dependency configures itself, and why *your* bean always
wins: the auto-config is `@ConditionalOnMissingBean`.

---

## 2. Stereotypes — which one, and does it matter?

```java
@Component      // generic managed bean
@Service        // a @Component. Semantically: business logic
@Repository     // a @Component + TRANSLATES persistence exceptions
@Configuration  // a @Component whose @Bean methods are proxied (see below)
@RestController // @Controller + @ResponseBody
```

Only two of those are functionally different:

```java
// @Repository is NOT just documentation. It adds an exception-translation
// post-processor: vendor exceptions (Hibernate's ConstraintViolationException,
// Postgres SQLState 23505) become Spring's DataAccessException hierarchy.
// That's what keeps your service layer free of JDBC-vendor imports.
@Repository
public interface UserRepository extends JpaRepository<UserEntity, UUID> { }

// @Configuration defaults to proxyBeanMethods=true. Spring generates a CGLIB
// SUBCLASS of this class and intercepts calls to @Bean methods.
@Configuration
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        System.out.println("creating DataSource");
        return new HikariDataSource();
    }

    // Both of these CALL dataSource() instead of taking it as a parameter.
    // That's an "inter-bean call", and its behaviour depends entirely on
    // whether the class is proxied:
    @Bean public FooService foo() { return new FooService(dataSource()); }
    @Bean public BarService bar() { return new BarService(dataSource()); }
}

// proxyBeanMethods = TRUE (default) -> "creating DataSource" prints ONCE.
//   The proxy sees dataSource(), notices the container already holds that
//   singleton, and returns it. foo and bar share one pool. Correct.
//
// proxyBeanMethods = FALSE ("lite") -> it prints THREE TIMES.
//   No proxy, so dataSource() is a plain Java call that runs the body again.
//   You now have THREE Hikari pools: the one Spring registered, plus two
//   private ones it knows nothing about.
//   Worse: those two never go through bean post-processing, so nothing on
//   them works — no @Transactional, no @Cacheable, no @PostConstruct.
//
// ⚠️ @Bean methods on a plain @Component are ALSO lite mode. Same trap.
```

**The fix, and why it's the recommended style:** take the dependency as a
**method parameter** instead of calling the method. Spring injects the
container's singleton, so it behaves identically in both modes and you never
have to know which one you're in.

```java
@Bean
public FooService foo(DataSource dataSource) {   // ✅ mode-independent
    return new FooService(dataSource);
}
```

`proxyBeanMethods = false` exists for startup speed and AOT/native-image
support — Spring Boot's own auto-configurations use it almost everywhere,
precisely because they're written to never make inter-bean calls.

> This project's `CacheConfig` already does the right thing: one `@Bean` method
> taking `RedisConnectionFactory` and `ObjectMapper` as parameters, no
> inter-bean calls. `proxyBeanMethods` is irrelevant to it.


In this repo `AuthService` and `UserService` are `@Service`; `JpaUserStore`,
`CachingUserStore`, `JwtTokenIssuer`, `MinioAvatarStorage` are `@Component`.
That's the convention: **use-case classes are `@Service`, adapters are
`@Component`.**

---

## 3. Dependency injection

```java
// CONSTRUCTOR INJECTION. The only kind you should write.
@Service
public class AuthService {
    private final UserStore users;          // final => immutable, never null
    private final TokenIssuer tokens;

    // No @Autowired needed: since Spring 4.3 a single constructor is used
    // automatically.
    public AuthService(UserStore users, TokenIssuer tokens) {
        this.users = users;
        this.tokens = tokens;
    }
}
```

**Why constructor and not field injection** — the answer that shows depth:

```java
@Autowired private UserStore users;   // ❌ don't
// 1. can't be `final` -> the object is mutable and can exist half-built
// 2. can't construct it in a plain unit test — you need reflection or Spring
// 3. hides that the class has 9 dependencies; a 9-arg constructor SHOWS you
//    the class does too much. Field injection lets a God class stay comfortable.
// 4. circular dependencies fail at STARTUP with constructor injection
//    (loud, immediate) instead of resolving silently into a half-initialised
//    bean you discover at runtime.
```

```java
@RequiredArgsConstructor   // Lombok: generates a ctor for all `final` fields
public class ChatService {
    private final MessageStore messages;    // ...so you get constructor
    private final EventGateway events;      // injection with no boilerplate
}
```

**`@Primary` — used deliberately in this codebase:**

```java
// Two beans implement UserStore: JpaUserStore and CachingUserStore.
// Without @Primary, injecting `UserStore` is ambiguous and startup FAILS.
@Primary @Component
public class CachingUserStore implements UserStore {

    // ⚠️ Inject the CONCRETE JpaUserStore, not the UserStore interface —
    // the interface resolves to this @Primary bean, i.e. itself. Infinite
    // recursion, or a startup failure if Spring catches the cycle.
    public CachingUserStore(JpaUserStore delegate) { this.delegate = delegate; }
}
```

`@Qualifier("name")` is the alternative when there's no sensible default.

---

## 4. Configuration & properties

```java
// TYPE-SAFE config. Preferred over @Value for anything with >1 property.
@ConfigurationProperties(prefix = "minio")
public record MinioProperties(
        String endpoint,      // minio.endpoint
        String accessKey,     // minio.access-key   <- RELAXED BINDING:
        String secretKey,     //   kebab-case, camelCase, UPPER_SNAKE env var
        String bucket,        //   all bind to the same field
        String publicUrl
) {}

@Configuration
@EnableConfigurationProperties(MinioProperties.class)  // registers it as a bean
public class MinioConfig {
    @Bean
    MinioClient minioClient(MinioProperties props) { ... }
}
```

```java
// @Value: fine for ONE value. No validation, no IDE completion, no grouping.
@Value("${url.api.base-path}")
private String basePath;

@Value("${security.jwt.access-expiration-ms:900000}")  // :default after the colon
private long accessTtl;
```

**Conditional beans — this is how `COMMS_PROVIDER=stub` works:**

```java
// comms.provider=twilio (the default) -> the real sender
@Component
@ConditionalOnProperty(name = "comms.provider", havingValue = "twilio",
                       matchIfMissing = true)
class TwilioSmsSender implements SmsSender { ... }

// comms.provider=stub -> logs instead of sending. Load-test 10,000 messages
// without a 10,000-message invoice.
@Component
@ConditionalOnProperty(name = "comms.provider", havingValue = "stub")
class StubSmsSender implements SmsSender {
    public void send(String to, String body) { log.info("STUB sms -> {}", to); }
}

// In a library: define a default the app can override just by declaring its own.
@Bean
@ConditionalOnMissingBean          // "only if the user didn't provide one"
JwtValidator jwtValidator(JwtSecurityProperties props) { ... }
```

**Profiles:**

```java
@Profile("!prod")     // everything except prod
@Component
class DevDataSeeder { ... }
// Activated by SPRING_PROFILES_ACTIVE. In Kubernetes that's a ConfigMap key.
```

---

## 5. Web layer

```java
@RestController                       // = @Controller + @ResponseBody
@RequestMapping("${url.api.base-path}/user")   // properties resolve here too
@Validated                            // enables validation on @PathVariable /
public class UsersController {        // @RequestParam (method-level params).
                                      // @Valid on a @RequestBody works WITHOUT
                                      // this; the two are commonly confused.
    private final UserService users;

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    @Operation(summary = "Fetch a user")                      // OpenAPI docs
    @ApiResponse(responseCode = "404", description = "No such user")
    public UserResponse byId(@PathVariable UUID id) {
        return UserResponse.from(users.byId(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)   // 201 instead of the default 200
    public RegisterResponse register(@Valid @RequestBody RegisterRequest body) {
        //                            ^^^^^ without @Valid the constraints on
        //                            RegisterRequest are simply NOT CHECKED.
        //                            Silently. This is the most common bug in
        //                            this whole layer.
        return RegisterResponse.from(users.register(body.toCommand()));
    }

    @GetMapping("/search")
    public List<UserResponse> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        //  ^ @Min/@Max on params need @Validated ON THE CLASS to fire.
        return users.search(q, page, size);
    }
}
```

**Validation constraints used here:**

```java
public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 32) String username,
        @NotBlank @Email                   String email,
        @NotBlank @Size(min = 8)           String password) {}
// @NotNull  - not null (but "" passes)
// @NotEmpty - not null, not empty  (" " passes)
// @NotBlank - not null, not empty, not whitespace   <- what you want for strings
```

**Error handling — one advice for the whole app:**

```java
@ControllerAdvice     // applies to every controller in the context
public class GlobalExceptionControllerAdvice {

    @ExceptionHandler(GlobalException.class)   // catches the whole hierarchy
    public ResponseEntity<ProblemDetail> handle(GlobalException e,
                                                HttpServletRequest req) {
        HttpStatus status = STATUS_MAPPING.entrySet().stream()
                .filter(en -> en.getKey().isAssignableFrom(e.getClass()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(HttpStatus.INTERNAL_SERVER_ERROR);
        // ProblemDetail = RFC 7807, built into Spring 6. A standard error body
        // (type/title/status/detail/instance) instead of a bespoke shape.
        return ResponseEntity.status(status)
                .body(ProblemDetails.of(status, e.getCode(), e.getMessage(),
                                        req.getRequestURI()));
    }
}
```

> **The design worth defending:** one exception class per HTTP status
> (`NotFoundException`, `ConflictException`, …), and the *specific* reason lives
> in the exception's `code` field. The alternative — a subclass per business
> error — gives you 60 exception classes and a 60-entry mapping table.

---

## 6. Persistence

```java
@Entity                       // a JPA-managed table row
@Table(name = "users")
@Getter @Setter               // Lombok. NOT @Data on an entity — see the trap
@NoArgsConstructor            // JPA REQUIRES a no-arg constructor. Non-negotiable.
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 32)
    private String username;

    @Enumerated(EnumType.STRING)   // ⚠️ ALWAYS STRING. EnumType.ORDINAL stores
    private Role role;             // the enum's INDEX — reorder the enum and
                                   // every existing row now means something else.

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    private Set<String> roles = new HashSet<>();
}
```

**⚠️ `@Data` on an entity is a real bug, not a style preference:**
it generates `equals`/`hashCode` over *all* fields — including the lazy
collection (touching it triggers a load, or `LazyInitializationException`) and
including `id`, which is null before persist. Put an entity in a `HashSet`
before saving and it becomes unfindable after the id is assigned, because its
hash changed. `@Getter @Setter` only.

```java
public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    // DERIVED QUERY: Spring Data parses the METHOD NAME into SQL. No body.
    Optional<UserEntity> findByUsername(String username);
    boolean existsByEmail(String email);

    // @EntityGraph: fetch the collection in the SAME query (a LEFT JOIN FETCH)
    // instead of a second one per row. This is the N+1 fix.
    @EntityGraph(attributePaths = {"roles"})
    Optional<UserEntity> findWithRolesById(UUID id);

    // @Query when the name would be unreadable. nativeQuery=true for real SQL.
    @Query("select u from UserEntity u where lower(u.username) like lower(concat('%', :q, '%'))")
    List<UserEntity> search(@Param("q") String q, Pageable pageable);
}
```

```java
// @Transactional — a PROXY. Read the traps.
@Service
public class AuthService {

    @Transactional
    public RegisterResult registerUser(RegisterCommand cmd) {
        if (users.existsByUsername(cmd.username()))
            throw new UsernameTaken("username_taken", "...");   // rolls back
        return new RegisterResult(users.create(...));
    }
}
```

**The four `@Transactional` traps, in the order they'll be asked:**

```java
// (1) SELF-INVOCATION. The call never leaves the object, so the proxy never
//     sees it, so there is NO TRANSACTION. Silent.
public void outer() { this.inner(); }     // ❌ inner()'s @Transactional is dead
@Transactional public void inner() { ... }

// (2) ROLLBACK RULES. Rolls back on RuntimeException and Error ONLY.
//     A CHECKED exception COMMITS by default.
@Transactional(rollbackFor = Exception.class)   // if you must throw checked

// (3) ONLY WORKS ON PUBLIC METHODS (with the default proxy mode).
//     private/protected @Transactional is silently ignored.

// (4) jakarta.transaction.Transactional vs
//     org.springframework.transaction.annotation.Transactional
//     Both work. Only the SPRING one supports `propagation`, `isolation`,
//     `readOnly`, `rollbackFor`. AuthService imports the jakarta one — fine
//     for plain use, but you can't tune it. Know which you imported.
```

```java
@Transactional(readOnly = true)
// Hibernate skips dirty checking and flushing; the JDBC driver can route to a
// read replica. Cheap win on every read path.
```

---

## 7. Caching

```java
@Configuration
@EnableCaching            // without this, @Cacheable does absolutely nothing
public class CacheConfig { ... }
```

```java
@Cacheable(value = "users", key = "#id", unless = "#result == null")
public Optional<User> findById(UUID id) { return delegate.findById(id); }
// - key is SpEL over the ARGUMENTS: #id, #user.id(), #root.methodName
// - `unless` is evaluated AFTER the call, on the RESULT
// - `condition` is evaluated BEFORE, on the arguments

// ⚠️ Spring UNWRAPS Optional before evaluating SpEL, so #result is the bare
// User (or null), never the Optional. That's why the guard is
// `#result == null` — `#result.isEmpty()` would call User.isEmpty().

@CacheEvict(value = "users", key = "#user.id()")
public User update(User user) { return delegate.update(user); }

@CachePut     // ALWAYS runs the method AND updates the cache. @Cacheable SKIPS
              // the method on a hit — that's the whole difference.
@CacheEvict(value = "users", allEntries = true)   // nuke the cache
```

Full discussion in `05-caching-redis.md`, including why the cache is a separate
decorator bean rather than annotations on `UserService`.

---

## 8. Security

```java
@Configuration
@EnableMethodSecurity    // turns on @PreAuthorize/@PostAuthorize.
public class MethodSecurityConfig {}
// (Replaces the deprecated @EnableGlobalMethodSecurity. `prePostEnabled=true`
//  is the default now.)

@PreAuthorize("hasRole('ADMIN')")                    // before the method
@PreAuthorize("#id == authentication.principal.id")  // SpEL over the args
@PostAuthorize("returnObject.ownerId == authentication.name")  // after
```

```java
@Configuration
public class Security {
    @Bean
    SecurityFilterChain chain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())   // stateless JWT API, no cookies
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/v1/auth/**").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    // BCrypt: deliberately slow + per-password salt built into the hash.
    // Never MD5/SHA — they're fast, which is exactly the wrong property here.
}
```

```properties
# This service issues its own tokens and has no user-details store, so Boot's
# default in-memory user (and the random password it logs at startup) is
# excluded outright.
spring.autoconfigure.exclude=\
  org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration
```

---

## 9. How `common-utils` configures every service — auto-configuration

This is the highest-value section for an interview, because most candidates have
only ever *consumed* auto-configuration.

```java
// common-utils/security/config/JwtSecurityAutoConfiguration.java
@AutoConfiguration                       // (not @Configuration — see below)
@EnableConfigurationProperties(JwtSecurityProperties.class)
@ConditionalOnClass(SecurityFilterChain.class)   // only if Spring Security is present
public class JwtSecurityAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean            // the app can always override it
    JwtValidator jwtValidator(JwtSecurityProperties props) {
        return new JwtValidator(props.secret());
    }

    @Bean
    @ConditionalOnMissingBean
    JwtFilter jwtFilter(JwtValidator validator, JwtSecurityProperties props) {
        return new JwtFilter(validator, props.authenticatedPaths());
    }
}
```

```
common-utils/src/main/resources/META-INF/spring/
    org.springframework.boot.autoconfigure.AutoConfiguration.imports
    └── com.claudiordese.security.config.JwtSecurityAutoConfiguration
```

**Why the imports file at all?** `@ComponentScan` only sees packages *below*
your `@SpringBootApplication`. `com.claudiordese.exceptions` and
`com.claudiordese.security` are siblings of `com.claudiordese.session`, so they
are never scanned. The imports file is how a library gets loaded without the
application knowing its package names.

```properties
# Each service then just declares its own paths — no Java, no config class:
security.jwt.authenticated-paths[0]=/api/v1/chat/**
security.jwt.additional-public-paths[0]=/ws
```

**⚠️ `@AutoConfiguration` vs `@Configuration`:** auto-configurations are applied
**last**, after all user beans, which is what makes `@ConditionalOnMissingBean`
meaningful. Register a library class as a plain `@Configuration` in the imports
file and the ordering guarantee is gone.

---

## 10. Lombok

```java
@Getter @Setter          // safe everywhere
@RequiredArgsConstructor // ctor for final fields -> constructor injection
@AllArgsConstructor @NoArgsConstructor
@Builder                 // for objects with many optional fields
@Slf4j                   // private static final Logger log = ...
@Data                    // @Getter+@Setter+@ToString+@EqualsAndHashCode+@RequiredArgs
```

**Where `@Data` is wrong:**
- **on `@Entity`** — see section 6. Real bug.
- **on anything with a lazy collection** — `toString()` triggers a load, or
  throws `LazyInitializationException` outside a transaction.
- **on a DTO** — a Java 21 `record` already gives you all of it, immutably.

---

## 11. Testing

```java
@ExtendWith(MockitoExtension.class)     // JUnit 5. NOT @RunWith (that's JUnit 4)
class AuthServiceTest {
    @Mock UserStore users;
    @InjectMocks AuthService service;
    @BeforeEach void setUp() { ... }
    @Test void rejects_bad_password() { ... }
}

@SpringBootTest                          // the FULL context. Slow. Use sparingly.
@AutoConfigureMockMvc
@Testcontainers                          // manages real Docker containers
class AuthFlowIT {
    @Container static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");
    @DynamicPropertySource                // inject the container's random port
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", pg::getJdbcUrl);
    }
}

// Slices — load only one layer:
@WebMvcTest(UsersController.class)   // web layer only, services @MockBean'd
@DataJpaTest                         // JPA + an in-memory/TC database only
```

Note this repo's `AuthServiceTest` uses **hand-written fakes**
(`InMemoryUserStore`, `InMemoryRefreshTokenStore`) rather than Mockito mocks —
which is the natural payoff of having ports. See `07-testing.md`.

---

## 🧠 Hooks

- **Most Spring annotations are proxies. Self-invocation bypasses them.** `@Transactional`, `@Cacheable`, `@Async`, `@PreAuthorize`. **The call must go from one bean to another.** No proxy, no magic.
- **`@Transactional` rolls back on RuntimeException only** — checked exceptions commit.
- **No `@Valid` = no validation.** Silent.
- **`@Data` on an `@Entity` is a bug**, not a style choice.
- **`@Enumerated(EnumType.STRING)`, always.**
- **`@ConditionalOnMissingBean` only works because auto-configs are applied last.**
- **`@Repository` translates exceptions; `@Service`/`@Component` are identical to Spring.**
