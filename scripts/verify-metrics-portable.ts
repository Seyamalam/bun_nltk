/** Browser execution checks for migrated evaluation kernels; not oracle coverage. */
import { chromium, firefox, webkit } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const server = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
    if (/^\/[\w-]+\.js$/.test(path)) {
      return new Response(Bun.file(resolve(root, "dist/portable", path.slice(1))), { headers: { "content-type": "text/javascript" } });
    }
    return new Response("<!doctype html><title>Evaluation verification</title>", { headers: { "content-type": "text/html" } });
  },
});
try {
  for (const [browserName, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await launcher.launch({
      headless: true,
      ...(browserName === "webkit" && process.env.BUN_NLTK_WEBKIT_EXECUTABLE
        ? { executablePath: process.env.BUN_NLTK_WEBKIT_EXECUTABLE } : {}),
    });
    try {
      const page = await browser.newPage(); await page.goto(server.url.href);
      const result = await page.evaluate(async () => {
        const path = "/wasm.js";
        const { WasmNltk } = await import(path) as typeof import("../src/wasm.ts");
        const runtime = await WasmNltk.init({ wasmUrl: "/native/bun_nltk.wasm" });
        const metrics = runtime.evaluationMetrics();
        try {
          const set = metrics.setScore(0, Uint32Array.of(1, 2), Uint32Array.of(2, 3));
          const none = metrics.setScore(4, Uint32Array.of(1), new Uint32Array());
          const correlation = metrics.spearman(Uint32Array.of(0, 1), Float64Array.of(0, 1), Uint32Array.of(0, 1), Float64Array.of(1, 0));
          const segment = metrics.segmentation(Uint32Array.of(0, 1, 0), Uint32Array.of(1, 0, 0), Uint32Array.of(1), Uint32Array.of(1), 4, 1);
          const confusion = metrics.confusion(Uint32Array.of(0, 1), Uint32Array.of(1, 1), ["Z", "a"]);
          const perLabel = metrics.confusionScore(0, confusion.cells, 1);
          const packet = Uint32Array.of(1, 1, 3, 65, 66, 67, 3, 65, 66, 67);
          const chrf = metrics.translation(0, packet, 1, 3, 3, true);
          const nist = metrics.translation(1, packet, 1, 3, 0, false);
          return { set, none, correlation, segment, accuracy: confusion.accuracy, perLabel, chrf, nist };
        } finally { runtime.dispose(); }
      });
      if (Math.abs(result.set! - 2 / 3) > 1e-12 || result.none !== null || result.correlation !== -1 ||
          Math.abs(result.segment - 2 / 3) > 1e-12 || result.accuracy !== 0.5 || result.perLabel !== 0.5 || result.chrf !== 1 || result.nist <= 0) {
        throw new Error(`${browserName} evaluation mismatch: ${JSON.stringify(result)}`);
      }
      console.log(JSON.stringify({ browser: browserName, ok: true, ...result }));
    } finally { await browser.close(); }
  }
  const node = Bun.spawnSync(["node", "--input-type=module", "-e", `
import assert from 'node:assert/strict';
import { WasmNltk } from ${JSON.stringify(new URL("../dist/portable/wasm.js", import.meta.url).href)};
import { accuracy, jaccardDistance, sentenceChrF } from ${JSON.stringify(new URL("../dist/portable/index.node.js", import.meta.url).href)};
const runtime = await WasmNltk.init();
try {
  const metrics = runtime.evaluationMetrics();
  assert.ok(Math.abs(metrics.setScore(0, Uint32Array.of(1,2), Uint32Array.of(2,3)) - 2/3) < 1e-12);
  assert.equal(metrics.setScore(4, Uint32Array.of(1), new Uint32Array()), null);
  assert.equal(metrics.spearman(Uint32Array.of(0,1), Float64Array.of(0,1), Uint32Array.of(0,1), Float64Array.of(1,0)), -1);
  assert.equal(accuracy(['a','b'], ['a','a']), 0.5);
  assert.equal(jaccardDistance(new Set(['a']), new Set(['b'])), 1);
  assert.equal(sentenceChrF('abcdef', 'abcdef'), 1);
  console.log(JSON.stringify({runtime:'node',ok:true,actualRustWasm:true}));
} finally { runtime.dispose(); }
`], { stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
  console.log(new TextDecoder().decode(node.stdout).trim());
} finally { await server.stop(true); }
