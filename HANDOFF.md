# Threadmaster Handoff — Argent Lite

**Created:** 2026-04-11 by the previous Claude Code Threadmaster session
**Audience:** The next Claude Code session that lands in this repo. Read this first, then act.

## Who you are in this repo

You are the **Threadmaster** for Argent Lite. House rules live in `ops/` and you have not yet read them — that is your first task after acknowledging this handoff.

## Who Jason is (quick recap; full profile is in auto-memory)

Jason Brashear. 30+ yr engineer. Builds **ArgentOS** (github.com/ArgentAIOS/argentos-core) — an "intent-native multi-agent OS." Personal AI "Argent" has run continuously on his Mac for 18 months. Writes *Frontier Operations* on Substack. Terse, high-signal, skip-the-101. Has published critique of Claude Code's context/memory model — which means the quality of *this very handoff file* matters to him. He notices.

**Full profile already in memory** at `~/.claude/projects/-home-jason-code/memory/user_profile.md` — it'll auto-load.

## Why Argent Lite exists

Argent Lite is a planned **lightweight variant of argentos-core** scoped to run on a Raspberry Pi 5 + Hailo-10H as an always-on satellite node for Jason's Mac-based Argent. Proposed scope cuts vs. full core: SQLite-only (no Postgres/Redis), fewer channels, possibly a subset of the 18-agent department structure, `hailo-ollama` as the inference backend. **Scope is not yet decided** — that's an early slice.

## Current state (what's physically on disk)

- Repo: `/home/jason/code/argent-lite` → `git@github.com:ArgentAIOS/argent-lite` (private, main branch)
- Contents: the Maintainer Gate Blueprint scaffold only — `ops/`, `.github/`, `scripts/`, `ops.manifest.json`, `.gitignore`
- **Zero application code yet.** No `package.json`, no `src/`, nothing to build.
- One commit on main: `chore: initial maintainer-gate scaffold`
- The full argentos-core source is cloned (for reference only) at `/home/jason/code/argentos-core`

## Environment (already set up — do not redo)

- **OS:** Debian 12 bookworm on Raspberry Pi 5, 16 GB RAM, 477 GB NVMe, hostname `pi5miniAI`
- **Node:** v22.22.2, **npm** 10.9.7, **pnpm** 10.33.0
- **Git identity (global):** `Jason Brashear` / `115739170+webdevtodayjason@users.noreply.github.com`
- **GitHub CLI:** `gh` 2.89.0, authenticated as `webdevtodayjason` via keyring, admin in ArgentAIOS org
- **tmux:** 3.3a, configured with `allow-passthrough`, `focus-events`, RGB, 50k history. `CLAUDE_CODE_NO_FLICKER=1` in `~/.bashrc`. You are probably running inside tmux session `argent-lite`.
- **Claude Code plugins installed** (user scope): `caveman`, `document-skills`, `example-skills`, `claude-api`, `context7`, `coderabbit`. Context7 also has a CLI-installed skill at `~/.claude/skills/find-docs` and rule at `~/.claude/rules/context7.md`.
- **Local LLM stack (CPU fallback only, not Hailo-accelerated yet):** ollama 0.20.5, models pulled: `gemma3:1b` (~815 MB), `gemma4:e2b` (~7.2 GB). Warm-cache gemma3:1b ≈ 4s for short prompts.

## Hardware tomorrow (2026-04-12)

Raspberry Pi AI HAT+ 2 (**Hailo-10H**) arrives and replaces the current Hailo-8L. Setup guide already drafted at `/home/jason/code/hailo10h-llm-setup.md` — adapted from Pudding Entertainment's Medium article, tailored for Debian (not Ubuntu) and the existing Hailo-8 stack that needs purging first. Note: Gemma GGUFs already on disk will NOT run on Hailo — the GenAI Model Zoo uses its own precompiled `.hef` models.

## What the previous session completed

1. Hardware audit (Pi 5 Rev 1.1, 16 GB RAM, NVMe 477 GB, Hailo-8L firmware 4.20.0)
2. Confirmed Hailo-8L has no practical LLM path (official Hailo forum)
3. Pulled `gemma3:1b` and `gemma4:e2b`, ran test inference on CPU
4. Drafted `hailo10h-llm-setup.md` for tomorrow's hardware
5. Cloned argentos-core for reference
6. Created `/home/jason/code/argent-lite`, git-init'd, installed Maintainer Gate Blueprint via `node bin/apply-blueprint.mjs ops.manifest.json`
7. Set git identity, installed gh, authed via `gh auth login`
8. Created `github.com/ArgentAIOS/argent-lite` (private), pushed initial commit
9. Installed Node 22, pnpm, tmux, gh, and Claude Code plugins
10. Wrote and committed this handoff

## What you need to do next — in order

1. **Acknowledge the handoff to Jason** in one sentence so he knows you picked it up.
2. **Read the house rules** (in order):
   - `ops/rules/never-do.md`
   - `ops/rules/branching.md`
   - `ops/rules/agent-coordination.md`
   - `ops/rules/linear.md` (even though we're using GitHub Issues not Linear — note the mismatch for later)
3. **Read the key runbooks:**
   - `ops/runbooks/dev-workflow.md`
   - `ops/runbooks/slice-management.md`
   - `ops/runbooks/loop-contract.md`
   - `ops/runbooks/threadmaster-handoff.md` (meta — teaches you the handoff format; future handoffs should follow *that* format, not this ad-hoc one)
   - `ops/runbooks/pr-workflow.md`
4. **Flag the Mac-station assumption:** the blueprint's patrol model assumes "Automation Mac" + "Primary Mac" (left as manifest defaults because Jason said "yes" to proceed with defaults). On a Pi-only deploy this doesn't map. Surface this to Jason for a decision before drafting slices.
5. **Draft the first slice** in `ops/slices/REGISTRY.md`: *"Scope Argent Lite — decide what's IN vs. OUT of the port from argentos-core."* This is a research/planning slice, not a coding slice. Use `ops/runbooks/research-planning.md`.
6. **Do NOT start porting code** until (a) rules are read, (b) Mac-station question is resolved, (c) the scope slice is committed.

## Open questions parked for Jason

- **Patrol stations:** rename "Automation Mac"/"Primary Mac" to Pi-appropriate roles, OR drop the two-station model entirely for Lite?
- **Scope of the port:** MemU? Contemplation engine? Intent system? Model router? How many channels? React dashboard or headless? These are slice-1 questions.
- **Docs repo:** manifest points `DOCS_REPO_PATH` at argent-lite itself (same repo). Keep that or split out later?
- **Issue tracker:** manifest says GitHub Issues but `ops/rules/linear.md` assumes Linear. Jason should confirm which.

## Don't re-do these things

- Don't re-install Node/pnpm/tmux/gh — all present
- Don't re-auth gh — already logged in
- Don't `gh repo create` — already exists
- Don't `git config user.*` — already set globally
- Don't install Claude Code plugins again — installed user-scope
- Don't rerun the Maintainer Gate blueprint installer — already applied

## When Jason hits `/exit` next time

Update this file (or better: follow `ops/runbooks/threadmaster-handoff.md` to produce a proper handoff packet) with whatever state the next session will need. **Handoffs are the mechanism that makes Jason's critique of Claude Code's memory model not apply to our work here.** Treat them seriously.

---

— Previous Threadmaster, signing off
