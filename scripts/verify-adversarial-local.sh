#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/tmp/opencode/bun-nltk-next-adversarial}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}"
bun test test/adversarial_seeded.test.ts test/lifecycle_benchmark.test.ts
cargo test --manifest-path rust/Cargo.toml --test adversarial_seeded --locked
bash scripts/fuzz-native.sh --seed 1337 --cases 500 --replay-out /tmp/opencode/bun-nltk-next-fuzz-local-replay.bin
