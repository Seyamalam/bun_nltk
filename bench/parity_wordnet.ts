import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadWordNet, type WordNetPos } from "../index";

type Query = { word: string; pos?: WordNetPos };

function resolveBaselinePayload(root: string): string {
  const envPath = process.env.BUN_NLTK_WORDNET_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  const packed = resolve(root, "models", "wordnet_full.bin");
  if (existsSync(packed)) return packed;
  return resolve(root, "models", "wordnet_extended.json");
}

function main() {
  const queries: Query[] = [
    { word: "dog", pos: "n" },
    { word: "dogs", pos: "n" },
    { word: "cat", pos: "n" },
    { word: "computer", pos: "n" },
    { word: "optimize", pos: "v" },
    { word: "quick", pos: "a" },
  ];

  const wn = loadWordNet();
  const native = queries.map((q) => {
    const root = wn.morphy(q.word, q.pos) ?? q.word.toLowerCase();
    const rows = wn.synsets(root, q.pos);
    const first = rows[0] ?? null;
    const firstPaths = first ? wn.hypernymPaths(first, { maxDepth: 16 }) : [];
    return {
      word: q.word,
      pos: q.pos,
      root,
      count: rows.length,
      first_id: first?.id ?? null,
      first_hypernyms: first ? wn.hypernyms(first).map((s) => s.id).sort() : [],
      first_hyponyms: first ? wn.hyponyms(first).map((s) => s.id).sort() : [],
      first_similar: first ? wn.similarTo(first).map((s) => s.id).sort() : [],
      first_antonyms: first ? wn.antonyms(first).map((s) => s.id).sort() : [],
      first_path_depth: firstPaths.length > 0 ? firstPaths[0]!.length - 1 : null,
    };
  });
  const dog = native.find((row) => row.word === "dog");
  const cat = native.find((row) => row.word === "cat");
  const dogId = dog?.first_id ?? null;
  const catId = cat?.first_id ?? null;
  const relations =
    dogId && catId
      ? {
          dog_cat_distance: wn.shortestPathDistance(dogId, catId),
          dog_cat_similarity: wn.pathSimilarity(dogId, catId),
          dog_cat_lch: wn.lowestCommonHypernyms(dogId, catId).map((row) => row.id).sort(),
        }
      : {
          dog_cat_distance: null,
          dog_cat_similarity: null,
          dog_cat_lch: [],
        };

  const root = resolve(import.meta.dir, "..");
  const payloadPath = resolveBaselinePayload(root);
  const proc = Bun.spawnSync(
    [
      "python",
      "bench/python_wordnet_queries_baseline.py",
      "--payload",
      payloadPath,
      "--queries",
      JSON.stringify(queries),
    ],
    {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python wordnet query baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    results: Array<{
      word: string;
      pos?: WordNetPos;
      root: string;
      count: number;
      first_id: string | null;
      first_hypernyms: string[];
      first_hyponyms: string[];
      first_similar: string[];
      first_antonyms: string[];
      first_path_depth: number | null;
    }>;
    relations: {
      dog_cat_distance: number | null;
      dog_cat_similarity: number | null;
      dog_cat_lch: string[];
    };
  };
  const parity =
    JSON.stringify(native) === JSON.stringify(py.results) && JSON.stringify(relations) === JSON.stringify(py.relations);
  if (!parity) throw new Error("wordnet parity failed");
  console.log(JSON.stringify({ parity, query_count: queries.length, relations }, null, 2));
}

main();
