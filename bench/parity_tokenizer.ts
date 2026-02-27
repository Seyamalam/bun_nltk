import { resolve } from "node:path";
import { tokenizeAsciiNative } from "../index";

function main() {
  const text = "Dr. Smith's lab tested 42 samples, and U.S. teams re-tested them!";
  const js = tokenizeAsciiNative(text);
  const proc = Bun.spawnSync(["python", "bench/python_tokenizer_baseline.py", "--text", text], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python tokenizer baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { tokens: string[] };
  const parity = JSON.stringify(js) === JSON.stringify(py.tokens);
  if (!parity) throw new Error("tokenizer parity failed");
  console.log(JSON.stringify({ parity, token_count: js.length }, null, 2));
}

main();

