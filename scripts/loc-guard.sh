#!/usr/bin/env bash
# LOC guard: fails if any tracked .ts/.rs source file exceeds MAX_LOC lines.
# Excludes generated data files, tests, and a shrinking grandfather list of
# legacy files pending split (see README "Project hygiene").
set -euo pipefail
MAX_LOC="${1:-600}"
violations=0
while IFS= read -r file; do
  # skip generated/bundled data modules and test files
  case "$file" in
    *_data.ts|*.test.ts|*_data.rs) continue ;;
  esac
  # Grandfathered legacy files pending split; shrink this list over time.
  case "$file" in
    rust/src/ffi.rs|rust/src/wasm_exports.rs|src/brill_tagger.ts|src/collocations.ts|src/drt.ts|src/native.ts|src/parse.ts|src/probability.ts|src/sem_logic.ts|src/snowball.ts|src/wasm.ts) continue ;;
  esac
  loc=$(wc -l < "$file")
  if [ "$loc" -gt "$MAX_LOC" ]; then
    echo "OVER LIMIT ($loc > $MAX_LOC): $file"
    violations=$((violations + 1))
  fi
done < <(git ls-files '*.ts' '*.rs' | grep -v '^node_modules')
if [ "$violations" -gt 0 ]; then
  echo ""
  echo "$violations file(s) exceed the ${MAX_LOC}-LOC limit."
  echo "Split them into cohesive modules before adding more code to them."
  exit 1
fi
echo "loc-guard: all tracked .ts/.rs files within ${MAX_LOC} lines"
