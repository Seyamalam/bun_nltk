import { WasmNltk } from "./wasm.ts";

const nodeHost = typeof process !== "undefined" && !!(process.versions?.node || process.versions?.bun);
const readFileSync = nodeHost ? (await import("node:fs")).readFileSync : undefined;
let runtime: WasmNltk | undefined = nodeHost ? undefined : await WasmNltk.init();
/** Node/Bun loads lazily; browser imports await one shared WASM instance. */
export function syncWasm(): WasmNltk {
  const relative = import.meta.url.includes("/dist/portable/")
    ? "../../native/bun_nltk.wasm"
    : "../native/bun_nltk.wasm";
  return runtime ??= WasmNltk.initSync(readFileSync!(new URL(relative, import.meta.url)));
}
