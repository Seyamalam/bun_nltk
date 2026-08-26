#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
rounds="${1:-7}"

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "This validator requires an x64 Linux host. Found: $(uname -s) $(uname -m)" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required. Install it with: curl -fsSL https://bun.com/install | bash" >&2
  echo "Then open a new terminal and run this command again." >&2
  exit 1
fi

cd "$repo_root"
echo "Installing locked dependencies..."
bun install --frozen-lockfile
echo "Running native Linux validation with $rounds benchmark rounds..."
bun run verify:native-host --rounds "$rounds"
