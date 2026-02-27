import { expect, test } from "bun:test";
import {
  countNgramsAscii,
  countTokensAscii,
  countTokensAsciiScalar,
  countUniqueNgramsAscii,
  countUniqueTokensAscii,
  NativeFreqDistStream,
  bigramWindowStatsAscii,
  bigramWindowStatsAsciiIds,
  bigramWindowStatsAsciiIdsJs,
  bigramWindowStatsAsciiJs,
  computeAsciiMetrics,
  computeAsciiMetricsJs,
  countNormalizedTokensAscii,
  countNormalizedTokensAsciiScalar,
  countNgramsAsciiJs,
  countTokensAsciiJs,
  countUniqueNgramsAsciiJs,
  countUniqueTokensAsciiJs,
  everygramsAscii,
  everygramsAsciiNative,
  evaluateLanguageModelIdsNative,
  chunkIobIdsNative,
  cykRecognizeIdsNative,
  naiveBayesLogScoresIdsNative,
  linearScoresSparseIdsNative,
  normalizeTokensAscii,
  normalizeTokensAsciiNative,
  ngramsAscii,
  ngramsAsciiNative,
  ngramFreqDistHashAscii,
  ngramFreqDistHashAsciiJs,
  posTagAscii,
  posTagAsciiNative,
  porterStemAscii,
  sentenceTokenizePunktAsciiNative,
  skipgramsAscii,
  skipgramsAsciiNative,
  topPmiBigramsAscii,
  topPmiBigramsAsciiJs,
  tokenFreqDistIdsAscii,
  tokenFreqDistIdsAsciiJs,
  tokenizeAscii,
  tokenizeAsciiNative,
  tokenFreqDistHashAscii,
  tokenFreqDistHashAsciiJs,
  wordnetMorphyAsciiNative,
  hashTokenAscii,
} from "../index";

const cases = [
  "this this is is a a test test",
  "My number is 601-984-4813, except it's not.",
  "Emoji test 👨‍👩‍👧‍👧 and accents resumé España München français",
  "Mixed123 CASE and apostrophe words like don't and O'Neill",
];

function expectHashMapsEqual(actual: Map<bigint, number>, expected: Map<bigint, number>) {
  expect(actual.size).toBe(expected.size);
  for (const [key, value] of expected.entries()) {
    expect(actual.get(key)).toBe(value);
  }
}

test("native token and ngram counters match JS reference", () => {
  for (const text of cases) {
    expect(countTokensAscii(text)).toBe(countTokensAsciiJs(text));
    expect(countTokensAscii(text)).toBe(countTokensAsciiScalar(text));
    expect(countUniqueTokensAscii(text)).toBe(countUniqueTokensAsciiJs(text));

    for (const n of [1, 2, 3]) {
      expect(countNgramsAscii(text, n)).toBe(countNgramsAsciiJs(text, n));
      expect(countUniqueNgramsAscii(text, n)).toBe(countUniqueNgramsAsciiJs(text, n));
      expect(computeAsciiMetrics(text, n)).toEqual(computeAsciiMetricsJs(text, n));
    }
  }
});

test("native hash freqdists match JS reference", () => {
  for (const text of cases) {
    expectHashMapsEqual(tokenFreqDistHashAscii(text), tokenFreqDistHashAsciiJs(text));

    for (const n of [1, 2, 3]) {
      expectHashMapsEqual(ngramFreqDistHashAscii(text, n), ngramFreqDistHashAsciiJs(text, n));
    }
  }
});

test("native token and ngram materialization matches JS reference", () => {
  for (const text of cases) {
    expect(tokenizeAsciiNative(text)).toEqual(tokenizeAscii(text));
    expect(normalizeTokensAsciiNative(text, true)).toEqual(normalizeTokensAscii(text, true));
    expect(normalizeTokensAsciiNative(text, false)).toEqual(normalizeTokensAscii(text, false));
    expect(countNormalizedTokensAscii(text, true)).toBe(normalizeTokensAscii(text, true).length);
    expect(countNormalizedTokensAscii(text, false)).toBe(normalizeTokensAscii(text, false).length);
    expect(countNormalizedTokensAscii(text, true)).toBe(countNormalizedTokensAsciiScalar(text, true));
    expect(countNormalizedTokensAscii(text, false)).toBe(countNormalizedTokensAsciiScalar(text, false));
    expect(
      posTagAsciiNative(text).map((row) => ({ token: row.token, tag: row.tag, tagId: row.tagId })),
    ).toEqual(posTagAscii(text).map((row) => ({ token: row.token, tag: row.tag, tagId: row.tagId })));

    for (const n of [1, 2, 3]) {
      expect(ngramsAsciiNative(text, n)).toEqual(ngramsAscii(text, n));
    }

    expect(everygramsAsciiNative(text, 1, 3)).toEqual(everygramsAscii(text, 1, 3));
    expect(skipgramsAsciiNative(text, 2, 2)).toEqual(skipgramsAscii(text, 2, 2));
  }
});

test("native everygrams/skipgrams reproduce NLTK examples", () => {
  expect(everygramsAsciiNative("a b c", 1, 3)).toEqual([
    ["a"],
    ["a", "b"],
    ["a", "b", "c"],
    ["b"],
    ["b", "c"],
    ["c"],
  ]);

  expect(skipgramsAsciiNative("Insurgents killed in ongoing fighting", 2, 2)).toEqual([
    ["insurgents", "killed"],
    ["insurgents", "in"],
    ["insurgents", "ongoing"],
    ["killed", "in"],
    ["killed", "ongoing"],
    ["killed", "fighting"],
    ["in", "ongoing"],
    ["in", "fighting"],
    ["ongoing", "fighting"],
  ]);
});

test("native top PMI bigrams match JS reference", () => {
  for (const text of cases) {
    const actual = topPmiBigramsAscii(text, 5, 2);
    const expected = topPmiBigramsAsciiJs(text, 5, 2);

    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i += 1) {
      expect(actual[i]!.leftHash).toBe(expected[i]!.leftHash);
      expect(actual[i]!.rightHash).toBe(expected[i]!.rightHash);
      expect(Math.abs(actual[i]!.score - expected[i]!.score)).toBeLessThanOrEqual(1e-12);
    }
  }
});

test("native token freqdist IDs are reversible and match JS reference", () => {
  const text = "Apple apple APPLE banana BANANA";
  const actual = tokenFreqDistIdsAscii(text);
  const expected = tokenFreqDistIdsAsciiJs(text);

  expect(actual.tokens).toEqual(["apple", "banana"]);
  expect(actual.counts).toEqual([3, 2]);
  expect(actual.totalTokens).toBe(5);

  expect(actual.tokens).toEqual(expected.tokens);
  expect(actual.counts).toEqual(expected.counts);
  expect(actual.totalTokens).toEqual(expected.totalTokens);
});

test("native bigram window stats IDs and token view match JS reference", () => {
  for (const text of cases) {
    for (const windowSize of [2, 3, 5]) {
      const actualId = bigramWindowStatsAsciiIds(text, windowSize);
      const expectedId = bigramWindowStatsAsciiIdsJs(text, windowSize);
      expect(actualId.length).toBe(expectedId.length);
      for (let i = 0; i < expectedId.length; i += 1) {
        expect(actualId[i]!.leftId).toBe(expectedId[i]!.leftId);
        expect(actualId[i]!.rightId).toBe(expectedId[i]!.rightId);
        expect(actualId[i]!.count).toBe(expectedId[i]!.count);
        expect(Math.abs(actualId[i]!.pmi - expectedId[i]!.pmi)).toBeLessThanOrEqual(1e-12);
      }

      const actualToken = bigramWindowStatsAscii(text, windowSize);
      const expectedToken = bigramWindowStatsAsciiJs(text, windowSize);
      expect(actualToken.length).toBe(expectedToken.length);
      for (let i = 0; i < expectedToken.length; i += 1) {
        expect(actualToken[i]!.left).toBe(expectedToken[i]!.left);
        expect(actualToken[i]!.right).toBe(expectedToken[i]!.right);
        expect(actualToken[i]!.count).toBe(expectedToken[i]!.count);
        expect(Math.abs(actualToken[i]!.pmi - expectedToken[i]!.pmi)).toBeLessThanOrEqual(1e-12);
      }
    }
  }
});

test("windowed PMI reproduces NLTK collocation sample values", () => {
  const text = "this this is is a a test test";
  const hash = (token: string) => {
    let h = 14695981039346656037n;
    for (let i = 0; i < token.length; i += 1) {
      h ^= BigInt(token.charCodeAt(i));
      h = (h * 1099511628211n) & 0xffffffffffffffffn;
    }
    return h;
  };

  const thisHash = hash("this");
  const isHash = hash("is");
  const aHash = hash("a");
  const testHash = hash("test");

  const window3 = topPmiBigramsAscii(text, 16, 3);
  const window3Ref = topPmiBigramsAsciiJs(text, 16, 3);
  expect(window3).toEqual(window3Ref);
  const score3 = (left: bigint, right: bigint) =>
    window3.find((x) => x.leftHash === left && x.rightHash === right)?.score;
  expect(score3(thisHash, isHash)).toBeCloseTo(1.584962500721156, 12);
  expect(score3(isHash, aHash)).toBeCloseTo(1.584962500721156, 12);
  expect(score3(aHash, testHash)).toBeCloseTo(1.584962500721156, 12);

  const window5 = topPmiBigramsAscii(text, 16, 5);
  const window5Ref = topPmiBigramsAsciiJs(text, 16, 5);
  expect(window5).toEqual(window5Ref);
  const score5 = (left: bigint, right: bigint) =>
    window5.find((x) => x.leftHash === left && x.rightHash === right)?.score;
  expect(score5(thisHash, aHash)).toBeCloseTo(0.5849625007211562, 12);
  expect(score5(isHash, testHash)).toBeCloseTo(0.5849625007211562, 12);
});

test("native porter stemmer matches NLTK-style vectors", () => {
  const vectors: Array<[string, string]> = [
    ["caresses", "caress"],
    ["ponies", "poni"],
    ["ties", "ti"],
    ["cats", "cat"],
    ["feed", "feed"],
    ["agreed", "agre"],
    ["plastered", "plaster"],
    ["motoring", "motor"],
    ["sing", "sing"],
    ["conflated", "conflat"],
    ["hopping", "hop"],
    ["filing", "file"],
    ["happy", "happi"],
    ["sky", "sky"],
    ["relational", "relat"],
    ["triplicate", "triplic"],
    ["probate", "probat"],
    ["rate", "rate"],
    ["controll", "control"],
    ["roll", "roll"],
    ["oed", "o"],
    ["On", "on"],
    ["Github", "github"],
  ];

  for (const [word, expected] of vectors) {
    expect(porterStemAscii(word)).toBe(expected);
  }
});

test("native handles empty input", () => {
  expect(countTokensAscii("")).toBe(0);
  expect(countUniqueTokensAscii("")).toBe(0);
  expect(countNgramsAscii("", 2)).toBe(0);
  expect(countUniqueNgramsAscii("", 2)).toBe(0);
  expect(tokenFreqDistHashAscii("").size).toBe(0);
  expect(ngramFreqDistHashAscii("", 2).size).toBe(0);
  expect(tokenizeAsciiNative("")).toEqual([]);
  expect(normalizeTokensAsciiNative("", true)).toEqual([]);
  expect(posTagAsciiNative("")).toEqual([]);
  expect(ngramsAsciiNative("", 2)).toEqual([]);
  expect(everygramsAsciiNative("", 1, 3)).toEqual([]);
  expect(skipgramsAsciiNative("", 2, 2)).toEqual([]);
  expect(topPmiBigramsAscii("", 5, 2)).toEqual([]);
  expect(tokenFreqDistIdsAscii("").tokens).toEqual([]);
  expect(bigramWindowStatsAscii("", 2)).toEqual([]);
  expect(sentenceTokenizePunktAsciiNative("")).toEqual([]);
  expect(wordnetMorphyAsciiNative("")).toBe("");
});

test("native punkt sentence tokenizer aligns with public punkt path", () => {
  const text = "Dr. Smith lives in the U.S. He works at 9 a.m.";
  expect(sentenceTokenizePunktAsciiNative(text)).toEqual([
    "Dr. Smith lives in the U.S.",
    "He works at 9 a.m.",
  ]);
});

test("native wordnet morphy handles inflections", () => {
  expect(wordnetMorphyAsciiNative("dogs", "n")).toBe("dog");
  expect(wordnetMorphyAsciiNative("sprinted", "v")).toBe("sprint");
  expect(wordnetMorphyAsciiNative("faster", "a")).toBe("fast");
});

test("native lm id evaluator returns finite scores and perplexity", () => {
  const out = evaluateLanguageModelIdsNative({
    tokenIds: Uint32Array.from([1, 2, 3, 4, 1, 2, 5, 4]),
    sentenceOffsets: Uint32Array.from([0, 4, 8]),
    order: 3,
    model: "kneser_ney_interpolated",
    gamma: 0.1,
    discount: 0.75,
    vocabSize: 6,
    probeContextFlat: Uint32Array.from([1, 2]),
    probeContextLens: Uint32Array.from([2]),
    probeWordIds: Uint32Array.from([3]),
    perplexityTokenIds: Uint32Array.from([1, 2, 3, 4]),
    prefixTokenIds: Uint32Array.from([0, 0]),
  });
  expect(out.scores.length).toBe(1);
  expect(out.scores[0]!).toBeGreaterThan(0);
  expect(Number.isFinite(out.perplexity)).toBeTrue();
});

test("native chunk iob evaluator emits expected labels", () => {
  const out = chunkIobIdsNative({
    tokenTagIds: Uint16Array.from([1, 2, 2, 3, 4, 5]),
    atomAllowedOffsets: Uint32Array.from([0, 1, 2, 3, 4]),
    atomAllowedLengths: Uint32Array.from([1, 1, 1, 1, 1]),
    atomAllowedFlat: Uint16Array.from([1, 2, 3, 4, 5]),
    atomMins: Uint8Array.from([0, 0, 1, 1, 0]),
    atomMaxs: Uint8Array.from([1, 255, 255, 255, 1]),
    ruleAtomOffsets: Uint32Array.from([0, 3]),
    ruleAtomCounts: Uint32Array.from([3, 2]),
    ruleLabelIds: Uint16Array.from([0, 1]),
  });
  expect(out.labelIds[0]!).toBe(0);
  expect(out.labelIds[3]!).toBe(0);
  expect(out.labelIds[4]!).toBe(1);
  expect(out.begins[0]!).toBe(1);
});

test("native cyk recognizer handles simple grammar ids", () => {
  const tokenBits = new BigUint64Array([
    1n << 4n, // Name
    1n << 3n, // V
    1n << 4n, // Name
  ]);
  const out = cykRecognizeIdsNative({
    tokenBits,
    binaryLeft: Uint16Array.from([1, 3]),
    binaryRight: Uint16Array.from([2, 1]),
    binaryParent: Uint16Array.from([0, 2]),
    unaryChild: Uint16Array.from([4]),
    unaryParent: Uint16Array.from([1]),
    startSymbol: 0,
  });
  expect(out).toBeTrue();
});

test("native naive bayes log score hot loop prefers expected label", () => {
  const scores = naiveBayesLogScoresIdsNative({
    docTokenIds: Uint32Array.from([0, 2]), // good, fast
    vocabSize: 3,
    tokenCountsMatrix: Uint32Array.from([
      10,
      1,
      8,
      1,
      10,
      1,
    ]),
    labelDocCounts: Uint32Array.from([5, 5]),
    labelTokenTotals: Uint32Array.from([19, 12]),
    totalDocs: 10,
    smoothing: 1.0,
  });
  expect(scores.length).toBe(2);
  expect(scores[0]!).toBeGreaterThan(scores[1]!);
});

test("native sparse linear scorer returns expected logits", () => {
  const out = linearScoresSparseIdsNative({
    docOffsets: Uint32Array.from([0, 2, 3]),
    featureIds: Uint32Array.from([0, 2, 1]),
    featureValues: Float64Array.from([1, 2, 3]),
    classCount: 2,
    featureCount: 3,
    weights: Float64Array.from([
      1, 0, 1,
      0, 2, 1,
    ]),
    bias: Float64Array.from([0.5, -0.5]),
  });
  expect(out.length).toBe(4);
  expect(out[0]!).toBeCloseTo(3.5, 12);
  expect(out[1]!).toBeCloseTo(1.5, 12);
  expect(out[2]!).toBeCloseTo(0.5, 12);
  expect(out[3]!).toBeCloseTo(5.5, 12);
});

test("native streaming freqdist builder matches reference counts and json export", () => {
  const text = "This this is a test. This runs quickly.";
  const stream = new NativeFreqDistStream();
  try {
    stream.update("This this is");
    stream.update(" a test.");
    stream.update(" This runs qu");
    stream.update("ickly.");
    stream.flush();

    expect(stream.tokenUniqueCount()).toBe(countUniqueTokensAscii(text));

    const tokenMap = stream.tokenFreqDistHash();
    expectHashMapsEqual(tokenMap, tokenFreqDistHashAsciiJs(text));

    const bigramRows = stream.bigramFreqDistHash();
    const expectedBigram = new Map<string, number>();
    const tokens = tokenizeAscii(text);
    for (let i = 0; i + 1 < tokens.length; i += 1) {
      const left = hashTokenAscii(tokens[i]!);
      const right = hashTokenAscii(tokens[i + 1]!);
      const key = `${left}:${right}`;
      expectedBigram.set(key, (expectedBigram.get(key) ?? 0) + 1);
    }
    expect(bigramRows.length).toBe(expectedBigram.size);
    for (const row of bigramRows) {
      const key = `${row.leftHash}:${row.rightHash}`;
      expect(expectedBigram.get(key)).toBe(row.count);
    }

    const expectedConditional = new Map<string, number>();
    for (const row of posTagAsciiNative(text)) {
      const key = `${row.tagId}:${hashTokenAscii(row.token.toLowerCase())}`;
      expectedConditional.set(key, (expectedConditional.get(key) ?? 0) + 1);
    }
    const conditionalRows = stream.conditionalFreqDistHash();
    expect(conditionalRows.length).toBe(expectedConditional.size);
    for (const row of conditionalRows) {
      const key = `${row.tagId}:${row.tokenHash}`;
      expect(expectedConditional.get(key)).toBe(row.count);
    }

    const payload = JSON.parse(stream.toJson()) as {
      tokens: Array<{ hash: string; count: number }>;
      bigrams: Array<{ left: string; right: string; count: number }>;
      conditional_tags: Array<{ tag_id: number; hash: string; count: number }>;
    };
    expect(payload.tokens.length).toBe(tokenMap.size);
    expect(payload.bigrams.length).toBe(bigramRows.length);
    expect(payload.conditional_tags.length).toBe(conditionalRows.length);
  } finally {
    stream.dispose();
  }
});
