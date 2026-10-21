import { WasmNltk } from './wasm.js';
import './tokenizer_types.js';

declare function tokenizerRuntime(): WasmNltk;

export { tokenizerRuntime };
