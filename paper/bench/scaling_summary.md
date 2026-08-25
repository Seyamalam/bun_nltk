## Size scaling (median ms, warmup 2 / rounds 5)

### tokenize

| size | python_ms | native_ms | wasm_ms |
|------|-----------|-----------|---------|
| 10KB | 2.2 | 0.1 | 0.1 |
| 100KB | 22.0 | 0.9 | 0.8 |
| 1.0MB | 219.7 | 8.6 | 8.6 |
| 10MB | 2199.1 | 96.0 | 82.8 |

### punkt

| size | python_ms | native_ms | wasm_ms |
|------|-----------|-----------|---------|
| 10KB | 0.3 | 0.0 | 0.0 |
| 100KB | 3.0 | 0.1 | 0.2 |
| 1.0MB | 29.8 | 1.1 | 1.9 |
| 10MB | 292.9 | 11.9 | 19.3 |

### bigrams

| size | python_ms | native_ms | wasm_ms |
|------|-----------|-----------|---------|
| 10KB | 1.5 | 1.2 | 0.0 |
| 100KB | 14.9 | 12.1 | 0.1 |
| 1.0MB | 153.2 | 178.2 | 0.7 |
| 10MB | 1440.0 | 2066.2 | 6.7 |

## Real corpora (median ms, warmup 2 / rounds 5)

| corpus | tokens | runner | tokenize | punkt | freqdist |
|--------|--------|--------|----------|-------|----------|
| brown | 1440413 | python | 1988.5 | 237.8 | 254.2 |
| brown | 1440413 | native | 136.6 | 16.8 | 381.9 |
| brown | 1440413 | wasm | 108.5 | 43.6 | 86.1 |
| gutenberg | 543081 | python | 565.5 | 83.0 | 71.5 |
| gutenberg | 543081 | native | 25.8 | 4.4 | 105.1 |
| gutenberg | 543081 | wasm | 27.0 | 6.9 | 22.9 |
| reuters | — | skipped: not present in /Users/seyam/nltk_data/corpora; not downloaded per instructions | | | |
