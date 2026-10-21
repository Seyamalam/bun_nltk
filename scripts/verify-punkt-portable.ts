/** Behavioral browser/Node checks for the real bundled-English WASM core. */
import { chromium, firefox } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const server = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/dist/portable/index.browser.js") return new Response(Bun.file(resolve(root, `.${path}`)), { headers: { "content-type": "text/javascript" } });
    if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, `.${path}`)));
    return new Response("<!doctype html><title>Punkt inference</title>", { headers: { "content-type": "text/html" } });
  },
});

try {
  for (const [name, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(server.url.href);
      const result = await page.evaluate(async () => {
        const path = "/dist/portable/index.browser.js";
        const api = await import(path) as typeof import("../src/index_browser");
        const tokenizer = new api.PunktSentenceTokenizer();
        const sentences = tokenizer.tokenize("Dr. Élodie met J. Bach. “Hello.” He left.");
        const spans = tokenizer.spanTokenize("😀 (Hello.) Next.");
        const raw = tokenizer.tokenize("😀 (Hello.) Next.", false);
        return { sentences, spans, raw };
      });
      if (JSON.stringify(result) !== JSON.stringify({ sentences: ["Dr. Élodie met J. Bach.", "“Hello.”", "He left."], spans: [[0, 11], [12, 17]], raw: ["😀 (Hello.", ") Next."] })) throw new Error(`${name}: ${JSON.stringify(result)}`);
      console.log(JSON.stringify({ browser: name, ok: true, ...result }));
    } finally { await browser.close(); }
  }
  const proc = Bun.spawnSync(["node", "--input-type=module", "-e", `
    import { PunktSentenceTokenizer } from ${JSON.stringify(new URL("../dist/portable/index.node.js", import.meta.url).href)};
    const tokenizer = new PunktSentenceTokenizer();
    if (JSON.stringify(tokenizer.tokenize('Dr. Élodie left. He smiled.')) !== '["Dr. Élodie left.","He smiled."]') throw new Error('Node Punkt mismatch');
    if (JSON.stringify(tokenizer.spanTokenize('😀 (Hello.) Next.')) !== '[[0,11],[12,17]]') throw new Error('Node Punkt offsets mismatch');
  `], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  console.log(JSON.stringify({ node: true, ok: true }));
} finally { server.stop(true); }
