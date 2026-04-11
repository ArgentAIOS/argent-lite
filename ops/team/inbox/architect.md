# Task 010 — architect

Contract: ops/contracts/architect.contract.md
Slice: intent-routing-design
Branch: codex/intent-routing-design (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/intent-routing-design.md

## Goal

`ops/projects/intent-routing-design.md` (≤150 lines, §9 shape): how
does Argent Lite decide which agent handles an incoming channel message?

1. Intent model — what is an "intent" (string kind + payload schema).
2. Routing strategies: static (channel → agent), keyword-based,
   LLM-classified (uses router).
3. Registry: `IntentRouter` interface — `register(intent, handler)`, `dispatch(msg) → agentId`.
4. Fallback + conflict resolution.
5. Candidate files: `src/intents/**`.
6. Integration with channels (how channel output becomes intent dispatch).
7. Acceptance criteria + phased sub-slices.

SELF-COMMIT, PUSH, PR. Deadline: before next cron tick.
