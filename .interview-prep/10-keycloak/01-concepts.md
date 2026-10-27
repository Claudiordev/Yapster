# 01 — Concepts

```
Keycloak server
 ├─ master realm            ← admin console lives here. Never use it for apps.
 └─ realm: inarow           ← ISOLATED tenant: own users, clients, roles, IdPs
      ├─ users / groups
      ├─ clients            ← apps that ask Keycloak to log people in
      ├─ roles              ← realm roles + per-client roles
      ├─ client scopes      ← bundles of claims/mappers put into tokens
      └─ identity providers ← Google, GitHub, another Keycloak, SAML...
```

| Term | One line |
|---|---|
| **Realm** | A tenant. Users in realm A can't log in to realm B. |
| **Client** | An app registered in a realm. `inarow-web` (browser), `inarow-session` (API). |
| **Public client** | Can't keep a secret (SPA, mobile) → **Auth Code + PKCE**. |
| **Confidential client** | Has a `client_secret` (backend) → can use client credentials. |
| **Realm role** | `admin`, `user` — global to the realm. |
| **Client role** | Role scoped to one client — appears in `resource_access.<client>.roles`. |
| **Group** | Set of users; roles assigned to the group are inherited. |
| **Composite role** | A role that contains other roles. |
| **Client scope** | A **box of protocol mappers** with a name (`profile`). The app asks for the box by name (`scope=profile`). Build the box once, tick it on in each app that needs it. |
| **Protocol mapper** | A **copy rule**: takes one piece of user data (email, role, attribute) and puts it into one claim in the JWT. |
| **Claim** | One key-value line in the token (`"email": "demo@inarow.dev"`) — where the mapper's copy lands. |
| **Identity Provider (IdP)** | External login source (Google). Keycloak *brokers* to it. |
| **User Federation** | Keycloak reads users from LDAP/AD (they stay there). |
| **Authentication flow** | Configurable login steps: browser, direct grant, first broker login. |
| **Required action** | Forced step: verify email, update password, configure OTP. |

## The one sentence (scope + mapper + claim)

> **A client scope is a box of protocol mappers, and each mapper copies one piece of
> user data into a claim in the JWT.**

**Scope = box, mapper = copy rule, claim = where the user data lands.**

```
Client scope "profile"
   ├─ mapper: user's username   → claim "preferred_username"
   ├─ mapper: user's first name → claim "given_name"
   └─ mapper: user's last name  → claim "family_name"
```
Mappers copy **user data** (not the scope name). The scope **names** land in one separate
claim, `scope`, which Keycloak adds itself:
```json
{
  "scope": "openid profile email",        ← the requested scope NAMES (one string)
  "preferred_username": "demo",           ← filled by a mapper in "profile"
  "given_name": "Demo",                   ← filled by a mapper in "profile"
  "email": "demo@inarow.dev"              ← filled by a mapper in "email"
}
```
Diagram: `~/java-cheatsheets/keycloak-scope-mapper.png`

## Scope vs client scope

- **OAuth scope** = the string the app requests (`scope=openid email read`): "I want this access".
- **Client scope** (Keycloak) = the named bundle of mappers/role-mappings behind that string.

```
Client scope "email"   = mapper: user.email → claim "email"
                         mapper: user.emailVerified → claim "email_verified"
Client scope "read"    = (you create it) role scope mapping + mappers

App asks:       scope=openid email read
Keycloak:       for each requested scope → run its mappers → fill the token
Token gets:     "email": "demo@inarow.dev", "scope": "openid email read", ...
```

### Client scope = a named package of "what goes in the token"

**Without scopes**, every client needs each claim rule set up one by one ("add email",
"add name", "add roles") and again for the next app. **With scopes**, make the package
once, name it, attach it to as many clients as you like.

```
Client scope "email"   = a package containing 2 rules (mappers):
                           • put user's email into claim "email"
                           • put email verified flag into "email_verified"
Client scope "profile" = a package containing rules for: name, preferred_username, ...
Client scope "roles"   = a package containing the rule for: realm_access.roles
```
Attach packages to a client:
```
Client inarow-web  →  uses packages: email, profile, roles      (default = always on)
                                      read, write               (optional = only if asked)
```
At login time:
```
inarow-web asks:  scope=openid email profile
Keycloak:         "email" package   → add email claims
                  "profile" package → add name claims
                  "roles" package   → default on, so add roles too
                  "read" package    → not asked, not included
```
Like phone-app permissions: each is a package of data; the app only gets what it's been given.
UI: **Client scopes** → `email` → **Mappers** tab (rules inside); **Clients → inarow-web → Client scopes** (what's attached).

- **Default** scopes: always applied. **Optional** scopes: only if the app asks by name.
- Spring turns `scope` into `SCOPE_read` → `hasAuthority('SCOPE_read')`. Enforcing it is the API's job.
- **Scope = what the app may ask for. Role = what the user may do.** Both should agree.

## Claim

A **claim** = one key-value statement inside a token (a JWT is a JSON object; each field is a claim).
Keycloak signs them, so the API trusts them without calling Keycloak.

- **Standard:** `iss`, `sub`, `aud`, `exp`, `iat` (JWT spec)
- **OIDC:** `email`, `name`, `preferred_username`
- **Custom:** whatever a protocol mapper adds (`tenant`, `avatar`)
- Spring: `jwt.getSubject()`, `jwt.getClaimAsString("email")`
- JWT is signed, **not encrypted**: anyone with the token can read claims. No secrets in them.

## Protocol mappers

A **protocol mapper** = one rule: "take this data, put it in the token as this claim".

```
Source (in Keycloak)            Mapper                       Claim in the token
user.email                  →   User Property mapper     →   "email": "demo@inarow.dev"
user attribute "phone"      →   User Attribute mapper    →   "phone_number": "+46..."
user's realm roles          →   User Realm Role mapper   →   "realm_access": { "roles": [...] }
group membership            →   Group Membership mapper  →   "groups": ["/admins"]
a fixed value               →   Hardcoded claim mapper   →   "tenant": "inarow"
```
**A mapper is a copy instruction.** Keycloak stores lots of user data; a token starts nearly empty.

```
Step 1: what Keycloak has stored for user demo
  username:   demo
  email:      demo@inarow.dev
  firstName:  Demo
  roles:      user, admin
  attribute:  avatarUrl = https://cdn/inarow/demo.png      (custom field you added)

Step 2: a token with no mappers
  { "sub": "f1c0-uuid", "iss": "...", "exp": 1790000000 }
  basically empty: your API can't tell the user's email or roles from it.

Step 3: each mapper copies one thing in
  Mapper "email"       : copy user.email           → into token as  "email"
  Mapper "username"    : copy user.username        → into token as  "preferred_username"
  Mapper "realm roles" : copy user's roles         → into token as  "realm_access.roles"
  Mapper "avatar"      : copy attribute avatarUrl  → into token as  "avatar"

Step 4: the token with the mappers applied
  {
    "sub": "f1c0-uuid",
    "email": "demo@inarow.dev",
    "preferred_username": "demo",
    "realm_access": { "roles": ["user", "admin"] },
    "avatar": "https://cdn/inarow/demo.png"
  }
```
Each mapper has three settings: **what to copy** (source), **what to call it** (claim name),
**which token gets it** (access / ID / userinfo).

How it fits with scopes:
```
Client scope "profile"  =  the box
   ├─ mapper: username → preferred_username      ← one item in the box
   ├─ mapper: firstName → given_name
   └─ mapper: lastName → family_name
```
A scope groups mappers, a mapper does the copying. Without mappers a scope is an empty box.

Try it in the lab: **Users → demo → Attributes** add `avatarUrl`; **Clients → inarow-web →
Client scopes → inarow-web-dedicated → Add mapper → User Attribute** (attribute `avatarUrl`,
claim `avatar`, add to access token ON); log in, decode the token at jwt.io.

- Lives in a **client scope** (reusable) or directly on a **client** (that app only).
- Per mapper you choose: which token (access / ID / userinfo) and the claim name (nesting allowed).
- Chain: **client scope → contains mappers → each mapper fills one claim.**
- Need something custom? Write a mapper via **SPI** (a plug-in class in a jar; see `05-production.md`).

## User federation (LDAP / AD)

Companies already have a directory of employees (Active Directory, or any LDAP server).
Federation = Keycloak **doesn't copy the users**; it asks that directory if the login is valid.

```
Employee logs in
   │
   ▼
Keycloak ── "is demo/secret valid?" ──►  Company LDAP / AD   (users stay here)
   │◄──────── yes / no + user data ───────┘
   ▼
Keycloak issues the normal token (claims, roles, ...)
```
- Users + passwords **stay in LDAP/AD**; Keycloak may cache the profile to build tokens.
- Apps only ever see Keycloak tokens.

| | Where the user lives | What the user sees |
|---|---|---|
| Local users | Keycloak DB | Keycloak form |
| **Brokering** (Google) | at Google; Keycloak keeps a link | redirected to Google's login page |
| **Federation** (LDAP/AD) | company directory | Keycloak form; password checked in LDAP behind the scenes |

Interview line: *"Keycloak can federate to LDAP/AD, keep users there, and still issue standard tokens to my apps."*

## Brokering vs Federation (classic trap)

```
Identity BROKERING  : "Sign in with Google"  → user is redirected to Google.
                      Keycloak creates a LOCAL user + a federated-identity link.
User FEDERATION     : Keycloak queries LDAP/AD for credentials. Users live there.
```

## Where roles end up in the token

```json
{
  "iss": "http://localhost:8180/realms/inarow",
  "sub": "f1c0...-uuid",                       // STABLE user id — your DB key
  "preferred_username": "demo",
  "email": "demo@inarow.dev",
  "realm_access":   { "roles": ["user"] },
  "resource_access":{ "inarow-session": { "roles": ["admin"] } },
  "azp": "inarow-web"                          // which client got the token
}
```

🧠 **Hook:** *Realm = tenant, Client = app, Role = permission, Scope = which claims, IdP = "login with X".*
