import { expect, test } from "bun:test";
import { NgramLanguageModel, RustNgramLanguageModel, type LanguageModelType } from "../src/lm.ts";
import { WasmNltk } from "../src/wasm.ts";
import { LmWasm } from "../src/lm_wasm.ts";

const python = process.env.BUN_NLTK_PYTHON ?? "python3";
const families: LanguageModelType[] = ["mle", "lidstone", "laplace", "witten_bell_interpolated",
  "absolute_discounting_interpolated", "kneser_ney_interpolated", "stupid_backoff"];
const oracleScript = `
import json,sys,math,nltk
from nltk import lm
from nltk.util import everygrams
assert nltk.__version__ == '3.10.3', nltk.__version__
names = {'mle':lm.MLE,'lidstone':lm.Lidstone,'laplace':lm.Laplace,
 'witten_bell_interpolated':lm.WittenBellInterpolated,
 'absolute_discounting_interpolated':lm.AbsoluteDiscountingInterpolated,
 'kneser_ney_interpolated':lm.KneserNeyInterpolated,'stupid_backoff':lm.StupidBackoff}
out=[]
for case in json.load(sys.stdin):
 o=case['options']; n=o['order']; name=o['model']; start=o.get('startToken','<s>'); end=o.get('endToken','</s>')
 left=[start]*(n-1) if o.get('padLeft',True) else []; right=[end]*(n-1) if o.get('padRight',True) else []
 norm=lambda w: w if w in [start,end] else w.lower()
 rows=[left+[w.lower() for w in row]+right for row in case['sentences']]
 kwargs={}
 if name=='lidstone': kwargs['gamma']=o.get('gamma',.1)
 if name in ['kneser_ney_interpolated','absolute_discounting_interpolated']: kwargs['discount']=o.get('discount',.75)
 if name=='stupid_backoff': kwargs['alpha']=o.get('alpha',.4)
 model=names[name](order=n,**kwargs)
 model.fit([list(everygrams(row,max_len=n)) for row in rows],[w for row in rows for w in row])
 scores=[]; errors=[]
 for p in case['probes']:
  try: scores.append(model.score(norm(p['word']),tuple(norm(w) for w in p.get('context',[])[-(n-1):]) if n>1 else ()))
  except ZeroDivisionError: scores.append(None); errors.append('ZeroDivisionError')
 seq=[norm(w) for w in case['tokens']]+([end] if o.get('padRight',True) else [])
 history=left[:]; entropy=0
 try:
  for w in seq:
   p=model.score(w,tuple(history[-(n-1):]) if n>1 else ())
   entropy-=math.log2(p if math.isfinite(p) and p>0 else 1e-12); history.append(w)
  ppl=2**(entropy/len(seq)) if seq else None
 except ZeroDivisionError: ppl=None; errors.append('ZeroDivisionError')
 out.append({'scores':scores,'perplexity':ppl,'vocabulary':sorted(model.vocab),'errors':errors})
print(json.dumps(out))
`;

test("Rust LM pinned NLTK differential: all families, orders 1–8/16/64, OOV and padding", () => {
  const sentences = [["A", "b", "c", "d", "e", "f", "g", "h"], ["a", "b", "x", "d"], ["z", "b", "c"], ["a", "b", "c"], []];
  const cases = families.flatMap((model) => [1, 2, 3, 4, 5, 8, 16, 64].flatMap((order) => {
    // KN(1) has no bigrams: NLTK raises ZeroDivisionError; legacy API returns zero.
    if (model === "kneser_ney_interpolated" && order === 1) return [];
    return [0, 1, 2, 3].map((padding) => ({
      sentences,
      options: { order, model, gamma: 0.2, discount: 0.6, alpha: 0.3, padLeft: !!(padding & 1), padRight: !!(padding & 2), startToken: "START", endToken: "END" },
      probes: [
        { word: "B", context: ["A"] }, { word: "c", context: ["a", "b"] },
        { word: "d", context: ["a", "b", "c"] }, { word: "h", context: ["a", "b", "c", "d", "e", "f", "g"] },
        { word: "c", context: ["missing", "b"] }, { word: "a", context: Array(order - 1).fill("START") },
        { word: "END", context: ["h"] }, { word: "missing", context: ["a"] },
        { word: "<UNK>", context: [] }, { word: "a", context: [] },
        { word: "b", context: ["too", "long", ...Array(order).fill("a")] },
      ], tokens: ["A", "b", "c", "d", "missing"],
    }));
  }));
  for (const model of families) {
    for (const discount of [0, 1]) cases.push({
      sentences: [["CAFÉ", "😀", "<UNK>", "café"], []],
      options: { order: 4, model, gamma: 0.01, discount, alpha: 0, padLeft: true, padRight: true, startToken: "START", endToken: "END" },
      probes: [{ word: "café", context: [] }, { word: "😀", context: ["CAFÉ"] }, { word: "<UNK>", context: ["café", "😀"] }, { word: "oov", context: ["😀"] }],
      tokens: ["CAFÉ", "😀"],
    });
    cases.push({ sentences: [[]],
      options: { order: 5, model, gamma: 0.2, discount: 0.75, alpha: 0.4, padLeft: true, padRight: true, startToken: "START", endToken: "END" },
      probes: [{ word: "END", context: ["START"] }, { word: "START", context: [] }, { word: "absent", context: [] }], tokens: [],
    });
  }
  const proc = Bun.spawnSync([python, "-c", oracleScript], { stdin: Buffer.from(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const expected = JSON.parse(new TextDecoder().decode(proc.stdout)) as Array<{ scores: Array<number | null>; perplexity: number | null; vocabulary: string[]; errors: string[] }>;
  let scoreComparisons = 0, perplexityComparisons = 0, oracleExceptions = 0;
  for (const [i, row] of cases.entries()) {
    const model = new NgramLanguageModel(row.sentences, row.options);
    try {
      const batch = model.evaluateBatch(row.probes, row.tokens);
      expect(model.vocabulary).toEqual(expected[i]!.vocabulary);
      for (const [j, probe] of row.probes.entries()) {
        const score = expected[i]!.scores[j]!;
        if (score !== null) { expect(batch.scores[j]!).toBeCloseTo(score, 12); scoreComparisons++; }
        else { expect(row.options.model).toBe("kneser_ney_interpolated"); expect(Number.isFinite(batch.scores[j]!)).toBe(true); }
        expect(model.score(probe.word, probe.context)).toBe(batch.scores[j]!);
      }
      const ppl = expected[i]!.perplexity;
      if (ppl !== null) { expect(batch.perplexity / ppl).toBeCloseTo(1, 12); perplexityComparisons++; }
      else expect(row.options.model).toBe("kneser_ney_interpolated");
      oracleExceptions += expected[i]!.errors.length;
      expect(model.perplexity(row.tokens)).toBe(batch.perplexity);
    } finally { model.dispose(); }
  }
  console.info(JSON.stringify({ cases: cases.length, scoreComparisons, perplexityComparisons, oracleExceptions }));
  expect(scoreComparisons).toBeGreaterThan(2000);
  expect(perplexityComparisons).toBeGreaterThan(190);
}, 120_000);

test("Rust LM empty, terminal-context and legacy clamped log/perplexity contracts", () => {
  for (const family of families) {
    const empty = new NgramLanguageModel([], { order: 4, model: family, padLeft: false, padRight: false });
    expect(empty.vocabulary).toEqual(["<UNK>"]);
    expect(empty.score("absent")).toBe(family === "lidstone" || family === "laplace" ? 1 : 0);
    expect(empty.perplexity([])).toBe(Infinity);
    expect(empty.evaluateBatch([], []).perplexity).toBe(Infinity);
    empty.dispose();
    const model = new NgramLanguageModel([["a", "b"]], { order: 5, model: family, padLeft: false, padRight: false });
    expect(model.score("absent", ["b"])).toBe(family === "lidstone" || family === "laplace" ? 1 / 3 : 0);
    expect(model.perplexity([])).toBe(Infinity);
    expect(model.logscore("absent")).toBe(model.logScore("absent"));
    model.dispose();
  }
  const unigramKN = new NgramLanguageModel([["a"]], { order: 1, model: "kneser_ney_interpolated" });
  expect(unigramKN.score("a")).toBe(0);
  expect(unigramKN.logScore("a")).toBe(Math.log2(1e-12));
  unigramKN.dispose();
  const noSmoothing = new NgramLanguageModel([], { order: 1, model: "lidstone", gamma: 0 });
  expect(Number.isNaN(noSmoothing.score("a"))).toBe(true);
  noSmoothing.dispose();
});

test("portable explicit runtime owns persistent isolated LM handles", async () => {
  const runtime = await WasmNltk.init();
  const a = new RustNgramLanguageModel(runtime, [["a", "b", "c", "d"]], { order: 4 });
  const b = new RustNgramLanguageModel(runtime, [["a", "b", "c", "x"]], { order: 4 });
  expect(a.score("d", ["a", "b", "c"])).toBe(1);
  expect(b.score("d", ["a", "b", "c"])).toBe(0);
  a.dispose(); a.dispose();
  expect(() => a.score("a")).toThrow("disposed");
  expect(b.score("x", ["a", "b", "c"])).toBe(1);
  runtime.dispose();
  expect(() => b.score("a")).toThrow("disposed");
});

test("existing stateless WASM ID API reuses generic higher-order count kernel", async () => {
  const runtime = await WasmNltk.init();
  try {
    const result = runtime.evaluateLanguageModelIds({
      tokenIds: Uint32Array.from([1, 2, 3, 4, 5, 1, 2, 3, 4, 6]), sentenceOffsets: Uint32Array.from([0, 5, 10]),
      order: 5, model: "mle", gamma: 0.1, discount: 0.75, vocabSize: 7,
      probeContextFlat: Uint32Array.from([1, 2, 3, 4]), probeContextLens: Uint32Array.from([4]),
      probeWordIds: Uint32Array.from([5]), perplexityTokenIds: new Uint32Array(), prefixTokenIds: new Uint32Array(),
    });
    expect(Array.from(result.scores)).toEqual([0.5]);
    expect(result.perplexity).toBe(Infinity);
  } finally { runtime.dispose(); }
});

test("LM resource/ABI bounds fail explicitly rather than truncate or wrap", async () => {
  for (const order of [0, -1, 1.5, 65, 2 ** 32]) expect(() => new NgramLanguageModel([], { order })).toThrow();
  for (const gamma of [-1, NaN, Infinity]) expect(() => new NgramLanguageModel([], { order: 4, gamma })).toThrow();
  for (const discount of [-1, 1.01, NaN]) expect(() => new NgramLanguageModel([], { order: 4, discount })).toThrow();
  expect(() => new NgramLanguageModel([Array(20_000).fill("a")], { order: 64 })).toThrow();
  const runtime = await WasmNltk.init();
  const transport = new LmWasm(runtime);
  const config = Uint32Array.from([4, 0, 0, 0, 0, 1, 2]), params = Float64Array.from([0.1, 0.75, 0.4]);
  expect(() => transport.train(new Uint32Array([0]), new Uint32Array([0, 2]), config, params)).toThrow();
  const handle = transport.train(new Uint32Array([0]), new Uint32Array([0, 1]), config, params);
  expect(() => transport.evaluate(handle, new Uint32Array(), new Uint32Array([1]), new Uint32Array([0]), new Uint32Array(), false)).toThrow();
  transport.free(handle);
  expect(() => transport.vocabulary(handle)).toThrow();
  runtime.dispose();
});
