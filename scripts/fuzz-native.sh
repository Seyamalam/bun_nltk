#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/tmp/opencode/bun-nltk-next-adversarial}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}"
mkdir -p /tmp/opencode
# Debug unwinding gives actionable failures; never invoke native raw-pointer ABIs.
cargo build --manifest-path rust/Cargo.toml --example adversarial_fuzz --locked
timeout 60s "$CARGO_TARGET_DIR/debug/examples/adversarial_fuzz" "$@"
