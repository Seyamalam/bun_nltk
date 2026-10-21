import { chromium, firefox, webkit } from "playwright";
import { resolve } from "node:path";
import type { TokenizerKind, TokenizerOptions, TokenSpan } from "../src/tokenizer_types.ts";

const root = resolve(import.meta.dir, "..");
const texts = [
  "", " a  ", "\t😀\t\t", "\n", "a\r\n\u2028b\n", "a\\nb\\n\\n",
  `😀 "can't" cannot GİMME 'tİs.`, `He said, "'Hello.'"`,
  `²cannot cannot\u0301 Ⅳ e\u0301\u200c_ \u{1e6c0}`, `x:٣,y:².\n`,
  `a\u001cb\u001dc\u0085d\u00a0e\ufefff`, `a\n \n\tb\n\n c`,
];
const cases: Array<{ kind: TokenizerKind; text: string } & TokenizerOptions> = [];
for (const text of texts) {
  for (const kind of ["treebank", "wordpunct", "whitespace", "blankline", "space", "tab"] as const) cases.push({ kind, text });
  cases.push({ kind: "treebank", text, convertParentheses: true });
  for (const blanklines of ["keep", "discard", "discard-eof"] as const) cases.push({ kind: "line", text, blanklines });
}
const python = Bun.spawnSync(["python3", resolve(root, "test/tokenizer_oracle.py")], {
  stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe", timeout: 30_000,
});
if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
const expected = JSON.parse(new TextDecoder().decode(python.stdout)) as Array<{ tokens: string[]; spans: TokenSpan[] }>;
const server = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/dist/portable/") && !path.includes("..")) {
      return new Response(Bun.file(resolve(root, path.slice(1))), { headers: { "content-type": "text/javascript" } });
    }
    if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
    return new Response("<!doctype html><title>Tokenizer differential verification</title>", { headers: { "content-type": "text/html" } });
  },
});

try {
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await launcher.launch({
      headless: true,
      ...(name === "webkit" && process.env.BUN_NLTK_WEBKIT_EXECUTABLE
        ? { executablePath: process.env.BUN_NLTK_WEBKIT_EXECUTABLE } : {}),
    });
    try {
      const page = await browser.newPage();
      await page.goto(server.url.href);
      const results = await page.evaluate(async ({ cases }) => {
        const modulePath = "/dist/portable/wasm.js";
        const { WasmNltk } = await import(modulePath) as typeof import("../src/wasm.ts");
        const runtime = await WasmNltk.init();
        const rootPath = "/dist/portable/index.browser.js";
        const api = await import(rootPath) as typeof import("../src/index_browser.ts");
        const tokens = cases.map((data) => ({
          tokens: runtime.tokenize(data.text, data.kind, data),
          spans: runtime.tokenizerSpans(data.text, data.kind, data),
        }));
        const publicTokens = cases.filter((row) => row.kind === "treebank").map((data) => new api.TreebankWordTokenizer().tokenize(data.text, data.convertParentheses));
        const publicSpans = new api.TreebankWordTokenizer().span_tokenize(`😀 "can't"`);
        const detokenized = new api.TreebankWordDetokenizer().detokenize(new api.TreebankWordTokenizer().tokenize(`He said, "'Hello.'"`));
        runtime.dispose();
        return { tokens, publicTokens, publicSpans, detokenized };
      }, { cases });
      if (JSON.stringify(results.tokens) !== JSON.stringify(expected)) throw new Error(`${name}: NLTK differential failed`);
      const treebankExpected = expected.filter((_, index) => cases[index]!.kind === "treebank").map((row) => row.tokens);
      if (JSON.stringify(results.publicTokens) !== JSON.stringify(treebankExpected) ||
          JSON.stringify(results.publicSpans) !== "[[0,1],[2,3],[3,5],[5,8],[8,9]]" ||
          results.detokenized !== `He said, "'Hello.'"`) throw new Error(`${name}: public tokenizer adapter failed`);
      console.log(JSON.stringify({ browser: name, ok: true, differentialCases: cases.length, actualRustWasm: true }));
    } finally { await browser.close(); }
  }
  const node = Bun.spawnSync(["node", "--input-type=module", "-e", `
import assert from 'node:assert/strict';
import { WasmNltk } from ${JSON.stringify(new URL("../dist/portable/wasm.js", import.meta.url).href)};
import { TreebankWordTokenizer, TreebankWordDetokenizer, LineTokenizer } from ${JSON.stringify(new URL("../dist/portable/index.node.js", import.meta.url).href)};
const cases=${JSON.stringify(cases)}, expected=${JSON.stringify(expected)};
const runtime=await WasmNltk.init();
try {
  for (let i=0;i<cases.length;i++) {
    const data=cases[i];
    assert.deepEqual(runtime.tokenize(data.text,data.kind,data),expected[i].tokens);
    assert.deepEqual(runtime.tokenizerSpans(data.text,data.kind,data),expected[i].spans);
  }
  const tokenizer=new TreebankWordTokenizer();
  assert.deepEqual(tokenizer.tokenize('cannot'),['can','not']);
  assert.deepEqual(tokenizer.span_tokenize('😀 cannot'),[[0,1],[2,5],[5,8]]);
  assert.equal(new TreebankWordDetokenizer().detokenize(['can','not']),'cannot');
  assert.deepEqual(new LineTokenizer('keep').tokenize('a\\r\\nb\\n'),['a','b']);
  console.log(JSON.stringify({runtime:'node',ok:true,differentialCases:cases.length,actualRustWasm:true}));
} finally { runtime.dispose(); }
`], { stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
  console.log(new TextDecoder().decode(node.stdout).trim());
} finally { await server.stop(true); }
