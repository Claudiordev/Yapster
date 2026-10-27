# 15-minute Cram — Keycloak

> **Keycloak is an IdP. Apps redirect to it, get signed tokens, and verify the
> signature with its public keys. Nobody else touches passwords.**

## Vocabulary (one line each)
Realm=tenant · Client=app · Role=permission · Group=users set · Scope=claims bundle ·
Mapper=claim rule · IdP=Google etc. · Federation=LDAP

## OAuth 2.0 vs OIDC
OAuth 2.0 = authorization (key card). OIDC = authentication on top (name on the reservation): adds `id_token`, `openid` scope, `/userinfo`, standard claims.
`sub`/`exp` ← JWT spec · `email`/`name` ← OIDC · `scope`/`realm_access` ← OAuth/Keycloak · mappers fill them.

## JWKS + discovery
JWKS = public page with Keycloak's **public keys**; API caches them and verifies the signature locally (private key signs, public key verifies; certificates not needed for JWT).
Discovery = `/.well-known/openid-configuration`: JSON "phone book" of every endpoint incl. `jwks_uri`. Spring's `issuer-uri` uses it.

## The flow to draw  (= OAuth 2.0 **Authorization Code** grant + **PKCE**)
```
Browser → /auth (+PKCE challenge) → login / Google → ?code → POST /token (+verifier)
→ access+id+refresh → Bearer to API → API verifies via JWKS
```

## Plain Auth Code vs PKCE — only step 4 differs
```
Plain:  POST /token  code + client_secret=XYZ   ← proves the app (backend only)
PKCE :  POST /token  code + code_verifier=v     ← proves same starter (SPA/mobile safe)
Confidential backend: code + client_id + client_secret   |   Public SPA/mobile: code + client_id + code_verifier
(backends can use both)
        (step 1 adds code_challenge=H(v); step 3 binds the code to it)
```

## Google login in 5 lines
1. Google Cloud: OAuth client (Web), redirect `…/realms/inarow/broker/google/endpoint`
2. Keycloak: Identity providers → Google → id/secret
3. First login = auto-create user + federated link
4. `kc_idp_hint=google` skips the login page
5. Trust Email ON → safe auto-link

## Spring in 3 lines
`oauth2-resource-server` · `issuer-uri: …/realms/inarow` · converter maps `realm_access.roles` → `ROLE_*`

## The one sentence
**A client scope is a box of protocol mappers, and each mapper copies one piece of user data into a claim in the JWT.**
(Scope = box, mapper = copy rule, claim = where the data lands. Scope *names* go in the `scope` claim.)

## Client scope in 4 lines
Client scope = a named package of mappers ("what goes in the token"). Make once, attach to many clients.
Default = always applied · Optional = only if the app asks (`scope=openid email read`).
`email` package → email claims · `profile` → name claims · `roles` → realm_access.roles
Scope = what the app may ask for · Role = what the user may do.

## Protocol mapper in 2 lines
A copy instruction: take X from the user (email, roles, attribute) → put in the token as claim Y, in access/ID/userinfo.
Scope = the box, mapper = one item inside. No mappers = empty box.

## SPI
Service Provider Interface = a plug-in socket. Implement a Keycloak interface, drop the jar in `providers/`.
Use for: custom mapper, authenticator, event listener, user storage, theme. Only when built-ins can't.

## Admin REST API
`/admin/realms/{realm}/users` (POST create, PUT/DELETE `/{id}`, POST `/{id}/role-mappings/realm`). Backend calls it with a **service account** (client credentials, least privilege). It's *us → Keycloak*; Keycloak users reach our DB by JIT provisioning on first token.

## Numbers/defaults
Access token **5 min** · SSO idle **30 min** · port **8080** (lab uses 8180) · admin on `master` realm

## Traps to name
- Revocation lag (stateless JWT) · `iss` mismatch behind proxy · redirect URI exact match
- Never H2 in prod · don't use master realm · no implicit/ROPC · don't store tokens in localStorage
- Key your DB by **`sub`**, not email

## Your story
"I hand-rolled JWT + Google sign-in in `session`. Keycloak replaces issuing, refresh,
social login and brute-force protection; I keep my profile table keyed by `sub`."

🧠 **Hook:** *Bouncer (Keycloak) · wristband (JWT) · key (JWKS) · guest list (roles).*
