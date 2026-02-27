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

## Notes

- If shipping prebuilt native binaries, include them in the package payload strategy before publish.
- If consumers only use WASM, confirm `native/bun_nltk.wasm` packaging and runtime loading paths.
- Keep `bench:gate` thresholds aligned with current hardware assumptions and CI environment.
