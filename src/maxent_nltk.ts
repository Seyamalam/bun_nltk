// Faithful port of nltk.classify.maxent (NLTK 3.10.3).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { BinaryMaxentFeatureEncoding, type MaxentEncodingExample, type MaxentEncodingOptions, type MaxentFeatureMapping, type MaxentFeatureset, type MaxentMappingValue } from "./maxent_feature_encoding.ts";
import { DictionaryProbDist } from "./probability.ts";
import { ClassifierI } from "./api_interfaces.ts";
import { ClassifierBasedPOSTagger } from "./sequential_taggers.ts";
import { find } from "./data.ts";

export type MaxentEncodedVector = Array<[number, number]>;
export interface MaxentEncodingLike {
  encode(featureset: MaxentFeatureset, label: string): MaxentEncodedVector;
  length(): number;
  labels(): string[];
  describe(fid: number): unknown;
}
export type MaxentTrainToks = Iterable<MaxentEncodingExample>;

function pyReprStr(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pyFloatRepr(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "inf" : value < 0 ? "-inf" : "nan";
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

// ---- nltk.classify.maxent.MaxentFeatureEncodingI ----------------------------

export class MaxentFeatureEncodingI {
  encode(_featureset: unknown, _label: string): MaxentEncodedVector {
    throw new Error("NotImplementedError");
  }
  length(): number {
    throw new Error("NotImplementedError");
  }
  labels(): string[] {
    throw new Error("NotImplementedError");
  }
  describe(_fid: number): unknown {
    throw new Error("NotImplementedError");
  }
}

// ---- nltk.classify.maxent.FunctionBackedMaxentFeatureEncoding ---------------

export class FunctionBackedMaxentFeatureEncoding extends MaxentFeatureEncodingI {
  private readonly _func: (featureset: MaxentFeatureset, label: string) => MaxentEncodedVector;
  private readonly _length: number;
  private readonly _labels: string[];
  constructor(
    func: (featureset: MaxentFeatureset, label: string) => MaxentEncodedVector,
    length: number,
    labels: string[],
  ) {
    super();
    this._length = length;
    this._func = func;
    this._labels = labels;
  }
  override encode(featureset: MaxentFeatureset, label: string): MaxentEncodedVector {
    return this._func(featureset, label);
  }
  override length(): number { return this._length; }
  override labels(): string[] { return this._labels; }
  override describe(_fid: number): string { return "no description available"; }
}

// ---- nltk.classify.maxent.GISEncoding ---------------------------------------

export class GISEncoding extends BinaryMaxentFeatureEncoding {
  private _C: number;

  constructor(
    labels: Iterable<string>,
    mapping: MaxentFeatureMapping,
    unseen_features = false,
    alwayson_features = false,
    C: number | null = null,
  ) {
    const entries = [...mapping];
    super(labels, entries, unseen_features, alwayson_features);
    this._C = C ?? new Set(entries.map(([[name]]) => name)).size + 1;
  }

  /** The non-negative constant that all encoded feature vectors will sum to. */
  get C(): number { return this._C; }

  override encode(featureset: MaxentFeatureset, label: string): MaxentEncodedVector {
    const encoding = super.encode(featureset, label) as Array<[number, number]>;
    const baseLength = super.length();
    const total = encoding.reduce((sum, [, value]) => sum + value, 0);
    if (total >= this._C) {
      throw new Error("Correction feature is not high enough!");
    }
    encoding.push([baseLength, this._C - total]);
    return encoding;
  }

  override length(): number { return super.length() + 1; }

  override describe(f_id: number): string {
    if (f_id === super.length()) return `Correction feature (${this._C})`;
    return super.describe(f_id);
  }

  static override train(
    train_toks: MaxentTrainToks,
    count_cutoff = 0,
    labels: Iterable<string> | null = null,
    options: MaxentEncodingOptions = {},
  ): GISEncoding {
    const model = super.train(train_toks, count_cutoff, labels, options) as unknown as GISEncoding;
    // The Rust-side trainer materialized the mapping without informing the
    // JS constructor; recompute C = len({fname for (fname,fval,label) in mapping}) + 1.
    model._C = new Set(model.toJSON().mapping.map(([[name]]) => name)).size + 1;
    return model;
  }
}

// ---- nltk.classify.maxent.TadmEventMaxentFeatureEncoding --------------------

export type TadmMapping = Iterable<readonly [readonly [string, string], number]>;

export class TadmEventMaxentFeatureEncoding extends MaxentFeatureEncodingI {
  private readonly _mapping = new Map<string, number>();
  private readonly _pairs: Array<readonly [string, string]> = [];
  private readonly _labelMapping = new Map<unknown, number>();
  private readonly _labels: string[];

  constructor(labels: Iterable<string>, mapping: TadmMapping, _unseen_features = false, _alwayson_features = false) {
    super();
    this._labels = [...labels];
    for (const [[feature, label], id] of mapping) {
      this._mapping.set(`${feature}\x00${label}`, id);
      this._pairs[id] = [feature, label];
    }
  }

  private pairKey(feature: string, label: string): string { return `${feature}\x00${label}`; }

  override encode(featureset: MaxentFeatureset, label: string): MaxentEncodedVector {
    const encoding: Array<[number, number]> = [];
    for (const [feature, value] of Object.entries(featureset)) {
      const key = this.pairKey(feature, label);
      if (!this._mapping.has(key)) {
        this._mapping.set(key, this._mapping.size);
        this._pairs[this._mapping.get(key)!] = [feature, label];
      }
      if (!this._labelMapping.has(value)) {
        const isInt = typeof value === "number" && Number.isInteger(value) ||
          typeof value === "boolean";
        this._labelMapping.set(value, isInt ? Number(value) : this._labelMapping.size);
      }
      encoding.push([this._mapping.get(key)!, this._labelMapping.get(value)!]);
    }
    return encoding;
  }

  override labels(): string[] { return this._labels; }

  override describe(fid: number): readonly [string, string] | undefined {
    for (const [, id] of this._mapping) {
      if (id === fid) return this._pairs[id];
    }
    return undefined;
  }

  override length(): number { return this._mapping.size; }

  static train(
    train_toks: MaxentTrainToks,
    _count_cutoff = 0,
    labels: Iterable<string> | null = null,
    _options: MaxentEncodingOptions = {},
  ): TadmEventMaxentFeatureEncoding {
    const toks = [...train_toks];
    const labelList = labels === null ? [] : [...labels];
    for (const [, label] of toks) {
      if (!labelList.includes(label)) labelList.push(label);
    }
    const mapping: Array<readonly [readonly [string, string], number]> = [];
    const seen = new Set<string>();
    for (const [featureset] of toks) {
      for (const label of labelList) {
        for (const feature of Object.keys(featureset)) {
          const key = `${feature}\x00${label}`;
          if (!seen.has(key)) {
            seen.add(key);
            mapping.push([[feature, label], mapping.length]);
          }
        }
      }
    }
    return new this(labelList, mapping);
  }
}

// ---- nltk.classify.util helpers (imported by nltk.classify.maxent) ----------

type ProbClassifier = {
  prob_classify(featureset: MaxentFeatureset): { prob(label: string): number; max(): string; samples(): Iterable<string> };
  prob_classify_many(featuresets: readonly MaxentFeatureset[]): Array<{ prob(label: string): number }>;
  classify_many(featuresets: readonly MaxentFeatureset[]): string[];
};

export function classify_log_likelihood(classifier: ProbClassifier, gold: readonly MaxentEncodingExample[]): number {
  const results = classifier.prob_classify_many(gold.map(([fs]) => fs));
  const ll = gold.map(([, l], index) => results[index]!.prob(l));
  return Math.log(ll.reduce((sum, value) => sum + value, 0) / ll.length);
}

export function classify_accuracy(classifier: ProbClassifier, gold: readonly MaxentEncodingExample[]): number {
  const results = classifier.classify_many(gold.map(([fs]) => fs));
  const correct = gold.map(([, l], index) => l === results[index]);
  if (correct.length === 0) return 0;
  return correct.filter(Boolean).length / correct.length;
}

// ---- nltk.classify.maxent.CutoffChecker -------------------------------------

export class CutoffChecker {
  cutoffs: Record<string, number>;
  ll: number | null = null;
  acc: number | null = null;
  iter = 1;

  constructor(cutoffs: Record<string, number>) {
    this.cutoffs = { ...cutoffs };
    if ("min_ll" in cutoffs) cutoffs.min_ll = -Math.abs(cutoffs.min_ll!);
    if ("min_lldelta" in cutoffs) cutoffs.min_lldelta = Math.abs(cutoffs.min_lldelta!);
  }

  check(classifier: ProbClassifier, train_toks: readonly MaxentEncodingExample[]): boolean | undefined {
    const cutoffs = this.cutoffs;
    this.iter += 1;
    if ("max_iter" in cutoffs && this.iter >= cutoffs.max_iter!) {
      return true;
    }
    const new_ll = classify_log_likelihood(classifier, train_toks);
    if (Number.isNaN(new_ll)) return true;
    if ("min_ll" in cutoffs || "min_lldelta" in cutoffs) {
      if ("min_ll" in cutoffs && new_ll >= cutoffs.min_ll!) return true;
      if (
        "min_lldelta" in cutoffs &&
        this.ll &&
        new_ll - this.ll <= Math.abs(cutoffs.min_lldelta!)
      ) {
        return true;
      }
      this.ll = new_ll;
    }
    if ("max_acc" in cutoffs || "min_accdelta" in cutoffs) {
      // NB: faithfully preserves NLTK's use of log_likelihood here.
      const new_acc = classify_log_likelihood(classifier, train_toks);
      if ("max_acc" in cutoffs && new_acc >= cutoffs.max_acc!) return true;
      if (
        "min_accdelta" in cutoffs &&
        this.acc &&
        new_acc - this.acc <= Math.abs(cutoffs.min_accdelta!)
      ) {
        return true;
      }
      this.acc = new_acc;
      return false;
    }
    return undefined;
  }
}

// ---- nltk.classify.maxent.MaxentClassifier == ConditionalExponentialClassifier

export class ConditionalExponentialClassifier extends ClassifierI<MaxentFeatureset, string> {
  static readonly ALGORITHMS = ["GIS", "IIS", "MEGAM", "TADM"];

  private readonly _encoding: MaxentEncodingLike;
  private _weights: number[];
  private readonly _logarithmic: boolean;
  private _mostInformative: number[] | null = null;

  constructor(encoding: MaxentEncodingLike, weights: ArrayLike<number>, logarithmic = true) {
    super();
    if (encoding.length() !== weights.length) throw new Error("AssertionError");
    this._encoding = encoding;
    this._weights = Array.from(weights);
    this._logarithmic = logarithmic;
  }

  get encoding(): MaxentEncodingLike { return this._encoding; }

  override labels(): string[] { return this._encoding.labels(); }

  set_weights(new_weights: ArrayLike<number>): void {
    if (this._encoding.length() !== new_weights.length) throw new Error("AssertionError");
    this._weights = Array.from(new_weights);
  }
  setWeights(new_weights: ArrayLike<number>): void { this.set_weights(new_weights); }

  weights(): number[] { return this._weights; }

  override classify(featureset: MaxentFeatureset): string {
    return this.prob_classify(featureset).max();
  }

  override prob_classify(featureset: MaxentFeatureset): DictionaryProbDist<string> {
    const probDict = new Map<string, number>();
    for (const label of this._encoding.labels()) {
      const featureVector = this._encoding.encode(featureset, label);
      if (this._logarithmic) {
        let total = 0.0;
        for (const [f_id, f_val] of featureVector) total += this._weights[f_id]! * f_val;
        probDict.set(label, total);
      } else {
        let prod = 1.0;
        for (const [f_id, f_val] of featureVector) prod *= this._weights[f_id]! ** f_val;
        probDict.set(label, prod);
      }
    }
    return new DictionaryProbDist(probDict, this._logarithmic, true);
  }
  override probClassify(featureset: MaxentFeatureset): DictionaryProbDist<string> {
    return this.prob_classify(featureset);
  }
  override classify_many(featuresets: readonly MaxentFeatureset[]): string[] {
    return featuresets.map((fs) => this.classify(fs));
  }
  override prob_classify_many(featuresets: readonly MaxentFeatureset[]): DictionaryProbDist<string>[] {
    return featuresets.map((fs) => this.prob_classify(fs));
  }
  override classifyMany(featuresets: readonly MaxentFeatureset[]): string[] { return this.classify_many(featuresets); }
  override probClassifyMany(featuresets: readonly MaxentFeatureset[]): DictionaryProbDist<string>[] { return this.prob_classify_many(featuresets); }

  explain(featureset: MaxentFeatureset, columns = 4): void {
    const descrWidth = 50;
    const pdist = this.prob_classify(featureset);
    const labels = [...pdist.samples()]
      .sort((left, right) => pdist.prob(right) - pdist.prob(left))
      .slice(0, columns);
    console.log(
      "  Feature".padEnd(descrWidth) +
      labels.map((label) => String(label).slice(0, 7).padStart(8)).join(""),
    );
    console.log("  " + "-".repeat(descrWidth - 2 + 8 * labels.length));
    const sums = new Map<string, number>(labels.map((label) => [label, 0]));
    labels.forEach((label, index) => {
      const featureVector = [...this._encoding.encode(featureset, label)]
        .sort((left, right) => Math.abs(this._weights[right[0]]!) - Math.abs(this._weights[left[0]]!));
      for (const [f_id, f_val] of featureVector) {
        const score = this._logarithmic ? this._weights[f_id]! * f_val : this._weights[f_id]! ** f_val;
        let descr = String(this._encoding.describe(f_id)).split(" and label is ")[0]!;
        descr += ` (${f_val})`;
        if (descr.length > 47) descr = `${descr.slice(0, 44)}...`;
        console.log(`  ${descr.padEnd(descrWidth - 2)}${" ".repeat(index * 8)}${score.toFixed(3).padStart(8)}`);
        sums.set(label, sums.get(label)! + score);
      }
    });
    console.log("  " + "-".repeat(descrWidth - 1 + 8 * labels.length));
    console.log("  TOTAL:".padEnd(descrWidth) + labels.map((label) => sums.get(label)!.toFixed(3).padStart(8)).join(""));
    console.log("  PROBS:".padEnd(descrWidth) + labels.map((label) => pdist.prob(label).toFixed(3).padStart(8)).join(""));
  }

  most_informative_features(n: number | null = 10): number[] {
    if (this._mostInformative === null) {
      this._mostInformative = this._weights
        .map((_, fid) => fid)
        .sort((left, right) => Math.abs(this._weights[right]!) - Math.abs(this._weights[left]!));
    }
    return this._mostInformative.slice(0, n === null ? undefined : n);
  }
  mostInformativeFeatures(n: number | null = 10): number[] { return this.most_informative_features(n); }

  show_most_informative_features(n = 10, show: "all" | "neg" | "pos" = "all"): void {
    let fids = this.most_informative_features(null);
    if (show === "pos") fids = fids.filter((fid) => this._weights[fid]! > 0);
    else if (show === "neg") fids = fids.filter((fid) => this._weights[fid]! < 0);
    for (const fid of fids.slice(0, n)) {
      console.log(`${this._weights[fid]!.toFixed(3).padStart(8)} ${this._encoding.describe(fid)}`);
    }
  }
  showMostInformativeFeatures(n = 10, show: "all" | "neg" | "pos" = "all"): void {
    this.show_most_informative_features(n, show);
  }

  override toString(): string {
    return `<ConditionalExponentialClassifier: ${this._encoding.labels().length} labels, ${this._encoding.length()} features>`;
  }

  static train(
    train_toks: MaxentTrainToks,
    options: {
      algorithm?: string | null;
      trace?: number;
      encoding?: MaxentEncodingLike | null;
      labels?: Iterable<string> | null;
      gaussian_prior_sigma?: number;
    } & Record<string, unknown> = {},
  ): ConditionalExponentialClassifier {
    const { algorithm = null, trace = 3, encoding = null, labels = null, gaussian_prior_sigma: _sigma = 0, ...cutoffs } = options;
    const CUTOFF_KEYS = new Set([
      "max_iter", "min_ll", "min_lldelta", "max_acc", "min_accdelta",
      "count_cutoff", "norm", "explicit", "bernoulli",
    ]);
    for (const key of Object.keys(cutoffs)) {
      if (!CUTOFF_KEYS.has(key)) throw new TypeError(`Unexpected keyword arg ${pyReprStr(key)}`);
    }
    const alg = (algorithm ?? "iis").toLowerCase();
    if (alg === "iis") {
      return train_maxent_classifier_with_iis(train_toks, { trace, encoding, labels, ...cutoffs });
    }
    if (alg === "gis") {
      return train_maxent_classifier_with_gis(train_toks, { trace, encoding, labels, ...cutoffs });
    }
    if (alg === "megam") {
      throw new Error("train_maxent_classifier_with_megam() requires the external megam binary, which is not bundled");
    }
    throw new Error(`Unknown algorithm ${algorithm}`);
  }
}

// ---- nltk.classify.maxent fcount/nfmap/delta helpers ------------------------

export function calculate_empirical_fcount(
  train_toks: MaxentTrainToks,
  encoding: MaxentEncodingLike,
): Float64Array {
  const fcount = new Float64Array(encoding.length());
  for (const [tok, label] of train_toks) {
    for (const [index, val] of encoding.encode(tok, label)) {
      fcount[index]! += val;
    }
  }
  return fcount;
}

export function calculate_estimated_fcount(
  classifier: ProbClassifier,
  train_toks: MaxentTrainToks,
  encoding: MaxentEncodingLike,
): Float64Array {
  const fcount = new Float64Array(encoding.length());
  for (const [tok] of train_toks) {
    const pdist = classifier.prob_classify(tok);
    for (const label of pdist.samples()) {
      const prob = pdist.prob(label);
      for (const [fid, fval] of encoding.encode(tok, label)) {
        fcount[fid]! += prob * fval;
      }
    }
  }
  return fcount;
}

export function calculate_nfmap(
  train_toks: MaxentTrainToks,
  encoding: MaxentEncodingLike,
): Map<number, number> {
  const nfset = new Set<number>();
  for (const [tok] of train_toks) {
    for (const label of encoding.labels()) {
      let nf = 0;
      for (const [, val] of encoding.encode(tok, label)) nf += val;
      nfset.add(nf);
    }
  }
  const nfmap = new Map<number, number>();
  let index = 0;
  for (const nf of nfset) nfmap.set(nf, index++);
  return nfmap;
}

export function calculate_deltas(
  train_toks: MaxentTrainToks,
  classifier: ProbClassifier,
  unattested: ReadonlySet<number> | readonly number[],
  ffreq_empirical: ArrayLike<number>,
  nfmap: ReadonlyMap<number, number>,
  nfarray: ArrayLike<number>,
  nftranspose: ArrayLike<number> | ArrayLike<ArrayLike<number>>,
  encoding: MaxentEncodingLike,
): Float64Array {
  const NEWTON_CONVERGE = 1e-12;
  const MAX_NEWTON = 300;
  const toks = [...train_toks];
  const length = encoding.length();
  const deltas = new Float64Array(length).fill(1);

  // A[nf][id] = sum ( p(fs) * p(label|fs) * f(fs,label) )
  // over all label,fs s.t. num_features[label,fs]=nf
  const A: Float64Array[] = [];
  for (let i = 0; i < nfmap.size; i++) A.push(new Float64Array(length));

  for (const [tok] of toks) {
    const dist = classifier.prob_classify(tok);
    for (const label of encoding.labels()) {
      const featureVector = encoding.encode(tok, label);
      let nf = 0;
      for (const [, val] of featureVector) nf += val;
      const row = A[nfmap.get(nf)!]!;
      for (const [id, val] of featureVector) {
        row[id]! += dist.prob(label) * val;
      }
    }
  }
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < length; j++) A[i]![j]! /= toks.length;
  }

  const getNf = (x: number): number => {
    const entry = (nftranspose as ArrayLike<number> | ArrayLike<ArrayLike<number>>)[x];
    return Array.isArray(entry) || ArrayBuffer.isView(entry) ? (entry as ArrayLike<number>)[0]! : nfarray[x]!;
  };

  const sum1 = new Float64Array(length);
  const sum2 = new Float64Array(length);
  const unattestedSet = unattested instanceof Set ? unattested : new Set(unattested);
  for (let rangenum = 0; rangenum < MAX_NEWTON; rangenum++) {
    sum1.fill(0);
    sum2.fill(0);
    for (let x = 0; x < A.length; x++) {
      const nf = getNf(x);
      const row = A[x]!;
      for (let i = 0; i < length; i++) {
        const expNfDelta = 2 ** (nf * deltas[i]!);
        sum1[i]! += expNfDelta * row[i]!;
        sum2[i]! += nf * expNfDelta * row[i]!;
      }
    }
    for (const fid of unattestedSet) sum2[fid]! += 1;

    let absDelta = 0;
    let absError = 0;
    for (let i = 0; i < length; i++) {
      deltas[i]! -= (ffreq_empirical[i]! - sum1[i]!) / -sum2[i]!;
      absDelta += Math.abs(deltas[i]!);
      absError += Math.abs(ffreq_empirical[i]! - sum1[i]!);
    }
    const n_error = absError / absDelta;
    if (n_error < NEWTON_CONVERGE) return deltas;
  }
  return deltas;
}

// ---- nltk.classify.maxent trainers ------------------------------------------

export type MaxentTrainOptions = {
  trace?: number;
  encoding?: MaxentEncodingLike | null;
  labels?: Iterable<string> | null;
} & Record<string, unknown>;

function traceHeader(maxIter: number, trace: number): void {
  if (trace > 0) console.log(`  ==> Training (${maxIter} iterations)`);
  if (trace > 2) {
    console.log();
    console.log("      Iteration    Log Likelihood    Accuracy");
    console.log("      ---------------------------------------");
  }
}

function traceIteration(checker: CutoffChecker, classifier: ProbClassifier, toks: readonly MaxentEncodingExample[], trace: number): void {
  if (trace > 2) {
    const ll = checker.ll || classify_log_likelihood(classifier, toks);
    const acc = checker.acc || classify_accuracy(classifier, toks);
    const iternum = checker.iter;
    console.log(`     ${String(iternum).padStart(9)}    ${ll.toFixed(5).padStart(14)}    ${acc.toFixed(3).padStart(9)}`);
  }
}

function traceFinal(classifier: ProbClassifier, toks: readonly MaxentEncodingExample[], trace: number): void {
  if (trace > 2) {
    const ll = classify_log_likelihood(classifier, toks);
    const acc = classify_accuracy(classifier, toks);
    console.log(`         Final    ${ll.toFixed(5).padStart(14)}    ${acc.toFixed(3).padStart(9)}`);
  }
}

export function train_maxent_classifier_with_gis(
  train_toks: MaxentTrainToks,
  options: MaxentTrainOptions = {},
): ConditionalExponentialClassifier {
  const { trace = 3, encoding = null, labels = null, ...rest } = options;
  const cutoffs: Record<string, number> = { max_iter: 100 };
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === "number") cutoffs[key] = value;
  }
  const cutoffchecker = new CutoffChecker(cutoffs);

  const toks = [...train_toks];
  const enc = (encoding ?? GISEncoding.train(toks, 0, labels)) as MaxentEncodingLike & { C?: number };
  if (typeof enc.C !== "number") {
    throw new TypeError(
      "The GIS algorithm requires an encoding that " +
      "defines C (e.g., GISEncoding).",
    );
  }
  const Cinv = 1.0 / enc.C;

  const empirical_fcount = calculate_empirical_fcount(toks, enc);
  const unattested = new Set<number>();
  for (let i = 0; i < empirical_fcount.length; i++) {
    if (empirical_fcount[i] === 0) unattested.add(i);
  }

  const weights = Array.from<number>({ length: empirical_fcount.length }).fill(0);
  for (const fid of unattested) weights[fid] = Number.NEGATIVE_INFINITY;
  const classifier = new ConditionalExponentialClassifier(enc, weights);

  const log_empirical_fcount = new Float64Array(empirical_fcount.length);
  for (let i = 0; i < empirical_fcount.length; i++) log_empirical_fcount[i] = Math.log2(empirical_fcount[i]!);

  traceHeader(cutoffs.max_iter!, trace);
  while (true) {
    traceIteration(cutoffchecker, classifier, toks, trace);
    const estimated_fcount = calculate_estimated_fcount(classifier, toks, enc);
    for (const fid of unattested) estimated_fcount[fid]! += 1;
    const w = classifier.weights();
    for (let i = 0; i < w.length; i++) {
      w[i]! += (log_empirical_fcount[i]! - Math.log2(estimated_fcount[i]!)) * Cinv;
    }
    classifier.set_weights(w);
    if (cutoffchecker.check(classifier, toks)) break;
  }
  traceFinal(classifier, toks, trace);
  return classifier;
}

export function train_maxent_classifier_with_iis(
  train_toks: MaxentTrainToks,
  options: MaxentTrainOptions = {},
): ConditionalExponentialClassifier {
  const { trace = 3, encoding = null, labels = null, ...rest } = options;
  const cutoffs: Record<string, number> = { max_iter: 100 };
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === "number") cutoffs[key] = value;
  }
  const cutoffchecker = new CutoffChecker(cutoffs);

  const toks = [...train_toks];
  const enc = encoding ?? BinaryMaxentFeatureEncoding.train(toks, 0, labels);

  const empirical_ffreq = calculate_empirical_fcount(toks, enc);
  for (let i = 0; i < empirical_ffreq.length; i++) empirical_ffreq[i]! /= toks.length;

  const nfmap = calculate_nfmap(toks, enc);
  const nfarray = [...nfmap.entries()].sort((left, right) => left[1] - right[1]).map(([nf]) => nf);

  const unattested = new Set<number>();
  for (let i = 0; i < empirical_ffreq.length; i++) {
    if (empirical_ffreq[i] === 0) unattested.add(i);
  }

  const weights = Array.from<number>({ length: empirical_ffreq.length }).fill(0);
  for (const fid of unattested) weights[fid] = Number.NEGATIVE_INFINITY;
  const classifier = new ConditionalExponentialClassifier(enc, weights);

  traceHeader(cutoffs.max_iter!, trace);
  while (true) {
    traceIteration(cutoffchecker, classifier, toks, trace);
    const deltas = calculate_deltas(toks, classifier, unattested, empirical_ffreq, nfmap, nfarray, nfarray, enc);
    const w = classifier.weights();
    for (let i = 0; i < w.length; i++) w[i]! += deltas[i]!;
    classifier.set_weights(w);
    if (cutoffchecker.check(classifier, toks)) break;
  }
  traceFinal(classifier, toks, trace);
  return classifier;
}

// ---- nltk.classify.megam / tadm file IO -------------------------------------

export interface MaxentStreamLike { write(text: string): unknown; }

function writeMegamFeatures(vector: MaxentEncodedVector, stream: MaxentStreamLike, bernoulli: boolean): void {
  if (vector.length === 0) {
    throw new Error("MEGAM classifier requires the use of an always-on feature.");
  }
  for (const [fid, fval] of vector) {
    if (bernoulli) {
      if (fval === 1) stream.write(` ${fid}`);
      else if (fval !== 0) {
        throw new Error("If bernoulli=True, then allfeatures must be binary.");
      }
    } else {
      stream.write(` ${fid} ${fval}`);
    }
  }
}

export function write_megam_file(
  train_toks: MaxentTrainToks,
  encoding: MaxentEncodingLike & { cost?: (featureset: MaxentFeatureset, label: string, l: string) => number },
  stream: MaxentStreamLike,
  bernoulli = true,
  explicit = true,
): void {
  const labels = encoding.labels();
  const labelnum = new Map<string, number>(labels.map((label, index) => [label, index]));
  for (const [featureset, label] of train_toks) {
    if (typeof encoding.cost === "function") {
      stream.write(labels.map((l) => String(encoding.cost!(featureset, label, l))).join(":"));
    } else {
      stream.write(`${labelnum.get(label)}`);
    }
    if (!explicit) {
      writeMegamFeatures(encoding.encode(featureset, label), stream, bernoulli);
    } else {
      for (const l of labels) {
        stream.write(" #");
        writeMegamFeatures(encoding.encode(featureset, l), stream, bernoulli);
      }
    }
    stream.write("\n");
  }
}

export function parse_megam_weights(s: string, features_count: number, explicit = true): Float64Array {
  if (!explicit) throw new Error("AssertionError");
  const weights = new Float64Array(features_count);
  for (const line of s.trim().split("\n")) {
    if (line.trim()) {
      const [fid, weight] = line.split(/\s+/);
      weights[Number.parseInt(fid!, 10)] = Number.parseFloat(weight!);
    }
  }
  return weights;
}

export function write_tadm_file(
  train_toks: MaxentTrainToks,
  encoding: MaxentEncodingLike,
  stream: MaxentStreamLike,
): void {
  const labels = encoding.labels();
  for (const [featureset, label] of train_toks) {
    stream.write(`${labels.length}\n`);
    for (const known_label of labels) {
      const v = encoding.encode(featureset, known_label);
      stream.write(`${label === known_label ? 1 : 0} ${v.length} ${v.map((u) => `${u[0]} ${u[1]}`).join(" ")}\n`);
    }
  }
}

export function parse_tadm_weights(paramfile: Iterable<string> | string): Float64Array {
  const lines = typeof paramfile === "string" ? paramfile.split("\n") : paramfile;
  const weights: number[] = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped) weights.push(Number.parseFloat(stripped));
  }
  return Float64Array.from(weights);
}

// ---- nltk.tabdata codecs + maxent param load/save ----------------------------

function txt2list(text: string): string[] {
  return text.split("\n").map((line) => line.replace(/\n$/, "")).filter((line, index, arr) => !(index === arr.length - 1 && line === ""));
}
function tab2tups(text: string): string[][] {
  return txt2list(text).map((line) => line.split("\t"));
}
function tab2ivdict(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [a, b] of tab2tups(text)) result[a!] = Number.parseInt(b!, 10);
  return result;
}
function tupkey2dict(text: string): Array<[[string, MaxentMappingValue, string], number]> {
  const rep = (a: string, b: string): MaxentMappingValue => {
    if (a === "wordlen") return Number.parseInt(b, 10);
    if (b === "repr-None") return null;
    if (b === "repr-True") return true;
    if (b === "repr-False") return false;
    return b;
  };
  return tab2tups(text).map(([a, b, c, d]) => [[a!, rep(a!, b!), c!], Number.parseInt(d!, 10)]);
}
function list2txt(items: Iterable<string>): string {
  return [...items].join("\n");
}
function tups2tab(rows: Iterable<readonly string[]>): string {
  return [...rows].map((row) => row.join("\t")).join("\n");
}
function ivdict2tab(d: ReadonlyMap<string, number> | Record<string, number>): string {
  const entries = d instanceof Map ? [...d.entries()] : Object.entries(d);
  return tups2tab(entries.map(([a, b]) => [a, String(b)]));
}
function tupdict2tab(d: Iterable<readonly [readonly [string, MaxentMappingValue, string], number]>): string {
  const rep = (a: string, b: MaxentMappingValue): string => {
    if (a === "wordlen") return String(b);
    if (b === true) return "repr-True";
    if (b === false) return "repr-False";
    if (b === null || b === undefined) return "repr-None";
    return String(b);
  };
  return tups2tab([...d].map(([[a, b, c], id]) => [a, rep(a, b), c, String(id)]));
}

export type MaxentParams = readonly [Float64Array, Array<[[string, MaxentMappingValue, string], number]>, string[], Record<string, number>];

export function load_maxent_params(tab_dir: string): MaxentParams {
  const wgt = Float64Array.from(txt2list(readFileSync(join(tab_dir, "weights.txt"), "utf8")).map(Number));
  const mpg = tupkey2dict(readFileSync(join(tab_dir, "mapping.tab"), "utf8"));
  const lab = txt2list(readFileSync(join(tab_dir, "labels.txt"), "utf8"));
  const aon = tab2ivdict(readFileSync(join(tab_dir, "alwayson.tab"), "utf8"));
  return [wgt, mpg, lab, aon];
}

export function save_maxent_params(
  params: MaxentParams | { wgt: ArrayLike<number>; mpg: Iterable<readonly [readonly [string, MaxentMappingValue, string], number]>; lab: string[]; aon: ReadonlyMap<string, number> | Record<string, number> },
  tab_dir = "/tmp",
): void {
  const tuple = Array.isArray(params) ? params as MaxentParams : null;
  const wgt = tuple ? tuple[0] : (params as { wgt: ArrayLike<number> }).wgt;
  const mpg = tuple ? tuple[1] : (params as { mpg: Iterable<readonly [readonly [string, MaxentMappingValue, string], number]> }).mpg;
  const lab = tuple ? tuple[2] : (params as { lab: string[] }).lab;
  const aon = tuple ? tuple[3] : (params as { aon: ReadonlyMap<string, number> | Record<string, number> }).aon;
  if (!existsSync(tab_dir)) mkdirSync(tab_dir);
  console.log(`Saving Maxent parameters in ${tab_dir}`);
  writeFileSync(join(tab_dir, "weights.txt"), list2txt(Array.from(wgt as ArrayLike<number>, (value) => pyFloatRepr(value))));
  writeFileSync(join(tab_dir, "mapping.tab"), tupdict2tab(mpg));
  writeFileSync(join(tab_dir, "labels.txt"), list2txt(lab));
  writeFileSync(join(tab_dir, "alwayson.tab"), ivdict2tab(aon));
}

export function maxent_pos_tagger(): ClassifierBasedPOSTagger {
  const tab_dir = find("taggers/maxent_treebank_pos_tagger_tab/english/") as string;
  const [wgt, mpg, lab, aon] = load_maxent_params(tab_dir);
  const mc = new ConditionalExponentialClassifier(
    new BinaryMaxentFeatureEncoding(lab, mpg, false, Object.keys(aon).length > 0),
    wgt,
  );
  return new ClassifierBasedPOSTagger({ classifier: mc });
}
