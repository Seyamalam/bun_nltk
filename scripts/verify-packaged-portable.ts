import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const archive = process.argv[2];
if (!archive) throw new Error("usage: bun run scripts/verify-packaged-portable.ts <package.tgz>");
const tarball = realpathSync(resolve(archive));

function run(command: string[], cwd: string): string {
  const child = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  if (child.exitCode !== 0) throw new Error(`${command.join(" ")} failed in ${cwd}\n${new TextDecoder().decode(child.stderr)}\n${new TextDecoder().decode(child.stdout)}`);
  return new TextDecoder().decode(child.stdout).trim();
}

// Test published subpaths, not repository imports or repaired file: dependency links.
const smoke = `
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WasmNltk } from "bun_nltk/wasm";
import { RustDecisionTreeClassifier } from "bun_nltk/classify-tree";
import { RustNaiveBayesClassifier } from "bun_nltk/classify-features";
const resolved = realpathSync(fileURLToPath(import.meta.resolve("bun_nltk/classify-tree")));
assert.ok(resolved.startsWith(process.cwd() + "/node_modules/"), resolved);
const runtime = await WasmNltk.init();
const tree = RustDecisionTreeClassifier.train(runtime, [[{"color 😀":"Red"},"upper"],[{"color 😀":"red"},"lower"]]);
const nb = RustNaiveBayesClassifier.train(runtime, [[{x:1},"number"],[{x:"1"},"string"]]);
try {
  assert.deepEqual(tree.classifyMany([{"color 😀":"Red"},{"color 😀":"red"},{}]), ["upper","lower","lower"]);
  assert.deepEqual(nb.classifyMany([{x:true},{x:"1"}]), ["number","string"]);
  assert.deepEqual(runtime.tokenizeAscii("Hello package!"), ["hello","package"]);
  assert.deepEqual([...runtime.perceptronPredictBatch(Uint32Array.of(0,1), Uint32Array.of(0,1,2), Float32Array.of(1,0,0,1),2,2)], [0,1]);
  assert.throws(() => runtime.perceptronPredictBatch(Uint32Array.of(0),Uint32Array.of(0,1),Float32Array.of(1),1,2), RangeError);
  if (typeof Bun !== "undefined") {
    const root = await import("bun_nltk");
    assert.equal(root.countTokensAscii("one two"), 2);
    const compat = root.DecisionTreeClassifier.train([[{x:"Red"},"upper"],[{x:"red"},"lower"]]);
    try { assert.deepEqual(compat.classifyMany([{x:"Red"},{x:"red"}]),["upper","lower"]); }
    finally { compat.dispose(); }
  }
  console.log(JSON.stringify({ok:true,runtime:process.version,bunVersion:typeof Bun !== "undefined" ? Bun.version : undefined,resolved,linearMemoryBytes:runtime.memoryBytes}));
} finally { tree.dispose(); nb.dispose(); runtime.dispose(); }
assert.throws(() => tree.classify({}), /disposed/);
`;

for (const installer of ["npm", "bun"] as const) {
  const directory = mkdtempSync(`/tmp/opencode/bun-nltk-packaged-${installer}-`);
  writeFileSync(resolve(directory, "package.json"), JSON.stringify({ name: "packaged-portable-check", private: true, type: "module" }));
  writeFileSync(resolve(directory, "smoke.mjs"), smoke);
  writeFileSync(resolve(directory, "types.ts"), `
import { WasmNltk } from "bun_nltk/wasm";
import { RustDecisionTreeClassifier } from "bun_nltk/classify-tree";
import { RustNaiveBayesClassifier } from "bun_nltk/classify-features";
const runtime = await WasmNltk.init();
const tree = RustDecisionTreeClassifier.train(runtime, [[{x:true},"A"]]);
const label: string = tree.classify({x:1});
const nb = RustNaiveBayesClassifier.train(runtime, [[{x:"Red"},label]]);
// @ts-expect-error Feature values cannot be arbitrary objects.
tree.classify({x:{nested:true}});
// @ts-expect-error Tree depth must be numeric.
RustDecisionTreeClassifier.train(runtime, [[{x:1},"A"]], {depthCutoff:"deep"});
nb.dispose(); tree.dispose(); runtime.dispose();
`);
  writeFileSync(resolve(directory, "tsconfig.json"), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: "ESNext", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ESNext", "DOM"], types: [], skipLibCheck: false },
    files: ["types.ts"],
  }));
  const install = installer === "npm"
    ? ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", tarball]
    : ["bun", "add", "--ignore-scripts", tarball];
  run(install, directory);
  const compiler = realpathSync(resolve(import.meta.dir, "../node_modules/.bin/tsrs"));
  run([compiler, "-p", "tsconfig.json"], directory);
  for (const runtime of ["node", "bun"]) {
    console.log(JSON.stringify({ installer, directory, typesChecked: true, ...JSON.parse(run([runtime, "smoke.mjs"], directory)) }));
  }
}
