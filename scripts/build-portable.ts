import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, "dist/portable");
const declarations = mkdtempSync("/tmp/opencode/bun-nltk-declarations-");
const modules = ["wasm", "feature_nb", "feature_tree", "feature_maxent", "feature_encoding", "feature_types", "numeric_validation"];
const compiler = Bun.spawnSync(["npx", "--no-install", "tsrs", "-p", "tsconfig.portable.json", "--outDir", declarations], {
  cwd: root, stdout: "pipe", stderr: "pipe", timeout: 120_000,
});
if (compiler.exitCode !== 0) throw new Error(new TextDecoder().decode(compiler.stdout) + new TextDecoder().decode(compiler.stderr));

// Preserve individual modules and relative imports; no bundler or TS loader is
// required by consumers. Declarations resolve the same JS module paths.
function jsImports(source: string): string {
  return source.replace(/(\bfrom\s*["']|\bimport\s*\(\s*["'])(\.\/?[^"']+)(["'])/g, (_, prefix: string, path: string, quote: string) => {
    return `${prefix}${path.replace(/\.ts$/, "").replace(/\.js$/, "")}.js${quote}`;
  });
}
const transpiler = new Bun.Transpiler({ target: "browser" });
mkdirSync(output, { recursive: true });
for (const name of modules) {
  let source = readFileSync(resolve(root, `src/${name}.ts`), "utf8");
  if (name === "wasm") {
    const original = 'new URL("../native/bun_nltk.wasm", import.meta.url)';
    if (!source.includes(original)) throw new Error("default WASM URL changed; update portable build layout");
    source = source.replace(original, 'new URL("../../native/bun_nltk.wasm", import.meta.url)');
  }
  writeFileSync(resolve(output, `${name}.js`), jsImports(transpiler.transformSync(source, "ts")));
  writeFileSync(resolve(output, `${name}.d.ts`), jsImports(readFileSync(resolve(declarations, `${name}.d.ts`), "utf8")));
}
console.log(JSON.stringify({ ok: true, output, modules }));
