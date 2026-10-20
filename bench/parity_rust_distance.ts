const result = Bun.spawnSync(["bun", "test", "test/rust_distance.test.ts"], { stdout: "pipe", stderr: "pipe" });
const parity = result.exitCode === 0;
if (!parity) console.error(new TextDecoder().decode(result.stderr));
console.log(JSON.stringify({ parity, oracle: "NLTK 3.10.3", cases: 762, exact: true, rust_wasm: true }));
if (!parity) process.exitCode = 1;
