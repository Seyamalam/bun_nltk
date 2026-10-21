import { WasmNltk } from "./wasm.ts";

// Synchronous public tokenizers load WASM lazily on Node/Bun. Browser imports
// await the packaged WASM once; subsequent algorithms still run synchronously.
const isFile = new URL(import.meta.url).protocol === "file:";
const readFileSync = isFile ? (await import("node:fs")).readFileSync : undefined;
let runtime: WasmNltk | undefined = isFile ? undefined : await WasmNltk.init();

export function tokenizerRuntime(): WasmNltk {
  if (!runtime) {
    const relative = import.meta.url.includes("/dist/portable/")
      ? "../../native/bun_nltk.wasm" : "../native/bun_nltk.wasm";
    runtime = WasmNltk.initSync(readFileSync!(new URL(relative, import.meta.url)));
  }
  return runtime;
}
