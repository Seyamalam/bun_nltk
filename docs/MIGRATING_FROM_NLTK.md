# Migrating from Python NLTK

`bun_nltk` ports Python NLTK 3.10.3 to TypeScript for Bun, Node.js, and
browsers. This guide maps Python usage patterns to the package's surface and
lists the deliberate differences. For per-name implementation status see the
[compatibility inventory](compatibility-inventory.md) and the generated
`compatibility/inventory.json`.

## Imports

Python names are preserved as snake_case exports on the root entry point, so
most porting is mechanical:

```py
from nltk import word_tokenize, FreqDist
from nltk.stem import PorterStemmer
from nltk.translate import bleu_score
```

```ts
import { word_tokenize, FreqDist, PorterStemmer, bleu_score } from "bun_nltk";
```

Focused subpaths exist when the root barrel is unnecessary
(`bun_nltk/tokenize`, `bun_nltk/cluster`, `bun_nltk/wordnet`,
`bun_nltk/classify`, `bun_nltk/metrics`, ...). A few Python names collide with
JavaScript keywords or existing globals; check the inventory `exports` field
for the exact spelling of any given target.

## Type and protocol differences

| Python | TypeScript |
|---|---|
| `None` | `null` |
| `tuple` | fixed-length array |
| `list` / lazy iterator | `Array` (eager) or a real `Iterable` — check the signature |
| `Counter`/`defaultdict` | `Map`-backed `FreqDist` / `ConditionalFreqDist` |
| `ValueError`, `IndexError` | thrown `Error`s carrying the Python exception name in `.name` |
| keyword-only args | trailing options object or positional args matching Python order |

Iteration-heavy APIs return arrays rather than one-shot iterators. Where a
Python API consumes an iterable, arrays are accepted.

## Data and resources

- Bundled: English Punkt parameters, the full NLTK 3.10.3 VADER lexicon,
  NE-chunker models (Brotli), and a mini WordNet.
- `BUN_NLTK_WORDNET_PATH` overrides the bundled WordNet corpus;
  `loadWordNetPacked()` accepts an explicit packed path.
- `nltk.corpus` readers resolve against `NLTK_DATA`-style directories; corpus
  files that ship with Python NLTK but are not provisioned remain documented
  gaps rather than silently empty readers.
- There is no `nltk.download()` equivalent at runtime; resources are
  provisioned at build/dev time via `scripts/nltk-resources.py` (checksum-locked).

## Deliberate gaps

Shims exist so imports do not crash, but these throw descriptive errors —
matching Python behavior here is impossible without the dependency:

- Tkinter GUIs (`nltk.app`, `nltk.draw` and friends)
- External binaries/services: Stanford/Malt/CoreNLP wrappers, Boxer, chatbot
  network integrations, Twitter streaming
- Pickle deserialization of Python-trained artifacts (`.pickle` model loading,
  TBL demo pickles)
- Java bridges and `nltk.internals`-style subprocess launching are replaced
  by the native Rust path or stubbed where no equivalent exists

The inventory records each as `unsupported`/`gap` with notes — nothing is
silently partial.

## Behavioral notes

- Deterministic algorithms are pinned against the Python oracle
  (`test/*_oracle.py` files asserting NLTK 3.10.3). Where Python itself raises
  or misbehaves (documented upstream quirks), the port reproduces the quirk
  when feasible and documents any intentional divergence.
- Floating point: Rust/WASM kernels are bit-faithful where fixtures pin them;
  a small number of numeric paths state explicit tolerances in
  `artifacts/fidelity-report.json`.
- Randomized trainers (KMeans, EM) take explicit seeds where Python reads
  global `random` state; pin the seed for reproducibility.

## Runtime surfaces

- Bun: full surface, Rust FFI native library for migrated kernels.
- Node.js 24+: bundled portable root; WASM-backed APIs work, native-only calls
  throw a descriptive error.
- Browsers: curated WASM/tokenization root (`bun_nltk/wasm`); intentionally a
  subset of Node's surface.
