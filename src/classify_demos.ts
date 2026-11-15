// Port of nltk.classify.util demo helpers (names_demo, partial_names_demo,
// accuracy) plus python-faithful NaiveBayesClassifier /
// PositiveNaiveBayesClassifier internals (ELEProbDist feature probs) used by
// nltk.classify.{naivebayes,positivenaivebayes,maxent,decisiontree}.demo.

import { WordListCorpusReader } from "./corpus_text_readers";
import { find } from "./data";
import { DictionaryProbDist, ELEProbDist, MLEProbDist, entropy } from "./probability";
import { FreqDist } from "./freqdist";
import { PyRandom } from "./py_random";
import { ConditionalExponentialClassifier as NltkMaxentClassifier } from "./maxent_nltk";
import { withConsoleLog } from "./demos";
import { pyPrint, pyRepr, pyStr, type PrintSink } from "./ext_pure";

export type FeatureValue = string | number | boolean | null;
export type Featureset = Record<string, FeatureValue>;
export type LabeledFeatureset = [Featureset, unknown];

/** nltk.classify.util.names_demo_features. */
export function names_demo_features(name: string): Featureset {
  const features: Featureset = {};
  features["alwayson"] = true;
  features["startswith"] = name[0]!.toLowerCase();
  features["endswith"] = name[name.length - 1]!.toLowerCase();
  const lower = name.toLowerCase();
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    features[`count(${letter})`] = lower.split(letter).length - 1;
    features[`has(${letter})`] = lower.includes(letter);
  }
  return features;
}
export const namesDemoFeatures = names_demo_features;

/** nltk.classify.util.binary_names_demo_features. */
export function binary_names_demo_features(name: string): Featureset {
  const features: Featureset = {};
  const lower = name.toLowerCase();
  features["alwayson"] = true;
  features["startswith(vowel)"] = "aeiouy".includes(lower[0]!);
  features["endswith(vowel)"] = "aeiouy".includes(lower[lower.length - 1]!);
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    features[`count(${letter})`] = lower.split(letter).length - 1;
    features[`has(${letter})`] = lower.includes(letter);
    features[`startswith(${letter})`] = letter === lower[0];
    features[`endswith(${letter})`] = letter === lower[lower.length - 1];
  }
  return features;
}
export const binaryNamesDemoFeatures = binary_names_demo_features;

/** nltk.classify.accuracy — fraction of correctly classified featuresets. */
export function accuracy(
  classifier: { classify(fs: Featureset): unknown },
  gold: Array<[Featureset, unknown]>,
): number {
  let correct = 0;
  for (const [fs, label] of gold) if (classifier.classify(fs) === label) correct++;
  return correct / gold.length;
}

/** Python %.*f float formatting — toFixed except |x|>=1e21 where python
 * prints the exact decimal expansion (JS goes exponential). */
export function pyFixed(x: number, prec = 4): string {
  if (!Number.isFinite(x)) return x < 0 ? "-inf" : x > 0 ? "inf" : "nan";
  if (Math.abs(x) < 1e21) return x.toFixed(prec);
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = x;
  const bits = new BigUint64Array(buf)[0]!;
  const sign = (bits >> 63n) !== 0n ? "-" : "";
  const mant = (bits & ((1n << 52n) - 1n)) | (1n << 52n);
  const exp = Number((bits >> 52n) & 0x7ffn) - 1075;
  let intPart: bigint;
  let fracScale: bigint;
  if (exp >= 0) { intPart = mant << BigInt(exp); fracScale = 1n; }
  else { intPart = mant >> BigInt(-exp); fracScale = 1n << BigInt(-exp); }
  // fractional digits from the remaining mantissa bits
  const fracBits = exp >= 0 ? 0n : mant & (fracScale - 1n);
  let fracDigits = "";
  let frac = fracBits;
  for (let i = 0; i < prec + 1; i++) {
    frac *= 10n;
    const d = frac / fracScale;
    fracDigits += d.toString();
    frac -= d * fracScale;
  }
  let digits = fracDigits.slice(0, prec);
  let carry = fracDigits[prec]! >= "5" ? 1n : 0n;
  // round half-up at the requested precision
  if (carry) {
    let intC = intPart;
    let fracC = digits.split("").map(Number);
    for (let i = fracC.length - 1; i >= 0 && carry; i--) {
      fracC[i]! += Number(carry);
      carry = BigInt(Math.floor(fracC[i]! / 10));
      fracC[i]! %= 10;
    }
    intC += carry;
    intPart = intC;
    digits = fracC.join("");
  }
  return `${sign}${intPart.toString()}.${digits}`;
}

/** Python `"%6.4f" % x`. */
const f6 = (x: number): string => pyFixed(x, 4).padStart(6);

function names(): { male: string[]; female: string[] } {
  const corpus = new WordListCorpusReader(find("corpora/names"), ["male.txt", "female.txt"]);
  return {
    male: corpus.words("male.txt") as string[],
    female: corpus.words("female.txt") as string[],
  };
}

/** nltk.classify.util.names_demo — train on 5000 shuffled names, evaluate. */
export function names_demo(
  trainer: (train: Array<[Featureset, unknown]>, ...rest: unknown[]) => ClassifierLike,
  features: (name: string) => Featureset = names_demo_features,
  out: PrintSink = (s) => process.stdout.write(s),
  trainerArgs: unknown[] = [],
): ClassifierLike {
  const { male, female } = names();
  const namelist: Array<[string, string]> = [
    ...male.map((n) => [n, "male"] as [string, string]),
    ...female.map((n) => [n, "female"] as [string, string]),
  ];

  const rng = new PyRandom(123456);
  rng.shuffle(namelist);
  const train = namelist.slice(0, 5000);
  const test = namelist.slice(5000, 5500);

  pyPrint(out, "Training classifier...");
  const classifier = trainer(train.map(([n, g]) => [features(n), g] as [Featureset, unknown]), ...trainerArgs);

  pyPrint(out, "Testing classifier...");
  const acc = accuracy(classifier, test.map(([n, g]) => [features(n), g] as [Featureset, unknown]));
  pyPrint(out, `Accuracy: ${f6(acc)}`);

  try {
    const testFeaturesets = test.map(([n]) => features(n));
    const pdists = classifier.prob_classify_many(testFeaturesets);
    const ll = test.map(([, gold], i) => pdists[i]!.logprob(gold));
    pyPrint(out, `Avg. log likelihood: ${f6(ll.reduce((a, b) => a + b, 0) / test.length)}`);
    pyPrint(out, "");
    pyPrint(out, "Unseen Names      P(Male)  P(Female)\n" + "-".repeat(40));
    for (let i = 0; i < 5; i++) {
      const [name, gender] = test[i]!;
      const pdist = pdists[i]!;
      const pm = pdist.prob("male");
      const pf = pdist.prob("female");
      const line = gender === "male"
        ? `  ${name.padEnd(15)} *${pm.toFixed(4)}   ${pf.toFixed(4)}`
        : `  ${name.padEnd(15)}  ${pm.toFixed(4)}  *${pf.toFixed(4)}`;
      pyPrint(out, line);
    }
  } catch (e) {
    if (!(e instanceof NotImplementedError)) throw e;
  }

  return classifier;
}
export const namesDemo = names_demo;

/** nltk.classify.util.partial_names_demo — PNB positive/unlabeled variant. */
export function partial_names_demo(
  trainer: (positive: Featureset[], unlabeled: Featureset[]) => ClassifierLike,
  features: (name: string) => Featureset = names_demo_features,
  out: PrintSink = (s) => process.stdout.write(s),
): ClassifierLike {
  const { male: maleNames, female: femaleNames } = names();
  const rng = new PyRandom(654321);
  rng.shuffle(maleNames);
  rng.shuffle(femaleNames);

  const positive = maleNames.slice(0, 2000).map(features);
  const unlabeled = [...maleNames.slice(2000, 2500), ...femaleNames.slice(0, 500)].map(features);
  const test: Array<[string, boolean]> = [
    ...maleNames.slice(2500, 2750).map((n) => [n, true] as [string, boolean]),
    ...femaleNames.slice(500, 750).map((n) => [n, false] as [string, boolean]),
  ];
  rng.shuffle(test);

  pyPrint(out, "Training classifier...");
  const classifier = trainer(positive, unlabeled);

  pyPrint(out, "Testing classifier...");
  const acc = accuracy(classifier, test.map(([n, m]) => [features(n), m] as [Featureset, unknown]));
  pyPrint(out, `Accuracy: ${f6(acc)}`);

  try {
    const testFeaturesets = test.map(([n]) => features(n));
    const pdists = classifier.prob_classify_many(testFeaturesets);
    const ll = test.map(([, gold], i) => pdists[i]!.logprob(gold));
    pyPrint(out, `Avg. log likelihood: ${f6(ll.reduce((a, b) => a + b, 0) / test.length)}`);
    pyPrint(out, "");
    pyPrint(out, "Unseen Names      P(Male)  P(Female)\n" + "-".repeat(40));
    // upstream NLTK 3.10.3: `zip(test, pdists)[:5]` — TypeError in py3.
    throw new TypeError("'zip' object is not subscriptable");
  } catch (e) {
    if (!(e instanceof NotImplementedError)) throw e;
  }

  return classifier;
}
export const partialNamesDemo = partial_names_demo;

export interface ClassifierLike {
  classify(fs: Featureset): unknown;
  prob_classify_many(fss: Featureset[]): Array<DictionaryProbDist<unknown>>;
  showMostInformativeFeatures?(out: PrintSink, n?: number): void;
}

class NotImplementedError extends Error {}

const sampleKey = (v: unknown): string => JSON.stringify(v);

/** Python-faithful nltk.classify.naivebayes.NaiveBayesClassifier. */
export class PyNaiveBayesClassifier implements ClassifierLike {
  constructor(
    private readonly labelProbdist: ELEProbDist<unknown>,
    private readonly featureProbdist: Map<string, { label: unknown; fname: string; dist: { prob(s: unknown): number; logprob(s: unknown): number; samples(): Iterable<unknown> } }>,
  ) {}

  labels(): unknown[] {
    return [...this.labelProbdist.samples()];
  }

  static train(
    labeledFeaturesets: Iterable<[Featureset, unknown]>,
    estimator: (fd: FreqDist<unknown>, bins?: number) => ELEProbDist<unknown> = (fd, bins) => new ELEProbDist(fd, bins),
  ): PyNaiveBayesClassifier {
    const labelFreqdist = new FreqDist<unknown>();
    const featureFreqdist = new Map<string, FreqDist<unknown>>();
    const featureFreqKey = new Map<string, { label: unknown; fname: string }>();
    const featureValues = new Map<string, Set<string>>();
    const featureValueByKey = new Map<string, Map<string, unknown>>();
    const fnames = new Set<string>();

    for (const [featureset, label] of labeledFeaturesets) {
      labelFreqdist.inc(label);
      for (const [fname, fval] of Object.entries(featureset)) {
        const key = `${sampleKey(label)}${fname}`;
        let fd = featureFreqdist.get(key);
        if (!fd) { fd = new FreqDist<unknown>(); featureFreqdist.set(key, fd); featureFreqKey.set(key, { label, fname }); }
        fd.inc(fval);
        let vset = featureValues.get(fname);
        if (!vset) { vset = new Set(); featureValues.set(fname, vset); featureValueByKey.set(fname, new Map()); }
        vset.add(sampleKey(fval));
        featureValueByKey.get(fname)!.set(sampleKey(fval), fval);
        fnames.add(fname);
      }
    }

    for (const label of labelFreqdist.samples()) {
      const numSamples = labelFreqdist.count(label);
      for (const fname of fnames) {
        const key = `${sampleKey(label)}${fname}`;
        let fd = featureFreqdist.get(key);
        if (!fd) { fd = new FreqDist<unknown>(); featureFreqdist.set(key, fd); featureFreqKey.set(key, { label, fname }); }
        const missing = numSamples - fd.N();
        if (missing > 0) {
          fd.inc(null, missing);
          featureValues.get(fname)!.add(sampleKey(null));
          featureValueByKey.get(fname)!.set(sampleKey(null), null);
        }
      }
    }

    const labelProbdist = estimator(labelFreqdist);
    const featureProbdist = new Map<string, { label: unknown; fname: string; dist: ELEProbDist<unknown> }>();
    for (const [key, fd] of featureFreqdist) {
      const { label, fname } = featureFreqKey.get(key)!;
      featureProbdist.set(key, { label, fname, dist: estimator(fd, featureValues.get(fname)!.size) });
    }
    return new PyNaiveBayesClassifier(labelProbdist, featureProbdist);
  }

  classify(fs: Featureset): unknown {
    return this.probClassify(fs).max();
  }

  probClassify(fs: Featureset): DictionaryProbDist<unknown> {
    const featureset = { ...fs };
    for (const fname of Object.keys(featureset)) {
      let seen = false;
      for (const label of this.labels()) if (this.featureProbdist.has(`${sampleKey(label)}${fname}`)) { seen = true; break; }
      if (!seen) delete featureset[fname];
    }

    const logprob = new Map<unknown, number>();
    for (const label of this.labels()) {
      let lp = this.labelProbdist.logprob(label);
      for (const [fname, fval] of Object.entries(featureset)) {
        const entry = this.featureProbdist.get(`${sampleKey(label)}${fname}`);
        lp += entry ? entry.dist.logprob(fval) : -1e300;
      }
      logprob.set(label, lp);
    }
    return new DictionaryProbDist<unknown>(logprob, true, true);
  }

  prob_classify(fs: Featureset): DictionaryProbDist<unknown> { return this.probClassify(fs); }

  prob_classify_many(fss: Featureset[]): DictionaryProbDist<unknown>[] {
    return fss.map((fs) => this.probClassify(fs));
  }

  mostInformativeFeatures(n = 100): Array<[string, unknown]> {
    const features = new Set<string>();
    const featureOf = new Map<string, [string, unknown]>();
    const maxprob = new Map<string, number>();
    const minprob = new Map<string, number>();
    for (const { label: _l, fname, dist } of this.featureProbdist.values()) {
      for (const fval of dist.samples()) {
        const key = fname + "\u0000" + sampleKey(fval);
        features.add(key);
        featureOf.set(key, [fname, fval]);
        const p = dist.prob(fval);
        maxprob.set(key, Math.max(p, maxprob.get(key) ?? 0));
        minprob.set(key, Math.min(p, minprob.get(key) ?? 1));
        if (minprob.get(key) === 0) features.delete(key);
      }
    }
    const sorted = [...features].sort((a, b) => {
      const ka = this.#informativeKey(featureOf.get(a)!, minprob.get(a)! / maxprob.get(a)!);
      const kb = this.#informativeKey(featureOf.get(b)!, minprob.get(b)! / maxprob.get(b)!);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    return sorted.slice(0, n).map((k) => featureOf.get(k)!);
  }
  most_informative_features(n = 100): Array<[string, unknown]> { return this.mostInformativeFeatures(n); }

  /** python tuple compare key for most_informative_features. */
  #informativeKey(feature: [string, unknown], ratio: number): string {
    const [fname, fval] = feature;
    // (ratio, fname, fval in [None,False,True], str(fval).lower()) ascending
    const inBoolClass = fval === null || typeof fval === "boolean" ? 1 : 0;
    const strFval = fval === null ? "None" : typeof fval === "boolean" ? (fval ? "True" : "False") : String(fval);
    // numeric prefix sortable + string remainder
    return `${ratio.toFixed(20)}|${fname}|${inBoolClass}|${strFval.toLowerCase()}`;
  }

  showMostInformativeFeatures(out: PrintSink, n = 10): void {
    const cpdist = this.featureProbdist;
    pyPrint(out, "Most Informative Features");
    for (const [fname, fval] of this.mostInformativeFeatures(n)) {
      const labelprob = (l: unknown): number => cpdist.get(`${sampleKey(l)}${fname}`)!.dist.prob(fval);
      const labels = (this.labels() as unknown[])
        .filter((l) => {
          const e = cpdist.get(`${sampleKey(l)}${fname}`);
          return e !== undefined && [...e.dist.samples()].some((s) => sampleKey(s) === sampleKey(fval));
        })
        .sort((a, b) => {
          // python sorted(key=(-labelprob(l), l), reverse=True): ascending
          // labelprob; ties order labels descending.
          const d = labelprob(a) - labelprob(b);
          if (d !== 0) return d;
          return pyStr(a) > pyStr(b) ? -1 : pyStr(a) < pyStr(b) ? 1 : 0;
        });
      if (labels.length === 1) continue;
      const l0 = labels[0], l1 = labels[labels.length - 1]!;
      const ratio = labelprob(l0) === 0 ? "INF" : (labelprob(l1) / labelprob(l0)).toFixed(1).padStart(8);
      const l1s = pyStr(l1).slice(0, 6), l0s = pyStr(l0).slice(0, 6);
      pyPrint(out, `${fname.padStart(24)} = ${pyRepr(fval).padEnd(14)} ${l1s.padStart(6)} : ${l0s.padEnd(6)} = ${ratio} : 1.0`);
    }
  }
  show_most_informative_features(n = 10): void {
    this.showMostInformativeFeatures((s) => process.stdout.write(s), n);
  }
}

/** Python-faithful nltk.classify.positivenaivebayes.PositiveNaiveBayesClassifier. */
export class PyPositiveNaiveBayesClassifier extends PyNaiveBayesClassifier {
  static trainPositive(
    positiveFeaturesets: Iterable<Featureset>,
    unlabeledFeaturesets: Iterable<Featureset>,
    positiveProbPrior = 0.5,
    estimator: (fd: FreqDist<unknown>, bins?: number) => ELEProbDist<unknown> = (fd, bins) => new ELEProbDist(fd, bins),
  ): PyPositiveNaiveBayesClassifier {
    const positiveFeatureFreqdist = new Map<string, FreqDist<unknown>>();
    const unlabeledFeatureFreqdist = new Map<string, FreqDist<unknown>>();
    const featureValues = new Map<string, Set<string>>();
    const featureValueByKey = new Map<string, Map<string, unknown>>();
    const fnames = new Set<string>();

    const record = (map: Map<string, FreqDist<unknown>>) => (fs: Featureset) => {
      for (const [fname, fval] of Object.entries(fs)) {
        let fd = map.get(fname);
        if (!fd) { fd = new FreqDist<unknown>(); map.set(fname, fd); }
        fd.inc(fval);
        let vset = featureValues.get(fname);
        if (!vset) { vset = new Set(); featureValues.set(fname, vset); featureValueByKey.set(fname, new Map()); }
        vset.add(sampleKey(fval));
        featureValueByKey.get(fname)!.set(sampleKey(fval), fval);
        fnames.add(fname);
      }
    };

    let numPositive = 0;
    for (const fs of positiveFeaturesets) { record(positiveFeatureFreqdist)(fs); numPositive++; }
    let numUnlabeled = 0;
    for (const fs of unlabeledFeaturesets) { record(unlabeledFeatureFreqdist)(fs); numUnlabeled++; }

    for (const fname of fnames) {
      const fd = positiveFeatureFreqdist.get(fname) ?? new FreqDist<unknown>();
      positiveFeatureFreqdist.set(fname, fd);
      fd.inc(null, numPositive - fd.N());
      featureValues.get(fname)!.add(sampleKey(null));
      featureValueByKey.get(fname)!.set(sampleKey(null), null);
    }
    for (const fname of fnames) {
      const fd = unlabeledFeatureFreqdist.get(fname) ?? new FreqDist<unknown>();
      unlabeledFeatureFreqdist.set(fname, fd);
      fd.inc(null, numUnlabeled - fd.N());
    }

    const negativeProbPrior = 1 - positiveProbPrior;
    const labelProbdist = new DictionaryProbDist<unknown>(new Map([[true, positiveProbPrior], [false, negativeProbPrior]]));

    const featureProbdist = new Map<string, { label: unknown; fname: string; dist: { prob(s: unknown): number; logprob(s: unknown): number; samples(): Iterable<unknown> } }>();
    for (const [fname, fd] of positiveFeatureFreqdist) {
      featureProbdist.set(`${sampleKey(true)}${fname}`, { label: true, fname, dist: estimator(fd, featureValues.get(fname)!.size) });
    }
    for (const [fname, fd] of unlabeledFeatureFreqdist) {
      const globalProbdist = estimator(fd, featureValues.get(fname)!.size);
      const negativeFeatureProbs = new Map<unknown, number>();
      for (const [vkey, fval] of featureValueByKey.get(fname)!) {
        void vkey;
        const prob = (globalProbdist.prob(fval) - positiveProbPrior * featureProbdist.get(`${sampleKey(true)}${fname}`)!.dist.prob(fval)) / negativeProbPrior;
        negativeFeatureProbs.set(fval, Math.max(prob, 0));
      }
      featureProbdist.set(`${sampleKey(false)}${fname}`, { label: false, fname, dist: new DictionaryProbDist<unknown>(negativeFeatureProbs, false, true) });
    }
    return new PyPositiveNaiveBayesClassifier(labelProbdist as unknown as ELEProbDist<unknown>, featureProbdist);
  }
}

// ---------------- the four demos ----------------

/** nltk.classify.naivebayes.demo. */
export function naivebayes_demo(out: PrintSink = (s) => process.stdout.write(s)): void {
  const classifier = names_demo((train) => PyNaiveBayesClassifier.train(train), names_demo_features, out);
  classifier.showMostInformativeFeatures!(out, 10);
}
export const naivebayesDemo = naivebayes_demo;

/** nltk.classify.positivenaivebayes.demo. */
export function positivenaivebayes_demo(out: PrintSink = (s) => process.stdout.write(s)): void {
  const classifier = partial_names_demo(
    (positive, unlabeled) => PyPositiveNaiveBayesClassifier.trainPositive(positive, unlabeled),
    names_demo_features, out,
  );
  classifier.showMostInformativeFeatures!(out, 10);
}
export const positiveNaiveBayesDemo = positivenaivebayes_demo;

/** nltk.classify.maxent.demo: names_demo(MaxentClassifier.train).
 * The IIS trace prints via console.log — route it into `out`. */
export function maxent_demo(out: PrintSink = (s) => process.stdout.write(s)): void {
  withConsoleLog(out, () => {
    names_demo((train) => NltkMaxentClassifier.train(train as never) as never, names_demo_features, out);
  });
}
export const maxentDemo = maxent_demo;

// ---- nltk.classify.decisiontree -------------------------------------------

/** Python value repr for `== {fval!r}` / `return {label!r}`. */
const dtRepr = (v: unknown): string => pyRepr(v);

/** python `sorted(decisions, key=lambda item: (item[0] in [None,False,True], str(item[0]).lower()))`. */
function dtSortedDecisions(decisions: Map<FeatureValue, PyDecisionTreeClassifier>): Array<[FeatureValue, PyDecisionTreeClassifier]> {
  return [...decisions.entries()].sort(([a], [b]) => {
    const ab = a === null || a === true || a === false ? 1 : 0;
    const bb = b === null || b === true || b === false ? 1 : 0;
    if (ab !== bb) return ab - bb;
    const as_ = pyStr(a).toLowerCase();
    const bs = pyStr(b).toLowerCase();
    return as_ < bs ? -1 : as_ > bs ? 1 : 0;
  });
}

type DTFeatureset = Record<string, FeatureValue>;
type DTLabeled = Array<[DTFeatureset, unknown]>;

/** Faithful port of nltk.classify.decisiontree.DecisionTreeClassifier. */
export class PyDecisionTreeClassifier {
  _label: unknown;
  _fname: string | null;
  _decisions: Map<FeatureValue, PyDecisionTreeClassifier>;
  _default: PyDecisionTreeClassifier | null;

  constructor(label: unknown, fname: string | null = null,
              decisions: Map<FeatureValue, PyDecisionTreeClassifier> | null = null,
              default_: PyDecisionTreeClassifier | null = null) {
    this._label = label;
    this._fname = fname;
    this._decisions = decisions ?? new Map();
    this._default = default_;
  }

  labels(): unknown[] { return [this._label]; }

  prob_classify(_featureset: DTFeatureset): never {
    throw new NotImplementedError();
  }
  prob_classify_many(featuresets: readonly DTFeatureset[]): never[] {
    return featuresets.map((fs) => this.prob_classify(fs));
  }
  probClassify(featureset: DTFeatureset): never { return this.prob_classify(featureset); }

  classify(featureset: DTFeatureset): unknown {
    if (this._fname === null) return this._label;
    const fval = featureset[this._fname] ?? null;
    const decision = this._decisions.get(fval);
    if (decision !== undefined) return decision.classify(featureset);
    if (this._default !== null) return this._default.classify(featureset);
    return this._label;
  }

  error(lfs: DTLabeled): number {
    let errors = 0;
    for (const [featureset, label] of lfs) if (this.classify(featureset) !== label) errors++;
    return errors / lfs.length;
  }

  private static _leaf(lfs: DTLabeled): PyDecisionTreeClassifier {
    const fd = new FreqDist<unknown>();
    for (const [, label] of lfs) fd.inc(label);
    return new PyDecisionTreeClassifier(fd.max());
  }

  private static _binaryStump(featureName: string, featureValue: FeatureValue, lfs: DTLabeled, out: PrintSink): PyDecisionTreeClassifier {
    void out;
    const fd = new FreqDist<unknown>();
    for (const [, label] of lfs) fd.inc(label);
    const label = fd.max();

    const pos = new FreqDist<unknown>();
    const neg = new FreqDist<unknown>();
    for (const [featureset, lbl] of lfs) {
      if ((featureset[featureName] ?? null) === featureValue) pos.inc(lbl);
      else neg.inc(lbl);
    }

    const decisions = new Map<FeatureValue, PyDecisionTreeClassifier>();
    let def: PyDecisionTreeClassifier | null = new PyDecisionTreeClassifier(label);
    if (pos.N() > 0) decisions.set(featureValue, new PyDecisionTreeClassifier(pos.max()));
    if (neg.N() > 0) def = new PyDecisionTreeClassifier(neg.max());
    return new PyDecisionTreeClassifier(label, featureName, decisions, def);
  }

  private static _bestBinaryStump(featureNames: string[], lfs: DTLabeled,
                                  featureValues: Map<string, Set<FeatureValue>>,
                                  verbose: boolean, out: PrintSink): PyDecisionTreeClassifier {
    let best = this._leaf(lfs);
    let bestError = best.error(lfs);
    for (const fname of featureNames) {
      for (const fval of featureValues.get(fname)!) {
        const stump = this._binaryStump(fname, fval, lfs, out);
        const err = stump.error(lfs);
        if (err < bestError) { bestError = err; best = stump; }
      }
    }
    if (verbose) {
      const descr = best._decisions.size > 0
        ? `${best._fname}=${pyStr([...best._decisions.keys()][0])}`
        : "(default)";
      pyPrint(out, `best stump for ${String(lfs.length).padStart(6)} toks uses ${descr.padEnd(20)} err=${bestError.toFixed(4)}`);
    }
    return best;
  }

  static train(lfs: DTLabeled, options: {
    entropy_cutoff?: number; depth_cutoff?: number; support_cutoff?: number;
    binary?: boolean; feature_values?: Map<string, Set<FeatureValue>> | null;
    verbose?: boolean;
  } = {}, out: PrintSink = (s) => process.stdout.write(s)): PyDecisionTreeClassifier {
    const {
      entropy_cutoff = 0.05, depth_cutoff = 100, support_cutoff = 10,
      binary = false, verbose = false,
    } = options;
    let { feature_values = null } = options;

    const featureNames: string[] = [];
    const seenNames = new Set<string>();
    for (const [featureset] of lfs) {
      for (const fname of Object.keys(featureset)) {
        if (!seenNames.has(fname)) { seenNames.add(fname); featureNames.push(fname); }
      }
    }

    if (feature_values === null && binary) {
      feature_values = new Map();
      for (const [featureset] of lfs) {
        for (const [fname, fval] of Object.entries(featureset)) {
          let s = feature_values.get(fname);
          if (!s) { s = new Set(); feature_values.set(fname, s); }
          s.add(fval ?? null);
        }
      }
    }

    if (!binary) throw new Error("non-binary decision trees are not ported");
    if (feature_values === null) throw new Error("binary decision trees require feature_values");
    const tree = this._bestBinaryStump(featureNames, lfs, feature_values, verbose, out);
    tree._refine(lfs, entropy_cutoff, depth_cutoff - 1, support_cutoff, binary, feature_values, verbose, out);
    return tree;
  }

  private _refine(lfs: DTLabeled, entropyCutoff: number, depthCutoff: number,
                  supportCutoff: number, binary: boolean,
                  featureValues: Map<string, Set<FeatureValue>> | null,
                  verbose: boolean, out: PrintSink): void {
    if (lfs.length <= supportCutoff) return;
    if (this._fname === null) return;
    if (depthCutoff <= 0) return;
    for (const [fval] of this._decisions) {
      const fvalLfs = lfs.filter(([fs]) => (fs[this._fname!] ?? null) === fval);
      const fd = new FreqDist<unknown>();
      for (const [, label] of fvalLfs) fd.inc(label);
      if (entropy(new MLEProbDist(fd)) > entropyCutoff) {
        this._decisions.set(fval, PyDecisionTreeClassifier.train(fvalLfs, {
          entropy_cutoff: entropyCutoff, depth_cutoff: depthCutoff,
          support_cutoff: supportCutoff, binary, feature_values: featureValues, verbose,
        }, out));
      }
    }
    if (this._default !== null) {
      const defaultLfs = lfs.filter(([fs]) => !this._decisions.has(fs[this._fname!] ?? null));
      const fd = new FreqDist<unknown>();
      for (const [, label] of defaultLfs) fd.inc(label);
      if (entropy(new MLEProbDist(fd)) > entropyCutoff) {
        this._default = PyDecisionTreeClassifier.train(defaultLfs, {
          entropy_cutoff: entropyCutoff, depth_cutoff: depthCutoff,
          support_cutoff: supportCutoff, binary, feature_values: featureValues, verbose,
        }, out);
      }
    }
  }

  pretty_format(width = 70, prefix = "", depth = 4): string {
    if (this._fname === null) {
      const n = width - prefix.length - 15;
      return `${prefix}${".".repeat(n)} ${this._label}\n`;
    }
    let s = "";
    for (const [fval, result] of dtSortedDecisions(this._decisions)) {
      const hdr = `${prefix}${this._fname}=${pyStr(fval)}? `;
      const n = width - 15 - hdr.length;
      s += `${hdr}${".".repeat(n)} ${result._label}\n`;
      if (result._fname !== null && depth > 1) s += result.pretty_format(width, prefix + "  ", depth - 1);
    }
    if (this._default !== null) {
      const n = width - prefix.length - 21;
      s += `${prefix}else: ${".".repeat(n)} ${this._default._label}\n`;
      if (this._default._fname !== null && depth > 1) s += this._default.pretty_format(width, prefix + "  ", depth - 1);
    }
    return s;
  }
  prettyFormat(width = 70, prefix = "", depth = 4): string { return this.pretty_format(width, prefix, depth); }

  pseudocode(prefix = "", depth = 4): string {
    if (this._fname === null) return `${prefix}return ${dtRepr(this._label)}\n`;
    let s = "";
    for (const [fval, result] of dtSortedDecisions(this._decisions)) {
      s += `${prefix}if ${this._fname} == ${dtRepr(fval)}: `;
      if (result._fname !== null && depth > 1) s += `\n${result.pseudocode(prefix + "  ", depth - 1)}`;
      else s += `return ${dtRepr(result._label)}\n`;
    }
    if (this._default !== null) {
      if (this._decisions.size === 1) {
        s += `${prefix}if ${this._fname} != ${dtRepr([...this._decisions.keys()][0])}: `;
      } else {
        s += `${prefix}else: `;
      }
      if (this._default._fname !== null && depth > 1) s += `\n${this._default.pseudocode(prefix + "  ", depth - 1)}`;
      else s += `return ${dtRepr(this._default._label)}\n`;
    }
    return s;
  }
}

/** nltk.classify.decisiontree.demo. */
export function decisiontree_demo(out: PrintSink = (s) => process.stdout.write(s)): void {
  const classifier = names_demo(
    (train) => PyDecisionTreeClassifier.train(
      train as DTLabeled, { binary: true, verbose: true }, out) as never,
    binary_names_demo_features, out);
  pyPrint(out, (classifier as unknown as PyDecisionTreeClassifier).pretty_format(70, "", 7));
  pyPrint(out, (classifier as unknown as PyDecisionTreeClassifier).pseudocode("", 7));
}
export const decisionTreeDemo = decisiontree_demo;
