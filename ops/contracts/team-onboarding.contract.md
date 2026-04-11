# Contract: team-onboarding

**Applies to:** every agent on the ops-team, every session, every task.
**Owner:** threadmaster
**Enforcement:** the team lead rejects any work product that violates this contract.

## Preconditions (must be true before any tool call that writes)

1. The agent has read `ops/CLAUDE.md` in the current session.
2. The agent has read `ops/rules/never-do.md`, `ops/rules/branching.md`,
   `ops/rules/agent-coordination.md`, `ops/rules/linear.md`.
3. The agent has read the role contract that matches its role
   (`architect.contract.md`, `engineer.contract.md`, or
   `reviewer.contract.md`).
4. The agent has read `ops/slices/REGISTRY.md` and `ops/projects/ACTIVE.md`.
5. The agent has posted the confirmation line (see below) before its first
   write.

## Confirmation line (mandatory, first message)

> I have read `ops/` and am operating under contract:
> `ops/contracts/<role>.contract.md`.

If you cannot truthfully post this line, stop and tell the team lead what
is missing. Do not fabricate.

## Inputs

- A task file under `ops/team/inbox/<role>.md` containing a single task,
  a contract reference, and an acceptance criterion.
- Read access to the full `ops/` tree.
- A `codex/*` branch already created by the team lead if the task writes
  repo files; otherwise the agent works read-only.

## Outputs

- A reply file at `ops/team/outbox/<role>.md` containing:
  - the confirmation line
  - one short summary of what was done or found
  - a list of files touched (or `none` for read-only tasks)
  - the contract reference the work traces back to
  - any blockers or open questions
- For write tasks: commits on the assigned branch with the task ID in the
  commit body.

## Prohibited

- Editing files outside the claimed slice surface (see REGISTRY).
- Pushing to `main`.
- Invoking `npx ctx7@latest` or external network calls unless the task
  explicitly requires docs lookup.
- Creating new contracts or runbooks. Only the team lead authors those.
- Marking a task complete while its acceptance criterion is unmet.

## Failure mode

If any precondition is false, write a single-line outbox entry:

> BLOCKED: <reason>. Awaiting team lead.

and stop. Do not work around missing context.
