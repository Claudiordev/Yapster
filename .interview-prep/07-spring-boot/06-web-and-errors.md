# 06 — Web Layer, Errors, and the Gateway

Controllers, DTOs, validation, the exception design, and how `router` fits.

---

## The request path

```
client
  └─► router (Spring Cloud Gateway, WebFlux/Netty)
        rewrites /auth/**  ->  /api/v1/auth/**
        └─► session (Spring MVC / Tomcat)
              Filters (JwtFilter)
              └─► DispatcherServlet
                    └─► HandlerMapping   -> which @RequestMapping?
                          └─► ArgumentResolvers  (@RequestBody -> Jackson,
                          │                        @Valid -> validation)
                          └─► YOUR CONTROLLER METHOD
                          └─► HttpMessageConverter (object -> JSON)
```

Worth knowing: **`router` is reactive (Netty), `session` is servlet (Tomcat).**
`spring.main.web-application-type=reactive` in the gateway's properties is what
picks that. Mixing `spring-boot-starter-web` and `-webflux` in one service makes
Boot choose servlet and silently disable the reactive stack — a classic
"why isn't my gateway routing" bug.

---

## DTOs: three shapes, on purpose

```java
// REQUEST — what the client may send. Validated at the edge.
public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 32) String username,
        @NotBlank @Email                   String email,
        @NotBlank @Size(min = 8)           String password,
        @NotBlank                          String confirmEmail) {

    // Map to the application layer's own input type at the boundary.
    public RegisterCommand toCommand() {
        return new RegisterCommand(username, email, password, confirmEmail);
    }
}

// COMMAND — application/service/commands/. What the USE CASE needs. No
// annotations, no HTTP. This is the boundary crossing.
public record RegisterCommand(String username, String email,
                              String password, String confirmEmail) {
    public boolean emailsMatching() { return email.equals(confirmEmail); }
    //     ^ a rule that belongs to the domain, not to a controller
}

// RESPONSE — what you choose to expose. The gap between this and the domain
// User is the point: `passwordHash` cannot leak, because it isn't here.
public record RegisterResponse(String id, String username) {
    public static RegisterResponse from(RegisterResult r) { ... }
}
```

**"Why not return the entity/domain object?"**
Because then your API shape is your database shape: every column rename is a
breaking API change, every new field is published by accident, and lazy
collections serialise into `LazyInitializationException` mid-response (after the
200 status line is already sent, so the client sees truncated JSON).

---

## Validation

```java
@PostMapping
public RegisterResponse register(@Valid @RequestBody RegisterRequest body) { ... }
//                                ^^^^^^ WITHOUT THIS, NOTHING IS VALIDATED.
//                                Silently. The single most common bug here.
```

```java
@RestController
@Validated      // needed for constraints on METHOD PARAMETERS:
public class UsersController {
    @GetMapping("/search")
    public List<UserResponse> search(@RequestParam @Min(0) int page) { ... }
    //  @Min on a @RequestParam only fires with @Validated on the class.
    //  @Valid on a @RequestBody works WITHOUT it. Two different mechanisms
    //  with confusingly similar names.
}
```

Failure modes differ, which matters for the advice below:
- `@Valid` on a body → `MethodArgumentNotValidException` → 400
- `@Validated` on params → `ConstraintViolationException` → 500 **unless you
  handle it**

---

## The exception design

```java
// common-utils/exceptions/
GlobalException                     // the root
├── BadRequestException             → 400
├── UnauthorizedException           → 401
├── ForbiddenException              → 403
├── NotFoundException               → 404
├── ConflictException               → 409
├── TooManyRequestsException        → 429
└── ServiceUnavailableException     → 503
```

> **One exception class per HTTP status. The specific reason lives in the
> exception's `code` field, not in a subclass.**

```java
throw new ConflictException("username_taken", "Username is already in use");
//                           ^ machine-readable   ^ human-readable
```

The alternative — a class per business error — gives you sixty exception
classes and a sixty-entry mapping table that someone has to keep in sync. This
repo still carries the legacy specific ones (`UsernameTaken`,
`EmailTakenException`, …) for compatibility, and the advice maps them by
`isAssignableFrom`, so both styles work during the transition.

```java
@ControllerAdvice
public class GlobalExceptionControllerAdvice {

    private static final Map<Class<? extends Exception>, HttpStatus> STATUS_MAPPING =
        Map.ofEntries(
            Map.entry(BadRequestException.class,   HttpStatus.BAD_REQUEST),
            Map.entry(NotFoundException.class,     HttpStatus.NOT_FOUND),
            Map.entry(ConflictException.class,     HttpStatus.CONFLICT),
            ...);

    @ExceptionHandler(GlobalException.class)
    public ResponseEntity<ProblemDetail> handle(GlobalException e,
                                                HttpServletRequest req) {
        logger.warn("Error: {}, details: {}", e.getCode(), e.getMessage());
        HttpStatus status = STATUS_MAPPING.entrySet().stream()
                .filter(en -> en.getKey().isAssignableFrom(e.getClass()))
                //             ^ isAssignableFrom, so SUBCLASSES map too
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(HttpStatus.INTERNAL_SERVER_ERROR);
        return ResponseEntity.status(status)
                .body(ProblemDetails.of(status, e.getCode(), e.getMessage(),
                                        req.getRequestURI()));
    }
}
```

⚠️ **`Map.entry` ordering:** `Map.ofEntries` returns an *unordered* map, and the
stream takes `findFirst()`. If two mapped classes are in the same inheritance
chain, which one matches is **not deterministic**. Today's hierarchy is flat
under `GlobalException` so it's fine — but if you ever add
`class SpecificConflict extends ConflictException` to the map, this becomes a
real bug. Worth flagging as "here's something I'd change".

### ProblemDetail — RFC 7807

```java
// Built into Spring 6. A STANDARD error body instead of a bespoke shape:
{
  "type":     "about:blank",
  "title":    "Conflict",
  "status":   409,
  "detail":   "Username is already in use",
  "instance": "/api/v1/auth/register",
  "code":     "username_taken"        // our extension
}
```

Clients get one predictable error contract across every service, and you didn't
invent it.

### What `@ControllerAdvice` can and cannot catch

| Thrown | Caught? |
|---|---|
| From a controller or service | ✅ |
| From a `@Valid` failure | ✅ (`MethodArgumentNotValidException`) |
| **From a Security filter** | ❌ — the filter chain runs *before* the DispatcherServlet |
| **From another filter** | ❌ |
| From an async thread | ❌ unless the exception propagates back |

For the security cases you need an `AuthenticationEntryPoint` /
`AccessDeniedHandler`, and to get the same `ProblemDetail` shape you have to
write the JSON yourself. Knowing this boundary is a good answer.

---

## ETag: a version stamp on a response

An **ETag** (entity tag) is an HTTP response header holding an identifier for the
**current version** of a resource: a hash of the content, or a version number.
If the resource changes, the ETag changes. It's always quoted: `ETag: "a1b2c3"`.
A `W/` prefix (`W/"a1b2c3"`) marks a *weak* tag: "semantically the same", not
byte-for-byte.

```
// 1. CACHING: skip the download if nothing changed
GET /users/42                      ->  200 OK, ETag: "a1b2c3", body {...}   (client caches both)
GET /users/42
    If-None-Match: "a1b2c3"        ->  304 Not Modified, no body            (still current)
                                   or  200 OK, ETag: "d4e5f6", new body     (changed)

// 2. SAFE UPDATES: no lost updates (optimistic locking over HTTP)
PUT /users/42
    If-Match: "a1b2c3"             ->  412 Precondition Failed              (someone changed it first)
```

| Header | Sent by | Meaning |
|---|---|---|
| `ETag` | server | The version tag of this response |
| `If-None-Match` | client | "Send the body only if the tag differs" (reads, caching) |
| `If-Match` | client | "Apply this change only if the tag still matches" (writes) |

```java
// A. Automatic: hashes the response body and compares with If-None-Match.
//    The controller still runs, so you save bandwidth but not the work.
@Bean
FilterRegistrationBean<ShallowEtagHeaderFilter> etagFilter() {
    return new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
}

// B. Manual: use the @Version column as the ETag (see 03, optimistic locking).
@GetMapping("/users/{id}")
ResponseEntity<UserDto> get(@PathVariable UUID id) {
    UserDto dto = service.get(id);
    return ResponseEntity.ok().eTag("\"" + dto.version() + "\"").body(dto);
}
```

Rules:
- Use a **content hash** (SHA-256) or a version number, **not** Java's `hashCode()`.
  Equal hashes can still be a collision, which here would leave a client with stale data.
- Hash only what the client sees.
- It's the HTTP twin of `@Version`: same idea, same conflict, a 412 or 409 instead
  of an `OptimisticLockException`.

---

## OpenAPI

```java
@Tag(name = "Users", description = "User management")
@RestController
public class UsersController {

    @Operation(summary = "Fetch a user by id")
    @ApiResponse(responseCode = "200", description = "Found")
    @ApiResponse(responseCode = "404", description = "No such user")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/{id}")
    public UserResponse byId(@PathVariable UUID id) { ... }
}

// @Schema documents the DTO fields:
public record UserResponse(
        @Schema(example = "8f14e45f-...", description = "User id") String id,
        @Schema(example = "claudio")                        String username) {}

// @SecurityRequirements (plural, empty) marks an endpoint as PUBLIC —
// overriding a global requirement declared in OpenApiConfig.
@SecurityRequirements
@PostMapping("/login")
public LoginResponse login(@Valid @RequestBody LoginRequest body) { ... }
```

⚠️ Springdoc generates docs from **annotations and types**, not from the
security config. An endpoint can be documented as public and actually require
auth — the two are separate sources of truth and they drift.

---

## The gateway

```properties
spring.cloud.gateway.server.webflux.routes[0].id=session-auth
spring.cloud.gateway.server.webflux.routes[0].uri=lb://SESSION
spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/auth/**
spring.cloud.gateway.server.webflux.routes[0].filters[0]=RewritePath=/auth/?(.*),/api/v1/auth/$1
```

Three concepts:

- **Predicate** — does this route match? `Path=`, `Method=`, `Header=`, `Host=`,
  `After=`/`Before=` (time-based, handy for launches).
- **Filter** — transform the request/response. `RewritePath`, `SetPath`,
  `AddRequestHeader`, `CircuitBreaker`, `RequestRateLimiter`, `Retry`.
- **URI** — where it goes. `lb://SESSION` = look up "SESSION" in the service
  registry and load-balance client-side.

**`lb://` vs a plain URL** is the migration point: on Kubernetes, `lb://SESSION`
becomes `http://session:8081` because a Service already load-balances. See
`06-full-stack-cluster/stack/04-discovery.yaml` for the full argument.

```properties
# Why RewritePath and not SetPath: SetPath is a fixed template, RewritePath is
# a regex with capture groups, so one rule handles the whole subtree.
#   /auth/login    -> /api/v1/auth/login
#   /auth/refresh  -> /api/v1/auth/refresh
```

**Why the gateway is reactive:** it's I/O-bound — it mostly waits on downstream
services. A servlet stack parks one thread per in-flight request; Netty handles
thousands of concurrent connections on a handful of event-loop threads. That's
the right fit for a proxy, and the wrong fit for `session`, which does blocking
JDBC anyway.

⚠️ **Never block an event-loop thread.** One `Thread.sleep` or blocking JDBC
call inside a gateway filter stalls every request sharing that loop. This is
why you don't casually add "just one" blocking call to a WebFlux app.

---

## 🧠 Hooks

- **No `@Valid` = no validation.** Silent.
- **`@Valid` is for bodies; `@Validated` on the class is for parameters.**
- **Never return an entity from a controller.** Your API shape becomes your schema.
- **One exception per status; differentiate with a `code`.**
- **`@ControllerAdvice` cannot catch anything thrown in a filter.**
- **`lb://` is Eureka; on Kubernetes it becomes plain Service DNS.**
- **Gateway is reactive because it's I/O-bound — never block the event loop.**
- **ETag = a version stamp on a response.** `If-None-Match` skips the download (304); `If-Match` protects the update (412).
