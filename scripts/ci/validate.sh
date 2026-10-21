#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$PWD/rust/target/semaphore-${SEMAPHORE_JOB_ID:-local}}"
case "${1:-}" in
  static)
    npx --no-install tsrs -p tsconfig.json --noEmit
    bun run compatibility:typecheck
    bun run compatibility:check
    npx --no-install oxlint src test bench scripts index.ts
    bash scripts/loc-guard.sh 600
    python3 scripts/ci/validate-config.py
    python3 -m unittest discover -s scripts/ci -p 'test_*.py'
    ;;
  rust)
    for manifest in rust/Cargo.toml rust/compat/Cargo.toml; do
      cargo fmt --manifest-path "$manifest" --check
      cargo clippy --locked --manifest-path "$manifest" --all-targets -- -D warnings
      cargo clippy --locked --manifest-path "$manifest" --target wasm32-unknown-unknown --all-targets -- -D warnings
      cargo test --locked --manifest-path "$manifest"
    done
    bun run scripts/ci/native-build.ts native
    bun run scripts/ci/native-build.ts wasm
    bun run scripts/ci/native-build.ts compat
    bun run scripts/build-nltk-compat.ts --check
    ;;
  tests)
    python3 scripts/ci/oracle.py check
    bun run scripts/ci/native-build.ts native
    bun run scripts/ci/native-build.ts wasm
    mkdir -p artifacts/semaphore-tests
    bun test ./test --reporter=junit --reporter-outfile=artifacts/semaphore-tests/bun.xml
    # Bun can exit zero even when JUnit output could not be written.
    test -s artifacts/semaphore-tests/bun.xml
    ;;
  fidelity)
    python3 scripts/ci/oracle.py check
    bun run scripts/ci/native-build.ts native
    bun run scripts/ci/native-build.ts wasm
    python3 scripts/ci/oracle.py fixtures
    bun run fidelity:gate
    ;;
  portable)
    bun run scripts/ci/native-build.ts native
    bun run scripts/ci/native-build.ts wasm
    npx --no-install playwright install --with-deps chromium firefox webkit
    bun run build:portable
    git diff --exit-code -- dist/portable
    bun run verify:portable
    # Family verifiers are parent-owned; call their real entrypoints, not a
    # duplicate browser harness or inferred package-script registration.
    bun run scripts/verify-tokenizers-portable.ts
    bun run scripts/verify-punkt-portable.ts
    bun run scripts/verify-metrics-portable.ts
    bun run scripts/verify-parsing-portable.ts
    # The installed-package verifier currently uses this Linux-only temp root.
    mkdir -p /tmp/opencode artifacts/semaphore-package
    bun pm pack --ignore-scripts --destination artifacts/semaphore-package
    version=$(node -p "require('./package.json').version")
    bun run verify:packaged-portable "$PWD/artifacts/semaphore-package/bun_nltk-$version.tgz"
    bun run scripts/verify-parsing-packaged.ts "$PWD/artifacts/semaphore-package/bun_nltk-$version.tgz"
    bun run wasm:size:check
    bun run package:size:check
    bun run pack:verify:prebuilt
    ;;
  examples)
    bun run scripts/ci/native-build.ts native
    bun run scripts/ci/native-build.ts wasm
    # setup.sh already installs this consumer; avoid a second file:../.. copy.
    (cd examples/js-library && bun test)
    (cd examples/wasm-browser && bun install --frozen-lockfile && bun run build)
    ;;
  native-host)
    bun run scripts/ci/native-build.ts native
    bun run scripts/ci/native-build.ts wasm
    bun run build:portable
    bun run native:artifacts:check
    host=$(bun -e 'console.log(`${process.platform}-${process.arch}`)')
    bun run verify:native-host -- --rounds 7 --output "artifacts/semaphore-native/$host/host.json"
    ;;
  *) echo "usage: validate.sh static|rust|tests|fidelity|portable|examples|native-host" >&2; exit 2 ;;
esac
