# Task 001 — architect

Contract: ops/contracts/architect.contract.md
Runbooks: ops/runbooks/research-planning.md, ops/runbooks/slice-management.md
Slice: argent-lite-scope-decision (to be proposed, not claimed)
Branch: n/a (read-only; produce memo only)
Surface: read-only except ops/team/outbox/architect.md

## Goal

Produce a one-page decision memo framing the Argent Lite scope question.
The repo must support **two deployment modes** from one codebase:
(1) satellite mode federating to the operator's Mac-based Argent, and
(2) standalone Lite mode with a local LLM (Hailo/ollama) plus pluggable
cloud providers (Anthropic, OpenAI, etc.) reached via API + auth.

For each of these argentos-core subsystems, recommend **IN / OUT / DEFER**
and cite the rule or runbook that supports the call:

- channels (Slack, email, web, CLI, etc.)
- agent department structure (18-agent model in core)
- MemU memory layer
- contemplation engine
- intent system
- model router
- React dashboard vs. headless
- provider auth + credential storage (new requirement for standalone mode)

Do **not** propose implementation. Do **not** claim the slice. The output
is a memo the team lead uses to decide whether to open the real research
slice and who owns it.

## Acceptance criterion

Memo at `ops/team/outbox/architect.md` matches the output shape in
`ops/contracts/architect.contract.md`, has a concrete IN/OUT/DEFER call
for each subsystem above, and names at least one follow-on slice.

## Validation commands

n/a (no code).

## Deadline

Before the next operator check-in.
