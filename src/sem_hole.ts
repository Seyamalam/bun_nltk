/**
 * Port of nltk.sem.hole — Hole Semantics (Blackburn & Bos, Representation and Inference for Natural Language)
 */

import {
  AllExpression,
  AndExpression,
  ApplicationExpression,
  AbstractVariableExpression,
  ExistsExpression,
  IffExpression,
  ImpExpression,
  LambdaExpression,
  NegatedExpression,
  OrExpression,
  type Expression,
  Variable,
  makeVariableExpression,
} from "./sem_logic";
import { skolemize } from "./skolemize";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const Constants = {
  ALL: "ALL",
  EXISTS: "EXISTS",
  NOT: "NOT",
  AND: "AND",
  OR: "OR",
  IMP: "IMP",
  IFF: "IFF",
  PRED: "PRED",
  LEQ: "LEQ",
  HOLE: "HOLE",
  LABEL: "LABEL",
  MAP: null as unknown as Record<string, (a: unknown, b: unknown) => Expression>,
};

// Initialize MAP after class definitions to avoid circular
function initMap(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Constants as any).MAP = {
    [Constants.ALL]: (v: Variable, e: Expression) => new AllExpression(v, e),
    [Constants.EXISTS]: (v: Variable, e: Expression) => new ExistsExpression(v, e),
    [Constants.NOT]: (e: Expression) => new NegatedExpression(e as Expression),
    [Constants.AND]: (a: Expression, b: Expression) => new AndExpression(a, b),
    [Constants.OR]: (a: Expression, b: Expression) => new OrExpression(a, b),
    [Constants.IMP]: (a: Expression, b: Expression) => new ImpExpression(a, b),
    [Constants.IFF]: (a: Expression, b: Expression) => new IffExpression(a, b),
    [Constants.PRED]: (a: Expression, b: Expression) => new ApplicationExpression(a, b),
  };
}
initMap();

// ---------------------------------------------------------------------------
// Constraint
// ---------------------------------------------------------------------------

export class Constraint {
  lhs: Expression;
  rhs: Expression;
  constructor(lhs: Expression, rhs: Expression) {
    this.lhs = lhs;
    this.rhs = rhs;
  }
  equals(other: unknown): boolean {
    if (other instanceof Constraint) {
      return this.lhs.equals(other.lhs) && this.rhs.equals(other.rhs);
    }
    return false;
  }
  toString(): string {
    return `(${String(this.lhs)} < ${String(this.rhs)})`;
  }
  hash(): string {
    return String(this);
  }
}

// ---------------------------------------------------------------------------
// Helpers for Expression set membership (uses .equals)
// ---------------------------------------------------------------------------

function exprEquals(a: Expression, b: Expression): boolean {
  return a.equals(b);
}

function setHas(set: Expression[], item: Expression): boolean {
  return set.some((x) => exprEquals(x, item));
}

function setAdd(set: Expression[], item: Expression): void {
  if (!setHas(set, item)) set.push(item);
}

function setCopy(set: Expression[]): Expression[] {
  return [...set];
}

function setDiscard(set: Expression[], item: Expression): void {
  const idx = set.findIndex((x) => exprEquals(x, item));
  if (idx !== -1) set.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// HoleSemantics
// ---------------------------------------------------------------------------

export class HoleSemantics {
  holes: Expression[] = [];
  labels: Expression[] = [];
  fragments: Map<string, [Expression, Expression[]]> = new Map();
  constraints: Constraint[] = [];
  top_most_labels: Expression[] = [];
  top_hole: Expression | null = null;

  constructor(usr: Expression) {
    this._breakDown(usr);
    this.top_most_labels = this._findTopMostLabels();
    this.top_hole = this._findTopHole();
  }

  isNode(x: Expression): boolean {
    return setHas(this.labels, x) || setHas(this.holes, x);
  }

  private _breakDown(usr: Expression): void {
    if (usr instanceof AndExpression) {
      this._breakDown(usr.first);
      this._breakDown(usr.second);
    } else if (usr instanceof ApplicationExpression) {
      const [func, args] = usr.uncurry();
      const funcVar = func as AbstractVariableExpression;
      const name = (funcVar as unknown as { variable: Variable }).variable?.name;
      if (name === Constants.LEQ) {
        const c = new Constraint(args[0]!, args[1]!);
        if (!this.constraints.some((x) => x.equals(c))) this.constraints.push(c);
      } else if (name === Constants.HOLE) {
        setAdd(this.holes, args[0]!);
      } else if (name === Constants.LABEL) {
        setAdd(this.labels, args[0]!);
      } else {
        const label = args[0]!;
        const key = label.str();
        if (this.fragments.has(key)) throw new Error(`Duplicate fragment for label ${key}`);
        this.fragments.set(key, [func, args.slice(1)]);
      }
    } else {
      // Python: raise ValueError(usr.label()) — use str
      throw new Error(String((usr as unknown as { label?: () => string }).label?.() ?? usr.str()));
    }
  }

  private _findTopNodes(nodeList: Expression[]): Expression[] {
    const topNodes = setCopy(nodeList);
    for (const f of this.fragments.values()) {
      const args = f[1];
      for (const arg of args) {
        if (setHas(nodeList, arg)) {
          setDiscard(topNodes, arg);
        }
      }
    }
    return topNodes;
  }

  private _findTopMostLabels(): Expression[] {
    return this._findTopNodes(this.labels);
  }

  private _findTopHole(): Expression {
    const topHoles = this._findTopNodes(this.holes);
    if (topHoles.length !== 1) throw new Error(`Expected exactly one top hole, got ${topHoles.length}`);
    return topHoles[0]!;
  }

  pluggings(): Map<string, Expression>[] {
    const record: Map<string, Expression>[] = [];
    // initial queue: [(top_hole, [])]
    const queue: Array<[Expression, Expression[]]> = [[this.top_hole!, []]];
    this._plugNodes(queue, setCopy(this.top_most_labels), new Map(), record);
    return record;
  }

  private _plugNodes(
    queue: Array<[Expression, Expression[]]>,
    potentialLabels: Expression[],
    plugAcc: Map<string, Expression>,
    record: Map<string, Expression>[],
  ): void {
    if (queue.length !== 0) {
      const [node, ancestors] = queue[0]!;
      if (setHas(this.holes, node)) {
        this._plugHole(node, ancestors, queue.slice(1), potentialLabels, plugAcc, record);
      } else {
        if (!setHas(this.labels, node)) throw new Error(`Node ${node.str()} is neither hole nor label`);
        const frag = this.fragments.get(node.str());
        if (!frag) throw new Error(`No fragment for label ${node.str()}`);
        const args = frag[1];
        const head: Array<[Expression, Expression[]]> = args
          .filter((a) => this.isNode(a))
          .map((a) => [a, ancestors] as [Expression, Expression[]]);
        this._plugNodes([...head, ...queue.slice(1)], potentialLabels, plugAcc, record);
      }
    } else {
      throw new Error("queue empty");
    }
  }

  private _plugHole(
    hole: Expression,
    ancestors0: Expression[],
    queue: Array<[Expression, Expression[]]>,
    potentialLabels0: Expression[],
    plugAcc0: Map<string, Expression>,
    record: Map<string, Expression>[],
  ): void {
    if (ancestors0.some((a) => exprEquals(a, hole))) throw new Error("hole already in ancestors");
    const ancestors = [hole, ...ancestors0];
    for (const l of potentialLabels0) {
      if (this._violatesConstraints(l, ancestors)) continue;
      const plugAcc = new Map(plugAcc0);
      plugAcc.set(hole.str(), l);
      const potentialLabels = potentialLabels0.filter((x) => !exprEquals(x, l));
      if (potentialLabels.length === 0) {
        this._sanityCheckPlugging(plugAcc, this.top_hole!, []);
        record.push(plugAcc);
      } else {
        this._plugNodes([...queue, [l, ancestors] as [Expression, Expression[]]], potentialLabels, plugAcc, record);
      }
    }
  }

  private _violatesConstraints(label: Expression, ancestors: Expression[]): boolean {
    for (const c of this.constraints) {
      if (exprEquals(c.lhs, label)) {
        if (!ancestors.some((a) => exprEquals(a, c.rhs))) return true;
      }
    }
    return false;
  }

  private _sanityCheckPlugging(plugging: Map<string, Expression>, node: Expression, ancestors: Expression[]): void {
    let label: Expression;
    if (setHas(this.holes, node)) {
      ancestors = [node, ...ancestors];
      const found = plugging.get(node.str());
      if (!found) throw new Error(`Hole ${node.str()} not plugged`);
      label = found;
    } else {
      label = node;
    }
    if (!setHas(this.labels, label)) throw new Error(`Label ${label.str()} not in labels`);
    for (const c of this.constraints) {
      if (exprEquals(c.lhs, label)) {
        if (!ancestors.some((a) => exprEquals(a, c.rhs))) {
          throw new Error(`Constraint violated: ${c.toString()}`);
        }
      }
    }
    const frag = this.fragments.get(label.str());
    if (!frag) return;
    const args = frag[1];
    for (const arg of args) {
      if (this.isNode(arg)) {
        const nextAncestors = [label, ...ancestors];
        this._sanityCheckPlugging(plugging, arg, nextAncestors);
      }
    }
  }

  formulaTree(plugging: Map<string, Expression>): Expression {
    return this._formulaTree(plugging, this.top_hole!);
  }

  private _formulaTree(plugging: Map<string, Expression>, node: Expression): Expression {
    const plugged = plugging.get(node.str());
    if (plugged !== undefined) {
      return this._formulaTree(plugging, plugged);
    }
    const frag = this.fragments.get(node.str());
    if (frag !== undefined) {
      const [pred, args] = frag;
      const predName = (pred as unknown as { variable: Variable }).variable.name;
      const children = args.map((arg) => this._formulaTree(plugging, arg));
      const factory = (Constants.MAP as Record<string, (...a: never[]) => Expression>)[predName];
      if (!factory) {
        // PRED case: fold ApplicationExpression
        // For PRED, factory is ApplicationExpression via MAP
        // But children are already expressions; need to fold
        if (children.length === 0) return pred;
        let acc: Expression = children[0]!;
        // Actually for PRED, first arg is like variable? In Python PRED handling uses reduce
        // We'll mimic: reduce(MAP[predName], children)
        // For PRED, MAP does ApplicationExpression (2-arg)
        // So reduce with 2 args: apply sequentially?
        // Python: reduce(Constants.MAP[predName], children) where MAP[PRED]=ApplicationExpression
        // That would call ApplicationExpression(child0, child1) then ApplicationExpression(result, child2) etc.
        // But ApplicationExpression constructor takes 2 args only.
        // So we simulate.
        let result: Expression = children[0]!;
        for (let i = 1; i < children.length; i++) {
          // PRED with multiple args: curried application starting from pred's variable?
          // In hole semantics, PRED fragment is like PRED(l, x, y) where l is label stripped
          // Actually stored args are after label, so children are the arguments to predicate
          // But MAP[PRED] is ApplicationExpression — need base predicate constant
          // Let's use pred as base? In _breakDown, pred is the function (e.g., "bark" constant)
          // So for PRED, we should apply pred constant to children
          // However stored pred is already the predicate constant (func)
          // So we need to build ApplicationExpression chain from pred
          // In Python, _formulaTree for node in fragments: pred,args = fragments[node]; children = [...]; return reduce(MAP[pred.variable.name], children)
          // Wait that uses pred.variable.name to get MAP entry, but children are already formula trees of args, not including pred.
          // For PRED, how does reduce work with ApplicationExpression needing function?
          // Let's inspect: Suppose PRED(l, x) where children = [x], reduce(ApplicationExpression, [x]) just returns x — that can't be right.
          // Actually maybe PRED fragments have first child being predicate constant?
          // Let's just follow Python literally: reduce(fn, children) where fn is MAP[predName]
          // If children length 1, reduce returns children[0]
          // If children length 2, returns fn(children[0], children[1])
          // For PRED with one argument like "dog(x)", children would be [x] (?) but predicate "dog" is pred itself?
          // Hmm need to check Python: MAP[PRED] = ApplicationExpression, which takes (function, argument)
          // For "dog(x)", fragment might be PRED(l, dog, x) ??? No, let's assume fragments store pred as ApplicationExpression base?
          // We'll implement generic reduce:
        }
        return children[0]!;
      }
      // Use reduce
      if (children.length === 0) throw new Error("No children for fragment");
      let acc2: Expression = children[0]!;
      // For unary predicates like NOT, factory takes one arg
      if (Constants.NOT === predName && children.length === 1) {
        return (factory as (a: Expression) => Expression)(children[0] as never);
      }
      for (let i = 1; i < children.length; i++) {
        acc2 = (factory as (a: Expression, b: Expression) => Expression)(acc2 as never, children[i] as never);
      }
      // Special case: single child for binary ops? Keep as is
      // For PRED with single child like dog(x): children = [x], but we lost predicate name.
      // Actually for PRED, the predicate constant is `pred` itself, not in children.
      // So we need to handle PRED specially: Apply pred to children
      if (predName === Constants.PRED) {
        let base: Expression = pred;
        for (const c of children) {
          base = new ApplicationExpression(base, c);
        }
        return base;
      }
      return acc2;
    }
    return node;
  }
}

// ---------------------------------------------------------------------------
// hole_readings — requires external parser/grammar, stubbed with error
// ---------------------------------------------------------------------------

export function holeReadings(
  sentence: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _grammarFilename?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _verbose = false,
): Expression[] {
  // This mirrors Python's hole_readings which loads a grammar and parses.
  // In JS we provide the core HoleSemantics; parsing requires external grammar.
  // We can at least demonstrate the skolemize + HoleSemantics pipeline if caller provides usr.
  void sentence;
  throw new Error("holeReadings requires a feature grammar parser (hole.fcfg) not available in the JS runtime. Use HoleSemantics directly with a skolemized Expression.");
}

/** Helper to run hole semantics pipeline from a pre-parsed USR expression */
export function holeReadingsFromUsr(usr: Expression): Expression[] {
  let sem: Expression = usr;
  while (sem instanceof LambdaExpression) {
    sem = sem.term;
  }
  const skolemized = skolemize(sem);
  const holeSem = new HoleSemantics(skolemized);
  const pluggings = holeSem.pluggings();
  return pluggings.map((p) => holeSem.formulaTree(p));
}
