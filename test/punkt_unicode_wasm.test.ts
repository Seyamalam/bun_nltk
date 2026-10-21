import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { defaultPunktModel, PunktSentenceTokenizer, sentenceTokenizePunkt, type PunktModelSerialized, type PunktDebugDecision } from "../src/punkt";
import { RustPunktTokenizer, encodePunktModel } from "../src/punkt_wasm";
import { WasmNltk } from "../src/wasm";

type OracleRow = {
  aligned: { sentences: string[]; bytes: [number, number][]; utf16: [number, number][] };
  raw: { sentences: string[]; bytes: [number, number][]; utf16: [number, number][] };
  debug?: PunktDebugDecision[];
  debug_error?: boolean;
};

function oracle(model: PunktModelSerialized, texts: string[], debug = false): OracleRow[] {
  const proc = Bun.spawnSync(["python3", "test/python_punkt_unicode.py"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdin: new TextEncoder().encode(JSON.stringify({ model, texts, debug })),
    stdout: "pipe", stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  return JSON.parse(new TextDecoder().decode(proc.stdout)) as OracleRow[];
}

const texts = [
  "", " ", "\t\r\n\u001c\u0085\u00a0", "  Leading.  Trailing.   ",
  "Dr. Élodie met Prof. Müller. He left the U.S. She stayed.",
  "J. Bach met É. Müller. ². Bach met Ⅷ. Jones. _. Name!",
  "١. chapter. ٣. Next. １２. chapter. 𝟜. Next. 3.14 is pi.",
  "‘Hello.’ Next. “Hello!” Next. «Hello?» Next. \"Yes.\" Next.",
  "(Hello.) Next. [Hello.] Next. {Hello.} Next. Hello.')]} Next.",
  "Hello.)--Next. Hello.))No space. Hello. ‘Open quote.’ Next.",
  "Very bad acting!!! I promise. Really?! Fine... Maybe. . . . Next.",
  "First paragraph.\n\nDr. Smith arrived.\nNext line.\r\nLast.",
  "No end\n\nNew paragraph without boundary", "😀 Hello. 𐐀. 𐐁ach left. 😃 Next!",
  "Dr. İpek left. Σ. ΟΣ went. Dr. ǅuro stayed. He left.",
  "First.\u0085Second.\u2028Third.\u2029Fourth.\u001cFifth.",
  "First.\u00a0Second.\u202fThird.\u3000Fourth.\u200bNot space.",
  "End at 5 p.m. He returned. U.S.-based work. Mr. Smith ate.",
  "word,word. Next. x@y.org. Next. www.example.org?a=b. Done.",
  "a...b. c--d. e----f?! Next; yes: okay, next. End",
  "A.\u0345word. Ⅰ. Bach. ᵃ. Name. ǅ. Name. İ. Name. ẞ. Name.",
];

function compare(model: PunktModelSerialized, cases: string[], existingApi: boolean) {
  const runtime = WasmNltk.initSync(readFileSync(new URL("../native/bun_nltk.wasm", import.meta.url)));
  const tokenizer = new RustPunktTokenizer(runtime, model);
  const expected = oracle(model, cases);
  try {
    for (let i = 0; i < cases.length; i++) {
      const text = cases[i]!, row = expected[i]!;
      expect(tokenizer.tokenize(text), text).toEqual(row.aligned.sentences);
      expect(tokenizer.byteSpans(text), text).toEqual(row.aligned.bytes);
      expect(tokenizer.spanTokenize(text), text).toEqual(row.aligned.utf16);
      expect(tokenizer.tokenize(text, false), text).toEqual(row.raw.sentences);
      expect(tokenizer.byteSpans(text, false), text).toEqual(row.raw.bytes);
      expect(tokenizer.spanTokenize(text, false), text).toEqual(row.raw.utf16);
      if (existingApi) expect(sentenceTokenizePunkt(text, model), text).toEqual(row.aligned.sentences);
    }
  } finally { tokenizer.dispose(); runtime.dispose(); }
}

test("Rust/WASM English Punkt Unicode boundaries and aligned/raw offsets match NLTK 3.10.3", () => {
  compare(defaultPunktModel(), texts, true);
});

test("Rust/WASM custom Punkt params match NLTK abbreviations, collocations, starters and ortho bits", () => {
  const model: PunktModelSerialized = { version: 2, abbreviations: ["dr", "etc", "σ", "İ"],
    collocations: [["j", "smith"], ["##number##", "chapter"], ["é", "müller"], ["σ", "ος"]],
    sentenceStarters: ["he", "éclair"], orthoContext: { éclair: 32, smith: 4, lower: 16, next: 112, "ǆuro": 32 } };
  compare(model, [...texts, "Dr. Éclair! J. Smith. ٣. chapter. Dr. lower. Dr. Next.",
    "É. Müller left. σ. ΟΣ left. Dr. ǅuro left. Dr. éclair."], true);
});

test("Rust/WASM English Punkt generated boundary combinations match NLTK 3.10.3", () => {
  const cases: string[] = [];
  const left = ["Dr.", "U.S.", "etc.", "J.", "É.", "².", "٣.", "Done.", "Wait...", "No?!", "Yes!!!", ". . .", "σ."];
  const right = ["He left.", "lower case.", "Éclair!", "ǅuro stayed.", "😀 Next.", "Müller left.", "𐐀ach left."];
  const separators = [" ", "\n\n", "\u00a0", "\u001c", ") ", "” ", "]--", "' ", "‘", ""];
  for (let i = 0; i < 910; i++) cases.push(`${left[i % left.length]}${separators[Math.floor(i / left.length) % separators.length]}${right[Math.floor(i / (left.length * separators.length)) % right.length]}`);
  compare(defaultPunktModel(), cases, false);
}, 30_000);

test("Rust/WASM Punkt seeded punctuation/Unicode contexts match NLTK 3.10.3", () => {
  let seed = 603;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const pieces = ["Dr.", "É.", "٣.", "².", "Hello", "he", "ǅuro", "😀", "ΟΣ", "İpek", "ᵃ.", "𐐀.", "\u0345word", ".", "!", "?", ",", ";", "\"", "‘", "’", "«", "»", "(", ")", "]", "}", "--", ". . .", "...", " ", "\n", "\r\n", "\u001c", "\u00a0", "\u2028", "\u200b"];
  const cases = Array.from({ length: 300 }, () => Array.from({ length: 30 }, () => pieces[next() % pieces.length]!).join(""));
  compare(defaultPunktModel(), cases, false);
}, 30_000);

test("Punkt WASM model snapshots, disposal and malformed marshaling", () => {
  const runtime = WasmNltk.initSync(readFileSync(new URL("../native/bun_nltk.wasm", import.meta.url)));
  const model: PunktModelSerialized = { version: 2, abbreviations: ["dr"], collocations: [], sentenceStarters: [] };
  const tokenizer = new RustPunktTokenizer(runtime, model);
  model.abbreviations.length = 0;
  expect(tokenizer.tokenize("Dr. Jones left." )).toEqual(["Dr. Jones left."]);
  expect(() => runtime.punktLoad(new Uint8Array([1, 0, 0, 0]))).toThrow();
  expect(() => encodePunktModel({ ...model, version: 1 })).toThrow();
  expect(() => encodePunktModel({ ...model, orthoContext: { x: -1 } })).toThrow();
  expect(() => tokenizer.tokenize("text", 1 as unknown as boolean)).toThrow();
  expect(tokenizer.tokenize("Hi.\ud800 Next.\udc00 End.")).toEqual(["Hi.\ud800 Next.\udc00 End."]);
  tokenizer.dispose(); tokenizer.dispose();
  expect(() => tokenizer.tokenize("Text.")).toThrow("disposed");
  runtime.dispose();
});

test("PunktSentenceTokenizer raw boundaries and UTF-16 spans use the Rust core", () => {
  const text = "😀 (Hello.) Next!", model = defaultPunktModel();
  const expected = oracle(model, [text])[0]!;
  const tokenizer = new PunktSentenceTokenizer(model);
  expect(tokenizer.tokenize(text, false)).toEqual(expected.raw.sentences);
  expect(tokenizer.spanTokenize(text)).toEqual(expected.aligned.utf16);
  expect(tokenizer.spanTokenize(text, false)).toEqual(expected.raw.utf16);
});

test("Punkt decision debug shares Rust inference and matches NLTK fields and failure boundaries", () => {
  const model: PunktModelSerialized = { version: 2, abbreviations: ["dr", "etc"],
    collocations: [["j", "smith"], ["##number##", "chapter"]], sentenceStarters: ["he"],
    orthoContext: { next: 32, smith: 4, chapter: 32, lower: 16 } };
  for (const params of [model, defaultPunktModel()]) {
    const cases = [...texts, "Dr. Next. Dr. He. J. Smith. ٣. chapter. A. lower.", "Hello.)", "Word?!", "Word.\"", "... next."];
    const expected = oracle(params, cases, true);
    const tokenizer = new PunktSentenceTokenizer(params);
    for (const [i, text] of cases.entries()) {
      if (expected[i]!.debug_error) expect(() => tokenizer.debugDecisions(text)).toThrow("two tokens");
      else {
        const decisions = tokenizer.debug_decisions(text).map((d) => ({ ...d, type2_ortho_contexts: [...d.type2_ortho_contexts].sort() }));
        expect(decisions, text).toEqual(expected[i]!.debug!);
      }
    }
    expect(tokenizer.span_tokenize("Text.")).toEqual(tokenizer.spanTokenize("Text."));
    expect(tokenizer.get_params()).toEqual(tokenizer.getParams());
  }
  expect(() => new PunktSentenceTokenizer({ ...model, version: 1 }).debug_decisions("Text. Next.")).toThrow("version 2");
}, 30_000);

test("custom Punkt all orthographic context bit combinations match NLTK", () => {
  const model: PunktModelSerialized = { version: 2, abbreviations: ["dr"], collocations: [], sentenceStarters: ["starter"], orthoContext: {} };
  const cases: string[] = [];
  for (let bits = 0; bits < 128; bits++) {
    model.orthoContext![`word${bits}`] = bits;
    for (const before of ["Dr.", "A.", "٣.", "Done.", "Wait..."]) {
      for (const first of ["Word", "word"]) cases.push(`${before} ${first}${bits}. Next.`);
    }
  }
  compare(model, cases, false);
}, 30_000);
