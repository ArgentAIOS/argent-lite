#!/usr/bin/env bash
#
# phase3-ollama-smoke.sh — real-ollama Phase 3 §4 smoke.
#
# Drives the integration runtime end-to-end against a live ollama daemon
# on localhost:11434 using the OllamaProvider and gemma3:1b. Intended to
# run by hand (or on a dedicated Pi) after the canonical stub smoke
# (`scripts/phase3-smoke.sh`) has already passed in CI.
#
# Exit codes:
#   0  — full pass (channel.in >= 1, router.out >= 1, channel.out >= 1)
#   1  — failure (assertions unmet, ollama error, or runtime crash)
#   77 — skip (ollama unreachable, or Pi 1-min load average > 6.0)
#
# All output is tee'd to /tmp/ollama-smoke-<epoch>.log.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

LOG="/tmp/ollama-smoke-$(date +%s).log"
exec > >(tee -a "${LOG}") 2>&1

log()  { printf '[ollama-smoke] %s\n' "$*"; }
fail() { printf '[ollama-smoke][FAIL] %s\n' "$*" >&2; exit 1; }
skip() { printf '[ollama-smoke][SKIP] %s\n' "$*" >&2; exit 77; }

log "log file: ${LOG}"

# --- precondition 1: ollama reachable ----------------------------------------
log "step 1/5: probe http://localhost:11434/api/tags"
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
  http://localhost:11434/api/tags || echo 000)"
if [[ "${HTTP_CODE}" != "200" ]]; then
  skip "ollama /api/tags returned ${HTTP_CODE} (expected 200)"
fi

# --- precondition 2: pi not overloaded ---------------------------------------
log "step 2/5: check /proc/loadavg"
LOAD1="$(awk '{print $1}' /proc/loadavg)"
log "1-min load average: ${LOAD1}"
# bash has no float compare; use awk
if awk -v l="${LOAD1}" 'BEGIN { exit !(l+0 > 6.0) }'; then
  skip "pi overloaded (1-min load ${LOAD1} > 6.0)"
fi

# --- build if stale ----------------------------------------------------------
RUNTIME_DIST="dist/src/integration/runtime.js"
log "step 3/5: ensure ${RUNTIME_DIST} is built"
NEED_BUILD=0
if [[ ! -f "${RUNTIME_DIST}" ]]; then
  NEED_BUILD=1
else
  NEWEST_SRC="$(find src -type f -newer "${RUNTIME_DIST}" -print -quit 2>/dev/null || true)"
  if [[ -n "${NEWEST_SRC}" ]]; then
    NEED_BUILD=1
  fi
fi
if [[ "${NEED_BUILD}" -eq 1 ]]; then
  log "dist stale — running pnpm build"
  pnpm build >/dev/null
fi
if [[ ! -f "${RUNTIME_DIST}" ]]; then
  fail "expected ${RUNTIME_DIST} after build"
fi

# --- drive runtime with real ollama ------------------------------------------
ARGENT_HOME="$(mktemp -d)"
trap 'rm -rf "${ARGENT_HOME}"' EXIT
export ARGENT_HOME
MEMORY_DB="${ARGENT_HOME}/memory.sqlite"
log "step 4/5: ARGENT_HOME=${ARGENT_HOME}"
log "driving runtime with OllamaProvider(gemma3:1b) — 45s timeout"

set +e
ARGENT_MEMORY_PATH="${MEMORY_DB}" timeout 45 node --input-type=module -e "
import { bootRuntime } from './dist/src/integration/runtime.js';
import { OllamaProvider } from './dist/src/providers/ollama.js';

const provider = new OllamaProvider({ defaultModel: 'gemma3:1b' });

const runtime = await bootRuntime({
  stdin: process.stdin,
  stdout: process.stdout,
  memoryPath: process.env.ARGENT_MEMORY_PATH,
  providers: [provider],
});

let drained = false;
process.stdin.once('end', () => { drained = true; });
while (!drained) {
  await new Promise((r) => setTimeout(r, 50));
}
await new Promise((r) => setTimeout(r, 5000));
await runtime.shutdown();
process.exit(0);
" <<< "what is 2+2 in one word"
RUN_RC=$?
set -e

if [[ "${RUN_RC}" -eq 124 ]]; then
  fail "runtime hit 45s timeout (ollama too slow)"
fi
if [[ "${RUN_RC}" -ne 0 ]]; then
  fail "runtime exited ${RUN_RC}"
fi
if [[ ! -f "${MEMORY_DB}" ]]; then
  fail "memory db not created at ${MEMORY_DB}"
fi

# --- assert event counts -----------------------------------------------------
log "step 5/5: assert event kinds in ${MEMORY_DB}"
ARGENT_MEMORY_PATH="${MEMORY_DB}" node --input-type=module -e "
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.ARGENT_MEMORY_PATH);
const rows = db
  .prepare('SELECT kind, COUNT(*) AS n FROM events WHERE agent_id = ? GROUP BY kind')
  .all('router');
db.close();

const counts = Object.create(null);
for (const row of rows) counts[row.kind] = Number(row.n);
console.log('[ollama-smoke] event counts:', JSON.stringify(counts));

const channelIn  = counts['channel.in']  ?? 0;
const channelOut = counts['channel.out'] ?? 0;
const routerOut  = (counts['router.out'] ?? 0) + (counts['router.route'] ?? 0);

let ok = true;
if (channelIn  < 1) { console.error('[ollama-smoke][FAIL] channel.in  = ' + channelIn);  ok = false; }
if (routerOut  < 1) { console.error('[ollama-smoke][FAIL] router.out  = ' + routerOut);  ok = false; }
if (channelOut < 1) { console.error('[ollama-smoke][FAIL] channel.out = ' + channelOut); ok = false; }
if (!ok) process.exit(1);

console.log('[ollama-smoke] PASS: channel.in=' + channelIn + ', router.out=' + routerOut + ', channel.out=' + channelOut);
"

log "ollama smoke PASS — log saved to ${LOG}"
exit 0
