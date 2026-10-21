#!/usr/bin/env bash
# Source this file: PATH and Cargo isolation must survive into the job commands.
set -euo pipefail
CI_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$CI_ROOT"
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) CI_HOST=linux-x64 ;;
  Darwin-arm64) CI_HOST=darwin-arm64 ;;
  *) echo "Unsupported CI host (no cross-build or Rosetta fallback)" >&2; return 1 ;;
esac
export CI_HOST
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$CI_ROOT/rust/target/semaphore-${SEMAPHORE_JOB_ID:-local}}"
export PATH="$CI_ROOT/.cache/semaphore/bin:$HOME/.cargo/bin:$PATH"
mkdir -p "$CI_ROOT/.cache/semaphore/bin"

# Python is only needed for the Linux oracle. The native macOS lane uses Ruby,
# already present on the hosted image, to read the same pinned tool manifest.
if [[ "$CI_HOST" == linux-x64 ]]; then
  sem-version node "$(python3 -c 'import json; print(json.load(open("scripts/ci/versions.json"))["node"])')"
  sem-version python "$(python3 -c 'import json; print(json.load(open("scripts/ci/versions.json"))["python"])')"
  read -r CI_BUN_VERSION CI_ARCHIVE CI_SHA CI_RUST_VERSION < <(python3 -c 'import json,os; v=json.load(open("scripts/ci/versions.json")); a=v["bunArchives"][os.environ["CI_HOST"]]; print(v["bun"],a["name"],a["sha256"],v["rust"])')
else
  read -r CI_BUN_VERSION CI_ARCHIVE CI_SHA CI_RUST_VERSION < <(ruby -rjson -e 'v=JSON.parse(File.read("scripts/ci/versions.json")); a=v["bunArchives"][ENV["CI_HOST"]]; puts [v["bun"],a["name"],a["sha256"],v["rust"]].join(" ")')
fi
export RUSTUP_TOOLCHAIN="$CI_RUST_VERSION"
if ! command -v bun >/dev/null || [[ "$(bun --version)" != "$CI_BUN_VERSION" ]]; then
  CI_ZIP="$CI_ROOT/.cache/semaphore/$CI_ARCHIVE"
  curl --fail --location --retry 3 "https://github.com/oven-sh/bun/releases/download/bun-v$CI_BUN_VERSION/$CI_ARCHIVE" --output "$CI_ZIP"
  if [[ "$CI_HOST" == linux-x64 ]]; then
    echo "$CI_SHA  $CI_ZIP" | sha256sum --check
  else
    echo "$CI_SHA  $CI_ZIP" | shasum -a 256 --check
  fi
  unzip -o -q "$CI_ZIP" -d "$CI_ROOT/.cache/semaphore"
  cp "$CI_ROOT/.cache/semaphore/${CI_ARCHIVE%.zip}/bun" "$CI_ROOT/.cache/semaphore/bin/bun"
  chmod +x "$CI_ROOT/.cache/semaphore/bin/bun"
fi
if ! command -v rustup >/dev/null; then
  # rustup is a bootstrap tool; all compiler/components are version-selected.
  curl --fail --location --retry 3 https://sh.rustup.rs --output "$CI_ROOT/.cache/semaphore/rustup-init.sh"
  sh "$CI_ROOT/.cache/semaphore/rustup-init.sh" -y --profile minimal --default-toolchain none
fi
rustup toolchain install "$CI_RUST_VERSION" --profile minimal --component rustfmt --component clippy
rustup target add wasm32-unknown-unknown --toolchain "$CI_RUST_VERSION"
bun install --frozen-lockfile
# tsconfig.json includes this example's package-subpath consumer.
(cd examples/js-library && bun install --frozen-lockfile)
bun --version
rustc --version

if [[ "$CI_HOST" == linux-x64 ]]; then
  python3 -c 'import json,platform; expected=json.load(open("scripts/ci/versions.json"))["python"]; actual=platform.python_version(); assert actual == expected, f"Expected Python {expected}, got {actual}"'
  python3 -m venv .venv
  export PATH="$CI_ROOT/.venv/bin:$PATH"
  python3 -m pip install --require-hashes --only-binary=:all: -r scripts/ci/oracle-requirements.txt
  python3 -m pip check
  export NLTK_DATA="$CI_ROOT/.cache/semaphore/nltk_data"
  # Do not inherit a developer's source tree as the CI oracle.
  unset PYTHONPATH
  export PYTHONHASHSEED=0
  python3 scripts/ci/oracle.py prepare
fi
