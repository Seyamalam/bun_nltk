# Milestone 10: bounded adversarial checks and lifecycle benchmarks

This is a resource-free slice, complementary to existing `scale_matrix.ts`,
`release_benchmarks.ts`, browser thresholds and scattered API disposal tests.
It does not activate Semaphore or change any existing gate, threshold, package
script, runtime implementation, portable surface or generated artifact.

## Local checks

```sh
bash scripts/verify-adversarial-local.sh
bash scripts/fuzz-native.sh --seed 1337 --cases 500 \
  --replay-out /tmp/opencode/bun-nltk-next-fuzz-replay.bin \
  --write-corpus /tmp/opencode/bun-nltk-next-fuzz-corpus
bash scripts/fuzz-native.sh --replay /tmp/opencode/bun-nltk-next-fuzz-replay.bin
```

The normal runner uses stable Rust, debug assertions/unwinding and a 60-second
execution timeout. Defaults: `CARGO_BUILD_JOBS=2`, unique target directory
`/tmp/opencode/bun-nltk-next-adversarial`. The first byte selects a target;
remaining bytes are its payload. Persist-before-entry `--replay-out` preserves
the exact last input if a panic, abort or timeout occurs. It is optional to avoid
disk I/O on every mutation. Cases are bounded to 1–100000, inputs to 16 KiB;
oversized replay files fail before being read. Every run executes all committed
corpus seeds before deterministic LCG mutations.

`test/adversarial_seeded.test.ts` covers four seeds and interleaved failures:

- Unicode edit-distance symmetry, identity, bounds and triangle inequality;
  scalar-index span reconstruction; arbitrary UTF-8 streaming splits vs batch.
- Invalid model shape/counts, duplicate labels/features, invalid JSON/numeric
  payloads; recovery and exact model roundtrips, including nontrivial floats.
- Genuine returned WASM NB handles are retired, freed twice, and probed after
  fresh allocations. No guessed pointers, private-export tricks or native
  use-after-free calls. Separate instances remain independent after disposal.
- Byte-oversized Unicode staging, poisoned limited streams, bounded distance,
  malformed brackets and rejected deeply nested string trees.

Native targets call only safe Rust functions: text NB/tree/vectorizer/MaxEnt
load and bounded predict requests, binary Punkt decoding, bracket trees/CFGs,
tokenizer Unicode, distance/alignment and stream properties. Native integration
tests verify valid model seeds actually reach validation and exact roundtrips;
malformed request checks are not misrepresented as successful algorithm runs.
Training iterations and unbounded parser enumeration are intentionally excluded.
This is not exhaustive model-family coverage or an unsafe native FFI fuzzer.

### Coverage-guided native fuzzing

Install `cargo-fuzz` (tested 0.13.2) and a Rust nightly with sanitizer support:

```sh
cargo install cargo-fuzz --version 0.13.2 --locked
bash scripts/fuzz-native-coverage.sh
```

The standalone `rust/fuzz` manifest and lockfile pin `libfuzzer-sys=0.4.13`;
they do not add dependencies to the shipped library. It reuses the safe seeded
targets, with address sanitizer, 5000-run/30-second limits, 16 KiB inputs,
5-second per-input timeout, 512 MiB RSS limit and 180-second outer timeout.
Compiler time is included only in the outer timeout. Targets, corpus mutations,
coverage output and artifacts stay outside tracked deliverables. A sanitizer
failure is not caught or converted into success. Replay/minimize a finding with
`cargo +nightly fuzz run adversarial <artifact>` / `cargo +nightly fuzz tmin`.
The smaller stable runner is also useful for replay without libFuzzer.

## Lifecycle runner

```sh
bun bench/lifecycle_matrix.ts --runtimes bun,node,python,chromium,firefox \
  --rounds 3 --repetitions 10 \
  --python /home/seyamalam/Desktp/bun_nltk/.venv/bin/python3 \
  --output /tmp/opencode/bun-nltk-next-lifecycle.json
```

`BUN_NLTK_ORACLE_PYTHON` is an alternative to `--python`; default is the checkout's
`.venv/bin/python3`. The runner never installs resources or modifies the venv.
Browser execution requires the pinned Playwright package and browser binaries.
It builds a temporary split JS **benchmark harness**, not split WASM, serves the
single shipped kernel and removes its own generated JS files afterward.
The orchestrator is Bun; workers exercise the same typed `src/wasm.ts` loader in
Bun and Node, or a browser bundle of that loader. This is not an npm-root/native
backend throughput measurement.

Workloads are immutable v1 resource-free WordPunct Unicode, exact ASCII
aggregates (case folding and order-3 ngrams), and Unicode edit distance. The
oracle uses actual NLTK primitives, with `RegexpTokenizer` only for the explicitly
ASCII aggregate contract. `pins.json` records SHA256 of JSON input and output
arrays, generated with Python **3.14.4 / NLTK 3.10.3**. Version workloads instead
of silently refreshing their pins. `runtime-pins.json` pins comparable runtime
versions too; mismatches remain failed evidence. Changing runtime pins needs an
explicit new comparison baseline. WebKit launch support exists but no version
baseline is committed, so WebKit cannot report pinned success yet.

The report records raw samples, medians, API calls/second, hashes, commit/worktree
status, source/kernel digests and OS/CPU/runtime versions. Defaults are three
fresh processes/contexts, three warm timing samples per process/context and ten
calls per sample; one explicit warmup call is excluded. Limits are 3–15 rounds,
1–1000 repetitions and 60-second worker/page timeouts.

- **Cold:** process launch to first output includes launcher/imports; separate
  loader import, byte acquisition, instantiation and first-call timings are
  recorded. Browser launch/navigation is excluded; harness import is separate.
  Browser contexts are fresh but the engine process is reused, so compiled WASM
  and OS caches may be warm. This is not a machine-cold/cache-flushed claim.
- **Throughput:** complete typed API calls include encoding, marshaling and
  output allocation; hashing and warmup excluded. Python executes the comparable
  whole task. Workloads/runtimes are sequential, not parallel within a runner.
- **Memory:** Bun/Node current snapshots and process peak RSS, Python resource
  peak RSS, browser nonstandard `performance.memory` where available, WASM
  linear-memory high-water. `null` means unavailable, never zero. No forced GC,
  live-allocation claims, browser RSS claims or cross-metric memory ratios.
- **Clock resolution:** retain zero-duration browser samples and flag them;
  zero medians produce `null` calls/second, not fabricated infinite throughput.
  Increase repetitions for useful timing rather than changing the workload.
- **Failures:** requested missing runtimes/data/version mismatch/output mismatch
  are recorded with `status: failed`, `complete: false`, and nonzero exit.
  A subset invocation reports only that requested subset, not all hosts passing.
  No speed or memory thresholds supersede the existing scale/SLA gates.

## Implementation-checkout evidence (2026-10-21)

On Linux x64, kernel 7.0.0-38-generic, Intel i3-1215U:

- `bash scripts/verify-adversarial-local.sh`: **8 Bun tests / 5060 assertions,
  2 native Rust integration tests, 42 corpus seeds + 500 mutations**, passing.
- Coverage target compiled with nightly **1.101.0-nightly (19833af72)**;
  `cargo +nightly fuzz run adversarial ... -- -runs=1000 -seed=1337
  -max_len=16384 -timeout=5 -rss_limit_mb=512`: 1000 runs, no finding,
  initial 37-file corpus, reported final coverage 4329 counters, RSS 78 MiB.
  `PATH=/tmp/opencode/bun-nltk-next-fuzz-tools/bin:$PATH bash
  scripts/fuzz-native-coverage.sh`: subsequent 5000-run check completed in
  8 seconds without finding; 42 committed seeds plus prior evolved corpus
  (253 initial files), final reported 5437 covered counters / 188 MiB RSS.
  These short runs do not establish absence of bugs or universal fuzz coverage.
- Five-runtime benchmark, 3 rounds / 10 repetitions: exact pins matched in
  Bun **1.4.2**, Node **24.21.0**, Python **3.14.4 / NLTK 3.10.3**, Chromium
  **156.0.8078.4**, Firefox **157.0**. Raw report is external, not a fabricated
  checked-in performance result. Bun's `process.version` reports v26.3.0;
  the separate Bun version is authoritative.
- Observed median internal cold times in that bounded run were approximately
  111/198/1100/36/47 ms (Bun/Node/Python/Chromium/Firefox). Browser cold scope
  differs from processes; these are measurements, **not speed claims**.
  WASM linear high-water was 1,638,400 bytes. Firefox JS heap/RSS unavailable;
  Chromium exposed coarse nonstandard heap snapshots, not browser RSS.
- Targeted Oxlint passed. Full root typecheck is blocked only by existing
  `examples/js-library/feature-tree.ts` package self-reference resolution
  (`bun_nltk/wasm`, `bun_nltk/classify-tree`) in this isolated checkout.
  `PATH=/home/seyamalam/Desktp/bun_nltk/.venv/bin:$PATH bash scripts/loc-guard.sh`
  passed generated-byte audits and the 600-line guard. Without the pinned venv
  on PATH the existing generator prerequisite check fails; it is not a pass.
- Existing shipped-artifact gates: **1,055,547-byte WASM**, package **316 files /
  12,895,790 unpacked bytes**. All additions are outside package allowlist and
  no library sources/artifacts changed: shipped WASM and package delta **0**.
  No new optimized kernel candidate was needed or regenerated.

Remaining scope: broader malformed model families, native FFI host sanitizer
coverage, long-duration fuzz campaigns, full pretrained/corpus workload lifecycle
comparisons, WebKit pinned run and true browser process memory. Existing scale
and release gates still own their workloads and thresholds. Parent owns package
script registration, integration typecheck, final regeneration and releases.

Suggested parent-only package scripts (not applied here):

```json
{
  "test:adversarial": "bash scripts/verify-adversarial-local.sh",
  "fuzz:native": "bash scripts/fuzz-native.sh",
  "fuzz:native:coverage": "bash scripts/fuzz-native-coverage.sh",
  "bench:lifecycle": "bun bench/lifecycle_matrix.ts"
}
```
