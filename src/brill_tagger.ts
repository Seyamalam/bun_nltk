import {
  type GoldSentence,
  type SequentialBackoffTagger,
  type TaggedToken,
  type UntaggedSentence,
} from "./sequential_taggers";

export type BrillToken = [word: string, tag: string];
export type BrillSentence = BrillToken[];
export type RuleEffect = -1 | 0 | 1;

export interface InitialTaggerLike {
  tag(tokens: UntaggedSentence): Array<[string, string | null]>;
}

function pyRepr(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${escaped}'`;
}

function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function posKey(sentnum: number, wordnum: number): number {
  return sentnum * 1048576 + wordnum;
}

type PositionTuple = readonly [sentnum: number, wordnum: number];

function comparePositions(a: PositionTuple, b: PositionTuple): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}

function bisectLeftPosition(positions: readonly PositionTuple[], target: PositionTuple): number {
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (comparePositions(positions[mid]!, target) < 0) low = mid + 1;
    else high = mid;
  }
  return low;
}

function insortLeftPosition(positions: PositionTuple[], item: PositionTuple): void {
  const index = bisectLeftPosition(positions, item);
  positions.splice(index, 0, item);
}

function removePosition(positions: PositionTuple[], item: PositionTuple): void {
  const index = bisectLeftPosition(positions, item);
  if (index < positions.length && comparePositions(positions[index]!, item) === 0) {
    positions.splice(index, 1);
  }
}

function tupleGreaterThan(a: PositionTuple, b: PositionTuple): boolean {
  return comparePositions(a, b) > 0;
}

function comparePositionsLists(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return a.length - b.length;
}

/**
 * nltk.tbl.feature.Feature.__lt__ quirk: `cls_name_a < cls_name_b or
 * positions_a < positions_b` — NOT a proper lexicographic (name, positions)
 * order. When names differ the positions tuple can still dominate; ported
 * verbatim so sorting reproduces the oracle's oddities.
 */
function featureLt(a: TblFeature, b: TblFeature): boolean {
  return a.className() < b.className() ||
    comparePositionsLists(a.positions, b.positions) < 0;
}

function compareFeatures(a: TblFeature, b: TblFeature): number {
  if (featureLt(a, b)) return -1;
  if (featureLt(b, a)) return 1;
  return 0;
}

/**
 * Port of nltk.tbl.feature.Feature — a property-extraction method plus the
 * list of relative positions it applies to.
 */
export abstract class TblFeature {
  readonly kind: string;
  readonly positions: readonly number[];

  constructor(kind: string, positions: readonly number[] | number, end?: number) {
    this.kind = kind;
    if (end === undefined) {
      this.positions = [...new Set((positions as readonly number[]).map((p) => Math.trunc(p)))].sort((a, b) => a - b);
    } else {
      const start = positions as number;
      if (start > end) {
        throw new RangeError(`illegal interval specification: (start=${start}, end=${end})`);
      }
      this.positions = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    for (const p of this.positions) {
      if (!Number.isFinite(p)) throw new TypeError(`illegal position: ${String(p)}`);
    }
  }

  /** PROPERTY_NAME: subclass-provided name used in rule output; defaults to kind. */
  propertyName(): string {
    return this.kind;
  }

  className(): string {
    return this.kind;
  }

  repr(): string {
    return `${this.kind}([${this.positions.join(", ")}])`;
  }

  key(): string {
    return `${this.kind}:${this.positions.join(",")}`;
  }

  encodeJsonObj(): readonly number[] {
    return this.positions;
  }

  /** nltk.tbl.feature.Feature.decode_json_obj — classmethod. */
  static decodeJsonObj<F extends TblFeature>(this: new (positions: readonly number[]) => F, obj: readonly number[]): F {
    return new this(obj);
  }

  /**
   * One Feature per (start, winlen) slice of `starts`; when excludezero is
   * set, features containing position 0 are dropped.
   */
  static expand<F extends TblFeature>(
    this: new (positions: readonly number[]) => F,
    starts: readonly number[],
    winlens: readonly number[],
    excludezero = false,
  ): F[] {
    if (!winlens.every((w) => w > 0)) {
      throw new RangeError(`non-positive window length in [${winlens.join(", ")}]`);
    }
    const out: F[] = [];
    for (const w of winlens) {
      for (let i = 0; i + w <= starts.length; i += 1) {
        const slice = starts.slice(i, i + w);
        if (excludezero && slice.includes(0)) continue;
        out.push(new this(slice));
      }
    }
    return out;
  }

  abstract extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string;

  /** nltk Feature.__eq__: same class and same positions tuple. */
  equals(other: TblFeature): boolean {
    return (
      this.constructor === other.constructor &&
      this.positions.length === other.positions.length &&
      this.positions.every((p, i) => p === other.positions[i])
    );
  }

  nequals(other: TblFeature): boolean {
    return !this.equals(other);
  }

  /** True when this feature looks at all positions that `other` does (same class). */
  issuperset(other: TblFeature): boolean {
    return this.constructor === other.constructor && other.positions.every((p) => this.positions.includes(p));
  }

  /** True when the position sets intersect (same class). */
  intersects(other: TblFeature): boolean {
    return this.constructor === other.constructor && other.positions.some((p) => this.positions.includes(p));
  }

  /** nltk quirk: __lt__ is `name_a < name_b or positions_a < positions_b`. */
  lt(other: TblFeature): boolean {
    return featureLt(this, other);
  }
  gt(other: TblFeature): boolean {
    return featureLt(other, this);
  }
  ge(other: TblFeature): boolean {
    return !featureLt(this, other);
  }
  le(other: TblFeature): boolean {
    return featureLt(this, other) || this.equals(other);
  }
}

export class Word extends TblFeature {
  constructor(positions: readonly number[] | number, end?: number) {
    super("Word", positions, end);
  }

  extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string {
    return tokens[index]![0];
  }
}

export class Pos extends TblFeature {
  constructor(positions: readonly number[] | number, end?: number) {
    super("Pos", positions, end);
  }

  extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string {
    return tokens[index]![1];
  }
}

export type Condition = readonly [feature: TblFeature, value: string];

/**
 * Port of nltk.tbl.rule.TagRule — the abstract rule that maps an original tag
 * to a replacement tag wherever `applies` holds.
 */
export abstract class TagRule {
  readonly originalTag: string;
  readonly replacementTag: string;

  constructor(originalTag: string, replacementTag: string) {
    this.originalTag = originalTag;
    this.replacementTag = replacementTag;
  }

  /**
   * Apply this rule at every position in `positions` where it applies; the
   * tag change is computed in a separate step so the rule does not interact
   * with itself. Returns the indices whose tags were changed.
   */
  apply(tokens: Array<readonly [string, string]>, positions?: readonly number[]): number[] {
    const targets =
      positions !== undefined ? positions : Array.from({ length: tokens.length }, (_, i) => i);
    const change = targets.filter((i) => this.applies(tokens, i));
    const mutable = tokens as Array<[string, string]>;
    for (const i of change) {
      mutable[i] = [tokens[i]![0], this.replacementTag];
    }
    return change;
  }

  /** True if the rule would change the tag of tokens[index]. */
  abstract applies(tokens: ReadonlyArray<readonly [string, string]>, index: number): boolean;

  /** nltk quirk: TagRule.__eq__/__ne__/__hash__ unconditionally raise TypeError. */
  equals(_other: unknown): boolean {
    throw new TypeError("Rules must implement __eq__()");
  }
  nequals(_other: unknown): boolean {
    throw new TypeError("Rules must implement __ne__()");
  }
  hash(): number {
    throw new TypeError("Rules must implement __hash__()");
  }
}

export class TblRule extends TagRule {
  readonly templateid: string;
  readonly conditions: readonly Condition[];

  #repr?: string;
  #key?: string;
  #str?: string;
  #hash?: number;

  constructor(templateid: string, originalTag: string, replacementTag: string, conditions: readonly Condition[]) {
    super(originalTag, replacementTag);
    this.templateid = templateid;
    this.conditions = conditions;
  }

  encodeJsonObj(): { templateid: string; original: string; replacement: string; conditions: readonly Condition[] } {
    return {
      templateid: this.templateid,
      original: this.originalTag,
      replacement: this.replacementTag,
      conditions: this.conditions,
    };
  }

  static decodeJsonObj(obj: { templateid: string; original: string; replacement: string; conditions: readonly Condition[] }): TblRule {
    return new TblRule(obj.templateid, obj.original, obj.replacement, obj.conditions);
  }

  override equals(other: unknown): boolean {
    return (
      other instanceof TblRule &&
      this.originalTag === other.originalTag &&
      this.replacementTag === other.replacementTag &&
      this.conditions.length === other.conditions.length &&
      this.conditions.every(([f, v], i) => {
        const [of, ov] = other.conditions[i]!;
        return v === ov && f.equals(of);
      })
    );
  }

  repr(): string {
    if (this.#repr === undefined) {
      const conditionText = this.conditions
        .map(([feature, value]) => `(${feature.repr()},${pyRepr(value)})`)
        .join(", ");
      this.#repr = `Rule('${this.templateid}', ${pyRepr(this.originalTag)}, ${pyRepr(this.replacementTag)}, [${conditionText}])`;
    }
    return this.#repr;
  }

  key(): string {
    if (this.#key === undefined) {
      this.#key = [
        this.templateid,
        this.originalTag,
        this.replacementTag,
        ...this.conditions.map(([f, v]) => `${f.key()}=${v}`),
      ].join("\u0000");
    }
    return this.#key;
  }

  override toString(): string {
    if (this.#str === undefined) {
      const conditionText = this.conditions
        .map(
          ([feature, value]) =>
            `${feature.kind}:${value}@[${feature.positions.join(",")}]`,
        )
        .join(" & ");
      // nltk quirk: __str__ unconditionally appends " if {...}".
      this.#str = `${this.originalTag}->${this.replacementTag} if ${conditionText}`;
    }
    return this.#str;
  }

  applies(tokens: ReadonlyArray<readonly [string, string]>, index: number): boolean {
    if (tokens[index]![1] !== this.originalTag) return false;
    for (const [feature, value] of this.conditions) {
      let satisfied = false;
      for (const pos of feature.positions) {
        const target = index + pos;
        if (!(0 <= target && target < tokens.length)) continue;
        if (feature.extractProperty(tokens, target) === value) {
          satisfied = true;
          break;
        }
      }
      if (!satisfied) return false;
    }
    return true;
  }

  override hash(): number {
    // nltk caches hash(repr(self)); a stable string hash serves the same role.
    if (this.#hash === undefined) {
      const s = this.repr();
      let h = 0;
      for (let i = 0; i < s.length; i += 1) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
      this.#hash = h;
    }
    return this.#hash;
  }

  /** nltk.tbl.rule.Rule.format — "str" | "repr" | "verbose". */
  format(fmt: string): string {
    if (fmt === "str") return this.toString();
    if (fmt === "repr") return this.repr();
    if (fmt === "verbose") return this.verboseFormat();
    throw new RangeError(`unknown rule format spec: ${fmt}`);
  }

  verboseFormat(): string {
    const conditionToStr = (feature: TblFeature, value: string): string =>
      `the ${feature.propertyName()} of ${rangeToStr(feature.positions)} is "${value}"`;
    const rangeToStr = (positions: readonly number[]): string => {
      if (positions.length === 1) {
        const p = positions[0]!;
        if (p === 0) return "this word";
        if (p === -1) return "the preceding word";
        if (p === 1) return "the following word";
        if (p < 0) return `word i-${-p}`;
        return `word i+${p}`;
      }
      const mx = Math.max(...positions);
      const mn = Math.min(...positions);
      if (mx - mn === positions.length - 1) {
        return `words i${mn >= 0 ? "+" : ""}${mn}...i${mx >= 0 ? "+" : ""}${mx}`;
      }
      return `words {${positions.map((d) => `i${d >= 0 ? "+" : ""}${d}`).join(",")}}`;
    };
    const replacement = `${this.originalTag} -> ${this.replacementTag}`;
    const conditions =
      (this.conditions.length > 0 ? " if " : "") +
      this.conditions.map(([f, v]) => conditionToStr(f, v)).join(", and ");
    return replacement + conditions;
  }
}

/** nltk.tbl.template.BrillTemplateI — interface for rule-generating templates. */
export abstract class BrillTemplateI {
  /**
   * Return the rules that would correct the index-th token's tag to
   * `correctTag`; empty when the token already has the correct tag.
   */
  abstract applicableRules(
    tokens: ReadonlyArray<readonly [string, string]>,
    index: number,
    correctTag: string,
  ): TblRule[];

  /** Indices on which applicable_rules may depend (used by the fast trainer). */
  abstract getNeighborhood(tokens: ReadonlyArray<unknown>, index: number): number[];
}

/** nltk.tbl.template.Template.ALLTEMPLATES — creation-order registry. */
const ALLTEMPLATES: Template[] = [];

export function clearTemplateRegistry(): void {
  ALLTEMPLATES.length = 0;
}

function popTemplate(): Template | undefined {
  return ALLTEMPLATES.pop();
}

type FeatureConstructor = new (positions: readonly number[] | number, end?: number) => TblFeature;

export class Template extends BrillTemplateI {
  readonly id: string;
  readonly features: readonly TblFeature[];

  constructor(...features: Array<TblFeature | FeatureConstructor | readonly [number, number]>) {
    super();
    let resolved: TblFeature[];
    if (features.every((f) => f instanceof TblFeature)) {
      resolved = features as TblFeature[];
    } else if (
      features.length > 0 &&
      typeof features[0] === "function" &&
      features.slice(1).every((a) => Array.isArray(a))
    ) {
      const ctor = features[0] as FeatureConstructor;
      resolved = (features.slice(1) as ReadonlyArray<readonly [number, number]>).map(
        (tp) => new ctor(tp[0], tp[1]),
      );
    } else {
      throw new TypeError(
        "expected either Feature1(args), Feature2(args), ... or Feature, (start1, end1), (start2, end2), ...",
      );
    }
    this.features = resolved;
    this.id = String(ALLTEMPLATES.length).padStart(3, "0");
    ALLTEMPLATES.push(this);
  }

  repr(): string {
    return `Template(${this.features.map((f) => f.repr()).join(",")})`;
  }

  applicableRules(tokens: ReadonlyArray<readonly [string, string]>, index: number, correctTag: string): TblRule[] {
    if (tokens[index]![1] === correctTag) return [];

    const conditionLists: Condition[][] = [];
    for (const feature of this.features) {
      const list: Condition[] = [];
      for (const pos of feature.positions) {
        const target = index + pos;
        if (!(0 <= target && target < tokens.length)) continue;
        list.push([feature, feature.extractProperty(tokens, target)]);
      }
      conditionLists.push(list);
    }

    const combinations: Condition[][] = [[]];
    for (const list of conditionLists) {
      const next: Condition[][] = [];
      for (const prefix of combinations) {
        for (const condition of list) {
          next.push([...prefix, condition]);
        }
      }
      combinations.length = 0;
      combinations.push(...next);
    }

    const originalTag = tokens[index]![1];
    return combinations.map((conditions) => new TblRule(this.id, originalTag, correctTag, conditions));
  }

  getNeighborhood(tokens: ReadonlyArray<unknown>, index: number): number[] {
    const neighborhood = new Set<number>([index]);
    const allPositions = [0, ...this.features.flatMap((f) => [...f.positions])];
    const start = Math.min(...allPositions);
    const end = Math.max(...allPositions);
    const from = Math.max(0, index + -end);
    const to = Math.min(index + -start + 1, tokens.length);
    for (let i = from; i < to; i += 1) neighborhood.add(i);
    return [...neighborhood].sort((a, b) => a - b);
  }

  /**
   * nltk.tbl.template.Template.expand — mass-generate Templates from lists of
   * Features. `combinations` selects how many feature lists are drawn per
   * Template: a single int k (exactly k) or [k1, k2] (k1..k2); default 1..n.
   * Superset and (by default) intersecting features are dropped; repr-equal
   * Templates are deduplicated and popped from the registry like nltk.
   */
  static expand(
    featurelists: ReadonlyArray<readonly TblFeature[]>,
    combinations: number | readonly [number, number] | null = null,
    skipintersecting = true,
  ): Template[] {
    const combrange: readonly [number, number] =
      combinations === null
        ? [1, featurelists.length + 1]
        : typeof combinations === "number"
          ? [combinations, combinations + 1]
          : [combinations[0], combinations[1] + 1];

    const powerset: Array<ReadonlyArray<readonly TblFeature[]>> = [];
    for (let r = combrange[0]; r < combrange[1]; r += 1) {
      for (const pick of combineLists(featurelists, r)) powerset.push(pick);
    }

    const out: Template[] = [];
    const seentemplates = new Set<string>();
    for (const picks of powerset) {
      for (const pick of productLists(picks)) {
        let skip = false;
        for (let i = 0; i < pick.length && !skip; i += 1) {
          for (let j = 0; j < pick.length && !skip; j += 1) {
            if (i === j) continue;
            if (pick[i]!.issuperset(pick[j]!)) skip = true;
            else if (skipintersecting && pick[i]!.intersects(pick[j]!)) skip = true;
          }
        }
        if (skip) continue;
        const sorted = [...pick].sort(compareFeatures);
        const thistemplate = new Template(...sorted);
        const strpick = thistemplate.repr();
        if (seentemplates.has(strpick)) {
          popTemplate();
          continue;
        }
        seentemplates.add(strpick);
        out.push(thistemplate);
      }
    }
    return out;
  }
}

/** itertools.combinations over sublists: choose r of the feature lists. */
function combineLists<T>(xs: readonly T[], r: number): T[][] {
  const out: T[][] = [];
  const idx: number[] = [];
  const step = (start: number): void => {
    if (idx.length === r) {
      out.push(idx.map((i) => xs[i]!));
      return;
    }
    for (let i = start; i < xs.length; i += 1) {
      idx.push(i);
      step(i + 1);
      idx.pop();
    }
  };
  if (r >= 0) step(0);
  return out;
}

/** itertools.product over lists of Features. */
function productLists<T>(lists: ReadonlyArray<readonly T[]>): T[][] {
  let acc: T[][] = [[]];
  for (const list of lists) {
    const next: T[][] = [];
    for (const prefix of acc) for (const item of list) next.push([...prefix, item]);
    acc = next;
  }
  return acc;
}

export interface BrillTrainingStats {
  min_acc: number | null;
  min_score: number;
  tokencount: number;
  sequencecount: number;
  templatecount: number;
  rulescores: number[];
  initialerrors: number;
  finalerrors: number;
  initialacc: number;
  finalacc: number;
}

export class BrillTagger {
  readonly #initialTagger: InitialTaggerLike;
  readonly #rules: readonly TblRule[];
  readonly #trainingStats: BrillTrainingStats | null;

  constructor(initialTagger: InitialTaggerLike, rules: readonly TblRule[], trainingStats: BrillTrainingStats | null = null) {
    this.#initialTagger = initialTagger;
    this.#rules = [...rules];
    this.#trainingStats = trainingStats;
  }

  get initialTagger(): InitialTaggerLike {
    return this.#initialTagger;
  }

  rules(): readonly TblRule[] {
    return this.#rules;
  }

  trainStats(): BrillTrainingStats | null;
  trainStats<K extends keyof BrillTrainingStats>(statistic: K): BrillTrainingStats[K] | null;
  trainStats(statistic?: keyof BrillTrainingStats): BrillTrainingStats | BrillTrainingStats[keyof BrillTrainingStats] | null {
    if (statistic === undefined) return this.#trainingStats;
    return this.#trainingStats?.[statistic] ?? null;
  }

  tag(tokens: UntaggedSentence): BrillSentence {
    const taggedTokens: BrillSentence = this.#initialTagger
      .tag(tokens)
      .map(([word, tag]) => [word, tag ?? ""] as BrillToken);

    const tagToPositions = new Map<string, Set<number>>();
    for (let i = 0; i < taggedTokens.length; i += 1) {
      const tag = taggedTokens[i]![1];
      let set = tagToPositions.get(tag);
      if (set === undefined) {
        set = new Set();
        tagToPositions.set(tag, set);
      }
      set.add(i);
    }

    for (const rule of this.#rules) {
      const candidates = [...(tagToPositions.get(rule.originalTag) ?? [])];
      const changed = rule.apply(taggedTokens, candidates);
      for (const i of changed) {
        tagToPositions.get(rule.originalTag)?.delete(i);
        let replacementSet = tagToPositions.get(rule.replacementTag);
        if (replacementSet === undefined) {
          replacementSet = new Set();
          tagToPositions.set(rule.replacementTag, replacementSet);
        }
        replacementSet.add(i);
      }
    }

    return taggedTokens;
  }

  tagSents(sentences: ReadonlyArray<UntaggedSentence>): BrillSentence[] {
    return sentences.map((tokens) => this.tag(tokens));
  }

  evaluate(gold: ReadonlyArray<GoldSentence>): number {
    const taggedSents = this.tagSents(gold.map((sentence) => sentence.map(([word]) => word)));
    let correct = 0;
    let total = 0;
    for (let s = 0; s < gold.length; s += 1) {
      const reference = gold[s]!;
      const test = taggedSents[s]!;
      const length = Math.min(reference.length, test.length);
      for (let i = 0; i < length; i += 1) {
        total += 1;
        if (reference[i]![1] === test[i]![1]) correct += 1;
      }
    }
    return total === 0 ? 0 : correct / total;
  }
}

export interface BrillTrainerOptions {
  trace?: number;
  deterministic?: boolean;
}

interface TrainerState {
  registry: Map<string, TblRule>;
  tagPositions: Map<string, PositionTuple[]>;
  rulesByPosition: Map<number, Set<TblRule>>;
  positionsByRule: Map<TblRule, Map<number, RuleEffect>>;
  rulesByScore: Map<number, Set<TblRule>>;
  ruleScores: Map<TblRule, number>;
  firstUnknownPosition: Map<TblRule, PositionTuple>;
}

export class BrillTaggerTrainer {
  readonly #initialTagger: InitialTaggerLike;
  readonly #templates: readonly Template[];
  readonly #trace: number;
  readonly #deterministic: boolean;

  constructor(initialTagger: InitialTaggerLike, templates: readonly Template[], options: BrillTrainerOptions = {}) {
    this.#initialTagger = initialTagger;
    this.#templates = templates;
    this.#trace = options.trace ?? 0;
    this.#deterministic = options.deterministic ?? this.#trace > 0;
  }

  train(trainSents: ReadonlyArray<GoldSentence>, maxRules = 200, minScore = 2, minAcc: number | null = null): BrillTagger {
    const testSents: BrillSentence[] = trainSents.map((sent) =>
      this.#initialTagger.tag(sent.map(([word]) => word)).map(
        ([word, tag]) => [word, tag ?? ""] as BrillToken,
      ),
    );

    const state: TrainerState = {
      registry: new Map(),
      tagPositions: new Map(),
      rulesByPosition: new Map(),
      positionsByRule: new Map(),
      rulesByScore: new Map(),
      ruleScores: new Map(),
      firstUnknownPosition: new Map(),
    };

    let tokencount = 0;
    let initialerrors = 0;
    for (const sent of testSents) tokencount += sent.length;

    const rules: TblRule[] = [];
    const ruleScoresOut: number[] = [];

    const pairedErrors = (): number => {
      let errors = 0;
      for (let s = 0; s < testSents.length; s += 1) {
        const testSent = testSents[s]!;
        const goldSent = trainSents[s]!;
        for (let w = 0; w < testSent.length; w += 1) {
          if (testSent[w]![1] !== goldSent[w]![1]) errors += 1;
        }
      }
      return errors;
    };

    initialerrors = pairedErrors();
    const initialacc = 1 - initialerrors / tokencount;

    if (this.#trace > 0) {
      console.log(
        `TBL train (fast) (seqs: ${testSents.length}; tokens: ${tokencount}; tpls: ${this.#templates.length}; min score: ${minScore}; min acc: ${minAcc})`,
      );
    }

    this.#initMappings(state, testSents, trainSents);

    while (rules.length < maxRules) {
      const rule = this.#bestRule(state, trainSents, testSents, minScore, minAcc);
      if (!rule) break;
      rules.push(rule);
      const score = state.ruleScores.get(rule) ?? 0;
      ruleScoresOut.push(score);
      this.#applyRule(state, rule, testSents);
      this.#updateTagPositions(state, rule);
      this.#updateRules(state, rule, trainSents, testSents);
    }

    const finalerrors = initialerrors - ruleScoresOut.reduce((sum, s) => sum + s, 0);
    const stats: BrillTrainingStats = {
      min_acc: minAcc,
      min_score: minScore,
      tokencount,
      sequencecount: testSents.length,
      templatecount: this.#templates.length,
      rulescores: ruleScoresOut,
      initialerrors,
      finalerrors,
      initialacc,
      finalacc: 1 - finalerrors / tokencount,
    };

    return new BrillTagger(this.#initialTagger, rules, stats);
  }

  #initMappings(state: TrainerState, testSents: BrillSentence[], trainSents: ReadonlyArray<GoldSentence>): void {
    for (let sentnum = 0; sentnum < testSents.length; sentnum += 1) {
      const sent = testSents[sentnum]!;
      for (let wordnum = 0; wordnum < sent.length; wordnum += 1) {
        const tag = sent[wordnum]![1];
        let positions = state.tagPositions.get(tag);
        if (positions === undefined) {
          positions = [];
          state.tagPositions.set(tag, positions);
        }
        positions.push([sentnum, wordnum]);

        const correctTag = trainSents[sentnum]![wordnum]![1];
        if (tag !== correctTag) {
          for (const rule of this.#findRules(sent, wordnum, correctTag)) {
            this.#updateRuleApplies(state, rule, sentnum, wordnum, trainSents);
          }
        }
      }
    }
  }

  #findRules(sent: BrillSentence, wordnum: number, newTag: string): TblRule[] {
    const found: TblRule[] = [];
    for (const template of this.#templates) {
      found.push(...template.applicableRules(sent, wordnum, newTag));
    }
    return found;
  }

  #updateRuleApplies(state: TrainerState, ruleIn: TblRule, sentnum: number, wordnum: number, trainSents: ReadonlyArray<GoldSentence>): void {
    // Python dicts unify structurally-equal rules via hash/eq; canonicalize
    // through a registry so identical rules share score state.
    const existing = state.registry.get(ruleIn.key());
    let rule: TblRule;
    if (existing === undefined) {
      rule = ruleIn;
      state.registry.set(rule.key(), rule);
    } else {
      rule = existing;
    }
    const key = posKey(sentnum, wordnum);

    let byRule = state.positionsByRule.get(rule);
    if (byRule === undefined) {
      byRule = new Map();
      state.positionsByRule.set(rule, byRule);
    }
    if (byRule.has(key)) return;

    const correctTag = trainSents[sentnum]![wordnum]![1];
    let effect: RuleEffect;
    if (rule.replacementTag === correctTag) effect = 1;
    else if (rule.originalTag === correctTag) effect = -1;
    else effect = 0;
    byRule.set(key, effect);

    let atPosition = state.rulesByPosition.get(key);
    if (atPosition === undefined) {
      atPosition = new Set();
      state.rulesByPosition.set(key, atPosition);
    }
    atPosition.add(rule);

    const oldScore = state.ruleScores.get(rule) ?? 0;
    const newScore = oldScore + effect;
    state.ruleScores.set(rule, newScore);

    state.rulesByScore.get(oldScore)?.delete(rule);
    let newBucket = state.rulesByScore.get(newScore);
    if (newBucket === undefined) {
      newBucket = new Set();
      state.rulesByScore.set(newScore, newBucket);
    }
    newBucket.add(rule);
  }

  #updateRuleNotApplies(state: TrainerState, rule: TblRule, sentnum: number, wordnum: number): void {
    const key = posKey(sentnum, wordnum);
    const byRule = state.positionsByRule.get(rule);
    if (byRule === undefined || !byRule.has(key)) return;

    const effect = byRule.get(key)!;
    const oldScore = state.ruleScores.get(rule) ?? 0;
    const newScore = oldScore - effect;
    state.ruleScores.set(rule, newScore);

    state.rulesByScore.get(oldScore)?.delete(rule);
    let bucket = state.rulesByScore.get(newScore);
    if (bucket === undefined) {
      bucket = new Set();
      state.rulesByScore.set(newScore, bucket);
    }
    bucket.add(rule);

    byRule.delete(key);
    state.rulesByPosition.get(key)?.delete(rule);
  }

  #bestRule(state: TrainerState, trainSents: ReadonlyArray<GoldSentence>, testSents: BrillSentence[], minScore: number, minAcc: number | null): TblRule | null {
    const scores = [...state.rulesByScore.keys()].sort((a, b) => b - a);
    for (const maxScore of scores) {
      if (state.rulesByScore.size === 0) return null;
      if (maxScore < minScore || maxScore <= 0) return null;
      const bucket = state.rulesByScore.get(maxScore);
      if (bucket === undefined || bucket.size === 0) continue;
      const bestRules = [...bucket];
      if (this.#deterministic) {
        bestRules.sort((a, b) => compareCodePoints(a.repr(), b.repr()));
      }
      for (const rule of bestRules) {
        const positions = state.tagPositions.get(rule.originalTag) ?? [];
        const unknown = state.firstUnknownPosition.get(rule) ?? ([0, -1] as const);
        const start = bisectLeftPosition(positions, unknown);

        for (let i = start; i < positions.length; i += 1) {
          const [sentnum, wordnum] = positions[i]!;
          if (rule.applies(testSents[sentnum]!, wordnum)) {
            this.#updateRuleApplies(state, rule, sentnum, wordnum, trainSents);
            if ((state.ruleScores.get(rule) ?? 0) < maxScore) {
              state.firstUnknownPosition.set(rule, [sentnum, wordnum + 1]);
              break;
            }
          }
        }

        if ((state.ruleScores.get(rule) ?? 0) === maxScore) {
          state.firstUnknownPosition.set(rule, [trainSents.length + 1, 0]);
          if (minAcc === null) {
            return rule;
          }
          const effects = state.positionsByRule.get(rule)?.values() ?? [];
          let numFixed = 0;
          let numBroken = 0;
          for (const effect of effects) {
            if (effect === 1) numFixed += 1;
            else if (effect === -1) numBroken += 1;
          }
          const acc = numFixed + numBroken === 0 ? NaN : numFixed / (numFixed + numBroken);
          if (acc >= minAcc) {
            return rule;
          }
        }
      }

      if ((bucket.size ?? 0) === 0) {
        state.rulesByScore.delete(maxScore);
      }
    }
    return null;
  }

  #applyRule(state: TrainerState, rule: TblRule, testSents: BrillSentence[]): void {
    const updatePositions = [...(state.positionsByRule.get(rule)?.keys() ?? [])];
    const newTag = rule.replacementTag;
    for (const key of updatePositions) {
      const sentnum = Math.floor(key / 1048576);
      const wordnum = key % 1048576;
      const token = testSents[sentnum]![wordnum]!;
      testSents[sentnum]![wordnum] = [token[0], newTag];
    }
  }

  #updateTagPositions(state: TrainerState, rule: TblRule): void {
    const entries = [...(state.positionsByRule.get(rule)?.keys() ?? [])];
    for (const key of entries) {
      const pos: PositionTuple = [Math.floor(key / 1048576), key % 1048576];
      const oldTagPositions = state.tagPositions.get(rule.originalTag);
      if (oldTagPositions !== undefined) removePosition(oldTagPositions, pos);
      let newTagPositions = state.tagPositions.get(rule.replacementTag);
      if (newTagPositions === undefined) {
        newTagPositions = [];
        state.tagPositions.set(rule.replacementTag, newTagPositions);
      }
      insortLeftPosition(newTagPositions, pos);
    }
  }

  #updateRules(state: TrainerState, rule: TblRule, trainSents: ReadonlyArray<GoldSentence>, testSents: BrillSentence[]): void {
    const neighbors = new Set<number>();
    const entries = [...(state.positionsByRule.get(rule)?.keys() ?? [])];
    for (const key of entries) {
      const sentnum = Math.floor(key / 1048576);
      const wordnum = key % 1048576;
      for (const template of this.#templates) {
        for (const i of template.getNeighborhood(testSents[sentnum]!, wordnum)) {
          neighbors.add(posKey(sentnum, i));
        }
      }
    }

    for (const neighborKey of neighbors) {
      const sentnum = Math.floor(neighborKey / 1048576);
      const wordnum = neighborKey % 1048576;
      const testSent = testSents[sentnum]!;
      const correctTag = trainSents[sentnum]![wordnum]![1];

      const oldRules = new Set(state.rulesByPosition.get(neighborKey) ?? []);
      for (const oldRule of oldRules) {
        if (!oldRule.applies(testSent, wordnum)) {
          this.#updateRuleNotApplies(state, oldRule, sentnum, wordnum);
        }
      }

      for (const template of this.#templates) {
        for (const newRule of template.applicableRules(testSent, wordnum, correctTag)) {
          if (!oldRules.has(newRule)) {
            oldRules.add(newRule);
            this.#updateRuleApplies(state, newRule, sentnum, wordnum, trainSents);
          }
        }
      }

      for (const [newRule, firstUnknown] of state.firstUnknownPosition) {
        if (tupleGreaterThan(firstUnknown, [sentnum, wordnum])) {
          if (!oldRules.has(newRule) && newRule.applies(testSent, wordnum)) {
            this.#updateRuleApplies(state, newRule, sentnum, wordnum, trainSents);
          }
        }
      }
    }
  }
}

export interface FeatureSpec {
  kind: string;
  positions: readonly number[];
}

export function buildTemplates(specs: ReadonlyArray<ReadonlyArray<FeatureSpec>>): Template[] {
  return specs.map((features) =>
    new Template(
      ...features.map(({ kind, positions }) =>
        kind === "Pos" ? new Pos(positions) : new Word(positions),
      ),
    ),
  );
}

export function standardTemplates(): Template[] {
  clearTemplateRegistry();
  return buildTemplates([
    [{ kind: "Pos", positions: [-1] }],
    [{ kind: "Pos", positions: [-2, -1] }],
    [{ kind: "Word", positions: [0] }],
    [{ kind: "Word", positions: [-2, -1] }],
    [{ kind: "Pos", positions: [-1] }, { kind: "Word", positions: [0] }],
  ]);
}

export type { GoldSentence, SequentialBackoffTagger, TaggedToken, UntaggedSentence };
