/** Verify source adapters against a candidate without touching shipped artifacts. */
import { chromium, firefox, webkit } from "playwright";
import { resolve } from "node:path";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { WasmNltk } from "../src/wasm.ts";
import { socialCases } from "../test/tokenizer_social_cases.ts";

const wasmPath = process.env.BUN_NLTK_TOKENIZER_WASM;
if (!wasmPath) throw new Error("set BUN_NLTK_TOKENIZER_WASM to the optimized candidate (no shipped artifact writes)");
const cases = socialCases();
const oracle = Bun.spawnSync([process.env.BUN_NLTK_PYTHON ?? "python3", resolve(import.meta.dir, "../test/tokenizer_social_oracle.py")], {
  stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe", timeout: 30_000,
});
if (oracle.exitCode !== 0) throw new Error(new TextDecoder().decode(oracle.stderr));
const expected = JSON.parse(new TextDecoder().decode(oracle.stdout)) as (string | string[])[];
const runtime = await WasmNltk.init({ wasmPath });
try {
  const actual = cases.map((row) => runtime.socialTokenizer(row));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Bun candidate differential failed");
  console.log(JSON.stringify({ runtime: "bun", cases: cases.length, actualRustWasm: true }));
} finally { runtime.dispose(); }

const directory = mkdtempSync("/tmp/opencode/social-tokenizers-");
const entry = resolve(directory, "entry.ts");
writeFileSync(entry, `export { WasmNltk } from ${JSON.stringify(resolve(import.meta.dir, "../src/wasm.ts"))};\nexport * from ${JSON.stringify(resolve(import.meta.dir, "../src/tokenizers.ts"))};`);
mkdirSync(resolve(directory, "native"));
copyFileSync(wasmPath, resolve(directory, "native/bun_nltk.wasm"));
const nodeBuild = await Bun.build({ entrypoints: [entry], target: "node", format: "esm", outdir: resolve(directory, "modules"), naming: "candidate.mjs" });
if (!nodeBuild.success) throw new Error(nodeBuild.logs.join("\n"));
const nodeRunner = resolve(directory, "verify.mjs");
writeFileSync(nodeRunner, `
import assert from 'node:assert/strict';
import {WasmNltk,RustTweetTokenizer,RustToktokTokenizer,RustMWETokenizer,tweetTokenize,toktokTokenize,mweTokenize,casual_tokenize} from ${JSON.stringify(new URL(`file://${directory}/modules/candidate.mjs`).href)};
const runtime=await WasmNltk.init({wasmPath:${JSON.stringify(resolve(wasmPath))}});
try {
  assert.deepEqual(${JSON.stringify(cases)}.map(row=>runtime.socialTokenizer(row)),${JSON.stringify(expected)});
  assert.deepEqual(new RustTweetTokenizer({preserve_case:false},runtime).tokenize_sents(['NLP :D']),[['nlp',':D']]);
  assert.deepEqual(tweetTokenize('café &amp; b'),['café','&','b']);
  assert.deepEqual(toktokTokenize("isn't"),['isn',"'",'t']);
  assert.deepEqual(mweTokenize(['a','b_c'],[['a_b','c']]),['a','b_c']);
  assert.deepEqual(casual_tokenize('NLP :D',false),['nlp',':D']);
  assert.equal(new RustToktokTokenizer(runtime).tokenize("a'b",true),"a ' b");
  const mwe=new RustMWETokenizer([['a','b'],['a','b','c']], '_', runtime);
  mwe.remove_mwe(['a','b','c']); assert.deepEqual(mwe.tokenize(['a','b','c']),['a_b','c']);
  console.log(JSON.stringify({runtime:'node',cases:${cases.length},actualRustWasm:true}));
} finally {runtime.dispose();}
`);
const node = Bun.spawnSync(["node", nodeRunner], { stdout: "pipe", stderr: "pipe", timeout: 30_000 });
if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
console.log(new TextDecoder().decode(node.stdout).trim());

const build = await Bun.build({ entrypoints: [entry], target: "browser", format: "esm", external: ["node:fs", "node:fs/promises"] });
if (!build.success) throw new Error(build.logs.join("\n"));
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/candidate.js") return new Response(build.outputs[0], { headers: { "content-type": "text/javascript" } });
  if (path.endsWith(".wasm")) return new Response(Bun.file(wasmPath));
  return new Response("<!doctype html><title>Social tokenizer candidate</title>", { headers: { "content-type": "text/html" } });
} });
try {
  const selected = process.env.BUN_NLTK_TOKENIZER_BROWSERS?.split(",") ?? ["chromium", "firefox", "webkit"];
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    if (!selected.includes(name)) continue;
    const browser = await launcher.launch({ headless: true, ...(name === "webkit" && process.env.BUN_NLTK_WEBKIT_EXECUTABLE ? { executablePath: process.env.BUN_NLTK_WEBKIT_EXECUTABLE } : {}) });
    try {
      const page = await browser.newPage();
      await page.goto(server.url.href);
      const result = await page.evaluate(async (cases) => {
        const path = "/candidate.js";
        const { WasmNltk, RustTweetTokenizer, RustToktokTokenizer, RustMWETokenizer, tweetTokenize, toktokTokenize, mweTokenize, casual_tokenize } = await import(path) as typeof import("../src/tokenizers_social.ts") & typeof import("../src/wasm.ts");
        const runtime = await WasmNltk.init({ wasmUrl: "/candidate.wasm" });
        try {
          const actual = cases.map((row) => runtime.socialTokenizer(row));
          const tweet = new RustTweetTokenizer({ preserve_case: false }, runtime).tokenize("NLP :D");
          const toktok = new RustToktokTokenizer(runtime).tokenize("a'b", true);
          const mwe = new RustMWETokenizer([["a", "b"], ["a", "b", "c"]], "_", runtime);
          mwe.remove_mwe(["a", "b", "c"]);
          const publicTokens = [tweetTokenize("café &amp; b"), toktokTokenize("isn't"), mweTokenize(["a", "b_c"], [["a_b", "c"]]), casual_tokenize("NLP :D", false)];
          return { actual, tweet, toktok, mwe: mwe.tokenize(["a", "b", "c"]), publicTokens };
        } finally { runtime.dispose(); }
      }, cases);
      if (JSON.stringify(result.actual) !== JSON.stringify(expected) || JSON.stringify(result.tweet) !== '["nlp",":D"]' || result.toktok !== "a ' b" || JSON.stringify(result.mwe) !== '["a_b","c"]' || JSON.stringify(result.publicTokens) !== '[["café","&","b"],["isn","\'","t"],["a","b_c"],["nlp",":D"]]') throw new Error(`${name}: candidate differential failed`);
      console.log(JSON.stringify({ runtime: name, cases: cases.length, actualRustWasm: true }));
    } finally { await browser.close(); }
  }
} finally { await server.stop(true); }
