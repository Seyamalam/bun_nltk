/**
 * Port of nltk.parse.featurechart + nltk.grammar.FeatureGrammar/
 * FeatStructNonterminal + the incremental-FCFG classes from
 * nltk.parse.earleychart (NLTK 3.10.3).
 *
 * Real feature structures (variables, bindings, unification with forward
 * pointers) come from featstruct.ts. Edges carry bindings while incomplete
 * and substitute them into lhs/rhs when the dot reaches the end; chart
 * indexes key nonterminals by their TYPE feature.
 *
 * Adaptation: parser constructors take an options object
 * (strategy/trace/traceChartWidth/chartClass) and grammar may be a
 * FeatureGrammar or a grammar-string.
 */
import {
  AbstractChartRule,
  BottomUpPredictCombineRule,
  BottomUpPredictRule,
  CachedTopDownPredictRule,
  Chart,
  EmptyPredictRule,
  LeafEdge,
  LeafInitRule,
  NltkChartParser,
  SingleEdgeFundamentalRule,
  TopDownInitRule,
  TreeEdge,
  type EdgeI,
} from "./chart";
import {
  CompleterRule,
  IncrementalChart,
  IncrementalChartParser,
  ScannerRule,
  type IncrementalChartParserOptions,
} from "./parse_earley";
import {
  type Bindings,
  FeatDict,
  FeatList,
  FeatStructNonterminalLike,
  FeatStructReader,
  type FeatValue,
  TYPE,
  Variable,
  find_variables,
  rename_variables,
  reprValue,
  substitute_bindings,
  unify,
} from "./featstruct";
import { CFG, Nonterminal, Production, isNonterminal, readGrammar, type GrammarSymbol } from "./grammar";
import { pyError } from "./internals";

function pyRepr(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
import type { ParseTree } from "./parse";
import { uniqueVariable } from "./sem_logic";

// ---- nltk.grammar.FeatStructNonterminal ---------------------------------------

/**
 * nltk.grammar.FeatStructNonterminal — a feature structure that is also a
 * nonterminal; it acts as its own symbol (symbol() returns itself).
 * Backed by a FeatDict; delegates dict protocol to it.
 */
export class FeatStructNonterminal extends Nonterminal implements FeatStructNonterminalLike {
  readonly fstruct: FeatDict;

  constructor(init?: FeatDict | Record<string, FeatValue>) {
    super("__featstruct__");
    this.fstruct = init instanceof FeatDict ? init : new FeatDict(init);
  }

  /** oracle: symbol() returns `self`; keyed via canonical featstruct repr. */
  override symbol(): string {
    return this as unknown as string;
  }

  get(name: string): FeatValue | undefined {
    return this.fstruct.get(name);
  }
  set(name: string, value: FeatValue): void {
    this.fstruct.set(name, value);
  }
  has(name: string): boolean {
    return this.fstruct.has(name);
  }
  entries(): IterableIterator<[string, FeatValue]> {
    return this.fstruct.entries();
  }
  get size(): number {
    return this.fstruct.size;
  }

  substitute_bindings(bindings: Bindings): FeatStructNonterminal {
    return new FeatStructNonterminal(substitute_bindings(this.fstruct, bindings));
  }
  substituteBindings(bindings: Bindings): FeatStructNonterminal {
    return this.substitute_bindings(bindings);
  }
  rename_variables(usedVars?: Iterable<Variable>, vars?: Iterable<Variable>): FeatStructNonterminal {
    return new FeatStructNonterminal(
      rename_variables(this.fstruct, { vars, usedVars }) as FeatDict,
    );
  }
  renameVariables(usedVars?: Iterable<Variable>): FeatStructNonterminal {
    return this.rename_variables(usedVars);
  }
  variables(): Variable[] {
    return find_variables(this.fstruct);
  }
  /** oracle: FeatStructNonterminal unifies via its feature dict. */
  unify(other: FeatStructNonterminal, bindings?: Bindings): FeatDict | null {
    return unify(this.fstruct, other.fstruct, bindings) as FeatDict | null;
  }
  override toString(): string {
    return reprFsnt(this.fstruct);
  }
}

import { reprFeatDict } from "./featstruct";

function reprFsnt(d: FeatDict): string {
  return reprFeatDict(d);
}

/** Canonical key for a grammar symbol or featstruct value (index/hash use). */
function fsKey(v: unknown): string {
  if (v instanceof FeatStructNonterminal) return `fsnt:${reprFsnt(v.fstruct)}`;
  if (v instanceof FeatDict) return `fd:${reprValue(v)}`;
  if (v instanceof FeatList) return `fl:${reprValue(v)}`;
  if (v instanceof Variable) return `v:${v.name}`;
  if (v instanceof Nonterminal) return `nt:${v.symbol()}`;
  if (v == null) return "none";
  if (typeof v === "boolean") return `b:${v}`;
  if (typeof v === "number") return `n:${v}`;
  if (Array.isArray(v)) return `[${v.map(fsKey).join(",")}]`;
  return `t:${String(v)}`;
}

// ---- nltk.grammar.FeatureGrammar ----------------------------------------------

function typeOf(item: unknown): unknown {
  if (item instanceof FeatStructNonterminal) return item.get(TYPE) ?? item;
  if (item instanceof FeatDict) return item.get(TYPE) ?? item;
  return item;
}

function typeKey(item: unknown): string {
  const t = typeOf(item);
  return fsKey(t);
}

/**
 * nltk.grammar.FeatureGrammar — a CFG whose nonterminals are
 * FeatStructNonterminals; lhs/rhs indexes key on the TYPE feature.
 */
export class FeatureGrammar extends CFG {
  private readonly _featLhsIndex = new Map<string, Production[]>();
  private readonly _featRhsIndex = new Map<string, Production[]>();
  private readonly _featEmptyIndex = new Map<string, Production[]>();
  private readonly _featEmptyProds: Production[] = [];
  private readonly _featLexTokens = new Set<string>();
  private readonly _featStart: FeatStructNonterminal;
  private readonly _featProds: Production[];

  constructor(start: FeatStructNonterminal, productions: Iterable<Production>) {
    const prods = [...productions];
    super(new Nonterminal("__featgrammar__"), prods, false);
    this._featStart = start;
    this._featProds = prods;
    for (const prod of prods) {
      const lhsK = typeKey(prod.lhs());
      (this._featLhsIndex.get(lhsK) ?? this._featLhsIndex.set(lhsK, []).get(lhsK)!).push(prod);
      const rhs = prod.rhs();
      if (rhs.length > 0) {
        const rk = typeKey(rhs[0]);
        (this._featRhsIndex.get(rk) ?? this._featRhsIndex.set(rk, []).get(rk)!).push(prod);
        for (const token of rhs) {
          if (!isNonterminal(token)) this._featLexTokens.add(String(token));
        }
      } else {
        (this._featEmptyIndex.get(lhsK) ?? this._featEmptyIndex.set(lhsK, []).get(lhsK)!).push(prod);
        this._featEmptyProds.push(prod);
      }
    }
  }

  static override fromstring(input: string | readonly string[]): FeatureGrammar {
    const reader = new FeatStructReader();
    const fsntParser = (line: string, pos: number): [Nonterminal, number] => {
      const [v, end] = reader.read_partial(line, pos);
      if (!(v instanceof FeatDict)) throw pyError("ValueError", "Expected a feature dictionary symbol");
      return [new FeatStructNonterminal(v), end];
    };
    const [start, productions] = readGrammar(input, fsntParser);
    return new FeatureGrammar(start as FeatStructNonterminal, productions);
  }
  static override fromString(input: string | readonly string[]): FeatureGrammar {
    return FeatureGrammar.fromstring(input);
  }

  override start(): FeatStructNonterminal {
    return this._featStart;
  }

  override productions(options: { lhs?: GrammarSymbol; rhs?: GrammarSymbol; empty?: boolean } = {}): Production[] {
    const { lhs, rhs, empty = false } = options;
    if (rhs !== undefined && empty) {
      throw pyError("ValueError", "You cannot select empty and non-empty productions at the same time.");
    }
    if (lhs === undefined && rhs === undefined) {
      return empty ? [...this._featEmptyProds] : [...this._featProds];
    }
    if (lhs !== undefined && rhs === undefined) {
      const k = typeKey(lhs);
      return empty ? [...(this._featEmptyIndex.get(k) ?? [])] : [...(this._featLhsIndex.get(k) ?? [])];
    }
    if (rhs !== undefined && lhs === undefined) {
      return [...(this._featRhsIndex.get(typeKey(rhs)) ?? [])];
    }
    const lhsSet = new Set(this._featLhsIndex.get(typeKey(lhs)) ?? []);
    return (this._featRhsIndex.get(typeKey(rhs)) ?? []).filter((p) => lhsSet.has(p));
  }

  override check_coverage(tokens: Iterable<string>): void {
    const missing = [...tokens].filter((tok) => !this._featLexTokens.has(tok));
    if (missing.length > 0) {
      const joined = missing.map((w) => pyRepr(w)).join(", ");
      throw new Error(`Grammar does not cover some of the input words: ${pyRepr(joined)}.`);
    }
  }
}

export function asFeatureGrammar(grammar: FeatureGrammar | string): FeatureGrammar {
  if (grammar instanceof FeatureGrammar) return grammar;
  if (typeof grammar === "string") return FeatureGrammar.fromstring(grammar);
  throw pyError("TypeError", "Expected a FeatureGrammar or grammar string");
}

// ---- nltk.parse.featurechart.FeatureTreeEdge -----------------------------------

function bindingsKey(bindings: Bindings): string {
  return [...bindings.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${fsKey(v)}`).join(",");
}

function bindSymbol(sym: GrammarSymbol, bindings: Bindings): GrammarSymbol {
  if (sym instanceof FeatStructNonterminal) return sym.substitute_bindings(bindings);
  return sym;
}

/** nltk.parse.featurechart.FeatureTreeEdge. */
export class FeatureTreeEdge extends TreeEdge {
  private _lhs2: GrammarSymbol;
  private _rhs2: readonly GrammarSymbol[];
  private _bindings: Bindings;

  constructor(span: [number, number], lhs: GrammarSymbol, rhs: readonly GrammarSymbol[], dot = 0, bindings?: Bindings) {
    let l = lhs;
    let r = rhs;
    let b = bindings ?? new Map();
    if (dot === rhs.length && b.size > 0) {
      l = bindSymbol(l, b);
      r = r.map((elt) => bindSymbol(elt, b));
      b = new Map();
    }
    super(span, l, r, dot);
    this._lhs2 = l;
    this._rhs2 = r;
    this._bindings = b;
  }

  static override from_production(production: Production, index: number): FeatureTreeEdge {
    return new FeatureTreeEdge([index, index], production.lhs(), production.rhs(), 0);
  }
  static override fromProduction(production: Production, index: number): FeatureTreeEdge {
    return FeatureTreeEdge.from_production(production, index);
  }

  override move_dot_forward(newEnd: number, bindings?: Bindings): FeatureTreeEdge {
    return new FeatureTreeEdge([this.start(), newEnd], this._lhs2, this._rhs2, this.dot() + 1, bindings);
  }
  override moveDotForward(newEnd: number): FeatureTreeEdge {
    return this.move_dot_forward(newEnd);
  }

  next_with_bindings(): GrammarSymbol {
    return bindSymbol(this.nextsym()!, this._bindings);
  }
  nextWithBindings(): GrammarSymbol {
    return this.next_with_bindings();
  }

  bindings(): Bindings {
    return new Map(this._bindings);
  }

  variables(): Variable[] {
    const items: FeatValue[] = [];
    const push = (s: GrammarSymbol | null) => {
      if (s instanceof FeatStructNonterminal) items.push(s.fstruct);
    };
    push(this._lhs2);
    for (const s of this._rhs2) push(s);
    const out = new Map<string, Variable>();
    for (const v of find_variables(items)) out.set(v.name, v);
    for (const [k, v] of this._bindings) {
      if (!out.has(k)) out.set(k, new Variable(k));
      for (const inner of find_variables(v)) out.set(inner.name, inner);
    }
    return [...out.values()];
  }

  override lhs(): GrammarSymbol {
    return this._lhs2;
  }
  override rhs(): readonly GrammarSymbol[] {
    return [...this._rhs2];
  }
  override nextsym(): GrammarSymbol | null {
    return this.dot() >= this._rhs2.length ? null : this._rhs2[this.dot()]!;
  }
  override is_complete(): boolean {
    return this.dot() === this._rhs2.length;
  }
  override key(): string {
    return `F:${this.start()}:${this.end()}|${fsKey(this._lhs2)}|${this._rhs2.map(fsKey).join(",")}|${this.dot()}|${bindingsKey(this._bindings)}`;
  }

  /** InstantiateVarsChart hook: replace lhs in-place (oracle mutates edge._lhs). */
  setLhs(lhs: GrammarSymbol): void {
    this._lhs2 = lhs;
  }
  override toString(): string {
    const base = `[${this.start()}:${this.end()}] ${reprFsntOrSym(this._lhs2)} ->` +
      this._rhs2.map((s, i) => `${i === this.dot() ? " *" : ""} ${reprFsntOrSym(s)}`).join("") +
      (this.dot() === this._rhs2.length ? " *" : "");
    if (this.is_complete()) return base;
    const b = [...this._bindings.entries()].sort(([a], [b2]) => a.localeCompare(b2)).map(([k, v]) => `${k}: ${reprValue(v)}`).join(", ");
    return `${base} {${b}}`;
  }
}

function reprFsntOrSym(s: GrammarSymbol | null): string {
  if (s instanceof FeatStructNonterminal) return reprFsnt(s.fstruct);
  if (s instanceof Nonterminal) return s.symbol();
  return `'${s}'`;
}

// ---- nltk.parse.featurechart.FeatureChart ----------------------------------------

/** Type-normalized attr lookup + keying shared by FeatureChart/FeatureIncrementalChart. */
function featEdgeAttr(edge: EdgeI, key: string): unknown {
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
    default: throw pyError("ValueError", `Bad restriction: ${key}`);
  }
}

class FeatIndexState {
  readonly indexes = new Map<string, Map<string, EdgeI[]>>();
  readonly seen = new Set<string>();

  select(chart: Chart, restrictions: Record<string, unknown>): EdgeI[] {
    const keys = Object.keys(restrictions).sort();
    if (keys.length === 0) return chart.edges();
    const restrKey = keys.join("|");
    let index = this.indexes.get(restrKey);
    if (!index) {
      index = new Map();
      for (const edge of chart.edges()) {
        const vk = keys.map((k) => typeKey(featEdgeAttr(edge, k))).join("|");
        (index.get(vk) ?? index.set(vk, []).get(vk)!).push(edge);
      }
      this.indexes.set(restrKey, index);
    }
    const valsKey = keys.map((k) => typeKey(restrictions[k])).join("|");
    return [...(index.get(valsKey) ?? [])];
  }

  register(edge: EdgeI): void {
    const key = edge.key();
    if (this.seen.has(key)) return;
    this.seen.add(key);
    for (const [restrKey, index] of this.indexes) {
      const keys = restrKey.split("|");
      const vk = keys.map((k) => typeKey(featEdgeAttr(edge, k))).join("|");
      (index.get(vk) ?? index.set(vk, []).get(vk)!).push(edge);
    }
  }
}

type TreeFactory<T> = (label: string, children: Array<T | string>) => T;
const featureTreeFactory: TreeFactory<ParseTree> = (label, children) => ({ label, children: children as Array<ParseTree | string> });

/** nltk.parse.featurechart.FeatureChart — indexes edge attrs by TYPE feature. */
export class FeatureChart extends Chart {
  private _feat?: FeatIndexState;
  private get feat(): FeatIndexState {
    return (this._feat ??= new FeatIndexState());
  }

  override initialize(): void {
    this._feat = new FeatIndexState();
    super.initialize();
  }

  override select(restrictions: Record<string, unknown> = {}): EdgeI[] {
    return this.feat.select(this, restrictions);
  }

  override insert(edge: EdgeI, ...childPointerLists: EdgeI[][]): boolean {
    const isNew = !this.feat.seen.has(edge.key());
    const res = super.insert(edge, ...childPointerLists);
    if (isNew) this.feat.register(edge);
    return res;
  }

  override *parses<T = ParseTree>(start: GrammarSymbol, treeClass: TreeFactory<T> = featureTreeFactory as unknown as TreeFactory<T>): Generator<T> {
    yield* featureParses(this, start, treeClass);
  }
}

/** Shared FeatureChart.parses body (oracle featurechart.py:232). */
function* featureParses<T>(chart: Chart, start: GrammarSymbol, treeClass: TreeFactory<T>): Generator<T> {
  const startType = start instanceof FeatStructNonterminal ? start.get(TYPE) : start;
  const startFs = start instanceof FeatStructNonterminal ? start.fstruct : null;
  for (const edge of chart.select({ start: 0, end: chart.num_leaves() })) {
    if (!(edge instanceof FeatureTreeEdge)) continue;
    const lhs = edge.lhs();
    if (!(lhs instanceof FeatStructNonterminal)) continue;
    if (fsKey(lhs.get(TYPE)) !== fsKey(startType)) continue;
    if (startFs) {
      const u = unify(lhs.fstruct, startFs, undefined, { rename_vars: true });
      if (u === null || (u instanceof FeatDict && u.size === 0) || (u instanceof FeatList && u.length === 0)) continue;
    }
    yield* chart.trees(edge, { treeClass, complete: true });
  }
}

// ---- nltk.parse.featurechart rules ------------------------------------------------

/** nltk.parse.featurechart.FeatureFundamentalRule. */
export class FeatureFundamentalRule extends AbstractChartRule {
  readonly NUM_EDGES = 2;
  *apply(chart: Chart, _grammar: CFG, leftEdge: EdgeI, rightEdge: EdgeI): Generator<EdgeI> {
    if (!(leftEdge.end() === rightEdge.start() && leftEdge.is_incomplete() && rightEdge.is_complete() && leftEdge instanceof FeatureTreeEdge)) return;
    let found = rightEdge.lhs();
    const nextsym = leftEdge.nextsym()!;
    let bindings: Bindings;
    if (rightEdge instanceof FeatureTreeEdge) {
      if (!isNonterminal(nextsym)) return;
      if (!(nextsym instanceof FeatStructNonterminal) || !(found instanceof FeatStructNonterminal)) return;
      if (fsKey(nextsym.get(TYPE)) !== fsKey(found.get(TYPE))) return;
      bindings = leftEdge.bindings();
      found = (found as FeatStructNonterminal).rename_variables(leftEdge.variables());
      const result = unify((nextsym as FeatStructNonterminal).fstruct, (found as FeatStructNonterminal).fstruct, bindings, { rename_vars: false });
      if (result === null) return;
    } else {
      if (fsKey(nextsym) !== fsKey(found)) return;
      bindings = leftEdge.bindings();
    }
    const newEdge = (leftEdge as FeatureTreeEdge).move_dot_forward(rightEdge.end(), bindings);
    if (chart.insert_with_backpointer(newEdge, leftEdge, rightEdge)) yield newEdge;
  }
}

/** nltk.parse.featurechart.FeatureSingleEdgeFundamentalRule. */
export class FeatureSingleEdgeFundamentalRule extends SingleEdgeFundamentalRule {
  private readonly _fundamentalRule = new FeatureFundamentalRule();

  protected override *_applyComplete(chart: Chart, grammar: CFG, rightEdge: EdgeI): Generator<EdgeI> {
    for (const leftEdge of chart.select({ end: rightEdge.start(), is_complete: false, nextsym: rightEdge.lhs() })) {
      yield* this._fundamentalRule.apply(chart, grammar, leftEdge, rightEdge);
    }
  }
  protected override *_applyIncomplete(chart: Chart, grammar: CFG, leftEdge: EdgeI): Generator<EdgeI> {
    for (const rightEdge of chart.select({ start: leftEdge.end(), is_complete: true, lhs: leftEdge.nextsym() })) {
      yield* this._fundamentalRule.apply(chart, grammar, leftEdge, rightEdge);
    }
  }
}

/** nltk.parse.featurechart.FeatureTopDownInitRule. */
export class FeatureTopDownInitRule extends TopDownInitRule {
  override *apply(chart: Chart, grammar: CFG): Generator<EdgeI> {
    for (const prod of grammar.productions({ lhs: grammar.start() })) {
      const newEdge = FeatureTreeEdge.from_production(prod, 0);
      if (chart.insert(newEdge, [])) yield newEdge;
    }
  }
}

/** nltk.parse.featurechart.FeatureTopDownPredictRule (cached). */
export class FeatureTopDownPredictRule extends CachedTopDownPredictRule {
  private readonly _featDone = new Map<string, [Chart, CFG]>();

  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_complete()) return;
    const nextsym = edge.nextsym();
    const index = edge.end();
    if (!isNonterminal(nextsym)) return;
    const nextWithBindings = edge instanceof FeatureTreeEdge ? edge.next_with_bindings() : nextsym;
    const key = `${fsKey(nextWithBindings)}|${index}`;
    const done = this._featDone.get(key);
    if (done && done[0] === chart && done[1] === grammar) return;

    for (const prod of grammar.productions({ lhs: nextsym })) {
      const rhs = prod.rhs();
      if (rhs.length > 0) {
        const first = rhs[0]!;
        if (!isNonterminal(first)) {
          if (index >= chart.num_leaves() || first !== chart.leaf(index)) continue;
        }
      }
      const plhs = prod.lhs();
      const nwb = nextWithBindings;
      if (plhs instanceof FeatStructNonterminal && nwb instanceof FeatStructNonterminal) {
        const u = unify(plhs.fstruct, nwb.fstruct, undefined, { rename_vars: true });
        if (u === null || (u instanceof FeatDict && u.size === 0) || (u instanceof FeatList && u.length === 0)) continue;
      } else if (fsKey(plhs) !== fsKey(nwb)) {
        continue;
      }
      const newEdge = FeatureTreeEdge.from_production(prod, edge.end());
      if (chart.insert(newEdge, [])) yield newEdge;
    }
    this._featDone.set(key, [chart, grammar]);
  }
}

/** nltk.parse.featurechart.FeatureBottomUpPredictRule. */
export class FeatureBottomUpPredictRule extends BottomUpPredictRule {
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_incomplete()) return;
    for (const prod of grammar.productions({ rhs: edge.lhs() })) {
      if (edge instanceof FeatureTreeEdge) {
        const next = prod.rhs()[0]!;
        if (!isNonterminal(next)) continue;
      }
      const newEdge = FeatureTreeEdge.from_production(prod, edge.start());
      if (chart.insert(newEdge, [])) yield newEdge;
    }
  }
}

/** nltk.parse.featurechart.FeatureBottomUpPredictCombineRule. */
export class FeatureBottomUpPredictCombineRule extends BottomUpPredictCombineRule {
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge.is_incomplete()) return;
    const foundSym = edge.lhs();
    for (const prod of grammar.productions({ rhs: foundSym })) {
      const bindings: Bindings = new Map();
      if (edge instanceof FeatureTreeEdge) {
        const next = prod.rhs()[0]!;
        if (!isNonterminal(next)) continue;
        if (!(next instanceof FeatStructNonterminal) || !(foundSym instanceof FeatStructNonterminal)) continue;
        const usedVars = find_variables(
          [prod.lhs(), ...prod.rhs()]
            .filter((s): s is FeatStructNonterminal => s instanceof FeatStructNonterminal)
            .map((s) => s.fstruct as FeatValue),
        );
        const found = (foundSym as FeatStructNonterminal).rename_variables(usedVars);
        const result = unify((next as FeatStructNonterminal).fstruct, found.fstruct, bindings, { rename_vars: false });
        if (result === null) continue;
      }
      const newEdge = FeatureTreeEdge.from_production(prod, edge.start()).move_dot_forward(edge.end(), bindings);
      if (chart.insert(newEdge, [edge])) yield newEdge;
    }
  }
}

/** nltk.parse.featurechart.FeatureEmptyPredictRule. */
export class FeatureEmptyPredictRule extends EmptyPredictRule {
  override *apply(chart: Chart, grammar: CFG): Generator<EdgeI> {
    for (const prod of grammar.productions({ empty: true })) {
      for (let index = 0; index < chart.num_leaves() + 1; index++) {
        const newEdge = FeatureTreeEdge.from_production(prod, index);
        if (chart.insert(newEdge, [])) yield newEdge;
      }
    }
  }
}

// ---- nltk.parse.earleychart incremental FCFG rules -------------------------------

/** nltk.parse.earleychart.FeatureCompleteFundamentalRule. */
export class FeatureCompleteFundamentalRule extends FeatureSingleEdgeFundamentalRule {
  private readonly _fr = new FeatureFundamentalRule();
  protected override *_applyIncomplete(chart: Chart, grammar: CFG, leftEdge: EdgeI): Generator<EdgeI> {
    const end = leftEdge.end();
    for (const rightEdge of chart.select({ start: end, end, is_complete: true, lhs: leftEdge.nextsym() })) {
      yield* this._fr.apply(chart, grammar, leftEdge, rightEdge);
    }
  }
}

/** nltk.parse.earleychart.FeatureCompleterRule — feature fundamental rule on non-leaf edges. */
export class FeatureCompleterRule extends CompleterRule {
  private readonly _fr = new FeatureCompleteFundamentalRule();
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (!(edge instanceof LeafEdge)) yield* this._fr.apply(chart, grammar, edge);
  }
}

/** nltk.parse.earleychart.FeatureScannerRule — feature fundamental rule on leaf edges. */
export class FeatureScannerRule extends ScannerRule {
  private readonly _fr = new FeatureCompleteFundamentalRule();
  override *apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI> {
    if (edge instanceof LeafEdge) yield* this._fr.apply(chart, grammar, edge);
  }
}

/** nltk.parse.earleychart.FeaturePredictorRule. */
export class FeaturePredictorRule extends FeatureTopDownPredictRule {}

// ---- strategies ---------------------------------------------------------------------

export const TD_FEATURE_STRATEGY = [
  new LeafInitRule(),
  new FeatureTopDownInitRule(),
  new FeatureTopDownPredictRule(),
  new FeatureSingleEdgeFundamentalRule(),
];
export const BU_FEATURE_STRATEGY = [
  new LeafInitRule(),
  new FeatureEmptyPredictRule(),
  new FeatureBottomUpPredictRule(),
  new FeatureSingleEdgeFundamentalRule(),
];
export const BU_LC_FEATURE_STRATEGY = [
  new LeafInitRule(),
  new FeatureEmptyPredictRule(),
  new FeatureBottomUpPredictCombineRule(),
  new FeatureSingleEdgeFundamentalRule(),
];
export const EARLEY_FEATURE_STRATEGY = [
  new LeafInitRule(),
  new FeatureTopDownInitRule(),
  new FeatureCompleterRule(),
  new FeatureScannerRule(),
  new FeaturePredictorRule(),
];
export const TD_INCREMENTAL_FEATURE_STRATEGY = [
  new LeafInitRule(),
  new FeatureTopDownInitRule(),
  new FeatureTopDownPredictRule(),
  new FeatureCompleteFundamentalRule(),
];
export const BU_INCREMENTAL_FEATURE_STRATEGY = [
  new LeafInitRule(),
  new FeatureEmptyPredictRule(),
  new FeatureBottomUpPredictRule(),
  new FeatureCompleteFundamentalRule(),
];
export const BU_LC_INCREMENTAL_FEATURE_STRATEGY = [
  new LeafInitRule(),
  new FeatureEmptyPredictRule(),
  new FeatureBottomUpPredictCombineRule(),
  new FeatureCompleteFundamentalRule(),
];

// ---- nltk.parse.featurechart.FeatureChartParser ----------------------------------------

export interface FeatureChartParserOptions {
  strategy?: readonly AbstractChartRule[];
  trace?: number;
  traceChartWidth?: number;
  useAgenda?: boolean;
  chartClass?: new (tokens: Iterable<string>) => Chart;
}

/** nltk.parse.featurechart.FeatureChartParser (chart_class=FeatureChart, width 20). */
export class FeatureChartParser extends NltkChartParser {
  constructor(grammar: FeatureGrammar | string, options: FeatureChartParserOptions = {}) {
    const {
      strategy = BU_LC_FEATURE_STRATEGY,
      traceChartWidth = 20,
      chartClass = FeatureChart,
      ...rest
    } = options;
    super(asFeatureGrammar(grammar), { ...rest, strategy, traceChartWidth, chartClass });
  }
}

/** nltk.parse.featurechart.FeatureTopDownChartParser — TD_FEATURE_STRATEGY. */
export class FeatureTopDownChartParser extends FeatureChartParser {
  constructor(grammar: FeatureGrammar | string, options: Omit<FeatureChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: TD_FEATURE_STRATEGY });
  }
}

/** nltk.parse.featurechart.FeatureBottomUpChartParser — BU_FEATURE_STRATEGY. */
export class FeatureBottomUpChartParser extends FeatureChartParser {
  constructor(grammar: FeatureGrammar | string, options: Omit<FeatureChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: BU_FEATURE_STRATEGY });
  }
}

/** nltk.parse.featurechart.FeatureBottomUpLeftCornerChartParser — BU_LC_FEATURE_STRATEGY. */
export class FeatureBottomUpLeftCornerChartParser extends FeatureChartParser {
  constructor(grammar: FeatureGrammar | string, options: Omit<FeatureChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: BU_LC_FEATURE_STRATEGY });
  }
}

// ---- nltk.parse.featurechart.InstantiateVarsChart ----------------------------------------

/** nltk.parse.featurechart.InstantiateVarsChart — instantiates '@'-vars on complete edges. */
export class InstantiateVarsChart extends FeatureChart {
  private _instantiated = new Set<EdgeI>();

  override initialize(): void {
    this._instantiated = new Set();
    super.initialize();
  }

  override insert(edge: EdgeI, ...childPointerLists: EdgeI[][]): boolean {
    if (this._instantiated.has(edge)) return false;
    this.instantiate_edge(edge);
    return super.insert(edge, ...childPointerLists);
  }

  instantiate_edge(edge: EdgeI): void {
    if (!(edge instanceof FeatureTreeEdge)) return;
    if (!edge.is_complete()) return;
    const lhs = edge.lhs();
    if (!(lhs instanceof FeatStructNonterminal)) return;
    const instVars = this.inst_vars(edge);
    if (instVars.size === 0) return;
    this._instantiated.add(edge);
    edge.setLhs(lhs.substitute_bindings(instVars));
  }
  instantiateEdge(edge: EdgeI): void {
    this.instantiate_edge(edge);
  }

  inst_vars(edge: FeatureTreeEdge): Bindings {
    const out: Bindings = new Map();
    const lhs = edge.lhs();
    if (!(lhs instanceof FeatStructNonterminal)) return out;
    for (const v of lhs.variables()) {
      if (v.name.startsWith("@")) out.set(v.name, uniqueVariable() as unknown as FeatValue);
    }
    return out;
  }
  instVars(edge: FeatureTreeEdge): Bindings {
    return this.inst_vars(edge);
  }
}

// ---- nltk.parse.earleychart.FeatureIncrementalChart + parsers ----------------------------

/** nltk.parse.earleychart.FeatureIncrementalChart. */
export class FeatureIncrementalChart extends IncrementalChart {
  private _feat?: FeatIndexState;
  private get feat(): FeatIndexState {
    return (this._feat ??= new FeatIndexState());
  }

  override initialize(): void {
    this._feat = new FeatIndexState();
    super.initialize();
  }

  override select(endOrRestrictions?: number | Record<string, unknown>, restrictions: Record<string, unknown> = {}): EdgeI[] {
    let end: number | undefined;
    let restr: Record<string, unknown>;
    if (typeof endOrRestrictions === "number") {
      end = endOrRestrictions;
      restr = restrictions;
    } else {
      restr = endOrRestrictions ?? {};
      end = restr.end as number | undefined;
      if (end === undefined) {
        throw pyError("TypeError", "select() missing required positional argument: 'end'");
      }
    }
    return this.feat.select(this, { ...restr, end });
  }

  override insert(edge: EdgeI, ...childPointerLists: EdgeI[][]): boolean {
    const isNew = !this.feat.seen.has(edge.key());
    const res = super.insert(edge, ...childPointerLists);
    if (isNew) this.feat.register(edge);
    return res;
  }

  override *parses<T = ParseTree>(start: GrammarSymbol, treeClass: TreeFactory<T> = featureTreeFactory as unknown as TreeFactory<T>): Generator<T> {
    yield* featureParses(this, start, treeClass);
  }
}

/** nltk.parse.earleychart.FeatureIncrementalChartParser. */
export class FeatureIncrementalChartParser extends IncrementalChartParser {
  constructor(grammar: FeatureGrammar | string, options: IncrementalChartParserOptions = {}) {
    const {
      strategy = BU_LC_INCREMENTAL_FEATURE_STRATEGY,
      traceChartWidth = 20,
      chartClass = FeatureIncrementalChart,
      ...rest
    } = options;
    super(asFeatureGrammar(grammar), { ...rest, strategy, traceChartWidth, chartClass });
  }
}

/** nltk.parse.earleychart.FeatureEarleyChartParser — EARLEY_FEATURE_STRATEGY. */
export class FeatureEarleyChartParser extends FeatureIncrementalChartParser {
  constructor(grammar: FeatureGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: EARLEY_FEATURE_STRATEGY });
  }
}

/** nltk.parse.earleychart.FeatureIncrementalTopDownChartParser. */
export class FeatureIncrementalTopDownChartParser extends FeatureIncrementalChartParser {
  constructor(grammar: FeatureGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: TD_INCREMENTAL_FEATURE_STRATEGY });
  }
}

/** nltk.parse.earleychart.FeatureIncrementalBottomUpChartParser. */
export class FeatureIncrementalBottomUpChartParser extends FeatureIncrementalChartParser {
  constructor(grammar: FeatureGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: BU_INCREMENTAL_FEATURE_STRATEGY });
  }
}

/** nltk.parse.earleychart.FeatureIncrementalBottomUpLeftCornerChartParser. */
export class FeatureIncrementalBottomUpLeftCornerChartParser extends FeatureIncrementalChartParser {
  constructor(grammar: FeatureGrammar | string, options: Omit<IncrementalChartParserOptions, "strategy"> = {}) {
    super(grammar, { ...options, strategy: BU_LC_INCREMENTAL_FEATURE_STRATEGY });
  }
}
