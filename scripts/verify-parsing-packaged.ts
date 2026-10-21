import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const archive = process.argv[2];
if (!archive) throw new Error("usage: bun run scripts/verify-parsing-packaged.ts <package.tgz>");
const directory = mkdtempSync("/tmp/opencode/bun-nltk-parsing-package-");
function run(command: string[]): string {
  const child = Bun.spawnSync(command, { cwd: directory, stdout: "pipe", stderr: "pipe", timeout: 120000 });
  if (child.exitCode !== 0) throw new Error(`${command.join(" ")}\n${new TextDecoder().decode(child.stdout)}\n${new TextDecoder().decode(child.stderr)}`);
  return new TextDecoder().decode(child.stdout).trim();
}
writeFileSync(resolve(directory, "package.json"), JSON.stringify({ name: "parsing-package-check", private: true, type: "module" }));
writeFileSync(resolve(directory, "smoke.mjs"), `
import assert from 'node:assert/strict';
import { ParsingRuntime, Tree, CFG, Nonterminal, Production, RustEarleyParser } from 'bun_nltk/parse';
const runtime = await ParsingRuntime.load();
try {
 const tree = Tree.fromstring(runtime, '(S (NP café) (VP 😀))');
 assert.deepEqual(tree.leaves(), ['café','😀']);
 assert.equal(tree.get([0,-1]), 'café');
 const cfg = CFG.fromstring(runtime, "S -> S S | 'a'");
 assert.equal(new RustEarleyParser(cfg).parse(['a','a','a','a']).length, 5);
 assert.equal(new Production(runtime, new Nonterminal('S'), ['S']).toString(), "S -> 'S'");
 const root = await import('bun_nltk');
 assert.equal(root.Tree.fromstring(runtime, '(S root)').get(0), 'root');
 assert.equal(new root.RustEarleyParser(root.RustCFG.fromstring(runtime, "S -> 'a'")).recognize(['a']), true);
 console.log(JSON.stringify({runtime:process.version,ok:true,parses:5}));
} finally { runtime.dispose(); }
`);
writeFileSync(resolve(directory, "types.ts"), `
import { ParsingRuntime, Tree, CFG, Nonterminal, Production, RustEarleyParser, type GrammarSymbol } from 'bun_nltk/parse';
import { Tree as RootTree, RustCFG } from 'bun_nltk';
const runtime = await ParsingRuntime.load();
const tree: Tree = Tree.fromstring(runtime, '(S leaf)');
const leaves: string[] = tree.leaves();
const symbols: readonly GrammarSymbol[] = new Production(runtime, new Nonterminal('S'), ['a']).rhs();
const grammar: CFG = CFG.fromstring(runtime, "S -> 'a'");
const parsed: Tree[] = new RustEarleyParser(grammar).parse(['a']);
const plain = RootTree.fromstring(runtime, '(S root)').toPlain();
const rootGrammar: RustCFG = RustCFG.fromstring(runtime, "S -> 'a'");
// @ts-expect-error Nonterminal is not a terminal string.
const terminal: string = new Nonterminal('S');
// @ts-expect-error Tree labels are strings.
Tree.fromstring(runtime, 123);
// @ts-expect-error Grammar start is a Nonterminal.
new CFG(runtime, 'S', []);
// @ts-expect-error Tree margin must be numeric.
tree.pformat({margin:'wide'});
// @ts-expect-error Production symbols cannot be arbitrary objects.
new Production(runtime, new Nonterminal('S'), [{bad:true}]);
runtime.dispose();
`);
writeFileSync(resolve(directory, "tsconfig.json"), JSON.stringify({ compilerOptions: {
  strict: true, noEmit: true, target: "ESNext", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ESNext", "DOM"], types: [], skipLibCheck: false,
}, files: ["types.ts"] }));
run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", realpathSync(resolve(archive))]);
run([realpathSync(resolve(import.meta.dir, "../node_modules/.bin/tsrs")), "-p", "tsconfig.json"]);
for (const runtime of ["node", "bun"]) console.log(JSON.stringify({ directory, typesChecked: true, ...JSON.parse(run([runtime, "smoke.mjs"])) }));
