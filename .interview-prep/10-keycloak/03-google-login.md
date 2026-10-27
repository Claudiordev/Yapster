# 03 — Users register & log in with Google (Identity Brokering)

Goal: a "Sign in with Google" button; first login **auto-creates** the user in
Keycloak. You write no token-validation code.

```
Browser ─► Keycloak ─► Google ─► Keycloak ─► Browser
  (inarow-web)   (redirect)  (consent)  (broker endpoint)  (code → tokens)
                                │
                  Keycloak creates user + federated identity link on FIRST login
```

## Step 1 — Google Cloud Console

1. https://console.cloud.google.com → **APIs & Services → OAuth consent screen**
   (External, add yourself as test user).
2. **Credentials → Create credentials → OAuth client ID → Web application**
3. **Authorized redirect URI** (exact!):
   ```
   http://localhost:8180/realms/inarow/broker/google/endpoint
   ```
4. Copy **Client ID** and **Client secret**.

## Step 2 — Add the IdP in Keycloak

Admin console (`http://localhost:8180`, `admin/admin`) →
realm **inarow** → **Identity providers → Google**:

| Field | Value |
|---|---|
| Client ID / Secret | from Step 1 |
| Default scopes | `openid email profile` |
| Trust Email | **ON** only for Google (it verifies emails) |
| Sync mode | `import` (copy once) or `force` (refresh every login) |
| First login flow | `first broker login` (default) |

Or scripted: `lab/setup-google.sh` (reads `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

## Step 3 — What happens on first Google login

`first broker login` flow:

```
1. Review profile            (skip if Google gave email/first/last)
2. Does a local user with this email already exist?
     no  → CREATE user + link Google        ✅ registration
     yes → "Link account": must verify (re-auth / email) before linking
```

> The verify step is a **security feature**: without it, anyone who controls a
> Google account with your email could take over your local account. Trust
> Email=ON on a *verifying* IdP lets Keycloak auto-link safely.

## Step 4 — Skip the Keycloak login page (go straight to Google)

```
.../auth?client_id=inarow-web&...&kc_idp_hint=google
```
`kc_idp_hint=google` → the "Sign in with Google" button in `web/` just adds it.

## Step 5 — Let users self-register with a password too

Realm settings → Login → **User registration ON**, **Verify email ON**
(needs SMTP configured), **Forgot password ON**.

## Step 6 — Check it worked

```
Users → (new google user) → Identity provider links → google | <google sub>
Sessions → active session
```

## Your app's side: keep a profile row keyed by `sub`

```java
// First time we see a token from Keycloak, lazily create our own profile.
// `sub` is stable even if the user changes email or links another provider.
@Transactional
public User currentUser(Jwt jwt) {
    return users.findByKeycloakId(jwt.getSubject())
        .orElseGet(() -> users.save(new User(
            jwt.getSubject(),                         // sub  -> primary link
            jwt.getClaimAsString("preferred_username"),
            jwt.getClaimAsString("email"))));
}
```

## Troubleshooting

| Error | Cause |
|---|---|
| `redirect_uri_mismatch` (Google) | URI in Google console ≠ `.../broker/google/endpoint` exactly |
| `Invalid parameter: redirect_uri` (Keycloak) | not in client's Valid redirect URIs |
| Access blocked: app not verified | add yourself under *Test users* in consent screen |
| Account already exists loop | email matched a local user; complete the link step |

🧠 **Hook:** *Google proves who they are → Keycloak makes a local user + a link → your app only ever sees a Keycloak token.*
