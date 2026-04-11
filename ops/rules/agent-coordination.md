# Agent Coordination

> How multiple agents share `argent-lite` without stepping on each other.

## Core Rule

Before starting work, every agent must:

1. read `ops/slices/REGISTRY.md`
2. claim a slice
3. work only inside that slice
4. update the registry and journal when done

## Handoff Rule

If a handoff is going to Threadmaster for merge, release, or export
intake, follow `ops/runbooks/threadmaster-handoff.md`.

The handoff must identify:

- the real source worktree
- the exact commit or dirty state
- the exact intended files
- explicit exclusions
- validation status

If the work spans more than one repo, each repo gets its own slice and its own
handoff packet. Do not hide docs-repo work from `/home/jason/code/argent-lite` inside a
`argent-lite` handoff.

## What Not To Do

- do not create branches without registering them
- do not edit files claimed by another agent
- do not merge another agent's branch
- do not assume a branch is abandoned without checking the registry
