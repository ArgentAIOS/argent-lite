# Task 020 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: satellite-mode-wiring
Branch: codex/satellite-mode-wiring (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/agents/satellite-agent.ts
- tests/agents/satellite-agent.test.ts
- src/integration/runtime.ts                   (edit — mode switch)
- tests/integration/runtime-satellite.test.ts

## Goal

Make `bootRuntime()` actually do something different when
`mode === "satellite"`: delegate prompts to the Mac brain over HTTP via
`createRuntimeSatelliteClient`, with automatic fallback to the local
router on satellite failure.

### 1. `src/agents/satellite-agent.ts`

```ts
import { BaseAgent } from "./base-agent.js";
import type { AgentContext } from "./agent-context.js";
import type { AgentMessage } from "./types.js";
import type { RuntimeSatelliteClient } from "../satellite/runtime-client.js";
import type { Router } from "../router/index.js";

export interface SatelliteAgentOptions {
  client: RuntimeSatelliteClient;
  fallbackRouter?: Router;    // if set, use on satellite error
}

export class SatelliteAgent extends BaseAgent {
  // onMessage: if msg.kind === "prompt" and payload has {prompt},
  // call client.request({id, kind: "completion", payload: {prompt}, ts}).
  // On success: bus.send completion reply.
  // On failure: if fallbackRouter, call router.route; else bus.send error.
  // run(): same lifecycle-wait pattern as RouterAgent.
}
```

### 2. `src/integration/runtime.ts` — add mode-aware agent selection

Read `RuntimeOptions.mode` (new optional field, default `"standalone"`).
If mode is `"satellite"`, require `opts.satellite` with `{baseUrl, secret, fallback?: boolean}`.
Construct a `SatelliteAgent` and register that as the `"router"`-addressed agent instead of the existing `RouterAgent`.
Keep the local `ModelRouter` as the fallback when `opts.satellite.fallback !== false`.

Signature additions (only additive — preserves backward compat):

```ts
export interface RuntimeOptions {
  // ...existing fields...
  mode?: "standalone" | "satellite";
  satellite?: {
    baseUrl: string;
    secret: string;
    fallback?: boolean;
  };
}
```

If `mode === "satellite"` and `opts.satellite` is missing, throw a
clear error (`"bootRuntime: satellite mode requires opts.satellite"`).

### 3. Tests

**`tests/agents/satellite-agent.test.ts`:**
- Mock `RuntimeSatelliteClient`.
- Send a prompt msg → assert client.request called with correct shape.
- On client success → assert completion reply sent to bus.
- On client failure without fallback → assert error reply sent.
- On client failure with fallback router → assert router.route called
  and its reply sent as completion.

**`tests/integration/runtime-satellite.test.ts`:**
- Stub `createRuntimeSatelliteClient` via injection (extend
  `RuntimeOptions` with a `satelliteClient?: RuntimeSatelliteClient`
  test-only option; prefer to take client as a function override
  so production behavior is unchanged).
- Boot runtime with `mode: "satellite"`, inject stub client.
- Send a prompt via PassThrough stdin.
- Assert stdout receives the stub reply.
- Assert memory.sqlite records `channel.in` + `channel.out` + `router.out`
  (or equivalent — verify locked vocab holds).

## Constraints

- Do NOT touch `src/satellite/**` — use as imports only.
- Do NOT touch `src/router/**`.
- Do NOT touch `src/agents/base-agent.ts`, `router-agent.ts`.
- Strict TS, no `any`.
- Backward compat: existing `bootRuntime()` calls without `mode` must
  continue to work unchanged.

## Acceptance criterion

- All 5 files exist (2 new src, 2 new tests, 1 edit of runtime.ts).
- `pnpm check` + `pnpm test tests/agents/satellite-agent tests/integration/runtime-satellite` pass.
- Existing `tests/integration/runtime.test.ts` still passes (backward compat).
- SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

Deadline: before next cron tick.
