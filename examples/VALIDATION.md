# Example validation

Validated on September 13, 2026, with Bun 1.4.0 and desktop Chromium through Argent.

## Local checks

- Both examples install with `bun install --frozen-lockfile`.
- Document API: 4 tests pass, covering structured analysis, option validation, HTTP analysis, and validation errors.
- Browser production build and Wrangler deployment dry run pass.
- Repository typecheck and lint pass.
- Repository test suite: 432 tests pass across 66 files, with no failures.
- Both CI workflow formats parse as YAML.

## Browser behavior

The checks exercised DOM event handlers and inspected rendered output and exported JSON. File inputs used browser `File` and `DataTransfer` objects; the operating-system file chooser was not tested.

| Scenario | Observed result |
| --- | --- |
| Import `Alpha beta alpha. Gamma delta!` | 5 tokens, 4 unique tokens, 4 bigrams, 2 sentences; JS/WASM match |
| Filter for `alpha` | 2 of 5 tokens match |
| Inspect ranked terms and sentences | `alpha` ranks first with count 2; first sentence preserves source text |
| Export JSON | Source, metrics, tokens, options, and parity match the displayed analysis |
| Edit source before benchmarking | Export disables; benchmarking analyzes the new text and exports matching metrics and 25-round timing results |
| Drop a text file | Source and analysis update |
| Select four-grams for a four-token document | 1 n-gram; JS/WASM match |
| Analyze empty input | 0 tokens without a runtime error |
| Benchmark repeated text | Finite speedup; zero-duration measurements are handled without displaying infinity |
| Import beyond WASM capacity | Input is rejected with a size error before reading the file contents |
| Analyze valid input after an error | Error clears and export works again |

## Deployment

The public site is https://bun-nltk-playground.seyamalam41.workers.dev. Its deployed page renders, loads WASM, and reports JS/WASM parity. Deployment uses Cloudflare Workers static assets and the example's `bun run deploy` command.

## Native-host limits

Linux and Windows native reports were not produced in this session. Remote CI has since been removed from the repository; native host validation runs locally via `scripts/verify-linux.sh` and `scripts/verify-windows.cmd` as documented in [docs/NATIVE_HOST_VALIDATION.md](../docs/NATIVE_HOST_VALIDATION.md).
