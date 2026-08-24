/**
 * Port of nltk.inference.resolution — first-order resolution theorem prover.
 * Faithful to nltk: clausify via skolemize, Clause unification, saturation.
 */

import { BaseProverCommand, Prover } from "./inference_api";
import {
  AndExpression,
  ApplicationExpression,
  EqualityExpression,
  Expression,
  IndividualVariableExpression,
  NegatedExpression,
  OrExpression,
  Variable,
  makeVariableExpression,
  is_indvar,
  uniqueVariable,
} from "./sem_logic";
import { skolemize } from "./skolemize";

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export class ProverParseError extends Error {
  constructor(msg = "Prover parse error") {
    super(msg);
    this.name = "ProverParseError";
  }
}

export class BindingException extends Error {
  constructor(arg: unknown) {
    if (Array.isArray(arg)) super(`'${(arg as Expression[])[0]?.str()}' cannot be bound to '${(arg as Expression[])[1]?.str()}'`);
    else super(String(arg));
    this.name = "BindingException";
  }
}

class UnifyTimeout extends Error {
  constructor() {
    super("unify timeout");
    this.name = "_UnifyTimeout";
  }
}

// ---------------------------------------------------------------------------
// BindingDict
// ---------------------------------------------------------------------------

export class BindingDict {
  d: Map<string, Expression> = new Map();

  constructor(bindingList?: Array<[Variable, Expression]>) {
    if (bindingList) for (const [v, b] of bindingList) this.set(v, b);
  }

  set(variable: Variable, binding: Expression): void {
    const existing = this.get(variable);
    if (!existing || binding.equals(existing)) {
      this.d.set(variable.name, binding);
      return;
    }
    if (binding instanceof IndividualVariableExpression) {
      const existing2 = this.get(binding.variable);
      const binding2 = makeVariableExpression(variable.name);
      if (!existing2 || binding2.equals(existing2)) {
        this.d.set(binding.variable.name, binding2);
        return;
      }
      throw new BindingException(`Variable ${variable.name} already bound to another value`);
    }
    throw new BindingException(`Variable ${variable.name} already bound to another value`);
  }

  get(variable: Variable): Expression | undefined {
    let cur: Expression | undefined = this.d.get(variable.name);
    if (!cur) return undefined;
    // follow chain
    const visited = new Set<string>();
    while (cur instanceof IndividualVariableExpression) {
      const name = (cur as IndividualVariableExpression).variable.name;
      if (visited.has(name)) break;
      visited.add(name);
      const nxt = this.d.get(name);
      if (!nxt) break;
      cur = nxt;
    }
    return cur;
  }

  has(variable: Variable): boolean {
    return this.d.has(variable.name);
  }

  add(other: BindingDict): BindingDict {
    const combined = new BindingDict();
    for (const [k, v] of this.d) combined.d.set(k, v);
    for (const [k, v] of other.d) {
      const varObj = new Variable(k);
      try {
        combined.set(varObj, v);
      } catch (_e) {
        throw new BindingException(`Attempting to add two contradicting BindingDicts: '${this}' and '${other}'`);
      }
    }
    return combined;
  }

  get size(): number {
    return this.d.size;
  }

  toString(): string {
    const entries = Array.from(this.d.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}: ${v.str()}`);
    return `{${entries.join(", ")}}`;
  }
}

// ---------------------------------------------------------------------------
// MGU
// ---------------------------------------------------------------------------

export function mostGeneralUnification(a: Expression, b: Expression, bindings?: BindingDict): BindingDict {
  const bd = bindings ?? new BindingDict();
  if (a.equals(b)) return bd;
  if (a instanceof IndividualVariableExpression) return mguVar(a, b, bd);
  if (b instanceof IndividualVariableExpression) return mguVar(b, a, bd);
  if (a instanceof ApplicationExpression && b instanceof ApplicationExpression) {
    const r1 = mostGeneralUnification(a.function, b.function, bd);
    return mostGeneralUnification(a.argument, b.argument, r1);
  }
  throw new BindingException([a, b] as unknown as string);
}

function mguVar(v: IndividualVariableExpression, expr: Expression, bindings: BindingDict): BindingDict {
  // occurs check
  const free = expr.free();
  const consts = expr.constants();
  for (const f of free) if (f.name === v.variable.name) throw new BindingException([v, expr] as unknown as string);
  for (const c of consts) if (c.name === v.variable.name) throw new BindingException([v, expr] as unknown as string);
  return new BindingDict([[v.variable, expr]]).add(bindings);
}

// ---------------------------------------------------------------------------
// Clause
// ---------------------------------------------------------------------------

export class Clause extends Array<Expression> {
  _isTautology: boolean | null = null;
  _parents: [number, number] | null = null;

  constructor(data?: Expression[] | number) {
    if (typeof data === "number") super(data);
    else {
      super();
      if (data) for (const d of data) (this as unknown as Expression[]).push(d);
    }
    Object.setPrototypeOf(this, Clause.prototype);
  }

  static override from(data: Expression[]): Clause {
    return new Clause(data);
  }

  unify(
    other: Clause,
    bindings?: BindingDict,
    used?: [Expression[], Expression[]],
    skipped?: [Expression[], Expression[]],
    debug?: boolean,
    deadline?: number | null,
  ): Clause[] {
    const bd = bindings ?? new BindingDict();
    const u: [Expression[], Expression[]] = used ?? [[], []];
    const sk: [Expression[], Expression[]] = skipped ?? [[], []];
    const dbg = { enabled: debug ?? false, indent: 0 };
    let newclauses: Clause[] = [];
    try {
      newclauses = iterateFirst(this as unknown as Expression[], other as unknown as Expression[], bd, u, sk, completeUnifyPath, dbg, deadline ?? null);
    } catch (e) {
      if (e instanceof UnifyTimeout) return [];
      throw e;
    }
    // remove subsumed
    const subsumed = new Set<number>();
    for (let i = 0; i < newclauses.length; i++) {
      if (subsumed.has(i)) continue;
      for (let j = 0; j < newclauses.length; j++) {
        if (i !== j && !subsumed.has(j) && newclauses[i]!.subsumes(newclauses[j]!)) subsumed.add(j);
      }
    }
    return newclauses.filter((_, idx) => !subsumed.has(idx));
  }

  isSubsetOf(other: Clause): boolean {
    for (const a of this) if (!other.some((b) => a.equals(b))) return false;
    return true;
  }

  subsumes(other: Clause): boolean {
    const negatedOther: Expression[] = other.map((atom) =>
      atom instanceof NegatedExpression ? atom.term : new NegatedExpression(atom),
    );
    const negClause = new Clause(negatedOther);
    const bindings = new BindingDict();
    const used: [Expression[], Expression[]] = [[], []];
    const skipped: [Expression[], Expression[]] = [[], []];
    const dbg = { enabled: false, indent: 0 };
    const res = iterateFirst(
      this as unknown as Expression[],
      negClause as unknown as Expression[],
      bindings,
      used,
      skipped,
      subsumesFinalize,
      dbg,
      null,
    );
    return res.length > 0;
  }

  isTautology(): boolean {
    if (this._isTautology !== null) return this._isTautology;
    for (let i = 0; i < this.length; i++) {
      const a = this[i]!;
      if (a instanceof EqualityExpression) continue;
      for (let j = this.length - 1; j > i; j--) {
        const b = this[j]!;
        if (a instanceof NegatedExpression) {
          if (a.term.equals(b)) {
            this._isTautology = true;
            return true;
          }
        } else if (b instanceof NegatedExpression) {
          if (a.equals(b.term)) {
            this._isTautology = true;
            return true;
          }
        }
      }
    }
    this._isTautology = false;
    return false;
  }

  free(): Set<Variable> {
    const out = new Set<Variable>();
    for (const atom of this) {
      for (const v of atom.free()) out.add(v);
      for (const v of atom.constants()) out.add(v);
    }
    return out;
  }

  replace(variable: Variable, expression: Expression): Clause {
    return new Clause(this.map((atom) => atom.replace(variable, expression)));
  }

  substituteBindings(bindings: BindingDict): Clause {
    return new Clause(
      this.map((atom) => {
        let cur: Expression = atom;
        for (const [name, val] of bindings.d) {
          const v = new Variable(name);
          // only replace if variable is free in cur
          let needs = false;
          for (const f of cur.free()) if (f.name === name) needs = true;
          if (needs) cur = cur.replace(v, val);
        }
        return cur;
      }),
    );
  }

  // keep Array subclass helpers
  minus(other: Clause): Clause {
    return new Clause(this.filter((a) => !other.some((b) => a.equals(b))));
  }
  plus(other: Clause): Clause {
    return new Clause([...this, ...other]);
  }

  override toString(): string {
    return "{" + this.map((x) => x.str()).join(", ") + "}";
  }
}

// ---------------------------------------------------------------------------
// Internal unification helpers
// ---------------------------------------------------------------------------

type DebugObj = { enabled: boolean; indent: number };

function iterateFirst(
  first: Expression[],
  second: Expression[],
  bindings: BindingDict,
  used: [Expression[], Expression[]],
  skipped: [Expression[], Expression[]],
  finalize: (
    f: Expression[],
    s: Expression[],
    b: BindingDict,
    u: [Expression[], Expression[]],
    sk: [Expression[], Expression[]],
    dbg: DebugObj,
  ) => Clause[],
  debug: DebugObj,
  deadline: number | null,
): Clause[] {
  if (deadline !== null && Date.now() > deadline) throw new UnifyTimeout();
  if (first.length === 0 || second.length === 0) return finalize(first, second, bindings, used, skipped, debug);
  let result: Clause[] = [];
  // explore skipping first atom
  result = result.concat(
    iterateSecond(first, second, bindings, used, skipped, finalize, { enabled: debug.enabled, indent: debug.indent + 1 }, deadline),
  );
  const newSkipped: [Expression[], Expression[]] = [[...skipped[0], first[0]!], skipped[1]];
  result = result.concat(
    iterateFirst(first.slice(1), second, bindings, used, newSkipped, finalize, { enabled: debug.enabled, indent: debug.indent + 1 }, deadline),
  );
  try {
    const [nb, nu, unused] = unifyTerms(first[0]!, second[0]!, bindings, used);
    const newFirst = [...first.slice(1), ...skipped[0], ...unused[0]];
    const newSecond = [...second.slice(1), ...skipped[1], ...unused[1]];
    result = result.concat(
      iterateFirst(newFirst, newSecond, nb, nu, [[], []], finalize, { enabled: debug.enabled, indent: debug.indent + 1 }, deadline),
    );
  } catch (_e) {
    if (_e instanceof UnifyTimeout) throw _e;
  }
  return result;
}

function iterateSecond(
  first: Expression[],
  second: Expression[],
  bindings: BindingDict,
  used: [Expression[], Expression[]],
  skipped: [Expression[], Expression[]],
  finalize: (
    f: Expression[],
    s: Expression[],
    b: BindingDict,
    u: [Expression[], Expression[]],
    sk: [Expression[], Expression[]],
    dbg: DebugObj,
  ) => Clause[],
  debug: DebugObj,
  deadline: number | null,
): Clause[] {
  if (deadline !== null && Date.now() > deadline) throw new UnifyTimeout();
  if (first.length === 0 || second.length === 0) return finalize(first, second, bindings, used, skipped, debug);
  const newSkipped: [Expression[], Expression[]] = [skipped[0], [...skipped[1], second[0]!]];
  let result: Clause[] = [];
  result = result.concat(
    iterateSecond(first, second.slice(1), bindings, used, newSkipped, finalize, { enabled: debug.enabled, indent: debug.indent + 1 }, deadline),
  );
  try {
    const [nb, nu, unused] = unifyTerms(first[0]!, second[0]!, bindings, used);
    const newFirst = [...first.slice(1), ...skipped[0], ...unused[0]];
    const newSecond = [...second.slice(1), ...skipped[1], ...unused[1]];
    result = result.concat(
      iterateSecond(newFirst, newSecond, nb, nu, [[], []], finalize, { enabled: debug.enabled, indent: debug.indent + 1 }, deadline),
    );
  } catch (_e) {
    if (_e instanceof UnifyTimeout) throw _e;
  }
  return result;
}

function unifyTerms(a: Expression, b: Expression, bindings: BindingDict, used: [Expression[], Expression[]]): [BindingDict, [Expression[], Expression[]], [Expression[], Expression[]]] {
  if (a instanceof NegatedExpression && b instanceof ApplicationExpression) {
    const nb = mostGeneralUnification(a.term, b, bindings);
    return [nb, [[...used[0], a], [...used[1], b]], [[], []]];
  }
  if (a instanceof ApplicationExpression && b instanceof NegatedExpression) {
    const nb = mostGeneralUnification(a, b.term, bindings);
    return [nb, [[...used[0], a], [...used[1], b]], [[], []]];
  }
  if (a instanceof EqualityExpression) {
    const av = (a as EqualityExpression).first as unknown as { variable: Variable };
    if (!av.variable) throw new BindingException([a, b] as unknown as string);
    const nb = new BindingDict([[av.variable, (a as EqualityExpression).second]]);
    return [nb, [[...used[0], a], used[1]], [[], [b]]];
  }
  if (b instanceof EqualityExpression) {
    const bv = (b as EqualityExpression).first as unknown as { variable: Variable };
    if (!bv.variable) throw new BindingException([a, b] as unknown as string);
    const nb = new BindingDict([[bv.variable, (b as EqualityExpression).second]]);
    return [nb, [used[0], [...used[1], b]], [[a], []]];
  }
  throw new BindingException([a, b] as unknown as string);
}

function completeUnifyPath(
  first: Expression[],
  second: Expression[],
  bindings: BindingDict,
  used: [Expression[], Expression[]],
  skipped: [Expression[], Expression[]],
): Clause[] {
  if (used[0].length > 0 || used[1].length > 0) {
    const newClause = new Clause([...skipped[0], ...skipped[1], ...first, ...second]);
    return [newClause.substituteBindings(bindings)];
  }
  return [];
}

function subsumesFinalize(
  first: Expression[],
  second: Expression[],
  _bindings: BindingDict,
  _used: [Expression[], Expression[]],
  skipped: [Expression[], Expression[]],
): Clause[] {
  if (skipped[0].length === 0 && first.length === 0) return [new Clause([])] as unknown as Clause[];
  return [];
}

// ---------------------------------------------------------------------------
// Clausify
// ---------------------------------------------------------------------------

export function clausify(expression: Expression): Clause[] {
  const sk = skolemize(expression);
  const raw = clausifyInner(sk);
  const out: Clause[] = [];
  for (let clause of raw) {
    for (const free of clause.free()) {
      if (is_indvar(free.name)) {
        const nv = makeVariableExpression(uniqueVariable().name);
        clause = clause.replace(free, nv);
      }
    }
    out.push(clause);
  }
  return out;
}

function clausifyInner(expression: Expression): Clause[] {
  if (expression instanceof AndExpression) {
    return [...clausifyInner(expression.first), ...clausifyInner(expression.second)];
  }
  if (expression instanceof OrExpression) {
    const first = clausifyInner(expression.first);
    const second = clausifyInner(expression.second);
    if (first.length !== 1 || second.length !== 1) throw new ProverParseError("Or clausify expects single clauses");
    return [first[0]!.plus(second[0]!)];
  }
  if (expression instanceof EqualityExpression) return [new Clause([expression])];
  if (expression instanceof ApplicationExpression) return [new Clause([expression])];
  if (expression instanceof NegatedExpression) {
    const t = expression.term;
    if (t instanceof ApplicationExpression) return [new Clause([expression])];
    if (t instanceof EqualityExpression) return [new Clause([expression])];
  }
  throw new ProverParseError(`Cannot clausify ${expression.str()}`);
}

// ---------------------------------------------------------------------------
// ResolutionProver
// ---------------------------------------------------------------------------

export class ResolutionProver extends Prover {
  static ANSWER_KEY = "ANSWER";
  TIMEOUT = 60; // seconds, 0 = disabled

  _prove(goal: Expression | null, assumptions: Expression[] | null, verbose = false): [boolean, Clause[]] {
    const assumps = assumptions ?? [];
    try {
      const clauses: Clause[] = [];
      if (goal) clauses.push(...clausify(goal.negate()));
      for (const a of assumps) clauses.push(...clausify(a));
      const [result, finalClauses] = this.attemptProof(clauses);
      if (verbose) console.log(ResolutionProverCommand.decorateClauses(finalClauses));
      return [result, finalClauses];
    } catch (e) {
      if (verbose) console.log(String(e));
      else if (!(e instanceof UnifyTimeout)) throw e;
      return [false, []];
    }
  }

  private attemptProof(clauses: Clause[]): [boolean, Clause[]] {
    const tried = new Map<number, number[]>();
    const deadline = this.TIMEOUT ? Date.now() + this.TIMEOUT * 1000 : null;
    let i = 0;
    while (i < clauses.length) {
      if (!clauses[i]!.isTautology()) {
        const last = tried.get(i);
        let j = last ? last[last.length - 1]! + 1 : i + 1;
        while (j < clauses.length) {
          if (i !== j && j !== 0 && !clauses[j]!.isTautology()) {
            if (deadline !== null && Date.now() > deadline) return [false, []];
            const arr = tried.get(i) ?? [];
            arr.push(j);
            tried.set(i, arr);
            let newclauses: Clause[];
            try {
              newclauses = clauses[i]!.unify(clauses[j]!, undefined, undefined, undefined, false, deadline);
            } catch (_e) {
              if (_e instanceof UnifyTimeout) return [false, []];
              throw _e;
            }
            if (newclauses.length > 0) {
              for (const nc of newclauses) {
                nc._parents = [i + 1, j + 1];
                clauses.push(nc);
                if (nc.length === 0) return [true, clauses];
              }
              i = -1;
              break;
            }
          }
          j++;
        }
      }
      i++;
    }
    return [false, clauses];
  }
}

export class ResolutionProverCommand extends BaseProverCommand {
  private _clauses: Clause[] | null = null;

  constructor(goal: Expression | null = null, assumptions: Expression[] | null = null, prover: ResolutionProver | null = null) {
    const p = prover ?? new ResolutionProver();
    super(p, goal, assumptions);
  }

  override prove(verbose = false): boolean {
    if (this._result === null) {
      const [result, clauses] = (this._prover as ResolutionProver)._prove(this.goal(), this.assumptions(), verbose);
      this._result = result;
      this._clauses = clauses as Clause[];
      this._proof = ResolutionProverCommand.decorateClauses(this._clauses);
    }
    return this._result!;
  }

  findAnswers(_verbose = false): Set<Expression> {
    this.prove(_verbose);
    const answers = new Set<Expression>();
    const answerVar = makeVariableExpression(ResolutionProver.ANSWER_KEY);
    for (const clause of this._clauses ?? []) {
      if (
        clause.length === 1 &&
        clause[0] instanceof ApplicationExpression &&
        (clause[0] as ApplicationExpression).function.equals(answerVar) &&
        !((clause[0] as ApplicationExpression).argument instanceof IndividualVariableExpression)
      ) {
        answers.add((clause[0] as ApplicationExpression).argument);
      }
    }
    return answers;
  }

  static decorateClauses(clauses: Clause[]): string {
    if (!clauses.length) return "";
    const maxClauseLen = Math.max(...clauses.map((c) => c.toString().length));
    const maxSeqLen = String(clauses.length).length;
    let out = "";
    for (let i = 0; i < clauses.length; i++) {
      const c = clauses[i]!;
      const parents = c._parents ? String(c._parents) : "A";
      const taut = c.isTautology() ? "Tautology" : "";
      const pad = " ".repeat(maxClauseLen - c.toString().length + 1);
      const seq = " ".repeat(maxSeqLen - String(i + 1).length) + String(i + 1);
      out += `[${seq}] ${c.toString()} ${pad}${parents} ${taut}\n`;
    }
    return out;
  }

  override decorateProof(proofString: string, _simplify = true): string {
    return proofString;
  }
}
