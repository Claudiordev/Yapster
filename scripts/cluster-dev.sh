#!/usr/bin/env bash
# Run the backend services locally in Docker, pointed at the CLUSTER's Postgres
# (session + chat), Redis, MinIO and LiveKit through `kubectl port-forward`.
#
#   scripts/cluster-dev.sh up [--yes]    start port-forwards + local containers
#   scripts/cluster-dev.sh down          stop the containers and port-forwards
#   scripts/cluster-dev.sh check         read the Secrets and print what would be used (no values)
#   scripts/cluster-dev.sh compose ...   run any `docker compose` command with the credentials loaded
#                                        (e.g. compose logs -f chat, compose up -d --build --no-deps chat).
#                                        Use this instead of plain `docker compose`: the CLUSTER_* variables
#                                        only exist inside this script, and plain compose would fill in blanks.
#
# Credentials are read from the cluster's Secrets at run time (kubectl) and handed
# to Docker Compose through environment variables. Nothing secret is written to
# disk. If a value cannot be read from the cluster, the script falls back to
# yapprr-infra/simple/01-secrets.yaml. Placeholder (CHANGE-ME) values there are
# accepted with a warning: the cluster was applied from that file, so they are the
# live values unless someone changed them in the cluster.
#
# WARNING: this uses the REAL databases. What that means:
#  * session runs Flyway on the live session DB at startup, applying any migration
#    the live service has not seen yet (today V7__add_user_bio.sql: an additive,
#    nullable users.bio column). Set CLUSTER_SESSION_FLYWAY=false to skip it, but
#    session then fails on the missing column. chat migrates too (default on) so local
#    migrations the live DB lacks, like a new V3, get applied. Set CLUSTER_CHAT_FLYWAY=false to forbid that.
#  * Everything you do (logins, role changes, messages) hits real data.
#  * Redis uses a separate DB index (CLUSTER_REDIS_DB, default 7), NOT the live one:
#    session caches users in Redis, and a local session writes users with the newer
#    `bio` field that the live session cannot read back.
#
# Env you can override: KUBECONFIG, KUBE_SERVER, KUBE_TLS_SERVER_NAME, INFRA_DIR,
# NS (namespace, default yapster), PF_ADDRESS (default 127.0.0.1; use 0.0.0.0 if the
# containers cannot reach the forwards), CLUSTER_REDIS_DB, CLUSTER_LIVEKIT_URL,
# CLUSTER_MINIO_PUBLIC_URL.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${INFRA_DIR:-$HOME/repos/yapprr-infra}"
export KUBECONFIG="${KUBECONFIG:-$INFRA_DIR/kubeconfig-external}"
NS="${NS:-yapster}"
PF_ADDRESS="${PF_ADDRESS:-127.0.0.1}"
PID_FILE="${TMPDIR:-/tmp}/cluster-dev-portforwards.pid"
PF_LOG="${TMPDIR:-/tmp}/cluster-dev-portforwards.log"
SERVICES=(discovery session chat voice router)
COMPOSE=(docker compose -f "$ROOT/docker-compose.yaml" -f "$ROOT/docker-compose.cluster.yaml")

KUBECTL=(kubectl)
[ -n "${KUBE_SERVER:-}" ] && KUBECTL+=(--server "$KUBE_SERVER")
[ -n "${KUBE_TLS_SERVER_NAME:-}" ] && KUBECTL+=(--tls-server-name "$KUBE_TLS_SERVER_NAME")

die() { echo "error: $*" >&2; exit 1; }

SRC_FILE="$(mktemp)"
trap 'rm -f "$SRC_FILE"' EXIT

# secret <name> <key>: cluster first, then the yapprr-infra file (never a placeholder).
# Prints the value on success. On failure prints WHY on stderr and returns 1.
secret() {
  local name="$1" key="$2" value="" out="" rc=0 reason=""
  out="$("${KUBECTL[@]}" -n "$NS" get secret "$name" -o "jsonpath={.data.$key}" 2>&1)" || rc=$?
  if [ "$rc" -eq 0 ] && [ -n "$out" ]; then
    value="$(printf '%s' "$out" | base64 -d 2>/dev/null || true)"
    [ -n "$value" ] && printf '%s/%s\tcluster\n' "$name" "$key" >> "$SRC_FILE"
  elif [ "$rc" -ne 0 ]; then
    reason="kubectl: $(printf '%s' "$out" | head -1)"
  else
    reason="the secret exists in namespace '$NS' but key '$key' is empty or missing"
  fi
  if [ -z "$value" ] && [ -f "$INFRA_DIR/simple/01-secrets.yaml" ]; then
    value="$(python3 - "$INFRA_DIR/simple/01-secrets.yaml" "$name" "$key" <<'PY' 2>/dev/null || true
import sys, yaml
path, name, key = sys.argv[1:]
for d in yaml.safe_load_all(open(path)):
    if d and d.get("kind") == "Secret" and d["metadata"]["name"] == name:
        print((d.get("stringData") or {}).get(key, ""), end="")
PY
)"
    case "$value" in
      "") ;;
      CHANGE-ME*) printf '%s/%s\tyapprr-infra file, placeholder value (only right if the cluster was applied from that file unchanged)\n' "$name" "$key" >> "$SRC_FILE";;
      *) printf '%s/%s\tyapprr-infra file (NOT the cluster)\n' "$name" "$key" >> "$SRC_FILE";;
    esac
  fi
  if [ -z "$value" ]; then
    echo "error: secret $name/$key not found. ${reason:-not in the cluster and not in $INFRA_DIR/simple/01-secrets.yaml}" >&2
    return 1
  fi
  printf '%s' "$value"
}

MISSING=0
# need <VAR> <secret> <key>: read one secret into an exported variable; keep going on failure
# so every missing secret is reported at once.
need() {
  local v
  if v="$(secret "$2" "$3")"; then
    printf -v "$1" '%s' "$v"
    export "$1"
  else
    MISSING=1
  fi
}

load_env() {
  command -v kubectl >/dev/null || die "kubectl not found"
  command -v docker  >/dev/null || die "docker not found"
  echo "cluster: $("${KUBECTL[@]}" config view --minify -o 'jsonpath={.clusters[0].cluster.server} (context {.current-context})' 2>/dev/null || echo unknown)  namespace: $NS"
  need CLUSTER_SESSION_DB          postgres-session database
  need CLUSTER_SESSION_DB_USER     postgres-session username
  need CLUSTER_SESSION_DB_PASSWORD postgres-session password
  need CLUSTER_CHAT_DB             postgres-chat database
  need CLUSTER_CHAT_DB_USER        postgres-chat username
  need CLUSTER_CHAT_DB_PASSWORD    postgres-chat password
  need CLUSTER_REDIS_PASSWORD      redis password
  need CLUSTER_MINIO_USER          minio root-user
  need CLUSTER_MINIO_PASSWORD      minio root-password
  need CLUSTER_LIVEKIT_API_KEY     livekit api-key
  need CLUSTER_LIVEKIT_API_SECRET  livekit api-secret
  if [ "$MISSING" -ne 0 ]; then
    echo "hint: list what the cluster really has:  kubectl -n $NS get secrets   (or: kubectl get secrets -A | grep -Ei 'redis|minio|livekit')" >&2
    die "some secrets could not be read (see above); nothing was started"
  fi
  export CLUSTER_LIVEKIT_URL="${CLUSTER_LIVEKIT_URL:-wss://livekit.guildvo.com}"
  export CLUSTER_REDIS_DB="${CLUSTER_REDIS_DB:-7}"
  export CLUSTER_SESSION_FLYWAY="${CLUSTER_SESSION_FLYWAY:-true}"
  export CLUSTER_CHAT_FLYWAY="${CLUSTER_CHAT_FLYWAY:-true}"
  echo "secrets ok: postgres-session ($CLUSTER_SESSION_DB_USER@$CLUSTER_SESSION_DB), postgres-chat ($CLUSTER_CHAT_DB_USER@$CLUSTER_CHAT_DB), redis, minio ($CLUSTER_MINIO_USER), livekit ($CLUSTER_LIVEKIT_API_KEY)"
  echo "where each value came from:"
  sed 's/^/  /' "$SRC_FILE" | sort
}

forward() { # <svc> <local-port> <remote-port>
  echo "--- port-forward svc/$1 $2:$3" >> "$PF_LOG"
  "${KUBECTL[@]}" -n "$NS" port-forward --address "$PF_ADDRESS" "svc/$1" "$2:$3" >> "$PF_LOG" 2>&1 &
  echo $! >> "$PID_FILE"
}

wait_port() { # <port>
  for _ in $(seq 1 30); do (echo > "/dev/tcp/127.0.0.1/$1") 2>/dev/null && return 0; sleep 1; done
  echo "--- last lines of $PF_LOG:" >&2
  tail -n 8 "$PF_LOG" >&2 || true
  die "port-forward on $1 did not come up"
}

stop_forwards() {
  [ -f "$PID_FILE" ] || return 0
  while read -r pid; do kill "$pid" 2>/dev/null || true; done < "$PID_FILE"
  rm -f "$PID_FILE"
}

# After starting: every service must register in Eureka. If one does not, say why
# (from its own log) instead of leaving a silently broken stack.
verify_services() {
  local missing=() svc name
  echo "waiting for the services to register (up to ~2 minutes)..."
  for _ in $(seq 1 60); do
    missing=()
    for svc in session chat voice router; do
      name="$(echo "$svc" | tr '[:lower:]' '[:upper:]')"
      curl -fs --max-time 3 http://localhost:8761/eureka/apps 2>/dev/null | grep -q "<name>$name</name>" || missing+=("$svc")
    done
    [ "${#missing[@]}" -eq 0 ] && { echo "all services registered: session chat voice router"; return 0; }
    sleep 2
  done
  echo "NOT registered after 2 minutes: ${missing[*]}" >&2
  for svc in "${missing[@]}"; do
    echo "----- $svc: what its log says -----" >&2
    local log
    log="$("${COMPOSE[@]}" logs --tail 300 "$svc" 2>&1)"
    echo "$log" | grep -E "Schema-validation|does not exist|authentication failed|Connection refused|Flyway|FlywayException|APPLICATION FAILED|Caused by" | tail -6 >&2
    case "$log" in
      *"Schema-validation: missing"*) echo "hint: the live DB lacks a column the local code needs, so a migration did not run. Check CLUSTER_*_FLYWAY is not false, and that the image was rebuilt (up --build)." >&2;;
      *"role \"root\" does not exist"*|*'role "" does not exist'*) echo "hint: empty database credentials. Start it through this script, not plain docker compose." >&2;;
      *"password authentication failed"*) echo "hint: wrong database/Redis password for the cluster secret." >&2;;
    esac
  done
  echo "Full logs: $0 compose logs -f <service>" >&2
  return 1
}

cmd_up() {
  load_env
  cat <<MSG

You are about to run LOCAL services against the LIVE databases:
  - session DB: Flyway ${CLUSTER_SESSION_FLYWAY} — local migrations: $(ls session/src/main/resources/db/migration 2>/dev/null | sed -E 's/__.*//' | tr '\n' ' ')
  - chat DB: read/write; Flyway ${CLUSTER_CHAT_FLYWAY:-true} — local migrations: $(ls chat/src/main/resources/db/migration 2>/dev/null | sed -E 's/__.*//' | tr '\n' ' ')
  - Redis: DB index ${CLUSTER_REDIS_DB} (not the live one), MinIO bucket 'avatars' (real objects), LiveKit ${CLUSTER_LIVEKIT_URL}
MSG
  if [ "${1:-}" != "--yes" ]; then
    read -r -p "Type 'prod' to continue: " answer
    [ "$answer" = "prod" ] || die "aborted"
  fi

  stop_forwards
  : > "$PF_LOG"
  trap 'stop_forwards; rm -f "$SRC_FILE"' EXIT
  forward postgres-session 15432 5432
  forward postgres-chat    15433 5432
  forward redis            16379 6379
  forward minio            19000 9000
  forward minio            19001 9001
  for p in 15432 15433 16379 19000 19001; do wait_port "$p"; done
  echo "port-forwards up (kept alive by this script; Ctrl+C stops everything)"

  # Local INTERNAL_SECRET (from .env) is shared by the local session and chat only.
  # Start Eureka first and wait for it, so the other services register cleanly
  # instead of logging "connection refused" stack traces while it boots.
  "${COMPOSE[@]}" up -d --build --no-deps discovery
  for _ in $(seq 1 60); do
    curl -fs -o /dev/null --max-time 2 http://localhost:8761/ && break
    sleep 2
  done
  "${COMPOSE[@]}" up -d --build --no-deps "${SERVICES[@]}"
  # A service that failed to start must not tear the port-forwards down: they stay open
  # so you can read its logs, fix it and restart just that service.
  verify_services || echo "WARNING: some services are not up (details above). Port-forwards stay open." >&2

  cat <<MSG

Local services are running. Router: http://localhost:8080  Eureka: http://localhost:8761
MinIO console: http://localhost:19001 ($(curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 3 http://localhost:19001/ || echo "NOT reachable from WSL"))  (S3 API: http://localhost:19000; login = the cluster secret minio: root-user / root-password)
Web: run it locally with the avatar proxy pointed at the forwarded MinIO:
  cd web && MINIO_INTERNAL_URL=http://localhost:19000 pnpm dev
Debugger ports (attach a JVM remote debug, host localhost): discovery 5010, session 5011, chat 5012, voice 5013, router 5014
Tracing (Jaeger) is off. Logs: docker compose -f docker-compose.yaml -f docker-compose.cluster.yaml logs -f session chat voice
MSG
  # Keep the forwards alive until Ctrl+C.
  trap 'stop_forwards; exit 0' INT TERM
  while true; do sleep 3600; done
}

cmd_down() {
  load_env >/dev/null 2>&1 || true
  # compose only needs the variables to exist to parse the file
  "${COMPOSE[@]}" stop "${SERVICES[@]}" || true
  stop_forwards
  echo "stopped"
}

cmd_check() { load_env; }

# Same compose files and the real credentials, for one-off commands (logs, rebuild one service, ps).
cmd_compose() {
  [ "$#" -gt 0 ] || die "usage: $0 compose <docker compose args>   e.g. compose logs -f chat"
  load_env >/dev/null
  exec "${COMPOSE[@]}" "$@"
}

case "${1:-up}" in
  up)    shift || true; cmd_up "${1:-}";;
  down)  cmd_down;;
  check) cmd_check;;
  compose) shift; cmd_compose "$@";;
  *) die "usage: $0 {up [--yes]|down|check|compose <args>}";;
esac
