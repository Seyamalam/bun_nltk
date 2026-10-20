# Reproducible scale benchmarks

```bash
bun run build:rust
bun run build:wasm
PYTHONPATH=/path/to/nltk-3.10.3 bun run bench:scale
```

The Linux matrix runs three fresh processes per runtime and input size: 1 KiB,
1 MiB, 16 MiB, 64 MiB, 256 MiB, and 1 GiB. It compares a streaming Rust/Bun
frequency-distribution workload with streaming NLTK `FreqDist` and `bigrams`.
Node/Bun WASM batch aggregate metrics run up to 64 MiB. Exact WASM streaming
metrics run at every size; each 1 MiB chunk stays within the staging limit.

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
The native streaming hash API can collide; WASM streaming and exact batch aggregate
APIs use full keys. WASM streaming memory grows with distinct keys, with explicit
token-length and key-count capacity limits; it is not constant for growing vocabulary.
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
That recorded run predates WASM streaming, so its missing large WASM cases must
not be interpreted as streaming measurements. New runs measure both streaming
and batch paths.

## Exact WASM streaming follow-up

The three-round 1/64 MiB follow-up is retained in
`artifacts/stream-scale-matrix.json`, including machine and artifact provenance.
At 64 MiB, Bun streaming used 42.29 MiB peak RSS versus batch's 231.05 MiB
(81.7% lower) and NLTK's 80.48 MiB; operation time was 0.646 s versus NLTK's
6.531 s (10.11× faster). Node streaming used 81.57 MiB versus batch's 272.04 MiB,
roughly matching NLTK rather than guaranteeing lower RSS. Both streaming paths
matched aggregate counts. This is still a bounded-vocabulary workload.

Raw evidence is versioned in `artifacts/scale-matrix.json`. This run began before
the harness's output/path isolation edits and Rust style cleanup. It exercised the
exact-key aggregate fix, not the earlier colliding-hash implementation. It did not
record machine metadata or source/artifact hashes; the updated harness records
those for future comparisons across machines or revisions.
