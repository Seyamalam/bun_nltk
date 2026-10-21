import { readFile } from "node:fs/promises";
import { measure } from "./workloads.mjs";

const rounds = Number(process.argv[2]), repetitions = Number(process.argv[3]);
const measurement = await measure(async () => {
  const importStart = performance.now();
  const { WasmNltk } = await import("../../src/wasm.ts");
  const importSeconds = (performance.now() - importStart) / 1000;
  const fetchStart = performance.now();
  const bytes = new Uint8Array(await readFile(new URL("../../native/bun_nltk.wasm", import.meta.url)));
  return { WasmNltk, bytes, importSeconds, fetchSeconds: (performance.now() - fetchStart) / 1000 };
}, rounds, repetitions, () => process.memoryUsage(), () => console.log(JSON.stringify({ phase: "cold-ready" })));
console.log(JSON.stringify({ phase: "result", runtime: process.version,
  bunVersion: typeof Bun === "undefined" ? null : Bun.version,
  peakRssBytes: process.resourceUsage().maxRSS * 1024, ...measurement }));
