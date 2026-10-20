# Reproducible scale benchmarks

```bash
bun run build:rust
bun run build:wasm
PYTHONPATH=/path/to/nltk-3.10.3 bun run bench:scale
```

The Linux matrix runs three fresh processes per runtime and input size: 1 KiB,
1 MiB, 16 MiB, 64 MiB, 256 MiB, and 1 GiB. It compares a streaming Rust/Bun
frequency-distribution workload with streaming NLTK `FreqDist` and `bigrams`.
Node/Bun WASM aggregate metrics run up to 64 MiB; larger WASM cases are explicitly
unsupported because the current batch ABI is capped and has no streaming API.

`artifacts/scale-matrix.json` records raw samples, median operation and cold-process
wall times, input SHA-256, runtime versions, peak process RSS from GNU `time`,
and parity evidence. New runs also record the source revision, dirty worktree,
machine details, Bun version, and source/native/WASM SHA-256 digests.
Native/Python compare full frequency-count digests; WASM
compares aggregate token/ngram and unique counts. Native streaming additionally
computes heuristic conditional tags, so the operations are not identical.

Datasets repeat a seeded 1 MiB ASCII block over 128 words. This measures input-size
scaling with bounded vocabulary, not worst-case vocabulary growth. Runtime startup,
JS marshaling, and peak RSS must not be confused with Rust-only algorithm costs.
The native streaming hash API can collide; exact aggregate APIs use full keys.
No universal speed or memory claim follows from these workloads.

Override sizes/rounds for a shorter or larger run:

```bash
BUN_NLTK_BENCH_SIZES=1024,1048576 BUN_NLTK_BENCH_ROUNDS=3 bun run bench:scale
```

The harness creates and removes only its own dataset files under
`/tmp/opencode/bun-nltk-scale-matrix`. It requires GNU `/usr/bin/time`, Node 24+,
Bun, and Python NLTK 3.10.3. Other NLP families have dedicated `bench:compare:*`
commands; they are not covered by this input-scale matrix.

## Verified 2026-10-20 run

The recorded six-size, three-round run passed every count/digest check. At 1 GiB,
native streaming's median measured operation time was 14.11 s versus NLTK's
120.31 s (8.53×); peak RSS was 74.46 MiB versus 81.07 MiB (8.2% lower).
At 64 MiB, Bun WASM was 10.22× faster but used 2.88× Python's peak RSS; Node
WASM used 3.39×. Tiny 1 KiB Rust workloads were slower in operation time.

Raw evidence is versioned in `artifacts/scale-matrix.json`. This run began before
the harness's output/path isolation edits and Rust style cleanup. It exercised the
exact-key aggregate fix, not the earlier colliding-hash implementation. It did not
record machine metadata or source/artifact hashes; the updated harness records
those for future comparisons across machines or revisions.
