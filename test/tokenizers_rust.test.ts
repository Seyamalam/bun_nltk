import { expect, test } from "bun:test";
import { WasmNltk } from "../src/wasm.ts";
import { TreebankWordTokenizer, TreebankWordDetokenizer, WordPunctTokenizer } from "../src/tokenizers_treebank.ts";
import { WhitespaceTokenizer, BlanklineTokenizer, SpaceTokenizer, TabTokenizer, LineTokenizer } from "../src/tokenizers_basic.ts";
import type { BlanklineHandling, TokenizerKind, TokenSpan } from "../src/tokenizer_types.ts";
import { treebankWordTokenize, wordPunctTokenize, TreebankWordTokenizer as PublicTreebank, WhitespaceTokenizer as PublicWhitespace } from "../index.ts";
import { TreebankWordDetokenizer as EntrypointDetokenizer } from "../src/entrypoints/tokenize.ts";

type Case = {
  kind: TokenizerKind | "treebank-detokenize" | "all-scalars-wordpunct";
  text?: string;
  tokens?: string[];
  blanklines?: BlanklineHandling;
  convertParentheses?: boolean;
};
type OracleTokens = { tokens: string[]; spans: TokenSpan[] | null };

function oracle(cases: Case[]): Array<OracleTokens | string> {
  const python = Bun.spawnSync(["python3", new URL("./tokenizer_oracle.py", import.meta.url).pathname], {
    stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  return JSON.parse(new TextDecoder().decode(python.stdout)) as Array<OracleTokens | string>;
}

function texts(): string[] {
  const fixed = [
    "", " ", "\t", "\n", "\r\n", "  a  ", "\t\ta\t", "a\n\n", "a\n \n\t\nb\n", "\n \n",
    `Good muffins cost $3.88\nin New York.  Please buy me\ntwo of them.\nThanks.`,
    `"I can't, won't, shouldn't. They'll I'd I'm John's 'tis 'twas cannot d'ye gimme gonna gotta lemme more'n wanna."`,
    `CANNOT D'YE GIMME GONNA GOTTA LEMME MORE'N WANNA 'TIS 'TWAS`,
    `GİMME GıMME 'tİs 'tıs 'tiſ 'TİS 'TıS`,
    `²cannot Ⅳcannot cannot² cannotⅣ \u0301cannot cannot\u0301 \u200ccannot cannot\u200c cannot‿`,
    `x:٣,y:２ z:²,² end,\n`,
    `She said, "'Hi.'" He said, '"Bye."'`,
    `" ' '' ''' '''' \`\` \`\`\`\` """`,
    `").x "x") [[(hi)]]. <ok> -- --- ---- ..... ......`,
    `😀 "你好can't" café e\u0301\u200c_ Ⅳ ² ‿ 😀\u200d👩 \u{1e6c0}\u{11db0}`,
    `A\u001cB\u001dC\u001eD\u001fE\u0085F\u00a0G\u1680H\u2000I\u2007J\u2028K\u2029L\u202fM\u205fN\u3000O\ufeffP`,
    `a\r\nb\rc\vd\fe\u001cf\u001dg\u001eh\u0085i\u2028j\u2029`,
    `a'\t b'\n can't\t won't\n I'Ll I'Re I'Ve n'T wanna\u001cfoo`,
    ".", ".\n", "x.\n", "x.\n\n", "x,.\u001f", "x,\n", "x:\n", ":\n,", "a\\nb\\n\\n",
  ];
  const whitespace = ["\t", "\n", "\r", "\v", "\f", "\u001c", "\u001d", "\u001e", "\u001f", "\u0085", "\u00a0", "\u1680", "\u2000", "\u2001", "\u2002", "\u2003", "\u2004", "\u2005", "\u2006", "\u2007", "\u2008", "\u2009", "\u200a", "\u2028", "\u2029", "\u202f", "\u205f", "\u3000", "\ufeff"];
  for (const space of whitespace) fixed.push(`can't${space}cannot${space}wanna${space}'tis${space}.`, `a${space}\n${space}\nb`);
  for (const edge of ["²", "Ⅳ", "\u0301", "\u200c", "‿", "é", "中", "😀", " ", "!", "_", "\u{1e6c0}"]) {
    for (const contraction of ["cannot", "gimme", "wanna", "'tis"]) fixed.push(`${edge}${contraction}${edge}`);
  }
  let seed = 541;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const atoms = ["a", "b.", "cannot", "GİMME", "wanna", "'tis", "'twas", "can", "n't", "can't", "he'll", "'s", "\"", "''", "``", "'", ".", "...", ":", ",", "٣", "²", "Ⅳ", "[", "]", "(", ")", "{", "}", "<", ">", "?", "!", "@", "$", "#", "%", "&", ";", "--", "\n", "\r", "\t", " ", "\u001c", "\u00a0", "\u2028", "\u0301", "\u200d", "\ufeff", "😀", "你好"];
  for (let i = 0; i < 700; i++) {
    fixed.push(Array.from({ length: 1 + random() % 28 }, () => atoms[random() % atoms.length]!).join(""));
  }
  return fixed;
}

test("actual Rust WASM tokenizers and scalar spans match pinned NLTK 3.10.3", async () => {
  const cases: Case[] = [];
  for (const text of texts()) {
    for (const kind of ["treebank", "wordpunct", "whitespace", "blankline", "space", "tab"] as const) {
      cases.push({ kind, text });
    }
    cases.push({ kind: "treebank", text, convertParentheses: true });
    for (const blanklines of ["keep", "discard", "discard-eof"] as const) cases.push({ kind: "line", text, blanklines });
  }
  const expected = oracle(cases) as OracleTokens[];
  const runtime = await WasmNltk.init();
  try {
    for (const [index, data] of cases.entries()) {
      const kind = data.kind as TokenizerKind;
      const options = { convertParentheses: data.convertParentheses, blanklines: data.blanklines };
      const label = `case ${index} ${JSON.stringify(data)}`;
      expect(runtime.tokenize(data.text!, kind, options), label).toEqual(expected[index]!.tokens);
      if (expected[index]!.spans === null) {
        expect(() => runtime.tokenizerSpans(data.text!, kind, options), label).toThrow();
      } else {
        expect(runtime.tokenizerSpans(data.text!, kind, options), label).toEqual(expected[index]!.spans!);
      }
    }
  } finally { runtime.dispose(); }
}, 120_000);

test("WordPunct tokens and spans match NLTK for every Unicode scalar, including newer scripts", async () => {
  const expected = oracle([{ kind: "all-scalars-wordpunct" }])[0] as OracleTokens;
  const parts: string[] = [];
  for (let cp = 0; cp < 0x110000; cp++) if (cp < 0xd800 || cp > 0xdfff) parts.push(String.fromCodePoint(cp));
  const text = parts.join("");
  const runtime = await WasmNltk.init();
  try {
    expect(runtime.tokenize(text, "wordpunct")).toEqual(expected.tokens);
    expect(runtime.tokenizerSpans(text, "wordpunct")).toEqual(expected.spans!);
  } finally { runtime.dispose(); }
}, 120_000);

test("Rust Treebank detokenization matches NLTK ordered reverse substitutions, including nested quotes", async () => {
  const runtime = await WasmNltk.init();
  const cases: Case[] = [];
  for (const text of texts()) {
    for (const convertParentheses of [false, true]) {
      cases.push({ kind: "treebank-detokenize", tokens: runtime.tokenize(text, "treebank", { convertParentheses }), convertParentheses });
    }
  }
  for (const tokens of [
    [], [""], [" ", "\t"], ["hello", ",", "i", "ca", "n't", "feel", "my", "feet", "!", "Help", "!", "!"],
    ["``", "'", "Hi", ".", "'", "''"], ["can", "not", "gim", "me", "'t", "is", "wan", "na"],
    ["can\u001cnot", "gim\u00a0me", "'t\u001fis"], ["-LRB-", "a", "-RRB-", "."],
  ]) cases.push({ kind: "treebank-detokenize", tokens });
  let seed = 551;
  const atoms = ["a", "'", "''", "``", "\"", ".", "..", "...", "x .", ". a", ",", "!", "(", ")", "--", "can", "not", "gim", "me", "'t", "is", "wan", "na", "\u001c", "\n", "\t", "", "😀", "'s", "n't", "'ll"];
  for (let i = 0; i < 700; i++) {
    const tokens = Array.from({ length: 12 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return atoms[seed % atoms.length]!;
    });
    cases.push({ kind: "treebank-detokenize", tokens });
  }
  const expected = oracle(cases);
  try {
    for (const [index, data] of cases.entries()) {
      expect(runtime.treebankDetokenize(data.tokens!, data.convertParentheses), JSON.stringify(data)).toEqual(expected[index] as string);
    }
  } finally { runtime.dispose(); }
}, 120_000);

test("thin tokenizer adapters preserve class names, batches, Python span indices and lifecycle", async () => {
  const runtime = await WasmNltk.init();
  const treebank = new TreebankWordTokenizer(runtime);
  const wordpunct = new WordPunctTokenizer(runtime);
  const detokenizer = new TreebankWordDetokenizer(runtime);
  expect(treebank.tokenize("😀 (can't)", true)).toEqual(["😀", "-LRB-", "ca", "n't", "-RRB-"]);
  expect(treebank.span_tokenize("😀 (can't)")).toEqual([[0, 1], [2, 3], [3, 5], [5, 8], [8, 9]]);
  expect(wordpunct.tokenize_sents(["e\u0301", "can't"])).toEqual([["e\u0301"], ["can", "'", "t"]]);
  expect(detokenizer.detokenize(treebank.tokenize("(can't)", true), true)).toBe("(can't)");
  expect(new WhitespaceTokenizer(runtime).tokenize("a\u001cb\u00a0c")).toEqual(["a\u001cb", "c"]);
  expect(new BlanklineTokenizer(runtime).tokenize("a\n \n b")).toEqual(["a", "b"]);
  expect(new SpaceTokenizer(runtime).tokenize(" a  ")).toEqual(["", "a", "", ""]);
  expect(new TabTokenizer(runtime).span_tokenize("\t😀\t\t")).toEqual([[1, 2], [3, 3]]);
  expect(new LineTokenizer("keep", runtime).tokenize("a\r\n\u2028b\n")).toEqual(["a", "", "b"]);
  expect(treebank.tokenize_sents(["can't", ""]).length).toBe(2);
  expect(treebank.span_tokenize_sents(["can't", ""])).toEqual([[[0, 2], [2, 5]], []]);
  expect(() => new LineTokenizer("invalid" as BlanklineHandling)).toThrow(RangeError);
  expect(() => runtime.tokenize("x", "missing" as TokenizerKind)).toThrow("unknown tokenizer");
  expect(() => runtime.tokenizerSpans("x", "line", { blanklines: "invalid" as BlanklineHandling })).toThrow("blanklines");
  expect(() => runtime.tokenize("\ud800")).toThrow();
  expect(() => runtime.treebankDetokenize(["\udfff"])).toThrow();
  runtime.dispose();
  expect(() => treebank.tokenize("x")).toThrow("disposed");
});

test("existing public functions and class exports use the validated Rust algorithms", () => {
  const cases: Case[] = texts().flatMap((text) => [{ kind: "treebank", text }, { kind: "wordpunct", text }]);
  const expected = oracle(cases) as OracleTokens[];
  for (const [index, data] of cases.entries()) {
    const tokens = data.kind === "treebank" ? treebankWordTokenize(data.text!) : wordPunctTokenize(data.text!);
    expect(tokens, JSON.stringify(data)).toEqual(expected[index]!.tokens);
  }
  expect(new PublicTreebank().span_tokenize("😀 cannot")).toEqual([[0, 1], [2, 5], [5, 8]]);
  expect(new PublicWhitespace().tokenize("a\u001cb c")).toEqual(["a\u001cb", "c"]);
  expect(new EntrypointDetokenizer().detokenize(["can", "not"])).toBe("cannot");
}, 120_000);

test("tokenizer WASM input limits and error recovery preserve valid subsequent calls", async () => {
  const bytes = new Uint8Array(await Bun.file(new URL("../native/bun_nltk.wasm", import.meta.url)).arrayBuffer());
  const runtime = WasmNltk.initSync(bytes, 64);
  try {
    expect(() => runtime.tokenize("x".repeat(128))).toThrow(RangeError);
    expect(() => runtime.tokenize("x", "missing" as TokenizerKind)).toThrow("unknown tokenizer");
    expect(runtime.tokenize("can't")).toEqual(["ca", "n't"]);
    expect(() => runtime.tokenize(42 as unknown as string)).toThrow(TypeError);
    expect(() => runtime.treebankDetokenize([42] as unknown as string[])).toThrow(TypeError);
    expect(runtime.tokenizerSpans("😀")).toEqual([[0, 1]]);
  } finally { runtime.dispose(); }
});
