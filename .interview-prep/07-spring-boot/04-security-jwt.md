# 04 — Spring Security & JWT

How auth actually works in this repo: `session` issues tokens, `common-utils`
validates them, every other service gets that for free via auto-configuration.

---

## The filter chain

Spring Security is **a chain of servlet filters** that runs *before* your
`DispatcherServlet`. Nothing about it is magic; the order is the whole design.

```
request
  │
  ▼
SecurityFilterChain
  ├─ CorsFilter
  ├─ CsrfFilter                     (disabled here — stateless JWT API)
  ├─ JwtFilter                ◄──── OURS. common-utils/filters/JwtFilter.java
  │    validate the Bearer token, build an Authentication,
  │    put it in the SecurityContext
  ├─ UsernamePasswordAuthenticationFilter   (form login — unused)
  ├─ AnonymousAuthenticationFilter
  ├─ ExceptionTranslationFilter     catches AccessDeniedException -> 401/403
  └─ AuthorizationFilter            enforces .authorizeHttpRequests(...)
  │
  ▼
DispatcherServlet -> your @RestController
```

**The two consequences worth saying out loud:**

1. **`@ControllerAdvice` cannot catch a security failure.** The filter rejects
   the request before any controller is involved, so your nice
   `ProblemDetail` body isn't produced — you get Spring's default 403. Fixing
   that needs an `AuthenticationEntryPoint` / `AccessDeniedHandler`, not an
   exception handler.
2. **Filter order is everything.** `JwtFilter` must run *before*
   `AuthorizationFilter`, or the context is empty when authorization is checked
   and every authenticated request 401s.

```java
@Bean
SecurityFilterChain chain(HttpSecurity http, JwtFilter jwtFilter) throws Exception {
    return http
        // CSRF protects COOKIE-based auth from cross-site form posts. With a
        // Bearer token in a header, the attack doesn't apply: a cross-site
        // request can't read the token to attach it. Disabling it here is
        // correct — disabling it on a cookie-session app is a vulnerability.
        .csrf(csrf -> csrf.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        //  ^ no HttpSession, no JSESSIONID. Required for horizontal scaling:
        //    any pod can serve any request because there is no server state.
        .authorizeHttpRequests(a -> a
            .requestMatchers("/api/v1/auth/**").permitAll()
            .requestMatchers("/actuator/health/**").permitAll()
            .requestMatchers("/ws").permitAll()      // socket authenticates at handshake
            .anyRequest().authenticated())           // ⚠️ ALWAYS end with this.
            //  Rules match TOP-DOWN, first match wins. A `permitAll()` above a
            //  narrower rule silently opens everything below it.
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
}
```

---

## Issuing a token — `session`

```java
// application/port/TokenIssuer.java — the port. No JWT library in sight.
public interface TokenIssuer {
    IssuedToken issue(User user, Duration ttl);
}

// infrastructure/security/JwtTokenIssuer.java — the adapter, where jjwt lives.
@Component
public class JwtTokenIssuer implements TokenIssuer {
    @Override
    public IssuedToken issue(User user, Duration ttl) {
        Instant now = Instant.now();
        String jwt = Jwts.builder()
                .subject(user.id().toString())      // `sub` — WHO
                .claim("username", user.username())
                .claim("roles", user.roles())       // authorization data
                .issuedAt(Date.from(now))           // `iat`
                .expiration(Date.from(now.plus(ttl)))  // `exp` — the ONLY thing
                                                       // limiting a leaked token
                .signWith(key)                      // HMAC-SHA256
                .compact();
        return new IssuedToken(jwt, ttl.toSeconds());
    }
}
```

**A JWT is `base64(header).base64(payload).signature`.**
It is **signed, not encrypted** — anyone can read the payload with
`jwt.io` or `base64 -d`. Never put anything secret in a claim.

---

## Access + refresh: why two tokens

```java
// AuthService.login()
IssuedToken  access  = tokens.issue(user, accessTtl());          // 15 minutes
RefreshToken refresh = refreshTokens.issueFor(user.username(), refreshTtl());  // days
```

| | Access token | Refresh token |
|---|---|---|
| Lifetime | 15 min | days/weeks |
| Where checked | signature only, **no DB hit** | looked up in the DB |
| Revocable | ❌ not until it expires | ✅ delete the row |
| Sent | on every request | only to `/auth/refresh` |

> **The whole point:** a JWT is stateless, which is why it scales — and also why
> it **cannot be revoked**. You can't un-issue one. So you keep its lifetime
> short and put the revocable, stateful part in a refresh token that lives in
> Postgres. Logout deletes the refresh row; the access token still works for up
> to 15 minutes, and that's the accepted trade-off.

**Refresh rotation** (what `AuthService.refreshAccessToken` does): every refresh
issues a *new* refresh token and invalidates the old one. If a stolen token is
replayed after the legitimate client already rotated, the reuse is detectable —
and the correct response is to revoke the whole family.

---

## Validating a token — `common-utils`, shared by every service

```java
// filters/JwtFilter.java
// OncePerRequestFilter, because a plain Filter can run multiple times per
// request (forwards, error dispatches) and you'd re-authenticate each time.
public class JwtFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ... {
        String header = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = validator.parse(header.substring(7));
                var auth = new UsernamePasswordAuthenticationToken(
                        claims.getSubject(), null, toAuthorities(claims));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtException e) {
                // Do NOT throw. Leave the context empty and let
                // AuthorizationFilter produce the 401. Throwing from a filter
                // bypasses the security error handling entirely.
            }
        }
        chain.doFilter(req, res);   // ⚠️ forgetting this line hangs the request
    }
}
```

**`SecurityContextHolder` is a `ThreadLocal`.** Two consequences:

```java
// (1) It does not propagate to another thread. @Async, a CompletableFuture,
//     or a parallel stream all lose the authentication.
//     Fix: SecurityContextHolder.setStrategyName(MODE_INHERITABLETHREADLOCAL),
//     or DelegatingSecurityContextExecutor.
// (2) It must be CLEARED after the request, or a pooled thread serves the next
//     request with the previous user's identity. The framework's
//     SecurityContextPersistenceFilter does this — which is a good reason not
//     to hand-roll the chain.
```

---

## The shared secret across services

```properties
# session signs.  chat, comms, voice VALIDATE with the same key.
security.jwt.secret=${SECURITY_JWT_SECRET}
```

HS256 is **symmetric**: one key both signs and verifies. So every service that
validates a token can also *forge* one. That's acceptable inside one trust
boundary and it's why the Kubernetes manifests mount the same Secret into
`session` and `chat`.

**The upgrade, and the right answer to "how would you improve this?":**
switch to **RS256** (asymmetric). `session` holds the private key and signs;
everyone else holds only the public key and can verify but not forge. Publish
it at a JWKS endpoint and key rotation becomes a non-event.

⚠️ HS256 requires a key of at least 256 bits — a short secret throws
`WeakKeyException` at startup.

---

## Method security

```java
@Configuration
@EnableMethodSecurity        // enables @PreAuthorize/@PostAuthorize
public class MethodSecurityConfig {}
```

```java
@PreAuthorize("hasRole('ADMIN')")
// ⚠️ hasRole('ADMIN') checks the authority "ROLE_ADMIN" — the prefix is added
// for you. hasAuthority('ADMIN') checks "ADMIN" exactly. Mixing them up means
// a rule that never matches and an endpoint that always 403s.

@PreAuthorize("#userId == authentication.name")   // SpEL over the arguments
public UserResponse profile(@PathVariable UUID userId) { ... }

@PostAuthorize("returnObject.ownerId == authentication.name")
// Runs AFTER the method. So the work is done and the transaction may have
// committed before access is denied — never use it on something with side
// effects.
```

**Same proxy caveat as `@Transactional`:** a self-invoked `@PreAuthorize` method
is not checked.

---

## WebSocket authentication — the one that's genuinely different

A browser's `WebSocket` API **cannot set headers**. There is no way to send
`Authorization: Bearer …` on the handshake. So the usual filter doesn't apply,
and `/ws` is `permitAll()` at the HTTP layer with authentication happening
inside the handshake instead:

```java
// infrastructure/socket/JwtHandshakeInterceptor.java
public class JwtHandshakeInterceptor implements HandshakeInterceptor {
    @Override
    public boolean beforeHandshake(ServerHttpRequest req, ServerHttpResponse res,
                                   WebSocketHandler h, Map<String, Object> attrs) {
        String token = queryParam(req, "token");
        Claims claims = validator.parse(token);   // throws -> reject
        attrs.put("userId", claims.getSubject()); // -> WebSocketSession attributes,
        return true;                              //    available for the whole
    }                                             //    connection lifetime
}
```

**The trade-off to state:** a token in a query string leaks into access logs,
proxy logs, and `Referer` headers. The alternatives are a short-lived
single-use ticket fetched over HTTPS first (best), or authenticating in the
first message frame after connecting.

**And the point that matters most:** the token is checked **once, at
handshake**. A connection open for six hours is not re-validated when the token
expires. If you need that, you send a periodic auth frame or close on expiry —
otherwise "logged out" users keep receiving messages.

---

## 🧠 Hooks

- **Security is a filter chain that runs before your controllers** — so `@ControllerAdvice` can't catch a 401.
- **A JWT is signed, not encrypted.** Anyone can read the claims.
- **Stateless means unrevocable** — that's why refresh tokens are stateful and short access TTLs exist.
- **`hasRole('X')` checks `ROLE_X`.**
- **`SecurityContextHolder` is a ThreadLocal** — it doesn't cross threads.
- **HS256 = every validator can also forge.** RS256 fixes that.
- **WebSockets can't send headers** — authenticate at handshake, and know it's never re-checked.
