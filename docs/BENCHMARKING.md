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

To measure vocabulary growth instead of repeating a block, provide one vocabulary
size per input size. This uses a fresh seeded word sequence for the whole file:

```bash
BUN_NLTK_BENCH_SIZES=1048576,4194304,8388608 \
BUN_NLTK_BENCH_VOCABULARIES=128,2048,65536 \
BUN_NLTK_BENCH_OUTPUT=artifacts/vocabulary-scale-matrix.json bun run bench:scale
```

Default streaming capacity limits still apply. Workloads exceeding one million
distinct bigrams fail rather than silently truncating. Vocabulary sizes describe
the available word pool; actual observed counts are retained with every sample.
An exact byte-size cutoff may add one truncated final word outside that pool.

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

Raw evidence is versioned in `artifacts/scale-matrix.json`. This run began before
the harness's output/path isolation edits and Rust style cleanup. It exercised the
exact-key aggregate fix, not the earlier colliding-hash implementation. It did not
record machine metadata or source/artifact hashes; the updated harness records
those for future comparisons across machines or revisions.

## Exact WASM streaming follow-up

The three-round 1/64 MiB follow-up is retained in
`artifacts/stream-scale-matrix.json`, including machine and artifact provenance.
At 64 MiB, Bun streaming used 42.29 MiB peak RSS versus batch's 231.05 MiB
(81.7% lower) and NLTK's 80.48 MiB; operation time was 0.646 s versus NLTK's
6.531 s (10.11× faster). Node streaming used 81.57 MiB versus batch's 272.04 MiB,
roughly matching NLTK rather than guaranteeing lower RSS. Both streaming paths
matched aggregate counts. This is still a bounded-vocabulary workload.

The 256 MiB/1 GiB three-round extension is retained separately in
`artifacts/large-stream-scale-matrix.json`. At 1 GiB, Bun WASM streaming took
11.731 s versus NLTK's 119.003 s (10.14×), with 45.72 MiB peak RSS versus
81.02 MiB (43.6% lower). Node WASM took 11.633 s (10.23×) and used 81.82 MiB,
about 1% more RSS than Python. Native/Python full-count digests and all WASM
aggregate comparisons passed at both sizes. The report records the dirty Rust
worktree while exercising the pre-cleanup binary hashes; it is not a benchmark
of the later rebuilt artifacts.

## Vocabulary-growth follow-up

`artifacts/vocabulary-scale-matrix.json` retains three-round fresh-sequence cases
at 1/4/8 MiB, with word pools of 128/2048/65536. The 8 MiB case observed 65,537
tokens (including a truncated final word) and 853,323 distinct bigrams. Every
native/Python count digest and WASM aggregate comparison passed.

At 8 MiB, Bun streaming took 0.220 s and 71.29 MiB peak RSS versus NLTK's
3.183 s and 486.56 MiB. WASM linear memory grew to 33.06 MiB versus 3 MiB in
the small-vocabulary case. These numbers are not equivalent-work speedups: WASM
stores distinct keys and reports aggregates, while native/Python also build full
frequency counts and sorted digests. Native used 517.36 MiB, slightly **more**
than Python, despite running about twice as fast. No universal lower-memory
claim is warranted.

## Lossless feature decision trees

`bun run bench:compare:feature-tree` measures the new `RustDecisionTreeClassifier`
against unmodified NLTK 3.10.3, not the legacy text-tree implementation. Three
cold-process rounds at 60/2,400/12,000 training rows cover categorical stumps and
binary refinement. Identical JSON inputs, prediction SHA-256 digests and label
sets match across Python, Bun WASM and Node WASM. Raw timings, peak RSS, machine
metadata and source/artifact hashes are retained in
`artifacts/feature-tree-benchmark.json`.

At 12,000 rows, binary training took 28.71 ms in Bun and 24.22 ms in Node versus
73.41 ms in Python (2.56×/3.03× faster). However, 3,000 predictions took
5.63/6.35 ms versus Python's 0.30 ms, and peak RSS was 69.42/91.35 MiB versus
59.63 MiB. Small Rust training cases were slower too. Per-row feature marshaling
and WASM dispatch remain optimization targets; neither universal speed nor
lower-memory claims follow from these balanced low-cardinality workloads.

Training/prediction timers exclude JSON reads, module imports and WASM startup.
Rust training includes feature marshaling; initialization is separately reported.
Wall time and RSS include cold-process/runtime/input overhead and output hashing.
No browser timing, native tree ABI or arbitrary tree structure is measured.
