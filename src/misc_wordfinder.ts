/**
 * Port of nltk.misc.wordfinder — word search grid generator.
 */
import { PyRandom } from "./py_random";
import { WordListCorpusReader } from "./corpus_text_readers";
import { find as dataFind } from "./data";
import type { PrintSink } from "./ext_pure";
import { pyPrint } from "./ext_pure";

// Stand-in for Python's entropy-seeded module-global `random`.
const moduleRandom = new PyRandom(((Date.now() >>> 0) ^ (Math.floor(Math.random() * 0x100000000))) >>> 0);

/** nltk.misc.wordfinder.revword — random.randint(1,2) == 1 → reversed
 * (randbelow(2) drawing 0 makes the randint 1). */
export function revword(word: string, rng: PyRandom = moduleRandom): string {
  return rng.randbelow(2) === 0 ? word.split("").reverse().join("") : word;
}

/** nltk.misc.wordfinder.step — signature keeps the unused x,y params verbatim. */
export function step(
  word: string,
  x: number,
  xf: (i: number) => number,
  y: number,
  yf: (i: number) => number,
  grid: string[][],
): boolean {
  void x;
  void y;
  for (let i = 0; i < word.length; i++) {
    const xi = xf(i), yi = yf(i);
    if (grid[xi]![yi] !== "" && grid[xi]![yi] !== word[i]) return false;
  }
  for (let i = 0; i < word.length; i++) {
    const xi = xf(i), yi = yf(i);
    grid[xi]![yi] = word[i]!;
  }
  return true;
}

/** nltk.misc.wordfinder.check — direction 1-4 placement test; returns undefined (not false) for unknown dirs like nltk returns None. */
export function check(
  word: string,
  dir: number,
  x: number,
  y: number,
  grid: string[][],
  rows: number,
  cols: number,
): boolean | undefined {
  void rows;
  if (dir === 1) {
    if (x - word.length < 0 || y - word.length < 0) return false;
    return step(word, x, (i) => x - i, y, (i) => y - i, grid);
  } else if (dir === 2) {
    if (x - word.length < 0) return false;
    return step(word, x, (i) => x - i, y, (_i) => y, grid);
  } else if (dir === 3) {
    if (x - word.length < 0 || y + (word.length - 1) >= cols) return false;
    return step(word, x, (i) => x - i, y, (i) => y + i, grid);
  } else if (dir === 4) {
    if (y - word.length < 0) return false;
    return step(word, x, (_i) => x, y, (i) => y - i, grid);
  }
  return undefined;
}

export interface WordFinderResult {
  grid: string[][];
  used: string[];
}

export function wordfinder(
  words: string[],
  rows = 20,
  cols = 20,
  attempts = 50,
  alph = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  rng: PyRandom = moduleRandom,
): WordFinderResult {
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill("") as string[]);
  const used: string[] = [];

  // RNG consumption mirrors Python draw-for-draw: revword randint(0,1), then
  // per attempt randint(0,len), choice(dir), randint(0,rows), randint(0,cols).
  for (const raw of sorted) {
    const save = raw.trim().toUpperCase();
    const word = revword(save, rng);
    for (let attempt = 0; attempt < attempts; attempt++) {
      const r = rng.randbelow(word.length + 1);
      const dir = [1, 2, 3, 4][rng.randbelow(4)]!;
      let x = rng.randbelow(rows + 1);
      let y = rng.randbelow(cols + 1);
      if (dir === 1) { x += r; y += r; }
      else if (dir === 2) { x += r; }
      else if (dir === 3) { x += r; y -= r; }
      else if (dir === 4) { y += r; }
      if (x >= 0 && x < rows && y >= 0 && y < cols) {
        if (check(word, dir, x, y, grid, rows, cols)) {
          used.push(save);
          break;
        }
      }
    }
  }

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (grid[i]![j] === "") grid[i]![j] = alph[rng.randbelow(alph.length)]!;
    }
  }
  return { grid, used };
}

/** nltk.misc.wordfinder.word_finder — words-corpus grid demo. `out` is a raw
 * PrintSink (the demo owns every byte it prints, prompts included). */
export function word_finder(out: PrintSink, rng: PyRandom = moduleRandom): void {
  const reader = new WordListCorpusReader(dataFind("corpora/words"), "(?!README|\\.).*");
  let wordlist = reader.words();
  rng.shuffle(wordlist);
  wordlist = wordlist.slice(0, 200);
  wordlist = wordlist.filter((w) => w.length >= 3 && w.length <= 12);
  const { grid, used } = wordfinder(wordlist, 20, 20, 50, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", rng);

  out("Word Finder\n\n");
  for (const row of grid) {
    out(row.map((c) => c + " ").join("") + "\n");
  }
  out("\n");
  for (let i = 0; i < used.length; i++) pyPrint(out, `${i + 1}:`, used[i]);
}
