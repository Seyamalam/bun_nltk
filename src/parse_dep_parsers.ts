/**
 * Port of nltk.parse.projectivedependencyparser and
 * nltk.parse.nonprojectivedependencyparser (NLTK 3.10.3).
 *
 * ProjectiveDependencyParser: Eisner-style span-concatenation chart over a
 * DependencyGrammar. ProbabilisticProjectiveDependencyParser: same chart with
 * Eisner Model C scoring trained from DependencyGraphs.
 * NonprojectiveDependencyParser: exhaustive head-assignment lattice over a
 * DependencyGrammar (bounded by a wall-clock limit, like NLTK's max_time).
 * ProbabilisticNonprojectiveParser: McDonald(2005) MST parsing via Chu–Liu/
 * Edmonds cycle collapsing driven by a DependencyScorerI.
 */
import { DependencyGraph, type DependencyNode } from "./dependency_graph";
import type { DependencyGrammar } from "./grammar";
import { DependencyProduction, ProbabilisticDependencyGrammar, ProbabilisticProduction, Nonterminal } from "./grammar";
import { pyError } from "./internals";
import { ChartCell, DependencySpan, DependencyScorerI } from "./parse_dependency";
import type { ParseTree } from "./parse";

export const DEFAULT_MAX_TIME = 5.0;

type TokenizedTokens = string[];

function flattenDeps(node: DependencyNode): number[] {
  return Object.values(node.deps).flat();
}

function graphTreeParse(dg: DependencyGraph): ParseTree {
  return dg.tree() as ParseTree;
}

/** Python list comparison: a > b lexicographically (shorter prefix loses). */
function pyListGt(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i >= b.length) return true;
    if (i >= a.length) return false;
    if (a[i] !== b[i]) return a[i]! > b[i]!;
  }
  return false;
}

/** Port of projectivedependencyparser.ProjectiveDependencyParser. */
export class ProjectiveDependencyParser {
  /** See NLTK: O(n^2) chart + O(n^3) loop bound, CWE-407. */
  static MAX_TOKENS = 500;

  private _grammar: DependencyGrammar;
  private _tokens: string[] = [];

  constructor(dependency_grammar: DependencyGrammar) {
    this._grammar = dependency_grammar;
  }

  *parse(tokens: Iterable<string>): Generator<ParseTree> {
    this._tokens = tokens = [...tokens];
    if (this._tokens.length > ProjectiveDependencyParser.MAX_TOKENS) {
      throw pyError(
        "ValueError",
        `Cannot parse ${this._tokens.length} tokens: exceeds MAX_TOKENS (${ProjectiveDependencyParser.MAX_TOKENS}). Projective dependency parsing builds an O(n^2) chart and runs an O(n^3) loop regardless of the grammar (CWE-407); raise MAX_TOKENS to allow a longer sequence.`,
      );
    }
    const n = this._tokens.length;
    const chart: ChartCell[][] = [];
    for (let i = 0; i <= n; i++) {
      chart.push([]);
      for (let j = 0; j <= n; j++) {
        chart[i]!.push(new ChartCell(i, j));
        if (i === j + 1) chart[i]![j]!.add(new DependencySpan(i - 1, i, i - 1, [-1], ["null"]));
      }
    }
    for (let i = 1; i <= n; i++) {
      for (let j = i - 2; j >= 0; j--) {
        for (let k = i - 1; k > j; k--) {
          for (const span1 of chart[k]![j]!.values()) {
            for (const span2 of chart[i]![k]!.values()) {
              for (const newspan of this.concatenate(span1, span2)) {
                chart[i]![j]!.add(newspan);
              }
            }
          }
        }
      }
    }
    for (const parse of chart[n]![0]!.values()) {
      let conll = "";
      for (let i = 0; i < this._tokens.length; i++) {
        conll += `\t${i + 1}\t${this._tokens[i]}\t${this._tokens[i]}\tnull\tnull\tnull\t${parse.span_arcs[i]! + 1}\tROOT\t-\t-\n`;
      }
      const dg = new DependencyGraph(conll);
      yield graphTreeParse(dg);
    }
  }

  concatenate(span1: DependencySpan, span2: DependencySpan): DependencySpan[] {
    const spans: DependencySpan[] = [];
    if (span1.start_index === span2.start_index) {
      // NLTK prints instead of raising; keep silent (no stderr contract).
    }
    if (span1.start_index > span2.start_index) {
      const t = span1; span1 = span2; span2 = t;
    }
    let newArcs = [...span1.span_arcs, ...span2.span_arcs];
    let newTags = [...span1.span_tags, ...span2.span_tags];
    if (this._grammar.contains(
      this._tokens[span1.head_index()]!, this._tokens[span2.head_index()]!,
    )) {
      newArcs[span2.head_index() - span1.start_index] = span1.head_index();
      spans.push(new DependencySpan(span1.start_index, span2.end_index, span1.head_index(), newArcs, newTags));
    }
    newArcs = [...span1.span_arcs, ...span2.span_arcs];
    newTags = [...span1.span_tags, ...span2.span_tags];
    if (this._grammar.contains(
      this._tokens[span2.head_index()]!, this._tokens[span1.head_index()]!,
    )) {
      newArcs[span1.head_index() - span1.start_index] = span2.head_index();
      spans.push(new DependencySpan(span1.start_index, span2.end_index, span2.head_index(), newArcs, newTags));
    }
    return spans;
  }
}

/** Port of projectivedependencyparser.ProbabilisticProjectiveDependencyParser. */
export class ProbabilisticProjectiveDependencyParser {
  static MAX_TOKENS = 500;

  private _grammar: ProbabilisticDependencyGrammar | null = null;
  private _tokens: string[] = [];

  *parse(tokens: Iterable<string>): Generator<ParseTree> {
    this._tokens = tokens = [...tokens];
    if (this._tokens.length > ProbabilisticProjectiveDependencyParser.MAX_TOKENS) {
      throw pyError(
        "ValueError",
        `Cannot parse ${this._tokens.length} tokens: exceeds MAX_TOKENS (${ProbabilisticProjectiveDependencyParser.MAX_TOKENS}). Projective dependency decoding builds an O(n^2) chart and runs an O(n^3) loop regardless of the grammar (CWE-407); raise MAX_TOKENS to allow a longer sequence.`,
      );
    }
    const grammar = this._grammar;
    if (!grammar) return;
    const tagsOf = (word: string): Set<string> | undefined => {
      const t = (grammar as unknown as { _tags: Map<string, Set<string>> })._tags.get(word);
      return t;
    };
    const n = this._tokens.length;
    const chart: ChartCell[][] = [];
    for (let i = 0; i <= n; i++) {
      chart.push([]);
      for (let j = 0; j <= n; j++) {
        chart[i]!.push(new ChartCell(i, j));
        if (i === j + 1) {
          const tags = tagsOf(this._tokens[i - 1]!);
          if (tags) {
            for (const tag of tags) chart[i]![j]!.add(new DependencySpan(i - 1, i, i - 1, [-1], [tag]));
          } else {
            // NLTK prints and returns [] — yield nothing.
            return;
          }
        }
      }
    }
    for (let i = 1; i <= n; i++) {
      for (let j = i - 2; j >= 0; j--) {
        for (let k = i - 1; k > j; k--) {
          for (const span1 of chart[k]![j]!.values()) {
            for (const span2 of chart[i]![k]!.values()) {
              for (const newspan of this.concatenate(span1, span2)) {
                chart[i]![j]!.add(newspan);
              }
            }
          }
        }
      }
    }
    const trees: Array<[number, ParseTree]> = [];
    for (const parse of chart[n]![0]!.values()) {
      let conll = "";
      for (let i = 0; i < this._tokens.length; i++) {
        conll += `\t${i + 1}\t${this._tokens[i]}\t${this._tokens[i]}\t${parse.span_tags[i]}\t${parse.span_tags[i]}\tnull\t${parse.span_arcs[i]! + 1}\tROOT\t-\t-\n`;
      }
      const dg = new DependencyGraph(conll);
      trees.push([this.compute_prob(dg), graphTreeParse(dg)]);
    }
    // NLTK trees.sort() sorts tuples ascending by score, then tree.
    trees.sort((a, b) => a[0] - b[0]);
    for (const [, tree] of trees) yield tree;
  }

  concatenate(span1: DependencySpan, span2: DependencySpan): DependencySpan[] {
    const spans: DependencySpan[] = [];
    if (span1.start_index === span2.start_index) {
      // NLTK prints instead of raising.
    }
    if (span1.start_index > span2.start_index) {
      const t = span1; span1 = span2; span2 = t;
    }
    const grammar = this._grammar!;
    let newArcs = [...span1.span_arcs, ...span2.span_arcs];
    let newTags = [...span1.span_tags, ...span2.span_tags];
    if (grammar.contains(
      this._tokens[span1.head_index()]!, this._tokens[span2.head_index()]!,
    )) {
      newArcs[span2.head_index() - span1.start_index] = span1.head_index();
      spans.push(new DependencySpan(span1.start_index, span2.end_index, span1.head_index(), newArcs, newTags));
    }
    newArcs = [...span1.span_arcs, ...span2.span_arcs];
    newTags = [...span1.span_tags, ...span2.span_tags];
    if (grammar.contains(
      this._tokens[span2.head_index()]!, this._tokens[span1.head_index()]!,
    )) {
      newArcs[span1.head_index() - span1.start_index] = span2.head_index();
      spans.push(new DependencySpan(span1.start_index, span2.end_index, span2.head_index(), newArcs, newTags));
    }
    return spans;
  }

  /** Port of train(): Eisner Model C event counting over DependencyGraphs. */
  train(graphs: Iterable<DependencyGraph>): void {
    const productions: DependencyProduction[] = [];
    const events = new Map<string, number>();
    const tags = new Map<string, Set<string>>();
    for (const dg of graphs) {
      for (let nodeIndex = 1; nodeIndex < dg.nodes.length; nodeIndex++) {
        const node = dg.nodes[nodeIndex]!;
        const children = flattenDeps(node);
        const nrLeftChildren = dg.left_children(nodeIndex);
        const nrRightChildren = dg.right_children(nodeIndex);
        const nrChildren = nrLeftChildren + nrRightChildren;
        for (let childIndex = -(nrLeftChildren + 1); childIndex < nrRightChildren + 2; childIndex++) {
          const headWord = node.word!;
          const headTag = node.tag!;
          let wordTags = tags.get(headWord);
          if (!wordTags) { wordTags = new Set(); tags.set(headWord, wordTags); }
          wordTags.add(headTag);
          let child = "STOP";
          let childTag = "STOP";
          let prevTag = "START";
          if (childIndex < 0) {
            const arrayIndex = childIndex + nrLeftChildren;
            if (arrayIndex >= 0) {
              child = dg.nodes[children[arrayIndex]!]!.word!;
              childTag = dg.nodes[children[arrayIndex]!]!.tag!;
            }
            if (childIndex !== -1) {
              prevTag = dg.nodes[children[arrayIndex + 1]!]!.tag!;
            }
            if (child !== "STOP") productions.push(new DependencyProduction(new Nonterminal(headWord), [child]));
            const headEvent = `(head (${child} ${childTag}) (mods (${prevTag}, ${headWord}, ${headTag}) left))`;
            const modEvent = `(mods (${prevTag}, ${headWord}, ${headTag}) left))`;
            events.set(headEvent, (events.get(headEvent) ?? 0) + 1);
            events.set(modEvent, (events.get(modEvent) ?? 0) + 1);
          } else if (childIndex > 0) {
            const arrayIndex = childIndex + nrLeftChildren - 1;
            if (arrayIndex < nrChildren) {
              child = dg.nodes[children[arrayIndex]!]!.word!;
              childTag = dg.nodes[children[arrayIndex]!]!.tag!;
            }
            if (childIndex !== 1) {
              prevTag = dg.nodes[children[arrayIndex - 1]!]!.tag!;
            }
            if (child !== "STOP") productions.push(new DependencyProduction(new Nonterminal(headWord), [child]));
            const headEvent = `(head (${child} ${childTag}) (mods (${prevTag}, ${headWord}, ${headTag}) right))`;
            const modEvent = `(mods (${prevTag}, ${headWord}, ${headTag}) right))`;
            events.set(headEvent, (events.get(headEvent) ?? 0) + 1);
            events.set(modEvent, (events.get(modEvent) ?? 0) + 1);
          }
        }
      }
    }
    this._grammar = new ProbabilisticDependencyGrammar(
      productions as unknown as ProbabilisticProduction[],
      events,
      tags as Map<string, unknown>,
    );
  }

  /** Port of compute_prob(): product of head/mod event ratios, 1e-8 fallback. */
  compute_prob(dg: DependencyGraph): number {
    const events = (this._grammar as unknown as { _events: Map<string, number> })._events;
    let prob = 1.0;
    for (let nodeIndex = 1; nodeIndex < dg.nodes.length; nodeIndex++) {
      const node = dg.nodes[nodeIndex]!;
      const children = flattenDeps(node);
      const nrLeftChildren = dg.left_children(nodeIndex);
      const nrRightChildren = dg.right_children(nodeIndex);
      const nrChildren = nrLeftChildren + nrRightChildren;
      for (let childIndex = -(nrLeftChildren + 1); childIndex < nrRightChildren + 2; childIndex++) {
        const headWord = node.word!;
        const headTag = node.tag!;
        let child = "STOP";
        let childTag = "STOP";
        let prevTag = "START";
        if (childIndex < 0) {
          const arrayIndex = childIndex + nrLeftChildren;
          if (arrayIndex >= 0) {
            child = dg.nodes[children[arrayIndex]!]!.word!;
            childTag = dg.nodes[children[arrayIndex]!]!.tag!;
          }
          if (childIndex !== -1) {
            prevTag = dg.nodes[children[arrayIndex + 1]!]!.tag!;
          }
          const headEvent = `(head (${child} ${childTag}) (mods (${prevTag}, ${headWord}, ${headTag}) left))`;
          const modEvent = `(mods (${prevTag}, ${headWord}, ${headTag}) left))`;
          const hCount = events.get(headEvent) ?? 0;
          const mCount = events.get(modEvent) ?? 0;
          if (mCount !== 0) prob *= hCount / mCount;
          else prob = 0.00000001;
        } else if (childIndex > 0) {
          const arrayIndex = childIndex + nrLeftChildren - 1;
          if (arrayIndex < nrChildren) {
            child = dg.nodes[children[arrayIndex]!]!.word!;
            childTag = dg.nodes[children[arrayIndex]!]!.tag!;
          }
          if (childIndex !== 1) {
            prevTag = dg.nodes[children[arrayIndex - 1]!]!.tag!;
          }
          const headEvent = `(head (${child} ${childTag}) (mods (${prevTag}, ${headWord}, ${headTag}) right))`;
          const modEvent = `(mods (${prevTag}, ${headWord}, ${headTag}) right))`;
          const hCount = events.get(headEvent) ?? 0;
          const mCount = events.get(modEvent) ?? 0;
          if (mCount !== 0) prob *= hCount / mCount;
          else prob = 0.00000001;
        }
      }
    }
    return prob;
  }
}

/** Port of nonprojectivedependencyparser.NonprojectiveDependencyParser. */
export class NonprojectiveDependencyParser {
  private _grammar: DependencyGrammar;
  private _maxTime: number | null;

  constructor(dependency_grammar: DependencyGrammar, max_time: number | null = DEFAULT_MAX_TIME) {
    this._grammar = dependency_grammar;
    this._maxTime = max_time;
  }

  *parse(tokens: TokenizedTokens): Generator<DependencyGraph> {
    // Oracle: graph.nodes[index].update({word, rel: "NTOP", address}) — index 0
    // clobbers TOP's word/rel while keeping its "TOP" ctag/tag.
    const graph = new DependencyGraph();
    for (let index = 0; index < tokens.length; index++) {
      graph.update_node(index, { word: tokens[index]!, rel: "NTOP", address: index });
    }
    for (const headNode of graph.nodes) {
      if (!headNode) continue;
      const deps: number[] = [];
      for (const depNode of graph.nodes) {
        if (!depNode) continue;
        if (this._grammar.contains(headNode.word!, depNode.word!) && headNode.word !== depNode.word) {
          deps.push(depNode.address as number);
        }
      }
      headNode.deps = deps as unknown as Record<string, number[]>;
    }

    // Lattice of possible heads
    const roots: number[] = [];
    const possibleHeads: number[][] = [];
    for (let i = 0; i < tokens.length; i++) {
      const heads: number[] = [];
      for (let j = 0; j < tokens.length; j++) {
        if (i !== j && this._grammar.contains(tokens[j]!, tokens[i]!)) heads.push(j);
      }
      if (heads.length === 0) roots.push(i);
      possibleHeads.push(heads);
    }

    const analyses: number[][] = [];
    if (roots.length < 2) {
      if (roots.length === 0) {
        for (let i = 0; i < tokens.length; i++) roots.push(i);
      }
      const stack: Array<[number, number]> = [];
      const analysis: number[] = Array.from({ length: possibleHeads.length });
      const deadline = this._maxTime === null ? null : performance.now() + this._maxTime * 1000;
      let i = 0;
      let forward = true;
      while (i >= 0) {
        if (deadline !== null && performance.now() > deadline) {
          throw pyError(
            "TimeoutError",
            `NonprojectiveDependencyParser exceeded its ${this._maxTime}s time limit; the grammar may be too dense for this many tokens. Pass max_time=None to disable the limit.`,
          );
        }
        if (forward) {
          if (possibleHeads[i]!.length === 1) {
            analysis[i] = possibleHeads[i]![0]!;
          } else if (possibleHeads[i]!.length === 0) {
            analysis[i] = -1;
          } else {
            const head = possibleHeads[i]!.pop()!;
            analysis[i] = head;
            stack.push([i, head]);
          }
        } else {
          let indexOnStack = false;
          for (const stackItem of stack) {
            if (stackItem[0] === i) indexOnStack = true;
          }
          const origLength = possibleHeads[i]!.length;
          if (indexOnStack && origLength === 0) {
            for (let j = stack.length - 1; j >= 0; j--) {
              const stackItem = stack[j]!;
              if (stackItem[0] === i) {
                possibleHeads[i]!.push(stack.splice(j, 1)[0]![1]);
              }
            }
          } else if (indexOnStack && origLength > 0) {
            const head = possibleHeads[i]!.pop()!;
            analysis[i] = head;
            stack.push([i, head]);
            forward = true;
          }
        }
        if (i + 1 === possibleHeads.length) {
          analyses.push([...analysis]);
          forward = false;
        }
        if (forward) i += 1;
        else i -= 1;
      }
    }

    // Filter parses: exactly one root, everything has one head.
    for (const analysis of analyses) {
      if (analysis.filter((a) => a === -1).length > 1) continue;
      const out = new DependencyGraph();
      const rootIndex = analysis.indexOf(-1);
      out.root = out.ensure_node(rootIndex + 1);
      for (const [address, pair] of analysis.entries()) {
        const token = tokens[address]!;
        const headIndex = pair;
        const headAddress = headIndex + 1;
        out.update_node(address + 1, { word: token, address: address + 1 });
        const rel = headAddress === 0 ? "ROOT" : "";
        const headNode = out.ensure_node(headIndex + 1);
        headNode.deps[rel] = headNode.deps[rel] ?? [];
        headNode.deps[rel]!.push(address + 1);
      }
      yield out;
    }
  }
}

/** Port of nonprojectivedependencyparser.ProbabilisticNonprojectiveParser (MST). */
export class ProbabilisticNonprojectiveParser {
  private _scorer: DependencyScorerI | null = null;
  scores: number[][][] = [];
  private innerNodes: Record<number, number[]> = {};

  train(graphs: Iterable<DependencyGraph>, dependency_scorer: DependencyScorerI): void {
    this._scorer = dependency_scorer;
    this._scorer.train(graphs);
  }

  initialize_edge_scores(graph: DependencyGraph): void {
    this.scores = this._scorer!.score(graph);
  }

  collapse_nodes(newNode: Partial<DependencyNode> & { address: number }, cyclePath: number[], gGraph: DependencyGraph, _bGraph: DependencyGraph, _cGraph: DependencyGraph): void {
    for (const cycleNodeIndex of cyclePath) {
      gGraph.remove_by_address(cycleNodeIndex);
    }
    gGraph.add_node(newNode);
    gGraph.redirect_arcs(cyclePath, newNode.address);
  }

  update_edge_scores(_newNode: Partial<DependencyNode> & { address: number }, cyclePath: number[]): void {
    const originals = this.compute_original_indexes(cyclePath);
    for (let i = 0; i < this.scores.length; i++) {
      for (let j = 0; j < this.scores[i]!.length; j++) {
        if (originals.includes(j) && !originals.includes(i) && this.scores[i]![j]!.length) {
          const subtractVal = this.compute_max_subtract_score(j, originals);
          this.scores[i]![j] = this.scores[i]![j]!.map((v) => v - subtractVal);
        }
      }
    }
    for (let i = 0; i < this.scores.length; i++) {
      for (let j = 0; j < this.scores[i]!.length; j++) {
        if (originals.includes(i) && originals.includes(j)) this.scores[i]![j] = [];
      }
    }
  }

  compute_original_indexes(newIndexes: number[]): number[] {
    let swapped = true;
    while (swapped) {
      const originals: number[] = [];
      swapped = false;
      for (const newIndex of newIndexes) {
        if (newIndex in this.innerNodes) {
          for (const oldVal of this.innerNodes[newIndex]!) {
            if (!originals.includes(oldVal)) {
              originals.push(oldVal);
              swapped = true;
            }
          }
        } else {
          originals.push(newIndex);
        }
      }
      newIndexes = originals;
    }
    return newIndexes;
  }

  compute_max_subtract_score(columnIndex: number, cycleIndexes: number[]): number {
    let maxScore = -100000;
    for (const rowIndex of cycleIndexes) {
      for (const subtractVal of this.scores[rowIndex]![columnIndex] ?? []) {
        if (subtractVal > maxScore) maxScore = subtractVal;
      }
    }
    return maxScore;
  }

  best_incoming_arc(nodeIndex: number): number {
    const originals = this.compute_original_indexes([nodeIndex]);
    let maxArc: number | null = null;
    let maxScore: number[] | null = null;
    for (let rowIndex = 0; rowIndex < this.scores.length; rowIndex++) {
      for (let colIndex = 0; colIndex < this.scores[rowIndex]!.length; colIndex++) {
        const cell = this.scores[rowIndex]![colIndex]!;
        if (originals.includes(colIndex) && (maxScore === null || pyListGt(cell, maxScore))) {
          maxScore = cell;
          maxArc = rowIndex;
        }
      }
    }
    for (const key of Object.keys(this.innerNodes)) {
      const replacedNodes = this.innerNodes[Number(key)]!;
      if (replacedNodes.includes(maxArc!)) return Number(key);
    }
    return maxArc!;
  }

  original_best_arc(nodeIndex: number): [number, number] {
    const originals = this.compute_original_indexes([nodeIndex]);
    let maxArc: number | null = null;
    let maxScore: number[] | null = null;
    let maxOrig: number | null = null;
    for (let rowIndex = 0; rowIndex < this.scores.length; rowIndex++) {
      for (let colIndex = 0; colIndex < this.scores[rowIndex]!.length; colIndex++) {
        const cell = this.scores[rowIndex]![colIndex]!;
        if (originals.includes(colIndex) && (maxScore === null || pyListGt(cell, maxScore))) {
          maxScore = cell;
          maxArc = rowIndex;
          maxOrig = colIndex;
        }
      }
    }
    return [maxArc!, maxOrig!];
  }

  *parse(tokens: string[], tags: (string | null)[]): Generator<DependencyGraph> {
    this.innerNodes = {};

    const gGraph = new DependencyGraph();
    for (let index = 0; index < tokens.length; index++) {
      gGraph.update_node(index + 1, { word: tokens[index]!, tag: tags[index] ?? null, rel: "NTOP", address: index + 1 });
    }
    gGraph.connect_graph();

    const originalGraph = new DependencyGraph();
    for (let index = 0; index < tokens.length; index++) {
      originalGraph.update_node(index + 1, { word: tokens[index]!, tag: tags[index] ?? null, rel: "NTOP", address: index + 1 });
    }

    const bGraph = new DependencyGraph();
    const cGraph = new DependencyGraph();
    for (let index = 0; index < tokens.length; index++) {
      cGraph.update_node(index + 1, { word: tokens[index]!, tag: tags[index] ?? null, rel: "NTOP", address: index + 1 });
    }

    this.initialize_edge_scores(gGraph);

    const unvisitedVertices = cGraph.nodes.filter(Boolean).map((v) => v!.address);
    let nrVertices = tokens.length;
    const betas: Record<number, [number, number]> = {};
    while (unvisitedVertices.length) {
      const currentVertex = unvisitedVertices.shift()!;
      gGraph.get_by_address(currentVertex);
      const bestInEdge = this.best_incoming_arc(currentVertex);
      betas[currentVertex] = this.original_best_arc(currentVertex);
      for (const newVertex of [currentVertex, bestInEdge]) {
        bGraph.update_node(newVertex, { word: "TEMP", rel: "NTOP", address: newVertex });
      }
      bGraph.add_arc(bestInEdge, currentVertex);
      const cyclePath = bGraph.contains_cycle();
      if (cyclePath) {
        const newNode = { word: "NONE", rel: "NTOP", address: nrVertices + 1 } as Partial<DependencyNode> & { address: number };
        cGraph.add_node(newNode);
        this.update_edge_scores(newNode, cyclePath);
        this.collapse_nodes(newNode, cyclePath, gGraph, bGraph, cGraph);
        for (const cycleIndex of cyclePath) {
          cGraph.add_arc(newNode.address, cycleIndex);
        }
        this.innerNodes[newNode.address] = cyclePath;
        unvisitedVertices.unshift(nrVertices + 1);
        nrVertices += 1;
        for (const cycleNodeAddress of cyclePath) {
          bGraph.remove_by_address(cycleNodeAddress);
        }
      }
    }

    for (let i = tokens.length + 1; i < nrVertices + 1; i++) {
      betas[betas[i]![1]] = betas[i]!;
    }
    for (const node of originalGraph.nodes) {
      if (node) node.deps = {};
    }
    for (let i = 1; i < tokens.length + 1; i++) {
      originalGraph.add_arc(betas[i]![0], betas[i]![1]);
    }
    yield originalGraph;
  }
}
