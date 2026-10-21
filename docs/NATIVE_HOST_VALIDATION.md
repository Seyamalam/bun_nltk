# Native artifact refresh and host validation

The shipped binaries are historical artifacts, **not proof that current Rust
sources were built or tested on all hosts**. A Git revision recording a binary
is not necessarily its source revision. File signatures prove format/CPU only.

## Inspect without pretending unavailable hosts passed

```sh
bun run scripts/native-freshness-check.ts
bun run scripts/verify-native-host.ts --target win32-x64 --status
```

These report-only commands exit successfully even when their JSON says
`ok: false`, `stale`, `unverified`, or host validation `blocked`. Use
`native-freshness-check.ts --strict` for a failing freshness requirement.
`--status` never executes a binary. Missing foreign hosts are not failing unit
tests, and blocked is never recorded as passed.

Freshness compares SHA-256 fingerprints of `rust/src`, Cargo manifest/lock,
build script, repository Cargo configuration and toolchain files. It also
checks the recorded source revision against Git, exact artifact bytes, native
compiler/runtime host, build command and hash-bound smoke report. A docs-only
commit does not invalidate a binary's source fingerprint. Changed or untracked
native inputs must be committed before generating provenance.

No provenance exists for the three prebuilts at baseline `6965c57`; all three
have native input changes since they were recorded. The checker reports them
as stale with **unknown source revision**, rather than inventing provenance.

## Stage a source-built candidate on each genuine host

Prerequisites: Git, Bun, Rust/Cargo and that host's native linker. Install locked
JS dependencies with `bun install --frozen-lockfile`. Run from a source checkout.
The supported release hosts are Linux x64/glibc, macOS ARM64, Windows x64
(native MSVC or GNU Rust toolchain). Do not run foreign-host validation through
Wine, QEMU, Docker cross builders, cargo-zigbuild, or target spoofing.

Linux x64:

```sh
CARGO_BUILD_JOBS=2 bun run scripts/build-prebuilt.ts \
  --target linux-x64 \
  --target-dir /tmp/opencode/bun-nltk-next-native \
  --output-dir /tmp/opencode/bun-nltk-linux-candidate
```

macOS ARM64 (run on macOS, not this Linux host):

```sh
CARGO_BUILD_JOBS=2 bun run scripts/build-prebuilt.ts \
  --target darwin-arm64 \
  --target-dir artifacts/cargo-macos \
  --output-dir artifacts/native-macos-candidate
```

Windows x64 PowerShell (run on Windows, not Wine):

```powershell
$env:CARGO_BUILD_JOBS = "2"
bun run scripts/build-prebuilt.ts --target win32-x64 `
  --target-dir artifacts/cargo-windows `
  --output-dir artifacts/native-windows-candidate
```

The destination must be a **new** staging directory outside the checkout or
under `artifacts/`. Symlink redirects into `native/prebuilt` are rejected.
There is no force/promote option. `build:rust` now writes developer output only,
honors `CARGO_TARGET_DIR`, and no longer overwrites packaged prebuilts. Set
`BUN_NLTK_NATIVE_LIB` explicitly when testing developer output.

The refresh checks `process.platform`, architecture and `rustc -vV` host before
building. It runs `cargo build --locked --release --target <rustc-host>`; it does
not cross-compile or run install-time hooks. It writes:

- `bun_nltk.so` / `.dylib` / `.dll`: staged candidate;
- `<binary>.provenance.json`: source manifest/revision, bytes/hash, toolchain,
  build command/flags and genuine-host metadata;
- `smoke.json`: exact-byte-bound source smoke evidence.

Failed smoke cannot produce passing provenance. Evidence is locally generated
metadata, not a signed supply-chain attestation; review artifacts from trusted
builders. Retain both JSON files with the binary. Re-run after Rust integration:
a candidate built before new kernels is intentionally stale afterward.

## Validate the candidate, separately from packaging

```sh
bun run scripts/verify-native-host.ts --smoke \
  --library /tmp/opencode/bun-nltk-linux-candidate/bun_nltk.so \
  --output /tmp/opencode/native-linux-smoke.json
BUN_NLTK_NATIVE_LIB=/tmp/opencode/bun-nltk-linux-candidate/bun_nltk.so \
  bun test --timeout 30000 test/native.test.ts test/linear_models.test.ts test/cluster_native.test.ts
```

`--smoke` requires matching provenance. It verifies the normal native loader
contract, scalar/SIMD token count, Porter, metrics, UTF-8 parsing request/result
pointers, repeated release, error JSON and discoverable Rust C export names.
It **does not invoke WASM u32 pointer-offset exports through native FFI**: those
exports are checked for existence only. This is smoke/ABI evidence, not every
API's pinned differential, a full benchmark, or npm package validation.

## Final package validation is release-owner work

The default `verify-native-host.ts` mode (including the Linux/Windows wrappers)
now refuses stale/unverified packaged binaries before timing them or producing
a passing report. It does not allow candidate overrides to masquerade as the
packaged library. After release-owner promotion and fresh sidecar evidence, it
runs focused correctness tests, same-host fallback comparisons/benchmarks and
installed-tarball smoke. Reports distinguish `validation_revision` from the
actual `source_revision`. Old reports lacking byte-bound provenance must not
be treated as current-source evidence.

Do not promote automatically. Run the unchanged package and artifact gates,
including `bun run package:size:check` and `bun run pack:verify:prebuilt`.
No install-time compile/download fallback is introduced. Metadata packaging
and final regeneration belong to the release owner; current package allowlists
do not include the new sidecars. Cross-built binaries may be useful artifacts
but are not genuine-host source validation.

## Linux preparation evidence at baseline 6965c57

On a genuine Linux x64 host, Rust 1.97.1 (`x86_64-unknown-linux-gnu`), Bun 1.4.2:

- optimized source candidate: **2,176,504 bytes**;
- shipped Linux `.so`: **1,534,072 bytes**; delta **+642,432 bytes**;
- focused native/linear/cluster tests: **28 passed**, 2,075 assertions;
- source-native token/Porter/metrics and UTF-8/error parsing ABI smoke passed;
- **142 Rust C exports** resolved, including newer Punkt request/copy and text
  classifier exports missing from the shipped Linux artifact;
- shipped package size check: **316 files / 12,895,790 bytes**;
- replacing Linux alone projects **13,538,222 bytes**, **538,222 over** the
  unchanged 13,000,000-byte package budget; the candidate also exceeds the
existing 2,000,000-byte Linux artifact gate by **176,504 bytes**.

The existing `native:artifacts:check` additionally fails on the already-shipped
WASM (`1,055,547 > 700,000` historical gate). This preparation leaves that gate
unchanged; it is **not** a pass. The separate hard WASM budget remains
1,100,000 bytes. The release owner must reconcile historical gates explicitly,
not quietly weaken them or count source smoke as package validation.

`readelf --version-info` shows the candidate requires up to **GLIBC_2.34**.
This host's execution does not establish older-glibc support (the historical
cross-build requested glibc 2.17). Validate any claimed minimum on a genuine
Linux environment with that baseline. Do not weaken gates to publish it.

WASM remains the unchanged **1,055,547-byte** shipped artifact; this preparation
changes no Rust kernels or outputs. macOS/Windows source builds, ABI execution,
package validation and benchmarks remain **blocked pending genuine hosts**.
No Semaphore configuration or activation is involved in this preparation.

Regression coverage: `bun test test/native_provenance.test.ts` passes **11
tests / 46 assertions** for stale/unknown revision reporting, fingerprint and
artifact tampering, fabricated revisions, cross-build metadata, malformed file
headers, staging/symlink guards and blocked foreign-host status. Synthetic
macOS/Windows headers test parsing only, not host execution. Targeted pinned
tsrs typechecking and Oxlint pass. Repository-wide `bun run typecheck` is blocked
by pre-existing unresolved `bun_nltk/wasm` and `bun_nltk/classify-tree` imports in
`examples/js-library/feature-tree.ts`; it is not reported as passed.
