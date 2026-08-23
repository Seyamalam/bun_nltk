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

export abstract class TblFeature {
  readonly kind: string;
  readonly positions: readonly number[];

  constructor(kind: string, positions: readonly number[]) {
    this.kind = kind;
    this.positions = [...new Set(positions.map((p) => Math.trunc(p)))].sort((a, b) => a - b);
    for (const p of this.positions) {
      if (!Number.isFinite(p)) throw new TypeError(`illegal position: ${String(p)}`);
    }
  }

  repr(): string {
    return `${this.kind}([${this.positions.join(", ")}])`;
  }

  key(): string {
    return `${this.kind}:${this.positions.join(",")}`;
  }

  abstract extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string;

  equals(other: TblFeature): boolean {
    return (
      this.kind === other.kind &&
      this.positions.length === other.positions.length &&
      this.positions.every((p, i) => p === other.positions[i])
    );
  }
}

export class Word extends TblFeature {
  constructor(positions: readonly number[]) {
    super("Word", positions);
  }

  extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string {
    return tokens[index]![0];
  }
}

export class Pos extends TblFeature {
  constructor(positions: readonly number[]) {
    super("Pos", positions);
  }

  extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string {
    return tokens[index]![1];
  }
}

export type Condition = readonly [feature: TblFeature, value: string];

export class TblRule {
  readonly templateid: string;
  readonly originalTag: string;
  readonly replacementTag: string;
  readonly conditions: readonly Condition[];

  #repr?: string;
  #key?: string;
  #str?: string;

  constructor(templateid: string, originalTag: string, replacementTag: string, conditions: readonly Condition[]) {
    this.templateid = templateid;
    this.originalTag = originalTag;
    this.replacementTag = replacementTag;
    this.conditions = conditions;
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

  toString(): string {
    if (this.#str === undefined) {
      const conditionText = this.conditions
        .map(
          ([feature, value]) =>
            `${feature.kind}:${value}@[${feature.positions.join(",")}]`,
        )
        .join(" & ");
      this.#str =
        conditionText.length > 0
          ? `${this.originalTag}->${this.replacementTag} if ${conditionText}`
          : `${this.originalTag}->${this.replacementTag}`;
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

  apply(tokens: BrillSentence, positions?: readonly number[]): number[] {
    const targets =
      positions !== undefined ? positions : Array.from({ length: tokens.length }, (_, i) => i);
    const change = targets.filter((i) => this.applies(tokens, i)!);
    for (const i of change) {
      tokens[i] = [tokens[i]![0], this.replacementTag];
    }
    return change;
  }
}

let nextTemplateId = 0;

export function clearTemplateRegistry(): void {
  nextTemplateId = 0;
}

export class Template {
  readonly id: string;
  readonly features: readonly TblFeature[];

  constructor(...features: TblFeature[]) {
    if (features.length === 0 || !features.every((f) => f instanceof TblFeature)) {
      throw new TypeError("expected one or more Feature instances");
    }
    this.features = features;
    this.id = String(nextTemplateId).padStart(3, "0");
    nextTemplateId += 1;
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

  #state: TrainerState | null = null;

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
    this.#state = state;

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

    this.#state = null;
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
