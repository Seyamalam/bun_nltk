import { resolve } from "node:path";
import { loadWordNetExtended, type WordNetPos } from "../index";

type Query = { word: string; pos?: WordNetPos };

function main() {
  const queries: Query[] = [
    { word: "dog", pos: "n" },
    { word: "dogs", pos: "n" },
    { word: "computer", pos: "n" },
    { word: "optimize", pos: "v" },
    { word: "quick", pos: "a" },
  ];

  const wn = loadWordNetExtended();
  const native = queries.map((q) => {
    const root = wn.morphy(q.word, q.pos) ?? q.word.toLowerCase();
    return {
      word: q.word,
      pos: q.pos,
      root,
      count: wn.synsets(root, q.pos).length,
    };
  });

  const proc = Bun.spawnSync(
    [
      "python",
      "bench/python_wordnet_queries_baseline.py",
      "--payload",
      "models/wordnet_extended.json",
      "--queries",
      JSON.stringify(queries),
    ],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python wordnet query baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    results: Array<{ word: string; pos?: WordNetPos; root: string; count: number }>;
  };
  const parity = JSON.stringify(native) === JSON.stringify(py.results);
  if (!parity) throw new Error("wordnet parity failed");
  console.log(JSON.stringify({ parity, query_count: queries.length }, null, 2));
}

main();

