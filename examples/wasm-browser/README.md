# Local-first browser document workbench

[Open the live playground](https://bun-nltk-playground.seyamalam41.workers.dev).

This project loads the Rust WebAssembly binary shipped in `bun_nltk@0.16.0` and imports the package's JavaScript reference implementation for an in-browser parity and performance comparison.

It includes:

- paste, drag-and-drop, and file-picker input without uploading text;
- Rust WASM tokenization, Punkt-style sentence boundaries, and configurable n-gram metrics;
- JavaScript-versus-WASM parity checks and a 25–250 round benchmark;
- token filtering, ranked term frequencies, and sentence inspection;
- complete local JSON report export;
- responsive keyboard-accessible UI.

```bash
bun install --frozen-lockfile
bun run dev
```

Then open the local URL printed by Vite. To create static deployment files:

```bash
bun run build
```

The `prepare:wasm` script resolves the installed `bun_nltk` package and copies `native/bun_nltk.wasm` into Vite's public directory. The browser code uses the stable exported WASM functions directly and imports pure reference functions through `bun_nltk/reference`, so it does not need Node.js polyfills or a Rust compiler.

## Deploy

The checked-in Wrangler configuration serves `dist/` as static assets on Cloudflare Workers. With an authenticated Cloudflare account, run:

```bash
bun run deploy
```

Change `name` in `wrangler.jsonc` before deploying your own copy. Documents stay in the browser; deployment uploads only the built site and package WASM binary.

## Report behavior

Editing the source disables export until analysis runs again. Benchmarking always analyzes the current source first, so exported metrics and timings refer to the same document. If either measured duration is zero, the UI shows `Below timer resolution` and the report's `wasmSpeedup` is `null`.
