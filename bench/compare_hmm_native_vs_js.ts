import { HiddenMarkovModelTagger } from "../src/hmm_tagger";
import type { GoldSentence } from "../src/sequential_taggers";
import { bootstrapMedianRatio, median } from "./statistics";

function makeTrainingCorpus(stateCount = 24, symbolCount = 192): GoldSentence[] {
  return Array.from({ length: stateCount * 8 }, (_, sentence) =>
    Array.from({ length: 80 }, (_, position) => {
      const state = (sentence * 7 + position * 5) % stateCount;
      const symbol = (state * 11 + position * 3 + sentence) % symbolCount;
      return [`token_${symbol}`, `state_${state}`] as [string, string];
    }),
  );
}

function makeSentences(count: number, length: number, symbolCount = 192): string[][] {
  return Array.from({ length: count }, (_, sentence) =>
    Array.from({ length }, (_, position) => `token_${(sentence * 13 + position * 17) % symbolCount}`),
  );
}

function run(model: HiddenMarkovModelTagger, sentences: string[][], rounds: number) {
  const timings: number[] = [];
  let paths: string[][] = [];
  model.bestPath(sentences[0]!);
  for (let round = 0; round < rounds; round += 1) {
    const started = performance.now();
    paths = sentences.map((sentence) => model.bestPath(sentence));
    timings.push(performance.now() - started);
  }
  return { median_ms: median(timings), ms_samples: timings, paths };
}

const sentenceCount = Math.max(1, Number(process.argv[2] ?? "240"));
const sentenceLength = Math.max(1, Number(process.argv[3] ?? "160"));
const rounds = Math.max(1, Number(process.argv[4] ?? "5"));
const corpus = makeTrainingCorpus();
const sentences = makeSentences(sentenceCount, sentenceLength);
const nativeModel = HiddenMarkovModelTagger.train(corpus, { useNativeDecoding: true });
const jsModel = HiddenMarkovModelTagger.train(corpus, { useNativeDecoding: false });
const native = run(nativeModel, sentences, rounds);
const js = run(jsModel, sentences, rounds);
if (JSON.stringify(native.paths) !== JSON.stringify(js.paths)) {
  throw new Error("native/TypeScript HMM paths differ");
}
const speedup = bootstrapMedianRatio(js.ms_samples, native.ms_samples);

console.log(
  JSON.stringify(
    {
      sentences: sentenceCount,
      tokens_per_sentence: sentenceLength,
      states: nativeModel.states.length,
      rounds,
      native_ms_median: native.median_ms,
      js_ms_median: js.median_ms,
      native_ms_samples: native.ms_samples,
      js_ms_samples: js.ms_samples,
      speedup_native_vs_js: speedup.estimate,
      speedup_ci95: speedup,
    },
    null,
    2,
  ),
);
