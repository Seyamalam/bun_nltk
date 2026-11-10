// Faithful port of nltk.tag.perceptron.AveragedPerceptron + PerceptronTagger
// training machinery (NLTK 3.10.3). The packed-model inference path stays in
// perceptron_tagger.ts; this module owns NLTK-format dict-of-dicts weights,
// the averaged update rule, and the feature extraction contract.

export type PerceptronWeights = Record<string, Record<string, number>>;
export type PerceptronFeatures = Record<string, number>;

// Deterministic Fisher-Yates; NLTK uses global random.shuffle (unseeded), so a
// fixed seed here is an honest reproducibility adaptation.
export function shuffleInPlace<T>(arr: T[], seed: number): void {
  let s = seed >>> 0 || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

export class AveragedPerceptron {
  weights: PerceptronWeights;
  classes = new Set<string>();
  private readonly totals = new Map<string, number>();
  private readonly tstamps = new Map<string, number>();
  i = 0;

  constructor(weights?: PerceptronWeights) {
    this.weights = weights ?? {};
  }

  predict(features: PerceptronFeatures): [string | null, number | null] {
    const scores = new Map<string, number>();
    for (const [feat, value] of Object.entries(features)) {
      if (value === 0) continue;
      const ws = this.weights[feat];
      if (!ws) continue;
      for (const [label, weight] of Object.entries(ws)) {
        scores.set(label, (scores.get(label) ?? 0) + value * weight);
      }
    }
    // NLTK: max(classes, key=lambda label: (scores[label], label)) — score
    // first, then the lexicographically largest label wins ties.
    if (this.classes.size === 0) {
      throw new Error("max() iterable argument is empty");
    }
    let best: string | null = null;
    let bestKey: [number, string] | null = null;
    for (const label of this.classes) {
      const key: [number, string] = [scores.get(label) ?? 0, label];
      if (bestKey === null || key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
        bestKey = key;
        best = label;
      }
    }
    return [best, null];
  }

  update(truth: string, guess: string | null, features: PerceptronFeatures): void {
    const updFeat = (c: string, f: string, w: number, v: number): void => {
      const param = JSON.stringify([f, c]);
      this.totals.set(param, (this.totals.get(param) ?? 0) + (this.i - (this.tstamps.get(param) ?? 0)) * w);
      this.tstamps.set(param, this.i);
      this.weights[f]![c] = w + v;
    };
    this.i += 1;
    if (truth === guess) return;
    for (const f of Object.keys(features)) {
      const weights = (this.weights[f] ??= {});
      updFeat(truth, f, weights[truth] ?? 0, 1);
      updFeat(guess!, f, weights[guess!] ?? 0, -1);
    }
  }

  averageWeights(): void {
    for (const [feat, ws] of Object.entries(this.weights)) {
      const next: Record<string, number> = {};
      for (const [clas, weight] of Object.entries(ws)) {
        const param = JSON.stringify([feat, clas]);
        let total = this.totals.get(param) ?? 0;
        total += (this.i - (this.tstamps.get(param) ?? 0)) * weight;
        const averaged = Math.round((total / this.i) * 1000) / 1000;
        if (averaged) next[clas] = averaged;
      }
      this.weights[feat] = next;
    }
  }

  encodeJsonObj(): PerceptronWeights {
    return this.weights;
  }
}
