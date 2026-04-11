# Workflow: team-task-claim

> How a task moves from the team lead to a teammate and back. Every task
> given to architect, engineer, or reviewer uses this exact flow. No
> improvisation.

## File layout

```
ops/team/
├── inbox/
│   ├── architect.md
│   ├── engineer.md
│   └── reviewer.md
├── outbox/
│   ├── architect.md
│   ├── engineer.md
│   └── reviewer.md
└── status.md            # team lead writes a rolling status here
```

One live task per teammate at a time. The team lead overwrites the inbox
file to assign a new task; the teammate overwrites the outbox file when
done. No queues, no history files — history lives in commits and JOURNAL.

## States

```
empty        → inbox file exists, outbox empty
assigned     → inbox file has a task, outbox empty or stale
acknowledged → teammate posted confirmation line to outbox
in-progress  → teammate has started touching files (architect/engineer)
               or reading artifacts (reviewer)
delivered    → outbox file has full output shape per role contract
blocked      → outbox contains a single `BLOCKED:` line
accepted     → team lead has read outbox and marked task complete
rejected     → team lead sends a new inbox task referencing the failure
```

## Mandatory inbox template

```markdown
# Task <id> — <role>

Contract: ops/contracts/<role>.contract.md
Runbooks: <comma-separated list>
Slice: <slice-name or "n/a">
Branch: <codex/... or "n/a">
Surface: <exact file paths or "read-only">

## Goal

<one sentence — what the team lead wants>

## Acceptance criterion

<one bullet the team lead will check>

## Validation commands (engineer only)

<commands with expected exit codes, or "n/a">

## Deadline

<absolute timestamp or "none">
```

Missing any field = teammate replies `BLOCKED` per the team-onboarding
contract.

## Mandatory outbox shape

See the role contract under `ops/contracts/`. The team lead rejects any
outbox that does not match the shape for the role.

## Rejection

Rejection is not a conversation. The team lead writes a new inbox task
that references the rejected outbox by commit SHA and names the specific
failure. The teammate does not argue — it either produces a new outbox
that satisfies the criterion or replies `BLOCKED`.

## Status reporting

The team lead writes `ops/team/status.md` every time the operator asks,
or every 5 minutes during active team operation. Format:

```
Team Status — <iso timestamp>

architect: <state>  <one-line summary>
engineer:  <state>  <one-line summary>
reviewer:  <state>  <one-line summary>

Blockers: <list or "none">
Next:     <what the team lead is about to assign>
```
