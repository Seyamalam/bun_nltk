/**
 * CCG Chart parser — port of nltk/ccg/chart.py
 */
import type { AbstractCCGCategory } from "./ccg_api.ts";
import { CCGLexicon, Token } from "./ccg_lexicon.ts";
import type { DirectedBinaryCombinator } from "./ccg_combinator.ts";
import {
  ForwardApplication, BackwardApplication,
  ForwardComposition, BackwardComposition, BackwardBx,
  ForwardSubstitution, BackwardSx,
  ForwardT, BackwardT,
} from "./ccg_combinator.ts";
import {
  computeFunctionSemantics, computeCompositionSemantics,
  computeSubstitutionSemantics, computeTypeRaisedSemantics,
} from "./ccg_logic.ts";
import { UndirectedFunctionApplication, UndirectedComposition, UndirectedSubstitution } from "./ccg_combinator.ts";

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export class CCGEdge {
  constructor(
    readonly span: [number, number],
    readonly categ: AbstractCCGCategory,
    readonly rule: DirectedBinaryCombinator | string,
  ) {}
  start(): number { return this.span[0]; }
  end(): number { return this.span[1]; }
  lhs(): AbstractCCGCategory { return this.categ; }
}

export class CCGLeafEdge {
  constructor(
    readonly pos: number,
    readonly token: Token,
    readonly leaf: string,
  ) {}
  start(): number { return this.pos; }
  end(): number { return this.pos + 1; }
  span(): [number, number] { return [this.pos, this.pos + 1]; }
  lhs(): AbstractCCGCategory { return this.token.categ; }
  categ(): AbstractCCGCategory { return this.token.categ; }
}

export type AnyEdge = CCGEdge | CCGLeafEdge;

function getCateg(e: AnyEdge): AbstractCCGCategory {
  return e instanceof CCGLeafEdge ? e.categ() : (e as CCGEdge).categ;
}
function getSpan(e: AnyEdge): [number, number] {
  return e instanceof CCGLeafEdge ? e.span() : (e as CCGEdge).span;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export interface ChartRule {
  apply(chart: CCGChart, lexicon: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
  toString(): string;
}

export class BinaryCombinatorRule implements ChartRule {
  constructor(private readonly combinator: DirectedBinaryCombinator) {}
  *apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge> {
    const lc = getCateg(left);
    const rc = getCateg(right);
    const ls = getSpan(left);
    const rs = getSpan(right);
    if (ls[1] !== rs[0]) return;
    if (!this.combinator.canCombine(lc, rc)) return;
    for (const res of this.combinator.combine(lc, rc)) {
      const e = new CCGEdge([ls[0], rs[1]], res, this.combinator);
      if (chart.insert(e, [left, right])) yield e;
    }
  }
  toString(): string { return `${this.combinator}`; }
}

export class ForwardTypeRaiseRule implements ChartRule {
  private readonly comb = ForwardT;
  *apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge> {
    const lc = getCateg(left);
    const rc = getCateg(right);
    const ls = getSpan(left);
    const rs = getSpan(right);
    if (ls[1] !== rs[0]) return;
    for (const res of this.comb.combine(lc, rc)) {
      const e = new CCGEdge(ls as [number, number], res, this.comb);
      if (chart.insert(e, [left])) yield e;
    }
  }
  toString(): string { return `${this.comb}`; }
}

export class BackwardTypeRaiseRule implements ChartRule {
  private readonly comb = BackwardT;
  *apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge> {
    const lc = getCateg(left);
    const rc = getCateg(right);
    const ls = getSpan(left);
    const rs = getSpan(right);
    if (ls[1] !== rs[0]) return;
    for (const res of this.comb.combine(lc, rc)) {
      const e = new CCGEdge(rs as [number, number], res, this.comb);
      if (chart.insert(e, [right])) yield e;
    }
  }
  toString(): string { return `${this.comb}`; }
}

// Rule sets
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
export const DefaultRuleSet: ChartRule[] = [...ApplicationRuleSet, ...CompositionRuleSet, ...SubstitutionRuleSet, ...TypeRaiseRuleSet];

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

export class CCGChart {
  readonly tokens: string[];
  private edges: AnyEdge[] = [];
  private edgeSet = new Set<string>();
  private childrenMap = new Map<AnyEdge, AnyEdge[][]>();

  constructor(tokens: string[]) { this.tokens = tokens; }

  numLeaves(): number { return this.tokens.length; }
  leaf(i: number): string { return this.tokens[i]!; }

  insert(edge: AnyEdge, children: AnyEdge[]): boolean {
    const span = getSpan(edge);
    const categ = getCateg(edge);
    const key = `${span[0]},${span[1]}:${categ.toString()}`;
    if (this.edgeSet.has(key)) return false;
    // deduplicate by string key approximation
    this.edgeSet.add(key);
    this.edges.push(edge);
    this.childrenMap.set(edge, [children]);
    return true;
  }

  select(span?: [number, number]): AnyEdge[] {
    if (!span) return [...this.edges];
    return this.edges.filter((e) => {
      const s = getSpan(e);
      return s[0] === span[0] && s[1] === span[1];
    });
  }

  childPointerLists(edge: AnyEdge): AnyEdge[][] {
    return this.childrenMap.get(edge) ?? [];
  }

  parses(start: AbstractCCGCategory): AnyEdge[] {
    const n = this.numLeaves();
    return this.edges.filter((e) => {
      const s = getSpan(e);
      const c = getCateg(e);
      return s[0] === 0 && s[1] === n && c.canUnify(start) !== null;
    }) as CCGEdge[];
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export class CCGChartParser {
  constructor(
    private readonly lexicon: CCGLexicon,
    private readonly rules: ChartRule[],
    private readonly trace = 0,
  ) {}

  lexicon_(): CCGLexicon { return this.lexicon; }

  parse(tokens: string[]): AnyEdge[] {
    const chart = new CCGChart([...tokens]);
    const lex = this.lexicon;

    for (let i = 0; i < chart.numLeaves(); i++) {
      for (const tok of lex.categories(chart.leaf(i))) {
        const e = new CCGLeafEdge(i, tok, chart.leaf(i));
        chart.insert(e, []);
      }
    }

    for (let span = 2; span <= chart.numLeaves(); span++) {
      for (let start = 0; start <= chart.numLeaves() - span; start++) {
        for (let part = 1; part < span; part++) {
          const mid = start + part;
          const rend = start + span;
          for (const left of chart.select([start, mid])) {
            for (const right of chart.select([mid, rend])) {
              for (const rule of this.rules) {
                for (const _e of rule.apply(chart, lex, left, right)) { /* inserted */ }
              }
            }
          }
        }
      }
    }
    return chart.parses(lex.start);
  }
}

// ---------------------------------------------------------------------------
// Semantics + derivation printing (helpers)
// ---------------------------------------------------------------------------

export function computeSemantics(children: Token[], edge: CCGEdge): unknown {
  if (children.length === 0 || children[0]!.semantics === null) return null;
  if (children.length === 2) {
    const rule = edge.rule as DirectedBinaryCombinator;
    // BackwardCombinator swaps function/arg order
    let func = children[0]!.semantics, arg = children[1]!.semantics;
    // Detect backward by string prefix "<"
    if (`${rule}`.startsWith("<")) [func, arg] = [arg!, func!];
    const inner = (rule as unknown as { comb?: unknown }).comb ?? rule;
    // Actually Directed wrapper stores combinator privately; use toString heuristic
    const s = `${rule}`;
    if (s.includes("B")) return computeCompositionSemantics(func!, arg!);
    if (s.includes("S")) return computeSubstitutionSemantics(func!, arg!);
    // Check undirected type
    // Default to function application
    if (rule instanceof ForwardTypeRaiseRule || rule instanceof BackwardTypeRaiseRule) {
      return computeTypeRaisedSemantics(children[0]!.semantics);
    }
    return computeFunctionSemantics(func!, arg!);
  }
  return computeTypeRaisedSemantics(children[0]!.semantics);
}

// Keep imports used
void UndirectedFunctionApplication; void UndirectedComposition; void UndirectedSubstitution;
