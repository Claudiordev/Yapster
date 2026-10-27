#!/usr/bin/env bash
# Adds Google as an Identity Provider to realm `inarow` using kcadm.
# Usage: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... ./setup-google.sh
set -euo pipefail
: "${GOOGLE_CLIENT_ID:?set GOOGLE_CLIENT_ID}"
: "${GOOGLE_CLIENT_SECRET:?set GOOGLE_CLIENT_SECRET}"

KC="docker exec -i keycloak /opt/keycloak/bin/kcadm.sh"
$KC config credentials --server http://localhost:8180 --realm master --user admin --password admin

$KC create identity-provider/instances -r inarow \
  -s alias=google -s providerId=google -s enabled=true \
  -s trustEmail=true -s 'config.syncMode=IMPORT' \
  -s "config.clientId=${GOOGLE_CLIENT_ID}" \
  -s "config.clientSecret=${GOOGLE_CLIENT_SECRET}" \
  -s 'config.defaultScope=openid email profile'

echo "Google IdP added. Redirect URI to register in Google Cloud:"
echo "  http://localhost:8180/realms/inarow/broker/google/endpoint"
