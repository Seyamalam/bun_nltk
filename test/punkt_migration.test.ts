import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { syncWasm } from "../src/sync_wasm";
import { PunktTrainer, PunktSentenceTokenizer, defaultPunktModel, trainPunktModel, sentenceTokenizePunkt, type PunktModelSerialized } from "../src/punkt";

// Frozen against 169d004 before migration. Round scores only for libm differences.
function canonical(value: unknown): unknown {
  if (typeof value === "number") return Number(value.toFixed(10));
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export const trainingChunks = [
  [""], [" \n\t"], ["Dr. Smith left. Dr. Jones stayed. He slept."],
  ["Dr. Smith left.", "Dr Smith stayed. Dr Smith stayed. Dr Smith stayed."],
  ["First.\n\nDr. Élodie met É. Müller. ٣. chapter. ². Bach.\nLower line. İpek ΟΣ ǅuro 𐐀ach."],
  ["Wait... . . . Next! x--y. rare., lower. A. Smith. U.S.-based work."],
  ["Alpha. Lower here. rare. lower here.\n\nLower here."],
  ["J. Smith ate. ".repeat(40) + "Words without periods here ".repeat(200)],
  ["Done. He left. ".repeat(80) + "other words in the middle ".repeat(400)],
  ["Dr. Smith left. ".repeat(30), "Dr Smith stayed. ".repeat(40), "Dr. Smith left. ".repeat(40)],
];
export const legacyModels: PunktModelSerialized[] = [
  { version: 1, abbreviations: [], collocations: [], sentenceStarters: [] },
  { version: 1, abbreviations: ["DR.", "prof", "etc", "u.s", "p.m"], collocations: [["etc.", "NEXT"]], sentenceStarters: ["he", "lower"], abbreviationScores: { "ETC.": 0.8 }, orthographicContext: { next: { lower: 4, upper: 1 } } },
  { version: 0, abbreviations: ["etc", "rare"], collocations: [["rare", "next."]], sentenceStarters: ["lower"], abbreviationScores: { etc: 0.74, rare: 0.75 }, orthographicContext: { "next.": { lower: 3, upper: 1 }, "he.": { lower: -1, upper: 1 } } },
];
export const legacyTexts = [
  "", "  ", "  Hello. Next.  ", "Dr. Jones left. He slept.",
  "etc. Next. etc. next. rare. He. rare. Next.", "3.14. a.m. He left. J. Smith. U.S. Next.",
  "😀 Élodie. Müller! ٣. chapter. 𐐀. Next.", "Hi.\ud800 Next.\udc00 End.",
  "Hello.)]}  Next!?! lowercase. End", "First.\u0085Second.\u001cThird.\ufeffNext.",
  ...Array.from({ length: 240 }, (_, i) => `${["Dr.", "etc.", "rare.", "A.", "5.", "Wait...", "Yes?!", "U.S."][i % 8]}${[" ", "\n", ") ", "” ", "\u00a0", "\u200b"][Math.floor(i / 8) % 6]}${["Next.", "next.", "He.", "lower.", "Éclair!"][Math.floor(i / 48) % 5]}`),
];

test("Punkt training preserves the frozen pre-migration model contract", () => {
  const models = trainingChunks.flatMap((chunks) => [{}, { minAbbrevCount: 3, minCollocationCount: 4, minSentenceStarterCount: 3 }].map((options) => {
    const trainer = new PunktTrainer();
    for (const chunk of chunks) trainer.train(chunk, options);
    const model = trainer.getParams();
    expect(trainer.finalize()).toEqual(model);
    return model;
  }));
  expect(digest(models)).toBe("724af934ae31434a1755523e097dc8c0bdac1d2886b0ec4058aadf896c071938");
});

test("legacy version-1 inference preserves frozen behavior, including UTF-16 and JS whitespace", () => {
  const results = legacyModels.map((model) => legacyTexts.map((text) => sentenceTokenizePunkt(text, model)));
  expect(digest(results)).toBe("53b5ef4fb52b4806240c1d554a8a110128b5834e34f1056129248e3e27efb985");
  expect(() => new PunktSentenceTokenizer(legacyModels[0]).spanTokenize("Text.")).toThrow("version 2");
  expect(() => sentenceTokenizePunkt("Text.", legacyModels[0], false)).toThrow("version 2");
});

test("Punkt trainer API keeps defensive snapshots and retraining", () => {
  const trainer = new PunktTrainer().loadTrainText("Dr. Smith left. Dr. Jones stayed. He slept. ".repeat(4));
  const model = trainer.getParams();
  model.abbreviations.length = 0;
  expect(trainer.getParams().abbreviations).toContain("dr");
  trainer.train("Dr Smith stayed. ".repeat(40));
  expect(trainer.getParams().abbreviations).not.toContain("dr");
  expect(trainPunktModel("").version).toBe(2);
});

test("Rust Punkt training params and trained inference match actual NLTK 3.10.3/Python 3.14.4", () => {
  let seed = 606;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const pieces = ["Dr.", "É.", "٣.", "².", "Hello", "he", "ǅuro", "😀", "ΟΣ", "İpek", "ᵃ.", "𐐀.", ".", "!", "?", ",", ";", "\"", "‘", "’", "(", ")", "--", ". . .", "...", " ", "\n", "\r\n", "\u001c", "\u00a0", "\u2028"];
  const chunks = [...trainingChunks, ...Array.from({ length: 80 }, () => Array.from({ length: 3 }, () => Array.from({ length: 70 }, () => pieces[next() % pieces.length]).join("")))];
  const texts = ["Dr. Smith left. He slept. J. Smith stayed. ٣. chapter. É. Müller. ². Bach.", "rare. lower here. Dr. Élodie. 𐐀ach."];
  const proc = Bun.spawnSync(["python3", "test/python_punkt_training.py"], {
    stdin: new TextEncoder().encode(JSON.stringify({ chunks, texts })), stdout: "pipe", stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const expected = JSON.parse(new TextDecoder().decode(proc.stdout)) as { rows: { params: PunktModelSerialized; sentences: string[][] }[]; official: PunktModelSerialized };
  const params = (model: PunktModelSerialized) => ({ abbreviations: [...model.abbreviations].sort(), collocations: [...model.collocations].sort(), sentenceStarters: [...model.sentenceStarters].sort(), orthoContext: model.orthoContext });
  expect(params(defaultPunktModel())).toEqual(params(expected.official));
  for (const [i, corpus] of chunks.entries()) {
    const trainer = new PunktTrainer();
    for (const chunk of corpus) trainer.train(chunk);
    const model = trainer.getParams();
    const row = expected.rows[i]!;
    // NLTK defaultdict inserts zero-valued entries while inspecting rare types;
    // the existing serialized package contract omits those unobserved contexts.
    const observed = (model: PunktModelSerialized) => ({ ...params(model), orthoContext: Object.fromEntries(Object.entries(model.orthoContext ?? {}).filter(([, bits]) => bits !== 0)) });
    expect(observed(model), `corpus ${i}`).toEqual(observed(row.params));
    expect(Object.keys(model.abbreviationScores ?? {}).sort(), `score keys ${i}`).toEqual(Object.keys(row.params.abbreviationScores ?? {}).sort());
    for (const [abbr, score] of Object.entries(row.params.abbreviationScores ?? {})) {
      expect(model.abbreviationScores![abbr]!, `score ${i}/${abbr}`).toBeCloseTo(score, 10);
    }
    expect(texts.map((text) => sentenceTokenizePunkt(text, model)), `inference corpus ${i}`).toEqual(row.sentences);
  }
}, 30_000);

test("training excludes decimal-only non-punctuation types as NLTK does", () => {
  const model = trainPunktModel("!٣. ".repeat(8) + "words without periods ".repeat(30));
  expect(model.abbreviations).not.toContain("!٣");
  expect(model.abbreviationScores).not.toHaveProperty("!٣");
});

test("Punkt control ABI rejects malformed requests and legacy normalization respects entry order", () => {
  expect(() => syncWasm().punktRequest({ op: "unknown" })).toThrow();
  expect(() => syncWasm().punktRequest({ op: "train", chunks: [42] })).toThrow();
  expect(() => syncWasm().punktRequest({ op: "legacy", units: [65536], model: {} })).toThrow();
  expect(() => syncWasm().punktRequest({ op: "debug", text: "Text. Next.", model: [1] })).toThrow();
  const model: PunktModelSerialized = { version: 1, abbreviations: ["etc"], collocations: [], sentenceStarters: [],
    abbreviationScores: { etc: 0.8, "ETC.": 0.1 } };
  expect(sentenceTokenizePunkt("etc. Next.", model)).toEqual(["etc.", "Next."]);
  model.abbreviationScores = { "ETC.": 0.1, etc: 0.8 };
  expect(sentenceTokenizePunkt("etc. Next.", model)).toEqual(["etc. Next."]);
});
