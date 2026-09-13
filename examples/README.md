# Example projects

These projects consume the published `bun_nltk@0.16.0` package. Each example has its own dependencies and lockfile, so it can be copied out of this repository and run independently.

## Document analysis API

A tested Bun API and CLI that combines native n-gram work, sentence splitting, keyword frequency, document statistics, and sentence-level sentiment. It includes validation, batch requests, structured errors, and a reusable analysis module.

```bash
cd examples/js-library
bun install --frozen-lockfile
bun start
```

Run the CLI or tests:

```bash
bun run cli -- "Bun is fast, but this migration was difficult."
bun test
```

## Browser WASM playground

[Open the live playground](https://bun-nltk-playground.seyamalam41.workers.dev).

A local-first Vite workbench with file import, JS/WASM parity, repeated benchmarks, token search, ranked terms, sentence inspection, and report export.

```bash
cd examples/wasm-browser
bun install --frozen-lockfile
bun run dev
```

Build the deployable site with:

```bash
bun run build
```

The generated site is written to `examples/wasm-browser/dist/`.
