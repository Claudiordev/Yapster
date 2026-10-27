# 05 — Production & operations

| Topic | What to say |
|---|---|
| **Database** | Dev uses embedded H2 → **never prod**. Use Postgres (`KC_DB=postgres`). |
| **Modes** | `start-dev` (HTTP, no cache, H2) vs `start` (needs hostname + TLS/proxy). |
| **Build** | Quarkus-based since v17. `kc.sh build` bakes options, then `start --optimized`. |
| **Hostname** | `KC_HOSTNAME` fixed → stable `iss` in tokens. Mismatch = every API rejects. |
| **Reverse proxy** | `KC_PROXY_HEADERS=xforwarded`, terminate TLS at the proxy/ingress. |
| **HA / clustering** | Multiple nodes share the DB; sessions replicated by **Infinispan** (embedded). Sticky sessions help. |
| **Config as code** | `kc.sh export` / realm JSON import, or Terraform `mrparkers/keycloak`, or the Keycloak Operator CRs. **Don't click prod into existence.** |
| **K8s** | Keycloak Operator (`Keycloak`, `KeycloakRealmImport` CRs) or Bitnami chart. |
| **Admin** | Separate admin hostname, restrict `/admin` at the proxy. |
| **Hardening** | Brute-force detection ON, password policy, SSL required=external, short access tokens, refresh-token rotation, exact redirect URIs, MFA (OTP / WebAuthn). |
| **Events** | Enable login + admin events → ship to logs / Kafka for audit. |
| **Metrics** | `KC_METRICS_ENABLED=true` → Prometheus `/metrics` (fits `prometheus/` here). |
| **Themes** | Custom login page via theme dir (FreeMarker templates + CSS). |
| **SPIs** | Extend: custom authenticator, event listener, user storage provider, mapper. Java JAR into `providers/`. |

## SPI (Service Provider Interface)

A plug-in point: Keycloak defines Java interfaces, you write a class that implements one,
put it in a jar in `providers/`, and Keycloak loads it next to the built-in ones.
(Java finds it via `ServiceLoader`.)

```java
// Custom protocol mapper: put the user's plan (from our billing DB) into the token
public class PlanMapper extends AbstractOIDCProtocolMapper
        implements OIDCAccessTokenMapper {

    @Override public String getId() { return "plan-mapper"; }         // name shown in the admin UI

    @Override
    protected void setClaim(IDToken token, ProtocolMapperModel model,
                            UserSessionModel session, KeycloakSession ks,
                            ClientSessionContext ctx) {
        String plan = billing.lookup(session.getUser().getId());      // YOUR custom logic
        token.getOtherClaims().put("plan", plan);                     // → claim "plan" in the JWT
    }
}
// Deploy the jar → "plan-mapper" appears in Add mapper, next to the built-in types.
```

| SPI | What you can customize |
|---|---|
| **Protocol mapper** | Custom claims in the token |
| **Authenticator** | Custom login step (corporate rule, custom OTP) |
| **Event listener** | React to events (logins to Kafka, a webhook) |
| **User storage provider** | Read users from your own DB/API (the BCrypt migration in `06-migration-plan.md`) |
| **Theme** | Custom login page look |

Use only when built-ins can't do it (user properties, attributes, roles, groups are covered).
Cost: you maintain a jar and re-test it on every Keycloak upgrade.

🧠 **Hook:** *SPI = a socket Keycloak leaves open. You write a plug (a class in a jar) that fits it.*

## Admin REST API

Keycloak's REST API for managing a realm — the same one the admin console uses.

| Call | Does |
|---|---|
| `POST /admin/realms/voxsi/users` | create a user |
| `PUT /admin/realms/voxsi/users/{id}` | update a user |
| `POST /admin/realms/voxsi/users/{id}/role-mappings/realm` | assign realm roles |
| `DELETE /admin/realms/voxsi/users/{id}` | delete a user |

- Needs a bearer token. For a backend: a **service account** on a client (client-credentials grant) with only the roles it needs (`manage-users`, `view-realm`), never the master admin.
- Direction: *our app calls Keycloak.* Keycloak does **not** push new users to us. A user registered in Keycloak reaches `session` on first request via **just-in-time provisioning** (token `sub` with no `users` row → create it). Need rows earlier → an **event listener SPI** calling an internal endpoint.
- Use here: role sync, username change, user deletion, the one-off user migration (keep `id` = old `users.id`).

🧠 **Hook:** *Admin API = we call Keycloak (service account). JIT provisioning = Keycloak users appear in our DB on first token.*

## Revocation reality

JWT access tokens are **not** checked per request → logout doesn't kill them.
Options: short TTL (5 min) · back-channel logout · introspection for sensitive
calls · deny-list by `jti`/`sid` in Redis.

## Keycloak vs alternatives

| | Keycloak | Auth0 / Cognito | Spring Auth Server |
|---|---|---|---|
| Cost | free, you run it | SaaS, per MAU | free library |
| Ops burden | **high** | none | you build UI/users |
| Social login / SSO / SAML | built in | built in | you write it |
| Pick when | want control, on-prem, no per-user fee | want zero ops | need a custom IdP in code |

## Common failures

- Token `iss` wrong behind proxy (hostname/proxy settings).
- Clock skew → `exp`/`nbf` failures.
- Realm import runs only if realm doesn't exist (`--import-realm` skips existing).
- Upgrading: read migration notes; run on a DB copy first; it auto-migrates schema.

🧠 **Hook:** *Prod = Postgres + fixed hostname + TLS proxy + realm as code + brute-force on.*
