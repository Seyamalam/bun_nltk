import { createReadStream } from "node:fs";
import { WasmNltk } from "../src/wasm.ts";

// Node 24+ or Bun; no complete file/string is retained in JavaScript or WASM.
const path = process.argv[2];
if (!path) throw new Error("Usage: node examples/streaming-metrics.ts <file>");
const wasm = await WasmNltk.init();
const stream = wasm.createAsciiMetricsStream(2);
try {
  for await (const bytes of createReadStream(path, { highWaterMark: 1024 * 1024 })) {
    stream.update(bytes as Uint8Array);
  }
  console.log(stream.finish());
} finally {
  stream.dispose();
  wasm.dispose();
}
