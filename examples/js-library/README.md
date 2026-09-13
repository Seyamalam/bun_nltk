# Document analysis API

This is a production-shaped Bun service built on the published `bun_nltk@0.16.0` package. It demonstrates request validation, native NLP calls, batch processing, structured errors, a reusable analysis module, a CLI, and tests.

The analysis response includes:

- document size, token and sentence counts, lexical diversity, and average sentence length;
- document-level and sentence-level VADER-style sentiment;
- stopword-filtered keyword frequencies;
- configurable 2–4 gram frequencies;
- native execution time metadata.

## Start the API

```bash
bun install --frozen-lockfile
bun start
```

The service listens on `http://localhost:3000`. Set `PORT` to use another port.

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/api/analyze \
  -H 'content-type: application/json' \
  -d '{
    "text": "The release is fast and reliable. Setup was difficult, but the result is excellent!",
    "ngramSize": 2,
    "topK": 10
  }'
```

Batch endpoint:

```bash
curl -X POST http://localhost:3000/api/batch \
  -H 'content-type: application/json' \
  -d '{"documents":[{"text":"The first document is good."},{"text":"The second one is bad."}]}'
```

## Run as a CLI

Pass text directly or provide one text-file path:

```bash
bun run cli -- "Local NLP is fast and useful."
bun run cli -- ./article.txt
```

## Test

```bash
bun test
```

No Rust toolchain is needed. The npm package supplies native binaries for macOS arm64, Linux x64, and Windows x64.
