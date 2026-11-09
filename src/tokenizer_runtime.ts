import { nativeTokenizerAvailable, socialTokenizerNative } from "./native.ts";
import { syncWasm } from "./sync_wasm.ts";
import type { WasmNltk } from "./wasm.ts";

export { syncWasm as tokenizerRuntime } from "./sync_wasm.ts";

/** Shared Bun-native surface; the WASM runtime covers Node and browsers. */
const nativeSocialTokenizer = { socialTokenizer: socialTokenizerNative };

/** Social tokenizers prefer the native FFI kernels on Bun, falling back to the
 * shared WASM runtime everywhere else (including Bun without the library). */
export function socialTokenizerRuntime(): Pick<WasmNltk, "socialTokenizer"> {
  return nativeTokenizerAvailable() ? nativeSocialTokenizer : syncWasm();
}
