/**
 * Ports of pure-Python dependency-parse internals:
 * - nltk.parse.transitionparser.Configuration / Transition
 * - nltk.parse.projectivedependencyparser.DependencySpan / ChartCell
 * - nltk.parse.nonprojectivedependencyparser.DependencyScorerI / DemoScorer /
 *   NaiveBayesDependencyScorer (including the rel-keyed deps membership quirk
 *   that makes every training label "F" in NLTK 3.10.3)
 * - nltk.parse.pchart.ProbabilisticTreeEdge / ProbabilisticLeafEdge /
 *   ProbabilisticTree and nltk.parse.viterbi.ProbabilisticTree
 * - nltk.parse.util.extract_test_sentences
 */
import { pyError } from "./internals";
import type { DependencyGraph, DependencyNode } from "./dependency_graph";
import { NaiveBayesClassifier } from "./classifier_compat";
import type { FeatureSet, LabeledFeatureset } from "./feature_types";
import { LeafEdge, TreeEdge } from "./chart";
import type { GrammarSymbol, Production } from "./grammar";
import { Tree } from "./rust_parse";
import type { ParsingRuntime } from "./rust_parse";

function pyList(items: Array<unknown>): string {
  return `[${items.map((item) => Array.isArray(item) ? pyList(item) : String(item)).join(", ")}]`;
}

// ---- nltk.parse.transitionparser -------------------------------------------

export const ARC_STANDARD = "arc-standard";
export const ARC_EAGER = "arc-eager";

/** nltk.parse.transitionparser.Configuration — stack/buffer/arcs triple. */
export class Configuration {
  stack: number[] = [0];
  buffer: number[];
  arcs: Array<[number, string, number]> = [];
  private readonly tokens: ReadonlyArray<DependencyNode | undefined>;
  private readonly maxAddress: number;

  constructor(depGraph: DependencyGraph) {
    this.buffer = depGraph.nodes.slice(1).map((_, index) => index + 1);
    this.tokens = depGraph.nodes;
    this.maxAddress = this.buffer.length;
  }

  get max_address(): number {
    return this.maxAddress;
  }

  private checkInformative(feat: string | null | undefined, flag = false): boolean {
    if (feat === null || feat === undefined) return false;
    if (feat === "") return false;
    if (flag === false && feat === "_") return false;
    return true;
  }

  private arcDeps(index: number): { depLeft: string; depRight: string } {
    let leftMost = 1_000_000;
    let rightMost = -1;
    let depLeft = "";
    let depRight = "";
    for (const [wi, rel, wj] of this.arcs) {
      if (wi !== index) continue;
      if (wj > wi && wj > rightMost) {
        rightMost = wj;
        depRight = rel;
      }
      if (wj < wi && wj < leftMost) {
        leftMost = wj;
        depLeft = rel;
      }
    }
    return { depLeft, depRight };
  }

  /** Port of Configuration.extract_features (Kubler/McDonald/Nivre table 3.2). */
  extract_features(): string[] {
    const result: string[] = [];
    if (this.stack.length > 0) {
      const stackIdx0 = this.stack[this.stack.length - 1]!;
      const token = this.tokens[stackIdx0];
      if (token) {
        if (this.checkInformative(token.word, true)) result.push(`STK_0_FORM_${token.word}`);
        if (token.lemma !== undefined && this.checkInformative(token.lemma)) result.push(`STK_0_LEMMA_${token.lemma}`);
        if (this.checkInformative(token.tag)) result.push(`STK_0_POS_${token.tag}`);
        if (token.feats !== undefined && this.checkInformative(token.feats)) {
          for (const feat of token.feats!.split("|")) result.push(`STK_0_FEATS_${feat}`);
        }
      }
      if (this.stack.length > 1) {
        const token1 = this.tokens[this.stack[this.stack.length - 2]!];
        if (token1 && this.checkInformative(token1.tag)) result.push(`STK_1_POS_${token1.tag}`);
      }
      const deps = this.arcDeps(stackIdx0);
      if (this.checkInformative(deps.depLeft)) result.push(`STK_0_LDEP_${deps.depLeft}`);
      if (this.checkInformative(deps.depRight)) result.push(`STK_0_RDEP_${deps.depRight}`);
    }
    if (this.buffer.length > 0) {
      const bufferIdx0 = this.buffer[0]!;
      const token = this.tokens[bufferIdx0];
      if (token) {
        if (this.checkInformative(token.word, true)) result.push(`BUF_0_FORM_${token.word}`);
        if (token.lemma !== undefined && this.checkInformative(token.lemma)) result.push(`BUF_0_LEMMA_${token.lemma}`);
        if (this.checkInformative(token.tag)) result.push(`BUF_0_POS_${token.tag}`);
        if (token.feats !== undefined && this.checkInformative(token.feats)) {
          for (const feat of token.feats!.split("|")) result.push(`BUF_0_FEATS_${feat}`);
        }
      }
      if (this.buffer.length > 1) {
        const token1 = this.tokens[this.buffer[1]!];
        if (token1) {
          if (this.checkInformative(token1.word, true)) result.push(`BUF_1_FORM_${token1.word}`);
          if (this.checkInformative(token1.tag)) result.push(`BUF_1_POS_${token1.tag}`);
        }
      }
      if (this.buffer.length > 2) {
        const token2 = this.tokens[this.buffer[2]!];
        if (token2 && this.checkInformative(token2.tag)) result.push(`BUF_2_POS_${token2.tag}`);
      }
      if (this.buffer.length > 3) {
        const token3 = this.tokens[this.buffer[3]!];
        if (token3 && this.checkInformative(token3.tag)) result.push(`BUF_3_POS_${token3.tag}`);
      }
      const deps = this.arcDeps(bufferIdx0);
      if (this.checkInformative(deps.depLeft)) result.push(`BUF_0_LDEP_${deps.depLeft}`);
      if (this.checkInformative(deps.depRight)) result.push(`BUF_0_RDEP_${deps.depRight}`);
    }
    return result;
  }

  extractFeatures(): string[] {
    return this.extract_features();
  }

  toString(): string {
    const arcReprs = this.arcs.map(([wi, rel, wj]) => `(${wi}, '${rel}', ${wj})`);
    return `Stack : ${pyList(this.stack)}  Buffer : ${pyList(this.buffer)}   Arcs : ${pyList(arcReprs)}`;
  }
}

/** nltk.parse.transitionparser.Transition — arc-standard / arc-eager operators. */
export class Transition {
  static readonly LEFT_ARC = "LEFTARC";
  static readonly RIGHT_ARC = "RIGHTARC";
  static readonly SHIFT = "SHIFT";
  static readonly REDUCE = "REDUCE";
  static readonly ARC_STANDARD = ARC_STANDARD;
  static readonly ARC_EAGER = ARC_EAGER;

  private readonly algo: string;

  constructor(algOption: string) {
    if (algOption !== ARC_STANDARD && algOption !== ARC_EAGER) {
      throw pyError("ValueError", ` Currently we only support ${ARC_STANDARD} and ${ARC_EAGER} `);
    }
    this.algo = algOption;
  }

  /** Mutates conf; returns -1 when the precondition fails (NLTK returns -1/None). */
  left_arc(conf: Configuration, relation: string): -1 | undefined {
    if (conf.buffer.length <= 0 || conf.stack.length <= 0) return -1;
    if (conf.buffer[0] === 0) return -1;
    const idxWi = conf.stack[conf.stack.length - 1]!;
    let flag = true;
    if (this.algo === ARC_EAGER) {
      for (const [, , idxChild] of conf.arcs) {
        if (idxChild === idxWi) flag = false;
      }
    }
    if (flag) {
      conf.stack.pop();
      const idxWj = conf.buffer[0]!;
      conf.arcs.push([idxWj, relation, idxWi]);
    } else {
      return -1;
    }
    return undefined;
  }

  leftArc(conf: Configuration, relation: string): -1 | undefined {
    return this.left_arc(conf, relation);
  }

  right_arc(conf: Configuration, relation: string): -1 | undefined {
    if (conf.buffer.length <= 0 || conf.stack.length <= 0) return -1;
    if (this.algo === ARC_STANDARD) {
      const idxWi = conf.stack.pop()!;
      const idxWj = conf.buffer[0]!;
      conf.buffer[0] = idxWi;
      conf.arcs.push([idxWi, relation, idxWj]);
    } else {
      const idxWi = conf.stack[conf.stack.length - 1]!;
      const idxWj = conf.buffer.shift()!;
      conf.stack.push(idxWj);
      conf.arcs.push([idxWi, relation, idxWj]);
    }
    return undefined;
  }

  rightArc(conf: Configuration, relation: string): -1 | undefined {
    return this.right_arc(conf, relation);
  }

  reduce(conf: Configuration): -1 | undefined {
    if (this.algo !== ARC_EAGER) return -1;
    if (conf.stack.length <= 0) return -1;
    const idxWi = conf.stack[conf.stack.length - 1]!;
    let flag = false;
    for (const [, , idxChild] of conf.arcs) {
      if (idxChild === idxWi) flag = true;
    }
    if (flag) {
      conf.stack.pop();
    } else {
      return -1;
    }
    return undefined;
  }

  shift(conf: Configuration): -1 | undefined {
    if (conf.buffer.length <= 0) return -1;
    const idxWi = conf.buffer.shift()!;
    conf.stack.push(idxWi);
    return undefined;
  }
}

// ---- nltk.parse.projectivedependencyparser span cells -----------------------

function spanKeyCompare(a: DependencySpan, b: DependencySpan): number {
  const ka = a.comparisonTuple();
  const kb = b.comparisonTuple();
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  if (ka[2] !== kb[2]) return ka[2] - kb[2];
  const len = Math.min(ka[3].length, kb[3].length);
  for (let i = 0; i < len; i++) {
    if (ka[3][i] !== kb[3][i]) return ka[3][i]! - kb[3][i]!;
  }
  return ka[3].length - kb[3].length;
}

/** nltk.parse.projectivedependencyparser.DependencySpan. */
export class DependencySpan {
  private readonly startIndex: number;
  private readonly endIndex: number;
  private readonly headIndex: number;
  private readonly arcs: readonly number[];
  private readonly tags: readonly string[];

  constructor(startIndex: number, endIndex: number, headIndex: number, arcs: readonly number[], tags: readonly string[]) {
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.headIndex = headIndex;
    this.arcs = [...arcs];
    this.tags = [...tags];
  }

  head_index(): number {
    return this.headIndex;
  }

  get start_index(): number {
    return this.startIndex;
  }

  get end_index(): number {
    return this.endIndex;
  }

  get span_arcs(): readonly number[] {
    return this.arcs;
  }

  get span_tags(): readonly string[] {
    return this.tags;
  }

  /** The (start, end, head, tuple(arcs)) comparison key Python orders on. */
  comparisonTuple(): readonly [number, number, number, readonly number[]] {
    return [this.startIndex, this.endIndex, this.headIndex, this.arcs];
  }

  /** Python __eq__ on the comparison key. */
  equals(other: unknown): boolean {
    return other instanceof DependencySpan && spanKeyCompare(this, other) === 0;
  }

  /** Python __lt__ on the comparison key. */
  lessThan(other: DependencySpan): boolean {
    if (!(other instanceof DependencySpan)) {
      throw pyError("TypeError", "unorderable types: DependencySpan() < other");
    }
    return spanKeyCompare(this, other) < 0;
  }

  /** Deterministic identity used by ChartCell's Python set semantics. */
  comparisonKey(): string {
    const [s, e, h, arcs] = this.comparisonTuple();
    return `${s}|${e}|${h}|${arcs.join(",")}`;
  }

  repr(): string {
    return `Span ${this.startIndex}-${this.endIndex}; Head Index: ${this.headIndex}`;
  }

  toString(): string {
    let str = this.repr();
    for (let i = 0; i < this.arcs.length; i++) {
      str += `\n${i} <- ${this.arcs[i]}, ${this.tags[i]}`;
    }
    return str;
  }
}

/** nltk.parse.projectivedependencyparser.ChartCell — dedups by span key like a Python set. */
export class ChartCell {
  private readonly x: number;
  private readonly y: number;
  private readonly entries = new Map<string, DependencySpan>();

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  add(span: DependencySpan): void {
    this.entries.set(span.comparisonKey(), span);
  }

  get size(): number {
    return this.entries.size;
  }

  values(): DependencySpan[] {
    return [...this.entries.values()];
  }

  toString(): string {
    return `CC[${this.x},${this.y}]: {${this.values().map((span) => span.repr()).join(", ")}}`;
  }
}

// ---- nltk.parse.nonprojectivedependencyparser scorers -----------------------

/** nltk.parse.nonprojectivedependencyparser.DependencyScorerI — abstract interface. */
export class DependencyScorerI {
  constructor() {
    if (new.target === DependencyScorerI) {
      throw pyError("TypeError", "DependencyScorerI is an abstract interface");
    }
  }

  train(_graphs: Iterable<DependencyGraph>): void {
    throw pyError("NotImplementedError", "DependencyScorerI.train");
  }

  score(_graph: DependencyGraph): number[][][] {
    throw pyError("NotImplementedError", "DependencyScorerI.score");
  }
}

/** nltk.parse.nonprojectivedependencyparser.DemoScorer — fixed Keith Hall matrix. */
export class DemoScorer extends DependencyScorerI {
  override train(_graphs: Iterable<DependencyGraph>): void {
    console.log("Training...");
  }

  override score(_graph: DependencyGraph): number[][][] {
    return [
      [[], [5], [1], [1]],
      [[], [], [11], [4]],
      [[], [10], [], [5]],
      [[], [8], [8], []],
    ];
  }
}

function nodeHasDependency(head: DependencyNode, childIndex: number): boolean {
  // NLTK checks `child_index in head_node["deps"]`; deps keys are relation
  // strings and a Python int never equals a str key, so this is always False.
  return Object.keys(head.deps).some((rel) => (rel as unknown) === childIndex);
}

function edgeFeatures(head: DependencyNode, child: DependencyNode): FeatureSet {
  return { a: head.word, b: head.tag, c: child.word, d: child.tag };
}

/** nltk.parse.nonprojectivedependencyparser.NaiveBayesDependencyScorer. */
export class NaiveBayesDependencyScorer extends DependencyScorerI {
  private classifier: NaiveBayesClassifier | null = null;

  override train(graphs: Iterable<DependencyGraph>): void {
    const labeled: LabeledFeatureset[] = [];
    for (const graph of graphs) {
      for (const headNode of graph.nodes) {
        if (!headNode) continue;
        for (let childIndex = 0; childIndex < graph.nodes.length; childIndex++) {
          const childNode = graph.nodes[childIndex];
          if (!childNode) continue;
          const label = nodeHasDependency(headNode, childIndex) ? "T" : "F";
          labeled.push([edgeFeatures(headNode, childNode), label]);
        }
      }
    }
    this.classifier = NaiveBayesClassifier.train(labeled);
  }

  override score(graph: DependencyGraph): number[][][] {
    if (!this.classifier) throw pyError("AttributeError", "'NaiveBayesDependencyScorer' object has no attribute 'classifier'");
    const edges: FeatureSet[] = [];
    for (const headNode of graph.nodes) {
      if (!headNode) continue;
      for (const childNode of graph.nodes) {
        if (!childNode) continue;
        edges.push(edgeFeatures(headNode, childNode));
      }
    }
    const pdists = this.classifier.prob_classify_many(edges);
    const edgeScores: number[][][] = [];
    let row: number[][] = [];
    let count = 0;
    const width = graph.nodes.length;
    for (const pdist of pdists) {
      row.push([Math.log(pdist.prob("T") + 0.00000000001)]);
      count += 1;
      if (count === width) {
        edgeScores.push(row);
        row = [];
        count = 0;
      }
    }
    return edgeScores;
  }
}

// ---- nltk.parse.pchart probabilistic edges / tree ---------------------------

/** nltk.parse.pchart.ProbabilisticTreeEdge — TreeEdge carrying an edge probability. */
export class ProbabilisticTreeEdge extends TreeEdge {
  private readonly probValue: number;

  constructor(prob: number, span: [number, number], lhs: GrammarSymbol, rhs: readonly GrammarSymbol[], dot = 0) {
    super(span, lhs, rhs, dot);
    this.probValue = prob;
  }

  prob(): number {
    return this.probValue;
  }

  override key(): string {
    return `${super.key()}|p:${this.probValue}`;
  }

  static override from_production(production: Production, index: number, p = 1.0): ProbabilisticTreeEdge {
    return new ProbabilisticTreeEdge(p, [index, index], production.lhs(), production.rhs(), 0);
  }

  static override fromProduction(production: Production, index: number, p = 1.0): ProbabilisticTreeEdge {
    return ProbabilisticTreeEdge.from_production(production, index, p);
  }

  override move_dot_forward(newEnd: number): ProbabilisticTreeEdge {
    return new ProbabilisticTreeEdge(this.probValue, [this.span()[0], newEnd], this.lhs(), this.rhs(), this.dot() + 1);
  }
}

/** nltk.parse.pchart.ProbabilisticLeafEdge — prob() is always 1.0. */
export class ProbabilisticLeafEdge extends LeafEdge {
  prob(): number {
    return 1.0;
  }
}

/**
 * nltk.parse.pchart.ProbabilisticTree / nltk.parse.viterbi.ProbabilisticTree —
 * Tree + ProbabilisticMixIn; constructor follows the runtime-first Tree
 * adaptation (runtime, node, children, then {prob|logprob}).
 */
export class ProbabilisticTree<L = string> extends Tree<L> {
  private probSlot: number | null = null;
  private logprobSlot: number | null = null;

  constructor(runtime: ParsingRuntime, node: string, children?: Iterable<Tree<L> | L>, probKwargs?: { prob?: number; logprob?: number }) {
    super(runtime, node, children);
    if (probKwargs?.prob !== undefined) {
      if (probKwargs.logprob !== undefined) {
        throw pyError("TypeError", "Must specify either prob or logprob (not both)");
      }
      this.set_prob(probKwargs.prob);
    } else if (probKwargs?.logprob !== undefined) {
      this.set_logprob(probKwargs.logprob);
    }
  }

  set_prob(prob: number): void {
    this.probSlot = prob;
    this.logprobSlot = null;
  }

  setProb(prob: number): void {
    this.set_prob(prob);
  }

  set_logprob(logprob: number): void {
    this.logprobSlot = logprob;
    this.probSlot = null;
  }

  setLogprob(logprob: number): void {
    this.set_logprob(logprob);
  }

  prob(): number | null {
    if (this.probSlot === null) {
      if (this.logprobSlot === null) return null;
      this.probSlot = 2 ** this.logprobSlot;
    }
    return this.probSlot;
  }

  logprob(): number | null {
    if (this.logprobSlot === null) {
      if (this.probSlot === null) return null;
      this.logprobSlot = Math.log2(this.probSlot);
    }
    return this.logprobSlot;
  }

  static override convert<L>(runtime: ParsingRuntime, value: Tree<L> | L): ProbabilisticTree<L> | L {
    if (value instanceof Tree) {
      const children = value.slice().map((child) => ProbabilisticTree.convert(runtime, child));
      const prob = value instanceof ProbabilisticTree ? (value.prob() ?? undefined) : 1.0;
      return new ProbabilisticTree(runtime, value.label(), children, { prob });
    }
    return value;
  }
}

// ---- nltk.parse.util.extract_test_sentences ---------------------------------

function pyInt(literal: string): number {
  const trimmed = literal.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) {
    throw pyError("ValueError", `invalid literal for int() with base 10: '${literal}'`);
  }
  return parseInt(trimmed, 10);
}

/** nltk.parse.util.extract_test_sentences — pure string parser. */
export function extract_test_sentences(
  input: string | Uint8Array,
  commentChars = "#%;",
  encoding?: string,
): Array<[string[], boolean | number | null]> {
  let string: string;
  if (typeof input === "string") {
    string = input;
  } else {
    if (encoding === undefined) {
      throw pyError("TypeError", "binary input requires an encoding");
    }
    string = new TextDecoder(encoding as ConstructorParameters<typeof TextDecoder>[0]).decode(input);
  }
  const sentences: Array<[string[], boolean | number | null]> = [];
  for (const rawLine of string.split("\n")) {
    let sentence = rawLine;
    if (sentence === "" || commentChars.includes(sentence[0]!)) continue;
    const colon = sentence.indexOf(":");
    let result: boolean | number | null = null;
    if (colon >= 0) {
      const prefix = sentence.slice(0, colon);
      if (["True", "true", "False", "false"].includes(prefix)) {
        result = ["True", "true"].includes(prefix);
        sentence = sentence.slice(colon + 1);
      } else {
        result = pyInt(prefix);
        sentence = sentence.slice(colon + 1);
      }
    }
    const tokens = sentence.split(/\s+/).filter((token) => token.length > 0);
    if (tokens.length === 0) continue;
    sentences.push([tokens, result]);
  }
  return sentences;
}

export function extractTestSentences(
  input: string | Uint8Array,
  commentChars = "#%;",
  encoding?: string,
): Array<[string[], boolean | number | null]> {
  return extract_test_sentences(input, commentChars, encoding);
}
