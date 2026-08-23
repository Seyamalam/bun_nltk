import {
  AllExpression,
  AndExpression,
  ApplicationExpression,
  EqualityExpression,
  ExistsExpression,
  IffExpression,
  ImpExpression,
  NegatedExpression,
  OrExpression,
  Variable,
  makeVariableExpression,
  uniqueVariable,
  nextUniqueCounterValue,
  type Expression,
} from "./sem_logic";

/** Port of nltk.sem.logic.skolem_function: Fn(v1)(v2)... */
function skolemFunction(univScope: Set<Variable>): Expression {
  const n = nextUniqueCounterValue();
  let sk = makeVariableExpression(`F${n}`);
  if (univScope.size > 0) {
    // Sort for deterministic order (Python's set iteration is insertion order;
    // single-element scope — order irrelevant — otherwise sorted is stable).
    const vars = Array.from(univScope).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const v of vars) {
      sk = sk.applyto(makeVariableExpression(v.name));
    }
  }
  return sk;
}

function setToNames(s: Set<Variable>): Set<string> {
  return new Set(Array.from(s).map((v) => v.name));
}

function toCnf(first: Expression, second: Expression): Expression {
  if (first instanceof AndExpression) {
    const r1 = toCnf(first.first, second);
    const r2 = toCnf(first.second, second);
    return new AndExpression(r1, r2);
  } else if (second instanceof AndExpression) {
    const r1 = toCnf(first, second.first);
    const r2 = toCnf(first, second.second);
    return new AndExpression(r1, r2);
  } else {
    return new OrExpression(first, second);
  }
}

export function skolemize(
  expression: Expression,
  univScope: Set<Variable> | null = null,
  usedVariables: Set<Variable> | null = null,
): Expression {
  if (univScope === null) univScope = new Set();
  if (usedVariables === null) usedVariables = new Set();

  if (expression instanceof AllExpression) {
    const term = skolemize(
      expression.term,
      new Set([...univScope, expression.variable]),
      new Set([...usedVariables, expression.variable]),
    );
    const fresh = uniqueVariable(undefined, setToNames(usedVariables));
    return term.replace(expression.variable, makeVariableExpression(fresh.name));
  } else if (expression instanceof AndExpression) {
    return new AndExpression(
      skolemize(expression.first, univScope, usedVariables),
      skolemize(expression.second, univScope, usedVariables),
    );
  } else if (expression instanceof OrExpression) {
    return toCnf(
      skolemize(expression.first, univScope, usedVariables),
      skolemize(expression.second, univScope, usedVariables),
    );
  } else if (expression instanceof ImpExpression) {
    return toCnf(
      skolemize(new NegatedExpression(expression.first), univScope, usedVariables),
      skolemize(expression.second, univScope, usedVariables),
    );
  } else if (expression instanceof IffExpression) {
    const a = toCnf(
      skolemize(new NegatedExpression(expression.first), univScope, usedVariables),
      skolemize(expression.second, univScope, usedVariables),
    );
    const b = toCnf(
      skolemize(expression.first, univScope, usedVariables),
      skolemize(new NegatedExpression(expression.second), univScope, usedVariables),
    );
    return new AndExpression(a, b);
  } else if (expression instanceof EqualityExpression) {
    return expression;
  } else if (expression instanceof NegatedExpression) {
    const neg: Expression = expression.term;
    if (neg instanceof AllExpression) {
      const term = skolemize(
        new NegatedExpression(neg.term),
        univScope,
        new Set([...usedVariables, neg.variable]),
      );
      if (univScope.size > 0) {
        return term.replace(neg.variable, skolemFunction(univScope));
      } else {
        const c = makeVariableExpression(uniqueVariable(undefined, setToNames(usedVariables)).name);
        return term.replace(neg.variable, c);
      }
    } else if (neg instanceof AndExpression) {
      return toCnf(
        skolemize(new NegatedExpression(neg.first), univScope, usedVariables),
        skolemize(new NegatedExpression(neg.second), univScope, usedVariables),
      );
    } else if (neg instanceof OrExpression) {
      return new AndExpression(
        skolemize(new NegatedExpression(neg.first), univScope, usedVariables),
        skolemize(new NegatedExpression(neg.second), univScope, usedVariables),
      );
    } else if (neg instanceof ImpExpression) {
      return new AndExpression(
        skolemize(neg.first, univScope, usedVariables),
        skolemize(new NegatedExpression(neg.second), univScope, usedVariables),
      );
    } else if (neg instanceof IffExpression) {
      const a = toCnf(
        skolemize(new NegatedExpression(neg.first), univScope, usedVariables),
        skolemize(new NegatedExpression(neg.second), univScope, usedVariables),
      );
      const b = toCnf(
        skolemize(neg.first, univScope, usedVariables),
        skolemize(neg.second, univScope, usedVariables),
      );
      return new AndExpression(a, b);
    } else if (neg instanceof EqualityExpression) {
      return expression;
    } else if (neg instanceof NegatedExpression) {
      return skolemize(neg.term, univScope, usedVariables);
    } else if (neg instanceof ExistsExpression) {
      const term = skolemize(
        new NegatedExpression(neg.term),
        new Set([...univScope, neg.variable]),
        new Set([...usedVariables, neg.variable]),
      );
      const fresh = uniqueVariable(undefined, setToNames(usedVariables));
      return term.replace(neg.variable, makeVariableExpression(fresh.name));
    } else if (neg instanceof ApplicationExpression) {
      return expression;
    } else {
      throw new Error(`'${expression.str()}' cannot be skolemized`);
    }
  } else if (expression instanceof ExistsExpression) {
    const term = skolemize(
      expression.term,
      univScope,
      new Set([...usedVariables, expression.variable]),
    );
    if (univScope.size > 0) {
      return term.replace(expression.variable, skolemFunction(univScope));
    } else {
      const c = makeVariableExpression(uniqueVariable(undefined, setToNames(usedVariables)).name);
      return term.replace(expression.variable, c);
    }
  } else if (expression instanceof ApplicationExpression) {
    return expression;
  } else {
    throw new Error(`'${expression.str()}' cannot be skolemized`);
  }
}

export { toCnf as toCnfInternal };