import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
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
import { RustMaxentClassifier } from "bun_nltk/classify-maxent";
import { ParsingRuntime, Tree, CFG, RustEarleyParser } from "bun_nltk/parse";
const resolved = realpathSync(fileURLToPath(import.meta.resolve("bun_nltk/classify-tree")));
assert.ok(resolved.startsWith(process.cwd() + "/node_modules/"), resolved);
const runtime = await WasmNltk.init();
const tree = RustDecisionTreeClassifier.train(runtime, [[{"color 😀":"Red"},"upper"],[{"color 😀":"red"},"lower"]]);
const nb = RustNaiveBayesClassifier.train(runtime, [[{x:1},"number"],[{x:"1"},"string"]]);
const maxent = RustMaxentClassifier.train(runtime, [[{x:"a"},"A"],[{x:"b"},"B"]]);
const parsing = await ParsingRuntime.load();
try {
  assert.deepEqual(tree.classifyMany([{"color 😀":"Red"},{"color 😀":"red"},{}]), ["upper","lower","lower"]);
  assert.deepEqual(nb.classifyMany([{x:true},{x:"1"}]), ["number","string"]);
  assert.equal(maxent.classify({x:"a"}), "A");
  assert.deepEqual(runtime.tokenizeAscii("Hello package!"), ["hello","package"]);
  assert.deepEqual([...runtime.perceptronPredictBatch(Uint32Array.of(0,1), Uint32Array.of(0,1,2), Float32Array.of(1,0,0,1),2,2)], [0,1]);
  assert.throws(() => runtime.perceptronPredictBatch(Uint32Array.of(0),Uint32Array.of(0,1),Float32Array.of(1),1,2), RangeError);
  const root = await import("bun_nltk");
  if (typeof Bun === "undefined") {
    assert.equal(root.WasmNltk, WasmNltk);
    assert.equal(root.RustDecisionTreeClassifier, RustDecisionTreeClassifier);
    assert.equal(root.Tree, Tree);
  }
  assert.deepEqual(root.word_tokenize("Hello."), ["Hello", "."]);
  assert.deepEqual(Tree.fromstring(parsing, '(S (NP café) (VP 😀))').leaves(), ['café','😀']);
  assert.equal(new RustEarleyParser(CFG.fromstring(parsing, "S -> S S | 'a'")).parse(['a','a','a','a']).length, 5);
  assert.equal(root.Tree.fromstring(parsing, '(S root)').get(0), 'root');
  assert.equal(root.accuracy(['a','b'], ['a','a']), 0.5);
  assert.equal(root.jaccardDistance(new Set(['a']), new Set(['b'])), 1);
  assert.equal(root.sentenceChrF('abcdef', 'abcdef'), 1);
  const encoding = root.BinaryMaxentFeatureEncoding.train([[{x:'a'},'A'],[{x:'b'},'B']]);
  try { assert.ok(encoding.encode({x:'a'},'A').length > 0); }
  finally { encoding.dispose(); }
  assert.doesNotThrow(() => root.neChunkIob([{token:'John',tag:'NNP'},{token:'runs',tag:'VBZ'}], {binary:true}));
  if (typeof Bun !== "undefined") {
    assert.equal(root.countTokensAscii("one two"), 2);
    const compat = root.DecisionTreeClassifier.train([[{x:"Red"},"upper"],[{x:"red"},"lower"]]);
    try { assert.deepEqual(compat.classifyMany([{x:"Red"},{x:"red"}]),["upper","lower"]); }
    finally { compat.dispose(); }
  } else {
    assert.deepEqual(root.word_tokenize_subset("Node root"), ["Node","root"]);
    assert.throws(() => root.countTokensAscii("one two"), /require Bun/);
  }
  console.log(JSON.stringify({ok:true,runtime:process.version,bunVersion:typeof Bun !== "undefined" ? Bun.version : undefined,resolved,linearMemoryBytes:runtime.memoryBytes}));
} finally { tree.dispose(); nb.dispose(); maxent.dispose(); parsing.dispose(); runtime.dispose(); }
assert.throws(() => tree.classify({}), /disposed/);
`;

for (const installer of ["npm", "bun"] as const) {
  const directory = mkdtempSync(`/tmp/opencode/bun-nltk-packaged-${installer}-`);
  writeFileSync(resolve(directory, "package.json"), JSON.stringify({ name: "packaged-portable-check", private: true, type: "module" }));
  writeFileSync(resolve(directory, "smoke.mjs"), smoke);
  const fixtures = resolve(import.meta.dir, "../test/fixtures/portable-types");
  for (const name of ["common", "node", "browser"]) {
    copyFileSync(resolve(fixtures, `${name}.ts.fixture`), resolve(directory, `${name}.ts`));
  }
  for (const name of ["nodenext", "bundler", "browser"]) {
    copyFileSync(resolve(fixtures, `tsconfig.${name}.json`), resolve(directory, `tsconfig.${name}.json`));
  }
  const install = installer === "npm"
    ? ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", tarball]
    : ["bun", "add", "--ignore-scripts", tarball];
  run(install, directory);
  const portable = resolve(directory, "node_modules/bun_nltk/dist/portable");
  const declarationCheck = JSON.parse(run(["node", resolve(import.meta.dir, "verify-portable-declarations.mjs"), portable], directory));
  // Every runtime name must be accessible to the consumer checker, not just a
  // handwritten sample. IsAny also catches root-wide facade regressions.
  const runtimeKeys = (entry: string): string[] => JSON.parse(run([
    "node", "--input-type=module", "-e",
    `console.log(JSON.stringify(Object.keys(await import(${JSON.stringify(entry)})).sort()))`,
  ], directory));
  const exportCheck = (names: string[]) => `
import * as root from "bun_nltk";
type IsAny<T> = 0 extends (1 & T) ? true : false;
type AssertFalse<T extends false> = T;
${names.map((name, index) => `const value${index} = root.${name};\ntype Precise${index} = AssertFalse<IsAny<typeof value${index}>>;`).join("\n")}
`;
  const nodeKeys = runtimeKeys("bun_nltk");
  const browserKeys = runtimeKeys(resolve(portable, "index.browser.js"));
  writeFileSync(resolve(directory, "exports.ts"), exportCheck(nodeKeys));
  writeFileSync(resolve(directory, "exports.browser.ts"), exportCheck(browserKeys));
  // Exercise browser condition selection through the installed package's export
  // map. Node --conditions=browser would still select the earlier node branch.
  writeFileSync(resolve(directory, "browser-entry.ts"), 'export * from "bun_nltk";');
  const browserBundle = await Bun.build({
    entrypoints: [resolve(directory, "browser-entry.ts")], target: "browser", format: "esm",
  });
  if (!browserBundle.success) throw new Error(browserBundle.logs.map(String).join("\n"));
  const browserCode = await browserBundle.outputs[0]!.text();
  assert.doesNotMatch(browserCode, /bun:ffi|from\s*["']node:/);
  writeFileSync(resolve(directory, "browser.mjs"), browserCode);
  assert.deepEqual(runtimeKeys(resolve(directory, "browser.mjs")), browserKeys, "browser export condition changed the runtime surface");
  const compiler = realpathSync(resolve(import.meta.dir, "../node_modules/.bin/tsrs"));
  for (const mode of ["nodenext", "bundler", "browser"]) {
    run([compiler, "-p", `tsconfig.${mode}.json`], directory);
  }
  // A deliberately unsuppressed error must fail the gate too: this checks a
  // negative consumer type contract, not just successful imports.
  writeFileSync(resolve(directory, "wrong-arg.ts"), 'import { word_tokenize } from "bun_nltk"; word_tokenize(42);');
  const config = JSON.parse(readFileSync(resolve(directory, "tsconfig.nodenext.json"), "utf8"));
  writeFileSync(resolve(directory, "tsconfig.negative.json"), JSON.stringify({ ...config, files: ["wrong-arg.ts"] }));
  const negative = Bun.spawnSync([compiler, "-p", "tsconfig.negative.json"], { cwd: directory, stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  assert.equal(negative.exitCode, 2, "wrong root argument must fail consumer compilation");
  assert.match(new TextDecoder().decode(negative.stdout), /TS2345/);
  for (const runtime of ["node", "bun"]) {
    console.log(JSON.stringify({ installer, directory, typesChecked: ["NodeNext", "bundler", "browser"], negativeCompileChecked: true, ...declarationCheck, ...JSON.parse(run([runtime, "smoke.mjs"], directory)) }));
  }
}
