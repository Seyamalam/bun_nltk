import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadWordNetExtended, regexpChunkParse, sentenceTokenizePunkt, tokenizeAsciiNative, trainNgramLanguageModel } from "../index";

type Samples = {
  punkt: number[];
  lm: number[];
  chunk: number[];
  wordnet: number[];
};

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95) - 1));
  return sorted[idx]!;
}

function maybeGc(): void {
  const gc = (Bun as unknown as { gc?: (force?: boolean) => void }).gc;
  if (typeof gc === "function") gc(true);
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const dataset = readFileSync(resolve(root, "bench", "datasets", "gate_synthetic.txt"), "utf8");
  const shortText = dataset.slice(0, 200_000);
  const tokens = tokenizeAsciiNative(shortText);
  const sentences: string[][] = [];
  for (let i = 0; i + 12 < Math.min(tokens.length, 6000); i += 12) {
    sentences.push(tokens.slice(i, i + 12));
  }
  const probes = sentences.slice(0, 20).map((s) => ({ word: s[2] ?? "the", context: [s[0] ?? "the", s[1] ?? "model"] }));
  const perplexityTokens = sentences[10] ?? ["the", "model", "runs", "fast"];
  const tagged = Array.from({ length: 4000 }, (_, i) => {
    const mod = i % 9;
    if (mod === 0) return { token: "The", tag: "DT" };
    if (mod === 1 || mod === 2) return { token: "quick", tag: "JJ" };
    if (mod === 3) return { token: "dog", tag: "NN" };
    if (mod === 4) return { token: "runs", tag: "VBZ" };
    if (mod === 5) return { token: "over", tag: "IN" };
    if (mod === 6) return { token: "the", tag: "DT" };
    if (mod === 7) return { token: "lazy", tag: "JJ" };
    return { token: "fox", tag: "NN" };
  });
  const grammar = `
NP: {<DT>?<JJ>*<NN.*>+}
VP: {<VB.*><IN>?}
`;
  const wn = loadWordNetExtended();
  const queries = wn.lemmas().slice(0, 200).map((lemma) => `${lemma}s`);

  const rounds = 30;
  const samples: Samples = { punkt: [], lm: [], chunk: [], wordnet: [] };
  let peakRss = process.memoryUsage().rss;
  maybeGc();
  const baselineRss = process.memoryUsage().rss;

  for (let i = 0; i < rounds; i += 1) {
    let start = performance.now();
    sentenceTokenizePunkt(shortText);
    samples.punkt.push((performance.now() - start) / 1000);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);

    start = performance.now();
    const lm = trainNgramLanguageModel(sentences, { order: 3, model: "kneser_ney_interpolated", discount: 0.75 });
    lm.evaluateBatch(probes, perplexityTokens);
    samples.lm.push((performance.now() - start) / 1000);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);

    start = performance.now();
    regexpChunkParse(tagged, grammar);
    samples.chunk.push((performance.now() - start) / 1000);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);

    start = performance.now();
    for (const q of queries) {
      wn.morphy(q, "n");
      wn.synsets(q, "n");
    }
    samples.wordnet.push((performance.now() - start) / 1000);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }

  const rssDeltaMb = (peakRss - baselineRss) / 1024 / 1024;
  const stats = {
    punkt_p95_seconds: p95(samples.punkt),
    lm_p95_seconds: p95(samples.lm),
    chunk_p95_seconds: p95(samples.chunk),
    wordnet_p95_seconds: p95(samples.wordnet),
    rss_delta_mb: rssDeltaMb,
  };

  const thresholds = {
    punkt_p95_seconds: 0.5,
    lm_p95_seconds: 1.0,
    chunk_p95_seconds: 0.1,
    wordnet_p95_seconds: 0.1,
    rss_delta_mb: 300,
  };

  if (stats.punkt_p95_seconds > thresholds.punkt_p95_seconds) throw new Error("punkt p95 SLA exceeded");
  if (stats.lm_p95_seconds > thresholds.lm_p95_seconds) throw new Error("lm p95 SLA exceeded");
  if (stats.chunk_p95_seconds > thresholds.chunk_p95_seconds) throw new Error("chunk p95 SLA exceeded");
  if (stats.wordnet_p95_seconds > thresholds.wordnet_p95_seconds) throw new Error("wordnet p95 SLA exceeded");
  if (stats.rss_delta_mb > thresholds.rss_delta_mb) throw new Error("rss delta SLA exceeded");

  console.log(
    JSON.stringify(
      {
        ok: true,
        rounds,
        thresholds,
        stats,
      },
      null,
      2,
    ),
  );
}

main();

