/**
 * CCG Combinators — port of nltk/ccg/combinator.py
 * Forward/backward application, composition, type-raising, substitution.
 */
import { Direction, FunctionalCategory } from "./ccg_api.ts";
import type { AbstractCCGCategory } from "./ccg_api.ts";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface UndirectedBinaryCombinator {
  canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
  combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
  toString(): string;
}

export interface DirectedBinaryCombinator {
  canCombine(left: AbstractCCGCategory, right: AbstractCCGCategory): boolean;
  combine(left: AbstractCCGCategory, right: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
  toString(): string;
}

// ---------------------------------------------------------------------------
// Forward / Backward wrappers
// ---------------------------------------------------------------------------

export class ForwardCombinator implements DirectedBinaryCombinator {
  constructor(
    private readonly comb: UndirectedBinaryCombinator,
    private readonly pred: (l: AbstractCCGCategory, r: AbstractCCGCategory) => boolean,
    private readonly suffix = "",
  ) {}
  canCombine(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
    return this.comb.canCombine(l, r) && this.pred(l, r);
  }
  *combine(l: AbstractCCGCategory, r: AbstractCCGCategory): Iterable<AbstractCCGCategory> {
    yield* this.comb.combine(l, r);
  }
  toString(): string { return `>${this.comb}${this.suffix}`; }
}

export class BackwardCombinator implements DirectedBinaryCombinator {
  constructor(
    private readonly comb: UndirectedBinaryCombinator,
    private readonly pred: (l: AbstractCCGCategory, r: AbstractCCGCategory) => boolean,
    private readonly suffix = "",
  ) {}
  canCombine(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
    return this.comb.canCombine(r, l) && this.pred(l, r);
  }
  *combine(l: AbstractCCGCategory, r: AbstractCCGCategory): Iterable<AbstractCCGCategory> {
    yield* this.comb.combine(r, l);
  }
  toString(): string { return `<${this.comb}${this.suffix}`; }
}

// ---------------------------------------------------------------------------
// Function Application
// ---------------------------------------------------------------------------

export class UndirectedFunctionApplication implements UndirectedBinaryCombinator {
  canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean {
    if (!func.isFunction()) return false;
    return (func as FunctionalCategory).arg.canUnify(arg) !== null;
  }
  *combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory> {
    if (!func.isFunction()) return;
    const subs = (func as FunctionalCategory).arg.canUnify(arg);
    if (subs === null) return;
    yield (func as FunctionalCategory).res.substitute(subs as never);
  }
  toString(): string { return ""; }
}

// Predicates
function forwardOnly(left: AbstractCCGCategory): boolean {
  return left.isFunction() && (left as FunctionalCategory).dir.isForward();
}
function backwardOnly(_left: AbstractCCGCategory, right: AbstractCCGCategory): boolean {
  return right.isFunction() && (right as FunctionalCategory).dir.isBackward();
}
function bothForward(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
  return l.isFunction() && r.isFunction() && (l as FunctionalCategory).dir.isForward() && (r as FunctionalCategory).dir.isForward();
}
function bothBackward(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
  return l.isFunction() && r.isFunction() && (l as FunctionalCategory).dir.isBackward() && (r as FunctionalCategory).dir.isBackward();
}
function crossedDirs(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
  return l.isFunction() && r.isFunction() && (l as FunctionalCategory).dir.isForward() && (r as FunctionalCategory).dir.isBackward();
}

export const ForwardApplication = new ForwardCombinator(new UndirectedFunctionApplication(), (l, _r) => forwardOnly(l));
export const BackwardApplication = new BackwardCombinator(new UndirectedFunctionApplication(), (_l, r) => backwardOnly(_l, r));

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export class UndirectedComposition implements UndirectedBinaryCombinator {
  canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean {
    if (!(func.isFunction() && arg.isFunction())) return false;
    const f = func as FunctionalCategory, a = arg as FunctionalCategory;
    if (!(f.dir.canCompose() && a.dir.canCompose())) return false;
    return f.arg.canUnify(a.res) !== null;
  }
  *combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory> {
    if (!(func.isFunction() && arg.isFunction())) return;
    const f = func as FunctionalCategory, a = arg as FunctionalCategory;
    if (!(f.dir.canCompose() && a.dir.canCompose())) return;
    const subs = f.arg.canUnify(a.res);
    if (subs === null) return;
    yield new FunctionalCategory(f.res.substitute(subs as never), a.arg.substitute(subs as never), a.dir);
  }
  toString(): string { return "B"; }
}

function backwardBxConstraint(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
  if (!crossedDirs(l, r)) return false;
  const lf = l as FunctionalCategory, rf = r as FunctionalCategory;
  if (!lf.dir.canCross() && rf.dir.canCross()) return false;
  return lf.arg.isPrimitive();
}

export const ForwardComposition = new ForwardCombinator(new UndirectedComposition(), (l, _r) => forwardOnly(l));
export const BackwardComposition = new BackwardCombinator(new UndirectedComposition(), (_l, r) => backwardOnly(_l, r));
export const BackwardBx = new BackwardCombinator(new UndirectedComposition(), backwardBxConstraint, "x");

// ---------------------------------------------------------------------------
// Substitution
// ---------------------------------------------------------------------------

export class UndirectedSubstitution implements UndirectedBinaryCombinator {
  canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean {
    if (func.isPrimitive() || arg.isPrimitive()) return false;
    const f = func as FunctionalCategory, a = arg as FunctionalCategory;
    if (!f || !a) return false;
    if (f.res.isPrimitive()) return false;
    if (!f.arg.isPrimitive()) return false;
    if (!(f.dir.canCompose() && a.dir.canCompose())) return false;
    const fres = f.res as FunctionalCategory;
    return fres.arg.equals(a.res) && f.arg.equals(a.arg);
  }
  *combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory> {
    if (!this.canCombine(func, arg)) return;
    const f = func as FunctionalCategory, a = arg as FunctionalCategory;
    yield new FunctionalCategory((f.res as FunctionalCategory).res, a.arg, a.dir);
  }
  toString(): string { return "S"; }
}

function forwardSConstraint(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
  if (!bothForward(l, r)) return false;
  const lf = l as FunctionalCategory;
  return (lf.res as FunctionalCategory).dir.isForward() && lf.arg.isPrimitive();
}
function backwardSxConstraint(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
  const lf = l as FunctionalCategory, rf = r as FunctionalCategory;
  if (!lf.dir.canCross() && rf.dir.canCross()) return false;
  if (!bothForward(l, r)) return false;
  return (rf.res as FunctionalCategory).dir.isBackward() && rf.arg.isPrimitive();
}

export const ForwardSubstitution = new ForwardCombinator(new UndirectedSubstitution(), forwardSConstraint);
export const BackwardSx = new BackwardCombinator(new UndirectedSubstitution(), backwardSxConstraint, "x");

// ---------------------------------------------------------------------------
// Type raising
// ---------------------------------------------------------------------------

function innermostFunction(cat: AbstractCCGCategory): FunctionalCategory {
  let c = cat as FunctionalCategory;
  while ((c.res as AbstractCCGCategory).isFunction()) c = c.res as FunctionalCategory;
  return c;
}

export class UndirectedTypeRaise implements UndirectedBinaryCombinator {
  canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean {
    if (!(arg.isFunction() && (arg as FunctionalCategory).res.isFunction())) return false;
    // The python can_combine has a bug referencing undefined left/arg_categ; mirror combine logic
    if (!func.isPrimitive()) return false;
    const a = innermostFunction(arg);
    return func.canUnify(a.arg) !== null;
  }
  *combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory> {
    if (!(func.isPrimitive() && arg.isFunction() && (arg as FunctionalCategory).res.isFunction())) return;
    const a = innermostFunction(arg);
    const subs = func.canUnify(a.arg);
    if (subs === null) return;
    const xcat = a.res.substitute(subs as never);
    yield new FunctionalCategory(xcat, new FunctionalCategory(xcat, func, a.dir), a.dir.neg());
  }
  toString(): string { return "T"; }
}

function forwardTConstraint(_l: AbstractCCGCategory, r: AbstractCCGCategory): boolean {
  if (!r.isFunction()) return false;
  const a = innermostFunction(r);
  return a.dir.isBackward() && a.res.isPrimitive();
}
function backwardTConstraint(l: AbstractCCGCategory, _r: AbstractCCGCategory): boolean {
  if (!l.isFunction()) return false;
  const a = innermostFunction(l);
  return a.dir.isForward() && a.res.isPrimitive();
}

export const ForwardT = new ForwardCombinator(new UndirectedTypeRaise(), forwardTConstraint);
export const BackwardT = new BackwardCombinator(new UndirectedTypeRaise(), backwardTConstraint);

// Export helpers for testing
export { innermostFunction, forwardOnly, backwardOnly, bothForward, bothBackward };
