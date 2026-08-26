# Publishing Guide

This package is intended for Bun/Node distribution with native and WASM backends.

## Prerequisites

- npm account with publish permission for the package name.
- Bun installed.
- Python installed (for benchmark/parity scripts).
- Rust toolchain with cargo installed (for native and WASM builds; wasm32-unknown-unknown target required for WASM).
- On Apple Silicon, Zig and `cargo-zigbuild` for local Linux/Windows cross-compilation.

## Publish Checklist

1. Build distributable artifacts:
   - `bun run build:prebuilt` (darwin-arm64 + linux-x64 + win32-x64, built locally)
   - `bun run build:wasm`
2. Run validation:
   - `bun run release:check`
   - (or explicitly) `bun run pack:verify:prebuilt`
   - `bun run wasm:size:check`
   - `bun run parity:report`
3. Ensure docs are current:
   - [CHANGELOG.md](CHANGELOG.md)
   - [docs/API.md](docs/API.md)
   - [docs/VERSIONING.md](docs/VERSIONING.md)
4. Bump version in `package.json`.
5. Publish:
   - `bun publish`
   - or `npm publish`

## Local release workflow

Run `bun run release:local`. It builds all three native targets and WASM, runs the 37-group Python-oracle fidelity
gate plus the correctness and benchmark gates, and packs the actual tarball. It executes the packaged binary on the
author's macOS host. Cross-compilation proves that the Linux and Windows files have the expected formats, but it does
not count as runtime validation. No GitHub Actions or GitHub secrets are required.

## Native Linux and Windows checks

Before publishing, ask one person on x64 Linux and one person on x64 Windows to clone the same commit and run one
command:

```bash
bash scripts/verify-linux.sh 15
```

```powershell
.\scripts\verify-windows.cmd -Rounds 15
```

Each command compares native Rust with the TypeScript fallback on that machine, tests an installed tarball, and writes
a shareable report under `artifacts/`. Do not merge raw timings across operating systems. Archive the Linux and Windows
JSON reports with the release. The complete copy-paste instructions are in
[docs/NATIVE_HOST_VALIDATION.md](NATIVE_HOST_VALIDATION.md).

## Notes

- If shipping prebuilt native binaries, include them in the package payload strategy before publish.
- Package now ships:
  - `native/prebuilt/linux-x64/bun_nltk.so`
  - `native/prebuilt/win32-x64/bun_nltk.dll`
  - `native/prebuilt/darwin-arm64/bun_nltk.dylib`
  - `native/bun_nltk.wasm`
  - mini and extended WordNet data; the full WordNet pack is distributed separately
- `bun run package:size:check` rejects build output, scripts, caches, and the full WordNet pack.
- Runtime uses packaged prebuilt native binaries by default; there is no implicit local native fallback path.
- Keep the three native prebuilts and `native/bun_nltk.wasm` in the validation commit so a fresh clone can run the host checks without Rust.
- No install-time lifecycle scripts are required; package consumers do not need `bun pm trust` for this package.
- Keep `bench:gate` thresholds aligned with current hardware assumptions and CI environment.
