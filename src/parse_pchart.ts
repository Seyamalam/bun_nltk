/**
 * Port of nltk.parse.pchart (NLTK 3.10.3): probabilistic chart parsers.
 *
 * BottomUpProbabilisticChartParser maintains an edge queue ordered by
 * subclass-defined sort_queue; InsideChartParser sorts by inside
 * probability, RandomChartParser shuffles, LongestChartParser sorts by
 * edge length, UnsortedChartParser leaves insertion order.
 *
 * Adaptation: parse() yields ParseTree objects carrying a `prob` field
 * (same shape as probabilisticChartParse) instead of runtime-backed
 * ProbabilisticTree objects, which need an async-loaded ParsingRuntime.
 */
import { AbstractChartRule, Chart, type EdgeI } from "./chart";
import type { CFG } from "./grammar";
import { Nonterminal, ProbabilisticProduction, PCFG } from "./grammar";
import { pyError } from "./internals";
import type { ParseTree } from "./parse";
import { ProbabilisticLeafEdge, ProbabilisticTreeEdge } from "./parse_dependency";

export type ProbabilisticParseTree = ParseTree & { prob?: number };

function probOf(edge: EdgeI): number {
  return (edge as ProbabilisticTreeEdge | ProbabilisticLeafEdge).prob();
}

function symEq(a: unknown, b: unknown): boolean {
  if (a instanceof Nonterminal && b instanceof Nonterminal) return a.symbol() === b.symbol();
  return a === b;
}

/** Port of pchart.ProbabilisticBottomUpInitRule. */
export class ProbabilisticBottomUpInitRule extends AbstractChartRule {
  readonly NUM_EDGES = 0;
  *apply(chart: Chart, _grammar: CFG): Generator<EdgeI> {
    for (let index = 0; index < chart.num_leaves(); index++) {
      const newEdge = new ProbabilisticLeafEdge(chart.leaf(index), index);
      if (chart.insert(newEdge, [])) yield newEdge;
    }
  }
}

/** Port of pchart.ProbabilisticBottomUpPredictRule. */
export class ProbabilisticBottomUpPredictRule extends AbstractChartRule {
  readonly NUM_EDGES = 1;
  *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_incomplete()) return;
    for (const prod of grammar.productions()) {
      if (prod.rhs().length > 0 && symEq(edge.lhs(), prod.rhs()[0])) {
        const prob = prod instanceof ProbabilisticProduction ? prod.prob() : 1.0;
        const newEdge = ProbabilisticTreeEdge.from_production(prod, edge.start(), prob);
        if (chart.insert(newEdge, [])) yield newEdge;
      }
    }
  }
}

/** Port of pchart.ProbabilisticFundamentalRule. */
export class ProbabilisticFundamentalRule extends AbstractChartRule {
  readonly NUM_EDGES = 2;
  *apply(chart: Chart, _grammar: CFG, leftEdge: EdgeI, rightEdge: EdgeI): Generator<EdgeI> {
    if (!(
      leftEdge.end() === rightEdge.start()
      && symEq(leftEdge.nextsym(), rightEdge.lhs())
      && leftEdge.is_incomplete()
      && rightEdge.is_complete()
    )) return;

    const p = probOf(leftEdge) * probOf(rightEdge);
    const newEdge = new ProbabilisticTreeEdge(
      p,
      [leftEdge.start(), rightEdge.end()],
      leftEdge.lhs(),
      leftEdge.rhs(),
      leftEdge.dot() + 1,
    );

    let changedChart = false;
    for (const cpl1 of chart.child_pointer_lists(leftEdge)) {
      if (chart.insert(newEdge, [...cpl1, rightEdge])) changedChart = true;
    }
    if (changedChart) yield newEdge;
  }
}

/** Port of pchart.SingleEdgeProbabilisticFundamentalRule. */
export class SingleEdgeProbabilisticFundamentalRule extends AbstractChartRule {
  readonly NUM_EDGES = 1;
  private readonly _fundamentalRule = new ProbabilisticFundamentalRule();

  *apply(chart: Chart, grammar: CFG, edge1: EdgeI): Generator<EdgeI> {
    const fr = this._fundamentalRule;
    if (edge1.is_incomplete()) {
      for (const edge2 of chart.select({ start: edge1.end(), is_complete: true, lhs: edge1.nextsym() })) {
        yield* fr.apply(chart, grammar, edge1, edge2);
      }
    } else {
      for (const edge2 of chart.select({ end: edge1.start(), is_complete: false, nextsym: edge1.lhs() })) {
        yield* fr.apply(chart, grammar, edge2, edge1);
      }
    }
  }

  override toString(): string {
    return "Fundamental Rule";
  }
}

/**
 * Port of pchart.BottomUpProbabilisticChartParser (abstract).
 * Subclasses implement sort_queue.
 */
export abstract class BottomUpProbabilisticChartParser {
  protected readonly _grammar: PCFG;
  readonly beam_size: number;
  protected _trace: number;

  constructor(grammar: PCFG, beam_size = 0, trace = 0) {
    if (!(grammar instanceof PCFG)) {
      throw pyError("ValueError", "The grammar must be probabilistic PCFG");
    }
    this._grammar = grammar;
    this.beam_size = beam_size;
    this._trace = trace;
  }

  grammar(): PCFG {
    return this._grammar;
  }

  trace(trace = 2): void {
    this._trace = trace;
  }

  abstract sort_queue(queue: EdgeI[], chart: Chart): void;

  protected _prune(queue: EdgeI[], _chart: Chart): void {
    if (queue.length > this.beam_size) {
      const split = queue.length - this.beam_size;
      if (this._trace > 2) {
        for (const edge of queue.slice(0, split)) {
          console.log(`  ${String(edge).padEnd(50)} [DISCARDED]`);
        }
      }
      queue.splice(0, split);
    }
  }

  *parse(tokens: Iterable<string>): Generator<ProbabilisticParseTree> {
    const toks = [...tokens];
    this._grammar.check_coverage(toks);
    const chart = new Chart(toks);
    const grammar = this._grammar;

    const buInit = new ProbabilisticBottomUpInitRule();
    const bu = new ProbabilisticBottomUpPredictRule();
    const fr = new SingleEdgeProbabilisticFundamentalRule();

    const queue: EdgeI[] = [];
    for (const edge of buInit.apply(chart, grammar)) {
      if (this._trace > 1) console.log(`  ${String(edge).padEnd(50)} [${probOf(edge)}]`);
      queue.push(edge);
    }

    while (queue.length > 0) {
      this.sort_queue(queue, chart);
      if (this.beam_size) this._prune(queue, chart);
      const edge = queue.pop()!;
      if (this._trace > 0) console.log(`  ${String(edge).padEnd(50)} [${probOf(edge)}]`);
      queue.push(...bu.apply(chart, grammar, edge));
      queue.push(...fr.apply(chart, grammar, edge));
    }

    const parses = chart.parses(grammar.start()) as unknown as Generator<ProbabilisticParseTree>;
    const parseList = [...parses];

    // prod_probs keyed by (lhs, rhs) like oracle's dict.
    const prodProbs = new Map<string, number>();
    for (const prod of grammar.productions()) {
      const key = `${prod.lhs().symbol()}|${prod.rhs().map((s) => (s instanceof Nonterminal ? `N:${s.symbol()}` : `T:${s}`)).join(",")}`;
      prodProbs.set(key, prod instanceof ProbabilisticProduction ? prod.prob() : 1.0);
    }
    for (const tree of parseList) this._setprob(tree, prodProbs);
    parseList.sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0));
    yield* parseList;
  }

  *parse_sents(sents: Iterable<Iterable<string>>): Generator<Generator<ProbabilisticParseTree>> {
    for (const sent of sents) yield this.parse(sent);
  }

  *parseSents(sents: Iterable<Iterable<string>>): Generator<Generator<ProbabilisticParseTree>> {
    yield* this.parse_sents(sents);
  }

  parse_one(tokens: Iterable<string>): ProbabilisticParseTree | null {
    return this.parse(tokens).next().value ?? null;
  }

  parseOne(tokens: Iterable<string>): ProbabilisticParseTree | null {
    return this.parse_one(tokens);
  }

  parse_all(tokens: Iterable<string>): ProbabilisticParseTree[] {
    return [...this.parse(tokens)];
  }

  parseAll(tokens: Iterable<string>): ProbabilisticParseTree[] {
    return this.parse_all(tokens);
  }

  private _setprob(tree: ProbabilisticParseTree, prodProbs: Map<string, number>): number {
    if (tree.prob !== undefined && tree.prob !== null) return tree.prob;
    const key = `${tree.label}|${tree.children.map((c) => (typeof c === "string" ? `T:${c}` : `N:${(c as ParseTree).label}`)).join(",")}`;
    let prob = prodProbs.get(key)!;
    for (const child of tree.children) {
      if (typeof child !== "string") prob *= this._setprob(child as ProbabilisticParseTree, prodProbs);
    }
    tree.prob = prob;
    return prob;
  }
}

/** Port of pchart.InsideChartParser — descending inside probability. */
export class InsideChartParser extends BottomUpProbabilisticChartParser {
  sort_queue(queue: EdgeI[], _chart: Chart): void {
    queue.sort((a, b) => probOf(a) - probOf(b));
  }
}

/** Port of pchart.RandomChartParser — random order via Python random.randint. */
export class RandomChartParser extends BottomUpProbabilisticChartParser {
  private readonly _rand: () => number;

  constructor(grammar: PCFG, beam_size = 0, trace = 0, rand: () => number = Math.random) {
    super(grammar, beam_size, trace);
    this._rand = rand;
  }

  sort_queue(queue: EdgeI[], _chart: Chart): void {
    // Oracle: i = random.randint(0, len(queue)-1); swap(queue[i], queue[-1]).
    const i = Math.floor(this._rand() * queue.length);
    const last = queue.length - 1;
    const tmp = queue[last]!;
    queue[last] = queue[i]!;
    queue[i] = tmp;
  }
}

/** Port of pchart.UnsortedChartParser — insertion order (LIFO pop). */
export class UnsortedChartParser extends BottomUpProbabilisticChartParser {
  sort_queue(_queue: EdgeI[], _chart: Chart): void {
    // Oracle sort_queue is a no-op.
  }
}

/** Port of pchart.LongestChartParser — longer edges first. */
export class LongestChartParser extends BottomUpProbabilisticChartParser {
  sort_queue(queue: EdgeI[], _chart: Chart): void {
    queue.sort((a, b) => a.length() - b.length());
  }
}
