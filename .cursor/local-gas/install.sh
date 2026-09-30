#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

node --check Code.js
node --check Backend.js
node --check ActionItemEngine.js
node --check Audit.js
node --check PhaseRules.js
node --check .cursor/local-gas/server.mjs
