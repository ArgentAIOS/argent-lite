# Task 017 — engineer-router

Contract: ops/contracts/engineer-router.contract.md
Slice: router-cost-policy
Branch: codex/router-cost-policy (worktree /home/jason/code/argent-lite-router)
Surface:
- ops/team/outbox/engineer-router.md
- src/router/cost-policy.ts
- tests/router/cost-policy.test.ts

## Goal

Implement a concrete cost-aware routing strategy. Today
`selectProviders` has a `"cost"` enum value but no implementation.

1. **`src/router/cost-policy.ts`**:
   ```ts
   export interface ProviderCost {
     providerId: string;
     costPerToken: number;  // USD per output token, 0 for local
     latencyMsP50: number;  // rough p50 observed
   }
   export interface CostPolicyOptions {
     costs: ProviderCost[];
     maxTokensBudget?: number;   // skip if prompt exceeds
     preferLocal?: boolean;      // default true — break ties in favor of cost=0
   }
   export function selectByCost(
     providers: Provider[],
     policy: CostPolicyOptions,
   ): Provider[];
   ```
   - Returns a sorted list of providers by (cost asc, latency asc),
     filtered to providers present in both lists.
   - `preferLocal` means all cost-0 providers come first.
2. **`tests/router/cost-policy.test.ts`**:
   - 3 providers with different costs → sorted ascending.
   - Tiebreaker on latency.
   - `preferLocal` puts cost-0 first even if latency worse.
   - Empty providers → empty output.
   - Missing cost entry → provider omitted.

## Constraints

- Do NOT touch `src/router/policy.ts`, `router.ts`, `types.ts` — new file only.
- `import type` for `Provider` from `./types.js`.
- Strict TS, no `any`.

## Deadline: before next cron tick. SELF-COMMIT, PUSH, PR.
