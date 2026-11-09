import { WasmNltk } from './index.browser.js';
export { syncWasm as tokenizerRuntime } from './sync_wasm.js';
import './tokenizer_types.js';
import './metrics_wasm.js';

/** Social tokenizers prefer the native FFI kernels on Bun, falling back to the
 * shared WASM runtime everywhere else (including Bun without the library). */
declare function socialTokenizerRuntime(): Pick<WasmNltk, "socialTokenizer">;

export { socialTokenizerRuntime };
