# Keycloak — Interview Questions

## Basics
**1. What is Keycloak?** Open-source IdP: SSO, OIDC/OAuth2/SAML, social login, MFA, user mgmt, token issuing. Apps delegate login to it.

**2. Realm vs client?** Realm = isolated tenant (users, roles, IdPs). Client = an app registered in a realm.

**3. Why not use the `master` realm for apps?** It's for administering Keycloak itself. Create a dedicated realm.

**4. Public vs confidential client?** Public can't hold a secret (SPA/mobile) → PKCE. Confidential has a secret (backend).

**5. Realm role vs client role?** Realm role global; client role scoped to one client, in `resource_access.<client>`.

**6. Groups vs roles?** Group = set of users (hierarchical); roles assigned to a group are inherited by members.

**7. What's a client scope / protocol mapper?** Scope bundles mappers; a mapper decides which claim goes into a token.

**7b. Scope vs role?** Scope = what the *app* may request/is granted (`scope` claim → `SCOPE_x`). Role = what the *user* may do. Client scope = the Keycloak bundle of mappers that fills the token when a scope is requested.

**7d. What is a claim?** One key-value statement in the token (`sub`, `email`, `exp`, roles...). Signed by Keycloak, so the API trusts it; readable by anyone holding the token (signed, not encrypted).

**7c. What is a protocol mapper?** One rule that copies data (user property/attribute, roles, groups, a fixed value) into a token claim. Defined in a client scope or on a client; you pick which tokens get it.

## OAuth2 / OIDC
**8. OAuth2 vs OIDC?** OAuth2 = authorization (access tokens). OIDC = authentication layer: `id_token`, `/userinfo`, standard claims. Key card vs name on the reservation.

**8b. Which claims does OIDC add?** `sub`/`exp`/`iss` come from the JWT spec (OIDC requires them in the ID token); `email`, `name`, `preferred_username` are OIDC standard claims; `scope`, `realm_access` are OAuth/Keycloak-specific. Keycloak mappers fill them, and it also puts them in the access token (a convention, not the spec).

**9. Which flow for a SPA?** Authorization Code + PKCE. Implicit and ROPC are deprecated.

**10. What does PKCE prevent?** Authorization-code interception: the code is useless without the original `code_verifier`.

**10b. Any SPA can generate a challenge, so what stops an attacker?** The code is bound to the challenge sent in step 1. A thief with the code but not the verifier fails `sha256(v) == H(v)` at `/token`. Starting their own login only gives them their own account. PKCE ties redemption to whoever started the login; it doesn't identify the app, and it doesn't stop XSS.

**10c. Plain Auth Code vs PKCE?** Same flow. Only the `/token` step differs: `client_secret` (static, backend only) vs `code_verifier` (one-time, safe for SPA/mobile).

**11. Access vs ID vs refresh token?** Access → call APIs. ID → tells the client who logged in. Refresh → get new access token.

**12. How does an API validate a token without calling Keycloak?** Verify RS256 signature with the realm's JWKS public key; check `iss`, `exp`, `aud`.

**12b. What is JWKS?** The public URL where Keycloak publishes its public keys (a *set*, so keys can rotate; `kid` picks one). APIs cache it and verify RS256 signatures locally. JWT signing uses a key pair, not certificates.

**12c. What is `/.well-known/openid-configuration`?** The discovery document: JSON listing the issuer, authorize/token/userinfo/logout endpoints, `jwks_uri`, supported scopes and grants. Spring's `issuer-uri` reads it.

**13. Downside of stateless validation?** Revocation lag until `exp`. Mitigate: short TTL, introspection, back-channel logout, deny-list.

**14. Service-to-service auth?** Client credentials grant with a confidential client + service account.

**15. What is `sub`? ** Stable unique user id (UUID). Use it as the link to your own DB, not email/username.

**16. What's refresh-token rotation?** Each refresh returns a new refresh token; reuse of an old one revokes the session (detects theft).

**17. What's token exchange?** Swap a token for one with a different audience/identity (impersonation, downscoping).

## Google / brokering
**18. How do users log in with Google?** Add Google as an Identity Provider in the realm (client id/secret from Google Cloud); redirect URI `/realms/{realm}/broker/google/endpoint`.

**19. Brokering vs federation?** Brokering = redirect to an external IdP, create local user + link. Federation = Keycloak reads users from LDAP/AD.

**20. What happens on first Google login?** `first broker login` flow: create user (or link to existing email after verification) + store federated identity.

**21. Why is the "link existing account" verification needed?** Prevent account takeover by someone with a same-email account on another provider. Trust Email only for IdPs that verify emails.

**22. How to skip the Keycloak login page?** `kc_idp_hint=google` on the auth request.

**23. Your app wants Google's access token (Calendar API)?** Enable "Store tokens" and use the broker token endpoint.

**24. Sync mode import vs force?** import = copy profile once; force = overwrite from IdP every login.

## Spring / integration
**25. Which Spring dependency?** `spring-boot-starter-oauth2-resource-server` + `issuer-uri`. Keycloak adapters are deprecated.

**26. Why custom JwtAuthenticationConverter?** Spring maps `scope`→`SCOPE_*`; Keycloak roles live in `realm_access.roles`/`resource_access`.

**27. `@PreAuthorize` not working?** Missing `@EnableMethodSecurity`, or self-invocation (proxy bypass).

**28. Where to validate in microservices?** Gateway validates and relays; each service validates too (defense in depth).

**29. WebSockets and bearer tokens?** Browser WebSocket can't set headers → token in query/first frame, validate at handshake.

**30. Where store tokens in a web app?** Memory, or BFF with httpOnly cookie. Not `localStorage`.

## Ops
**31. Dev vs prod mode?** `start-dev`: H2, HTTP, relaxed. `start`: Postgres, TLS/proxy, hostname required.

**32. Why does `iss` mismatch happen?** Different hostname seen by browser vs service (container name vs localhost). Fix `KC_HOSTNAME`.

**33. How do you version-control config?** Realm export JSON / Terraform provider / Operator realm import. Review in PRs.

**34. HA?** Multiple nodes + shared Postgres; Infinispan caches replicate sessions; load balancer in front.

**35. How to harden?** Brute-force detection, password policy, MFA, short TTLs, exact redirect URIs, SSL required, restrict admin console, audit events.

**36. How to extend? What is an SPI?** SPI = Service Provider Interface: a socket Keycloak leaves open; you implement its Java interface, ship the class in a jar in `providers/`, and Keycloak loads it. SPIs (authenticator, event listener, user storage, mapper) as JARs in `providers/`; custom themes.

**37. Keycloak vs Auth0/Cognito?** Keycloak = free but you operate it; SaaS = no ops but per-user cost and lock-in.

**38. How would you migrate this repo's hand-rolled auth?** Run both; import users (hash algorithm compat or "migrate on first login" via user storage SPI / required password reset); switch resource servers to JWKS; key profile table by `sub`; remove `GoogleIdTokenValidator`.

**39. Passwords migration — hashes?** Keycloak imports BCrypt/PBKDF2 hashes via the credentials API; otherwise force reset or migrate lazily on login.

**40. What would you NOT put in Keycloak?** App-specific profile data/domain state (avatars, servers). Keep Keycloak for identity; link by `sub`.

**41. What is the Keycloak Admin API? How do users get into our DB?** REST API under `/admin/realms/{realm}/...` (create/update/delete users, assign role mappings), same one the admin console uses. Backend calls it with a service account (client credentials, least privilege). It is us → Keycloak only; Keycloak users arrive in our DB via just-in-time provisioning on first token (`sub` with no row → create), or an event-listener SPI if rows are needed earlier.

🧠 **Hook:** *Flow? Code+PKCE. Validate? JWKS signature. Google? IdP + broker endpoint. Key? `sub`.*
