const result = Bun.spawnSync(["bun", "test", "test/wasm_metrics_stream.test.ts"], { stdout: "pipe", stderr: "pipe" });
const parity = result.exitCode === 0;
if (!parity) console.error(new TextDecoder().decode(result.stderr));
console.log(JSON.stringify({ parity, exact_keys: true, arbitrary_byte_boundaries: true, corpus_bytes: 135266304, rust_wasm: true }));
if (!parity) process.exitCode = 1;
