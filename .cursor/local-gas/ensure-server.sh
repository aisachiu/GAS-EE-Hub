#!/usr/bin/env bash
set -euo pipefail

port="${EE_HUB_PORT:-8787}"
log="${EE_HUB_LOG:-/tmp/ee-hub.log}"
root="/workspace"

if curl -sf "http://127.0.0.1:${port}/health" >/dev/null; then
  exit 0
fi

if [ -f "$root/.cursor/local-gas/server.mjs" ]; then
  server="$root/.cursor/local-gas/server.mjs"
elif [ -f /opt/ee-hub/server.mjs ]; then
  server="/opt/ee-hub/server.mjs"
else
  echo "EE Hub local runtime is not in this revision."
  exit 0
fi

setsid nohup node "$server" >>"$log" 2>&1 < /dev/null &

for _ in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:${port}/health" >/dev/null; then
    exit 0
  fi
  sleep 0.2
done

echo "VSA EE Hub did not become ready. Log follows:" >&2
tail -n 80 "$log" >&2 || true
exit 1
