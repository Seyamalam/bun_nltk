#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../rust"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/tmp/opencode/bun-nltk-next-adversarial-fuzz}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}"
mkdir -p /tmp/opencode/bun-nltk-next-fuzz-corpus
"${CARGO:-cargo}" fuzz --version
bash ../scripts/fuzz-native.sh --cases 1 --write-corpus /tmp/opencode/bun-nltk-next-fuzz-corpus
# Includes compiler time in the outer bound; libFuzzer bounds apply to execution.
timeout 180s "${CARGO:-cargo}" +nightly fuzz run adversarial /tmp/opencode/bun-nltk-next-fuzz-corpus -- \
  -runs=5000 -max_total_time=30 -seed=1337 -max_len=16384 -timeout=5 -rss_limit_mb=512 \
  -artifact_prefix=/tmp/opencode/bun-nltk-next-fuzz-artifact-
