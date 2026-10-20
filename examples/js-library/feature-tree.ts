import { WasmNltk } from "bun_nltk/wasm";
import { RustDecisionTreeClassifier } from "bun_nltk/classify-tree";

const runtime = await WasmNltk.init();
const model = RustDecisionTreeClassifier.train(runtime, [
  [{ "color 😀": "Red" }, "upper"],
  [{ "color 😀": "red" }, "lower"],
]);
try {
  console.log(model.classifyMany([{ "color 😀": "Red" }, { "color 😀": "red" }, {}]));
} finally {
  model.dispose();
  runtime.dispose();
}
