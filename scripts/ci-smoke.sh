#!/usr/bin/env bash
set -euo pipefail

# Argent Lite CI smoke test.
# Runs on the self-hosted Pi5 runner against real ollama.
# Invoked by .github/workflows/nightly.yml and runnable locally.

echo "[ci-smoke] $(date -Iseconds) starting in $(pwd)"

pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build

stamp="$(date -Iseconds)"
ARGENT_MODE=standalone node dist/src/cli/index.js "ci smoke ${stamp}"
