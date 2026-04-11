# Task 006 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: context-router-bridge
Branch: codex/context-router-bridge (worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/agents/context-with-router.ts
- tests/agents/context-with-router.test.ts
- src/router/default-router.ts
- tests/router/default-router.test.ts

## Context

Phase 2 kept agents and router intentionally decoupled. Cycle-6 adds a
thin **optional** bridge so an agent that wants an LLM call can ask
its `AgentContext` for a router, without the base `AgentContext`
hard-coupling to `src/router/**`.

## Goal

1. **`src/agents/context-with-router.ts`** — exports:
   ```ts
   import type { AgentContext } from "./agent-context.js";
   import type { Router } from "../router/index.js";
   export interface AgentContextWithRouter extends AgentContext {
     router: Router;
   }
   export function withRouter(ctx: AgentContext, router: Router): AgentContextWithRouter {
     return { ...ctx, router };
   }
   ```
2. **`tests/agents/context-with-router.test.ts`** — construct a base
   `AgentContext` (mock logger, bus, abort), wrap with a mock router,
   assert the wrapped context has both the original fields and the router.
3. **`src/router/default-router.ts`** — `createDefaultRouter()` factory
   that returns a fully-wired `ModelRouter`:
   - Policy: `"local-first"`.
   - Registers `OllamaProvider` (always, local).
   - Registers `AnthropicProvider` and `OpenAIProvider` with `getKey`
     backed by an injected `CredentialStore`. Credential store is
     **injected** as an argument (`createDefaultRouter({ credentials })`),
     NOT imported from `src/auth/**`.
4. **`tests/router/default-router.test.ts`** — inject a fake credential
   store, assert the router lists 3 providers, assert `route()` fails
   gracefully when ollama isn't reachable (mock `fetch`).

## Constraints

- Do NOT import from `src/auth/**` directly. Credential store is injected.
- Do NOT touch `src/agents/base-agent.ts`, `src/agents/agent-context.ts`,
  `src/agents/message-bus.ts` — those are engineer-auth's territory.
- Strict TS, ESM `.js` specifiers, no `any`.

## Acceptance criterion

- 4 files created.
- `pnpm check` and `pnpm test tests/agents/context-with-router tests/router/default-router` pass.
- SELF-COMMIT, PUSH, `gh pr create --base codex/ops-team-bootstrap --head codex/context-router-bridge`.

## Deadline

Before next cron tick.
