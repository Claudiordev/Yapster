# 04 — Spring Boot + Keycloak (resource server)

**No Keycloak adapter** — it's deprecated. Use plain Spring Security OAuth2.

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
```

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          # Spring fetches {issuer}/.well-known/openid-configuration -> JWKS, caches keys
          issuer-uri: http://localhost:8180/realms/inarow
```

```java
@Configuration
@EnableMethodSecurity                          // turns on @PreAuthorize (a PROXY — beware self-invocation)
class SecurityConfig {

    @Bean
    SecurityFilterChain chain(HttpSecurity http) throws Exception {
        return http
            .csrf(c -> c.disable())            // stateless bearer API
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(j -> j
                .jwtAuthenticationConverter(keycloakRoles())))
            .build();
    }

    // Spring reads `scope` by default (-> SCOPE_x). Keycloak puts roles elsewhere,
    // so map realm_access.roles -> ROLE_x ourselves.
    private Converter<Jwt, AbstractAuthenticationToken> keycloakRoles() {
        return jwt -> {
            Map<String, Object> realm = jwt.getClaim("realm_access");
            Collection<String> roles = realm == null
                ? List.of() : (Collection<String>) realm.get("roles");
            var authorities = roles.stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
            return new JwtAuthenticationToken(jwt, authorities, jwt.getClaimAsString("preferred_username"));
        };
    }
}

@RestController
class MeController {
    @GetMapping("/me")
    Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {   // validated token injected
        return Map.of("sub", jwt.getSubject(), "email", jwt.getClaimAsString("email"));
    }

    @PreAuthorize("hasRole('admin')")
    @DeleteMapping("/servers/{id}")
    void delete(@PathVariable UUID id) { /* only realm role admin */ }
}
```

## Fit with THIS repo's gateway

```
web ──(Bearer)──► router (Spring Cloud Gateway) ──► session / chat / voice
                    │ validates JWT once (resource server)
                    └ forwards Authorization header (TokenRelay) — each service
                      still validates (defense in depth)
```

- `common-utils` auto-config: swap `JwtFilter` for the resource-server setup;
  every service still gets it by classpath.
- **WebSocket (chat):** browsers can't set headers on `new WebSocket()` →
  send the token as a query param / first message, validate on handshake.
- **Service → service:** client credentials grant (service account).

## Frontend (Next.js) options

| Option | Notes |
|---|---|
| `keycloak-js` | SPA does PKCE itself; token in memory |
| `next-auth` Keycloak provider | server-side session cookie (**BFF**, safer) |

## Testing

Testcontainers has `dasniko/testcontainers-keycloak`: boots Keycloak, imports
the realm JSON, you request a real token. See `07-spring-boot/07-testing.md`.
For slice tests use `SecurityMockMvcRequestPostProcessors.jwt()` — no Keycloak.

🧠 **Hook:** *`issuer-uri` + converter for roles. Spring does the rest.*
