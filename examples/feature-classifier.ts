import { WasmNltk } from "../src/wasm.ts";
import { RustNaiveBayesClassifier } from "../src/feature_nb.ts";

// Node 24+ or Bun. In browsers, serve the artifact and pass { wasmUrl }.
const runtime = await WasmNltk.init();
const classifier = RustNaiveBayesClassifier.train(runtime, [
  [{ color: "red", shape: "round" }, "apple"],
  [{ color: "yellow", shape: "long" }, "banana"],
]);
try {
  console.log(classifier.classify({ color: "red", shape: "round" }));
  console.log(classifier.predict({ color: "yellow", shape: "long" }));
} finally {
  classifier.dispose();
  runtime.dispose();
}
