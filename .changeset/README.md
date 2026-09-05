# Changesets

Every change that should end up in the changelog gets a changeset file here.

```bash
pnpm changeset
```

Pick the bump (patch / minor / major) and write one line about the change. Commit the generated file with your change.

When it lands on `main`, the release workflow opens a "chore: 버전 올림" pull request that bumps the version and updates `CHANGELOG.md`. Merging that PR publishes to npm.
