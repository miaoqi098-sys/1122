#!/usr/bin/env bash
set -euo pipefail

METHOD="${1:?method required}"
URL="${2:?url required}"
OUTPUT="${3:?output path required}"
shift 3

TOKEN="${DATA_LAYER_TOKEN:?DATA_LAYER_TOKEN is required}"
MAX_ATTEMPTS="${DATA_LAYER_AUTH_MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${DATA_LAYER_AUTH_RETRY_SECONDS:-2}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  CODE=$(curl -sS -o "$OUTPUT" -w '%{http_code}' \
    -X "$METHOD" \
    -H "Authorization: Bearer $TOKEN" \
    "$@" \
    "$URL" || true)

  if [ "$CODE" != "401" ] && [ "$CODE" != "000" ]; then
    printf '%s\n' "$CODE"
    exit 0
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    echo "Data Layer authenticated request did not stabilize after $MAX_ATTEMPTS attempts (last HTTP $CODE)." >&2
    cat "$OUTPUT" >&2 2>/dev/null || true
    exit 1
  fi

  echo "Data Layer auth still propagating (HTTP $CODE, attempt $attempt/$MAX_ATTEMPTS); retrying..." >&2
  sleep "$SLEEP_SECONDS"
done
