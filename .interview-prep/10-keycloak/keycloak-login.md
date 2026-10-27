# Keycloak login with PKCE, simply

## The idea
Your app never sees the password. Keycloak checks it and hands the app a **ticket** (the code). The app swaps the ticket for **tokens**. PKCE makes sure only the app that started the login can use the ticket.

## The 3 values (don't mix them up)

| Name | What it is | Example | Secret? |
|---|---|---|---|
| **verifier** | Random secret the app makes | `1ZsRW7...` (86 chars) | Yes, until the end |
| **challenge** | `SHA-256(verifier)` | `f8mcTG...` (43 chars) | No, a hash can't be reversed |
| **code** | Single-use ticket from Keycloak | `3f1c9a7e-...` | Useless alone |

## The flow

```
1. START   App makes verifier, computes challenge = SHA-256(verifier)
           App keeps the verifier in a cookie
           App sends the challenge AND the scope to Keycloak (both in the /auth URL)
           Keycloak saves the challenge

2. LOGIN   User types the password on Keycloak's page

3. TICKET  Keycloak redirects back:  /api/auth/callback?code=3f1c9a7e-...

4. END     App sends  code + verifier + client secret  to Keycloak
           Keycloak computes SHA-256(verifier) and compares with the saved challenge

5. TOKENS  If everything matches, Keycloak returns the access token and refresh token
```

## Where the scope comes from
The **scope** is chosen by the app and sent at the **START** (step 1), as a parameter in the `/auth` URL. It is just text, not a token.

```
/auth?client_id=voxsi-web&scope=openid&code_challenge=f8mcTG...&state=...
                                 ^^^^^^^^^^^^
                    set in web/app/api/auth/login/route.ts
```

- There is **no JWT at the start**. The only JWT is built by Keycloak at step 5.
- At step 5 Keycloak looks at the scopes granted (the client's default scopes plus any optional scopes the app asked for), runs the **protocol mappers** in them and the ones attached directly to the client, and each mapper adds a claim to the JWT.
- Our `roles` mapper is attached directly to the `voxsi-web` client, so it runs on every login. The app doesn't have to ask for it in `scope=`.
- The final token has a `scope` claim listing what was granted. That is the result, not an input.

```
START  app sends:  scope=openid                 (a request, just text)
END    Keycloak:   scopes + mappers + user data  →  signed JWT with claims (sub, roles, ...)
```

## Why it's safe
- Someone steals the **code** from the URL? They don't have the **verifier**, so Keycloak refuses.
- Someone sees the **challenge**? It's a hash. They can't turn it back into the verifier.
- The verifier is new for every login, so a stolen one can't be reused.

## The cookies in your app

| Cookie | What it's for |
|---|---|
| `kc_state` | Check that the callback belongs to the login we started |
| `kc_verifier` | The secret for step 4 |
| `kc_next` | Which page to open after login |

## After login
- The tokens are stored in `auth-token` and `refresh-token` cookies.
- The middleware checks the signature using Keycloak's public keys.
- When the access token expires, the server swaps the refresh token for a new one.

🧠 **Hook:** the challenge goes out first and the verifier goes out last. Keycloak hashes the verifier and checks that the two match.
