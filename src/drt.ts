/*
 * Port of nltk.sem.drt (subset) — Discourse Representation Theory.
 *
 * Supported:
 *  - DRS brackets: ([x,y],[man(x), walks(y)]) and DRS([x],[man(x)])
 *  - Lambda prefix: \x.([x],[dog(x)])
 *  - Application: P(x), F(x)(y)
 *  - Boolean ops at DRT level: | (or), -> (imp), + (concatenation)
 *  - Equality: x = y, x != y
 *  - Proposition label for SDRS-lite: p:([x],[man(x)])
 *
 * Not supported (raises): SDRS proper, anaphora resolution.
 * This mirrors the scope requested in the task: "if SDRS is too complex, skip it and note it".
 */

import {
  AbstractVariableExpression,
  AllExpression,
  AndExpression,
  ApplicationExpression,
  BinaryExpression,
  EqualityExpression,
  ExistsExpression,
  Expression,
  ImpExpression,
  LambdaExpression,
  NegatedExpression,
  OrExpression,
  Variable,
  is_eventvar,
  is_funcvar,
  is_indvar,
  LogicalExpressionException,
  UnexpectedTokenException,
  ExpectedMoreTokensException,
  Tokens,
  makeVariableExpression,
  uniqueVariable,
} from "./sem_logic";

// ---------------------------------------------------------------------------
// DrtTokens
// ---------------------------------------------------------------------------

export const DrtTokens = {
  ...Tokens,
  DRS: "DRS",
  DRS_CONC: "+",
  PRONOUN: "PRO",
  OPEN_BRACKET: "[",
  CLOSE_BRACKET: "]",
  COLON: ":",
} as const;

const _DrtPunct = ["+", "[", "]", ":"] as const;
const DrtSymbols: string[] = [...Tokens.AND_LIST, ...Tokens.OR_LIST, ...Tokens.IMP_LIST, ...Tokens.IFF_LIST, ...Tokens.EQ_LIST, ...Tokens.NEQ_LIST, ...Tokens.LAMBDA_LIST, ...Tokens.NOT_LIST, "(", ")", ",", ".", "+", "[", "]", ":"].filter((v, i, a) => a.indexOf(v) === i);
const DrtTokensList: string[] = [...Tokens.AND_LIST, ...Tokens.OR_LIST, ...Tokens.IMP_LIST, ...Tokens.IFF_LIST, ...Tokens.EQ_LIST, ...Tokens.NEQ_LIST, ...Tokens.LAMBDA_LIST, ...Tokens.NOT_LIST, "DRS", "+", "[", "]", ":", "PRO", "(", ")", ",", "."];

// helper: check if tok is variable in DRT sense (not a reserved token)
function isDrtVariable(tok: string): boolean {
  if (tok.toUpperCase() === "DRS") return false;
  if (DrtTokensList.includes(tok)) return false;
  // also check lower variants of tokens like "and", "or" etc — Tokens already includes them
  // DrtTokensList includes symbolic variants; word variants already in Tokens
  const lower = tok.toLowerCase();
  // check word-form tokens
  const wordTokens = ["and", "or", "implies", "iff", "not", "exists", "some", "exist", "all", "forall", "iota", "drs"];
  if (wordTokens.includes(lower)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Trie for tokenization (same as sem_logic)
// ---------------------------------------------------------------------------

const LEAF = "__leaf__";
interface TrieNode { [k: string]: TrieNode; }
function buildTrie(symbols: string[]): TrieNode {
  const root: TrieNode = {};
  for (const sym of symbols) {
    let node = root;
    for (const ch of sym) {
      if (!(ch in node)) node[ch] = {};
      node = node[ch]!;
    }
    node[LEAF] = {};
  }
  return root;
}
const DRT_TRIE = buildTrie(DrtSymbols);

// ---------------------------------------------------------------------------
// DRT Variable expressions
// ---------------------------------------------------------------------------

export function DrtVariableExpression(variable: Variable): DrtAbstractVariableExpression {
  if (is_indvar(variable.name)) return new DrtIndividualVariableExpression(variable);
  if (is_funcvar(variable.name)) return new DrtFunctionVariableExpression(variable);
  if (is_eventvar(variable.name)) return new DrtEventVariableExpression(variable);
  return new DrtConstantExpression(variable);
}

export class DrtAbstractVariableExpression extends AbstractVariableExpression {
  fol(): Expression {
    return makeVariableExpression(this.variable.name);
  }
  getRefs(_recursive = false): Variable[] { return []; }
  // _pretty stub
  _pretty(): string[] {
    const s = this.str();
    const blank = " ".repeat(s.length);
    return [blank, blank, s, blank];
  }
  eliminateEquality(): Expression { return this; }
}

export class DrtIndividualVariableExpression extends DrtAbstractVariableExpression {
  override free(): Set<Variable> { return new Set([this.variable]); }
}
export class DrtFunctionVariableExpression extends DrtAbstractVariableExpression {
  override free(): Set<Variable> { return new Set([this.variable]); }
}
export class DrtEventVariableExpression extends DrtIndividualVariableExpression {}
export class DrtConstantExpression extends DrtAbstractVariableExpression {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function orderRefStrings(refs: Variable[]): string[] {
  const strs = refs.map((r) => r.name);
  const ind: string[] = []; const func: string[] = []; const ev: string[] = []; const other: string[] = [];
  for (const s of strs) {
    if (is_indvar(s)) ind.push(s);
    else if (is_funcvar(s)) func.push(s);
    else if (is_eventvar(s)) ev.push(s);
    else other.push(s);
  }
  other.sort();
  ev.sort((a, b) => {
    const na = a.slice(2); const nb = b.slice(2);
    const ia = na.length === 0 ? -1 : parseInt(na, 10);
    const ib = nb.length === 0 ? -1 : parseInt(nb, 10);
    return ia - ib;
  });
  func.sort((a, b) => {
    const pa = a[0]!; const pb = b[0]!;
    if (pa !== pb) return pa < pb ? -1 : 1;
    const na = a.slice(1); const nb = b.slice(1);
    const ia = na.length === 0 ? -1 : parseInt(na, 10);
    const ib = nb.length === 0 ? -1 : parseInt(nb, 10);
    return ia - ib;
  });
  ind.sort((a, b) => {
    const pa = a[0]!; const pb = b[0]!;
    if (pa !== pb) return pa < pb ? -1 : 1;
    const na = a.slice(1); const nb = b.slice(1);
    const ia = na.length === 0 ? -1 : parseInt(na, 10);
    const ib = nb.length === 0 ? -1 : parseInt(nb, 10);
    return ia - ib;
  });
  return [...other, ...ev, ...func, ...ind];
}

function reduceAnd(exprs: Expression[]): Expression | null {
  if (exprs.length === 0) return null;
  let acc: Expression = exprs[0]!;
  for (let i = 1; i < exprs.length; i++) acc = new AndExpression(acc, exprs[i]!);
  return acc;
}

// ---------------------------------------------------------------------------
// DRT Expression base (mixin style — just for typing)
// ---------------------------------------------------------------------------

export abstract class DrtExpression extends Expression {
  abstract getRefs(recursive?: boolean): Variable[];
  abstract fol(): Expression;
  // draw / pretty
  prettyFormat(): string { return this._pretty().join("\n"); }
  // subclasses override
  _pretty(): string[] { return [this.str()]; }
  draw(): void { /* no-op — ASCII via fol() style; stub */ }
  eliminateEquality(): Expression { return this; }
}

// ---------------------------------------------------------------------------
// DRS
// ---------------------------------------------------------------------------

export class DRS extends DrtExpression {
  refs: Variable[];
  conds: Expression[];
  consequent: Expression | null;

  constructor(refs: Variable[], conds: Expression[], consequent: Expression | null) {
    super();
    this.refs = refs;
    this.conds = conds;
    this.consequent = consequent;
  }

  str(): string {
    const refsStr = orderRefStrings(this.refs).join(",");
    const condsStr = this.conds.map((c) => c.str()).join(", ");
    const drs = `([${refsStr}],[${condsStr}])`;
    if (this.consequent) {
      return `(${drs} -> ${this.consequent.str()})`;
    }
    return drs;
  }

  equals(other: Expression): boolean {
    if (!(other instanceof DRS)) return false;
    if (this.refs.length !== other.refs.length) return false;
    if (this.conds.length !== other.conds.length) return false;
    // alpha variance
    let converted: DRS = other;
    for (let i = 0; i < this.refs.length; i++) {
      const r1 = this.refs[i]!; const r2 = converted.refs[i]!;
      const varex = DrtVariableExpression(r1);
      converted = converted.replace(r2, varex, true) as DRS;
    }
    if ((this.consequent === null) !== (converted.consequent === null)) return false;
    if (this.consequent && converted.consequent && !this.consequent.equals(converted.consequent)) return false;
    for (let i = 0; i < this.conds.length; i++) {
      if (!this.conds[i]!.equals(converted.conds[i]!)) return false;
    }
    return true;
  }

  free(): Set<Variable> {
    const s = new Set<Variable>();
    for (const c of this.conds) for (const v of c.free()) s.add(v);
    if (this.consequent) for (const v of this.consequent.free()) s.add(v);
    for (const r of this.refs) for (const v of Array.from(s)) if (v.equals(r)) s.delete(v);
    return s;
  }

  simplify(): Expression {
    // DRS itself does not simplify except via concatenation
    return this;
  }

  replace(variable: Variable, expression: Expression, replaceBound = false, alphaConvert = true): Expression {
    if (this.refs.some((r) => r.equals(variable))) {
      if (!replaceBound) return this;
      const idx = this.refs.findIndex((r) => r.equals(variable));
      const newVar = (expression as AbstractVariableExpression).variable;
      const newConsequent = this.consequent ? (this.consequent as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, true, alphaConvert) : null;
      const newConds = this.conds.map((c) => (c as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, true, alphaConvert));
      const newRefs = [...this.refs]; newRefs[idx] = newVar;
      return new DRS(newRefs, newConds, newConsequent);
    } else {
      // alpha convert any bound var that appears free in expression
      let self: DRS = this;
      if (alphaConvert) {
        for (const ref of self.refs) {
          if (Array.from(expression.free()).some((v) => v.equals(ref))) {
            const newvar = uniqueVariable(ref);
            const newvarex = DrtVariableExpression(newvar);
            const idx = self.refs.findIndex((r) => r.equals(ref));
            const newConsequent = self.consequent ? (self.consequent as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(ref, newvarex, true, alphaConvert) : null;
            const newConds = self.conds.map((c) => (c as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(ref, newvarex, true, alphaConvert));
            const newRefs = [...self.refs]; newRefs[idx] = newvar;
            self = new DRS(newRefs, newConds, newConsequent);
          }
        }
      }
      const newConsequent = self.consequent ? (self.consequent as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert) : null;
      const newConds = self.conds.map((c) => (c as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert));
      return new DRS(self.refs, newConds, newConsequent);
    }
  }

  getRefs(recursive = false): Variable[] {
    if (!recursive) return [...this.refs];
    const out: Variable[] = [...this.refs];
    for (const c of this.conds) {
      const d = c as unknown as DrtExpression;
      if (d.getRefs) out.push(...d.getRefs(true));
    }
    if (this.consequent) {
      const d = this.consequent as unknown as DrtExpression;
      if (d.getRefs) out.push(...d.getRefs(true));
    }
    return out;
  }

  fol(): Expression {
    if (this.consequent) {
      const antecedent: Expression | null = reduceAnd(this.conds.map((c) => (c as unknown as DrtExpression).fol()));
      let imp: Expression;
      if (antecedent) imp = new ImpExpression(antecedent, (this.consequent as unknown as DrtExpression).fol());
      else imp = (this.consequent as unknown as DrtExpression).fol();
      let acc: Expression = imp;
      for (let i = this.refs.length - 1; i >= 0; i--) acc = new AllExpression(this.refs[i]!, acc);
      return acc;
    } else {
      if (this.conds.length === 0) throw new Error("Cannot convert DRS with no conditions to FOL.");
      const ands = reduceAnd(this.conds.map((c) => (c as unknown as DrtExpression).fol()))!;
      let acc: Expression = ands;
      const ordered = orderRefStrings(this.refs).map((n) => new Variable(n));
      for (let i = ordered.length - 1; i >= 0; i--) acc = new ExistsExpression(ordered[i]!, acc);
      return acc;
    }
  }

  // for compatibility with NLTK's toFol alias
  toFol(): Expression { return this.fol(); }

  override _pretty(): string[] {
    const refsLine = orderRefStrings(this.refs).join(" ");
    const condLines: string[] = [];
    for (const c of this.conds) {
      const d = c as unknown as DrtExpression;
      const lines = d._pretty ? d._pretty() : [c.str()];
      for (const l of lines) if (l.trim()) condLines.push(l);
    }
    const allLines = [refsLine, ...condLines];
    const length = Math.max(...allLines.map((l) => l.length), 0);
    const drs = [
      " _" + "_".repeat(length) + "_ ",
      "| " + refsLine.padEnd(length) + " |",
      "|-" + "-".repeat(length) + "-|",
      ...condLines.map((l) => "| " + l.padEnd(length) + " |"),
      "|_" + "_".repeat(length) + "_|",
    ];
    if (this.consequent) {
      const cons = (this.consequent as unknown as DrtExpression)._pretty();
      return DrtBinaryExpression.assemblePretty(drs, "->", cons);
    }
    return drs;
  }

  // alias for spec
  getConds(): Expression[] { return this.conds; }
}

// ---------------------------------------------------------------------------
// DrtLambdaExpression etc
// ---------------------------------------------------------------------------

export class DrtLambdaExpression extends DrtExpression {
  variable: Variable;
  term: Expression;
  constructor(variable: Variable, term: Expression) {
    super();
    this.variable = variable;
    this.term = term;
  }
  str(): string {
    const vars: Variable[] = [this.variable];
    let t: Expression = this.term;
    while (t instanceof DrtLambdaExpression) { vars.push(t.variable); t = t.term; }
    return "\\" + vars.map((v) => v.name).join(" ") + "." + t.str();
  }
  equals(other: Expression): boolean {
    if (!(other instanceof DrtLambdaExpression)) return false;
    if (this.variable.equals(other.variable)) return this.term.equals(other.term);
    const varex = DrtVariableExpression(this.variable);
    return this.term.equals((other.term as Expression & { replace(a: Variable, b: Expression): Expression }).replace(other.variable, varex));
  }
  free(): Set<Variable> {
    const s = new Set(this.term.free());
    for (const v of Array.from(s)) if (v.equals(this.variable)) s.delete(v);
    return s;
  }
  simplify(): Expression { return new DrtLambdaExpression(this.variable, (this.term as Expression & { simplify(): Expression }).simplify()); }
  replace(variable: Variable, expression: Expression, replaceBound = false, alphaConvert = true): Expression {
    if (this.variable.equals(variable)) {
      if (!replaceBound) return this;
      const newVar = (expression as AbstractVariableExpression).variable;
      return new DrtLambdaExpression(newVar, (this.term as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, true, alphaConvert));
    }
    let self: DrtLambdaExpression = this;
    if (alphaConvert && Array.from(expression.free()).some((v) => v.equals(this.variable))) {
      const nv = uniqueVariable(this.variable);
      self = new DrtLambdaExpression(nv, (self.term as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(self.variable, DrtVariableExpression(nv), true));
    }
    return new DrtLambdaExpression(self.variable, (self.term as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert));
  }
  getRefs(recursive = false): Variable[] {
    if (!recursive) return [this.variable];
    const inner = (this.term as unknown as DrtExpression).getRefs ? (this.term as unknown as DrtExpression).getRefs(true) : [];
    return [this.variable, ...inner];
  }
  fol(): Expression { return new LambdaExpression(this.variable, (this.term as unknown as DrtExpression).fol()); }
  override _pretty(): string[] {
    const vars: Variable[] = [this.variable];
    let t: Expression = this.term;
    while (t instanceof DrtLambdaExpression) { vars.push(t.variable); t = t.term; }
    const varStr = vars.map((v) => v.name).join(" ") + ".";
    const termLines = (t as unknown as DrtExpression)._pretty();
    const blank = " ".repeat(varStr.length);
    return [
      "    " + blank + termLines[0]!,
      "\\  " + blank + termLines[1]!,
      " /\\ " + varStr + termLines[2]!,
      "    " + blank + termLines[3]!,
    ];
  }
}

export class DrtApplicationExpression extends DrtExpression {
  function: Expression;
  argument: Expression;
  constructor(func: Expression, arg: Expression) {
    super();
    this.function = func;
    this.argument = arg;
  }
  str(): string {
    // uncurry if atom
    const isAtom = (() => {
      let f: Expression = this.function;
      while (f instanceof ApplicationExpression || f instanceof DrtApplicationExpression) f = (f as ApplicationExpression).function;
      return f instanceof AbstractVariableExpression || f instanceof DrtAbstractVariableExpression;
    })();
    if (isAtom) {
      const args: Expression[] = [];
      let cur: Expression = this as unknown as Expression;
      while (cur instanceof DrtApplicationExpression || cur instanceof ApplicationExpression) {
        const app = cur as ApplicationExpression;
        args.unshift(app.argument);
        cur = app.function;
      }
      // cur is base
      return cur.str() + "(" + args.map((a) => a.str()).join(",") + ")";
    }
    let functionStr = this.function.str();
    let parenthesize = false;
    if (this.function instanceof DrtLambdaExpression) {
      const t = (this.function as DrtLambdaExpression).term;
      if (t instanceof DrtApplicationExpression || t instanceof ApplicationExpression) {
        const fn = (t as ApplicationExpression).function;
        if (!(fn instanceof AbstractVariableExpression) && !(fn instanceof DrtAbstractVariableExpression)) parenthesize = true;
      } else if (!(t instanceof DrtBinaryExpression) && !(t instanceof BinaryExpression)) {
        parenthesize = true;
      }
    } else if (this.function instanceof DrtApplicationExpression || this.function instanceof ApplicationExpression) {
      parenthesize = true;
    }
    if (parenthesize) functionStr = "(" + functionStr + ")";
    return functionStr + "(" + this.argument.str() + ")";
  }
  equals(other: Expression): boolean {
    return other instanceof DrtApplicationExpression && this.function.equals(other.function) && this.argument.equals(other.argument);
  }
  free(): Set<Variable> {
    const a = this.function.free(); const b = this.argument.free();
    const out = new Set(a); for (const v of b) out.add(v); return out;
  }
  simplify(): Expression {
    const fn = (this.function as Expression & { simplify(): Expression }).simplify();
    const arg = (this.argument as Expression & { simplify(): Expression }).simplify();
    if (fn instanceof DrtLambdaExpression) {
      return (fn.term as Expression & { replace(a: Variable, b: Expression): Expression }).replace(fn.variable, arg).simplify();
    }
    return new DrtApplicationExpression(fn, arg);
  }
  replace(variable: Variable, expression: Expression, replaceBound = false, alphaConvert = true): Expression {
    return new DrtApplicationExpression(
      (this.function as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert),
      (this.argument as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert),
    );
  }
  getRefs(recursive = false): Variable[] {
    if (!recursive) return [];
    const a = (this.function as unknown as DrtExpression).getRefs ? (this.function as unknown as DrtExpression).getRefs(true) : [];
    const b = (this.argument as unknown as DrtExpression).getRefs ? (this.argument as unknown as DrtExpression).getRefs(true) : [];
    return [...a, ...b];
  }
  fol(): Expression {
    return new ApplicationExpression((this.function as unknown as DrtExpression).fol(), (this.argument as unknown as DrtExpression).fol());
  }
  override _pretty(): string[] {
    // simplified: just [str]
    const s = this.str();
    const blank = " ".repeat(s.length);
    return [blank, blank, s, blank];
  }
  uncurry(): [Expression, Expression[]] {
    let func: Expression = this.function;
    const args: Expression[] = [this.argument];
    while (func instanceof DrtApplicationExpression || func instanceof ApplicationExpression) {
      const app = func as ApplicationExpression;
      args.unshift(app.argument);
      func = app.function;
    }
    return [func, args];
  }
}

export class DrtNegatedExpression extends DrtExpression {
  term: Expression;
  constructor(term: Expression) { super(); this.term = term; }
  str(): string { return "-" + this.term.str(); }
  equals(other: Expression): boolean { return other instanceof DrtNegatedExpression && this.term.equals(other.term); }
  free(): Set<Variable> { return new Set(this.term.free()); }
  simplify(): Expression { return new DrtNegatedExpression((this.term as Expression & { simplify(): Expression }).simplify()); }
  replace(variable: Variable, expression: Expression, replaceBound = false, alphaConvert = true): Expression {
    return new DrtNegatedExpression((this.term as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert));
  }
  getRefs(recursive = false): Variable[] {
    const d = this.term as unknown as DrtExpression;
    return d.getRefs ? d.getRefs(recursive) : [];
  }
  fol(): Expression { return new NegatedExpression((this.term as unknown as DrtExpression).fol()); }
  override _pretty(): string[] {
    const tl = (this.term as unknown as DrtExpression)._pretty();
    return ["    " + tl[0]!, "__  " + tl[1]!, "  | " + tl[2]!, "    " + tl[3]!];
  }
}

export class DrtEqualityExpression extends DrtExpression {
  first: Expression; second: Expression;
  constructor(first: Expression, second: Expression) { super(); this.first = first; this.second = second; }
  str(): string { return `(${this.first.str()} = ${this.second.str()})`; }
  equals(other: Expression): boolean { return other instanceof DrtEqualityExpression && this.first.equals(other.first) && this.second.equals(other.second); }
  free(): Set<Variable> { const a = this.first.free(); const b = this.second.free(); const out = new Set(a); for (const v of b) out.add(v); return out; }
  simplify(): Expression { return new DrtEqualityExpression((this.first as Expression & { simplify(): Expression }).simplify(), (this.second as Expression & { simplify(): Expression }).simplify()); }
  replace(variable: Variable, expression: Expression, replaceBound = false, alphaConvert = true): Expression {
    return new DrtEqualityExpression(
      (this.first as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert),
      (this.second as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert),
    );
  }
  getRefs(recursive = false): Variable[] {
    if (!recursive) return [];
    const a = (this.first as unknown as DrtExpression).getRefs ? (this.first as unknown as DrtExpression).getRefs(true) : [];
    const b = (this.second as unknown as DrtExpression).getRefs ? (this.second as unknown as DrtExpression).getRefs(true) : [];
    return [...a, ...b];
  }
  fol(): Expression { return new EqualityExpression((this.first as unknown as DrtExpression).fol(), (this.second as unknown as DrtExpression).fol()); }
}

export abstract class DrtBinaryExpression extends DrtExpression {
  first: Expression; second: Expression;
  constructor(first: Expression, second: Expression) { super(); this.first = first; this.second = second; }
  abstract getOp(): string;
  free(): Set<Variable> { const a = this.first.free(); const b = this.second.free(); const out = new Set(a); for (const v of b) out.add(v); return out; }
  replace(variable: Variable, expression: Expression, replaceBound = false, alphaConvert = true): Expression {
    const cls = this.constructor as new (a: Expression, b: Expression) => DrtBinaryExpression;
    return new cls(
      (this.first as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert),
      (this.second as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert),
    );
  }
  getRefs(recursive = false): Variable[] {
    if (!recursive) return [];
    const a = (this.first as unknown as DrtExpression).getRefs ? (this.first as unknown as DrtExpression).getRefs(true) : [];
    const b = (this.second as unknown as DrtExpression).getRefs ? (this.second as unknown as DrtExpression).getRefs(true) : [];
    return [...a, ...b];
  }
  str(): string {
    const a = this.first.str(); const b = this.second.str();
    // strip outer parens for same-op (like NLTK)
    const strip = (s: string, op: string) => {
      // if subex is same type, NLTK strips
      return s;
    };
    void strip;
    return `(${a} ${this.getOp()} ${b})`;
  }
  // pretty helpers
  static assemblePretty(firstLines: string[], op: string, secondLines: string[]): string[] {
    const maxLines = Math.max(firstLines.length, secondLines.length);
    const pad = (lines: string[], n: number) => {
      const blank = " ".repeat(lines[0]!.length);
      return [...lines, ...Array(n - lines.length).fill(blank)];
    };
    const fl = pad(firstLines, maxLines);
    const sl = pad(secondLines, maxLines);
    const blank = " ".repeat(op.length);
    return [
      ...fl.slice(0, 2).map((_, i) => ` ${fl[i]!} ${blank} ${sl[i]!} `),
      `(${fl[2]!} ${op} ${sl[2]!})`,
      ...fl.slice(3).map((_, i) => ` ${fl[3 + i]!} ${blank} ${sl[3 + i]!} `),
    ];
  }
  override _pretty(): string[] {
    const fl = (this.first as unknown as DrtExpression)._pretty();
    const sl = (this.second as unknown as DrtExpression)._pretty();
    return DrtBinaryExpression.assemblePretty(fl, this.getOp(), sl);
  }
}

export class DrtOrExpression extends DrtBinaryExpression {
  override getOp(): string { return "|"; }
  override equals(other: Expression): boolean {
    return other instanceof DrtOrExpression && this.first.equals(other.first) && this.second.equals(other.second);
  }
  override simplify(): Expression { return new DrtOrExpression((this.first as Expression & { simplify(): Expression }).simplify(), (this.second as Expression & { simplify(): Expression }).simplify()); }
  fol(): Expression { return new OrExpression((this.first as unknown as DrtExpression).fol(), (this.second as unknown as DrtExpression).fol()); }
}

export class DrtConcatenation extends DrtBinaryExpression {
  consequent: Expression | null;
  constructor(first: Expression, second: Expression, consequent: Expression | null) {
    super(first, second);
    this.consequent = consequent;
  }
  override getOp(): string { return "+"; }
  override str(): string {
    const a = this.first.str(); const b = this.second.str();
    // NLTK strips same-op parens
    const stripConc = (s: string) => (s.startsWith("(") && s.includes(" + ") ? s.slice(1, -1) : s);
    void stripConc;
    const base = `(${a} + ${b})`;
    if (this.consequent) return `(${base} -> ${this.consequent.str()})`;
    return base;
  }
  equals(other: Expression): boolean {
    if (!(other instanceof DrtConcatenation)) return false;
    if ((this.consequent === null) !== (other.consequent === null)) return false;
    if (this.consequent && other.consequent && !this.consequent.equals(other.consequent)) return false;
    // alpha variance over refs
    const selfRefs = this.getRefs(); const otherRefs = other.getRefs();
    if (selfRefs.length !== otherRefs.length) return this.first.equals(other.first) && this.second.equals(other.second);
    let conv: DrtConcatenation = other;
    for (let i = 0; i < selfRefs.length; i++) {
      const r1 = selfRefs[i]!; const r2 = conv.getRefs()[i]!;
      conv = conv.replace(r2, DrtVariableExpression(r1), true) as DrtConcatenation;
    }
    return this.first.equals(conv.first) && this.second.equals(conv.second);
  }
  override replace(variable: Variable, expression: Expression, replaceBound = false, alphaConvert = true): Expression {
    let first: Expression = this.first;
    let second: Expression = this.second;
    let cons: Expression | null = this.consequent;
    if (this.getRefs().some((r) => r.equals(variable))) {
      if (!replaceBound) return this;
      first = (first as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, true, alphaConvert);
      second = (second as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, true, alphaConvert);
      if (cons) cons = (cons as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, true, alphaConvert);
    } else {
      if (alphaConvert) {
        for (const ref of this.getRefs(true)) {
          if (Array.from(expression.free()).some((v) => v.equals(ref))) {
            const nv = DrtVariableExpression(uniqueVariable(ref));
            first = (first as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(ref, nv, true, alphaConvert);
            second = (second as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(ref, nv, true, alphaConvert);
            if (cons) cons = (cons as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(ref, nv, true, alphaConvert);
          }
        }
      }
      first = (first as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert);
      second = (second as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert);
      if (cons) cons = (cons as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert);
    }
    return new DrtConcatenation(first, second, cons);
  }
  override getRefs(recursive = false): Variable[] {
    const a = (this.first as unknown as DrtExpression).getRefs ? (this.first as unknown as DrtExpression).getRefs(recursive) : [];
    const b = (this.second as unknown as DrtExpression).getRefs ? (this.second as unknown as DrtExpression).getRefs(recursive) : [];
    const out = [...a, ...b];
    if (recursive && this.consequent) {
      const c = (this.consequent as unknown as DrtExpression).getRefs ? (this.consequent as unknown as DrtExpression).getRefs(true) : [];
      out.push(...c);
    }
    return out;
  }
  simplify(): Expression {
    const first = (this.first as Expression & { simplify(): Expression }).simplify();
    const second = (this.second as Expression & { simplify(): Expression }).simplify();
    const cons = this.consequent ? (this.consequent as Expression & { simplify(): Expression }).simplify() : null;
    if (first instanceof DRS && second instanceof DRS) {
      // alpha convert overlapping refs in second
      let sec: Expression = second;
      for (const ref of first.getRefs(true)) {
        if (second.getRefs(true).some((r) => r.equals(ref))) {
          sec = (sec as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(ref, DrtVariableExpression(uniqueVariable(ref)), true);
        }
      }
      const s2 = sec as DRS;
      return new DRS([...first.refs, ...s2.refs], [...first.conds, ...s2.conds], cons as Expression | null);
    }
    return new DrtConcatenation(first, second, cons as Expression | null);
  }
  override free(): Set<Variable> {
    const a = this.first.free(); const b = this.second.free();
    const out = new Set(a); for (const v of b) out.add(v);
    if (this.consequent) for (const v of this.consequent.free()) out.add(v);
    // refs? DrtConcatenation has no own refs; but first/second already handle
    return out;
  }
  fol(): Expression {
    const e = new AndExpression((this.first as unknown as DrtExpression).fol(), (this.second as unknown as DrtExpression).fol());
    if (this.consequent) return new ImpExpression(e, (this.consequent as unknown as DrtExpression).fol());
    return e;
  }
  toFol(): Expression { return this.fol(); }
  override _pretty(): string[] {
    const fl = (this.first as unknown as DrtExpression)._pretty();
    const sl = (this.second as unknown as DrtExpression)._pretty();
    let drs = DrtBinaryExpression.assemblePretty(fl, "+", sl);
    if (this.consequent) {
      const cl = (this.consequent as unknown as DrtExpression)._pretty();
      drs = DrtBinaryExpression.assemblePretty(drs, "->", cl);
    }
    return drs;
  }
}

// DrtProposition for SDRS-lite: label:DRS
export class DrtProposition extends DrtExpression {
  variable: Variable;
  drs: Expression;
  constructor(variable: Variable, drs: Expression) { super(); this.variable = variable; this.drs = drs; }
  str(): string { return `${this.variable.name}:${this.drs.str()}`; }
  equals(other: Expression): boolean { return other instanceof DrtProposition && this.variable.equals(other.variable) && this.drs.equals(other.drs); }
  free(): Set<Variable> { return new Set(this.drs.free()); }
  simplify(): Expression { return new DrtProposition(this.variable, (this.drs as Expression & { simplify(): Expression }).simplify()); }
  replace(variable: Variable, expression: Expression, replaceBound = false, alphaConvert = true): Expression {
    if (this.variable.equals(variable)) {
      const nv = (expression as AbstractVariableExpression).variable;
      return new DrtProposition(nv, (this.drs as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert));
    }
    return new DrtProposition(this.variable, (this.drs as Expression & { replace(a: Variable, b: Expression, c: boolean, d: boolean): Expression }).replace(variable, expression, replaceBound, alphaConvert));
  }
  getRefs(recursive = false): Variable[] {
    if (!recursive) return [];
    const d = this.drs as unknown as DrtExpression;
    return d.getRefs ? d.getRefs(true) : [];
  }
  fol(): Expression { return (this.drs as unknown as DrtExpression).fol(); }
  override _pretty(): string[] {
    const lines = (this.drs as unknown as DrtExpression)._pretty();
    const blank = " ".repeat(this.variable.name.length);
    return [
      blank + " " + lines[0]!,
      this.variable.name + ":" + lines[1]!,
      blank + " " + lines[2]!,
    ];
  }
}

// Re-export alias expected by task
export type Drs = DRS;

// ---------------------------------------------------------------------------
// DrtParser
// ---------------------------------------------------------------------------

const OP_PREC: Record<string, number> = {};
for (const t of Tokens.LAMBDA_LIST) OP_PREC[t] = 1;
for (const t of Tokens.NOT_LIST) OP_PREC[t] = 2;
OP_PREC["APP"] = 3;
for (const t of [...Tokens.EQ_LIST, ...Tokens.NEQ_LIST]) OP_PREC[t] = 4;
OP_PREC[":"] = 5;
OP_PREC["+"] = 6;
for (const t of Tokens.OR_LIST) OP_PREC[t] = 7;
for (const t of Tokens.IMP_LIST) OP_PREC[t] = 8;
OP_PREC["None"] = 9;
const RIGHT_ASSOC = ["APP"];

export class DrtParser {
  private currentIndex = 0;
  private buffer: string[] = [];
  private trie = DRT_TRIE;

  parse(data: string): DrtExpression {
    data = data.replace(/\s+$/, "");
    this.currentIndex = 0;
    this.buffer = this.process(data);
    let result: DrtExpression;
    try {
      result = this.processNextExpression(null);
      if (this.inRange(0)) throw new UnexpectedTokenException(this.currentIndex + 1, this.token(0));
    } catch (e) {
      if (e instanceof LogicalExpressionException) throw new LogicalExpressionException(null, e.message);
      throw e;
    }
    return result;
  }

  process(data: string): string[] {
    const out: string[] = [];
    let token = "";
    let idx = 0;
    while (idx < data.length) {
      let st: TrieNode = this.trie;
      let c = data[idx]!;
      let symbol = "";
      while (c in st) {
        symbol += c;
        st = st[c]!;
        if (data.length - idx > symbol.length) c = data[idx + symbol.length]!;
        else break;
      }
      if (LEAF in st) {
        if (token) { out.push(token); token = ""; }
        out.push(symbol);
        idx += symbol.length;
      } else {
        const ch = data[idx]!;
        if (ch === " " || ch === "\t" || ch === "\n") {
          if (token) { out.push(token); token = ""; }
        } else {
          token += ch;
        }
        idx += 1;
      }
    }
    if (token) out.push(token);
    return out;
  }

  inRange(loc: number): boolean { return this.currentIndex + loc < this.buffer.length; }
  token(loc?: number): string {
    const idx = loc === undefined ? this.currentIndex : this.currentIndex + loc;
    if (idx >= this.buffer.length || idx < 0) throw new ExpectedMoreTokensException(this.currentIndex + 1);
    if (loc === undefined) this.currentIndex += 1;
    return this.buffer[idx]!;
  }
  isvariable(tok: string): boolean { return isDrtVariable(tok); }

  processNextExpression(context: string | null): DrtExpression {
    let tok: string;
    try { tok = this.token(); } catch (e) {
      if (e instanceof ExpectedMoreTokensException) throw new ExpectedMoreTokensException(this.currentIndex + 1, "Expression expected.");
      throw e;
    }
    const accum = this.handle(tok, context);
    if (!accum) throw new UnexpectedTokenException(this.currentIndex, tok, undefined, "Expression expected.");
    return this.attemptAdjuncts(accum, context);
  }

  handle(tok: string, context: string | null): DrtExpression | undefined {
    if (Tokens.NOT_LIST.includes(tok)) return this.handleNegation(tok, context);
    if (Tokens.LAMBDA_LIST.includes(tok)) return this.handleLambda(tok, context);
    if (tok === "(") {
      if (this.inRange(0) && this.token(0) === "[") return this.handleDRS(tok, context);
      return this.handleOpen(tok, context);
    }
    if (tok.toUpperCase() === "DRS") {
      this.assertNextToken("(");
      return this.handleDRS(tok, context);
    }
    if (this.isvariable(tok)) {
      if (this.inRange(0) && this.token(0) === ":") return this.handleProp(tok, context);
      return this.handleVariable(tok, context);
    }
    return undefined;
  }

  handleNegation(_tok: string, _context: string | null): DrtExpression {
    return new DrtNegatedExpression(this.processNextExpression("-"));
  }

  handleVariable(tok: string, _context: string | null): DrtExpression {
    let accum: DrtExpression = DrtVariableExpression(new Variable(tok)) as unknown as DrtExpression;
    if (this.inRange(0) && this.token(0) === "(") {
      // predicate: check legality (individual vars may not be predicates)
      const isFuncOrConst = (accum instanceof DrtFunctionVariableExpression) || (accum instanceof DrtConstantExpression);
      if (!isFuncOrConst) {
        throw new LogicalExpressionException(this.currentIndex, `'${tok}' is an illegal predicate name.  Individual variables may not be used as predicates.`);
      }
      this.token(); // (
      accum = new DrtApplicationExpression(accum, this.processNextExpression("APP"));
      while (this.inRange(0) && this.token(0) === ",") {
        this.token();
        accum = new DrtApplicationExpression(accum, this.processNextExpression("APP"));
      }
      this.assertNextToken(")");
    }
    return accum;
  }

  getNextTokenVariable(_desc: string): Variable {
    let tok: string;
    try { tok = this.token(); } catch (e) {
      if (e instanceof ExpectedMoreTokensException) throw new ExpectedMoreTokensException(e.index, "Variable expected.");
      throw e;
    }
    if (DrtVariableExpression(new Variable(tok)) instanceof DrtConstantExpression) {
      throw new LogicalExpressionException(this.currentIndex, `'${tok}' is an illegal variable name.  Constants may not be ${_desc}.`);
    }
    return new Variable(tok);
  }

  handleLambda(tok: string, _context: string | null): DrtExpression {
    if (!this.inRange(0)) throw new ExpectedMoreTokensException(this.currentIndex + 2, "Variable and Expression expected following lambda operator.");
    const vars: Variable[] = [this.getNextTokenVariable("abstracted")];
    for (;;) {
      if (!this.inRange(0) || (this.token(0) === "." && !this.inRange(1))) throw new ExpectedMoreTokensException(this.currentIndex + 2, "Expression expected.");
      if (!this.isvariable(this.token(0))) break;
      vars.push(this.getNextTokenVariable("abstracted"));
    }
    if (this.inRange(0) && this.token(0) === ".") this.token();
    let accum: DrtExpression = this.processNextExpression(tok);
    while (vars.length) accum = new DrtLambdaExpression(vars.pop()!, accum);
    return accum;
  }

  handleOpen(_tok: string, _context: string | null): DrtExpression {
    const accum = this.processNextExpression(null);
    this.assertNextToken(")");
    return accum;
  }

  handleDRS(_tok: string, context: string | null): DrtExpression {
    const refs = this.handleRefs();
    if (this.inRange(0) && this.token(0) === ",") this.token();
    const conds = this.handleConds(context);
    this.assertNextToken(")");
    return new DRS(refs, conds, null);
  }

  handleRefs(): Variable[] {
    this.assertNextToken("[");
    const refs: Variable[] = [];
    while (this.inRange(0) && this.token(0) !== "]") {
      if (refs.length && this.token(0) === ",") this.token();
      refs.push(this.getNextTokenVariable("quantified"));
    }
    this.assertNextToken("]");
    return refs;
  }

  handleConds(context: string | null): Expression[] {
    this.assertNextToken("[");
    const conds: Expression[] = [];
    while (this.inRange(0) && this.token(0) !== "]") {
      if (conds.length && this.token(0) === ",") this.token();
      conds.push(this.processNextExpression(context));
    }
    this.assertNextToken("]");
    return conds;
  }

  handleProp(tok: string, context: string | null): DrtExpression {
    const variable = new Variable(tok);
    this.assertNextToken(":");
    const drs = this.processNextExpression(":");
    return new DrtProposition(variable, drs);
  }

  attemptAdjuncts(expr: DrtExpression, context: string | null): DrtExpression {
    let cur = -1;
    let out: DrtExpression = expr;
    while (cur !== this.currentIndex) {
      cur = this.currentIndex;
      out = this.attemptEqualityExpression(out, context);
      out = this.attemptApplicationExpression(out, context);
      out = this.attemptBooleanExpression(out, context);
    }
    return out;
  }

  attemptEqualityExpression(expr: DrtExpression, context: string | null): DrtExpression {
    if (this.inRange(0)) {
      const tok = this.token(0);
      if (([...Tokens.EQ_LIST, ...Tokens.NEQ_LIST].includes(tok) && this.hasPriority(tok, context))) {
        this.token();
        let e: DrtExpression = new DrtEqualityExpression(expr, this.processNextExpression(tok));
        if (Tokens.NEQ_LIST.includes(tok)) e = new DrtNegatedExpression(e);
        return e;
      }
    }
    return expr;
  }

  attemptBooleanExpression(expr: DrtExpression, context: string | null): DrtExpression {
    let out: DrtExpression = expr;
    while (this.inRange(0)) {
      const tok = this.token(0);
      const factory = this.getBooleanFactory(tok);
      if (factory && this.hasPriority(tok, context)) {
        this.token();
        out = factory(out, this.processNextExpression(tok));
      } else break;
    }
    return out;
  }

  getBooleanFactory(tok: string): ((a: DrtExpression, b: DrtExpression) => DrtExpression) | null {
    if (tok === "+") return (a, b) => new DrtConcatenation(a, b, null);
    if (Tokens.OR_LIST.includes(tok)) return (a, b) => new DrtOrExpression(a, b);
    if (Tokens.IMP_LIST.includes(tok)) {
      return (a, b) => {
        if (a instanceof DRS) return new DRS(a.refs, a.conds, b);
        if (a instanceof DrtConcatenation) return new DrtConcatenation(a.first, a.second, b);
        throw new Error("Antecedent of implication must be a DRS");
      };
    }
    return null;
  }

  attemptApplicationExpression(expr: DrtExpression, context: string | null): DrtExpression {
    if (this.hasPriority("APP", context)) {
      if (this.inRange(0) && this.token(0) === "(") {
        const isApplicable = (expr instanceof DrtLambdaExpression) || (expr instanceof DrtApplicationExpression) || (expr instanceof DrtFunctionVariableExpression) || (expr instanceof DrtConstantExpression);
        if (!isApplicable) {
          throw new LogicalExpressionException(this.currentIndex, `The function '${expr.str()}' is not a Lambda Expression, an Application Expression, or a functional predicate, so it may not take arguments.`);
        }
        this.token(); // (
        let accum: DrtExpression = new DrtApplicationExpression(expr, this.processNextExpression("APP"));
        while (this.inRange(0) && this.token(0) === ",") {
          this.token();
          accum = new DrtApplicationExpression(accum, this.processNextExpression("APP"));
        }
        this.assertNextToken(")");
        return accum;
      }
    }
    return expr;
  }

  hasPriority(op: string, context: string | null): boolean {
    const opPrec = OP_PREC[op] ?? 99;
    const ctxPrec = OP_PREC[context === null ? "None" : context] ?? 99;
    return opPrec < ctxPrec || (RIGHT_ASSOC.includes(op) && opPrec === ctxPrec);
  }

  assertNextToken(expected: string): void {
    let tok: string;
    try { tok = this.token(); } catch (e) {
      if (e instanceof ExpectedMoreTokensException) throw new ExpectedMoreTokensException(e.index, `Expected token '${expected}'.`);
      throw e;
    }
    if (tok !== expected) throw new UnexpectedTokenException(this.currentIndex, tok, expected);
  }
}

// Convenience alias mirroring NLTK
export function DrtParserFromString(s: string): DrtExpression {
  return new DrtParser().parse(s);
}
