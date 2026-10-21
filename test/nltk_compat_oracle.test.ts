import { expect, test } from "bun:test";
import { bigrams, ngrams, ngrams_iter, sent_tokenize, trigrams, word_tokenize, wordpunct_tokenize, type NgramOptions } from "../src/nltk_compat.ts";
import { PorterStemmer, type PorterMode } from "../src/porter_stemmer.ts";

type Outcome<T> = { value: T; error?: never } | { error: string; message: string; value?: never };
function oracle<T>(kind: string, cases: unknown[]): T {
  const proc = Bun.spawnSync(["python3", "test/oracles/nltk_compat.py"], {
    stdin: new TextEncoder().encode(JSON.stringify({ kind, cases })), stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  return JSON.parse(new TextDecoder().decode(proc.stdout)) as T;
}

test("Porter modes and lowercase flag match live NLTK 3.10.3 on all suffix rules and generated Unicode words", () => {
  const words = ["", "a", "s", "as", "is", "us", "y", "by", "ay", "ties", "dies", "flies", "spied", "died", "skies", "sky", "dying", "lying", "tying", "news", "innings", "outing", "cannings", "howe", "proceed", "exceed", "succeed", "SKIES", "enjoy", "spy", "try", "fly", "geologi", "theologi", "radicalli", "conformabli", "possibly", "hopefulli", "caresses", "relational", "triplicate", "controll", "filing", "running", "bled", "feed", "hopping", "happy", "probate", "rate", "roll", "Iİ", "İ", "ΟΣ", "ΟΣ́", "ΟΣ́Α", "ΣΟΣ", "ẞ", "cafés", "caféing", "猫s", "😀ing", "a\ud800ies", "yyyy".repeat(1000)];
  const suffixes = ["sses", "ies", "ss", "s", "eed", "ed", "ied", "ing", "y", "ational", "tional", "enci", "anci", "izer", "abli", "bli", "alli", "entli", "eli", "ousli", "ization", "ation", "ator", "alism", "iveness", "fulness", "ousness", "aliti", "iviti", "biliti", "fulli", "logi", "icate", "ative", "alize", "iciti", "ical", "ful", "ness", "al", "ance", "ence", "er", "ic", "able", "ible", "ant", "ement", "ment", "ent", "ion", "ou", "ism", "ate", "iti", "ous", "ive", "ize", "e", "ll"];
  for (const prefix of ["", "a", "ab", "aba", "hop", "conform", "geo", "alli", "y", "yy", "yyy", "aé", "É", "Σ", "😀", "a\ud800", "İ"]) {
    for (const suffix of suffixes) words.push(prefix + suffix);
  }
  let seed = 731;
  const chars = Array.from("aeioubcdlmsxyzAYİΣé😀\udfff");
  for (let i = 0; i < 1200; i++) {
    let word = "";
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    for (let j = 0; j < (seed % 20); j++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      word += chars[seed % chars.length];
    }
    words.push(word + suffixes[i % suffixes.length]);
  }
  const modes: PorterMode[] = [PorterStemmer.ORIGINAL_ALGORITHM, PorterStemmer.MARTIN_EXTENSIONS, PorterStemmer.NLTK_EXTENSIONS];
  const cases = modes.flatMap((mode) => [false, true].flatMap((lowercase) => words.map((word) => ({ mode, lowercase, word }))));
  const expected = oracle<string[]>("porter", cases);
  for (const [i, row] of cases.entries()) {
    expect(new PorterStemmer(row.mode).stem(row.word, row.lowercase), JSON.stringify(row)).toBe(expected[i]!);
  }
});

test("wordpunct Python Unicode categories, controls, punctuation groups and empty/error paths", () => {
  const cases: Array<string | null> = ["", " ", "Hello, world!!!", "café e\u0301 हिन्दी", "a\u200cb\u200dc", "a‿b⁀c_", "a²Ⅻ¼𐅀", "emoji👩‍👧?", "a\u001cb\u0085c\ufeffd", "\ud800x\udfff", null];
  let seed = 143;
  const chars = ["a", "é", "\u0301", "\u0345", "\u203f", "\u200c", "\u200d", "\u001c", "\u0085", "\ufeff", " ", "\t", "1", "²", "Ⅻ", "¼", "😀", "।", "क", "ि", "中", "!", "_", "𞓐"];
  for (let i = 0; i < 400; i++) {
    let text = "";
    for (let j = 0; j < 30; j++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      text += chars[seed % chars.length];
    }
    cases.push(text);
  }
  const expected = oracle<Array<Outcome<string[]>>>("wordpunct", cases);
  for (const [i, text] of cases.entries()) {
    if (text === null) { expect(expected[i]!.error).toBe("TypeError"); expect(() => wordpunct_tokenize(text as unknown as string)).toThrow(TypeError); }
    else expect(wordpunct_tokenize(text), JSON.stringify(text)).toEqual(expected[i]!.value!);
  }
});

test("word_tokenize preserve_line matches NLTK destructive tokenizer Unicode, all substitutions and generated texts", () => {
  const texts = ["", " ", "“Hello…” she said.\nNext?", "«Bonjour.» ‘Hi.’ „Yes”", "a—b–c‒d―e", "a..b...c....d*e", "'hello 's 're 'x", "can't Cannot cannot 'tis 'twas d'ye gimme gonna gotta lemme more'n wanna", "A\u001cB\u0085C\ufeffD", "a:² a:Ⅻ a:٢ a,１", "foo.   ”", "`` a ` b ``", "'İs 'ıS 'ſ 'K", "\ud800. \udfff", "((Hello.)) Next."];
  const fragments = ["a", "中", "é", "\u0301", "😀", "İ", "ı", "ſ", "K", "cannot", "Can't", "gonna", "wanna", "'tis", "'twas", "'hello", " ", "\n", "\u001c", "\u0085", "\ufeff", "\t", ".", "..", "...", "....", ",", ":", "2", "²", "٢", "“", "”", "‘", "’", "«", "»", "„", "\"", "''", "`", "``", "(", ")", "]", "--", "—", "*", "?", "!", "'s", "'re", "n't", "'", "@", "%"];
  let seed = 429;
  for (let i = 0; i < 1800; i++) {
    let text = "";
    for (let j = 0; j < 25; j++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      text += fragments[seed % fragments.length];
    }
    texts.push(text);
  }
  const expected = oracle<Array<Outcome<string[]>>>("word", texts);
  for (const [i, text] of texts.entries()) expect(word_tokenize(text, "unavailable", true), JSON.stringify(text)).toEqual(expected[i]!.value!);
});

test("ngrams arrays and lazy iterators match NLTK padding, short/empty inputs and zero/negative edges", () => {
  const cases: Array<{ sequence: number[]; n: number; options: NgramOptions<number | string> }> = [];
  for (let size = 0; size <= 5; size++) for (const n of [-2, -1, 0, 1, 2, 3, 7, 1.5]) {
    for (const pad_left of [false, true]) for (const pad_right of [false, true]) {
      cases.push({ sequence: Array.from({ length: size }, (_, i) => i), n, options: { pad_left, pad_right } });
      cases.push({ sequence: Array.from({ length: size }, (_, i) => i), n, options: { pad_left, pad_right, left_pad_symbol: "<s>", right_pad_symbol: 0 } });
    }
  }
  const expected = oracle<Array<Outcome<Array<Array<number | string | null>>>>>("ngrams", cases);
  for (const [i, row] of cases.entries()) {
    const sequence = function* () { yield* row.sequence; };
    if (expected[i]!.error) {
      expect(() => ngrams(sequence(), row.n, row.options)).toThrow(RangeError);
      expect(() => ngrams_iter(sequence(), row.n, row.options).next()).toThrow(RangeError);
    } else {
      expect(ngrams(sequence(), row.n, row.options), JSON.stringify(row)).toEqual(expected[i]!.value!);
      expect(Array.from(ngrams_iter(sequence(), row.n, row.options))).toEqual(expected[i]!.value!);
    }
  }
  expect(bigrams([1, 2], { pad_left: true })).toEqual([[null, 1], [1, 2]]);
  expect(trigrams("😀abc", { pad_right: true })).toEqual([["😀", "a", "b"], ["a", "b", "c"], ["b", "c", null], ["c", null, null]]);
});

test("lazy ngram consumption, infinite generators, object identity, reentrancy and delayed errors", () => {
  const a = {}, b = {}, pad = {};
  let reads = 0;
  function* source() { while (true) { reads++; yield reads % 2 ? a : b; } }
  const it = ngrams_iter(source(), 2, { pad_left: true, left_pad_symbol: pad });
  expect(reads).toBe(0);
  expect(it.next().value).toEqual([pad, a]); expect(reads).toBe(1);
  expect(ngrams([9, 8, 7], 2)).toEqual([[9, 8], [8, 7]]);
  expect(it.next().value).toEqual([a, b]); expect(reads).toBe(2);
  expect(it.next().value).toEqual([b, a]); expect(reads).toBe(3);
  it.return();
  function* failing() { yield a; throw new Error("source failed"); }
  expect(() => ngrams(failing(), 2)).toThrow("source failed");
  const invalid = ngrams_iter([], -1);
  expect(() => invalid.next()).toThrow(RangeError);
  expect(() => new PorterStemmer("INVALID")).toThrow("unsupported");
  expect(() => new PorterStemmer("NLTK_EXTENSIONS", "OTHER")).toThrow("unsupported");
  expect(() => new PorterStemmer().stem(null as unknown as string)).toThrow(TypeError);
});

test("sentence/word compatibility helpers use actual NLTK English params, preserve_line and language/errors", () => {
  const texts = ["", " ", "Hello, world! I can't.", "One. Two! Three?", "Dr. Smith went home. He slept.", "email@example.com and 3.14", "café e\u0301 हिन्दी 中文 👩\u200d👧!", "One\u00a0sentence.\u202fAnother.", "First.\nSecond.", "İΣΟΣ likes cats.", "foo\ufeffbar.", "“Hello…” she said.\nNext?", "\u001c\u001d", "a\u001cb. Next.", "Wait... What?!", "Hello!!! World?", "((Hello.)) Next.", "U.S. Army. Next.", "I cannot go. He gonna leave.", "A...B.", "One.\r\nTwo.", "\ufeff", " \t\n"];
  const cases: Array<{ text: string | null; language: string; preserve_line: boolean }> = [];
  for (const text of texts) for (const preserve_line of [false, true]) cases.push({ text, language: "english", preserve_line });
  for (const language of ["missing", "English", "french", ""]) for (const preserve_line of [false, true]) cases.push({ text: "", language, preserve_line });
  cases.push({ text: null, language: "english", preserve_line: false });
  const expected = oracle<Array<{ sent: Outcome<string[]>; word: Outcome<string[]> }>>("tokenize", cases);
  for (const [i, row] of cases.entries()) {
    const text = row.text as string;
    for (const [kind, call] of [["sent", () => sent_tokenize(text, row.language)], ["word", () => word_tokenize(text, row.language, row.preserve_line)]] as const) {
      const result = expected[i]![kind];
      if (result.error) {
        if (result.error === "TypeError") expect(call).toThrow(TypeError);
        else { expect(["LookupError", "OSError"]).toContain(result.error); expect(call).toThrow("only the bundled English Punkt model"); }
      } else expect(call(), JSON.stringify({ kind, ...row })).toEqual(result.value!);
    }
  }
});
