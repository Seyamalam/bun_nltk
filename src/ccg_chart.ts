/**
 * CCG Chart parser — port of nltk/ccg/chart.py
 */
import type { AbstractCCGCategory } from "./ccg_api.ts";
import { CCGLexicon, fromString, Token } from "./ccg_lexicon.ts";
import type { DirectedBinaryCombinator } from "./ccg_combinator.ts";
import {
  BackwardCombinator,
  ForwardApplication,
  BackwardApplication,
  ForwardComposition,
  BackwardComposition,
  BackwardBx,
  ForwardSubstitution,
  BackwardSx,
  ForwardT,
  BackwardT,
  UndirectedFunctionApplication,
  UndirectedComposition,
  UndirectedSubstitution,
} from "./ccg_combinator.ts";
import {
  computeFunctionSemantics,
  computeCompositionSemantics,
  computeSubstitutionSemantics,
  computeTypeRaisedSemantics,
} from "./ccg_logic.ts";
import type { Expression } from "./sem_logic.ts";
import { pyError } from "./internals.ts";

// MAX_PARSE_TREES bounds parse-tree extraction (CWE-770).
const MAX_PARSE_TREES = 10000;

class ParseTreeBudget {
  private remaining: number;
  constructor(limit: number) {
    this.remaining = limit;
  }
  spend(): void {
    if (this.remaining <= 0) {
      throw pyError("ValueError", `max parse trees exceeded (${MAX_PARSE_TREES})`);
    }
    this.remaining -= 1;
  }
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export class CCGEdge {
  constructor(
    readonly span: [number, number],
    readonly categ: AbstractCCGCategory,
    readonly rule: DirectedBinaryCombinator | string,
  ) {}
  lhs(): AbstractCCGCategory {
    return this.categ;
  }
  start(): number {
    return this.span[0];
  }
  end(): number {
    return this.span[1];
  }
  length(): number {
    return this.span[1] - this.span[0];
  }
  rhs(): never[] {
    return [];
  }
  dot(): number {
    return 0;
  }
  is_complete(): boolean {
    return true;
  }
  isComplete(): boolean {
    return this.is_complete();
  }
  is_incomplete(): boolean {
    return false;
  }
  isIncomplete(): boolean {
    return this.is_incomplete();
  }
  nextsym(): null {
    return null;
  }
}

export class CCGLeafEdge {
  constructor(
    readonly pos: number,
    readonly token: Token,
    readonly leaf: string,
  ) {}
  lhs(): AbstractCCGCategory {
    return this.token.categ;
  }
  span(): [number, number] {
    return [this.pos, this.pos + 1];
  }
  start(): number {
    return this.pos;
  }
  end(): number {
    return this.pos + 1;
  }
  length(): number {
    return 1;
  }
  rhs(): string {
    return this.leaf;
  }
  dot(): number {
    return 0;
  }
  is_complete(): boolean {
    return true;
  }
  isComplete(): boolean {
    return this.is_complete();
  }
  is_incomplete(): boolean {
    return false;
  }
  isIncomplete(): boolean {
    return this.is_incomplete();
  }
  nextsym(): null {
    return null;
  }
  categ(): AbstractCCGCategory {
    return this.token.categ;
  }
}

export type AnyEdge = CCGEdge | CCGLeafEdge;

function getCateg(e: AnyEdge): AbstractCCGCategory {
  return e instanceof CCGLeafEdge ? e.categ() : (e as CCGEdge).categ;
}
function getSpan(e: AnyEdge): [number, number] {
  return e instanceof CCGLeafEdge ? e.span() : (e as CCGEdge).span;
}

// ---------------------------------------------------------------------------
// Parse trees
// ---------------------------------------------------------------------------

/**
 * Parse-tree node produced by CCGChart.parses. Mirrors the nltk.Tree structure
 * built by CCGChart._trees: internal labels are (Token, rule-string) tuples and
 * word labels are Token objects; leaves are word strings.
 */
export class CCGTree {
  constructor(
    readonly label: [Token, string] | Token,
    readonly children: Array<CCGTree | string>,
  ) {}
  *[Symbol.iterator](): IterableIterator<CCGTree | string> {
    yield* this.children;
  }
  get(index: number): CCGTree | string {
    return this.children[index]!;
  }
  pos(): Array<[string, [Token, string] | Token]> {
    const out: Array<[string, [Token, string] | Token]> = [];
    for (const child of this.children) {
      if (child instanceof CCGTree) out.push(...child.pos());
      else out.push([child, this.label]);
    }
    return out;
  }
  leaves(): string[] {
    const out: string[] = [];
    for (const child of this.children) {
      if (child instanceof CCGTree) out.push(...child.leaves());
      else out.push(child);
    }
    return out;
  }
  toString(): string {
    const label = Array.isArray(this.label) ? `(${this.label[0]}, ${this.label[1]})` : `${this.label}`;
    if (this.children.length === 1 && typeof this.children[0] === "string") {
      return `(${label} ${this.children[0]})`;
    }
    return `(${label} ${this.children.map((c) => `${c}`).join(" ")})`;
  }
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export interface ChartRule {
  apply(chart: CCGChart, lexicon: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
  toString(): string;
}

export class BinaryCombinatorRule implements ChartRule {
  static readonly NUMEDGES = 2;
  constructor(private readonly combinator: DirectedBinaryCombinator) {}
  *apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge> {
    if (left.end() !== right.start()) return;
    if (!this.combinator.canCombine(getCateg(left), getCateg(right))) return;
    for (const res of this.combinator.combine(getCateg(left), getCateg(right))) {
      const e = new CCGEdge([left.start(), right.end()], res, this.combinator);
      if (chart.insert(e, [left, right])) yield e;
    }
  }
  *apply_everywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge> {
    const edges = chart.select();
    for (const l of edges) for (const r of edges) yield* this.apply(chart, lex, l, r);
  }
  applyEverywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge> {
    return this.apply_everywhere(chart, lex);
  }
  toString(): string {
    return `${this.combinator}`;
  }
}

export class ForwardTypeRaiseRule implements ChartRule {
  static readonly NUMEDGES = 2;
  private readonly comb = ForwardT;
  *apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge> {
    if (left.end() !== right.start()) return;
    for (const res of this.comb.combine(getCateg(left), getCateg(right))) {
      const e = new CCGEdge(getSpan(left), res, this.comb);
      if (chart.insert(e, [left])) yield e;
    }
  }
  *apply_everywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge> {
    const edges = chart.select();
    for (const l of edges) for (const r of edges) yield* this.apply(chart, lex, l, r);
  }
  applyEverywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge> {
    return this.apply_everywhere(chart, lex);
  }
  toString(): string {
    return `${this.comb}`;
  }
}

export class BackwardTypeRaiseRule implements ChartRule {
  static readonly NUMEDGES = 2;
  private readonly comb = BackwardT;
  *apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge> {
    if (left.end() !== right.start()) return;
    for (const res of this.comb.combine(getCateg(left), getCateg(right))) {
      const e = new CCGEdge(getSpan(right), res, this.comb);
      if (chart.insert(e, [right])) yield e;
    }
  }
  *apply_everywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge> {
    const edges = chart.select();
    for (const l of edges) for (const r of edges) yield* this.apply(chart, lex, l, r);
  }
  applyEverywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge> {
    return this.apply_everywhere(chart, lex);
  }
  toString(): string {
    return `${this.comb}`;
  }
}

// Common sets of combinators used for English derivations.
export const ApplicationRuleSet: ChartRule[] = [
  new BinaryCombinatorRule(ForwardApplication),
  new BinaryCombinatorRule(BackwardApplication),
];
export const CompositionRuleSet: ChartRule[] = [
  new BinaryCombinatorRule(ForwardComposition),
  new BinaryCombinatorRule(BackwardComposition),
  new BinaryCombinatorRule(BackwardBx),
];
export const SubstitutionRuleSet: ChartRule[] = [
  new BinaryCombinatorRule(ForwardSubstitution),
  new BinaryCombinatorRule(BackwardSx),
];
export const TypeRaiseRuleSet: ChartRule[] = [new ForwardTypeRaiseRule(), new BackwardTypeRaiseRule()];

// The standard English rule set.
export const DefaultRuleSet: ChartRule[] = [
  ...ApplicationRuleSet,
  ...CompositionRuleSet,
  ...SubstitutionRuleSet,
  ...TypeRaiseRuleSet,
];

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

export class CCGChart {
  readonly tokens: string[];
  private _edges: AnyEdge[] = [];
  private cplMap = new Map<string, { edge: AnyEdge; cpls: Map<string, AnyEdge[]> }>();

  constructor(tokens: string[]) {
    this.tokens = tokens;
  }

  num_leaves(): number {
    return this.tokens.length;
  }
  numLeaves(): number {
    return this.num_leaves();
  }
  num_edges(): number {
    return this._edges.length;
  }
  leaf(i: number): string {
    return this.tokens[i]!;
  }
  leaves(): string[] {
    return [...this.tokens];
  }
  edges(): AnyEdge[] {
    return [...this._edges];
  }
  initialize(): void {
    // NLTK 3.10.3's Chart.__init__ does not auto-insert leaf edges; a CCG
    // chart starts empty until the parser inserts CCGLeafEdges.
  }
  *iteredges(span?: [number, number]): Generator<AnyEdge> {
    yield* this.select(span);
  }

  private comparisonKey(e: AnyEdge): string {
    return e instanceof CCGLeafEdge
      ? `${e.pos}:${e.token.categ}:${e.leaf}`
      : `${e.span[0]},${e.span[1]}:${e.categ}:${e.rule}`;
  }

  insert(edge: AnyEdge, children: AnyEdge[]): boolean {
    // NLTK's Chart.insert: returns true iff the edge is new OR the
    // child_pointer_list is new for that edge; cpls accumulate.
    const key = this.comparisonKey(edge);
    let entry = this.cplMap.get(key);
    if (!entry) {
      entry = { edge, cpls: new Map() };
      this.cplMap.set(key, entry);
      this._edges.push(edge);
    }
    const childKey = children.map((c) => this.comparisonKey(c)).join("\x1f");
    if (entry.cpls.has(childKey)) return false;
    entry.cpls.set(childKey, children);
    return true;
  }

  insert_with_backpointer(edge: AnyEdge, _child: AnyEdge, backpointers: AnyEdge[]): boolean {
    return this.insert(edge, backpointers);
  }

  // Lazy like NLTK's Chart.select: edges inserted while iterating are seen.
  *select(span?: [number, number]): Generator<AnyEdge> {
    if (!span) {
      for (let i = 0; i < this._edges.length; i++) yield this._edges[i]!;
      return;
    }
    for (let i = 0; i < this._edges.length; i++) {
      const e = this._edges[i]!;
      const s = getSpan(e);
      if (s[0] === span[0] && s[1] === span[1]) yield e;
    }
  }

  child_pointer_lists(edge: AnyEdge): AnyEdge[][] {
    const entry = this.cplMap.get(this.comparisonKey(edge));
    return entry ? [...entry.cpls.values()] : [];
  }
  childPointerLists(edge: AnyEdge): AnyEdge[][] {
    return this.child_pointer_lists(edge);
  }

  // Constructs the trees for a given parse (mirrors CCGChart._trees).
  private _trees(
    edge: AnyEdge,
    memo: Map<AnyEdge, CCGTree[]>,
    budget: ParseTreeBudget,
  ): CCGTree[] {
    const hit = memo.get(edge);
    if (hit) return hit;

    if (edge instanceof CCGLeafEdge) {
      budget.spend();
      const word = new CCGTree(edge.token, [this.tokens[edge.start()]!]);
      const leaf = new CCGTree([edge.token, "Leaf"], [word]);
      memo.set(edge, [leaf]);
      return [leaf];
    }

    memo.set(edge, []);
    const trees: CCGTree[] = [];
    for (const cpl of this.child_pointer_lists(edge)) {
      const childChoices = cpl.map((cp) => this._trees(cp, memo, budget));
      for (const children of product(childChoices)) {
        budget.spend();
        const lhs: [Token, string] = [
          new Token(this.tokens.slice(edge.start(), edge.end()).join(" "), getCateg(edge), computeSemantics(children, edge)),
          `${(edge as CCGEdge).rule}`,
        ];
        trees.push(new CCGTree(lhs, children));
      }
    }
    memo.set(edge, trees);
    return trees;
  }

  *trees(edge: AnyEdge, budget?: ParseTreeBudget): Generator<CCGTree> {
    yield* this._trees(edge, new Map(), budget ?? new ParseTreeBudget(MAX_PARSE_TREES));
  }

  // NLTK's Chart.parses filters spanning edges by strict lhs equality.
  *parses(start: AbstractCCGCategory): Generator<CCGTree> {
    const budget = new ParseTreeBudget(MAX_PARSE_TREES);
    const n = this.num_leaves();
    for (const e of this._edges) {
      const s = getSpan(e);
      if (s[0] === 0 && s[1] === n && getCateg(e).equals(start)) {
        yield* this._trees(e, new Map(), budget);
      }
    }
  }
}

function* product(choices: CCGTree[][]): Generator<CCGTree[]> {
  if (choices.length === 0) {
    yield [];
    return;
  }
  const [first, ...rest] = choices;
  for (const c of first!) for (const tail of product(rest)) yield [c, ...tail];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export class CCGChartParser {
  constructor(
    private readonly lexicon_: CCGLexicon,
    private readonly rules: ChartRule[],
    private readonly trace = 0,
  ) {}

  lexicon(): CCGLexicon {
    return this.lexicon_;
  }

  grammar(): never {
    throw pyError("AttributeError", `'CCGChartParser' object has no attribute '_grammar'`);
  }

  // Implements the CYK algorithm; yields parse trees like NLTK.
  *parse(tokens: Iterable<string>): Generator<CCGTree> {
    const toks = [...tokens];
    const chart = new CCGChart(toks);
    const lex = this.lexicon_;

    // Initialize leaf edges.
    for (let index = 0; index < chart.num_leaves(); index++) {
      for (const token of lex.categories(chart.leaf(index))) {
        chart.insert(new CCGLeafEdge(index, token, chart.leaf(index)), []);
      }
    }

    // Select a span for the new edges
    for (let span = 2; span <= chart.num_leaves(); span++) {
      for (let start = 0; start <= chart.num_leaves() - span; start++) {
        for (let part = 1; part < span; part++) {
          const mid = start + part;
          const rend = start + span;
          for (const left of chart.select([start, mid])) {
            for (const right of chart.select([mid, rend])) {
              for (const rule of this.rules) {
                for (const _edge of rule.apply(chart, lex, left, right)) {
                  // inserted
                }
              }
            }
          }
        }
      }
    }
    yield* chart.parses(lex.start);
  }

  *parse_sents(sents: Iterable<Iterable<string>>): Generator<CCGTree[]> {
    for (const sent of sents) yield [...this.parse(sent)];
  }
  parseSents(sents: Iterable<Iterable<string>>): Generator<CCGTree[]> {
    return this.parse_sents(sents);
  }
  parse_all(tokens: Iterable<string>): CCGTree[] {
    return [...this.parse(tokens)];
  }
  parseAll(tokens: Iterable<string>): CCGTree[] {
    return this.parse_all(tokens);
  }
  parse_one(tokens: Iterable<string>): CCGTree | null {
    return this.parse(tokens).next().value ?? null;
  }
  parseOne(tokens: Iterable<string>): CCGTree | null {
    return this.parse_one(tokens);
  }
}

// ---------------------------------------------------------------------------
// Semantics
// ---------------------------------------------------------------------------

export function computeSemantics(children: CCGTree[], edge: CCGEdge): Expression | null {
  const sem0 = (children[0]!.label as [Token, string])[0].semantics;
  if (sem0 === null) return null;

  if (children.length === 2) {
    let kids = children;
    if (edge.rule instanceof BackwardCombinator) kids = [children[1]!, children[0]!];

    const combinator = (edge.rule as BackwardCombinator).comb;
    const func = (kids[0]!.label as [Token, string])[0].semantics;
    const arg = (kids[1]!.label as [Token, string])[0].semantics;

    if (combinator instanceof UndirectedFunctionApplication) {
      return computeFunctionSemantics(func, arg);
    } else if (combinator instanceof UndirectedComposition) {
      return computeCompositionSemantics(func, arg);
    } else if (combinator instanceof UndirectedSubstitution) {
      return computeSubstitutionSemantics(func, arg);
    } else {
      throw pyError("AssertionError", `Unsupported combinator '${combinator}'`);
    }
  } else {
    return computeTypeRaisedSemantics(sem0);
  }
}

// ---------------------------------------------------------------------------
// Displaying derivations
// ---------------------------------------------------------------------------

export function printCCGDerivation(tree: CCGTree): void {
  // Get the leaves and initial categories
  const leafcats = tree.pos();
  let leafstr = "";
  let catstr = "";

  // Construct a string with both the leaf word and corresponding
  // category aligned.
  for (const [leaf, cat] of leafcats) {
    const str_cat = `${cat}`;
    const nextlen = 2 + Math.max(leaf.length, str_cat.length);
    const lcatlen = Math.floor((nextlen - str_cat.length) / 2);
    const rcatlen = lcatlen + (nextlen - str_cat.length) % 2;
    catstr += " ".repeat(lcatlen) + str_cat + " ".repeat(rcatlen);
    const lleaflen = Math.floor((nextlen - leaf.length) / 2);
    const rleaflen = lleaflen + (nextlen - leaf.length) % 2;
    leafstr += " ".repeat(lleaflen) + leaf + " ".repeat(rleaflen);
  }
  console.log(leafstr.trimEnd());
  console.log(catstr.trimEnd());

  // Display the derivation steps
  printCCGTree(0, tree);
}

// Prints the sequence of derivation steps.
export function printCCGTree(lwidth: number, tree: CCGTree | string): number {
  let rwidth = lwidth;

  // Is a leaf (word).
  // Increment the span by the space occupied by the leaf.
  if (!(tree instanceof CCGTree)) return 2 + lwidth + tree.length;

  // Find the width of the current derivation step
  for (const child of tree) {
    rwidth = Math.max(rwidth, printCCGTree(rwidth, child));
  }

  // Is a leaf node.
  // Don't print anything, but account for the space occupied.
  if (!Array.isArray(tree.label)) {
    const first = tree.children[0];
    return Math.max(rwidth, 2 + lwidth + `${tree.label}`.length, 2 + lwidth + `${first}`.length);
  }

  const [token, op] = tree.label;
  if (op === "Leaf") return rwidth;

  // Pad to the left with spaces, followed by a sequence of '-'
  // and the derivation rule.
  console.log(" ".repeat(lwidth) + "-".repeat(rwidth - lwidth) + `${op}`);
  // Print the resulting category on a new line.
  let str_res = `${token.categ}`;
  if (token.semantics !== null) str_res += ` {${token.semantics}}`;
  const respadlen = Math.floor((rwidth - lwidth - str_res.length) / 2) + lwidth;
  console.log(" ".repeat(Math.max(0, respadlen)) + str_res);
  return rwidth;
}

// ---------------------------------------------------------------------------
// Demonstration code
// ---------------------------------------------------------------------------

// Construct the lexicon
export const lex = fromString(`
    :- S, NP, N, VP    # Primitive categories, S is the target primitive

    Det :: NP/N         # Family of words
    Pro :: NP
    TV :: VP/NP
    Modal :: (S\\NP)/VP # Backslashes need to be escaped

    I => Pro             # Word -> Category mapping
    you => Pro

    the => Det

    # Variables have the special keyword 'var'
    # '.' prevents permutation
    # ',' prevents composition
    and => var\\.,var/.,var

    which => (N\\N)/(S/NP)

    will => Modal # Categories can be either explicit, or families.
    might => Modal

    cook => TV
    eat => TV

    mushrooms => N
    parsnips => N
    bacon => N
    `);

export function demo(): void {
  const parser = new CCGChartParser(lex, DefaultRuleSet);
  for (const parse of parser.parse("I might cook and eat the bacon".split(" "))) {
    printCCGDerivation(parse);
  }
}
