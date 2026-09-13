# Release benchmarks: 1.0.0

Measured September 13, 2026 on Apple M5 Pro, macOS arm64 (Darwin 25.6.0),
18 logical CPUs, 48 GiB RAM. Runtimes: Bun 1.4.0, Python 3.12.13, NLTK 3.10.3.

| Workload | Bun median (ms) | Python median (ms) | Python / Bun |
|---|---:|---:|---:|
| Categorical Naive Bayes | 2.56 | 8.30 | 3.24× |
| Decision tree | 6.08 | 18.17 | 2.99× |
| IIS MaxEnt | 4.83 | 74.37 | 15.39× |
| Conditional exponential (IIS) | 4.39 | 85.28 | 19.42× |
| Kneser–Ney LM | 111.71 | 410.90 | 3.68× |
| Trained English Punkt | 1.97 | 5.33 | 2.70× |
| Full VADER | 37.18 | 59.52 | 1.60× |
| Multiclass named entities | 97.96 | 156.72 | 1.60× |
| PCFG best parse | 30.95 | 1337.38 | 43.21× |

All nine workloads passed output comparisons. Labels, token/sentence arrays and
entity boundaries match; numeric comparisons use relative tolerance 1e-10.
The ratio is Python median / Bun median for this workload on this host.
These are workload measurements, not universal library speedups.

## Method

Each runtime performs one untimed warmup followed by five measured runs in one
process. Workloads and runtimes execute sequentially. Imports, process startup,
JSON/file I/O and warmup are excluded. The report retains every measured sample,
workload hashes, runtime versions and host information.

- Classifiers: feature extraction, training and one test prediction pass. NB and
  decision trees use 2,400 training and 600 test rows; IIS MaxEnt uses 900/250;
  conditional exponential uses 1,000/300. These are synthetic short documents
  with a small vocabulary, not a throughput estimate for full movie reviews.
  Both sides use the same algorithms, smoothing, depth/support and iteration settings.
- LM: train on 3,000 sentences (42,000 tokens), score 20 probes and one sentence's
  perplexity. Both sides use the same tokenized input and order-3 Kneser–Ney model.
- Punkt: tokenize 118,216 characters assembled from the differential fixture.
  VADER scores all 8,740 fixture texts. NE decodes 155 tagged sentences.
  One-time pretrained-model loading is excluded from inference timing.
- PCFG: load the imported grammar and find the best parse for seven cases.

The implementations may reuse loaded model parameters, but do not cache final
predictions. Raw timings must not be compared across operating systems or treated
as Linux/Windows runtime validation.

## Reproduce

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install nltk==3.10.3 numpy scipy
python3 -m nltk.downloader punkt_tab vader_lexicon maxent_ne_chunker_tab words
bun install --frozen-lockfile
bun run fixtures:import:nltk
python3 bench/generate_synthetic.py --size-mb 8 --seed 1337 --out bench/datasets/gate_synthetic.txt
bun run bench:release artifacts/release-benchmarks.json 5
```

The benchmark uses the checked-in native binaries. Run `bun run build:prebuilt`
and `bun run build:wasm` first when measuring changed Rust code on the supported
macOS build host. Avoid concurrent builds, tests or other CPU-heavy work.

[Raw samples and metadata](benchmarks/v1.0.0.json) are versioned with this release.
The older `bench:compare:*` commands are legacy diagnostics with different timing
boundaries. Their historical values are not the basis for the table above.
