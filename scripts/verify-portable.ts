import { chromium, firefox, webkit } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = await Bun.build({
  entrypoints: [resolve(root, "src/wasm.ts"), resolve(root, "src/feature_nb.ts")],
  target: "browser",
  format: "esm",
  external: ["node:fs/promises"],
});
if (!output.success) throw new Error(output.logs.join("\n"));
const modules = new Map(output.outputs.map((artifact) => [new URL(artifact.path, "file:///").pathname.split("/").at(-1), artifact]));
if (!modules.has("wasm.js") || !modules.has("feature_nb.js")) throw new Error("missing browser modules");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    const module = modules.get(path.slice(1));
    if (module) return new Response(module, { headers: { "content-type": "text/javascript" } });
    if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
    return new Response("<!doctype html><title>WASM verification</title>", { headers: { "content-type": "text/html" } });
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
      const result = await page.evaluate(async () => {
        const path = "/wasm.js";
        const { WasmNltk } = await import(path) as typeof import("../src/wasm");
        const featurePath = "/feature_nb.js";
        const { RustNaiveBayesClassifier } = await import(featurePath) as typeof import("../src/feature_nb");
        const wasm = await WasmNltk.init({ wasmUrl: "/native/bun_nltk.wasm" });
        const initialBytes: number = wasm.memoryBytes;
        const tokens: string[] = wasm.tokenizeAscii("Hello Node and Bun!");
        const metrics = wasm.computeAsciiMetrics("a b a", 2);
        const distance = wasm.editDistance("CA", "ABC", { transpositions: true });
        const alignment = wasm.editDistanceAlign("😀", "😀x");
        const perceptron = [...wasm.perceptronPredictBatch(Uint32Array.of(0, 1), Uint32Array.of(0, 1, 2), Float32Array.of(1, 0, 0, 1), 2, 2)];
        let shortWeights = false;
        try { wasm.perceptronPredictBatch(Uint32Array.of(0), Uint32Array.of(0, 1), Float32Array.of(1), 1, 2); } catch (error) { shortWeights = error instanceof RangeError; }
        const classifier = RustNaiveBayesClassifier.train(wasm, [
          [{ x: "red", y: "blue" }, "A"], [{ x: "blue", y: "red" }, "B"],
        ]);
        const predictions = classifier.classifyMany([{ x: "red", y: "blue" }, { x: "blue", y: "red" }]);
        const probability = classifier.predict({ x: "red", y: "blue" })[0]!.probability;
        classifier.dispose();
        const positive = RustNaiveBayesClassifier.trainPositive(wasm,
          [{ x: "red", y: "blue" }], [{ x: "red", y: "blue" }, { x: "blue", y: "red" }]);
        const positivePredictions = positive.classifyMany([{ x: "red", y: "blue" }, { x: "blue", y: "red" }, {}]);
        positive.dispose();
        const stream = wasm.createAsciiMetricsStream(2);
        const encoder = new TextEncoder();
        stream.update(encoder.encode("hel"));
        stream.update(encoder.encode("lo world hello"));
        const streamMetrics = stream.finish();
        stream.dispose();
        let invalidOrder = false;
        try { wasm.countNgramsAscii("a", 0); } catch (error) { invalidOrder = error instanceof RangeError; }
        wasm.dispose();
        let disposed = false;
        try { wasm.countTokensAscii("a"); } catch { disposed = true; }
        return { initialBytes, tokens, metrics, distance, alignment, perceptron, shortWeights, predictions, probability, positivePredictions, streamMetrics, invalidOrder, disposed };
      });
      if (result.initialBytes >= 4 * 1024 * 1024 ||
          JSON.stringify(result.tokens) !== JSON.stringify(["hello", "node", "and", "bun"]) ||
          result.metrics.tokens !== 3 || JSON.stringify(result.predictions) !== '["A","B"]' ||
          result.distance !== 2 || JSON.stringify(result.alignment) !== '[[0,0],[1,1],[1,2]]' ||
          JSON.stringify(result.perceptron) !== '[0,1]' || !result.shortWeights ||
          JSON.stringify(result.positivePredictions) !== '["pos","neg","pos"]' ||
          result.streamMetrics.tokens !== 3 || result.streamMetrics.uniqueTokens !== 2 || result.streamMetrics.ngrams !== 2 || result.streamMetrics.uniqueNgrams !== 2 ||
          Math.abs(result.probability - 0.9) > 1e-12 || !result.invalidOrder || !result.disposed) {
        throw new Error(`${name} portable verification failed: ${JSON.stringify(result)}`);
      }
      console.log(JSON.stringify({ browser: name, ok: true, ...result }));
    } finally {
      await browser.close();
    }
  }
  const node = Bun.spawnSync(["node", "--input-type=module", "-e", `
    import { WasmNltk } from ${JSON.stringify(new URL("../src/wasm.ts", import.meta.url).href)};
    import { RustNaiveBayesClassifier } from ${JSON.stringify(new URL("../src/feature_nb.ts", import.meta.url).href)};
    const wasm = await WasmNltk.init();
    if (wasm.countTokensAscii("hello node") !== 2) throw new Error("Node token mismatch");
    if (wasm.editDistance("CA","ABC",{transpositions:true}) !== 2) throw new Error("Node distance mismatch");
    if (JSON.stringify([...wasm.perceptronPredictBatch(Uint32Array.of(0,1), Uint32Array.of(0,1,2), Float32Array.of(1,0,0,1), 2, 2)]) !== '[0,1]') throw new Error("Node perceptron mismatch");
    let shortWeights = false;
    try { wasm.perceptronPredictBatch(Uint32Array.of(0), Uint32Array.of(0,1), Float32Array.of(1), 1, 2); } catch (error) { shortWeights = error instanceof RangeError; }
    if (!shortWeights) throw new Error("Node perceptron weight validation failed");
    const classifier = RustNaiveBayesClassifier.train(wasm, [[{x:"red",y:"blue"},"A"],[{x:"blue",y:"red"},"B"]]);
    if (classifier.classify({x:"red",y:"blue"}) !== "A") throw new Error("Node classifier mismatch");
    classifier.dispose();
    const positive = RustNaiveBayesClassifier.trainPositive(wasm, [{x:"red",y:"blue"}], [{x:"red",y:"blue"},{x:"blue",y:"red"}]);
    if (JSON.stringify(positive.classifyMany([{x:"red",y:"blue"},{x:"blue",y:"red"},{}])) !== '["pos","neg","pos"]') throw new Error("Node positive classifier mismatch");
    positive.dispose();
    const stream = wasm.createAsciiMetricsStream(2);
    const encoder = new TextEncoder();
    stream.update(encoder.encode("hel")); stream.update(encoder.encode("lo world hello"));
    if (stream.finish().tokens !== 3) throw new Error("Node streaming mismatch");
    stream.dispose();
    wasm.dispose();
    console.log(JSON.stringify({runtime:"node",ok:true}));
  `], { stdout: "pipe", stderr: "pipe" });
  if (node.exitCode !== 0) throw new Error(new TextDecoder().decode(node.stderr));
  console.log(new TextDecoder().decode(node.stdout).trim());
} finally {
  await server.stop(true);
}
