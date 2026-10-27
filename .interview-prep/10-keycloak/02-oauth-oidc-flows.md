# 02 — OAuth2 / OIDC flows

**OAuth2 = authorization** (access to an API). **OIDC = authentication on top**
(adds the `id_token` + `/userinfo`: *who* the user is).

## OAuth 2.0 vs OIDC

- **OAuth 2.0** answers: *can this app access this API on the user's behalf?* (authorization)
- **OIDC** adds: *who is the user that just logged in?* (authentication)

```
OAuth 2.0 only:   login → access_token
OIDC:             login → access_token + id_token     (because scope included "openid")
                                           ▲
                                  "this user is demo@inarow.dev"
```
Hotel analogy: OAuth 2.0 = the **key card** (opens doors, doesn't care who you are).
OIDC = the **name on the reservation**.

| Added by OIDC | What it is |
|---|---|
| **ID token** | JWT saying who logged in (`sub`, `email`, `name`) |
| **`openid` scope** | The magic word in `scope=openid ...` that turns OIDC on |
| **`/userinfo`** | Returns the user's profile using the access token |
| **Standard claims** | `email`, `name`, `preferred_username`... |
| **Discovery** | `/.well-known/openid-configuration` |

### Which claim comes from where

| Claim | Defined by | Notes |
|---|---|---|
| `iss`, `sub`, `aud`, `exp`, `iat` | **JWT spec** (RFC 7519) | OIDC *requires* them in the ID token |
| `email`, `name`, `given_name`, `preferred_username` | **OIDC** (standard claims) | agreed names + meaning |
| `scope`, `realm_access`, `resource_access` | OAuth / **Keycloak-specific** | not OIDC standard claims |

They only appear if the app asked for them:
```
scope=openid               → ID token with sub
scope=openid email         → + email, email_verified     (client scope "email" mappers)
scope=openid profile       → + name, given_name, family_name, preferred_username
```
OIDC names the claims; Keycloak's **mappers** fill them. Keycloak also puts `sub` and the
profile claims in the **access token** (what `jwt.getSubject()` reads). That's a Keycloak
convention: per spec they belong in the ID token, and plain OAuth 2.0 says nothing about
what an access token contains.

🧠 **Hook:** *JWT spec gives `sub` and `exp`. OIDC gives `email` and `name`. Keycloak's mappers fill them in.*

## Authorization Code + PKCE (browser/SPA — the one to know cold)

This **is** the OAuth 2.0 *Authorization Code grant* (RFC 6749) plus the PKCE
extension (RFC 7636). It is also **the** flow of **OAuth 2.1** (an IETF draft that
consolidates 2.0 + best practices): 2.1 keeps only Auth Code, makes PKCE
mandatory for every client, and drops implicit + password grants.
> Interview line: *"Auth Code + PKCE, the OAuth 2.1 recommended flow — and it
> already works on OAuth 2.0 servers like Keycloak via RFC 7636."*

```
3 steps:
1. Browser → Keycloak, user logs in
2. Keycloak redirects back with a one-time, short-lived CODE   (not a token)
3. App POSTs the code to /token → gets the tokens              (direct call, not in the URL)
```
The point: **tokens never travel in the URL** (history, logs, referrer headers).
Only the throwaway code does, and PKCE makes a stolen code useless.

```
 Browser(web)            Keycloak                    API (session)
    │ 1. /auth?response_type=code&client_id=inarow-web
    │     &code_challenge=SHA256(verifier)&code_challenge_method=S256
    │──────────────────────►│
    │ 2. login form / Google│
    │◄──────────────────────│ 3. redirect_uri?code=abc
    │ 4. POST /token  code + code_verifier
    │──────────────────────►│
    │◄── access_token + id_token + refresh_token
    │ 5. GET /api  Authorization: Bearer <access_token>
    │───────────────────────────────────────────────►│ 6. verify sig via JWKS
```

```java
// PKCE in two lines — why it exists:
String verifier  = randomUrlSafe(64);                 // kept in the browser, never sent in step 1
String challenge = base64Url(sha256(verifier));       // sent in step 1
// An attacker who steals the `code` can't redeem it: they lack the verifier.
```

### What PKCE adds vs plain Auth Code

```
Plain Auth Code (original OAuth 2.0)        Auth Code + PKCE
────────────────────────────────────        ────────────────────────────────────
1. /auth?client_id=...                      1. /auth?client_id=...
                                                  + code_challenge=H(v)        ← added
2. user logs in                             2. user logs in
3. redirect ?code=ABC                       3. redirect ?code=ABC   (bound to H(v))
4. POST /token                              4. POST /token
     code=ABC                                    code=ABC
     client_secret=XYZ   ← proves the app        code_verifier=v   ← proves same starter
```
Only **step 4** differs: a static secret vs a one-time verifier. SPA/mobile can't
hide a secret, so PKCE replaces it.

```
Confidential backend (classic):  POST /token  code + client_id + client_secret
Public SPA/mobile (PKCE):        POST /token  code + client_id + code_verifier
```
- Backends can use **both** (current guidance / OAuth 2.1): the secret proves *which app*
  redeems, PKCE proves *the same one that started*. Keycloak can require PKCE on confidential clients.
- Here: `inarow-web` = public → PKCE, no secret. A backend calling Keycloak itself =
  confidential → `client_secret` (client credentials has no code and no PKCE: no user).

### Step by step: what Keycloak stores

```
1. App → Keycloak   /auth?...&code_challenge=H(v)
                    Keycloak remembers the challenge for this login attempt
                    and shows the login page (or Google).
2. User logs in.
3. Keycloak → App   redirect_uri?code=ABC
                    Keycloak links the code to the challenge: { ABC → H(v) }
4. App → Keycloak   POST /token  code=ABC + code_verifier=v
                    Keycloak computes sha256(v) and compares it with the stored H(v).
                    Match → access + id + refresh tokens. The code is then burned (one use).
```
- The **challenge** (hash) goes in step 1; the **verifier** (original random string) only in step 4.
- PKCE doesn't identify the app (any SPA can make a challenge). It proves
  **whoever redeems the code is who started this login**.
- It doesn't stop XSS: malicious JS can read the verifier from memory.

Never use the **implicit flow** or **password (ROPC) grant** — deprecated/removed
in OAuth 2.1.

## The three tokens

| Token | Audience | Contains | Lifetime |
|---|---|---|---|
| **access_token** | the API | roles, scopes | short (5 min default) |
| **id_token** | the client app | who logged in | short |
| **refresh_token** | Keycloak only | to get new access tokens | long (30 min idle) |

OIDC adds the **id_token** next to the OAuth2 access token, so "two JWTs" is really up to
three tokens. The token response:

```json
{
  "access_token":  "eyJ...",   // for calling APIs
  "id_token":      "eyJ...",   // for the client: who logged in
  "refresh_token": "eyJ...",   // for getting new tokens
  "token_type":    "Bearer",
  "expires_in":    300
}
```
The `id_token` only appears when the request had `scope=openid`.

| | ID token | Access token |
|---|---|---|
| Standard | OIDC | OAuth2 |
| Format | always a JWT | JWT or opaque (provider's choice) |
| `aud` | your client app | the API (resource server) |
| Who reads it | the client app, once, to learn who logged in | the API, which validates it |
| Send to the API? | **No** | **Yes**, as `Authorization: Bearer` |

- Keycloak makes all three JWTs, and the access token also carries roles (`realm_access`),
  so it looks like the ID token. They still have different `aud` values and purposes.
- If the access token is opaque or the ID token is slim, call `/userinfo` with the access
  token to get the profile claims.
- The Spring resource server validates the **access token**, never the ID token.

🧠 **Hook:** *the ID token says who you are to the app, the access token says what you may do to the API.*

## Other grants

| Grant | Use |
|---|---|
| **Client credentials** | service → service (no user). Enable "Service accounts". |
| **Refresh token** | silent renewal; can **rotate** (revoke reuse) |
| **Token exchange** | swap a token for another audience / impersonate |
| **Device code** | TVs / CLI |

## How an API validates (no call to Keycloak per request)

```java
// 1. fetch public keys ONCE (cached):  GET {issuer}/protocol/openid-connect/certs   (JWKS)
// 2. verify RS256 signature using the key whose `kid` matches the token header
// 3. check iss, exp, (aud)
// => stateless. Cost: a revoked token stays valid until it expires -> keep it short.
```

### JWKS (JSON Web Key Set)

The public web page where Keycloak publishes its **public keys**, so any API can check a
token's signature.

```
Keycloak:  private key 🔑 (secret, signs tokens)
           public key  🔓 (published at the JWKS URL)
Your API:  downloads the public key once, caches it, checks every token's signature
           with it. No call to Keycloak per request.
```
- **URL:** `{issuer}/protocol/openid-connect/certs` (discovery's `jwks_uri` points to it).
- **Why a "set":** several keys listed at once so Keycloak can **rotate** keys; the `kid` in the token header says which key to use. Spring re-fetches when it sees an unknown `kid`.
- **JWT signing uses a key pair, not certificates.** RS256 = private key signs, public key verifies (HS256 = one shared secret, only holders can verify).
  A certificate is a public key + a CA's stamp saying who owns it: it protects the HTTPS connection to Keycloak, the token check only needs the public key.
- **In Spring:** `issuer-uri` is enough; Spring finds the JWKS through discovery.

🧠 **Hook:** *Private key signs, JWKS publishes the public key, the API verifies.*

### Discovery (`/.well-known/openid-configuration`)

A standard URL returning a JSON file that lists every endpoint and capability of the
identity provider. Give it the base address (issuer) and it tells you every other URL.

`http://localhost:8180/realms/inarow/.well-known/openid-configuration`
```json
{
  "issuer": "http://localhost:8180/realms/inarow",
  "authorization_endpoint": ".../protocol/openid-connect/auth",
  "token_endpoint":         ".../protocol/openid-connect/token",
  "userinfo_endpoint":      ".../protocol/openid-connect/userinfo",
  "jwks_uri":               ".../protocol/openid-connect/certs",
  "end_session_endpoint":   ".../protocol/openid-connect/logout",
  "scopes_supported":       ["openid", "profile", "email", "roles", "..."],
  "grant_types_supported":  ["authorization_code", "refresh_token", "client_credentials", "..."]
}
```
- Without it every app hard-codes each URL, and they differ per provider (Keycloak, Google, Auth0).
- `.well-known` = a fixed folder where standard metadata lives.
- **Used by Spring:** `issuer-uri` → fetches discovery → finds `jwks_uri` → downloads keys → checks `iss`.
  Google has one too (`accounts.google.com/.well-known/openid-configuration`), which is how Keycloak's Google IdP knows Google's endpoints.

🧠 **Hook:** *Discovery is the server's phone book.*

| Endpoint | Path under `/realms/inarow/protocol/openid-connect/` |
|---|---|
| authorize | `auth` |
| token | `token` |
| userinfo | `userinfo` |
| keys | `certs` |
| logout | `logout` |
| introspect | `token/introspect` (opaque tokens / revocation checks) |

## Common traps

- **`redirect_uri` must match exactly** (wildcards only at the end, avoid in prod).
- **Web origins** (CORS) is a separate setting from redirect URIs.
- **`iss` mismatch**: the API sees `http://keycloak:8080/...`, the browser sees
  `http://localhost:8180/...` → token rejected. Fix with a fixed `KC_HOSTNAME`.
- Don't put the access token in `localStorage` (XSS). Prefer BFF / httpOnly cookie.

🧠 **Hook:** *Code + PKCE: trade a one-time code for tokens, prove it's you with the verifier. API trusts the signature, not a phone call.*
