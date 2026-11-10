/**
 * Port of nltk.inference.nonmonotonic — nonmonotonic reasoning decorators
 * (closed domain, closed world, unique names).
 *
 * The assumption/goal transformations are pure FOL and fully ported. The
 * final prove() call still delegates to the decorated ProverCommand (and
 * UniqueNamesProver.assumptions() itself calls Prover9), so binary-bound
 * paths propagate the external-binary error as NLTK does without the binary.
 */

import { ProverCommandDecorator } from "./inference_api";
import { Prover9, Prover9Command } from "./inference_prover9";
import {
  AbstractVariableExpression,
  AllExpression,
  AndExpression,
  ApplicationExpression,
  BooleanExpression,
  EqualityExpression,
  ExistsExpression,
  Expression,
  ImpExpression,
  NegatedExpression,
  OrExpression,
  Variable,
  VariableExpression,
  unique_variable,
} from "./sem_logic";
import { pyError } from "./internals";

/** Port of nltk.inference.nonmonotonic.ProverParseError — a third ProverParseError
 * class distinct from the ones in resolution.py and tableau.py (NLTK defines a
 * separate class in each module). */
export class ProverParseError extends Error {
  constructor(message = "") {
    super(message);
    this.name = "ProverParseError";
  }
}

/** Port of nltk.inference.nonmonotonic.get_domain. */
export function get_domain(goal: Expression | null, assumptions: Expression[]): Set<Variable> {
  const allExpressions = goal === null ? assumptions : [...assumptions, goal.negate()];
  const domain = new Set<Variable>();
  for (const a of allExpressions) for (const c of a.constants()) domain.add(c);
  return domain;
}
export const getDomain = get_domain;

function reduceOr(exprs: Expression[]): Expression {
  let acc = exprs[0]!;
  for (let i = 1; i < exprs.length; i++) acc = new OrExpression(acc, exprs[i]!);
  return acc;
}

function reduceAnd(exprs: Expression[]): Expression {
  let acc = exprs[0]!;
  for (let i = 1; i < exprs.length; i++) acc = new AndExpression(acc, exprs[i]!);
  return acc;
}

/** Port of nltk.inference.nonmonotonic.ClosedDomainProver — adds domain
 * closure assumptions before proving. */
export class ClosedDomainProver extends ProverCommandDecorator {
  override assumptions(): Expression[] {
    const assumptions = [...this._command.assumptions()];
    const goal = this._command.goal();
    const domain = get_domain(goal, assumptions);
    return assumptions.map((ex) => this.replace_quants(ex, domain));
  }

  override goal(): Expression | null {
    const goal = this._command.goal();
    const domain = get_domain(goal, this._command.assumptions());
    return this.replace_quants(goal!, domain);
  }

  /**
   * Apply the closed domain assumption to the expression
   *
   * - Domain = union([e.free()|e.constants() for e in all_expressions])
   * - translate "exists x.P" to "(z=d1 | z=d2 | ... ) & P.replace(x,z)" OR
   *             "P.replace(x, d1) | P.replace(x, d2) | ..."
   * - translate "all x.P" to "P.replace(x, d1) & P.replace(x, d2) & ..."
   */
  replace_quants(ex: Expression, domain: Set<Variable>): Expression {
    if (ex instanceof AllExpression) {
      let conjuncts = [...domain].map((d) =>
        ex.term.replace(ex.variable, VariableExpression(d)),
      );
      conjuncts = conjuncts.map((c) => this.replace_quants(c, domain));
      return reduceAnd(conjuncts);
    } else if (ex instanceof BooleanExpression) {
      const Ctor = ex.constructor as new (a: Expression, b: Expression) => Expression;
      return new Ctor(
        this.replace_quants(ex.first, domain),
        this.replace_quants(ex.second, domain),
      );
    } else if (ex instanceof NegatedExpression) {
      return this.replace_quants(ex.term, domain).negate();
    } else if (ex instanceof ExistsExpression) {
      let disjuncts = [...domain].map((d) =>
        ex.term.replace(ex.variable, VariableExpression(d)),
      );
      disjuncts = disjuncts.map((d) => this.replace_quants(d, domain));
      return reduceOr(disjuncts);
    }
    return ex;
  }
  replaceQuants(ex: Expression, domain: Set<Variable>): Expression {
    return this.replace_quants(ex, domain);
  }
}

/** Port of nltk.inference.nonmonotonic.UniqueNamesProver — adds unique names
 * assumptions before proving. The inner Prover9 prove() call propagates the
 * external-binary error when the domain has 2+ elements, as NLTK does
 * without the binary. */
export class UniqueNamesProver extends ProverCommandDecorator {
  /**
   * - Domain = union([e.free()|e.constants() for e in all_expressions])
   * - if "d1 = d2" cannot be proven from the premises, then add "d1 != d2"
   */
  override assumptions(): Expression[] {
    const assumptions = this._command.assumptions();

    const domain = [...get_domain(this._command.goal(), assumptions)];

    // build a dictionary of obvious equalities
    const eqSets = new SetHolder();
    for (const a of assumptions) {
      if (a instanceof EqualityExpression) {
        const av = (a.first as AbstractVariableExpression).variable;
        const bv = (a.second as AbstractVariableExpression).variable;
        // put 'a' and 'b' in the same set
        eqSets.get(av).add(bv);
      }
    }

    const newAssumptions: Expression[] = [];
    for (let i = 0; i < domain.length; i++) {
      const a = domain[i]!;
      for (const b of domain.slice(i + 1)) {
        // if a and b are not already in the same equality set
        if (!eqSets.get(a).has(b)) {
          const newEqEx = new EqualityExpression(VariableExpression(a), VariableExpression(b));
          if (new Prover9().prove(newEqEx, assumptions)) {
            // we can prove that the names are the same entity.
            // remember that they are equal so we don't re-check.
            eqSets.get(a).add(b);
          } else {
            // we can't prove it, so assume unique names
            newAssumptions.push(newEqEx.negate());
          }
        }
      }
    }

    return [...assumptions, ...newAssumptions];
  }
}

/** Port of nltk.inference.nonmonotonic.SetHolder — a list of sets of
 * Variables where getitem returns the set containing the item, creating it
 * if absent. Python's ``holder[item]`` becomes ``holder.get(item)`` here. */
export class SetHolder extends Array<Set<Variable>> {
  get(item: Variable): Set<Variable> {
    if (!(item instanceof Variable)) {
      throw pyError("AssertionError", `${item} is not a Variable`);
    }
    for (const s of this) {
      if (s.has(item)) return s;
    }
    // item is not found in any existing set. so create a new set
    const created = new Set<Variable>([item]);
    this.push(created);
    return created;
  }

  // Python ``list`` member surface (SetHolder extends list in NLTK).
  append(x: Set<Variable>): void {
    this.push(x);
  }
  clear(): void {
    this.length = 0;
  }
  copy(): Set<Variable>[] {
    return this.slice();
  }
  count(x: Set<Variable>): number {
    return this.filter((s) => s === x).length;
  }
  extend(xs: Iterable<Set<Variable>>): void {
    this.push(...xs);
  }
  index(x: Set<Variable>, start = 0, stop = this.length): number {
    for (let i = start; i < Math.min(stop, this.length); i++) {
      if (this[i] === x) return i;
    }
    throw pyError("ValueError", `${x} is not in list`);
  }
  insert(i: number, x: Set<Variable>): void {
    this.splice(i, 0, x);
  }
  remove(x: Set<Variable>): void {
    this.splice(this.index(x), 1);
  }
}

/** Port of nltk.inference.nonmonotonic.PredHolder — dictionary payload for
 * ClosedWorldProver predicate completion. */
export class PredHolder {
  signatures: Expression[][];
  properties: Array<[Variable[], Expression]>;
  signature_len: number | null;

  constructor() {
    this.signatures = [];
    this.properties = [];
    this.signature_len = null;
  }

  append_sig(newSig: Expression[]): void {
    this.validate_sig_len(newSig);
    this.signatures.push(newSig);
  }
  appendSig(newSig: Expression[]): void {
    this.append_sig(newSig);
  }

  append_prop(newProp: [Variable[], Expression]): void {
    this.validate_sig_len(newProp[0]);
    this.properties.push(newProp);
  }
  appendProp(newProp: [Variable[], Expression]): void {
    this.append_prop(newProp);
  }

  validate_sig_len(newSig: readonly unknown[]): void {
    if (this.signature_len === null) {
      this.signature_len = newSig.length;
    } else if (this.signature_len !== newSig.length) {
      throw new Error("Signature lengths do not match");
    }
  }
  validateSigLen(newSig: readonly unknown[]): void {
    this.validate_sig_len(newSig);
  }

  toString(): string {
    const sigs = this.signatures
      .map((s) => `(${s.map((e) => e.str()).join(",")})`)
      .join(", ");
    const props = this.properties
      .map(([vs, ex]) => `((${vs.map((v) => v.name).join(",")}),(${ex.str()}))`)
      .join(", ");
    return `([${sigs}],[${props}],${this.signature_len})`;
  }
}

/** Port of nltk.inference.nonmonotonic.ClosedWorldProver — completes
 * predicates before proving (predicate completion). */
export class ClosedWorldProver extends ProverCommandDecorator {
  override assumptions(): Expression[] {
    const assumptions = this._command.assumptions();

    const predicates = this._make_predicate_dict(assumptions);

    const newAssumptions: Expression[] = [];
    for (const [p, predHolder] of predicates) {
      const newSig = this._make_unique_signature(predHolder);
      const newSigExs = newSig.map((v) => VariableExpression(v));

      const disjuncts: Expression[] = [];

      // Turn the signatures into disjuncts
      for (const sig of predHolder.signatures) {
        const equalityExs: Expression[] = [];
        for (let i = 0; i < newSigExs.length; i++) {
          equalityExs.push(new EqualityExpression(newSigExs[i]!, sig[i]!));
        }
        disjuncts.push(reduceAnd(equalityExs));
      }

      // Turn the properties into disjuncts
      for (const prop of predHolder.properties) {
        // replace variables from the signature with new sig variables
        const bindings = new Map<string, Expression>();
        for (let i = 0; i < newSigExs.length; i++) {
          bindings.set(prop[0][i]!.name, newSigExs[i]!);
        }
        disjuncts.push(prop[1].substituteBindings(bindings));
      }

      // make the assumption
      let accum: Expression;
      if (disjuncts.length) {
        // disjuncts exist, so make an implication
        const antecedent = this._make_antecedent(p, newSig);
        const consequent = reduceOr(disjuncts);
        accum = new ImpExpression(antecedent, consequent);
      } else {
        // nothing has property 'p'
        accum = new NegatedExpression(this._make_antecedent(p, newSig));
      }

      // quantify the implication
      for (const newSigVar of [...newSig].reverse()) {
        accum = new AllExpression(newSigVar, accum);
      }
      newAssumptions.push(accum);
    }

    return [...assumptions, ...newAssumptions];
  }

  _make_unique_signature(predHolder: PredHolder): Variable[] {
    /**
     * This method figures out how many arguments the predicate takes and
     * returns a tuple containing that number of unique variables.
     */
    return Array.from({ length: predHolder.signature_len! }, () => unique_variable());
  }
  _makeUniqueSignature(predHolder: PredHolder): Variable[] {
    return this._make_unique_signature(predHolder);
  }

  _make_antecedent(predicate: AbstractVariableExpression, signature: Variable[]): Expression {
    /**
     * Return an application expression with 'predicate' as the predicate
     * and 'signature' as the list of arguments.
     */
    let antecedent: Expression = predicate;
    for (const v of signature) {
      antecedent = antecedent.applyto(VariableExpression(v));
    }
    return antecedent;
  }
  _makeAntecedent(predicate: AbstractVariableExpression, signature: Variable[]): Expression {
    return this._make_antecedent(predicate, signature);
  }

  _make_predicate_dict(assumptions: Expression[]): Map<AbstractVariableExpression, PredHolder> {
    /**
     * Create a dictionary of predicates from the assumptions.
     */
    const predicates = new Map<AbstractVariableExpression, PredHolder>();
    const get = (k: AbstractVariableExpression): PredHolder => {
      // defaultdict(PredHolder): key by expression equality
      for (const [existing, holder] of predicates) {
        if (existing.equals(k)) return holder;
      }
      const holder = new PredHolder();
      predicates.set(k, holder);
      return holder;
    };
    for (const a of assumptions) {
      this._mapPredicates(a, get);
    }
    return predicates;
  }
  _makePredicateDict(assumptions: Expression[]): Map<AbstractVariableExpression, PredHolder> {
    return this._make_predicate_dict(assumptions);
  }

  private _mapPredicates(
    expression: Expression,
    predGet: (k: AbstractVariableExpression) => PredHolder,
  ): void {
    if (expression instanceof ApplicationExpression) {
      const [func, args] = expression.uncurry();
      if (func instanceof AbstractVariableExpression) {
        predGet(func).append_sig(args);
      }
    } else if (expression instanceof AndExpression) {
      this._mapPredicates(expression.first, predGet);
      this._mapPredicates(expression.second, predGet);
    } else if (expression instanceof AllExpression) {
      // collect all the universally quantified variables
      const sig: Variable[] = [expression.variable];
      let term = expression.term;
      while (term instanceof AllExpression) {
        sig.push(term.variable);
        term = term.term;
      }
      if (term instanceof ImpExpression) {
        if (term.first instanceof ApplicationExpression && term.second instanceof ApplicationExpression) {
          const [func1, args1] = term.first.uncurry();
          const [func2, args2] = term.second.uncurry();
          if (
            func1 instanceof AbstractVariableExpression &&
            func2 instanceof AbstractVariableExpression &&
            sameVars(sig, args1.map((v) => (v as AbstractVariableExpression).variable)) &&
            sameVars(sig, args2.map((v) => (v as AbstractVariableExpression).variable))
          ) {
            predGet(func2).append_prop([sig, term.first]);
            predGet(func1).validate_sig_len(sig);
          }
        }
      }
    }
  }
}

function sameVars(a: Variable[], b: Variable[]): boolean {
  return a.length === b.length && a.every((v, i) => v.equals(b[i]!));
}

/** Port of nltk.inference.nonmonotonic.print_proof — runs Prover9 and the
 * combined UniqueNames+ClosedWorld prover; propagates the external-binary
 * error as NLTK does without the binary. */
export function print_proof(goal: string, premises: Expression[]): void {
  const lexpr = Expression.fromstring;
  const prover = new Prover9Command(lexpr(goal), premises);
  const command = new UniqueNamesProver(new ClosedWorldProver(prover));
  console.log(goal, prover.prove(), command.prove());
}
export const printProof = print_proof;
// ---------------------------------------------------------------------------
// Demo drivers — faithful ports; each hits the external Prover9 binary wall at
// its first prove() call, exactly as NLTK does without the binary installed.
// ---------------------------------------------------------------------------

/** Port of nltk.inference.nonmonotonic.closed_domain_demo. */
export function closed_domain_demo(): void {
  const lexpr = Expression.fromstring;

  let p1 = lexpr("exists x.walk(x)");
  let p2 = lexpr("man(Socrates)");
  let c = lexpr("walk(Socrates)");
  let prover = new Prover9Command(c, [p1, p2]);
  console.log(prover.prove());
  let cdp = new ClosedDomainProver(prover);
  console.log("assumptions:");
  for (const a of cdp.assumptions()) console.log("   ", a.str());
  console.log("goal:", cdp.goal()!.str());
  console.log(cdp.prove());

  p1 = lexpr("exists x.walk(x)");
  p2 = lexpr("man(Socrates)");
  const p3 = lexpr("-walk(Bill)");
  c = lexpr("walk(Socrates)");
  prover = new Prover9Command(c, [p1, p2, p3]);
  console.log(prover.prove());
  cdp = new ClosedDomainProver(prover);
  console.log("assumptions:");
  for (const a of cdp.assumptions()) console.log("   ", a.str());
  console.log("goal:", cdp.goal()!.str());
  console.log(cdp.prove());

  p1 = lexpr("walk(Socrates)");
  p2 = lexpr("walk(Bill)");
  c = lexpr("all x.walk(x)");
  prover = new Prover9Command(c, [p1, p2]);
  console.log(prover.prove());
  cdp = new ClosedDomainProver(prover);
  console.log("assumptions:");
  for (const a of cdp.assumptions()) console.log("   ", a.str());
  console.log("goal:", cdp.goal()!.str());
  console.log(cdp.prove());

  p1 = lexpr("girl(mary)");
  p2 = lexpr("dog(rover)");
  const p3b = lexpr("all x.(girl(x) -> -dog(x))");
  const p4 = lexpr("all x.(dog(x) -> -girl(x))");
  const p5 = lexpr("chase(mary, rover)");
  c = lexpr("exists y.(dog(y) & all x.(girl(x) -> chase(x,y)))");
  prover = new Prover9Command(c, [p1, p2, p3b, p4, p5]);
  console.log(prover.prove());
  cdp = new ClosedDomainProver(prover);
  console.log("assumptions:");
  for (const a of cdp.assumptions()) console.log("   ", a.str());
  console.log("goal:", cdp.goal()!.str());
  console.log(cdp.prove());
}
export const closedDomainDemo = closed_domain_demo;

/** Port of nltk.inference.nonmonotonic.unique_names_demo. */
export function unique_names_demo(): void {
  const lexpr = Expression.fromstring;

  let p1 = lexpr("man(Socrates)");
  let p2 = lexpr("man(Bill)");
  let c = lexpr("exists x.exists y.(x != y)");
  let prover = new Prover9Command(c, [p1, p2]);
  console.log(prover.prove());
  let unp = new UniqueNamesProver(prover);
  console.log("assumptions:");
  for (const a of unp.assumptions()) console.log("   ", a.str());
  console.log("goal:", unp.goal()!.str());
  console.log(unp.prove());

  p1 = lexpr("all x.(walk(x) -> (x = Socrates))");
  p2 = lexpr("Bill = William");
  const p3 = lexpr("Bill = Billy");
  c = lexpr("-walk(William)");
  prover = new Prover9Command(c, [p1, p2, p3]);
  console.log(prover.prove());
  unp = new UniqueNamesProver(prover);
  console.log("assumptions:");
  for (const a of unp.assumptions()) console.log("   ", a.str());
  console.log("goal:", unp.goal()!.str());
  console.log(unp.prove());
}
export const uniqueNamesDemo = unique_names_demo;

/** Port of nltk.inference.nonmonotonic.closed_world_demo. */
export function closed_world_demo(): void {
  const lexpr = Expression.fromstring;

  let p1 = lexpr("walk(Socrates)");
  let p2 = lexpr("(Socrates != Bill)");
  let c = lexpr("-walk(Bill)");
  let prover = new Prover9Command(c, [p1, p2]);
  console.log(prover.prove());
  let cwp = new ClosedWorldProver(prover);
  console.log("assumptions:");
  for (const a of cwp.assumptions()) console.log("   ", a.str());
  console.log("goal:", cwp.goal()!.str());
  console.log(cwp.prove());

  p1 = lexpr("see(Socrates, John)");
  p2 = lexpr("see(John, Mary)");
  const p3 = lexpr("(Socrates != John)");
  const p4 = lexpr("(John != Mary)");
  c = lexpr("-see(Socrates, Mary)");
  prover = new Prover9Command(c, [p1, p2, p3, p4]);
  console.log(prover.prove());
  cwp = new ClosedWorldProver(prover);
  console.log("assumptions:");
  for (const a of cwp.assumptions()) console.log("   ", a.str());
  console.log("goal:", cwp.goal()!.str());
  console.log(cwp.prove());

  p1 = lexpr("all x.(ostrich(x) -> bird(x))");
  p2 = lexpr("bird(Tweety)");
  const p3b = lexpr("-ostrich(Sam)");
  const p4b = lexpr("Sam != Tweety");
  c = lexpr("-bird(Sam)");
  prover = new Prover9Command(c, [p1, p2, p3b, p4b]);
  console.log(prover.prove());
  cwp = new ClosedWorldProver(prover);
  console.log("assumptions:");
  for (const a of cwp.assumptions()) console.log("   ", a.str());
  console.log("goal:", cwp.goal()!.str());
  console.log(cwp.prove());
}
export const closedWorldDemo = closed_world_demo;

/** Port of nltk.inference.nonmonotonic.combination_prover_demo. */
export function combination_prover_demo(): void {
  const lexpr = Expression.fromstring;

  const p1 = lexpr("see(Socrates, John)");
  const p2 = lexpr("see(John, Mary)");
  const c = lexpr("-see(Socrates, Mary)");
  const prover = new Prover9Command(c, [p1, p2]);
  console.log(prover.prove());
  const command = new ClosedDomainProver(new UniqueNamesProver(new ClosedWorldProver(prover)));
  for (const a of command.assumptions()) console.log(a.str());
  console.log(command.prove());
}
export const combinationProverDemo = combination_prover_demo;

/** Port of nltk.inference.nonmonotonic.default_reasoning_demo. */
export function default_reasoning_demo(): void {
  const lexpr = Expression.fromstring;
  const premises: Expression[] = [];

  // define taxonomy
  premises.push(lexpr("all x.(elephant(x)        -> animal(x))"));
  premises.push(lexpr("all x.(bird(x)            -> animal(x))"));
  premises.push(lexpr("all x.(dove(x)            -> bird(x))"));
  premises.push(lexpr("all x.(ostrich(x)         -> bird(x))"));
  premises.push(lexpr("all x.(flying_ostrich(x)  -> ostrich(x))"));

  // default properties
  premises.push(lexpr("all x.((animal(x)  & -Ab1(x)) -> -fly(x))")); // normal animals don't fly
  premises.push(lexpr("all x.((bird(x)    & -Ab2(x)) -> fly(x))")); // normal birds fly
  premises.push(lexpr("all x.((ostrich(x) & -Ab3(x)) -> -fly(x))")); // normal ostriches don't fly

  // specify abnormal entities
  premises.push(lexpr("all x.(bird(x)           -> Ab1(x))")); // flight
  premises.push(lexpr("all x.(ostrich(x)        -> Ab2(x))")); // non-flying bird
  premises.push(lexpr("all x.(flying_ostrich(x) -> Ab3(x))")); // flying ostrich

  // define entities
  premises.push(lexpr("elephant(E)"));
  premises.push(lexpr("dove(D)"));
  premises.push(lexpr("ostrich(O)"));

  // print the assumptions
  const prover = new Prover9Command(null, premises);
  const command = new UniqueNamesProver(new ClosedWorldProver(prover));
  for (const a of command.assumptions()) console.log(a.str());

  print_proof("-fly(E)", premises);
  print_proof("fly(D)", premises);
  print_proof("-fly(O)", premises);
}
export const defaultReasoningDemo = default_reasoning_demo;

/** Port of nltk.inference.nonmonotonic.demo. */
export function demo(): void {
  closed_domain_demo();
  unique_names_demo();
  closed_world_demo();
  combination_prover_demo();
  default_reasoning_demo();
}
export const nonmonotonicDemo = demo;
