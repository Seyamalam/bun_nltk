import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { API, ModuleKind, ModuleResolutionKind, SymbolFlags, TypeFlags } from "tsrs/unstable/sync";

// tsrs's synchronous API requires Node child-process descriptors, not Bun's.
// Inspect the installed tarball, with no Bun or Node ambient declaration types.
const directory = resolve(process.argv[2]);
const entries = ["index.node", "index.browser", "wasm", "feature_nb", "feature_tree", "feature_maxent"];
const api = new API();
try {
  const program = api.createProgram(entries.map((name) => resolve(directory, `${name}.d.ts`)), {
    module: ModuleKind.NodeNext, moduleResolution: ModuleResolutionKind.NodeNext,
    types: [], strict: true, skipLibCheck: false,
  });
  const checker = program.getProject().checker;
  assert.deepEqual(program.getSemanticDiagnostics(), [], "portable declaration graph has diagnostics");
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".d.ts"))) {
    const text = readFileSync(resolve(directory, file), "utf8");
    assert.doesNotMatch(text, /(?:from\s*|import\s*\()\s*["'](?:bun:|node:|.*\.ts["'])/);
    assert.doesNotMatch(text, /<reference\s+types\s*=\s*["'](?:bun|node)/);
  }
  function compare(symbol, runtime, label) {
    const properties = checker.getTypeOfSymbol(symbol).getProperties();
    assert.deepEqual(properties.map((property) => property.name).sort(), Object.keys(runtime).sort(), label);
    for (const property of properties) {
      const type = checker.getTypeOfSymbol(property);
      assert.equal(type.flags & TypeFlags.Any, 0, `${label}.${property.name} is an any facade`);
      const target = property.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(property) : property;
      if (target.flags & SymbolFlags.ValueModule) compare(target, runtime[property.name], `${label}.${property.name}`);
    }
  }
  const counts = {};
  for (const name of entries) {
    const symbol = checker.getSymbolOfSourceFile(resolve(directory, `${name}.d.ts`));
    assert.ok(symbol, name);
    const runtime = await import(pathToFileURL(resolve(directory, `${name}.js`)).href);
    compare(symbol, runtime, name);
    counts[name] = {
      values: Object.keys(runtime).length,
      // Includes interfaces, aliases and classes; only values must exist at runtime.
      totalDeclarationExports: checker.getExportsOfModule(symbol).length,
    };
  }
  program.dispose();
  console.log(JSON.stringify({ declarationExportsChecked: true, counts }));
} finally {
  api.close();
}
