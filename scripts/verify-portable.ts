import { chromium, firefox, webkit } from "playwright";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = await Bun.build({
  entrypoints: [resolve(root, "dist/portable/wasm.js"), resolve(root, "dist/portable/feature_nb.js"), resolve(root, "dist/portable/feature_tree.js"), resolve(root, "dist/portable/feature_maxent.js")],
  target: "browser",
  format: "esm",
  external: ["node:fs/promises"],
});
if (!output.success) throw new Error(output.logs.join("\n"));
const modules = new Map(output.outputs.map((artifact) => [new URL(artifact.path, "file:///").pathname.split("/").at(-1), artifact]));
if (!modules.has("wasm.js") || !modules.has("feature_nb.js") || !modules.has("feature_tree.js") || !modules.has("feature_maxent.js")) throw new Error("missing browser modules");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const path = new URL(request.url).pathname;
    const module = modules.get(path.slice(1));
    if (module) return new Response(module, { headers: { "content-type": "text/javascript" } });
    if (path === "/native/bun_nltk.wasm") return new Response(Bun.file(resolve(root, "native/bun_nltk.wasm")));
    if (path === "/index.browser.js") return new Response(Bun.file(resolve(root, "dist/portable/index.browser.js")), { headers: { "content-type": "text/javascript" } });
    if (/^\/chunk-[\w-]+\.js$/.test(path)) return new Response(Bun.file(resolve(root, "dist/portable", path.slice(1))), { headers: { "content-type": "text/javascript" } });
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
        const treePath = "/feature_tree.js";
        const { RustDecisionTreeClassifier } = await import(treePath) as typeof import("../src/feature_tree");
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
        const tree = RustDecisionTreeClassifier.train(wasm, [[{ "😀": "Red" }, "upper"], [{ "😀": "red" }, "lower"]]);
        const treePredictions = tree.classifyMany([{ "😀": "Red" }, { "😀": "red" }, {}]);
        tree.dispose();
        const maxentPath = "/feature_maxent.js";
        const { RustMaxentClassifier } = await import(maxentPath) as typeof import("../src/feature_maxent");
        const maxent = RustMaxentClassifier.train(wasm, [[{ x: "a" }, "A"], [{ x: "b" }, "B"]]);
        const maxentPrediction = maxent.classify({ x: "a" });
        maxent.dispose();
        const browserPath = "/index.browser.js";
        const browserRoot = await import(browserPath) as typeof import("../src/index_browser");
        const browserTokens = browserRoot.wordTokenizeSubset("Browser root");
        const browserNltkTokens = browserRoot.word_tokenize("Hello.");
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
        return { initialBytes, tokens, metrics, distance, alignment, perceptron, shortWeights, predictions, probability, positivePredictions, treePredictions, maxentPrediction, browserTokens, browserNltkTokens, streamMetrics, invalidOrder, disposed };
      });
      if (result.initialBytes >= 4 * 1024 * 1024 ||
          JSON.stringify(result.tokens) !== JSON.stringify(["hello", "node", "and", "bun"]) ||
          result.metrics.tokens !== 3 || JSON.stringify(result.predictions) !== '["A","B"]' ||
          result.distance !== 2 || JSON.stringify(result.alignment) !== '[[0,0],[1,1],[1,2]]' ||
          JSON.stringify(result.perceptron) !== '[0,1]' || !result.shortWeights ||
          JSON.stringify(result.positivePredictions) !== '["pos","neg","pos"]' ||
          JSON.stringify(result.treePredictions) !== '["upper","lower","lower"]' ||
          result.maxentPrediction !== "A" ||
          JSON.stringify(result.browserTokens) !== '["Browser","root"]' ||
          JSON.stringify(result.browserNltkTokens) !== '["Hello","."]' ||
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
    import { RustDecisionTreeClassifier } from ${JSON.stringify(new URL("../src/feature_tree.ts", import.meta.url).href)};
    import { RustMaxentClassifier } from ${JSON.stringify(new URL("../src/feature_maxent.ts", import.meta.url).href)};
    const root = await import(${JSON.stringify(new URL("../dist/portable/index.node.js", import.meta.url).href)});
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
    const tree = RustDecisionTreeClassifier.train(wasm, [[{"😀":"Red"},"upper"],[{"😀":"red"},"lower"]]);
    if (JSON.stringify(tree.classifyMany([{"😀":"Red"},{"😀":"red"},{}])) !== '["upper","lower","lower"]') throw new Error("Node tree mismatch");
    tree.dispose();
    const maxent = RustMaxentClassifier.train(wasm, [[{x:"a"},"A"],[{x:"b"},"B"]]);
    if (maxent.classify({x:"a"}) !== "A") throw new Error("Node maxent mismatch");
    maxent.dispose();
    if (JSON.stringify(root.word_tokenize_subset("Node root")) !== '["Node","root"]') throw new Error("Node root mismatch");
    if (JSON.stringify(root.word_tokenize("Hello.")) !== '["Hello","."]') throw new Error("Node NLTK helper mismatch");
    const rootWasm = await root.WasmNltk.init();
    const rootClassifier = root.RustNaiveBayesClassifier.train(rootWasm, [[{x:"a"},"A"],[{x:"b"},"B"]]);
    if (rootClassifier.classify({x:"a"}) !== "A") throw new Error("Node root WASM classifier mismatch");
    rootClassifier.dispose(); rootWasm.dispose();
    let nativeMessage = "";
    try { root.countTokensAscii("a"); } catch (error) { nativeMessage = error.message; }
    if (!nativeMessage.includes("require Bun")) throw new Error("Node native error mismatch: " + nativeMessage);
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
