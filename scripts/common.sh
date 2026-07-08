#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
JQ_BIN="${JQ_BIN:-jq}"

require_bin() {
  local bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Missing required binary: $bin" >&2
    exit 1
  fi
}

require_bin curl
require_bin "$JQ_BIN"

http_json() {
  local method="$1"
  local path="$2"
  local auth="${3:-}"
  local data="${4:-}"
  if [[ -n "$auth" && -n "$data" ]]; then
    curl -sf -X "$method" "$API_URL$path" \
      -H "Authorization: Bearer $auth" \
      -H 'Content-Type: application/json' \
      -d "$data"
  elif [[ -n "$auth" ]]; then
    curl -sf -X "$method" "$API_URL$path" \
      -H "Authorization: Bearer $auth"
  elif [[ -n "$data" ]]; then
    curl -sf -X "$method" "$API_URL$path" \
      -H 'Content-Type: application/json' \
      -d "$data"
  else
    curl -sf -X "$method" "$API_URL$path"
  fi
}

login_token() {
  local email="$1"
  http_json POST "/api/v1/auth/login" "" "{\"email\":\"$email\"}" | "$JQ_BIN" -r .access_token
}
