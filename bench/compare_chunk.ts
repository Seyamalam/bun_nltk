import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chunkTreeToIob, regexpChunkParse, type TaggedToken } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function syntheticTagged(size = 15000): TaggedToken[] {
  const seed: TaggedToken[] = [
    { token: "The", tag: "DT" },
    { token: "quick", tag: "JJ" },
    { token: "brown", tag: "JJ" },
    { token: "fox", tag: "NN" },
    { token: "jumps", tag: "VBZ" },
    { token: "over", tag: "IN" },
    { token: "the", tag: "DT" },
    { token: "lazy", tag: "JJ" },
    { token: "dog", tag: "NN" },
  ];
  const out: TaggedToken[] = [];
  while (out.length < size) out.push(...seed);
  return out.slice(0, size);
}

const grammar = `
NP: {<DT>?<JJ>*<NN.*>+}
VP: {<VB.*><IN>?}
`;

function runNative(tagged: TaggedToken[], rounds: number) {
  const timings: number[] = [];
  let iob: Array<[string, string, string]> = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const tree = regexpChunkParse(tagged, grammar);
    iob = chunkTreeToIob(tree).map((row) => [row.token, row.tag, row.iob]);
    timings.push((performance.now() - started) / 1000);
  }
  return { iob, median_seconds: median(timings) };
}

function runPython(tagged: TaggedToken[]) {
  const payload = {
    grammar,
    tagged: tagged.map((row) => [row.token, row.tag]),
  };
  const payloadPath = resolve(import.meta.dir, "datasets", "chunk_payload.json");
  writeFileSync(payloadPath, JSON.stringify(payload), "utf8");
  const started = performance.now();
  const proc = Bun.spawnSync(["python", "bench/python_chunk_baseline.py", "--payload-file", payloadPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath, { force: true });
  if (proc.exitCode !== 0) {
    throw new Error(`python chunk baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const total_seconds = (performance.now() - started) / 1000;
  const parsed = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { iob: string[][] };
  return { iob: parsed.iob, total_seconds };
}

function main() {
  const size = Number(process.argv[2] ?? "15000");
  const rounds = Number(process.argv[3] ?? "5");
  const tagged = syntheticTagged(size);

  const native = runNative(tagged, rounds);
  const python = runPython(tagged);

  const parity = JSON.stringify(native.iob.slice(0, 400)) === JSON.stringify(python.iob.slice(0, 400));
  console.log(
    JSON.stringify(
      {
        tagged_size: size,
        rounds,
        parity_sample_400: parity,
        native_seconds_median: native.median_seconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: python.total_seconds / native.median_seconds,
      },
      null,
      2,
    ),
  );
}

main();
