/**
 * Port of nltk.misc.wordfinder — word search grid generator.
 */

export function revword(word: string): string {
  return Math.floor(Math.random() * 2) === 0 ? word.split("").reverse().join("") : word;
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
): WordFinderResult {
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill("") as string[]);
  const used: string[] = [];

  for (const raw of sorted) {
    const save = raw.trim().toUpperCase();
    const word = revword(save);
    for (let attempt = 0; attempt < attempts; attempt++) {
      const r = Math.floor(Math.random() * (word.length + 1));
      const dir = [1, 2, 3, 4][Math.floor(Math.random() * 4)]!;
      let x = Math.floor(Math.random() * (rows + 1));
      let y = Math.floor(Math.random() * (cols + 1));
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
      if (grid[i]![j] === "") grid[i]![j] = alph[Math.floor(Math.random() * alph.length)]!;
    }
  }
  return { grid, used };
}

/** Corpus-dependent demo — throws helpful error (requires nltk.corpus.words). */
export function word_finder(): never {
  throw new Error(
    `nltk.misc.wordfinder.word_finder: requires NLTK corpus 'words' (nltk.corpus.words). ` +
    `In bun_nltk, call wordfinder(wordList) directly with your own word list. ` +
    `Install NLTK data via nltk.download('words') in Python to use the demo word list.`
  );
}
