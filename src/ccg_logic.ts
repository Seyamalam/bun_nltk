/**
 * CCG Logic / Semantics helpers — port of nltk/ccg/logic.py
 */
import {
  ApplicationExpression,
  LambdaExpression,
  Variable,
  makeVariableExpression,
  uniqueVariable,
} from "./sem_logic.ts";
import type { Expression } from "./sem_logic.ts";
import { AndExpression, OrExpression, ImpExpression, IffExpression, NegatedExpression, EqualityExpression } from "./sem_logic.ts";

// ---------------------------------------------------------------------------
// Barendregt normalization (variable canonicalization)
// ---------------------------------------------------------------------------

function baseCategory(name: string): string {
  const m = /^([A-Za-z_]+)/.exec(name);
  return m?.[1] ?? "v";
}

export function barendregtNormalize(expr: Expression | null, counters?: Map<string, number>): Expression | null {
  if (expr === null) return null;
  if (counters === undefined) {
    expr = expr.simplify();
    counters = new Map();
  }
  if (expr instanceof LambdaExpression || (expr as unknown as { variable?: Variable; term?: Expression }).variable) {
    // Use instanceof LambdaExpression check; covers VariableBinderExpression
    const vb = expr as LambdaExpression;
    if (!(vb instanceof LambdaExpression)) return expr;
    const base = baseCategory(vb.variable.name);
    let category: string, pool: string[];
    if (["x", "y", "z", "w"].includes(base)) { category = "ind"; pool = ["x", "y", "z"]; }
    else if (["P", "Q", "R"].includes(base)) { category = "pred"; pool = ["P", "Q", "R"]; }
    else if (["F", "G", "H"].includes(base)) { category = "func"; pool = ["F", "G"]; }
    else if (base === "e") { category = "event"; pool = ["e"]; }
    else { category = base; pool = [base]; }

    if (!counters.has(category)) counters.set(category, 0);
    const freeInBody: Set<Variable> = vb.term.free();
    freeInBody.delete(vb.variable);

    let newVar: Variable;
    while (true) {
      const idx = counters.get(category)!;
      const poolVar = pool[idx % pool.length]!;
      const suffix = Math.floor(idx / pool.length);
      const name = suffix > 0 ? `${poolVar}${suffix}` : poolVar;
      newVar = new Variable(name);
      counters.set(category, idx + 1);
      let clash = false;
      for (const v of freeInBody) if (v.equals(newVar)) { clash = true; break; }
      if (!clash) break;
    }
    const safe = (vb as LambdaExpression).alphaConvert(newVar);
    const normalized = barendregtNormalize((safe as LambdaExpression).term, counters) as Expression;
    return new LambdaExpression((safe as LambdaExpression).variable, normalized);
  }
  if (expr instanceof ApplicationExpression) {
    return new ApplicationExpression(
      barendregtNormalize(expr.function, counters) as Expression,
      barendregtNormalize(expr.argument, counters) as Expression,
    );
  }
  if (expr instanceof AndExpression || expr instanceof OrExpression || expr instanceof ImpExpression || expr instanceof IffExpression) {
    const b = expr as unknown as { first: Expression; second: Expression };
    const Ctor = expr.constructor as new (a: Expression, b: Expression) => Expression;
    return new Ctor(
      barendregtNormalize(b.first, counters) as Expression,
      barendregtNormalize(b.second, counters) as Expression,
    );
  }
  if (expr instanceof NegatedExpression) {
    return new NegatedExpression(barendregtNormalize((expr as NegatedExpression).term, counters) as Expression);
  }
  if (expr instanceof EqualityExpression) {
    const e = expr as unknown as { first: Expression; second: Expression };
    const Ctor = expr.constructor as new (a: Expression, b: Expression) => Expression;
    return new Ctor(
      barendregtNormalize(e.first, counters) as Expression,
      barendregtNormalize(e.second, counters) as Expression,
    );
  }
  return expr;
}

// ---------------------------------------------------------------------------
// Semantics computation
// ---------------------------------------------------------------------------

export function computeFunctionSemantics(func: Expression | null, arg: Expression | null): Expression | null {
  if (func === null || arg === null) return null;
  return barendregtNormalize(new ApplicationExpression(func, arg)) as Expression;
}

export function computeTypeRaisedSemantics(sem: Expression | null): Expression | null {
  if (sem === null) return null;
  const core = uniqueVariable(new Variable("F"));
  // structuredClone alternative: sem.simplify path already deep-copies via parser; use sem directly
  return barendregtNormalize(
    new LambdaExpression(core, new ApplicationExpression(makeVariableExpression(core.name), sem)),
  ) as Expression;
}

export function computeCompositionSemantics(func: Expression | null, arg: Expression | null): Expression | null {
  if (func === null || arg === null) return null;
  if (!(arg instanceof LambdaExpression)) throw new Error(`\`${arg}\` must be a lambda expression`);
  const v = uniqueVariable((arg as LambdaExpression).variable);
  return barendregtNormalize(
    new LambdaExpression(v, new ApplicationExpression(func, new ApplicationExpression(arg, makeVariableExpression(v.name)))),
  ) as Expression;
}

export function computeSubstitutionSemantics(func: Expression | null, arg: Expression | null): Expression | null {
  if (func === null || arg === null) return null;
  if (!(func instanceof LambdaExpression) || !((func as LambdaExpression).term instanceof LambdaExpression))
    throw new Error(`\`${func}\` must be a lambda expression with 2 arguments`);
  if (!(arg instanceof LambdaExpression)) throw new Error(`\`${arg}\` must be a lambda expression`);
  const xVar = uniqueVariable((func as LambdaExpression).variable);
  return barendregtNormalize(
    new LambdaExpression(
      xVar,
      new ApplicationExpression(
        new ApplicationExpression(func, makeVariableExpression(xVar.name)),
        new ApplicationExpression(arg, makeVariableExpression(xVar.name)),
      ),
    ),
  ) as Expression;
}
