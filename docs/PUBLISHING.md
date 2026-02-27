# Publishing Guide

This package is intended for Bun/Node distribution with native and WASM backends.

## Prerequisites

- npm account with publish permission for the package name.
- Bun installed.
- Python installed (for benchmark/parity scripts).
- Zig installed (for native and WASM builds).

## Publish Checklist

1. Build artifacts:
   - `bun run build:zig`
   - `bun run build:wasm`
2. Run validation:
   - `bun run release:check`
3. Ensure docs are current:
   - [CHANGELOG.md](/C:/Users/user/Desktop/bun/bun_nltk/CHANGELOG.md)
   - [docs/API.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/API.md)
   - [docs/VERSIONING.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/VERSIONING.md)
4. Bump version in `package.json`.
5. Publish:
   - `bun publish`
   - or `npm publish`

## Automated GitHub Release Workflow

Release automation is defined in [.github/workflows/release.yml](/C:/Users/user/Desktop/bun/bun_nltk/.github/workflows/release.yml).

- Trigger: push tag `v*` (for example `v0.5.0`, `v0.6.0-beta.1`).
- It validates:
  - tag matches `package.json` version
  - release section exists in `CHANGELOG.md`
  - full `release:check` passes
- It publishes to npm with dist-tag rules:
  - `vX.Y.Z` -> `latest`
  - `vX.Y.Z-alpha.N` -> `alpha`
  - `vX.Y.Z-beta.N` -> `beta`
  - `vX.Y.Z-rc.N` -> `rc`
  - unknown prerelease suffix -> `next`

You can also run it manually via `workflow_dispatch` and override dist-tag.

## Post-Publish Smoke Workflow

Post-publish verification is defined in [.github/workflows/post-publish-smoke.yml](/C:/Users/user/Desktop/bun/bun_nltk/.github/workflows/post-publish-smoke.yml).

- Triggered automatically when `Release` succeeds.
- Also supports manual `workflow_dispatch`.
- Installs published package from npm (`bun_nltk@<version>`), builds bundled native/wasm outputs, and runs a runtime smoke script.

## Required GitHub Secrets

- `NPM_TOKEN`: npm access token with publish permissions for this package.

## Notes

- If shipping prebuilt native binaries, include them in the package payload strategy before publish.
- If consumers only use WASM, confirm `native/bun_nltk.wasm` packaging and runtime loading paths.
- Keep `bench:gate` thresholds aligned with current hardware assumptions and CI environment.
