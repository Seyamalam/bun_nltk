// Standalone candidate verification: leaves shared portable registration to the parent.
import { chromium, firefox } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const out = process.env.REGEXP_VERIFY_DIR ?? "/tmp/opencode/regexp-921aa269-portable";
mkdirSync(out, { recursive: true });
const build = await Bun.build({ entrypoints: [resolve(root, "src/tokenizers_regexp.ts")], target: "browser", format: "esm", minify: true });
if (!build.success) throw new Error(build.logs.join("\n"));
// The shared loader locates packaged WASM relative to its module URL.
writeFileSync(resolve(out, "regexp.js"), await build.outputs[0]!.text());
const cases = [
  { pattern: String.raw`\w+`, text: "😀 e\u0301 cafe ٣ ²" },
  { pattern: String.raw`(a)?(b)`, text: "b ab" },
  { pattern: String.raw`(a)?b`, text: "b", gaps: true, discard_empty: false },
  { pattern: ",", text: ",a,,", gaps: true, discard_empty: false },
  { pattern: "", text: "😀a" },
  { pattern: "i", text: "iIİı", flags: 2 },
  { pattern: "(,)+", text: ",,," },
  { pattern: String.raw`\w+`, text: "é a\u0301", flags: 128 },
  { pattern: ".", text: "a\nb" },
  { pattern: "^", text: "a\nb\n" },
];
const python = Bun.spawnSync(["python3", resolve(root, "test/regexp_tokenizer_oracle.py")], { stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe" });
if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
const expected: unknown = JSON.parse(new TextDecoder().decode(python.stdout));
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/dist/portable/regexp.js") return new Response(Bun.file(resolve(out, "regexp.js")), { headers: { "content-type": "text/javascript" } });
  if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
  return new Response("<!doctype html><title>Regexp contract verification</title>");
} });
try {
  for (const [name, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(server.url.href);
      const actual = await page.evaluate(async (cases) => {
        const path = "/dist/portable/regexp.js";
        const { RegexpTokenizer } = await import(path) as typeof import("../src/tokenizers_regexp.ts");
        return cases.map((c) => {
          const tokenizer = new RegexpTokenizer(c.pattern, c);
          return { tokens: tokenizer.tokenize(c.text), spans: tokenizer.span_tokenize(c.text) };
        });
      }, cases);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${name}: differential mismatch`);
      console.log(JSON.stringify({ runtime: name, cases: cases.length, ok: true, candidateBundle: true }));
    } finally { await browser.close(); }
  }
  // Node loads the same candidate bundle and the explicitly copied candidate WASM.
  const wasm = readFileSync(resolve(root, "native/bun_nltk.wasm"));
  mkdirSync(resolve(out, "dist/portable"), { recursive: true });
  mkdirSync(resolve(out, "native"), { recursive: true });
  writeFileSync(resolve(out, "dist/portable/regexp.mjs"), readFileSync(resolve(out, "regexp.js")));
  writeFileSync(resolve(out, "native/bun_nltk.wasm"), wasm);
  const node = Bun.spawnSync(["node", "--input-type=module", "-e", `
import assert from 'node:assert/strict';
import { RegexpTokenizer } from ${JSON.stringify(new URL(`file://${resolve(out, "dist/portable/regexp.mjs")}`).href)};
const cases=${JSON.stringify(cases)},expected=${JSON.stringify(expected)};
assert.deepEqual(cases.map(c=>{const t=new RegexpTokenizer(c.pattern,c);return {tokens:t.tokenize(c.text),spans:t.span_tokenize(c.text)}}),expected);
console.log(JSON.stringify({runtime:'node',cases:cases.length,ok:true,candidateBundle:true}));
`], { stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
  console.log(new TextDecoder().decode(node.stdout).trim());
} finally { await server.stop(true); }
