#!/usr/bin/env bash
#
# phase3-smoke.sh — reproducible, self-verifying Phase 3 runtime smoke.
#
# Drives the integration runtime end-to-end with a stub provider (no
# ollama, no network), persists events to a temp SQLite memory store,
# then asserts the expected event kinds were recorded.
#
# Exit 0 on pass, 1 on fail.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

log() { printf '[phase3-smoke] %s\n' "$*"; }
fail() { printf '[phase3-smoke][FAIL] %s\n' "$*" >&2; exit 1; }

RUNTIME_DIST="dist/src/integration/runtime.js"

log "step 1/4: pnpm build"
pnpm build >/dev/null

if [[ ! -f "${RUNTIME_DIST}" ]]; then
  fail "expected compiled runtime at ${RUNTIME_DIST} after pnpm build"
fi

ARGENT_HOME="$(mktemp -d)"
trap 'rm -rf "${ARGENT_HOME}"' EXIT
export ARGENT_HOME
MEMORY_DB="${ARGENT_HOME}/memory.sqlite"
log "step 2/4: ARGENT_HOME=${ARGENT_HOME}"

log "step 3/4: drive runtime with stub provider"
# The runtime shuts itself down after stdin ends and the router has had
# time to emit channel.out. We pipe a single prompt line via a heredoc.
ARGENT_MEMORY_PATH="${MEMORY_DB}" node --input-type=module -e "
import { bootRuntime } from './dist/src/integration/runtime.js';

const stub = {
  id: 'stub',
  kind: 'local',
  async complete(req) {
    return { text: 'stub:' + req.prompt, model: 'stub', providerId: 'stub' };
  },
  async healthCheck() { return true; },
};

const runtime = await bootRuntime({
  stdin: process.stdin,
  stdout: process.stdout,
  memoryPath: process.env.ARGENT_MEMORY_PATH,
  providers: [stub],
});

let drained = false;
process.stdin.once('end', () => { drained = true; });
while (!drained) {
  await new Promise((r) => setTimeout(r, 50));
}
await new Promise((r) => setTimeout(r, 2000));
await runtime.shutdown();
process.exit(0);
" <<< "hello smoke"

if [[ ! -f "${MEMORY_DB}" ]]; then
  fail "memory db was not created at ${MEMORY_DB}"
fi

log "step 4/4: assert event kinds in ${MEMORY_DB}"
ARGENT_MEMORY_PATH="${MEMORY_DB}" node --input-type=module -e "
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.ARGENT_MEMORY_PATH);
const rows = db
  .prepare('SELECT kind, COUNT(*) AS n FROM events WHERE agent_id = ? GROUP BY kind')
  .all('router');
db.close();

const counts = Object.create(null);
for (const row of rows) counts[row.kind] = Number(row.n);
console.log('[phase3-smoke] event counts:', JSON.stringify(counts));

const channelIn = counts['channel.in'] ?? 0;
const channelOut = counts['channel.out'] ?? 0;
const routerOut = (counts['router.out'] ?? 0) + (counts['router.route'] ?? 0);

if (channelIn < 1) {
  console.error('[phase3-smoke][FAIL] channel.in = ' + channelIn + ' (< 1)');
  process.exit(1);
}
if (channelOut < 1 && routerOut < 1) {
  console.error('[phase3-smoke][FAIL] channel.out=' + channelOut + ', router.out/route=' + routerOut + ' — need at least one');
  process.exit(1);
}
console.log('[phase3-smoke] PASS: channel.in=' + channelIn + ', channel.out=' + channelOut + ', router.out/route=' + routerOut);
" 2>&1

log "smoke passed"
