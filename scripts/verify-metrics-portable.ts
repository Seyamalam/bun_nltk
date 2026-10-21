/** Browser execution checks for migrated evaluation kernels; not oracle coverage. */
import { chromium, firefox } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const server = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
    if (path === "/wasm.js" || path === "/metrics_wasm.js" || path === "/numeric_validation.js") {
      return new Response(Bun.file(resolve(root, "dist/portable", path.slice(1))), { headers: { "content-type": "text/javascript" } });
    }
    return new Response("<!doctype html><title>Evaluation verification</title>", { headers: { "content-type": "text/html" } });
  },
});
try {
  for (const [browserName, launcher] of Object.entries({ chromium, firefox })) {
    const browser = await launcher.launch({ headless: true });
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
} finally { await server.stop(true); }
