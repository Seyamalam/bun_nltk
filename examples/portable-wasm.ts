import { WasmNltk } from "../src/wasm.ts";

// Run with Node 24+ or Bun. Browsers use wasmUrl pointing to the served artifact.
const nltk = await WasmNltk.init({ maxInputBytes: 8 * 1024 * 1024 });
try {
  console.log(nltk.tokenizeAscii("Hello from the shared Rust core!"));
  console.log(nltk.computeAsciiMetrics("a b a b", 2));
  console.log({ linearMemoryBytes: nltk.memoryBytes });
} finally {
  nltk.dispose();
}
