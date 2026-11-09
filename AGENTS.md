# bun_nltk agent notes

Rust-first NLTK-compatible NLP for Bun/Node/browser. Target oracle: Python NLTK 3.10.3 on Python 3.14.4.

## Environment contract

- `bun run test` re-execs the suite via `scripts/test-env.ts` with `.venv/bin` prepended. Recreate the env with `python3.14 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt`. Bare `bun test` resolves the system python3 — oracle differentials fail if it is not NLTK 3.10.3.
- `NLTK_DATA=$PWD/.cache/nltk-data` enables resource-dependent gates (wordnet pack, lifecycle, fidelity). Provision with `.venv/bin/python3 scripts/nltk-resources.py prepare --data-dir .cache/nltk-data`.
- Rust toolchain: `cargo` + `wasm32-unknown-unknown` target. `bun run build:rust|build:wasm|build:portable` rebuilds artifacts; `native/bun_nltk.wasm` and `dist/portable/` are committed artifacts and must be regenerated after src/rust changes.

## Gates (all local; remote CI removed)

- Correctness: `bun run test` (639), `bun run fidelity:gate` (43 groups), `bun run native:artifacts:check`, `bun run native:freshness:check`, `bun run compatibility:check`.
- Package: `bun pm pack --ignore-scripts`, `bun run verify:packaged-portable <tgz>`, `bun run package:size:check`.
- Perf (host-sensitive, calibrated on this linux-x64): `bun run bench:gate`, `bun run native:migration:gate`, `bun run sla:gate`. Floors re-baselined for Bun 1.4.4 on 2026-11-09 — do not tighten without recorded medians.
- WASM budget 1,100,000 bytes (owner-approved); currently 1,088,530 (~1% headroom) — size changes need the same explicit decision.

## Conventions

- Compatibility reviews: edit `compatibility/inventory.json` mappings/evidence/routes, then `bun run compatibility:generate`. Pinned counts live in `test/compatibility_inventory.test.ts`.
- Genuine-host native promotion: `scripts/refresh-native-host.ts --output-dir <staging>` produces the binary+provenance+smoke bundle promoted into `native/prebuilt/<target>/` (darwin/win32 still pending their hosts).
- No remote CI: `.github/` and `.semaphore/` were removed on 2026-11-09.
- 60 pre-existing oxlint warnings are baseline, not new regressions.
