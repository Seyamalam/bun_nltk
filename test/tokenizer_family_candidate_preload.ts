/** bun test --preload this file to test public sync adapters without replacing native WASM. */
import { mock } from "bun:test";
import { WasmNltk } from "../src/wasm.ts";

const path = process.env.BUN_NLTK_TOKENIZER_WASM;
if (!path) throw new Error("candidate preload requires BUN_NLTK_TOKENIZER_WASM");
const runtime = await WasmNltk.init({ wasmPath: path });
mock.module("../src/tokenizer_runtime.ts", () => ({ tokenizerRuntime: () => runtime }));
