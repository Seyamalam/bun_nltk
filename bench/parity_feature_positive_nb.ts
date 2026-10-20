const result = Bun.spawnSync(["bun", "test", "test/feature_positive_nb.test.ts"], { stdout: "pipe", stderr: "pipe" });
const parity = result.exitCode === 0;
if (!parity) console.error(new TextDecoder().decode(result.stderr));
console.log(JSON.stringify({ parity, oracle: "NLTK 3.10.3", probes: 818, tolerance: 1e-12, rust_wasm: true }));
if (!parity) process.exitCode = 1;
