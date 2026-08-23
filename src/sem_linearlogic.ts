/**
 * Port of nltk.sem.linearlogic — linear logic fragment used by glue semantics.
 *
 * Mirrors NLTK's sem/linearlogic.py: AtomicExpression (Constant/Variable),
 * ImpExpression, ApplicationExpression, BindingDict, and a simple parser.
 * Used internally by sem_glue; also re-exported for completeness.
 */

export class VariableBindingException extends Error {
  constructor(msg: string) { super(msg); this.name = "VariableBindingException"; }
}
export class UnificationException extends Error {
  constructor(a: unknown, b: unknown, bindings: unknown) {
    super(`Cannot unify ${a} with ${b} given ${bindings}`);
    this.name = "UnificationException";
  }
}
export class LinearLogicApplicationException extends Error {
  constructor(msg: string) { super(msg); this.name = "LinearLogicApplicationException"; }
}

// ---------------------------------------------------------------------------
// BindingDict
// ---------------------------------------------------------------------------
export class BindingDict {
  /** key: variable name, value: AtomicExpression */
  d: Map<string, AtomicExpression> = new Map();

  constructor(bindings?: Array<[VariableExpression, AtomicExpression]>) {
    if (bindings) for (const [k, v] of bindings) this.set(k, v);
  }

  set(v: VariableExpression, b: AtomicExpression): void {
    if (v.equals(b as unknown as AtomicExpression)) throw new VariableBindingException(`Variable ${v} already bound to itself`);
    const ex = this.d.get(v.name);
    if (!ex || ex.equals(b)) this.d.set(v.name, b);
    else throw new VariableBindingException(`Variable ${v} already bound to another value`);
  }

  get(v: VariableExpression): AtomicExpression {
    let cur: AtomicExpression | undefined = this.d.get(v.name);
    if (!cur) throw new Error(`Variable ${v} not bound`);
    let steps = 0;
    while (cur instanceof VariableExpression && steps < 100) {
      const nxt = this.d.get((cur as VariableExpression).name);
      if (!nxt) break;
      cur = nxt; steps++;
    }
    return cur;
  }

  has(item: AtomicExpression): boolean {
    return item instanceof VariableExpression && this.d.has(item.name);
  }

  add(other: BindingDict): BindingDict {
    const c = new BindingDict();
    for (const [k, v] of this.d) c.d.set(k, v);
    for (const [k, v] of other.d) {
      const ex = c.d.get(k);
      if (ex && !ex.equals(v)) throw new VariableBindingException(`Contradicting bindings: ${this} vs ${other}`);
      c.d.set(k, v);
    }
    return c;
  }

  equals(other: BindingDict): boolean {
    if (this.d.size !== other.d.size) return false;
    for (const [k, v] of this.d) { const ov = other.d.get(k); if (!ov || !v.equals(ov)) return false; }
    return true;
  }

  toString(): string {
    const keys = Array.from(this.d.keys()).sort();
    return `{${keys.map(k => `${k}: ${this.d.get(k)}`).join(", ")}}`;
  }
}

// ---------------------------------------------------------------------------
// Expression hierarchy
// ---------------------------------------------------------------------------
export abstract class Expression {
  static fromstring(s: string): Expression { return new LinearLogicParser().parse(s); }
  abstract simplify(bindings?: BindingDict): Expression;
  abstract toString(): string;
  abstract equals(other: Expression): boolean;
  applyto(other: Expression, otherIndices?: Set<number> | null): ApplicationExpression {
    return new ApplicationExpression(this, other, otherIndices ?? null);
  }
  compilePos(_c: CounterLike, _f: GlueFormulaFactory): [Expression, GlueFormulaLike[]] { throw new Error("compilePos not implemented"); }
  compileNeg(_c: CounterLike, _f: GlueFormulaFactory): [Expression, GlueFormulaLike[]] { throw new Error("compileNeg not implemented"); }
}

export type CounterLike = { get(): number };
export type GlueFormulaFactory = (meaning: string, glue: Expression, indices: Set<number>) => GlueFormulaLike;
export interface GlueFormulaLike { glue: Expression; indices: Set<number>; }

export class AtomicExpression extends Expression {
  name: string;
  dependencies: number[] = [];
  constructor(name: string, deps?: number[]) {
    super();
    this.name = name;
    this.dependencies = deps ? [...deps] : [];
  }
  override simplify(bindings?: BindingDict): Expression {
    if (bindings && this instanceof VariableExpression && bindings.has(this)) return bindings.get(this);
    if (bindings && bindings.has(this)) return bindings.get(this as unknown as VariableExpression);
    return this;
  }
  override compilePos(_c: CounterLike, _f: GlueFormulaFactory): [Expression, GlueFormulaLike[]] {
    this.dependencies = []; return [this, []];
  }
  override compileNeg(_c: CounterLike, _f: GlueFormulaFactory): [Expression, GlueFormulaLike[]] {
    this.dependencies = []; return [this, []];
  }
  override equals(other: Expression): boolean {
    return other instanceof AtomicExpression && this.constructor === other.constructor && this.name === other.name;
  }
  override toString(): string {
    return this.dependencies.length ? `${this.name}${JSON.stringify(this.dependencies)}` : this.name;
  }
}

export class ConstantExpression extends AtomicExpression {
  unify(other: Expression, bindings: BindingDict): BindingDict {
    if (other instanceof VariableExpression) {
      try { return bindings.add(new BindingDict([[other, this]])); } catch { /* fall */ }
    } else if (this.equals(other)) return bindings;
    throw new UnificationException(this, other, bindings);
  }
}

export class VariableExpression extends AtomicExpression {
  unify(other: Expression, bindings: BindingDict): BindingDict {
    try {
      if (this.equals(other)) return bindings;
      return bindings.add(new BindingDict([[this, other as AtomicExpression]]));
    } catch (e) {
      if (e instanceof VariableBindingException) throw new UnificationException(this, other, bindings);
      throw e;
    }
  }
}

export class ImpExpression extends Expression {
  constructor(public antecedent: Expression, public consequent: Expression) { super(); }
  override simplify(bindings?: BindingDict): Expression {
    return new ImpExpression(this.antecedent.simplify(bindings), this.consequent.simplify(bindings));
  }
  unify(other: Expression, bindings: BindingDict): BindingDict {
    if (!(other instanceof ImpExpression)) throw new UnificationException(this, other, bindings);
    try {
      let b = bindings;
      const unifyOne = (a: Expression, c: Expression, cur: BindingDict): BindingDict => {
        if (a instanceof AtomicExpression) return (a as ConstantExpression & { unify(e: Expression, b: BindingDict): BindingDict }).unify(c, cur);
        return (a as ImpExpression).unify(c, cur);
      };
      b = unifyOne(this.antecedent, other.antecedent, b);
      b = unifyOne(this.consequent, other.consequent, b);
      return b;
    } catch (e) {
      if (e instanceof VariableBindingException) throw new UnificationException(this, other, bindings);
      throw e;
    }
  }
  override compilePos(counter: CounterLike, factory: GlueFormulaFactory): [Expression, GlueFormulaLike[]] {
    const [a, aNew] = this.antecedent.compileNeg(counter, factory);
    const [c, cNew] = this.consequent.compilePos(counter, factory);
    return [new ImpExpression(a, c), [...aNew, ...cNew]];
  }
  override compileNeg(counter: CounterLike, factory: GlueFormulaFactory): [Expression, GlueFormulaLike[]] {
    const [a, aNew] = this.antecedent.compilePos(counter, factory);
    const [c, cNew] = this.consequent.compileNeg(counter, factory);
    const fresh = counter.get();
    if (c instanceof AtomicExpression) c.dependencies.push(fresh);
    const newV = factory(`v${fresh}`, a, new Set([fresh]));
    return [c, [...aNew, ...cNew, newV]];
  }
  override equals(other: Expression): boolean {
    return other instanceof ImpExpression && this.antecedent.equals(other.antecedent) && this.consequent.equals(other.consequent);
  }
  override toString(): string { return `(${this.antecedent} -o ${this.consequent})`; }
}

export class ApplicationExpression extends Expression {
  bindings: BindingDict;
  constructor(public func: Expression, public argument: Expression, argumentIndices: Set<number> | null) {
    super();
    const funcSimp = func.simplify();
    const argSimp = argument.simplify();
    if (!(funcSimp instanceof ImpExpression)) throw new LinearLogicApplicationException(`Cannot apply ${funcSimp} to ${argSimp}. Function not an implication`);
    let bindings = new BindingDict();
    try {
      if (func instanceof ApplicationExpression) bindings = bindings.add(func.bindings);
      if (argument instanceof ApplicationExpression) bindings = bindings.add(argument.bindings);
      const ant = (funcSimp as ImpExpression).antecedent;
      const unifyOne = (a: Expression, c: Expression, cur: BindingDict): BindingDict => {
        if (a instanceof AtomicExpression) return (a as unknown as { unify(e: Expression, b: BindingDict): BindingDict }).unify(c, cur);
        return (a as ImpExpression).unify(c, cur);
      };
      bindings = unifyOne(ant, argSimp, bindings);
    } catch (e) {
      if (e instanceof UnificationException) throw new LinearLogicApplicationException(`Cannot apply ${funcSimp} to ${argSimp}. ${e.message}`);
      throw e;
    }
    if (argumentIndices && argumentIndices.size > 0) {
      const deps: number[] = ((funcSimp as ImpExpression).antecedent as AtomicExpression).dependencies ?? [];
      // proper subset check
      const depSet = new Set(deps);
      let isSubset = true;
      for (const d of depSet) if (!argumentIndices.has(d)) { isSubset = false; break; }
      if (!isSubset) throw new LinearLogicApplicationException(`Dependencies unfulfilled when applying ${funcSimp} to ${argSimp}`);
      if (depSet.size > 0 && depSet.size === argumentIndices.size) {
        let equal = true;
        for (const d of depSet) if (!argumentIndices.has(d)) equal = false;
        if (equal) throw new LinearLogicApplicationException(`Dependencies not a proper subset when applying ${funcSimp} to ${argSimp}`);
      }
    }
    this.bindings = bindings;
  }
  override simplify(bindings?: BindingDict): Expression {
    const b = bindings ?? this.bindings;
    return (this.func.simplify(b) as ImpExpression).consequent;
  }
  override equals(other: Expression): boolean {
    return other instanceof ApplicationExpression && this.func.equals(other.func) && this.argument.equals(other.argument);
  }
  override toString(): string { return `${this.func}(${this.argument})`; }
  override compilePos(): [Expression, GlueFormulaLike[]] { throw new Error("Application compilePos not used"); }
  override compileNeg(): [Expression, GlueFormulaLike[]] { throw new Error("Application compileNeg not used"); }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
export class LinearLogicParser {
  parse(s: string): Expression {
    const tokens = this.tokenize(s);
    let pos = 0;
    const peek = (): string | null => tokens[pos] ?? null;
    const consume = (): string => tokens[pos++]!;

    const parseAtom = (): Expression => {
      const t = peek();
      if (t === "(") {
        consume();
        const inner = parseImp();
        if (peek() !== ")") throw new Error(`Expected ')' but got '${peek()}' in: ${s}`);
        consume();
        if (peek() === "(") {
          consume();
          const arg = parseImp();
          if (peek() !== ")") throw new Error(`Expected ')' after application argument`);
          consume();
          return new ApplicationExpression(inner, arg, null);
        }
        return inner;
      }
      if (t === null) throw new Error(`Unexpected end in linear logic: ${s}`);
      if (t === "-o" || t === ")") throw new Error(`Unexpected token '${t}'`);
      consume();
      const isVar = t.length > 0 && t[0] !== undefined && t[0] === t[0].toUpperCase() && /[A-Z]/.test(t[0]!);
      const atom: AtomicExpression = isVar ? new VariableExpression(t) : new ConstantExpression(t);
      if (peek() === "(") {
        consume();
        const arg = parseImp();
        if (peek() !== ")") throw new Error(`Expected ')' after application arg`);
        consume();
        return new ApplicationExpression(atom, arg, null);
      }
      return atom;
    };

    const parseImp = (): Expression => {
      let left = parseAtom();
      while (peek() === "(") {
        consume();
        const arg = parseImp();
        if (peek() !== ")") throw new Error(`Expected ')'`);
        consume();
        left = new ApplicationExpression(left, arg, null);
      }
      if (peek() === "-o") {
        consume();
        const right = parseImp();
        return new ImpExpression(left, right);
      }
      return left;
    };

    const result = parseImp();
    if (pos < tokens.length) throw new Error(`Unexpected token '${tokens[pos]}' at end of: ${s}`);
    return result;
  }

  private tokenize(s: string): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i]!;
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
      if (ch === "(" || ch === ")") { out.push(ch); i++; continue; }
      if (s.slice(i, i + 2) === "-o") { out.push("-o"); i += 2; continue; }
      let j = i;
      while (j < s.length && ![" ", "\t", "\n", "\r", "(", ")"].includes(s[j]!) && s.slice(j, j + 2) !== "-o") j++;
      if (j > i) { out.push(s.slice(i, j)); i = j; } else i++;
    }
    return out;
  }
}

// Compatibility aliases for index.ts (original stub exports) — keep tsc green without touching index.ts
export class Atom extends ConstantExpression {
  constructor(name: string) { super(name); }
}
export class ParExpression extends Expression {
  constructor(public left: Expression, public right: Expression) { super(); }
  override simplify(): Expression { return this; }
  override equals(other: Expression): boolean {
    return other instanceof ParExpression && this.left.equals(other.left) && this.right.equals(other.right);
  }
  override toString(): string { return `(${this.left} * ${this.right})`; }
  override compilePos(): [Expression, GlueFormulaLike[]] { return [this, []]; }
  override compileNeg(): [Expression, GlueFormulaLike[]] { return [this, []]; }
}
export class GlueFormula {
  constructor(public meaning: string, public glue: Expression | string) {}
  toString(): string { return `${this.meaning} : ${this.glue}`; }
}

export const Tokens = { OPEN: "(", CLOSE: ")", IMP: "-o" } as const;
