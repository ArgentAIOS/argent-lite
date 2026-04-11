# Task 013 — architect

Contract: ops/contracts/architect.contract.md
Slice: phase3-bugfix-plan
Branch: codex/phase3-bugfix-plan (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/phase3-bugfix-plan.md

## Context

Threadmaster ran the Phase 3 §4 acceptance smoke against real ollama
and found three integration bugs. Unit tests all pass (188/188) but
end-to-end does NOT:

1. **Event-kind mismatch:** `src/router/memory-router.ts` writes kinds
   `router.route` and `router.error`, but
   `src/runtime/event-kinds.ts` (cycle-12 lock) defines the allowed set
   as `channel.in | channel.out | router.in | router.out | agent.error`.
   runtime.ts has a fallback allowlist that still has the old kinds,
   so the dynamic-import of the real lock is actually a regression.
2. **Bus → agent wiring missing:** `bootRuntime` subscribes to `"router"`
   and logs `channel.in`, but never delivers the message to the
   `RouterAgent` instance. `RouterAgent.onMessage` is never called.
3. **Reply routing:** CliStdioChannel subscribes to `"cli"`, but
   RouterAgent's completion goes to `msg.from` (which is `"cli"` only
   because the channel sets it that way). Verify the path end-to-end.

Evidence: smoke run on `codex/ops-team-bootstrap` at 6b8a165.
After piping `"say hi"` into chat, `memory.sqlite` contained only
one `channel.in` row — zero `router.*` or `channel.out` rows.

## Goal

Write `ops/projects/phase3-bugfix-plan.md` (≤100 lines):

1. Restate the 3 bugs with line-level citations.
2. For each bug: the canonical fix — which file owns the fix, what
   the signature/behavior must be, and which test must now pass.
3. Resolve the event-kind vocabulary question: should
   `memory-router.ts` change its kinds, or should the vocabulary
   include `router.route`/`router.error`? Pick ONE and explain why.
4. Propose sub-slices for cycle-14 if needed.

SELF-COMMIT, PUSH, PR to codex/ops-team-bootstrap.

## Deadline: before next cron tick.
