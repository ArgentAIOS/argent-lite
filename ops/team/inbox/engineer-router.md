# Task 003 — engineer-router

Contract: ops/contracts/engineer-router.contract.md (symlink to engineer.contract.md)
Runbooks: ops/runbooks/slice-management.md, ops/runbooks/dev-workflow.md
Slice: model-router-lite
Branch: codex/model-router-lite (in worktree /home/jason/code/argent-lite-router)
Surface (WRITE authorized — nothing else):
- ops/team/outbox/engineer-router.md
- src/router/index.ts                       (create)
- src/router/router.ts                      (create)
- src/router/policy.ts                      (create)
- src/router/types.ts                       (create)
- src/providers/index.ts                    (create)
- src/providers/provider.ts                 (create — interface only)
- src/providers/ollama.ts                   (create — local backend)
- src/providers/anthropic.ts                (create — cloud backend)
- src/providers/openai.ts                   (create — cloud backend)
- tests/router/router.test.ts               (create)
- tests/router/policy.test.ts               (create)
- tests/providers/ollama.test.ts            (create)

## Context

Operator approved Phase 1 on 2026-04-11. The model router is the
backbone of Phase 1: it accepts a request and dispatches it to a local
LLM (ollama) or a cloud provider (Anthropic, OpenAI). Routing is policy-
driven. The auth/credential store is implemented in parallel by
engineer-auth on `codex/provider-auth` — you'll integrate after both
branches land.

## Goal

Implement a provider-agnostic router and three provider adapters.

```ts
export interface CompletionRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResponse {
  text: string;
  model: string;
  providerId: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface Provider {
  id: string;
  kind: "local" | "cloud";
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  healthCheck(): Promise<boolean>;
}

export interface Router {
  route(req: CompletionRequest): Promise<CompletionResponse>;
  register(provider: Provider): void;
}
```

1. `src/router/types.ts` — exports the types above and a
   `RoutePolicy` type (`"local-first" | "cloud-first" | "cost" | "manual"`).
2. `src/router/policy.ts` — pure functions that pick a provider from a
   list given a `RoutePolicy` and optional request hints. No side effects.
3. `src/router/router.ts` — class `ModelRouter` implementing `Router`.
   Constructor takes an initial policy. `register(provider)` adds to an
   internal Map. `route(req)` picks via policy, falls back to next provider
   on failure (retry budget: 2), rethrows if all fail.
4. `src/router/index.ts` — re-exports the public surface and a
   `createRouter(opts)` factory.
5. `src/providers/provider.ts` — just the `Provider` interface re-export.
6. `src/providers/ollama.ts` — calls `http://localhost:11434/api/generate`
   via Node's built-in `fetch`. Model defaults to `gemma3:1b`. No deps.
7. `src/providers/anthropic.ts` — POST to
   `https://api.anthropic.com/v1/messages`, reads API key via a `getKey`
   callback (injected — does NOT import `src/auth`; the CLI wires them
   together). Model defaults to `claude-haiku-4-5-20251001`.
8. `src/providers/openai.ts` — POST to
   `https://api.openai.com/v1/chat/completions`, same pattern, model
   defaults to `gpt-4o-mini`.
9. `src/providers/index.ts` — re-exports.
10. Tests:
    - `router.test.ts` — registers two mock providers, asserts routing
      picks the right one per policy, asserts fallback on failure.
    - `policy.test.ts` — pure-function tests for each policy branch.
    - `ollama.test.ts` — mocks `fetch` and asserts the request URL and
      body shape. Does NOT actually hit localhost.

## Constraints

- No new dependencies. Node built-ins only (`fetch` is global on Node 22).
- Do not `import` from `src/auth/` — auth is injected. Wiring happens
  later in the CLI.
- Do not touch `src/cli/`, `src/config/`, `src/auth/`, or `package.json`.
- Strict TypeScript, ESM, no `any`.

## Acceptance criterion

- All 12 files exist at the paths above.
- `ollama.test.ts`, `router.test.ts`, `policy.test.ts` contain real
  assertions — no `expect(true).toBe(true)` placeholders.
- `ops/team/outbox/engineer-router.md` has confirmation line, files
  touched, commits (SHAs), and note on whether tests ran.

## Validation commands

- `ls src/router/ src/providers/ tests/router/ tests/providers/`
- `wc -l src/router/*.ts src/providers/*.ts` — report line counts.
- If `package.json` exists in your worktree: `pnpm test -- tests/router tests/providers`.

## Deadline

Before the next operator check-in (target: 45–60 minutes).
