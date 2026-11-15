import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { sent_tokenize, word_tokenize, wordpunct_tokenize } from "../index";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");

/** Deterministic LCG so every run exercises the same corpus. */
function generator(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
}

// Adversarial atoms: contractions, punctuation runs, unicode, emoji,
// combining marks, CJK, RTL, control whitespace, currency, abbrevs.
const ATOMS = [
  "can't", "won't", "it's", "y'all", "o'clock", "rock'n'roll",
  "Dr.", "Mr.", "U.S.", "N.Y.", "e.g.", "i.e.", "Ph.D.", "etc.", "vs.",
  "$3.88", "€42,50", "12:30", "3.14", "1e-3", "99%", "#hashtag", "@user",
  "hello-world", "well--known", "end...", "!!", "?!", "::", "—", "–",
  "\"quoted\"", "'single'", "“curly”", "‘curly’", "(paren)", "[bracket]",
  "{brace}", "<angle>", "a/b", "x&y", "n=1", "a+b", "foo_bar",
  "http://x.co", "www.test.org", "a@b.com", "file.txt", "C:\\path",
  "café", "naïve", "résumé", "Zürich", "é", "ñ", "😀", "🎉", "👍🏽",
  "中文字符", "日本語", "한국어", "العربية", "עברית", "Ελληνικά", "Русский",
  " ", "  ", "\t", "\n", "\r\n", "\n\n", " ", " ",
  "0", "42", "1,000,000", "3rd", "21st", "1990s", "'90s",
  "WORD", "CamelCase", "sPoNgEbOb", "...",".",",",";",":","'","\"","-",
];

function corpus(seed: number, count: number): string[] {
  const random = generator(seed);
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const parts: string[] = [];
    const n = 1 + (random() % 24);
    for (let j = 0; j < n; j++) parts.push(ATOMS[random() % ATOMS.length]!);
    texts.push(parts.join(""));
  }
  return texts;
}

type OracleRow = { word: unknown; sent: unknown; wp: unknown };
type JsRow = { word: unknown; sent: unknown; wp: unknown };

function jsRun(text: string): JsRow {
  const run = (fn: (t: string) => string[]) => {
    try { return fn(text); } catch (err) {
      return ["__ERR__", (err as Error).name, (err as Error).message];
    }
  };
  return { word: run(word_tokenize), sent: run(sent_tokenize), wp: run(wordpunct_tokenize) };
}

function normalize(row: OracleRow | JsRow): OracleRow {
  // Error markers: python names (LookupError) vs JS (Error) — compare only
  // that both raised on the same tokenizer, plus token arrays verbatim.
  const map = (v: unknown) => Array.isArray(v) && v[0] === "__ERR__" ? ["__ERR__"] : v;
  return { word: map(row.word), sent: map(row.sent), wp: map(row.wp) };
}

test("seeded adversarial strings: tokenizers match NLTK 3.10.3", { timeout: 120_000 }, () => {
  const texts = corpus(0xC0FFEE, 400);
  const res = spawnSync("python3", ["test/tokenize_fuzz_oracle.py"], {
    input: JSON.stringify(texts),
    encoding: "utf-8",
    env: { ...process.env, NLTK_DATA, PYTHONHASHSEED: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  const oracle = JSON.parse(res.stdout) as OracleRow[];
  expect(oracle.length).toBe(texts.length);
  const mismatches: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const js = normalize(jsRun(texts[i]!));
    const py = normalize(oracle[i]!);
    for (const key of ["word", "sent", "wp"] as const) {
      if (JSON.stringify(js[key]) !== JSON.stringify(py[key])) {
        mismatches.push(
          `input=${JSON.stringify(texts[i])} kind=${key}\n` +
          `  js=${JSON.stringify(js[key])}\n  py=${JSON.stringify(py[key])}`,
        );
      }
    }
  }
  expect(mismatches.join("\n\n")).toBe("");
});
