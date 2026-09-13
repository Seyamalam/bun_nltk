import { expect, test } from "bun:test";
import fixture from "./fixtures/statistical-parity.json";
import { trainNgramLanguageModel, type NgramLanguageModelOptions } from "../src/lm";
import { trainNaiveBayesTextClassifier, loadNaiveBayesTextClassifier } from "../src/classify";
import { trainMaxEntTextClassifier, loadMaxEntTextClassifier } from "../src/maxent";
import { trainDecisionTreeTextClassifier, loadDecisionTreeTextClassifier } from "../src/decision_tree";
import { WasmNltk, type WasmLmModelType } from "../src/wasm";

test("all six language models match NLTK across orders, padding, unknowns and repeated contexts", () => {
  for (const row of fixture.lm) {
    const model = trainNgramLanguageModel(row.sentences, row.options as NgramLanguageModelOptions);
    const batch = model.evaluateBatch(row.probes, ["a", "b"]);
    for (const probe of row.perplexities) {
      const expected = probe.value ?? Infinity;
      const actual = model.perplexity(probe.tokens);
      if (expected === Infinity) expect(actual).toBe(Infinity);
      else
        expect(
          Math.abs(actual - expected) / expected,
          JSON.stringify({ options: row.options, probe }),
        ).toBeLessThan(1e-10);
    }
    row.probes.forEach((probe, i) => {
      const name = JSON.stringify({ options: row.options, sentences: row.sentences, probe });
      expect(model.score(probe.word, probe.context), name).toBeCloseTo(probe.score, 11);
      expect(batch.scores[i], `batch ${name}`).toBeCloseTo(probe.score, 11);
    });
  }
});

test("WASM language-model probabilities independently match the Python oracle", async () => {
  const wasm = await WasmNltk.init();
  for (const row of fixture.lm) {
    const options = row.options;
    if (options.order > 3 || !["mle", "lidstone", "kneser_ney_interpolated"].includes(options.model))
      continue;
    const left = options.padLeft ? (Array(options.order - 1).fill(options.startToken) as string[]) : [];
    const right = options.padRight ? (Array(options.order - 1).fill(options.endToken) as string[]) : [];
    const sentences = row.sentences.map((sentence) => [
      ...left,
      ...sentence.map((x) => x.toLowerCase()),
      ...right,
    ]);
    const vocab = [...new Set([...sentences.flat(), "<UNK>"])];
    const ids = new Map(vocab.map((word, i) => [word, i]));
    const unknown = ids.get("<UNK>")!;
    const id = (word: string) => ids.get(word) ?? unknown;
    let total = 0;
    const offsets = [0, ...sentences.map((sentence) => (total += sentence.length))];
    const out = wasm.evaluateLanguageModelIds({
      tokenIds: Uint32Array.from(sentences.flat().map(id)),
      sentenceOffsets: Uint32Array.from(offsets),
      order: options.order,
      model: options.model as WasmLmModelType,
      gamma: options.gamma,
      discount: options.discount,
      vocabSize: vocab.length,
      probeContextFlat: Uint32Array.from(row.probes.flatMap((probe) => probe.context.map(id))),
      probeContextLens: Uint32Array.from(row.probes.map((probe) => probe.context.length)),
      probeWordIds: Uint32Array.from(row.probes.map((probe) => id(probe.word))),
      perplexityTokenIds: Uint32Array.from([id("a")]),
      prefixTokenIds: Uint32Array.from(left.map(id)),
    });
    row.probes.forEach((probe, i) =>
      expect(out.scores[i], JSON.stringify({ options, probe })).toBeCloseTo(probe.score, 11),
    );
  }
});

test("categorical NB, IIS MaxEnt and error-minimizing trees match seeded NLTK models", () => {
  for (const row of fixture.classifiers) {
    const nb = trainNaiveBayesTextClassifier(row.train, { smoothing: row.smoothing });
    const maxent = trainMaxEntTextClassifier(row.train, { epochs: row.epochs });
    const tree = trainDecisionTreeTextClassifier(row.train, { maxDepth: 5, minSamples: 2 });
    const loadedNb = loadNaiveBayesTextClassifier(nb.toJSON()),
      loadedMaxent = loadMaxEntTextClassifier(maxent.toJSON()),
      loadedTree = loadDecisionTreeTextClassifier(tree.toJSON());
    for (const probe of row.expected) {
      expect(nb.classify(probe.text)).toBe(probe.nb);
      expect(loadedNb.classify(probe.text)).toBe(probe.nb);
      expect(maxent.classify(probe.text)).toBe(probe.maxent);
      expect(loadedMaxent.classify(probe.text)).toBe(probe.maxent);
      expect(tree.classify(probe.text)).toBe(probe.tree);
      expect(loadedTree.classify(probe.text)).toBe(probe.tree);
      for (const score of nb.predict(probe.text))
        expect(2 ** score.logProb).toBeCloseTo((probe.nbProb as Record<string, number>)[score.label]!, 10);
      for (const score of maxent.predict(probe.text))
        expect(score.probability).toBeCloseTo((probe.maxentProb as Record<string, number>)[score.label]!, 10);
    }
  }
});
