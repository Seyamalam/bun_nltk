# Versioning Policy

This project uses Semantic Versioning (`MAJOR.MINOR.PATCH`).

## Rules

- Increment `MAJOR` for breaking API or behavior changes.
- Increment `MINOR` for backward-compatible features and new APIs.
- Increment `PATCH` for backward-compatible bug fixes and performance fixes.

## Source of Truth

- `package.json` `version` is the publish version.
- [CHANGELOG.md](/C:/Users/user/Desktop/bun/bun_nltk/CHANGELOG.md) must include an entry for every released version.

## Release Process

1. Ensure working tree is clean.
2. Run `bun run release:check`.
3. Update `CHANGELOG.md`:
   - Move changes from `Unreleased` into a new version section.
   - Add release date in `YYYY-MM-DD`.
4. Bump `package.json` version.
5. Commit release metadata:
   - `git commit -m "release: vX.Y.Z"`
6. Tag release:
   - `git tag vX.Y.Z`
7. Push commit and tag.
8. Publish package:
   - `bun publish` or `npm publish`.
   - Or rely on the tag-triggered GitHub workflow in `.github/workflows/release.yml`.

## Pre-release Versions

- Use `X.Y.Z-alpha.N`, `X.Y.Z-beta.N`, or `X.Y.Z-rc.N`.
- Keep pre-release notes in the same `CHANGELOG.md` section until stable release.

## Breaking Change Checklist

- Update API docs in [docs/API.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/API.md).
- Add migration notes to `CHANGELOG.md`.
- Add/adjust tests for old and new behavior boundaries.
- Validate benchmarks to confirm no unacceptable regressions.
