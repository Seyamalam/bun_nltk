import { CFG, Nonterminal, Production, isNonterminal, type GrammarSymbol } from "./grammar";
import type { ParseTree } from "./parse";

export const MAX_PARSE_TREES = 1_000_000;

type EdgeKey = string;

function symKey(sym: GrammarSymbol | null | undefined): string {
  if (sym == null) return "none";
  return sym instanceof Nonterminal ? `nt:${sym.symbol()}` : `t:${sym}`;
}

function attrKey(value: unknown): string {
  if (value instanceof Nonterminal) return `nt:${value.symbol()}`;
  if (value == null) return "none";
  if (typeof value === "boolean") return `b:${value}`;
  if (typeof value === "number") return `n:${value}`;
  if (Array.isArray(value)) return `[${value.map(attrKey).join(",")}]`;
  return `t:${String(value)}`;
}

export abstract class EdgeI {
  abstract span(): [number, number];
  start(): number {
    return this.span()[0];
  }
  end(): number {
    return this.span()[1];
  }
  length(): number {
    return this.end() - this.start();
  }
  abstract lhs(): GrammarSymbol;
  abstract rhs(): readonly GrammarSymbol[];
  abstract dot(): number;
  abstract nextsym(): GrammarSymbol | null;
  abstract is_complete(): boolean;
  isComplete(): boolean {
    return this.is_complete();
  }
  is_incomplete(): boolean {
    return !this.is_complete();
  }
  isIncomplete(): boolean {
    return this.is_incomplete();
  }
  abstract key(): EdgeKey;
}

export class TreeEdge extends EdgeI {
  constructor(
    private readonly _span: [number, number],
    private readonly _lhs: GrammarSymbol,
    private readonly _rhs: readonly GrammarSymbol[],
    private readonly _dot = 0,
  ) {
    super();
  }

  static from_production(production: Production, index: number): TreeEdge {
    return new TreeEdge([index, index], production.lhs(), production.rhs(), 0);
  }

  static fromProduction(production: Production, index: number): TreeEdge {
    return TreeEdge.from_production(production, index);
  }

  move_dot_forward(newEnd: number): TreeEdge {
    return new TreeEdge([this._span[0], newEnd], this._lhs, this._rhs, this._dot + 1);
  }

  moveDotForward(newEnd: number): TreeEdge {
    return this.move_dot_forward(newEnd);
  }

  override lhs(): GrammarSymbol {
    return this._lhs;
  }
  override span(): [number, number] {
    return this._span;
  }
  rhs(): readonly GrammarSymbol[] {
    return [...this._rhs];
  }
  dot(): number {
    return this._dot;
  }
  is_complete(): boolean {
    return this._dot === this._rhs.length;
  }
  nextsym(): GrammarSymbol | null {
    return this._dot >= this._rhs.length ? null : this._rhs[this._dot]!;
  }
  key(): EdgeKey {
    return `T:${this._span[0]}:${this._span[1]}|${symKey(this._lhs)}|${this._rhs.map(symKey).join(",")}|${this._dot}`;
  }
  override toString(): string {
    let str = `[${this._span[0]}:${this._span[1]}] `;
    str += `${this._lhs instanceof Nonterminal ? this._lhs.symbol() : `'${this._lhs}'`} ->`.padEnd(0);
    for (let i = 0; i < this._rhs.length; i++) {
      if (i === this._dot) str += " *";
      const el = this._rhs[i]!;
      str += ` ${el instanceof Nonterminal ? el.symbol() : `'${el}'`}`;
    }
    if (this._rhs.length === this._dot) str += " *";
    return str;
  }
}

export class LeafEdge extends EdgeI {
  constructor(
    private readonly leaf: string,
    private readonly index: number,
  ) {
    super();
  }
  override lhs(): GrammarSymbol {
    return this.leaf;
  }
  override span(): [number, number] {
    return [this.index, this.index + 1];
  }
  rhs(): readonly GrammarSymbol[] {
    return [];
  }
  dot(): number {
    return 0;
  }
  is_complete(): boolean {
    return true;
  }
  nextsym(): GrammarSymbol | null {
    return null;
  }
  key(): EdgeKey {
    return `L:${this.leaf}|${this.index}`;
  }
  override toString(): string {
    return `[${this.index}:${this.index + 1}] '${this.leaf}'`;
  }
}

type TreeFactory<T> = (label: string, children: Array<T | string>) => T;

const defaultTreeFactory: TreeFactory<ParseTree> = (label, children) => ({ label, children: children as Array<ParseTree | string> });

export class Chart {
  private _tokens: string[];
  private _numLeaves: number;
  private _edges: EdgeI[] = [];
  private _edgeOrder = new Map<EdgeKey, EdgeI>();
  private _edgeToCpls = new Map<EdgeKey, Map<string, EdgeI[]>>();
  private _indexes = new Map<string, Map<string, EdgeI[]>>();

  constructor(tokens: Iterable<string>) {
    this._tokens = [...tokens];
    this._numLeaves = this._tokens.length;
    this.initialize();
  }

  initialize(): void {
    this._edges = [];
    this._edgeOrder = new Map();
    this._edgeToCpls = new Map();
    this._indexes = new Map();
  }

  num_leaves(): number {
    return this._numLeaves;
  }
  numLeaves(): number {
    return this._numLeaves;
  }
  leaf(index: number): string {
    return this._tokens[index]!;
  }
  leaves(): string[] {
    return [...this._tokens];
  }
  edges(): EdgeI[] {
    return [...this._edges];
  }
  iteredges(): IterableIterator<EdgeI> {
    return this._edges[Symbol.iterator]();
  }
  [Symbol.iterator](): IterableIterator<EdgeI> {
    return this.iteredges();
  }
  num_edges(): number {
    return this._edgeToCpls.size;
  }
  numEdges(): number {
    return this.num_edges();
  }

  select(restrictions: Record<string, unknown> = {}): EdgeI[] {
    const keys = Object.keys(restrictions).sort();
    if (keys.length === 0) return [...this._edges];
    const restrKey = keys.join("|");
    if (!this._indexes.has(restrKey)) this._addIndex(keys, restrKey);
    const valsKey = keys.map((k) => attrKey(restrictions[k])).join("|");
    return [...(this._indexes.get(restrKey)!.get(valsKey) ?? [])];
  }

  private _edgeAttr(edge: EdgeI, key: string): unknown {
    switch (key) {
      case "start": return edge.start();
      case "end": return edge.end();
      case "length": return edge.length();
      case "lhs": return edge.lhs();
      case "rhs": return edge.rhs();
      case "dot": return edge.dot();
      case "nextsym": return edge.nextsym();
      case "span": return edge.span();
      case "is_complete": return edge.is_complete();
      case "is_incomplete": return edge.is_incomplete();
      default: throw new Error(`Bad restriction: ${key}`);
    }
  }

  private _addIndex(keys: string[], restrKey: string): void {
    const index = new Map<string, EdgeI[]>();
    for (const edge of this._edges) {
      const valsKey = keys.map((k) => attrKey(this._edgeAttr(edge, k))).join("|");
      if (!index.has(valsKey)) index.set(valsKey, []);
      index.get(valsKey)!.push(edge);
    }
    this._indexes.set(restrKey, index);
  }

  private _registerWithIndexes(edge: EdgeI): void {
    for (const [restrKey, index] of this._indexes) {
      const keys = restrKey.split("|");
      const valsKey = keys.map((k) => attrKey(this._edgeAttr(edge, k))).join("|");
      if (!index.has(valsKey)) index.set(valsKey, []);
      index.get(valsKey)!.push(edge);
    }
  }

  insert_with_backpointer(newEdge: EdgeI, previousEdge: EdgeI, childEdge: EdgeI): boolean {
    const cpls = this.child_pointer_lists(previousEdge);
    const newCpls = cpls.map((cpl) => [...cpl, childEdge]);
    return this.insert(newEdge, ...newCpls);
  }

  insertWithBackpointer(newEdge: EdgeI, previousEdge: EdgeI, childEdge: EdgeI): boolean {
    return this.insert_with_backpointer(newEdge, previousEdge, childEdge);
  }

  insert(edge: EdgeI, ...childPointerLists: EdgeI[][]): boolean {
    const key = edge.key();
    if (!this._edgeToCpls.has(key)) {
      this._edges.push(edge);
      this._edgeOrder.set(key, edge);
      this._registerWithIndexes(edge);
    }
    let cpls = this._edgeToCpls.get(key);
    if (!cpls) {
      cpls = new Map();
      this._edgeToCpls.set(key, cpls);
    }
    let modified = false;
    for (const cpl of childPointerLists) {
      const cplKey = cpl.map((e) => e.key()).join(",");
      if (!cpls.has(cplKey)) {
        cpls.set(cplKey, cpl);
        modified = true;
      }
    }
    return modified;
  }

  child_pointer_lists(edge: EdgeI): EdgeI[][] {
    return [...(this._edgeToCpls.get(edge.key())?.values() ?? [])];
  }

  childPointerLists(edge: EdgeI): EdgeI[][] {
    return this.child_pointer_lists(edge);
  }

  *parses<T = ParseTree>(root: Nonterminal, treeClass: TreeFactory<T> = defaultTreeFactory as unknown as TreeFactory<T>): Generator<T> {
    for (const edge of this.select({ start: 0, end: this._numLeaves, lhs: root })) {
      yield* this.trees(edge, { treeClass, complete: true });
    }
  }

  trees<T = ParseTree>(edge: EdgeI, options: { treeClass?: TreeFactory<T>; complete?: boolean } = {}): T[] {
    const { treeClass = defaultTreeFactory as unknown as TreeFactory<T>, complete = false } = options;
    const budget = { remaining: MAX_PARSE_TREES };
    return this._trees(edge, complete, new Map(), treeClass, budget) as T[];
  }

  private _spend(budget: { remaining: number }): void {
    budget.remaining -= 1;
    if (budget.remaining < 0) {
      throw new Error(
        "Refusing to extract parse trees: a highly-ambiguous grammar can yield an exponential number of parses, and tree extraction exceeded the limit of 1000000 parse-tree nodes (CWE-770). Parse with a less ambiguous grammar or a shorter sentence, or raise nltk.parse.chart.MAX_PARSE_TREES.",
      );
    }
  }

  private _trees<T>(edge: EdgeI, complete: boolean, memo: Map<EdgeKey, Array<T | string>>, treeClass: TreeFactory<T>, budget: { remaining: number }): Array<T | string> {
    const key = edge.key();
    if (memo.has(key)) return memo.get(key)!;
    if (complete && edge.is_incomplete()) return [];
    if (edge instanceof LeafEdge) {
      const leaf = this._tokens[edge.start()]!;
      memo.set(key, [leaf]);
      return [leaf];
    }
    memo.set(key, []);
    const trees: T[] = [];
    const lhs = edge.lhs() instanceof Nonterminal ? (edge.lhs() as Nonterminal).symbol() : String(edge.lhs());
    for (const cpl of this.child_pointer_lists(edge)) {
      const childChoices = cpl.map((cp) => this._trees(cp, complete, memo, treeClass, budget));
      for (const children of cartesian(childChoices)) {
        this._spend(budget);
        trees.push(treeClass(lhs, children));
      }
    }
    if (edge.is_incomplete()) {
      const unexpanded: T[] = [];
      for (const elt of edge.rhs().slice(edge.dot())) {
        this._spend(budget);
        unexpanded.push(treeClass(elt instanceof Nonterminal ? elt.symbol() : String(elt), []));
      }
      for (const tree of trees) (tree as ParseTree).children.push(...(unexpanded as Array<ParseTree | string>));
    }
    memo.set(key, trees);
    return trees;
  }

  pretty_format_edge(edge: EdgeI, width?: number): string {
    const w = width ?? Math.floor(50 / (this._numLeaves + 1));
    const [start, end] = [edge.start(), edge.end()];
    let str = "|" + ("." + " ".repeat(w - 1)).repeat(start);
    if (start === end) {
      str += edge.is_complete() ? "#" : ">";
    } else if (edge.is_complete() && edge.span()[0] === 0 && edge.span()[1] === this._numLeaves) {
      str += "[" + "=".repeat(w).repeat(end - start - 1) + "=".repeat(w - 1) + "]";
    } else if (edge.is_complete()) {
      str += "[" + "-".repeat(w).repeat(end - start - 1) + "-".repeat(w - 1) + "]";
    } else {
      str += "[" + "-".repeat(w).repeat(end - start - 1) + "-".repeat(w - 1) + ">";
    }
    str += (" ".repeat(w - 1) + ".").repeat(this._numLeaves - end);
    return `${str}| ${edge}`;
  }

  prettyFormatEdge(edge: EdgeI, width?: number): string {
    return this.pretty_format_edge(edge, width);
  }

  pretty_format_leaves(width?: number): string {
    const w = width ?? Math.floor(50 / (this._numLeaves + 1));
    if (this._tokens != null && w > 1) {
      let header = "|.";
      for (const tok of this._tokens) header += center(tok.slice(0, w - 1), w - 1) + ".";
      header += "|";
      return header;
    }
    return "";
  }

  prettyFormatLeaves(width?: number): string {
    return this.pretty_format_leaves(width);
  }

  pretty_format(width?: number): string {
    const w = width ?? Math.floor(50 / (this._numLeaves + 1));
    const edges = [...this._edges].sort((a, b) => a.length() - b.length() || a.start() - b.start());
    return `${this.pretty_format_leaves(w)}\n${edges.map((e) => this.pretty_format_edge(e, w)).join("\n")}`;
  }

  prettyFormat(width?: number): string {
    return this.pretty_format(width);
  }
}

function center(text: string, width: number): string {
  const free = width - text.length;
  if (free <= 0) return text;
  const left = Math.floor(free / 2) + (free % 2 === 1 && width % 2 === 1 ? 1 : 0);
  return " ".repeat(left) + text + " ".repeat(free - left);
}

function cartesian<T>(choices: Array<T | string>[]): Array<Array<T | string>> {
  let acc: Array<Array<T | string>> = [[]];
  for (const choice of choices) {
    const next: Array<Array<T | string>> = [];
    for (const prefix of acc) for (const item of choice) next.push([...prefix, item]);
    acc = next;
  }
  return acc;
}

export abstract class AbstractChartRule {
  abstract readonly NUM_EDGES: number;
  abstract apply(chart: Chart, grammar: CFG, ...edges: EdgeI[]): Iterable<EdgeI>;
  *apply_everywhere(chart: Chart, grammar: CFG): Generator<EdgeI> {
    if (this.NUM_EDGES === 0) {
      yield* this.apply(chart, grammar);
    } else if (this.NUM_EDGES === 1) {
      for (const e1 of chart) yield* this.apply(chart, grammar, e1);
    } else if (this.NUM_EDGES === 2) {
      for (const e1 of chart) for (const e2 of chart) yield* this.apply(chart, grammar, e1, e2);
    } else if (this.NUM_EDGES === 3) {
      for (const e1 of chart) for (const e2 of chart) for (const e3 of chart) yield* this.apply(chart, grammar, e1, e2, e3);
    } else {
      throw new Error("NUM_EDGES>3 is not currently supported");
    }
  }
  applyEverywhere(chart: Chart, grammar: CFG): Generator<EdgeI> {
    return this.apply_everywhere(chart, grammar);
  }
  toString(): string {
    return this.constructor.name.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
}

function* fundamentalCombine(chart: Chart, leftEdge: EdgeI, rightEdge: EdgeI): Generator<EdgeI> {
  if (!(leftEdge.is_incomplete() && rightEdge.is_complete() && leftEdge.end() === rightEdge.start() && symKey(leftEdge.nextsym()) === symKey(rightEdge.lhs()))) return;
  const newEdge = leftEdge instanceof TreeEdge ? leftEdge.move_dot_forward(rightEdge.end()) : null;
  if (newEdge && chart.insert_with_backpointer(newEdge, leftEdge, rightEdge)) yield newEdge;
}

export class FundamentalRule extends AbstractChartRule {
  readonly NUM_EDGES: number = 2;
  *apply(chart: Chart, _grammar: CFG, leftEdge: EdgeI, rightEdge: EdgeI): Generator<EdgeI> {
    yield* fundamentalCombine(chart, leftEdge, rightEdge);
  }
}

export class SingleEdgeFundamentalRule extends FundamentalRule {
  override readonly NUM_EDGES: number = 1;
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_incomplete()) yield* this._applyIncomplete(chart, grammar, edge);
    else yield* this._applyComplete(chart, grammar, edge);
  }
  protected *_applyComplete(chart: Chart, _grammar: CFG, rightEdge: EdgeI): Generator<EdgeI> {
    for (const leftEdge of chart.select({ end: rightEdge.start(), is_complete: false, nextsym: rightEdge.lhs() })) {
      const newEdge = (leftEdge as TreeEdge).move_dot_forward(rightEdge.end());
      if (chart.insert_with_backpointer(newEdge, leftEdge, rightEdge)) yield newEdge;
    }
  }
  protected *_applyIncomplete(chart: Chart, _grammar: CFG, leftEdge: EdgeI): Generator<EdgeI> {
    for (const rightEdge of chart.select({ start: leftEdge.end(), is_complete: true, lhs: leftEdge.nextsym() })) {
      const newEdge = (leftEdge as TreeEdge).move_dot_forward(rightEdge.end());
      if (chart.insert_with_backpointer(newEdge, leftEdge, rightEdge)) yield newEdge;
    }
  }
}

export class LeafInitRule extends AbstractChartRule {
  readonly NUM_EDGES: number = 0;
  *apply(chart: Chart): Generator<EdgeI> {
    for (let index = 0; index < chart.num_leaves(); index++) {
      const newEdge = new LeafEdge(chart.leaf(index), index);
      if (chart.insert(newEdge, [])) yield newEdge;
    }
  }
}

export class TopDownInitRule extends AbstractChartRule {
  readonly NUM_EDGES: number = 0;
  *apply(chart: Chart, grammar: CFG): Generator<EdgeI> {
    for (const prod of grammar.productions({ lhs: grammar.start() })) {
      const newEdge = TreeEdge.from_production(prod, 0);
      if (chart.insert(newEdge, [])) yield newEdge;
    }
  }
}

export class TopDownPredictRule extends AbstractChartRule {
  readonly NUM_EDGES: number = 1;
  *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_complete()) return;
    for (const prod of grammar.productions({ lhs: edge.nextsym() as Nonterminal })) {
      const newEdge = TreeEdge.from_production(prod, edge.end());
      if (chart.insert(newEdge, [])) yield newEdge;
    }
  }
}

export class CachedTopDownPredictRule extends TopDownPredictRule {
  private done = new Map<string, [Chart, CFG]>();
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_complete()) return;
    const nextsym = edge.nextsym();
    if (!isNonterminal(nextsym)) return;
    const index = edge.end();
    const key = `${symKey(nextsym)}|${index}`;
    const done = this.done.get(key);
    if (done && done[0] === chart && done[1] === grammar) return;
    for (const prod of grammar.productions({ lhs: nextsym })) {
      const rhs = prod.rhs();
      if (rhs.length > 0) {
        const first = rhs[0]!;
        if (!(first instanceof Nonterminal)) {
          if (index >= chart.num_leaves() || first !== chart.leaf(index)) continue;
        }
      }
      const newEdge = TreeEdge.from_production(prod, index);
      if (chart.insert(newEdge, [])) yield newEdge;
    }
    this.done.set(key, [chart, grammar]);
  }
}

export class BottomUpPredictRule extends AbstractChartRule {
  readonly NUM_EDGES: number = 1;
  *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_incomplete()) return;
    for (const prod of grammar.productions({ rhs: edge.lhs() })) {
      const newEdge = TreeEdge.from_production(prod, edge.start());
      if (chart.insert(newEdge, [])) yield newEdge;
    }
  }
}

export class BottomUpPredictCombineRule extends BottomUpPredictRule {
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_incomplete()) return;
    for (const prod of grammar.productions({ rhs: edge.lhs() })) {
      const newEdge = new TreeEdge(edge.span(), prod.lhs(), prod.rhs(), 1);
      if (chart.insert(newEdge, [edge])) yield newEdge;
    }
  }
}

export class EmptyPredictRule extends AbstractChartRule {
  readonly NUM_EDGES: number = 0;
  *apply(chart: Chart, grammar: CFG): Generator<EdgeI> {
    for (const prod of grammar.productions({ empty: true })) {
      for (let index = 0; index < chart.num_leaves() + 1; index++) {
        const newEdge = TreeEdge.from_production(prod, index);
        if (chart.insert(newEdge, [])) yield newEdge;
      }
    }
  }
}

function bottomupFilter(grammar: CFG, nexttoken: string | false, rhs: readonly GrammarSymbol[], dot = 0): boolean {
  if (rhs.length <= dot + 1) return true;
  const next = rhs[dot + 1]!;
  if (!(next instanceof Nonterminal)) return nexttoken === next;
  return nexttoken !== false && grammar.is_leftcorner(next, nexttoken);
}

export class FilteredSingleEdgeFundamentalRule extends SingleEdgeFundamentalRule {
  protected override *_applyComplete(chart: Chart, grammar: CFG, rightEdge: EdgeI): Generator<EdgeI> {
    const end = rightEdge.end();
    const nexttoken = end < chart.num_leaves() ? chart.leaf(end) : false;
    for (const leftEdge of chart.select({ end: rightEdge.start(), is_complete: false, nextsym: rightEdge.lhs() })) {
      if (bottomupFilter(grammar, nexttoken, leftEdge.rhs(), leftEdge.dot())) {
        const newEdge = (leftEdge as TreeEdge).move_dot_forward(rightEdge.end());
        if (chart.insert_with_backpointer(newEdge, leftEdge, rightEdge)) yield newEdge;
      }
    }
  }
  protected override *_applyIncomplete(chart: Chart, grammar: CFG, leftEdge: EdgeI): Generator<EdgeI> {
    for (const rightEdge of chart.select({ start: leftEdge.end(), is_complete: true, lhs: leftEdge.nextsym() })) {
      const end = rightEdge.end();
      const nexttoken = end < chart.num_leaves() ? chart.leaf(end) : false;
      if (bottomupFilter(grammar, nexttoken, leftEdge.rhs(), leftEdge.dot())) {
        const newEdge = (leftEdge as TreeEdge).move_dot_forward(rightEdge.end());
        if (chart.insert_with_backpointer(newEdge, leftEdge, rightEdge)) yield newEdge;
      }
    }
  }
}

export class FilteredBottomUpPredictCombineRule extends BottomUpPredictCombineRule {
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_incomplete()) return;
    for (const prod of grammar.productions({ rhs: edge.lhs() })) {
      const nexttoken = edge.end() < chart.num_leaves() ? chart.leaf(edge.end()) : false;
      if (!bottomupFilter(grammar, nexttoken, prod.rhs(), 0)) continue;
      const newEdge = new TreeEdge(edge.span(), prod.lhs(), prod.rhs(), 1);
      if (chart.insert(newEdge, [edge])) yield newEdge;
    }
  }
}

export const TD_STRATEGY = [new LeafInitRule(), new TopDownInitRule(), new CachedTopDownPredictRule(), new SingleEdgeFundamentalRule()];
export const BU_STRATEGY = [new LeafInitRule(), new EmptyPredictRule(), new BottomUpPredictRule(), new SingleEdgeFundamentalRule()];
export const BU_LC_STRATEGY = [new LeafInitRule(), new EmptyPredictRule(), new BottomUpPredictCombineRule(), new SingleEdgeFundamentalRule()];
export const LC_STRATEGY = [new LeafInitRule(), new FilteredBottomUpPredictCombineRule(), new FilteredSingleEdgeFundamentalRule()];

export interface ChartParserOptions {
  strategy?: readonly AbstractChartRule[];
  trace?: number;
  traceChartWidth?: number;
  useAgenda?: boolean;
  chartClass?: new (tokens: Iterable<string>) => Chart;
}

export class NltkChartParser {
  protected _grammar: CFG;
  protected _strategy: readonly AbstractChartRule[];
  protected _trace: number;
  private readonly _traceChartWidth: number;
  private _useAgenda: boolean;
  private readonly _chartClass: new (tokens: Iterable<string>) => Chart;
  private readonly _axioms: AbstractChartRule[] = [];
  private readonly _inferenceRules: AbstractChartRule[] = [];

  constructor(grammar: CFG, options: ChartParserOptions = {}) {
    const { strategy = BU_LC_STRATEGY, trace = 0, traceChartWidth = 50, useAgenda = true, chartClass = Chart } = options;
    this._grammar = grammar;
    this._strategy = strategy;
    this._trace = trace;
    this._traceChartWidth = traceChartWidth;
    this._useAgenda = useAgenda;
    this._chartClass = chartClass;
    for (const rule of strategy) {
      if (rule.NUM_EDGES === 0) this._axioms.push(rule);
      else if (rule.NUM_EDGES === 1) this._inferenceRules.push(rule);
      else this._useAgenda = false;
    }
  }

  grammar(): CFG {
    return this._grammar;
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

  chart_parse(tokens: Iterable<string>, trace?: number): Chart {
    const tr = trace ?? this._trace;
    const toks = [...tokens];
    this._grammar.check_coverage(toks);
    const chart = new this._chartClass(toks);
    const grammar = this._grammar;
    const edgeWidth = Math.floor(this._traceChartWidth / (chart.num_leaves() + 1));
    if (tr) console.log(chart.pretty_format_leaves(edgeWidth));
    if (this._useAgenda) {
      for (const axiom of this._axioms) {
        const newEdges = [...axiom.apply(chart, grammar)];
        this._traceNewEdges(chart, axiom, newEdges, tr, edgeWidth);
      }
      const agenda = chart.edges();
      agenda.reverse();
      while (agenda.length > 0) {
        const edge = agenda.pop()!;
        for (const rule of this._inferenceRules) {
          const newEdges = [...rule.apply(chart, grammar, edge)];
          if (tr) this._traceNewEdges(chart, rule, newEdges, tr, edgeWidth);
          agenda.push(...newEdges);
        }
      }
    } else {
      let edgesAdded = true;
      while (edgesAdded) {
        edgesAdded = false;
        for (const rule of this._strategy) {
          const newEdges = [...rule.apply_everywhere(chart, grammar)];
          edgesAdded = newEdges.length > 0;
          this._traceNewEdges(chart, rule, newEdges, tr, edgeWidth);
        }
      }
    }
    return chart;
  }

  chartParse(tokens: Iterable<string>, trace?: number): Chart {
    return this.chart_parse(tokens, trace);
  }

  *iterParse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): Generator<T> {
    const chart = this.chart_parse(tokens);
    yield* chart.parses(this._grammar.start(), treeClass);
  }

  parse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[] {
    return [...this.iterParse(tokens, treeClass)];
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

export class TopDownChartParser extends NltkChartParser {
  constructor(grammar: CFG, options: Omit<ChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: TD_STRATEGY });
  }
}

export class BottomUpChartParser extends NltkChartParser {
  constructor(grammar: CFG, options: Omit<ChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: BU_STRATEGY });
  }
}

export class BottomUpLeftCornerChartParser extends NltkChartParser {
  constructor(grammar: CFG, options: Omit<ChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: BU_LC_STRATEGY });
  }
}

export class NltkLeftCornerChartParser extends NltkChartParser {
  constructor(grammar: CFG, options: Omit<ChartParserOptions, "strategy"> = {}) {
    if (!grammar.is_nonempty()) {
      throw new Error("LeftCornerParser only works for grammars without empty productions.");
    }
    super(grammar, { ...options, strategy: LC_STRATEGY });
  }
}

/** nltk.parse.chart.SteppingChartParser — step through parsing one edge at a time. */
export class SteppingChartParser extends NltkChartParser {
  private _chart: Chart | null = null;
  private _current_chartrule: AbstractChartRule | null = null;
  private _restart = false;

  constructor(grammar: CFG, options: ChartParserOptions = {}) {
    super(grammar, { ...options, strategy: options.strategy ?? [] });
  }

  initialize(tokens: Iterable<string>): void {
    this._chart = new Chart(tokens);
    this._restart = true;
  }

  *step(): Generator<EdgeI | null> {
    if (this._chart === null) throw new Error("Parser must be initialized first");
    while (true) {
      this._restart = false;
      const w = Math.floor(50 / (this._chart.num_leaves() + 1));
      let completed = true;
      for (const e of this._parse()) {
        if (this._trace > 1 && this._current_chartrule) console.log(`${this._current_chartrule}`);
        if (this._trace > 0) console.log(this._chart.pretty_format_edge(e, w));
        yield e;
        if (this._restart) {
          completed = false;
          break;
        }
      }
      if (completed) yield null;
    }
  }

  private *_parse(): Generator<EdgeI> {
    const chart = this._chart!;
    const grammar = this._grammar;
    let edges_added = 1;
    while (edges_added > 0) {
      edges_added = 0;
      for (const rule of this._strategy) {
        this._current_chartrule = rule;
        for (const e of rule.apply_everywhere(chart, grammar)) {
          edges_added += 1;
          yield e;
        }
      }
    }
  }

  strategy(): readonly AbstractChartRule[] {
    return this._strategy;
  }

  chart(): Chart | null {
    return this._chart;
  }

  current_chartrule(): AbstractChartRule | null {
    return this._current_chartrule;
  }

  *parses<T = ParseTree>(treeClass?: TreeFactory<T>): Generator<T> {
    yield* this._chart!.parses(this._grammar.start(), treeClass);
  }

  set_strategy(strategy: readonly AbstractChartRule[]): void {
    if (strategy === this._strategy) return;
    this._strategy = [...strategy];
    this._restart = true;
  }

  setStrategy(strategy: readonly AbstractChartRule[]): void {
    this.set_strategy(strategy);
  }

  set_grammar(grammar: CFG): void {
    if (grammar === this._grammar) return;
    this._grammar = grammar;
    this._restart = true;
  }

  setGrammar(grammar: CFG): void {
    this.set_grammar(grammar);
  }

  set_chart(chart: Chart): void {
    if (chart === this._chart) return;
    this._chart = chart;
    this._restart = true;
  }

  setChart(chart: Chart): void {
    this.set_chart(chart);
  }

  override parse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[] {
    const toks = [...tokens];
    this._grammar.check_coverage(toks);
    this.initialize(toks);
    for (const e of this.step()) {
      if (e === null) break;
    }
    return [...this.parses(treeClass)];
  }
}
