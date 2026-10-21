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

function rootFacade(names: readonly string[], types: readonly string[]): string {
  const lines = [
    "// Generated runtime-compatible root declarations.",
    "// Use the wasm/classifier subpaths for precise declarations.",
  ];
  for (const name of types) lines.push(`export type ${name} = any;`);
  for (const name of names) lines.push(`export const ${name}: any;`);
  return `${lines.join("\n")}\n`;
}

function declaredTypes(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+type\s*\{([^}]*)\}/g)) {
    for (const raw of match[1]!.split(",")) {
      const spec = raw.trim();
      if (!spec) continue;
      const parts = spec.split(/\s+as\s+/);
      names.add((parts[1] ?? parts[0])!.trim());
    }
  }
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of match[1]!.split(",")) {
      const spec = raw.trim();
      if (!spec.startsWith("type ")) continue;
      const parts = spec.slice(5).trim().split(/\s+as\s+/);
      names.add((parts[1] ?? parts[0])!.trim());
    }
  }
  return [...names].sort();
}
const transpiler = new Bun.Transpiler({ target: "browser" });
mkdirSync(output, { recursive: true });
for (const name of modules) {
  const source = readFileSync(resolve(root, `src/${name}.ts`), "utf8");
  writeFileSync(resolve(output, `${name}.js`), jsImports(transpiler.transformSync(source, "ts")));
  writeFileSync(resolve(output, `${name}.d.ts`), jsImports(readFileSync(resolve(declarations, `${name}.d.ts`), "utf8")));
}
for (const [entrypoint, naming, target] of [
  ["index.ts", "index.node.js", "node"],
  ["src/index_browser.ts", "index.browser.js", "browser"],
] as const) {
  const bundle = await Bun.build({
    entrypoints: [resolve(root, entrypoint)],
    target,
    format: "esm",
    outdir: output,
    naming,
    minify: true,
    external: target === "node" ? ["bun:ffi"] : [],
  });
  if (!bundle.success) throw new Error(bundle.logs.map(String).join("\n"));
}
const rootSource = readFileSync(resolve(root, "index.ts"), "utf8");
const browserSource = readFileSync(resolve(root, "src/index_browser.ts"), "utf8");
const rootApi = await import(resolve(root, "index.ts")) as Record<string, unknown>;
const browserApi = await import(resolve(root, "src/index_browser.ts")) as Record<string, unknown>;
writeFileSync(resolve(output, "index.node.d.ts"), rootFacade(Object.keys(rootApi).sort(), declaredTypes(rootSource)));
writeFileSync(resolve(output, "index.browser.d.ts"), rootFacade(Object.keys(browserApi).sort(), declaredTypes(browserSource)));
console.log(JSON.stringify({ ok: true, output, modules, roots: ["index.node.js", "index.browser.js"] }));
