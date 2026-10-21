import { expect, test } from "bun:test";
import { RegexpTokenizer, RegexpTokenizerFlags, regexpTokenize, regexp_tokenize } from "../src/tokenizers_regexp.ts";
import { WasmNltk } from "../src/wasm.ts";
import type { RegexpToken } from "../src/tokenizers_regexp.ts";
import type { TokenSpan } from "../src/tokenizer_types.ts";

type Case = { pattern: string; text: string; flags?: number; gaps?: boolean; discard_empty?: boolean; all_scalars?: boolean };
type Result = { tokens: RegexpToken[]; spans: TokenSpan[]; error?: string };
function oracle(cases: Case[]): Result[] {
  const proc = Bun.spawnSync(["python3", new URL("./regexp_tokenizer_oracle.py", import.meta.url).pathname], {
    stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  return JSON.parse(new TextDecoder().decode(proc.stdout)) as Result[];
}
function tokenizer(data: Case, runtime?: WasmNltk): RegexpTokenizer {
  return new RegexpTokenizer(data.pattern, { gaps: data.gaps, discard_empty: data.discard_empty, flags: data.flags }, runtime);
}

test("Rust regexp tokens/captures/gaps/spans match Python 3.14.4 NLTK 3.10.3 redos", async () => {
  const patterns = [String.raw`\w+|\$[\d.]+|\S+`, String.raw`\w+`, String.raw`[^\w\s]+`, String.raw`\d+`, String.raw`\D+`, String.raw`\s+`, String.raw`[\w\s]+`, String.raw`[a-z]+`, String.raw`[^a-z]+`, String.raw`[\x41-\u005a]+`, String.raw`(?:cat|dog){1,2}`, String.raw`(?P<word>\w+)`, String.raw`(a)?(b)`, String.raw`(\w+)|(\d+)`, String.raw`(,)|(;)`, String.raw`(,)+`, String.raw`(,)+?`, String.raw`(,){2}`, String.raw`(,){1,3}`, String.raw`((?:,)+)`, String.raw`\S`, ".", "^", "$", "", "a{2,3}?", "a+?", "a # comment\n | b", "a\u001cb|a\u00a0b|a\u2028b", String.raw`[\b\n\t]+`, String.raw`\Aabc\Z`];
  const texts = ["", " ", ",a,,b;", "abc\ndef\n", "aab abb b catcat dog", "😀 é e\u0301 ² Ⅳ ٣ ２ _\u200c‿", "iIİı sSſ kKK σςΣ ßẞ \u{1df95}", "a\u001cb\u0085c\u00a0d\ufeff", "\b\n\t"];
  let seed = 733;
  const atoms = ["a", "b", ",", ";", " ", "\n", "😀", "é", "٣", "I", "İ", "ı", "\u0301"];
  for (let i = 0; i < 60; i++) texts.push(Array.from({ length: 20 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return atoms[seed % atoms.length]!;
  }).join(""));
  const cases: Case[] = [];
  for (const pattern of patterns) for (const text of texts) {
    for (const flags of [56, 0, 2, 10, 16, 64, 128, 130]) {
      if (flags % 16 < 8 && pattern === "$" && text.endsWith("\n")) continue;
      for (const gaps of [false, true]) for (const discard_empty of [false, true]) cases.push({ pattern, text, flags, gaps, discard_empty });
    }
  }
  const expected = oracle(cases);
  const runtime = await WasmNltk.init();
  try {
    for (const [i, data] of cases.entries()) {
      const t = tokenizer(data, runtime);
      const label = JSON.stringify(data);
      if (expected[i]!.error) {
        expect(() => t.tokenize(data.text), label).toThrow();
      } else {
        expect(t.tokenize(data.text), label).toEqual(expected[i]!.tokens);
        expect(t.span_tokenize(data.text), label).toEqual(expected[i]!.spans);
      }
    }
  } finally { runtime.dispose(); }
}, 120_000);

test("regexp aliases, lazy syntax errors, compiled source extraction, batches and lifecycle", async () => {
  expect(regexpTokenize("😀 café", String.raw`\w+`)).toEqual(["café"]);
  expect(regexp_tokenize(" a ", String.raw`\s+`, true, false)).toEqual(["", "a", ""]);
  expect(RegexpTokenizerFlags.ASCII).toBe(128);
  const runtime = await WasmNltk.init();
  const t = new RegexpTokenizer({ pattern: String.raw`\w+` }, false, true, 56, runtime);
  expect(t.tokenize_sents(["😀 café", ""])).toEqual([["café"], []]);
  expect(t.span_tokenize_sents(["😀 café", ""])).toEqual([[[2, 6]], []]);
  expect(t.tokenizeSents(["a"])).toEqual([["a"]]);
  expect(t.spanTokenizeSents(["a"])).toEqual([[[0, 1]]]);
  const invalid = new RegexpTokenizer("[", {}, runtime);
  expect(() => invalid.tokenize("x")).toThrow("invalid");
  expect(t.tokenize("next")).toEqual(["next"]);
  expect(() => new RegexpTokenizer("a", { flags: -1 })).toThrow(RangeError);
  expect(() => t.tokenize(42 as unknown as string)).toThrow(TypeError);
  expect(() => t.tokenize("\ud800")).toThrow();
  runtime.dispose();
  expect(() => t.tokenize("x")).toThrow("disposed");
});

test("regexp pinned word/decimal/space classes cover every Unicode scalar", async () => {
  const patterns = [String.raw`\w+`, String.raw`\d+`, String.raw`\s+`];
  const expected = oracle(patterns.map((pattern) => ({ pattern, text: "", all_scalars: true })));
  const parts: string[] = [];
  for (let cp = 0; cp < 0x110000; cp++) if (cp < 0xd800 || cp > 0xdfff) parts.push(String.fromCodePoint(cp));
  const text = parts.join("");
  const runtime = await WasmNltk.init();
  try {
    for (const [i, pattern] of patterns.entries()) {
      const t = new RegexpTokenizer(pattern, {}, runtime);
      expect(t.tokenize(text), pattern).toEqual(expected[i]!.tokens);
      expect(t.spanTokenize(text), pattern).toEqual(expected[i]!.spans);
    }
  } finally { runtime.dispose(); }
}, 120_000);

test("directed Unicode simple case mappings match redos, not Rust or stdlib re folding", async () => {
  const proc = Bun.spawnSync(["python3", "-c", "import json,regex;from regex import _regex;print(json.dumps([[chr(c), ''.join(map(chr,_regex.get_all_cases(0,c)))] for c in range(0x110000) if len(_regex.get_all_cases(0,c))>1]))"], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const rows = JSON.parse(new TextDecoder().decode(proc.stdout)) as [string, string][];
  const cases: Case[] = rows.flatMap(([c, text]) => [
    { pattern: c, text, flags: 2 }, { pattern: `[${c}]`, text, flags: 2 }, { pattern: `[^${c}]`, text, flags: 2 },
  ]);
  const expected = oracle(cases);
  const runtime = await WasmNltk.init();
  try {
    for (const [i, data] of cases.entries()) {
      expect(tokenizer(data, runtime).tokenize(data.text), JSON.stringify(data)).toEqual(expected[i]!.tokens);
    }
  } finally { runtime.dispose(); }
}, 120_000);

test("unsupported Python/regex constructs and nullable consuming matches are explicit, never JS fallbacks", () => {
  for (const pattern of [String.raw`(a)\1`, "(?=a)a", "(?<=a)b", "(?!a)b", "(?i)a", "(?i:a)", "(?>a)", "a++", "a{1,2}+", "(?(1)a|b)", String.raw`\bword\b`, String.raw`\p{L}`, String.raw`\N{LATIN CAPITAL LETTER A}`, "a*", ".*?", "(?:|a)", "((a)?b)+", "(?:a(b)?)+", "[[:alpha:]]"]) {
    const t = new RegexpTokenizer(pattern);
    expect(() => t.tokenize("aa"), pattern).toThrow("unsupported");
    expect(() => t.span_tokenize("aa"), pattern).toThrow("unsupported");
  }
  expect(() => new RegexpTokenizer("a".repeat(16_385)).tokenize("a")).toThrow("16384");
  expect(() => new RegexpTokenizer(String.raw`\w`.repeat(30)).tokenize("a")).toThrow("expanded pattern");
  expect(new RegexpTokenizer("(a|a)+$").tokenize("a".repeat(2000) + "!")).toEqual([]);
  expect(() => new RegexpTokenizer("a", { flags: 256 }).tokenize("a")).toThrow("flags");
  expect(() => new RegexpTokenizer("a", { flags: 4 }).tokenize("a")).toThrow("flags");
  expect(() => new RegexpTokenizer("a", { flags: 160 }).tokenize("a")).toThrow("incompatible");
  expect(() => new RegexpTokenizer("a$", { flags: 0 }).tokenize("a\n")).toThrow("final newline");
  for (const pattern of ["[", "(", "*", "[z-a]", String.raw`\q`]) {
    expect(oracle([{ pattern, text: "x" }])[0]!.error).toBeDefined();
    expect(() => new RegexpTokenizer(pattern).tokenize("x")).toThrow("invalid");
  }
});
