# 06 — Plan: replace `session` login with Keycloak (Google + normal users)

**Goal:** Keycloak does login, registration, Google sign-in, token issuing and refresh.
`session` keeps only what is *app data*: profile (bio, avatar), roles/permissions, servers.

**Not in scope:** changing chat/voice/trading business logic, LiveKit, payments.

---

## 1. Today (what gets replaced)

| Concern | Where it lives now | After |
|---|---|---|
| Password login | `AuthController.login` → `AuthService.login`, `BCryptPasswordHasher` | Keycloak login page |
| Register | `AuthController.registerUser` → `AuthService.registerUser` (+ `RegisterRateLimitPolicy`) | Keycloak self-registration |
| Google sign-in | `AuthController.loginWithGoogle` → `GoogleAuthService`, `GoogleOAuthClient`, `GoogleIdTokenValidator` | Keycloak **Google identity provider** |
| Token issuing (RS256, `sub`=user UUID, `roles` claim) | `JwtTokenIssuer` + `keys/private.pem` | Keycloak signs; keys rotate, served as JWKS |
| Refresh + rotation + reuse detection | `AuthService.refreshAccessToken`, `RefreshTokenStore`, `refresh_tokens` table | Keycloak refresh-token rotation |
| Logout | `AuthService.logout` (revoke refresh token) | Keycloak logout endpoint |
| Login rate limit | `LoginRateLimitPolicy` + Redis guard | Keycloak **brute-force detection** |
| Link/unlink Google in settings | `UserProvidersController`, `user_providers` table | Keycloak federated identities (account console / `kc_action`) |
| Token validation in every service | `common-utils`: `JwtFilter` + `JwtValidator` (local `public.pem`) | Spring `oauth2-resource-server` + JWKS |
| WebSocket auth (`?token=`) | `chat`: `JwtHandshakeInterceptor` → `JwtValidator` | same handshake, `JwtDecoder` instead |
| Gateway rate-limit key | `router`: `ChatRateLimitConfiguration` loads `public.pem` | `ReactiveJwtDecoder` (JWKS) |
| Web: cookies + verify | `web/lib/auth.ts`, `web/middleware.ts` (`jose` + `JWT_PUBLIC_KEY`), `/api/auth/*` routes | same cookies, verify with remote JWKS, routes talk to Keycloak |

**What stays in `session`:** `users` profile row, `roles`/`user_roles`/`role_permissions`,
`UserService`, avatars (MinIO), servers, feature flags, the internal-secret endpoints.

---

## 2. Target

```
Browser ──► web (Next.js = BFF, holds httpOnly cookies)
              │  Auth Code + PKCE (+ client secret: BFF is a confidential client)
              ▼
          Keycloak (realm inarow) ──► Google (identity provider)
              │ access token (RS256, JWKS)
              ▼
Browser/BFF ─Bearer─► router (gateway) ─► session / chat / voice   (all resource servers)
                                            └ WebSocket: ?token= → JwtDecoder at handshake
session ──(service account, client credentials)──► Keycloak Admin API   (role sync, rename)
```

---

## 3. Key decisions (recommended answer first)

**D1 — Keep `sub` = existing user UUID.**
Import every user into Keycloak **with the same `id`** as `users.id`. Then `sub` is unchanged,
so `AuthenticationUtils.currentUserId` (`UUID.fromString(authentication.getName())`), the
chat handshake (`getUsername` → `sub`), and every foreign key keep working with **zero code
change**. (Keycloak's import accepts an explicit `id`; confirm in the lab.)

**D2 — Keep the claim name `roles`.**
Add a mapper that flattens realm roles into a top-level `roles` claim
(`User Realm Role` mapper, claim name `roles`, multivalued, access token on). Then
`JwtSecurityProperties.rolesClaim="roles"` and the `ROLE_` prefix still match. Role names
copy the current ones (`USER`, `ADMIN`, `MODERATOR`, `PREMIUM`, `PREMIUM_PLUS`).

**D3 — Who owns roles?** Recommended: **session DB stays the source of truth** (it has
permissions per role + realtime `RolesSync` in web); on every role change `session` mirrors
it to Keycloak with the Admin API, and the web refreshes the token (it already does a soft
refresh). Alternative: Keycloak owns roles outright (simpler, but permissions per role and
the admin UI in-app would have to move). Decide before phase 3.

**D4 — Login UI.** Recommended: redirect to the Keycloak page, themed to match the app
(no password ever touches our code). Do **not** keep custom forms with the password
(ROPC) grant: it is deprecated.

**D5 — `web` client = confidential + PKCE.** The Next.js server does the code exchange (like
`/api/auth/google/callback` today), so it can hold a client secret; PKCE on top. Tokens still
go into httpOnly cookies, so the rest of the web app barely changes. (The lab's `inarow-web`
is public; switch it to confidential + secret in the real realm.)

**D6 — Username.** Today usernames are editable (`User.withUsername`). Recommended: Keycloak
login = **email or username**, "edit username" off; `users.username` stays the editable
display handle in `session`, Keycloak username is only the login id.

---

## 4. Phases — each one ships alone and can be rolled back

### Phase 0 — Keycloak in the stack
- Add a `keycloak` + `keycloak_postgres` block to `docker-compose.yaml` (start from
  `lab/docker-compose.yaml`; **Postgres, fixed `KC_HOSTNAME`, not `start-dev`** in non-local).
- Realm `inarow` as code: `inarow-realm.json` (roles, `web` client, mappers from D2, token
  lifespans below). Review it in PRs.
- Match today's lifetimes: access **15 min** (`JWT_ACCESS_EXPIRATION_MS=900000`), refresh/SSO
  **30 days**, **Revoke Refresh Token ON, max reuse 0** (= rotation + reuse detection like
  `refreshAccessToken`).
- Realm login settings: registration ON, verify email ON (needs SMTP), forgot password ON,
  brute-force detection ON.
- Add Google IdP (`lab/setup-google.sh`, redirect URI `.../realms/inarow/broker/google/endpoint`).
- ✅ Check: log in as a test user in the admin console; `/.well-known/openid-configuration` works.

### Phase 1 — Services accept both old and new tokens
Safe cutover needs a window where both token kinds are valid.
- `common-utils`: add `spring-boot-starter-oauth2-resource-server`; a `JwtDecoder` that tries
  the **Keycloak JWKS** first, then the **legacy `public.pem`**. Map `roles` claim → `ROLE_*`
  (same as `JwtFilter.extractRoles`). Keep `publicPaths` / `authenticatedPaths` / `denyAll`
  semantics from `JwtSecurityAutoConfiguration`.
- Keep the `ProblemDetail` `AuthenticationEntryPoint` / `AccessDeniedHandler` as they are.
- `chat`: `JwtHandshakeInterceptor` uses the same decoder.
- `router`: `ChatRateLimitConfiguration` uses a reactive decoder.
- ✅ Check: old tokens still work; a Keycloak-issued token for a test user works on `/api/v1/user/me`.

### Phase 2 — Migrate users into Keycloak
Script (one-off, idempotent) reads `users`, `user_roles`, `user_providers` and writes a
Keycloak import / Admin API payload:

| From | To in Keycloak |
|---|---|
| `users.id` | user `id` (D1) |
| `users.username`, `email` | `username`, `email`, `emailVerified` (true for Google-created users) |
| `user_roles` | realm role mappings |
| `user_providers` (`provider=google`, `subject`) | `federatedIdentities: [{identityProvider:"google", userId:<subject>, userName:<email>}]` → existing Google users are recognised, no re-link |
| `users.password` (BCrypt) | **see below** |

**Passwords:** Keycloak has no built-in BCrypt. Choose one:
1. **BCrypt provider jar** in `providers/` and import hashes as `bcrypt` credentials
   (cheapest; users notice nothing). Verify the jar supports the Keycloak version in use.
2. **Forced reset:** import with no credential + "update password" required action, email everyone.
3. **Lazy migration:** a User Storage SPI that checks the old `users.password` on first login, then stores a Keycloak hash.
- Recommended: **1**, falling back to **2** if the jar is a problem. Google-only users have
  `password = null`, nothing to migrate.
- ✅ Check: pick 3 users (password, Google, both): log in, `sub` equals old `users.id`, roles right.

### Phase 3 — Profile provisioning + role sync in `session`
- **Just-in-time provisioning:** a small filter/service in `session`: if a valid token's `sub`
  has no `users` row, create one (username from `preferred_username`, email from `email`,
  default `USER` role). Covers brand-new Keycloak registrations and Google first logins.
  (Keycloak `sub` = new user's id, so the row id = `sub`.)
- **Role sync (D3):** `KeycloakAdminClient` port + adapter (hexagonal, like `GoogleIdentityClient`)
  using a **service account** (client credentials, `manage-users` + `view-realm`/role mapping
  only). Called from role-change use cases in `UserService`. Also on username change (D6).
- Delete on user deletion.
- ✅ Check: change a user's role in-app → new token contains it after refresh.

### Phase 4 — Web switches to Keycloak
Same cookies (`AUTH_COOKIE_NAME`, `REFRESH_COOKIE_NAME`), different source.
- `GET /api/auth/login`: build the authorize URL (PKCE `code_verifier` in a short-lived
  cookie, `state`, `nonce`); optional `kc_idp_hint=google` for the **Google button**
  (`SocialLogin.tsx`). Same page for "normal" login (no hint).
- `GET /api/auth/callback` (replaces `api/auth/google/callback/route.ts`): check `state`,
  POST the code + `code_verifier` + client secret to Keycloak `/token`, `setAuthCookies`.
- `POST /api/auth/refresh`: refresh against Keycloak `/token` (`refresh_token` grant).
  Keep the single-flight in `refreshAccessToken`.
- `POST /api/auth/logout`: Keycloak end-session endpoint + clear cookies.
- `lib/auth.ts` and `middleware.ts`: replace `importSPKI(JWT_PUBLIC_KEY)` with
  `createRemoteJWKSet(new URL(".../protocol/openid-connect/certs"))` and check `iss`.
  Drop the `JWT_PUBLIC_KEY` env.
- Delete `lib/googleAuth.ts` (code exchange now in Keycloak).
- ✅ Check: register a new user, normal login, Google login, refresh after 15 min, logout.

### Phase 5 — Remove the old code from `session`
Only after a soak period (suggest 1–2 weeks, with a metric that no legacy tokens are used):
- Delete: `AuthController` (login/register/refresh/logout/google), `AuthService`,
  `GoogleAuthService`, `GoogleOAuthClient`, `GoogleIdTokenValidator`, `GoogleAuthConfig/Properties`,
  `JwtTokenIssuer`, `BCryptPasswordHasher`, `RefreshToken*`, login/register rate-limit policies,
  `keys/private.pem`.
- Keep: `UserService`, `UserController(s)`, `InternalUserController` + internal-secret interceptor.
- Flyway (new migrations, **not** edits to old ones): drop `refresh_tokens`, drop
  `users.password`, drop `user_providers` (last, after Phase 2 data is verified).
- `UserProvidersController` (link/unlink): replace by a settings link to the Keycloak account
  console, or `kc_action=idp_link` flow if the Keycloak version supports it.
- `common-utils`: remove the legacy-key branch + `public.pem`; remove `JwtValidator`.
- Remove `GOOGLE_*` env from `session` in `docker-compose.yaml` (now only Keycloak holds them).

---

## 5. Test plan

| Layer | How |
|---|---|
| Slice tests | `SecurityMockMvcRequestPostProcessors.jwt()` with `roles` claim, no Keycloak |
| Integration | Testcontainers Keycloak (`dasniko/testcontainers-keycloak`) importing `inarow-realm.json`; real token → `/me` |
| Migration script | run against a copy of the DB, compare counts + 3 sample logins |
| E2E | Playwright: register, login, Google (use a stubbed IdP or a test Google account), refresh, logout |

(Testcontainers on this machine: see the Docker 29 note in memory — pin `api.version=1.44`, disable Ryuk.)

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| `iss` mismatch (browser sees `localhost`, services see `keycloak:8180`) | one fixed `KC_HOSTNAME`; services use the same issuer URL |
| BCrypt hashes can't be imported | provider jar, else forced reset |
| Revoked/banned user keeps a valid access token up to 15 min | keep TTL short; deny-list by `sub` in Redis for bans; back-channel logout |
| Role change not visible until refresh | web already soft-refreshes (`RolesSync`); trigger it after sync |
| Keycloak is a new single point of failure | Postgres-backed, 2 nodes in prod, health + Prometheus metrics (`KC_METRICS_ENABLED`) |
| Login rate-limit regression (register had its own limit) | Keycloak brute-force for login; rate-limit `/realms/inarow/login-actions/*` at the proxy |
| Users with the same email on a password and a Google account | `first broker login` **link** step + Trust Email ON for Google (see `03-google-login.md`) |
| Admin/service-account secret leak | least-privilege role, secret from env/Secrets Manager, never in the repo |

## 7. Rollback

Phases 0–4 are additive: the old endpoints and legacy-key validation are still in place.
Roll back by pointing `web` at the old routes (revert Phase 4) — tokens issued by `session`
still validate. Phase 5 is the point of no return; do it last, with a DB backup.

## 8. Open questions (need your call)

1. D3: roles owned by `session` DB (recommended) or by Keycloak?
2. Passwords: BCrypt provider jar, or forced reset?
3. Is SMTP available for verification / reset emails (needed for "verify email")?
4. Keycloak behind the gateway (`/auth/**`) or on its own subdomain? (own subdomain is simpler.)

🧠 **Hook:** *Keep `sub` and `roles` identical, run old + new tokens side by side, then delete the old login last.*
