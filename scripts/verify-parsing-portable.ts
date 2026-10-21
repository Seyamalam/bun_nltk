import { chromium, firefox, webkit } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const bundle = await Bun.build({ entrypoints: [resolve(root, "dist/portable/rust_parse.js")], target: "browser", format: "esm", external: ["node:fs/promises"] });
if (!bundle.success) throw new Error(bundle.logs.join("\n"));
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/rust_parse.js") return new Response(bundle.outputs[0], { headers: { "content-type": "text/javascript" } });
  if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
  return new Response("<!doctype html><title>Rust parsing verification</title>", { headers: { "content-type": "text/html" } });
} });

try {
  const requested = process.env.BUN_NLTK_PARSING_BROWSERS?.split(",");
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    if (requested && !requested.includes(name)) continue;
    const browser = await launcher.launch({
      headless: true,
      ...(name === "webkit" && process.env.BUN_NLTK_WEBKIT_EXECUTABLE
        ? { executablePath: process.env.BUN_NLTK_WEBKIT_EXECUTABLE } : {}),
    });
    try {
      const page = await browser.newPage();
      await page.goto(server.url.href);
      const result = await page.evaluate(async () => {
        const path = "/rust_parse.js";
        const api = await import(path) as typeof import("../src/rust_parse");
        const runtime = await api.ParsingRuntime.load({ wasmUrl: "/native/bun_nltk.wasm" });
        try {
          const tree = api.Tree.fromstring(runtime, "(S (NP café) (VP 😀))");
          const grammar = api.CFG.fromstring(runtime, "S -> S S | 'a'");
          const parses = new api.RustEarleyParser(grammar).parse(["a", "a", "a", "a"]);
          return { leaves: tree.leaves(), positions: tree.treepositions("leaves"), tree: tree.pformat(), parses: parses.length };
        } finally { runtime.dispose(); }
      });
      if (JSON.stringify(result) !== JSON.stringify({ leaves: ["café", "😀"], positions: [[0, 0], [1, 0]], tree: "(S (NP café) (VP 😀))", parses: 5 })) {
        throw new Error(`${name} parsing verification failed: ${JSON.stringify(result)}`);
      }
      console.log(JSON.stringify({ browser: name, ok: true, ...result }));
    } finally { await browser.close(); }
  }
  const node = Bun.spawnSync(["node", "--input-type=module", "-e", `
import assert from 'node:assert/strict';
import { ParsingRuntime, Tree, CFG, RustEarleyParser } from ${JSON.stringify(new URL("../dist/portable/rust_parse.js", import.meta.url).href)};
const runtime = await ParsingRuntime.load();
try {
 const tree = Tree.fromstring(runtime, '(S (NP café) (VP 😀))');
 assert.deepEqual(tree.leaves(), ['café','😀']);
 assert.deepEqual(tree.treepositions('leaves'), [[0,0],[1,0]]);
 const grammar = CFG.fromstring(runtime, "S -> A A 'z'\\nA -> | 'a'");
 const parser = new RustEarleyParser(grammar);
 assert.equal(parser.parse(['a','z']).length, 2);
 assert.equal(parser.recognize(['z']), true);
 console.log(JSON.stringify({node:process.version,ok:true,parses:2}));
} finally { runtime.dispose(); }
`], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
  console.log(new TextDecoder().decode(node.stdout).trim());
} finally { server.stop(); }
