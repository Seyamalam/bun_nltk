import { dlopen, ptr, toArrayBuffer } from "bun:ffi";
import { readFileSync } from "node:fs";
import { release } from "node:os";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { hostStatus, nativeTargets, sha256, sourcePaths, validateNativeSignature } from "./native-provenance";
import type { NativeTarget } from "./native-provenance";

export async function smokeNativeSource(libraryPath: string, target: NativeTarget) {
  const host = { platform: process.platform, architecture: process.arch, os_release: release() };
  const gate = hostStatus(target, host.platform, host.architecture);
  if (gate.status === "blocked") return { ok: false as const, status: "blocked" as const, target, host, reason: gate.reason };
  const root = resolve(import.meta.dir, "..");
  const bytes = readFileSync(libraryPath);
  validateNativeSignature(bytes, target);
  process.env.BUN_NLTK_NATIVE_LIB = libraryPath;
  const api = await import("../src/native");
  const text = "Dr. Smith built three native models. They run on the host operating system.";
  if (api.nativeLibraryPath() !== libraryPath || api.countTokensAscii(text) !== 13 || api.countTokensAsciiScalar(text) !== 13) {
    throw new Error("Source candidate path/token-count smoke mismatch");
  }
  if (api.porterStemAscii("running") !== "run") throw new Error("Native Porter smoke mismatch");
  const metrics = api.computeAsciiMetrics("a b a", 2);
  if (metrics.tokens !== 3 || metrics.uniqueTokens !== 2 || metrics.ngrams !== 2) throw new Error("Native metrics smoke mismatch");

  // Resolve exported names without calling guessed prototypes. The wasm32-only
  // probability ABI is not compiled into native lib.rs; all other ABI modules
  // are native as well. Pointer-offset WASM functions must NOT be called here.
  const symbols = new Set<string>();
  for (const path of sourcePaths(root).filter((path) => path.endsWith(".rs") && path !== "rust/src/wasm_probability_contracts.rs")) {
    for (const match of readFileSync(resolve(root, path), "utf8").matchAll(/#\[no_mangle\]\s*(?:\/\/[^\n]*\n\s*)*pub\s+(?:unsafe\s+)?extern\s+"C"\s+fn\s+(bunnltk_\w+)/g)) symbols.add(match[1]!);
  }
  const names = [...symbols].sort();
  if (names.length === 0) throw new Error("No Rust ABI exports discovered");
  const contract = dlopen(libraryPath, Object.fromEntries(names.map((name) => [name, { args: [], returns: "void" }])));
  contract.close();

  const parsing = dlopen(libraryPath, {
    bunnltk_parsing_request: { args: ["ptr", "usize"], returns: "u32" },
    bunnltk_parsing_result_ptr: { args: [], returns: "ptr" },
    bunnltk_parsing_result_len: { args: [], returns: "usize" },
    bunnltk_parsing_release: { args: [], returns: "void" },
  });
  function request(value: unknown): { status: number; response: unknown } {
    const input = new TextEncoder().encode(JSON.stringify(value));
    const status = parsing.symbols.bunnltk_parsing_request(ptr(input), input.length);
    const length = Number(parsing.symbols.bunnltk_parsing_result_len());
    const output = new Uint8Array(toArrayBuffer(parsing.symbols.bunnltk_parsing_result_ptr()!, 0, length));
    return { status, response: JSON.parse(new TextDecoder().decode(output)) };
  }
  try {
    for (let round = 0; round < 3; round++) {
      const result = request({ op: "tree_fromstring", text: "(S (NN café) (VB runs))", brackets: "()", remove_top: false });
      const expected = { value: { label: "S", children: [{ label: "NN", children: ["café"] }, { label: "VB", children: ["runs"] }] } };
      if (result.status !== 0 || !isDeepStrictEqual(result.response, expected)) throw new Error(`Native UTF-8 parsing JSON ABI mismatch: ${JSON.stringify(result)}`);
      parsing.symbols.bunnltk_parsing_release();
    }
    const invalid = request({ op: "no_such_operation" });
    if (invalid.status !== 1 || typeof (invalid.response as { error?: unknown }).error !== "string") throw new Error("Native JSON ABI error smoke mismatch");
  } finally {
    parsing.symbols.bunnltk_parsing_release();
    parsing.close();
  }
  return {
    schema_version: 1, ok: true as const, status: "passed" as const, target, host,
    artifact_sha256: sha256(bytes), artifact_bytes: bytes.length,
    checks: { native_loader_contract: true, scalar_and_simd_tokens: true, porter: true, metrics: true, utf8_json_abi: true, json_error_abi: true },
    abi: { resolved_exports: names, count: names.length },
    package_validation: "not_run", foreign_host_validation: "not_run",
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const name = args[i]!;
    if (seen.has(name) || !["--library", "--target", "--strict"].includes(name)) throw new Error(`Unknown or duplicate source-smoke option: ${name}`);
    seen.add(name);
    if (name !== "--strict" && (!args[++i] || args[i]!.startsWith("--"))) throw new Error(`Missing value for ${name}`);
  }
  const get = (name: string) => args[args.indexOf(name) + 1];
  const target = args.includes("--target") ? get("--target") : `${process.platform}-${process.arch}`;
  if (!nativeTargets.includes(target as NativeTarget) || !args.includes("--library") || !get("--library")) throw new Error("usage: smoke-native-source.ts --library <candidate> [--target linux-x64|darwin-arm64|win32-x64]");
  const report = await smokeNativeSource(resolve(get("--library")!), target as NativeTarget);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok && args.includes("--strict")) process.exitCode = 1;
}
