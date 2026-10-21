import { chromium, firefox, webkit } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const bundle = await Bun.build({ entrypoints: [resolve(root, "src/lm.ts")], target: "browser", format: "esm", external: ["node:fs", "node:fs/promises"] });
if (!bundle.success) throw new Error(bundle.logs.join("\n"));
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/lm.js") return new Response(bundle.outputs[0], { headers: { "content-type": "text/javascript" } });
  if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
  return new Response("<!doctype html><title>Rust LM verification</title>", { headers: { "content-type": "text/html" } });
} });
try {
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(server.url.href);
      const result = await page.evaluate(async () => {
        const path = "/lm.js";
        const api = await import(path) as typeof import("../src/lm.ts");
        const model = new api.NgramLanguageModel([["a", "b", "c", "d"], ["a", "b", "c", "x"]], { order: 5, model: "laplace" });
        try {
          return { score: model.score("d", ["a", "b", "c"]), batch: model.evaluateBatch([{ word: "d", context: ["a", "b", "c"] }], ["a", "b", "c", "d"]).scores[0], vocab: model.vocabulary.length };
        } finally { model.dispose(); }
      });
      if (result.score !== 0.2 || result.batch !== 0.2 || result.vocab !== 8) throw new Error(`${name}: ${JSON.stringify(result)}`);
      console.log(JSON.stringify({ browser: name, ok: true, ...result }));
    } finally { await browser.close(); }
  }
  const node = Bun.spawnSync(["node", "--input-type=module", "-e", `
import assert from 'node:assert/strict';
import { NgramLanguageModel, RustNgramLanguageModel, WasmNltk, train_ngram_language_model } from ${JSON.stringify(new URL("../dist/portable/index.node.js", import.meta.url).href)};
const model = train_ngram_language_model([['a','b','c','d']], {order:4});
assert.equal(model instanceof NgramLanguageModel,true);
assert.equal(model.score('d',['a','b','c']),1); model.dispose();
const runtime=await WasmNltk.init();
const portable=new RustNgramLanguageModel(runtime,[['a','b','c','d']],{order:5,model:'laplace'});
assert.equal(portable.score('d',['a','b','c']),.25); portable.dispose(); runtime.dispose();
console.log(JSON.stringify({node:process.version,ok:true}));
`], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
  console.log(new TextDecoder().decode(node.stdout).trim());
} finally { server.stop(); }
