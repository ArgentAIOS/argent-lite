# Task 013 — engineer-floor

Contract: ops/contracts/engineer-floor.contract.md
Slice: phase3-smoke-script
Branch: codex/phase3-smoke-script (worktree /home/jason/code/argent-lite-floor)
Surface:
- ops/team/outbox/engineer-floor.md
- scripts/phase3-smoke.sh
- tests/integration/smoke-runner.test.ts
- docs/phase3-smoke.md

## Context

Threadmaster ran the §4 one-liner manually and found bugs. Make the
smoke reproducible and self-verifying so the next integration pass
can assert pass/fail without a human.

## Goal

1. **`scripts/phase3-smoke.sh`** — bash, `set -euo pipefail`:
   - Build the project (`pnpm build`)
   - Create an `ARGENT_HOME=$(mktemp -d)` temp dir
   - Run the runtime with a stub provider (not ollama) via a small
     Node inline script so the smoke works in CI without ollama:
     ```
     node -e "
       import('./dist/src/integration/runtime.js').then(async r => {
         const { bootRuntime } = r;
         const stub = { id:'stub', kind:'local',
           async complete(req){ return { text: 'stub:'+req.prompt, model:'stub', providerId:'stub' }; },
           async healthCheck(){ return true; } };
         const runtime = await bootRuntime({ stdin: process.stdin, stdout: process.stdout, memoryPath: process.env.ARGENT_HOME+'/memory.sqlite', providers: [stub] });
         let drained = false;
         process.stdin.once('end', ()=>{ drained=true; });
         while(!drained) await new Promise(r=>setTimeout(r,50));
         await new Promise(r=>setTimeout(r,2000));
         await runtime.shutdown();
         process.exit(0);
       });
     " <<< "hello smoke"
     ```
   - Query the memory DB with `node --experimental-sqlite -e '...'`:
     assert `channel.in >= 1`, `channel.out >= 1` OR `router.out >= 1`.
   - Exit 0 on pass, 1 on fail. Log what it found.
2. **`tests/integration/smoke-runner.test.ts`** — a vitest that
   invokes the bash script via `child_process.execFile`, asserts exit 0.
   Skip if the script is not present (for old branches).
3. **`docs/phase3-smoke.md`** — one page: why this exists, how to run
   it locally, what it checks, what a failure means.

## Constraints

- Pure bash + node for the script. No new deps.
- Do NOT touch src/** runtime code. You are only writing test harness
  + docs.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
