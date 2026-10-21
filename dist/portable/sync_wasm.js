import { WasmNltk } from "./wasm.js";
const nodeHost = typeof process !== "undefined" && !!(process.versions?.node || process.versions?.bun);
const readFileSync = nodeHost ? (await import("node:fs")).readFileSync : undefined;
let runtime = nodeHost ? undefined : await WasmNltk.init();
export function syncWasm() {
  const relative = import.meta.url.includes("/dist/portable/") ? "../../native/bun_nltk.wasm" : "../native/bun_nltk.wasm";
  return runtime ??= WasmNltk.initSync(readFileSync(new URL(relative, import.meta.url)));
}
