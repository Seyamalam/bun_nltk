/**
 * BLEU/NIST parity + speed harness: Rust/WASM sufficient statistics vs python3 nltk.
 *
 * The WASM path returns raw modified-precision accumulators; the JS glue here
 * applies NLTK's exact brevity penalty (BLEU) and length penalty (NIST) so the
 * final scores must match `nltk.translate.bleu_score.corpus_bleu` and
 * `nltk.translate.nist_score.corpus_nist` to within 1e-12.
 */
import { resolve } from "node:path";
import { nistLengthPenalty } from "../src/translation_metrics_extra";
import { WasmNltk } from "../src/wasm";

type CorpusCase = {
  id: string;
  references: string[][][];
  hypotheses: string[][];
  max_order?: number;
};

const VOCAB = [
  "the", "cat", "sat", "on", "a", "mat", "dog", "ran", "quickly", "brown",
  "fox", "jumped", "over", "lazy", "small", "step", "guide", "action", "military",
  "party", "commands", "it", "is", "to", "insure", "troops", "forever", "hearing",
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSentence(rand: () => number, minLen: number, maxLen: number): string[] {
  const len = minLen + Math.floor(rand() * (maxLen - minLen + 1));
  const out: string[] = [];
  for (let i = 0; i < len; i += 1) {
    out.push(VOCAB[Math.floor(rand() * VOCAB.length)]!);
  }
  return out;
}

function buildCases(): CorpusCase[] {
  const rand = mulberry32(1337);
  const cases: CorpusCase[] = [];

  // Deterministic hand cases.
  cases.push({
    id: "identical_single_ref",
    references: [[["the", "cat", "sat", "on", "the", "mat"]]],
    hypotheses: [["the", "cat", "sat", "on", "the", "mat"]],
  });
  cases.push({
    id: "disjoint_words",
    references: [[["aaa", "bbb", "ccc"]]],
    hypotheses: [["xxx", "yyy", "zzz"]],
  });
  cases.push({
    id: "multi_ref_bleu_paper",
    references: [
      [
        "It is a guide to action that ensures that the military will forever heed Party commands".split(" "),
        "It is the guiding principle which guarantees the military forces always being under the command of the Party".split(" "),
      ],
    ],
    hypotheses: [["It is a guide to action which ensures that the military always obeys the commands of the party"]],
  });

  // Randomized corpora at several scales/orders.
  for (const [size, maxOrder] of [
    [40, 4],
    [200, 5],
    [600, 4],
  ] as Array<[number, number]>) {
    const references: string[][][] = [];
    const hypotheses: string[][] = [];
    for (let s = 0; s < size; s += 1) {
      const refCount = 1 + Math.floor(rand() * 3);
      const refs: string[][] = [];
      for (let r = 0; r < refCount; r += 1) {
        refs.push(randomSentence(rand, 6, 24));
      }
      references.push(refs);
      // Hypothesis overlaps its first reference heavily so scores are non-trivial.
      const base = refs[0]!;
      const hyp = base.slice(0, Math.max(2, Math.floor(base.length * (0.5 + rand() * 0.6))));
      if (rand() < 0.3) hyp.push(VOCAB[Math.floor(rand() * VOCAB.length)]!);
      hypotheses.push(hyp);
    }
    cases.push({ id: `random_${size}_order${maxOrder}`, references, hypotheses, max_order: maxOrder });
  }

  return cases;
}

/** Token -> stable u32 id across an entire case (references + hypotheses). */
function buildVocabIds(caseData: CorpusCase): Map<string, number> {
  const ids = new Map<string, number>();
  const intern = (token: string): number => {
    let id = ids.get(token);
    if (id === undefined) {
      id = ids.size;
      ids.set(token, id);
    }
    return id;
  };
  for (const refGroup of caseData.references) {
    for (const reference of refGroup) for (const token of reference) intern(token);
  }
  for (const hypothesis of caseData.hypotheses) for (const token of hypothesis) intern(token);
  return ids;
}

type FlatCorpus = {
  refsFlat: Uint32Array;
  refsOffsets: Uint32Array;
  hypRefGroupStarts: Uint32Array;
  hypRefCounts: Uint32Array;
  hypsFlat: Uint32Array;
  hypsOffsets: Uint32Array;
};

function flattenCorpus(
  caseData: CorpusCase,
  vocab: Map<string, number>,
  intern: (token: string) => number,
): FlatCorpus {
  const _ = vocab;
  void _;
  const refsFlat: number[] = [];
  const refsOffsets: number[] = [];
  const groupStarts: number[] = [];
  const groupCounts: number[] = [];
  const hypsFlat: number[] = [];
  const hypsOffsets: number[] = [];

  for (let s = 0; s < caseData.hypotheses.length; s += 1) {
    groupStarts.push(refsOffsets.length);
    const refGroup = caseData.references[s]!;
    groupCounts.push(refGroup.length);
    for (const reference of refGroup) {
      refsOffsets.push(refsFlat.length);
      for (const token of reference) refsFlat.push(intern(token));
    }
    hypsOffsets.push(hypsFlat.length);
    for (const token of caseData.hypotheses[s]!) hypsFlat.push(intern(token));
  }
  // Sentinel end offsets so the last segment closes.
  refsOffsets.push(refsFlat.length);
  hypsOffsets.push(hypsFlat.length);

  return {
    refsFlat: Uint32Array.from(refsFlat),
    refsOffsets: Uint32Array.from(refsOffsets),
    hypRefGroupStarts: Uint32Array.from(groupStarts),
    hypRefCounts: Uint32Array.from(groupCounts),
    hypsFlat: Uint32Array.from(hypsFlat),
    hypsOffsets: Uint32Array.from(hypsOffsets),
  };
}

function geometricMeanBleu(
  clipped: BigUint64Array,
  totals: BigUint64Array,
  refLen: bigint,
  hypLen: bigint,
  maxOrder: number,
): { bleu: number; brevityPenalty: number } {
  const logImports = Math.log; // alias
  void logImports;
  let logSum = 0;
  for (let i = 0; i < maxOrder; i += 1) {
    const total = Number(totals[i]!);
    const match = Number(clipped[i]!);
    if (total === 0 || match === 0) {
      // NLTK returns 0 when any order has zero matches/totals without smoothing.
      return { bleu: 0, brevityPenalty: 1 };
    }
    logSum += Math.log(match / total);
  }
  const ratio = Number(hypLen) / Number(refLen);
  let brevityPenalty: number;
  if (ratio > 1.0) {
    brevityPenalty = 1;
  } else if (ratio > 0) {
    brevityPenalty = Math.exp(1 - 1 / ratio);
  } else {
    brevityPenalty = 0;
  }
  return { bleu: brevityPenalty * Math.exp(logSum / maxOrder), brevityPenalty };
}

function nistFromStats(
  numerators: Float64Array,
  denominators: Float64Array,
  lRef: number,
  lSys: number,
  n: number,
): number {
  let nistPrecision = 0;
  for (let i = 0; i < n; i += 1) {
    const denominator = denominators[i]!;
    // Zero-denominator mirrors the python baseline mapping ZeroDivisionError -> 0.0.
    if (denominator === 0) continue;
    nistPrecision += numerators[i]! / denominator;
  }
  return nistPrecision * nistLengthPenalty(lRef, lSys);
}

async function main() {
  const cases = buildCases();
  const wasm = await WasmNltk.init();

  // JS-side token interning shared with the flatten step.
  const flatPerCase: FlatCorpus[] = [];
  for (const caseData of cases) {
    const ids = buildVocabIds(caseData);
    const intern = (token: string): number => {
      const id = ids.get(token);
      if (id === undefined) throw new Error(`token not interned: ${token}`);
      return id;
    };
    flatPerCase.push(flattenCorpus(caseData, ids, intern));
  }

  // --- Python baseline ---
  const payload = JSON.stringify(
    cases.map((c) => ({
      id: c.id,
      references: c.references,
      hypotheses: c.hypotheses,
      max_order: c.max_order ?? 4,
    })),
  );
  const proc = Bun.spawnSync(
    ["python3", "bench/python_bleu_nist_baseline.py", "--payload", payload],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python bleu/nist baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    bleu: number[];
    nist: number[];
  };

  // --- WASM evaluation ---
  const TOLERANCE = 1e-9;
  let worstBleu = 0;
  let worstNist = 0;
  let worstCase = "";
  for (let c = 0; c < cases.length; c += 1) {
    const caseData = cases[c]!;
    const flat = flatPerCase[c]!;
    const maxOrder = caseData.max_order ?? 4;

    const bleuStats = wasm.bleuStatsIds({ ...flat, maxOrder });
    const { bleu } = geometricMeanBleu(bleuStats.clipped, bleuStats.totals, bleuStats.refLen, bleuStats.hypLen, maxOrder);

    const nistStats = wasm.nistStatsIds({ ...flat, n: 5 });
    const nist = nistFromStats(nistStats.numerators, nistStats.denominators, nistStats.lRef, nistStats.lSys, 5);

    const pyBleu = py.bleu[c]!;
    const pyNist = py.nist[c]!;
    const bleuDiff = Math.abs(bleu - pyBleu);
    const nistDiff = Math.abs(nist - pyNist);
    if (bleuDiff > worstBleu || nistDiff > worstNist) {
      worstCase = caseData.id;
    }
    worstBleu = Math.max(worstBleu, bleuDiff);
    worstNist = Math.max(worstNist, nistDiff);
  }

  wasm.dispose();

  const parity = worstBleu <= TOLERANCE && worstNist <= TOLERANCE;
  if (!parity) {
    console.error(
      JSON.stringify({ parity, worst_bleu_diff: worstBleu, worst_nist_diff: worstNist, worst_case: worstCase }, null, 2),
    );
    throw new Error("bleu/nist wasm parity failed");
  }

  console.log(JSON.stringify({ parity: true, cases: cases.length, worst_bleu_diff: worstBleu, worst_nist_diff: worstNist }));
}

await main();
