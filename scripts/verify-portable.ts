import { chromium, firefox, webkit } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = await Bun.build({
  entrypoints: [resolve(root, "src/wasm.ts")],
  target: "browser",
  format: "esm",
  external: ["node:fs/promises"],
});
if (!output.success) throw new Error(output.logs.join("\n"));
const module = output.outputs[0];
if (!module) throw new Error("missing browser module");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/wasm.js") return new Response(module, { headers: { "content-type": "text/javascript" } });
    if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
    return new Response("<!doctype html><title>WASM verification</title>", { headers: { "content-type": "text/html" } });
  },
});

try {
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(server.url.href);
      const result = await page.evaluate(async () => {
        const path = "/wasm.js";
        const { WasmNltk } = await import(path);
        const wasm = await WasmNltk.init({ wasmUrl: "/native/bun_nltk.wasm" });
        const initialBytes: number = wasm.memoryBytes;
        const tokens: string[] = wasm.tokenizeAscii("Hello Node and Bun!");
        const metrics = wasm.computeAsciiMetrics("a b a", 2);
        let invalidOrder = false;
        try { wasm.countNgramsAscii("a", 0); } catch (error) { invalidOrder = error instanceof RangeError; }
        wasm.dispose();
        let disposed = false;
        try { wasm.countTokensAscii("a"); } catch { disposed = true; }
        return { initialBytes, tokens, metrics, invalidOrder, disposed };
      });
      if (result.initialBytes >= 4 * 1024 * 1024 ||
          JSON.stringify(result.tokens) !== JSON.stringify(["hello", "node", "and", "bun"]) ||
          result.metrics.tokens !== 3 || !result.invalidOrder || !result.disposed) {
        throw new Error(`${name} portable verification failed: ${JSON.stringify(result)}`);
      }
      console.log(JSON.stringify({ browser: name, ok: true, ...result }));
    } finally {
      await browser.close();
    }
  }
  const node = Bun.spawnSync(["node", "--input-type=module", "-e", `
    import { WasmNltk } from ${JSON.stringify(new URL("../src/wasm.ts", import.meta.url).href)};
    const wasm = await WasmNltk.init();
    if (wasm.countTokensAscii("hello node") !== 2) throw new Error("Node token mismatch");
    wasm.dispose();
    console.log(JSON.stringify({runtime:"node",ok:true}));
  `], { stdout: "pipe", stderr: "pipe" });
  if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
  console.log(new TextDecoder().decode(node.stdout).trim());
} finally {
  await server.stop(true);
}
