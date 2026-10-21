import { existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";

// The shipped browser bundle must stay under bench/browser_wasm_thresholds.json.
// Rust size flags alone do not reach that budget, so every WASM build finishes
// with a pinned Binaryen -Oz pass. Fail loudly instead of shipping oversize.
export function optimizeWasmInPlace(wasmPath: string, root: string): void {
  const configured = process.env.BUN_NLTK_WASM_OPT;
  const wasmOpt = configured ?? resolve(root, "node_modules", "binaryen", "bin", "wasm-opt");
  if (!existsSync(wasmOpt)) {
    throw new Error(`wasm-opt not found at ${wasmOpt}; run bun install or set BUN_NLTK_WASM_OPT`);
  }
  const tmp = `${wasmPath}.opt.tmp`;
  const proc = Bun.spawnSync(
    [
      process.execPath,
      wasmOpt,
      "-Oz",
      "--converge",
      "--enable-bulk-memory",
      "--enable-nontrapping-float-to-int",
      "--enable-sign-ext",
      "--enable-mutable-globals",
      wasmPath,
      "-o",
      tmp,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`wasm-opt failed\n${new TextDecoder().decode(proc.stderr)}`);
  }
  renameSync(tmp, wasmPath);
}
