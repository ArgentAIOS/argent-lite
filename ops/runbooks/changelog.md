# Runbook: Changelog Management

> Track versions and changes so every deploy is documented.

## When to Update

- New features
- Bug fixes
- Security fixes
- Breaking changes
- Significant improvements

## Version Increment Rules

| Change Type | Bump | Example |
|-------------|------|---------|
| Small fixes, minor changes | BUILD (0.0.0.X) | Typo fix, config tweak |
| Bug fixes, small features | PATCH (0.0.X.0) | Bug fix, minor enhancement |
| New features, significant improvements | MINOR (0.X.0.0) | New feature, UI redesign |
| Breaking changes, major rewrites | MAJOR (X.0.0.0) | API change, architecture shift |

## Changelog Entry Workflow

1. **Before committing**: Add a new entry at the TOP of the changelog
2. **Increment version** according to the rules above
3. **Include date** in YYYY-MM-DD format
4. **Categorize changes** by type: feature, fix, improvement, security
5. **Include in commit**: Changelog update should be part of the same commit as the change

## Where to Track

Maintain changelogs in these locations (adapt to your project):

1. **Source of truth**: In-app changelog data file (e.g., `lib/changelog.ts`, `CHANGELOG.md`)
2. **Repository**: `CHANGELOG.md` in the repo root (Keep a Changelog format)
3. **External**: GitHub Releases for MINOR/MAJOR bumps

## Agent Contract

Every agent session that ships code must:
1. Check the current version
2. Add changelog entries for their changes
3. Bump the version appropriately
4. Include the changelog update in their commit
