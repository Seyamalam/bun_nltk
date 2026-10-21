#!/usr/bin/env bash
# LOC guard: fails if any tracked .ts/.rs source file exceeds MAX_LOC lines.
# Excludes generated data files, tests, and a shrinking grandfather list of
# legacy files pending split (see README "Project hygiene").
set -euo pipefail
MAX_LOC="${1:-600}"
violations=0
# Exact generator exceptions are audited before skipping their line counts.
# See docs/generated-source-audit.md; no new legacy grandfather entries.
bun run scripts/audit-generated.ts
while IFS= read -r file; do
  # skip generated/bundled data modules, build output and test files
  case "$file" in
    *_data.ts|*.test.ts|*_data.rs|dist/*|rust/src/compat_unicode.rs|rust/src/tokenizer_unicode.rs) continue ;;
  esac
  # Grandfathered legacy files pending split; shrink this list over time.
  case "$file" in
    rust/src/ffi.rs|rust/src/wasm_exports.rs|rust/src/categorical_maxent.rs|rust/src/parsing.rs|rust/src/text_naive_bayes.rs|rust/src/tokenizers.rs|rust/src/wasm_probability_contracts.rs|src/brill_tagger.ts|src/collocations.ts|src/drt.ts|src/native.ts|src/parse.ts|src/probability.ts|src/sem_logic.ts|src/wasm.ts|src/sem_glue_formula.ts|src/sem_glue_dict.ts|src/sem_glue_engine.ts) continue ;;
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
