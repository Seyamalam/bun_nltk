import { readFileSync } from "node:fs";
import { WasmNltk } from "./wasm.ts";

let runtime: WasmNltk | undefined;
/** Lazy shared instance for synchronous Node/Bun APIs; browsers initialize WasmNltk explicitly. */
export function syncWasm(): WasmNltk {
  const relative = import.meta.url.includes("/dist/portable/")
    ? "../../native/bun_nltk.wasm"
    : "../native/bun_nltk.wasm";
  return runtime ??= WasmNltk.initSync(readFileSync(new URL(relative, import.meta.url)));
}
