#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p certificates

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is required. Install it from https://github.com/FiloSottile/mkcert, then run this command again."
  exit 1
fi

mkcert -install
mkcert \
  -cert-file certificates/local-ip.pem \
  -key-file certificates/local-ip-key.pem \
  localhost 127.0.0.1 192.168.68.64

echo
echo "Certificate created for https://192.168.68.64:3001"
echo "Trust the mkcert root CA on every device that will open the site:"
echo "  $(mkcert -CAROOT)/rootCA.pem"
