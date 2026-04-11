# Task 012 — engineer-auth

Contract: ops/contracts/engineer-auth.contract.md
Slice: agent-context-memory
Branch: codex/agent-context-memory (worktree /home/jason/code/argent-lite-auth)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-auth.md
- src/agents/agent-context.ts
- src/agents/index.ts                         (re-export types)
- tests/agents/agent-context.test.ts
- src/agents/hello-agent.ts                   (update if needed)
- src/agents/router-agent.ts                  (update if needed)
- tests/agents/hello-agent.test.ts            (update construction sites)
- tests/agents/router-agent.test.ts           (update construction sites)
- tests/agents/base-agent.test.ts             (update construction sites)
- tests/agents/context-with-router.test.ts   (update construction sites)
- tests/demo/runner.test.ts                   (update if it constructs AgentContext directly)

## Context

`ops/projects/phase3-acceptance.md` §3.1 and §5(4): `AgentContext` must
carry a `memory: MemoryStore` field. It's optional today. This slice
makes it **required** and updates every construction site.

## Goal

1. **`src/agents/agent-context.ts`** — add `memory: MemoryStore`
   (import `MemoryStore` via `import type` from `../memory/types.js`).
   `createAgentContext({...})` now requires a `memory` argument. If
   callers haven't migrated, they'll fail to compile — that's
   intentional.
2. **`src/agents/index.ts`** — re-export `MemoryStore` type via
   `export type { MemoryStore } from "../memory/types.js";` so agent
   consumers don't need to import from `src/memory` directly.
3. **Update construction sites in this slice's authorized surface**
   so they pass a `memory` argument. For tests, use a tiny in-memory
   fake that implements `MemoryStore` — put it in
   `src/agents/__fixtures__/noop-memory.ts` (also authorized, add to
   surface).
4. **`tests/agents/agent-context.test.ts`** — assert that
   `createAgentContext` throws at runtime if memory is missing (via a
   runtime check since TS will already block it at compile time),
   and round-trip tests for passing a real memory reference through.

### Updated surface (add to authorized list):

- `src/agents/__fixtures__/noop-memory.ts`

## Constraints

- Do NOT touch `src/memory/**`, `src/router/**`, `src/scheduler/**`,
  `src/cli/**`, `src/demo/e2e-runner.ts`, `src/integration/**`,
  `src/intents/**`, `src/channels/**`, `src/satellite/**`, `src/obs/**`,
  `src/providers/**`, `src/config/**`. These either already inject or
  will be updated in follow-on slices.
- Other cycle-12 slices (`phase3-runtime-slice`) consume this update —
  they'll rebase on integration.
- Strict TS, no `any`.

## Acceptance criterion

- `AgentContext.memory` is required (non-optional).
- All agent construction sites in the authorized surface pass a
  `memory` argument.
- `pnpm check` passes.
- `pnpm test tests/agents/` passes (at least for the files in your surface).
- SELF-COMMIT, PUSH, PR.

## Deadline

Before next cron tick.
