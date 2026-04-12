# Workflow: slice-lifecycle

> State machine for every slice in `ops/slices/REGISTRY.md`. Every agent
> touching repo files must know which state the slice is in and which
> transitions are legal from that state.

## States

| State | Meaning |
|---|---|
| `proposed` | Slice exists in REGISTRY as a placeholder; no branch yet. |
| `claimed` | An owner has taken the slice. `codex/*` branch exists. |
| `in-progress` | Work is happening. Commits landing on the branch. |
| `validation` | Work complete on branch; validation commands running. |
| `handoff-ready` | Validation passed; handoff packet written; awaiting team lead. |
| `integrated` | Merged into `develop` after clean-lane reconstruction. |
| `released` | Promoted from `develop` to `main` after operator sign-off. |
| `abandoned` | Slice dropped. Branch kept for salvage; registry notes why. |

## Legal transitions

```
proposed     → claimed | abandoned
claimed      → in-progress | abandoned
in-progress  → validation | abandoned
validation   → handoff-ready | in-progress      (failed validation → back)
handoff-ready → integrated   | in-progress      (team lead rejected → back)
integrated   → released      | abandoned        (release cancelled → back on the wall)
released     → (terminal)
abandoned    → (terminal)
```

Illegal transitions are a contract violation. The reviewer rejects them.

## Required artifacts per transition

| Transition | Artifact |
|---|---|
| `proposed → claimed` | REGISTRY row updated with owner + branch. |
| `claimed → in-progress` | First commit on the branch referencing the slice name. |
| `in-progress → validation` | All intended files committed; no stray surface. |
| `validation → handoff-ready` | Handoff markdown written and `scripts/check-handoff.mjs` passing. |
| `handoff-ready → integrated` | Merge commit on `develop` in the clean lane worktree. |
| `integrated → released` | Operator sign-off recorded in `ops/log/JOURNAL.md`. |

## Research/planning variant

Research-only slices use the parallel states `researching`,
`planning-complete`, `implementation-not-started` per
`ops/runbooks/research-planning.md`. They never enter `validation` or
`integrated` unless the plan document itself is the merge target.

## Who can drive transitions

- `claimed`, `in-progress`: any teammate with a task in their inbox.
- `validation`: engineer only.
- `handoff-ready`: engineer or architect.
- `integrated`, `released`: team lead only.
- `abandoned`: team lead only.

## Failure mode

If a slice sits in `in-progress` with no commits for more than one
session, the team lead moves it to `abandoned` and opens a replacement
slice. Do not resurrect abandoned branches silently.
