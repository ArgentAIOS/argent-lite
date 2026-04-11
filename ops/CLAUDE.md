# Argent Lite — Agent Context

You are working inside `/home/jason/code/argent-lite`, a private repo at
`github.com/ArgentAIOS/argent-lite`. This file is the onboarding anchor for
any Claude Code agent that lands here. Read it first.

## What this repo is

Argent Lite is a planned lightweight variant of **argentos-core**. It runs
on a Raspberry Pi 5 + Hailo-10H and supports **two deployment modes**:

1. **Satellite mode** — always-on node that federates with the operator's
   Mac-based Argent. Mac is the primary brain; Lite handles local jobs.
2. **Standalone Lite mode** — fully self-contained. Local LLM via
   Hailo/ollama for offline/private work, plus pluggable cloud providers
   (Anthropic, OpenAI, others) reached via API + authenticated credentials
   for tasks that exceed local capacity.

Both modes share one codebase; mode is a runtime configuration, not a
fork. Scope of what actually ports from argentos-core (channels, agents,
memory, router) is **not yet decided** — that is an early research slice,
not an implementation slice.

There is **zero application code** in this repo today. The only shipped
artifact is the Maintainer Gate Blueprint (`ops/`, `scripts/`, `.github/`,
`ops.manifest.json`). Do not invent `package.json`, `src/`, or runtime code
until a scope decision exists in `ops/projects/ACTIVE.md`.

## Required reading (in order, every session)

1. This file — `ops/CLAUDE.md`
2. `ops/rules/never-do.md` — hard prohibitions
3. `ops/rules/branching.md` — branch names and merge lanes
4. `ops/rules/agent-coordination.md` — multi-agent discipline
5. `ops/rules/linear.md` — GitHub Issues policy (file is named `linear.md` for
   historical reasons; contents are the real rules)
6. `ops/contracts/team-onboarding.contract.md` — what every teammate confirms
   before acting
7. The contract matching your role (`architect`, `engineer`, `reviewer`) under
   `ops/contracts/`
8. The workflow your task lives in — usually `ops/workflows/slice-lifecycle.workflow.md`
9. The runbook the contract points you at under `ops/runbooks/`
10. `ops/slices/REGISTRY.md` and `ops/projects/ACTIVE.md` — current state

If any file above is missing, **stop and notify the team lead**. Do not
invent a contract.

## Confirm in your first message

> I have read `ops/` and am operating under contract: `<contract filename>`.

This is not ceremony — it is the audit trail the team lead uses to reject
work that skipped onboarding.

## Environment quick-reference

- OS: Debian 12 on Raspberry Pi 5, 16 GB RAM, hostname `pi5miniAI`
- Node v22.22.2, pnpm 10.33.0, gh 2.89.0 (authed as `webdevtodayjason`)
- Git identity set globally; do not reconfigure
- tmux session name: `agent-lite` (not `argent-lite` — common typo)
- You are probably running as a pane inside that session
- Local LLM stack (CPU only, pre-Hailo-10H): ollama 0.20.5 with `gemma3:1b`
  and `gemma4:e2b` pulled; Hailo-10H hardware arrives 2026-04-12

## How work is claimed

All work flows through slices. Before editing a file:

1. Read `ops/slices/REGISTRY.md`
2. Claim a slice (or refuse the task if one cannot be claimed)
3. Work on a `codex/<slice-name>` branch
4. Update REGISTRY, ACTIVE, and JOURNAL when done
5. Hand off per `ops/runbooks/threadmaster-handoff.md`

Never push to `main`. Never mark a planning slice `ready-to-merge`. Never
auto-implement feature requests.

## Mac-station mismatch (known issue)

Several runbooks hard-code "Automation Mac" and "Primary Mac" patrol
stations and clean-lane worktree paths at
`/home/jason/code/argent-lite-develop-clean` and `-main-clean`. Those
worktrees do not exist on this Pi deploy and the two-station model does
not map cleanly to a single Pi. Flag this if your task runs into it;
do not silently invent paths.

## Script inventory (current truth, not aspirational)

Present: `scripts/check-handoff.mjs`, `scripts/check-pr-intake.mjs`.
Referenced-but-missing: `send-pr-email.sh`, `send-escalation-email.sh`,
`check-ci-health.sh`. Treat missing scripts as blockers on any runbook
that calls them.
