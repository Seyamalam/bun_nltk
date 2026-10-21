import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { API, ModuleKind, ModuleResolutionKind } from "tsrs/unstable/sync";
import ts from "typescript";

// rollup-plugin-dts can lose `export type { Value as Alias }` when linking a
// value with both runtime and type-only aliases. Restore export kind from the
// original tsrs-emitted module namespace, never from a runtime-import heuristic.
const [inputDirectory, outputDirectory] = process.argv.slice(2);
const inputs = {
  "index.node": "src/portable_node.d.ts",
  "index.browser": "src/portable_browser.d.ts",
  ...Object.fromEntries(["wasm", "feature_nb", "feature_tree", "feature_maxent", "feature_encoding", "feature_types", "numeric_validation", "sync_wasm", "tokenizer_types", "tokenizer_runtime", "tokenizers_treebank", "tokenizers_basic", "metrics_wasm", "metrics", "distance_metrics", "confusion_metrics", "translation_metrics_extra"].map((name) => [name, `src/${name}.d.ts`])),
};
const api = new API();
try {
  const program = api.createProgram(Object.values(inputs).map((file) => resolve(inputDirectory, file)), {
    module: ModuleKind.Preserve, moduleResolution: ModuleResolutionKind.Bundler, types: [],
  });
  const checker = program.getProject().checker;
  const expected = new Map();
  for (const [name, input] of Object.entries(inputs)) {
    const symbol = checker.getSymbolOfSourceFile(resolve(inputDirectory, input));
    if (!symbol) throw new Error(`missing declaration module: ${input}`);
    const values = new Set(checker.getTypeOfSymbol(symbol).getProperties().map((property) => property.name));
    expected.set(name, {
      values: [...values].sort(),
      exports: checker.getExportsOfModule(symbol).map((exported) => exported.name).sort(),
    });
    const path = resolve(outputDirectory, `${name}.d.ts`);
    let text = readFileSync(path, "utf8");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const edits = [];
    for (const statement of source.statements) {
      if (!ts.isExportDeclaration(statement) || statement.isTypeOnly || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly && !values.has(element.name.text)) edits.push(element.getStart(source));
      }
    }
    for (const position of edits.sort((a, b) => b - a)) text = `${text.slice(0, position)}type ${text.slice(position)}`;
    writeFileSync(path, text);
  }
  program.dispose();
  const linked = api.createProgram(Object.keys(inputs).map((name) => resolve(outputDirectory, `${name}.d.ts`)), {
    module: ModuleKind.NodeNext, moduleResolution: ModuleResolutionKind.NodeNext,
    types: [], strict: true, skipLibCheck: false,
  });
  assert.deepEqual(linked.getSemanticDiagnostics(), [], "linked declarations must compile without ambient Bun types");
  const linkedChecker = linked.getProject().checker;
  for (const name of Object.keys(inputs)) {
    const symbol = linkedChecker.getSymbolOfSourceFile(resolve(outputDirectory, `${name}.d.ts`));
    assert.ok(symbol, name);
    assert.deepEqual({
      values: linkedChecker.getTypeOfSymbol(symbol).getProperties().map((property) => property.name).sort(),
      exports: linkedChecker.getExportsOfModule(symbol).map((exported) => exported.name).sort(),
    }, expected.get(name), `${name} must preserve every export, including type-only names`);
  }
  linked.dispose();
} finally {
  api.close();
}
