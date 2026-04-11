# Argent Lite — Phase 1 Design

**Status:** planning-complete (slice `cli-scaffold`)
**Approval:** operator approved Phase 1 on 2026-04-11
**Scope:** headless CLI that accepts a prompt, routes via the model router,
returns a response. Two runtime modes (`satellite`, `standalone`) selected
at config time. No memory, no agents, no channels beyond CLI.

## 1. Public interfaces (TypeScript-ish shapes)

These are the four contracts every Phase 1 slice must honor. They are
shape-only — no implementation lives in this document.

```ts
// src/config/mode.ts
export type RuntimeMode = "satellite" | "standalone";
export function loadMode(env?: NodeJS.ProcessEnv): RuntimeMode;

// src/router/index.ts  (owned by engineer-router)
export interface Router {
  route(req: RouteRequest): Promise<RouteResponse>;
}
export interface RouteRequest {
  prompt: string;
  mode: RuntimeMode;
  hints?: { preferLocal?: boolean; maxTokens?: number };
}
export interface RouteResponse {
  text: string;
  provider: string;          // e.g. "ollama:gemma3:1b" or "anthropic:claude-..."
  usage?: { inputTokens: number; outputTokens: number };
}

// src/providers/provider.ts  (owned by engineer-router)
export interface Provider {
  readonly id: string;       // stable identifier used by router selection
  readonly kind: "local" | "cloud";
  generate(req: RouteRequest): Promise<RouteResponse>;
}

// src/auth/credential-store.ts  (owned by engineer-auth)
export interface CredentialStore {
  get(providerId: string): Promise<string | undefined>;
  set(providerId: string, secret: string): Promise<void>;
  remove(providerId: string): Promise<void>;
}

// src/cli/index.ts
export interface CliCommand {
  name: string;
  run(argv: string[]): Promise<number>; // exit code
}
```

## 2. Satellite vs standalone — config-level differences

Mode is a single env var, `ARGENT_MODE`, defaulting to `standalone`. Mode
shapes which providers the router is allowed to consult — it does not fork
the codebase.

| Concern              | `standalone`                                  | `satellite`                                       |
| -------------------- | --------------------------------------------- | ------------------------------------------------- |
| Local provider       | required (ollama / Hailo)                     | optional (Mac brain may handle it)                |
| Cloud providers      | enabled if credentials present                | discouraged unless Mac unreachable                |
| Credential store     | local (keyring / encrypted file)              | local, but Mac brain holds primary creds          |
| Default route        | local first, cloud on fallback                | forward to Mac, local on fallback                 |
| Failure if offline   | degrade to local-only, error if no local      | degrade to standalone semantics                   |

The Mac-brain forwarding path is explicitly **out of Phase 1** — satellite
mode in Phase 1 behaves identically to standalone but emits a warning so
that the satellite wiring slice has a real call site to replace later.

## 3. Wiring diagram

```
        argv ─┐
              ▼
        ┌───────────┐    loadMode()    ┌────────────┐
        │  src/cli  │ ───────────────▶ │ src/config │
        └─────┬─────┘                  └────────────┘
              │ RouteRequest
              ▼
        ┌───────────┐
        │ Router    │  (src/router, engineer-router)
        └─────┬─────┘
        select │ provider
              ▼
   ┌──────────┴──────────┐
   ▼                     ▼
┌────────┐          ┌────────┐
│ local  │          │ cloud  │
│ ollama │          │ provider│
└────────┘          └────┬───┘
                         │ needs secret
                         ▼
                   ┌────────────┐
                   │ Credential │  (src/auth, engineer-auth)
                   │   Store    │
                   └────────────┘
```

The CLI owns argv, mode loading, and stdout. The router owns provider
selection. Providers own the wire call. The credential store is consulted
only by cloud providers.

## 4. Acceptance criteria for Phase 1 merge

1. `pnpm test` is green on `codex/ops-team-bootstrap` after the four child
   slices land (`project-floor`, `provider-auth`, `model-router-lite`,
   `cli-scaffold`).
2. `node dist/cli/index.js "hello"` (or the pnpm script equivalent) returns
   a model response in `standalone` mode against a stub provider.
3. `ARGENT_MODE=satellite` boots without crashing and emits the documented
   "Phase 1 satellite stub" warning.
4. `loadMode()` defaults to `standalone` and rejects any other value with a
   typed error.
5. No file outside the four slice surfaces was edited; REGISTRY and
   JOURNAL are updated; reviewer signs off per
   `ops/contracts/reviewer.contract.md`.
6. The four interfaces in §1 are exported with the shapes shown — any
   drift requires an architect amendment to this document.

## 5. Risks and non-goals

- **Non-goal:** real satellite federation. Phase 1 only reserves the mode
  string and the warning hook.
- **Non-goal:** persistent conversation state. Each CLI invocation is a
  one-shot prompt → response.
- **Risk:** Hailo-10H is not yet on the Pi (arrives 2026-04-12). Local
  routing in Phase 1 must work on CPU-only ollama; do not depend on Hailo.
- **Risk:** the four slices land out of order. The CLI guard around the
  router import (try/catch dynamic import) is the mitigation; if router
  is missing, the CLI exits non-zero with a clear message instead of a
  TypeScript build break.

## 6. Follow-on slices (names only — not claims)

- `phase1-integration` — wire the four child branches together and run
  the acceptance script end-to-end.
- `satellite-stub-replacement` — replace the Phase 1 satellite warning
  with a real Mac-brain forwarder once the protocol slice exists.
- `hailo-local-provider` — add a Hailo-backed local provider once the
  hardware is characterized.
