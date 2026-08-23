/**
 * Paice stemming-performance statistics (port of nltk.metrics.paice).
 *
 * Counts Understemming Index (UI), Overstemming Index (OI),
 * Stemming Weight (SW) and Error-rate relative to truncation (ERRT)
 * for a stemming algorithm, given words grouped by real lemmas and by
 * algorithm stems.
 *
 * Reference: Chris D. Paice (1994). An evaluation method for stemming
 * algorithms. In Proceedings of SIGIR, 42–50.
 */

function getWordsFromDictionary(lemmas: Record<string, string[]>): Set<string> {
  const words = new Set<string>();
  for (const lemma of Object.keys(lemmas)) {
    for (const w of lemmas[lemma] ?? []) words.add(w);
  }
  return words;
}

/** Group words by stems defined by truncating them at the given length. */
function truncate(words: Iterable<string>, cutlength: number): Record<string, Set<string>> {
  const stems: Record<string, Set<string>> = {};
  for (const word of words) {
    const stem = word.slice(0, cutlength);
    if (!(stem in stems)) stems[stem] = new Set();
    stems[stem]!.add(word);
  }
  return stems;
}

type Pt = [number, number];

/** Intersection between two line segments defined by coordinate pairs. */
function countIntersection(l1: [Pt, Pt], l2: [Pt, Pt]): Pt {
  const [x1, y1] = l1[0];
  const [x2, y2] = l1[1];
  const [x3, y3] = l2[0];
  const [x4, y4] = l2[1];

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (denominator === 0.0) {
    // Lines are parallel: they must be on the y-axis (see NLTK note).
    if (x1 === x2 && x2 === x3 && x3 === x4 && x4 === 0.0) return [0.0, y4!];
  }

  const numX = (x1! * y2! - y1! * x2!) * (x3! - x4!) - (x1! - x2!) * (x3! * y4! - y3! * x4!);
  const numY = (x1! * y2! - y1! * x2!) * (y3! - y4!) - (y1! - y2!) * (x3! * y4! - y3! * x4!);
  return [numX / denominator, numY / denominator];
}

/** Unachieved-merge / wrongly-merged totals contributed by one lemma group. */
function calculateCut(
  lemmawords: string[],
  stems: Record<string, Set<string>>,
): [umt: number, wmt: number] {
  let umt = 0.0;
  let wmt = 0.0;
  const lemmaSet = new Set(lemmawords);
  for (const stem of Object.keys(stems)) {
    const stemWords = stems[stem]!;
    const cut = [...lemmaSet].filter((w) => stemWords.has(w));
    if (cut.length > 0) {
      const cutcount = cut.length;
      const stemcount = stemWords.size;
      umt += cutcount * (lemmawords.length - cutcount);
      wmt += cutcount * (stemcount - cutcount);
    }
  }
  return [umt, wmt];
}

function calculate(
  lemmas: Record<string, string[]>,
  stems: Record<string, Set<string>>,
): [gumt: number, gdmt: number, gwmt: number, gdnt: number] {
  let n = 0;
  for (const lemma of Object.keys(lemmas)) n += (lemmas[lemma] ?? []).length;

  let gdmt = 0.0;
  let gdnt = 0.0;
  let gumt = 0.0;
  let gwmt = 0.0;

  for (const lemma of Object.keys(lemmas)) {
    const words = lemmas[lemma] ?? [];
    const lemmacount = words.length;
    gdmt += lemmacount * (lemmacount - 1);
    gdnt += lemmacount * (n - lemmacount);
    const [umt, wmt] = calculateCut(words, stems);
    gumt += umt;
    gwmt += wmt;
  }

  // Each pair counted twice — divide by two.
  return [gumt / 2, gdmt / 2, gwmt / 2, gdnt / 2];
}

function indexes(
  gumt: number,
  gdmt: number,
  gwmt: number,
  gdnt: number,
): [ui: number, oi: number, sw: number] {
  const ui = gdmt === 0 ? 0.0 : gumt / gdmt;
  const oi = gdnt === 0 ? 0.0 : gwmt / gdnt;
  let sw: number;
  if (ui === 0) {
    sw = oi === 0.0 ? Number.NaN : Number.POSITIVE_INFINITY;
  } else {
    sw = oi / ui;
  }
  return [ui, oi, sw];
}

function getDerivative(point: Pt): number {
  // Slope of the line from origo through `point` (NLTK _get_derivative).
  const [x, y] = point;
  try {
    return y! / x!;
  } catch {
    throw new Error("Derivative is infinite.");
  }
}

export class Paice {
  readonly lemmas: Record<string, string[]>;
  stems: Record<string, string[]>;
  coords: Array<[number, number]> = [];
  gumt = 0;
  gdmt = 0;
  gwmt = 0;
  gdnt = 0;
  ui = 0;
  oi = 0;
  sw = 0;
  errt: number = Number.NaN;

  constructor(lemmas: Record<string, string[]>, stems: Record<string, string[]>) {
    this.lemmas = lemmas;
    this.stems = stems;
    this.update();
  }

  private truncationIndexes(words: Set<string>, cutlength: number): [number, number] {
    const truncated = truncate(words, cutlength);
    const [gumt, gdmt, gwmt, gdnt] = calculate(this.lemmas, truncated);
    const [ui, oi] = indexes(gumt, gdmt, gwmt, gdnt);
    return [ui, oi];
  }

  private truncationCoordinates(cutlength = 0): Array<[number, number]> {
    const words = getWordsFromDictionary(this.lemmas);
    let maxlength = 0;
    for (const w of words) if (w.length > maxlength) maxlength = w.length;

    const coords: Array<[number, number]> = [];
    while (cutlength <= maxlength) {
      const pair = this.truncationIndexes(words, cutlength);
      if (!coords.some(([a, b]) => a === pair[0] && b === pair[1])) coords.push(pair);
      if (pair[0] === 0.0 && pair[1] === 0.0) return coords;
      if (coords.length >= 2 && pair[0] > 0.0) {
        const derivative1 = getDerivative(coords[coords.length - 2]!);
        const derivative2 = getDerivative(coords[coords.length - 1]!);
        if (derivative1 >= this.sw && this.sw >= derivative2) return coords;
      }
      cutlength += 1;
    }
    return coords;
  }

  private computeErrt(): number {
    this.coords = this.truncationCoordinates();
    const hasOrigo = this.coords.some(([a, b]) => a === 0.0 && b === 0.0);
    if (hasOrigo) {
      if (this.ui !== 0.0 || this.oi !== 0.0) return Number.POSITIVE_INFINITY;
      return Number.NaN;
    }
    if (this.ui === 0.0 && this.oi === 0.0) return 0.0;
    const last2 = this.coords.slice(-2) as [[number, number], [number, number]];
    const intersection = countIntersection([[0, 0], [this.ui, this.oi]], last2);
    const op = Math.sqrt(this.ui ** 2 + this.oi ** 2);
    const ot = Math.sqrt(intersection[0]! ** 2 + intersection[1]! ** 2);
    return op / ot;
  }

  /** Recompute all statistics (call after mutating `stems`). */
  update(): void {
    const stemSets: Record<string, Set<string>> = {};
    for (const k of Object.keys(this.stems)) stemSets[k] = new Set(this.stems[k] ?? []);
    const [gumt, gdmt, gwmt, gdnt] = calculate(this.lemmas, stemSets);
    this.gumt = gumt;
    this.gdmt = gdmt;
    this.gwmt = gwmt;
    this.gdnt = gdnt;
    const [ui, oi, sw] = indexes(gumt, gdmt, gwmt, gdnt);
    this.ui = ui;
    this.oi = oi;
    this.sw = sw;
    this.errt = this.computeErrt();
  }
}
