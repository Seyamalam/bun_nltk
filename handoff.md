# Handoff: native migration, local release, and paper

Date: 2026-08-26. Repository: `/Users/seyam/Work/bun_nltk`. Branch: `master`. The previous committed baseline was `8b20db2`; this handoff describes the release work added after it.

## Current state

The Rust migration, local release workflow, native-host validators, and Springer manuscript update are complete.

The project does not rely on GitHub Actions. The maintainer has a payment issue with hosted Actions, so builds, release checks, benchmarks, and paper reproduction must stay runnable locally.

The canonical manuscript is `paper/sn-main.tex`. Its compiled output is `paper/sn-main.pdf`. `paper/main.tex` and `paper/main.pdf` are older reference files.

## Verified local release

`bun run release:local` passed on the author's Apple Silicon Mac on 2026-08-26. The command completed:

- TypeScript type checking and Biome linting;
- 34 Rust tests;
- direct macOS arm64 plus local Zig cross-builds for Linux x64 and Windows x64;
- the 93,712-byte WASM build;
- native artifact format and size checks;
- 432 TypeScript tests across 66 files with zero failures;
- the separate 37-group Python NLTK fidelity gate;
- native migration performance gates for text training, HMM decoding, K-means, and WordNet loading;
- package size and allowlist checks;
- packing and installing the real npm tarball in a clean temporary project.

The validated tarball is `artifacts/local-release/bun_nltk-0.16.0.tgz`. It contains 213 files, is 1,724,393 bytes packed, and is 4,529,874 bytes unpacked. The package smoke test passed.

Cross-compilation checks file format and packaging. It is not runtime proof for Linux or Windows.

## Native migration

Rust now covers the measured hot paths for:

- token and n-gram operations;
- sparse linear scoring and text-model training;
- HMM Viterbi decoding;
- Euclidean K-means;
- packed WordNet loading and lookup support.

The 15-round measurements and bootstrap intervals are recorded in `paper/bench/native_migration_results.json`. The local five-gate check is `bun run native:migration:gate`.

## Linux and Windows validation

Friends only need Git, Bun, and an internet connection. They do not need Rust, Python, Zig, Docker, Wine, Visual Studio, administrator access, or a GitHub account.

Linux x64:

```bash
git clone https://github.com/Seyamalam/bun_nltk.git
cd bun_nltk
bash scripts/verify-linux.sh 15
```

Windows x64, from PowerShell:

```powershell
git clone https://github.com/Seyamalam/bun_nltk.git
cd bun_nltk
.\scripts\verify-windows.cmd -Rounds 15
```

Each wrapper installs locked dependencies, loads the checked-in binary for that operating system, runs focused correctness tests, compares native Rust with TypeScript on the same machine, packs and installs the tarball, and writes a JSON report under `artifacts/`.

Ask testers to return:

```text
artifacts/native-host-linux-x64.json
artifacts/native-host-win32-x64.json
```

The full instructions are in `docs/NATIVE_HOST_VALIDATION.md`.

## Paper

The manuscript reports:

- 241 of 241 import-covered names across 46 API families;
- 210 functional entries, 26 genuine shims, and five import-only package barrels;
- 432 tests across 66 files and a separate 37-group fidelity gate;
- the distinction between the recorded Linux Python benchmark and the Apple Silicon native-versus-TypeScript study;
- native and WASM artifact sizes, package size, and the local release method;
- known Punkt and named-entity fidelity gaps;
- no native Linux or Windows runtime claim until reports arrive from those hosts;
- incomplete Safari, mobile-browser, and edge-provider validation.

The prose received a humanizer pass. Promotional headings, canned transitions, repeated study narration, and meta commentary were removed without changing measurements, citations, commands, or limitations.

`paper/sn-main.pdf` builds with:

```bash
python3 /Users/seyam/.codex/plugins/cache/openai-bundled/latex/0.2.4/scripts/compile_latex.py "$PWD/paper/sn-main.tex" --compiler tectonic
```

The current PDF is 22 pages. All pages were visually inspected after the rewrite. The package-size update was compiled and its affected page was inspected again after the final local release.

## Paper Amigo

The manuscript is registered in Paper Amigo as project `52034a9e-3913-4313-b7f7-b0e696fe21bf`. `paper/paper-amigo.json` records the project, remote file key, and SHA-256 hash. Run this after any paper build:

```bash
bun run scripts/check-paper-amigo-sync.ts
```

The check compares `paper/sn-main.pdf` with both the manifest and Paper Amigo. As of 2026-08-27, `paper-amigo --help` exposes project creation and listing but no update, replacement, or deletion command. Do not create a duplicate project silently. If the PDF changes, check the CLI again and replace the file in the recorded project when that operation becomes available. Update the manifest only after the remote file matches the rebuilt PDF.

## Remaining work

Only external evidence and release administration remain:

1. Ask one x64 Linux tester and one x64 Windows tester to clone the release commit and run the commands above.
2. Archive both returned JSON reports. Update the paper only with results produced on those native operating systems.
3. Run `bun run release:local` again after any code, binary, package allowlist, or release-documentation change.
4. Publish version 0.16.0 manually from the validated tarball when authorized. No GitHub Actions step is required.

Do not replace missing Linux or Windows results with Wine, Docker cross-compilation, emulation, or raw comparisons between different computers.

## Important files

- `scripts/release-local.ts`
- `scripts/verify-native-host.ts`
- `scripts/verify-linux.sh`
- `scripts/verify-windows.cmd`
- `scripts/verify-windows.ps1`
- `docs/NATIVE_HOST_VALIDATION.md`
- `docs/PUBLISHING.md`
- `paper/sn-main.tex`
- `paper/sn-main.pdf`
- `paper/bench/native_migration_results.json`
- `paper/paper-amigo.json`
- `scripts/check-paper-amigo-sync.ts`
- `artifacts/fidelity-report.json`
- `artifacts/native-host-darwin-arm64.json`
