import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rollup } from "rollup";
import { dts } from "rollup-plugin-dts";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, "dist/portable");
const declarations = mkdtempSync("/tmp/opencode/bun-nltk-declarations-");
const modules = ["wasm", "feature_nb", "feature_tree", "feature_maxent", "feature_encoding", "feature_types", "numeric_validation", "sync_wasm", "tokenizer_types", "tokenizer_runtime", "tokenizers_treebank", "tokenizers_basic", "metrics_wasm", "metrics", "distance_metrics", "confusion_metrics", "translation_metrics_extra", "parsing_runtime", "rust_parse"];
const compiler = Bun.spawnSync(["npx", "--no-install", "tsrs", "-p", "tsconfig.portable.json", "--outDir", declarations], {
  cwd: root, stdout: "pipe", stderr: "pipe", timeout: 120_000,
});
if (compiler.exitCode !== 0) throw new Error(new TextDecoder().decode(compiler.stdout) + new TextDecoder().decode(compiler.stderr));

// All declaration input is emitted by the pinned Rust compiler. Rollup only
// links .d.ts files: it never infers types from TS, or pulls Bun's implementation
// imports into the portable consumer graph. Multiple entries share nominal
// class types, so a root WasmNltk is also a classifier-subpath WasmNltk.
function jsImports(source: string): string {
  return source.replace(/(\bfrom\s*["']|\bimport\s*\(\s*["'])(\.{1,2}\/[^"']+)(["'])/g, (_, prefix: string, path: string, quote: string) => {
    return `${prefix}${path.replace(/(?:\.d)?\.ts$/, "").replace(/\.js$/, "")}.js${quote}`;
  });
}
// Only the build-owned output directory is replaced; stale declaration chunks
// otherwise leak into the tarball and consume the existing package budgets.
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
// One ESM graph shares implementations and class identity across both curated
// roots and subpaths. The browser entry has no native imports; its transitive
// graph is checked in real browsers and the installed-package verifier.
const bundle = await Bun.build({
  entrypoints: [resolve(root, "index.ts"), resolve(root, "src/index_browser.ts"),
    ...modules.map((name) => resolve(root, `src/${name}.ts`))],
  target: "node",
  format: "esm",
  splitting: true,
  outdir: output,
  naming: { entry: "[name].js", chunk: "chunk-[hash].js" },
  minify: true,
  external: ["bun:ffi"],
});
if (!bundle.success) throw new Error(bundle.logs.map(String).join("\n"));
renameSync(resolve(output, "index.js"), resolve(output, "index.node.js"));
renameSync(resolve(output, "index_browser.js"), resolve(output, "index.browser.js"));
// Retain previously published type-only conveniences without adding runtime
// exports. All values still come exclusively from the corresponding root.
for (const [name, entry] of [["node", "../index"], ["browser", "./index_browser"]] as const) {
  writeFileSync(resolve(declarations, `src/portable_${name}.d.ts`), `
export * from "${entry}";
export type { WasmNltkInit } from "./wasm";
export type { FeatureSet, FeatureValue, LabeledFeatureset, PositiveFeatureOptions } from "./feature_nb";
export type { FeatureTreeOptions } from "./feature_tree";
export type { FeatureMaxentOptions, FeatureMaxentSerialized } from "./feature_maxent";
`);
}
const declarationBundle = await rollup({
  input: {
    "index.node": resolve(declarations, "src/portable_node.d.ts"),
    "index.browser": resolve(declarations, "src/portable_browser.d.ts"),
    ...Object.fromEntries(modules.map((name) => [name, resolve(declarations, `src/${name}.d.ts`)])),
  },
  plugins: [dts({ respectExternal: true })],
  onwarn(warning) { throw new Error(warning.message); },
});
try {
  const result = await declarationBundle.generate({
    format: "esm", entryFileNames: "[name].d.ts", chunkFileNames: "types/[name]-[hash].d.ts",
  });
  for (const file of result.output) {
    if (file.type !== "chunk") throw new Error(`unexpected declaration asset: ${file.fileName}`);
    const path = resolve(output, file.fileName);
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeFileSync(path, jsImports(file.code));
  }
  const linked = Bun.spawnSync(["node", resolve(root, "scripts/link-portable-types.mjs"), declarations, output], {
    cwd: root, stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  if (linked.exitCode !== 0) throw new Error(new TextDecoder().decode(linked.stdout) + new TextDecoder().decode(linked.stderr));
} finally {
  await declarationBundle.close();
  rmSync(declarations, { recursive: true, force: true });
}
console.log(JSON.stringify({ ok: true, output, modules, roots: ["index.node.js", "index.browser.js"] }));
