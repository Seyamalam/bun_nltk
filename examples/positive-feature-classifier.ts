import { WasmNltk } from "../src/wasm.ts";
import { RustPositiveNaiveBayesClassifier } from "../src/feature_nb.ts";

const runtime = await WasmNltk.init();
const model = RustPositiveNaiveBayesClassifier.train(runtime,
  [{ color: "red", shape: "round" }],
  [{ color: "red", shape: "round" }, { color: "blue", shape: "square" }]);
try {
  console.log(model.classify({ color: "red", shape: "round" }));
  console.log(model.predict({ color: "blue", shape: "square" }));
} finally {
  model.dispose();
  runtime.dispose();
}
