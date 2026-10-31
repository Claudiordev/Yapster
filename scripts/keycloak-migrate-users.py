#!/usr/bin/env python3
"""Copy users from the session database into a Keycloak realm (through the Admin REST API).

Keycloak keeps its own database, so this never writes to it directly: it reads `session`
(users, user_roles, user_providers) and creates the same users in Keycloak.

  - Same UUID: Keycloak `id` = session `users.id`, so `sub` in tokens does not change.
  - Passwords: the existing BCrypt hash is imported as-is (needs the keycloak-bcrypt provider,
    see keycloak/Dockerfile). Keycloak re-hashes with its default algorithm on first login.
  - Roles: session role names -> Keycloak realm roles of the same name (must exist in the realm).
  - Google: user_providers rows -> federated identity links (needs the `google` identity provider).
  - Idempotent: users that already exist in Keycloak are skipped, roles/links are only added.

Dry run by default. Nothing is written without --apply.

  # session DB through a port-forward on localhost:5432
  PGPASSWORD=... scripts/keycloak-migrate-users.py --pg-user myuser --pg-db mydatabase
  PGPASSWORD=... scripts/keycloak-migrate-users.py --pg-user myuser --pg-db mydatabase --apply

Reads the DB with `psql`; if it is not installed, falls back to `docker run postgres:16 psql`.
Only the standard library is used.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

USERS_SQL = """
SELECT coalesce(json_agg(json_build_object(
  'id', u.id,
  'username', u.username,
  'email', u.email,
  'enabled', coalesce(u.enabled, true),
  'password', u.password,
  'roles', (SELECT coalesce(json_agg(r.name), '[]'::json)
            FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id),
  'providers', (SELECT coalesce(json_agg(json_build_object(
                  'provider', p.provider, 'subject', p.subject, 'email', p.email)), '[]'::json)
                FROM user_providers p WHERE p.user_id = u.id)
)), '[]'::json)
FROM users u
"""

BCRYPT_RE = re.compile(r"^\$2[abxy]\$(\d\d)\$.{53}$")


def read_users(args):
    env = dict(os.environ, PGPASSWORD=args.pg_password or os.environ.get("PGPASSWORD", ""))
    psql_args = ["-h", args.pg_host, "-p", str(args.pg_port), "-U", args.pg_user,
                 "-d", args.pg_db, "-At", "-c", USERS_SQL]
    if shutil.which("psql"):
        cmd = ["psql"] + psql_args
    else:
        cmd = ["docker", "run", "--rm", "--network", "host", "-e", "PGPASSWORD",
               "postgres:16", "psql"] + psql_args
    out = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit("Could not read the session database:\n" + out.stderr.strip())
    return json.loads(out.stdout)


class Keycloak:
    def __init__(self, base, realm, admin, password):
        self.base, self.realm = base.rstrip("/"), realm
        body = urllib.parse.urlencode({"client_id": "admin-cli", "grant_type": "password",
                                       "username": admin, "password": password}).encode()
        res = self._send("POST", f"{self.base}/realms/master/protocol/openid-connect/token",
                         body, {"Content-Type": "application/x-www-form-urlencoded"})
        self.token = res["access_token"]

    def _send(self, method, url, body=None, headers=None):
        req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req) as res:
                raw = res.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {url} -> {e.code} {e.read().decode()[:300]}") from None

    def api(self, method, path, payload=None):
        body = json.dumps(payload).encode() if payload is not None else None
        return self._send(method, f"{self.base}/admin/realms/{self.realm}{path}", body,
                          {"Authorization": f"Bearer {self.token}",
                           "Content-Type": "application/json"})

    def user_exists(self, user_id):
        try:
            self.api("GET", f"/users/{user_id}")
            return True
        except RuntimeError as e:
            if " 404 " in str(e):
                return False
            raise


def credential(password):
    """A session BCrypt hash as a Keycloak credential (provider id `bcrypt`, empty salt)."""
    m = BCRYPT_RE.match(password)
    if not m:
        return None
    hash_ = "$2a$" + password[4:]  # the provider verifies $2a$; $2b/$2y are the same algorithm
    return {"type": "password",
            "credentialData": json.dumps({"hashIterations": int(m.group(1)), "algorithm": "bcrypt"}),
            "secretData": json.dumps({"value": hash_, "salt": ""})}


def representation(u, creds):
    return {"id": u["id"], "username": u["username"], "email": u["email"],
            "emailVerified": bool(u["providers"]),  # Google already verified those emails
            "enabled": u["enabled"], "credentials": creds}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="write to Keycloak (default: dry run)")
    p.add_argument("--pg-host", default=os.environ.get("PGHOST", "localhost"))
    p.add_argument("--pg-port", default=os.environ.get("PGPORT", "5432"))
    p.add_argument("--pg-user", default=os.environ.get("PGUSER", "myuser"))
    p.add_argument("--pg-password", default=None, help="or PGPASSWORD")
    p.add_argument("--pg-db", default=os.environ.get("PGDATABASE", "mydatabase"))
    p.add_argument("--kc-url", default=os.environ.get("KC_URL", "http://localhost:8180"))
    p.add_argument("--kc-realm", default=os.environ.get("KC_REALM", "voxsi"))
    p.add_argument("--kc-admin", default=os.environ.get("KEYCLOAK_ADMIN", "admin"))
    p.add_argument("--kc-admin-password", default=os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "admin"))
    p.add_argument("--google-alias", default="google", help="alias of the Google identity provider")
    args = p.parse_args()

    users = read_users(args)
    print(f"session DB: {len(users)} users")
    kc = Keycloak(args.kc_url, args.kc_realm, args.kc_admin, args.kc_admin_password)

    realm_roles = {r["name"]: r for r in kc.api("GET", "/roles")}
    idps = {i["alias"] for i in kc.api("GET", "/identity-provider/instances")}
    print(f"keycloak realm {args.kc_realm}: roles {sorted(realm_roles)}, identity providers {sorted(idps) or 'none'}")

    stats = {"created": 0, "skipped": 0, "no_password": 0, "bad_hash": 0, "failed": 0}
    for u in users:
        label = f"{u['username']} <{u['email']}> {u['id']}"
        creds = []
        if u["password"]:
            c = credential(u["password"])
            if c:
                creds.append(c)
            else:
                stats["bad_hash"] += 1
                print(f"  ! {label}: password is not a BCrypt hash, user gets no password (needs reset)")
        else:
            stats["no_password"] += 1

        missing_roles = [r for r in u["roles"] if r not in realm_roles]
        if missing_roles:
            print(f"  ! {label}: roles missing in the realm, skipped: {missing_roles}")
        links = [pr for pr in u["providers"] if pr["provider"] == args.google_alias]
        if links and args.google_alias not in idps:
            print(f"  ! {label}: identity provider '{args.google_alias}' not configured, link skipped")
            links = []

        if not args.apply:
            print(f"  would create {label} roles={u['roles']} google={len(links)} password={'yes' if creds else 'no'}")
            continue

        try:
            if kc.user_exists(u["id"]):
                stats["skipped"] += 1
                print(f"  = {label}: already in Keycloak, only reconciling roles/links")
            else:
                kc.api("POST", "/partialImport", {"ifResourceExists": "SKIP",
                                                  "users": [representation(u, creds)]})
                stats["created"] += 1
                print(f"  + {label}")
            wanted = [realm_roles[r] for r in u["roles"] if r in realm_roles]
            if wanted:
                kc.api("POST", f"/users/{u['id']}/role-mappings/realm",
                       [{"id": r["id"], "name": r["name"]} for r in wanted])
            have = {f["identityProvider"] for f in kc.api("GET", f"/users/{u['id']}/federated-identity")}
            for pr in links:
                if args.google_alias not in have:
                    kc.api("POST", f"/users/{u['id']}/federated-identity/{args.google_alias}",
                           {"userId": pr["subject"], "userName": pr["email"] or u["email"]})
        except RuntimeError as e:
            stats["failed"] += 1
            print(f"  x {label}: {e}")

    print("\n" + ("APPLIED" if args.apply else "DRY RUN (nothing written, use --apply)"), stats)
    sys.exit(1 if stats["failed"] else 0)


if __name__ == "__main__":
    main()
