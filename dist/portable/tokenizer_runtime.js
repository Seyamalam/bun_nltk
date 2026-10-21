import { WasmNltk } from "./wasm.js";
const isFile = new URL(import.meta.url).protocol === "file:";
const readFileSync = isFile ? (await import("node:fs")).readFileSync : undefined;
let runtime = isFile ? undefined : await WasmNltk.init();
export function tokenizerRuntime() {
  if (!runtime) {
    const relative = import.meta.url.includes("/dist/portable/") ? "../../native/bun_nltk.wasm" : "../native/bun_nltk.wasm";
    runtime = WasmNltk.initSync(readFileSync(new URL(relative, import.meta.url)));
  }
  return runtime;
}
