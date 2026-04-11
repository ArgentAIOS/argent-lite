# Phase 3 Runtime Smoke

A reproducible, self-verifying smoke test for the Argent Lite runtime seam
(`src/integration/runtime.ts`). Drives the full channel → router → memory
path with a stub provider so it works in CI without ollama, Hailo, or any
network dependency.

## Why this exists

Threadmaster ran the Phase 3 §4 one-liner by hand during cycle-12 and
found bugs that no automated check had caught. The smoke turns that
manual ritual into a scripted pass/fail so the next integration cycle
can assert the runtime boot → prompt → completion → memory-append chain
without a human in the loop.

## How to run locally

```bash
bash scripts/phase3-smoke.sh
```

Requirements:

- Node ≥ 22 (uses the built-in `node:sqlite` module)
- `pnpm` on `$PATH`
- Repo checked out with `pnpm install` already run

The script is idempotent and cleans up its temp `ARGENT_HOME` on exit.

You can also invoke the vitest wrapper:

```bash
pnpm test -- smoke-runner
```

The wrapper shells out to `scripts/phase3-smoke.sh` via `execFile` and
asserts exit 0. If the script file is absent (e.g. on an older branch),
the test is skipped instead of failing.

## What it checks

1. `pnpm build` succeeds and emits `dist/src/integration/runtime.js`.
2. A fresh temp `ARGENT_HOME` is created and used as `memoryPath`.
3. The runtime boots with a stub provider that returns
   `stub:<prompt>` and is driven through stdin with one prompt line
   (`hello smoke`).
4. The runtime shuts down cleanly after stdin ends.
5. The SQLite memory store at `$ARGENT_HOME/memory.sqlite` contains, for
   `agent_id = 'router'`:
   - `channel.in >= 1`, AND
   - `channel.out >= 1` OR `router.out`/`router.route` >= 1

The event counts are printed so failures are diagnosable at a glance.

## What a failure means

| Failure | Likely cause |
| --- | --- |
| `pnpm build` non-zero | TypeScript regression — fix before integration |
| `expected compiled runtime at dist/src/integration/runtime.js` | `tsconfig` outDir/rootDir drift or missing `src/integration/runtime.ts` |
| `memory db was not created` | `bootRuntime` did not honor `memoryPath`, or `node:sqlite` unavailable |
| `channel.in = 0` | Channel → bus wiring broken; prompt never reached the router |
| `channel.out = 0 AND router.out/route = 0` | Router never completed, or memory subscriptions not firing |

All failures print the recorded event-kind counts as JSON so you can
tell which hop in the chain silently dropped work.

## What it does NOT check

- Real provider behavior (ollama, Anthropic, OpenAI, Hailo)
- Concurrency / back-pressure
- Retention / pruning
- Multi-turn conversation state

Those belong to separate slices. This smoke is strictly a boot + one
round-trip + shutdown liveness check.
