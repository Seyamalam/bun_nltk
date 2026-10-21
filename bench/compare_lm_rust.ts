import { NgramLanguageModel, type LanguageModelType } from "../src/lm.ts";

// Measure training separately from repeated scoring: counts are built only once.
const sentences = Array.from({ length: 1000 }, (_, i) => Array.from({ length: 14 }, (_, j) => `w${(i * 7 + j) % 97}`));
const models: LanguageModelType[] = ["mle", "lidstone", "witten_bell_interpolated", "absolute_discounting_interpolated", "kneser_ney_interpolated", "stupid_backoff"];
for (const order of [3, 5, 8]) {
  for (const model of models) {
    const probes = sentences.slice(0, 100).map((row) => ({ word: row[order - 1]!, context: row.slice(0, order - 1) }));
    const started = performance.now();
    const lm = new NgramLanguageModel(sentences, { order, model });
    const trainMs = performance.now() - started;
    try {
      lm.evaluateBatch(probes, sentences[0]!);
      const start = performance.now();
      let checksum = 0;
      for (let i = 0; i < 100; i++) checksum += lm.evaluateBatch(probes, sentences[i % sentences.length]!).scores.reduce((sum, p) => sum + p, 0);
      console.log(JSON.stringify({ order, model, sentences: sentences.length, probes: probes.length, trainMs, reusedBatchMs: (performance.now() - start) / 100, checksum }));
    } finally { lm.dispose(); }
  }
}
