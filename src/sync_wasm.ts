import { readFileSync } from "node:fs";
import { WasmNltk } from "./wasm.ts";

let runtime: WasmNltk | undefined;
/** Lazy shared instance for synchronous Node/Bun APIs; browsers initialize WasmNltk explicitly. */
export function syncWasm(): WasmNltk {
  return runtime ??= WasmNltk.initSync(readFileSync(new URL("../native/bun_nltk.wasm", import.meta.url)));
}
