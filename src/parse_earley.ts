/**
 * Port of nltk.parse.earleychart (NLTK 3.10.3): incremental chart parsers.
 *
 * IncrementalChart buckets edges by end position; IncrementalChartParser
 * processes all edges ending at position i before any ending at j. The
 * Earley strategy (top-down init + predictor/scanner/completer) plus
 * top-down/bottom-up/left-corner incremental strategies are ported, along
 * with the incremental rules that only combine edges sharing an end.
 *
 * Adaptation: parser constructors take an options object (strategy/trace/
 * traceChartWidth/chartClass) and grammar may be CFG, CfgGrammar, or a
 * grammar-string (toNltkGrammar-style coercion like parser_tagger_compat).
 */
import {
  AbstractChartRule, BottomUpPredictCombineRule, BottomUpPredictRule,
  CachedTopDownPredictRule, Chart, EmptyPredictRule, FilteredBottomUpPredictCombineRule,
  FilteredSingleEdgeFundamentalRule, LeafEdge, LeafInitRule, SingleEdgeFundamentalRule,
  TopDownInitRule, TreeEdge, type EdgeI,
} from "./chart";
import { CFG, Nonterminal, Production } from "./grammar";
import { pyError } from "./internals";
import type { CfgGrammar, ParseTree } from "./parse";
import type { ChartParserOptions } from "./chart";

// ---- nltk.parse.earleychart.IncrementalChart --------------------------------

/**
 * nltk.parse.earleychart.IncrementalChart — Chart whose edges are bucketed
 * by end position. select() requires `end` (oracle: select(end, **restr)).
 * The end-bucketed storage is emulated by the base Chart's restriction
 * indexes, which already key edges by end.
 */
export class IncrementalChart extends Chart {
  /**
   * Oracle signature ``select(end, **restrictions)``. Accepts either the
   * positional ``(end, restrictions)`` form or a restrictions object that
   * includes ``end`` (raises TypeError otherwise, matching the oracle's
   * missing-positional-argument failure).
   */
  override select(endOrRestrictions?: number | Record<string, unknown>, restrictions: Record<string, unknown> = {}): EdgeI[] {
    if (typeof endOrRestrictions === "number") {
      return super.select({ ...restrictions, end: endOrRestrictions });
    }
    if (endOrRestrictions === undefined || endOrRestrictions.end === undefined) {
      throw pyError("TypeError", "select() missing required positional argument: 'end'");
    }
    return super.select(endOrRestrictions);
  }
}

// ---- nltk.parse.earleychart incremental CFG rules ---------------------------

/**
 * nltk.parse.earleychart.CompleteFundamentalRule — SingleEdgeFundamentalRule
 * whose incomplete-edge direction only looks for *empty* complete edges
 * (start == end); non-empty completions are handled from the complete side.
 */
export class CompleteFundamentalRule extends SingleEdgeFundamentalRule {
  protected override *_applyIncomplete(chart: Chart, _grammar: CFG, leftEdge: EdgeI): Generator<EdgeI> {
    const end = leftEdge.end();
    for (const rightEdge of chart.select({ start: end, end: end, is_complete: true, lhs: leftEdge.nextsym() })) {
      const newEdge = (leftEdge as TreeEdge).move_dot_forward(rightEdge.end());
      if (chart.insert_with_backpointer(newEdge, leftEdge, rightEdge)) yield newEdge;
    }
  }
}

/** nltk.parse.earleychart.CompleterRule — applies the fundamental rule to non-leaf edges. */
export class CompleterRule extends CompleteFundamentalRule {
  private readonly _fundamentalRule = new CompleteFundamentalRule();

  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (!(edge instanceof LeafEdge)) {
      yield* this._fundamentalRule.apply(chart, grammar, edge);
    }
  }
}

/** nltk.parse.earleychart.ScannerRule — applies the fundamental rule to leaf edges. */
export class ScannerRule extends CompleteFundamentalRule {
  private readonly _fundamentalRule = new CompleteFundamentalRule();

  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge instanceof LeafEdge) {
      yield* this._fundamentalRule.apply(chart, grammar, edge);
    }
  }
}

/** nltk.parse.earleychart.PredictorRule — cached top-down prediction. */
export class PredictorRule extends CachedTopDownPredictRule {}

/**
 * nltk.parse.earleychart.FilteredCompleteFundamentalRule — filtered rule
 * that only processes complete edges (grammars without empty productions).
 */
export class FilteredCompleteFundamentalRule extends FilteredSingleEdgeFundamentalRule {
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_complete()) {
      yield* this._applyComplete(chart, grammar, edge);
    }
  }
}

// ---- nltk.parse.earleychart strategies --------------------------------------

export const EARLEY_STRATEGY = [
  new LeafInitRule(),
  new TopDownInitRule(),
  new CompleterRule(),
  new ScannerRule(),
  new PredictorRule(),
];
export const TD_INCREMENTAL_STRATEGY = [
  new LeafInitRule(),
  new TopDownInitRule(),
  new CachedTopDownPredictRule(),
  new CompleteFundamentalRule(),
];
export const BU_INCREMENTAL_STRATEGY = [
  new LeafInitRule(),
  new EmptyPredictRule(),
  new BottomUpPredictRule(),
  new CompleteFundamentalRule(),
];
export const BU_LC_INCREMENTAL_STRATEGY = [
  new LeafInitRule(),
  new EmptyPredictRule(),
  new BottomUpPredictCombineRule(),
  new CompleteFundamentalRule(),
];
export const LC_INCREMENTAL_STRATEGY = [
  new LeafInitRule(),
  new FilteredBottomUpPredictCombineRule(),
  new FilteredCompleteFundamentalRule(),
];

// ---- nltk.parse.earleychart.IncrementalChartParser --------------------------

export interface IncrementalChartParserOptions extends ChartParserOptions {
  chartClass?: new (tokens: Iterable<string>) => Chart;
}

function asNltkGrammar(grammar: CFG | CfgGrammar | string): CFG {
  if (grammar instanceof CFG) return grammar;
  if (typeof grammar === "string") return CFG.fromstring(grammar);
  const lhsSet = new Set(grammar.productions.map((p) => p.lhs));
  return new CFG(
    new Nonterminal(grammar.startSymbol),
    grammar.productions.map(
      (p) => new Production(new Nonterminal(p.lhs), p.rhs.map((s) => (lhsSet.has(s) ? new Nonterminal(s) : s))),
    ),
  );
}

type TreeFactory<T> = (label: string, children: Array<T | string>) => T;

/** nltk.parse.earleychart.IncrementalChartParser (base incremental parser). */
export class IncrementalChartParser {
  protected readonly _grammar: CFG;
  protected _trace: number;
  protected readonly _traceChartWidth: number;
  protected readonly _chartClass: new (tokens: Iterable<string>) => Chart;
  private readonly _axioms: AbstractChartRule[] = [];
  private readonly _inferenceRules: AbstractChartRule[] = [];

  constructor(
    grammar: CFG | CfgGrammar | string,
    options: IncrementalChartParserOptions = {},
  ) {
    const {
      strategy = BU_LC_INCREMENTAL_STRATEGY,
      trace = 0,
      traceChartWidth = 50,
      chartClass = IncrementalChart,
    } = options;
    this._grammar = asNltkGrammar(grammar);
    this._trace = trace;
    this._traceChartWidth = traceChartWidth;
    this._chartClass = chartClass;
    for (const rule of strategy) {
      if (rule.NUM_EDGES === 0) this._axioms.push(rule);
      else if (rule.NUM_EDGES === 1) this._inferenceRules.push(rule);
      else {
        throw pyError("ValueError", "Incremental inference rules must have NUM_EDGES == 0 or 1");
      }
    }
  }

  grammar(): CFG {
    return this._grammar;
  }

  trace(trace = 2): void {
    this._trace = trace;
  }

  private _traceNewEdges(chart: Chart, rule: AbstractChartRule, newEdges: EdgeI[], trace: number, edgeWidth: number): void {
    if (!trace) return;
    let printRuleHeader = trace > 1;
    for (const edge of newEdges) {
      if (printRuleHeader) {
        console.log(`${rule}:`);
        printRuleHeader = false;
      }
      console.log(chart.pretty_format_edge(edge, edgeWidth));
    }
  }

  /** nltk.parse.earleychart.IncrementalChartParser.chart_parse. */
  chart_parse(tokens: Iterable<string>, trace?: number): Chart {
    const tr = trace ?? this._trace;
    const toks = [...tokens];
    this._grammar.check_coverage(toks);
    const chart = new this._chartClass(toks);
    const grammar = this._grammar;
    const edgeWidth = Math.floor(this._traceChartWidth / (chart.num_leaves() + 1));
    if (tr) console.log(chart.pretty_format_leaves(edgeWidth));

    for (const axiom of this._axioms) {
      const newEdges = [...axiom.apply(chart, grammar)];
      this._traceNewEdges(chart, axiom, newEdges, tr, edgeWidth);
    }

    for (let end = 0; end <= chart.num_leaves(); end++) {
      if (tr > 1) console.log("\n* Processing queue:", end, "\n");
      const agenda = [...chart.select({ end })];
      while (agenda.length > 0) {
        const edge = agenda.pop()!;
        for (const rule of this._inferenceRules) {
          const newEdges = [...rule.apply(chart, grammar, edge)];
          this._traceNewEdges(chart, rule, newEdges, tr, edgeWidth);
          for (const newEdge of newEdges) {
            if (newEdge.end() === end) agenda.push(newEdge);
          }
        }
      }
    }
    return chart;
  }

  chartParse(tokens: Iterable<string>, trace?: number): Chart {
    return this.chart_parse(tokens, trace);
  }

  *iter_parse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): Generator<T> {
    const chart = this.chart_parse(tokens);
    yield* chart.parses(this._grammar.start(), treeClass);
  }

  *iterParse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): Generator<T> {
    yield* this.iter_parse(tokens, treeClass);
  }

  parse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[] {
    return [...this.iter_parse(tokens, treeClass)];
  }

  parse_one<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T | null {
    return this.parse(tokens, treeClass)[0] ?? null;
  }

  parseOne<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T | null {
    return this.parse_one(tokens, treeClass);
  }

  parse_all<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[] {
    return this.parse(tokens, treeClass);
  }

  parseAll<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[] {
    return this.parse_all(tokens, treeClass);
  }

  *parse_sents<T = ParseTree>(sents: Iterable<Iterable<string>>, treeClass?: TreeFactory<T>): Generator<T[]> {
    for (const sent of sents) yield this.parse(sent, treeClass);
  }

  parseSents<T = ParseTree>(sents: Iterable<Iterable<string>>, treeClass?: TreeFactory<T>): T[][] {
    return [...this.parse_sents(sents, treeClass)];
  }
}

// ---- nltk.parse.earleychart concrete incremental parsers ---------------------

/** nltk.parse.earleychart.EarleyChartParser — EARLEY_STRATEGY incremental parser. */
export class EarleyChartParser extends IncrementalChartParser {
  constructor(grammar: CFG | CfgGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: EARLEY_STRATEGY });
  }
}

/** nltk.parse.earleychart.IncrementalTopDownChartParser — TD_INCREMENTAL_STRATEGY. */
export class IncrementalTopDownChartParser extends IncrementalChartParser {
  constructor(grammar: CFG | CfgGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: TD_INCREMENTAL_STRATEGY });
  }
}

/** nltk.parse.earleychart.IncrementalBottomUpChartParser — BU_INCREMENTAL_STRATEGY. */
export class IncrementalBottomUpChartParser extends IncrementalChartParser {
  constructor(grammar: CFG | CfgGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: BU_INCREMENTAL_STRATEGY });
  }
}

/** nltk.parse.earleychart.IncrementalBottomUpLeftCornerChartParser — BU_LC_INCREMENTAL_STRATEGY. */
export class IncrementalBottomUpLeftCornerChartParser extends IncrementalChartParser {
  constructor(grammar: CFG | CfgGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: BU_LC_INCREMENTAL_STRATEGY });
  }
}

/** nltk.parse.earleychart.IncrementalLeftCornerChartParser — LC_INCREMENTAL_STRATEGY (nonempty grammars only). */
export class IncrementalLeftCornerChartParser extends IncrementalChartParser {
  constructor(grammar: CFG | CfgGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    const cfg = asNltkGrammar(grammar);
    if (!cfg.is_nonempty()) {
      throw pyError("ValueError", "IncrementalLeftCornerParser only works for grammars without empty productions.");
    }
    super(cfg, { ...options, strategy: LC_INCREMENTAL_STRATEGY });
  }
}
