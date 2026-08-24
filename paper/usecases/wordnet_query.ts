/**
 * WordNet query demo: synsets, lemmas, glosses and hypernyms for "car",
 * plus semantic similarity between two words via shortest-path distance.
 *
 * The loader honors BUN_NLTK_WORDNET_PATH; by default it falls back to the
 * packed official corpus in models/wordnet_full.bin when present, otherwise
 * to models/wordnet_extended.json.
 *
 * Run: bun run paper/usecases/wordnet_query.ts
 */
import { existsSync } from "node:fs";
import { loadWordNet, type WordNet } from "../../src/wordnet";

const envPath = process.env.BUN_NLTK_WORDNET_PATH;

console.log("== WordNet queries ==");
console.log(
  `BUN_NLTK_WORDNET_PATH: ${envPath ? envPath : "(not set — using bundled default)"}`,
);

let wn: WordNet;
try {
  if (envPath && !existsSync(envPath)) {
    console.error(`[error] BUN_NLTK_WORDNET_PATH is set but does not exist: ${envPath}`);
    process.exit(1);
  }
  const tLoad0 = performance.now();
  wn = loadWordNet(envPath);
  console.log(`WordNet loaded in ${(performance.now() - tLoad0).toFixed(1)} ms`);
} catch (err) {
  console.error(
    `[error] could not load WordNet data: ${err instanceof Error ? err.message : String(err)}\n` +
      `Set BUN_NLTK_WORDNET_PATH to a wordnet JSON/.bin payload or place models/wordnet_extended.json next to src/.`,
  );
  process.exit(1);
}

// ------------------------------------------------------------ synsets of car
const t0 = performance.now();

const carSynsets = wn.synsets("car");
if (carSynsets.length === 0) {
  console.error('[error] no synsets found for "car" — the loaded WordNet payload appears incomplete.');
  process.exit(1);
}

console.log(`\nSynsets of 'car': ${carSynsets.length} found`);
console.table(
  carSynsets.slice(0, 5).map((s, i) => ({
    "#": i + 1,
    id: s.id,
    pos: s.pos,
    lemmas: s.lemmas.join(", "),
    gloss: s.gloss.length > 70 ? `${s.gloss.slice(0, 70)}…` : s.gloss,
  })),
);

// Deep-dive on the motor-vehicle sense (the NLTK book's classic example).
const focus = carSynsets.find((s) => s.lemmas.includes("automobile")) ?? carSynsets[0]!;
const hypernyms = wn.hypernyms(focus);
console.log(`\nFocus sense: ${focus.lemmas.join(", ")} (${focus.id})`);
console.log(`Gloss: "${focus.gloss}"`);
console.log(`Hypernyms of focus sense (${hypernyms.length}):`);
for (const h of hypernyms) {
  console.log(`  ↑ ${h.id}  ${h.lemmas.join(", ")} — "${h.gloss}"`);
}

// walk up the hypernym chain
let chain = [focus];
let cursor = focus;
for (let depth = 0; depth < 8; depth += 1) {
  const parents = wn.hypernyms(cursor);
  if (parents.length === 0) break;
  cursor = parents[0]!;
  chain.push(cursor);
}
console.log(`\nHypernym chain (first parent each level): ${chain.map((s) => s.lemmas[0]).join(" → ")}`);

// ------------------------------------------------------- semantic similarity
function bestSimilarity(a: string, b: string): { score: number | null; lcs: string } {
  let best: number | null = null;
  let lcs = "-";
  for (const sa of wn.synsets(a, "n")) {
    for (const sb of wn.synsets(b, "n")) {
      const d = wn.shortestPathDistance(sa, sb);
      if (d === null) continue;
      const sim = 1 / (d + 1);
      if (best === null || sim > best) {
        best = sim;
        const common = wn.lowestCommonHypernyms(sa, sb);
        lcs = common.length > 0 ? common[0]!.lemmas[0] ?? common[0]!.id : "-";
      }
    }
  }
  return { score: best, lcs };
}

const pairsToCompare: Array<[string, string]> = [
  ["car", "automobile"],
  ["car", "bicycle"],
  ["car", "banana"],
];

console.log("\nSemantic similarity (path similarity = 1 / (shortest_path_distance + 1)):");
console.table(
  pairsToCompare.map(([a, b]) => {
    const { score, lcs } = bestSimilarity(a, b);
    return {
      pair: `${a} ~ ${b}`,
      path_similarity: score === null ? "n/a" : score.toFixed(4),
      lowest_common_hypernym: lcs,
    };
  }),
);

const tEnd = performance.now();
console.log("\nTiming:");
console.log(`  all WordNet queries (synsets + hypernyms + similarities): ${(tEnd - t0).toFixed(2)} ms`);
