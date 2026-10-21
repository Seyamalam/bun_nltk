import { chromium, firefox, webkit } from "playwright";
import { mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Isolated source probe: no shared portable builder or committed artifacts changed.
const root = resolve(import.meta.dir, "..");
const output = mkdtempSync("/tmp/opencode/bun-nltk-parse-extension-");
const build = await Bun.build({ entrypoints: [resolve(root, "src/rust_parse.ts")], target: "browser", format: "esm", external: ["node:fs/promises"] });
if (!build.success) throw new Error(build.logs.join("\n"));
const source = await build.outputs[0]!.text();
writeFileSync(resolve(output, "parse.mjs"), source);
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/parse.mjs") return new Response(source, { headers: { "content-type": "text/javascript" } });
  if (path === "/core.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
  return new Response("<!doctype html><title>Parsing extension probe</title>", { headers: { "content-type": "text/html" } });
} });

try {
  const requested = process.env.BUN_NLTK_PARSING_BROWSERS?.split(",");
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    if (requested && !requested.includes(name)) continue;
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(server.url.href);
      const result = await page.evaluate(async () => {
        const path = "/parse.mjs";
        const api = await import(path) as typeof import("../src/rust_parse");
        const runtime = await api.ParsingRuntime.load({ wasmUrl: "/core.wasm" });
        try {
          const a = { value: "same" }; const b = { value: "same" };
          const tree = new api.Tree<object>(runtime, "S", [new api.Tree<object>(runtime, "A", [a, b])]);
          const child = tree.get(0) as InstanceType<typeof api.Tree<object>>;
          child.set_slice({ step: -1 }, [a, b]);
          const grammar = api.PCFG.fromString(runtime, "S -> A [.2] | B [.8]\nA -> 'a' [1]\nB -> 'a' [1]");
          const parse = new api.RustViterbiParser(grammar).parse_result(["a"]);
          return { identity: tree.leaves()[0] === b && tree.leaves()[1] === a,
            positions: tree.treePositions("leaves"), prob: parse?.prob, tree: parse?.tree.pformat(),
            productions: grammar.productions().map(String) };
        } finally { runtime.dispose(); }
      });
      const expected = { identity: true, positions: [[0, 0], [0, 1]], prob: 0.8, tree: "(S (B a))",
        productions: ["S -> A [0.2]", "S -> B [0.8]", "A -> 'a' [1.0]", "B -> 'a' [1.0]"] };
      if (JSON.stringify(result) !== JSON.stringify(expected)) throw new Error(`${name}: ${JSON.stringify(result)}`);
      console.log(JSON.stringify({ browser: name, ok: true, ...result }));
    } finally { await browser.close(); }
  }
  const node = Bun.spawnSync(["node", "--input-type=module", "-e", `
import assert from 'node:assert/strict';
import {ParsingRuntime,Tree,PCFG,RustViterbiParser} from ${JSON.stringify(new URL(`file://${output}/parse.mjs`).href)};
const runtime=await ParsingRuntime.load({wasmPath:${JSON.stringify(resolve(root, "native/bun_nltk.wasm"))}});
try {
 const a={value:'same'},b={value:'same'};
 const t=new Tree(runtime,'S',[a,b]); t.reverse();
 assert.equal(t.leaves()[0],b); assert.equal(t.copy(false).get(1),a);
 const g=PCFG.fromstring(runtime,"S -> A [.2] | B [.8]\\nA -> 'a' [1]\\nB -> 'a' [1]");
 const p=new RustViterbiParser(g).parseResult(['a']);
 assert.equal(p.prob,.8); assert.equal(p.tree.pformat(),'(S (B a))');
 console.log(JSON.stringify({node:process.version,ok:true}));
} finally { runtime.dispose(); }
`], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
  console.log(new TextDecoder().decode(node.stdout).trim());
} finally { server.stop(); }
