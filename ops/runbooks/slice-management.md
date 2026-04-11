# Runbook: Slice Management

1. Read `ops/slices/REGISTRY.md` before starting work.
2. Register your slice before creating a branch.
3. One repo per slice. If implementation and public docs live in different repos, create separate slices and separate handoffs.
4. Create an implementation branch such as:

```bash
git checkout -b codex/<slice-name>
```

5. If you need isolation, use a worktree:

```bash
git worktree add <path> -b codex/<slice-name>
```

6. Keep the claimed file surface narrow.
7. When done, update the registry and write the journal entry before handoff.
8. If the slice is for research or planning only:
   - follow `ops/runbooks/research-planning.md`
   - do not treat it as implementation just because it has a branch
   - use planning statuses such as `researching`, `planning-complete`, or `implementation-not-started`
   - do not mark it `ready-to-merge` unless the planning artifact itself is the intended merge output
