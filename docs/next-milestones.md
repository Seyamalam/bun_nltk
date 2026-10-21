# Milestones 2–10 integration ledger

Baseline: `6965c57`. Semaphore activation (#1) is explicitly excluded.
Package limits remain 400 files / 13,000,000 bytes; WASM remains 1,100,000 bytes.
Official oracle: project `.venv`, Python 3.14.4 / NLTK 3.10.3, with hash-locked
resources provisioned in `/tmp/opencode/bun-nltk-next-data`.

## Delegation registry

Eight isolated-worktree T3 tasks were launched with provider instance `opencode`,
model `AgentRouter-responses-gateway/gpt-6.1-sol`, and `variant=high`.
All use this exact task ID prefix, followed by the milestone number:

```
node:delegated-task:command%3Amcp%3A675a115f-6205-4f61-8f5c-7b390257d426%3Adelegate-task%3Anext-nine-20261021-r1-
```

| Milestone | Task suffix | Integration status |
| --- | --- | --- |
| 2 Native provenance/real-host validation | `2` | Integrated `3069732`; source-built Linux smoke passes; packaging/foreign hosts blocked |
| 3 Current inventory/evidence audit | `3` | Integrated `98e5c31`; shared snapshots await final route review |
| 4 Explicit official resources | Parent-owned | Offline tests and live resource check pass |
| 5 Tweet/Toktok/MWE Rust migration | `5` | Completed agent `27b7aba`; parent review/integration pending |
| 6 Jaro/Jaro-Winkler/GHD/BLEU contracts | `6` | Both rounds failed transport; recovered `b7e2a71` and follow-up `a05d69f`; parent review pending |
| 7 Generic Rust language models | `7` | Integrated `5844614`; parent source/WASM/differential/browser checks pass |
| 8 Official-model perceptron features | `8` | Provider failed; recovered `560dd4d`; second round also failed |
| 9 Tree/grammar/chart contracts | `9` | First run failed transport; ordinal-2 continuation queued; no duplicate launched |
| 10 Robustness/performance tooling | `10` | Integrated `398d8fa`; parent seeded/fuzz/lifecycle reruns pass; broader coverage remains |

These are implementation tasks, not completed parity claims. Parent review,
integration, artifact regeneration and full gates remain required. Source-built
Linux validation cannot establish macOS/Windows validation. Native binaries in
the baseline are not fresh provenance evidence merely because they ship.

Recovery rounds use the same prefix with `r1` replaced by `r2`, suffixes `6`
and `8`. Both selected the same model and `variant=high`. Recovered commits
remain unreviewed outside master; preserve them even when provider transport
fails. No third metrics/perceptron retry is active. The second perceptron
checkout has no surviving edits beyond its cherry-picked recovery commit.

## Parent validation and package headroom

The exact-byte package check replaces rounded KB/MB sums (`3e3a779`). Lossless
NE dictionary/dense-weight-index storage (`5eaa80d`) preserves every mapping
and IEEE-754 weight and saves 1,155,095 compressed bytes. Reconstruction tests,
pinned NE predictions, npm/Bun clean-tarball Node/Bun runtime and declaration
checks, and Chromium/Firefox/WebKit/Node portable checks pass. Parent suite
before the two audit integrations: 607 passed / 0 failed. Targeted native
provenance/inventory: 24 passed / 0 failed; source-built Linux native tests:
28 passed / 0 failed. Typecheck and pinned generated-source/LOC audits pass.

After parent LM regeneration: 318 files / 11,694,576 exact bytes; WASM
1,058,620 bytes. Additional Binaryen passes saved only 28 bytes, not useful
integration headroom. The recovered perceptron alone reported 1,099,454 bytes;
that is not enough space for the combined algorithm work. Native source release
candidate remains 2,176,504 bytes versus its 2,000,000-byte artifact cap. Its
source smoke is not installed-tarball validation or older-glibc validation.

Parent LM review removed a Node-unsupported constructor parameter property.
Fresh source build: 3 Rust tests, 21 Bun tests / 40,369 assertions; 241 pinned
cases / 2,439 scores / 229 perplexities match NLTK 3.10.3. Seventy sparse-KN
Python exceptions are recorded separately, not parity successes. Explicit-runtime
Node 24 / Chromium / Firefox / WebKit checks and both typechecks pass.

Parent robustness rerun: 8 Bun tests / 5,060 assertions, 2 Rust tests,
42 seeds + 500 mutations; ASan/libFuzzer 5,000 runs in 14 seconds with no
finding. Bun/Node/Python/Chromium/Firefox lifecycle outputs match pins. These
bounded campaigns do not establish universal safety or speed.

## Resource evidence

`scripts/nltk-resources.py check` verifies archive and extracted bytes without
downloading, reports license metadata from the locked index, and limits the
Python data search path to the chosen directory. WordNet, English perceptron and
VADER load successfully. These probes establish resource availability, not
algorithm equivalence. Run instructions are in `docs/nltk-resources.md`.
