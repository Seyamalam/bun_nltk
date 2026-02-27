import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Thresholds = {
  size_bytes_max: number;
};

const root = resolve(import.meta.dir, "..");
const wasmPath = resolve(root, "native", "bun_nltk.wasm");
const thresholdsPath = resolve(root, "bench", "browser_wasm_thresholds.json");

function main() {
  const thresholds = JSON.parse(readFileSync(thresholdsPath, "utf8")) as Thresholds;
  const bytes = readFileSync(wasmPath);
  const size = bytes.length;

  if (size > thresholds.size_bytes_max) {
    throw new Error(`wasm size threshold exceeded: ${size} > ${thresholds.size_bytes_max}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        wasm_size_bytes: size,
        max_bytes: thresholds.size_bytes_max,
      },
      null,
      2,
    ),
  );
}

main();
