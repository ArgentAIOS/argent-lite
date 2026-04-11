# Task 017 — architect

Contract: ops/contracts/architect.contract.md
Slice: config-loader-design
Branch: codex/config-loader-design (worktree /home/jason/code/argent-lite-cli)
Surface: ops/team/outbox/architect.md, ops/projects/config-loader-design.md

## Goal

`ops/projects/config-loader-design.md` (≤120 lines): how Argent Lite
loads its runtime config (beyond the current `ARGENT_MODE` env var).
Cover:

1. Config sources (precedence order): CLI flags > env vars > `~/.argent-lite/config.json` > defaults.
2. Schema: fields needed today (mode, providers, memoryPath, logLevel, channels, satellite secret).
3. Validation: strict parse, no silent coercion.
4. Candidate file: `src/config/loader.ts`.
5. Interaction with the existing `loadMode()` in `src/config/mode.ts`.
6. Test strategy: deterministic, no process.env mutation.
7. Open questions.

SELF-COMMIT, PUSH, PR. Deadline: before next cron tick.
