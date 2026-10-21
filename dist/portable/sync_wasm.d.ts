import { WasmNltk } from './wasm.js';
import './tokenizer_types.js';
import './metrics_wasm.js';

/** Node/Bun loads lazily; browser imports await one shared WASM instance. */
declare function syncWasm(): WasmNltk;

export { syncWasm };
