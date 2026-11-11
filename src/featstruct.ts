/**
 * Port of the nltk.featstruct machinery needed by nltk.parse.featurechart
 * (NLTK 3.10.3): variables, feature dictionaries/lists, bindings,
 * rename/find_variables, unification with forward pointers + reentrancy,
 * and the FeatStructReader subset used by FeatureGrammar.fromstring.
 *
 * nltk.featstruct itself is an excluded module; this provides the internal
 * equivalents the feature-chart port depends on.
 */
import { pyError } from "./internals";
import { Expression, Variable as LogicVariable } from "./sem_logic";

export const TYPE = "type";
export const SLASH = "slash";

/** nltk.featstruct.Variable — identity by name. */
export class Variable {
  constructor(public readonly name: string) {}
  toString(): string {
    return this.name;
  }
}

export class UnificationFailureType {
  toString(): string {
    return "nltk.featstruct.UnificationFailure";
  }
}
export const UnificationFailure = new UnificationFailureType();
class UnificationFailureError extends Error {}

export type FeatPrimitive = string | number | boolean | null;
export type FeatValue = FeatPrimitive | Variable | Expression | FeatDict | FeatList | FeatStructNonterminalLike;

/** nltk.featstruct.FeatList — sequence feature value. */
export class FeatList {
  constructor(public items: FeatValue[] = []) {}
  get length(): number {
    return this.items.length;
  }
}

// ---- SubstituteBindingsSequence values ---------------------------------------
//
// nltk.featstruct.FeatureValueTuple/Concat/Set/Union: sequence-valued base
// feature values that distribute variables() and substitute_bindings() over
// their elements.  Concat (`+` in `()`) collapses to a flat tuple once all
// variables are bound; Union (`+` in `{}`) collapses to a set.

export type FeatSeqValue = FeatureValueTuple | FeatureValueConcat | FeatureValueSet | FeatureValueUnion;

function seqItemsEq(a: FeatValue, b: FeatValue): boolean {
  return featValueEq(a, b);
}

/** nltk.featstruct.FeatureValueTuple — an immutable tuple of base values. */
export class FeatureValueTuple {
  readonly items: FeatValue[];
  constructor(values: Iterable<FeatValue> = []) {
    this.items = [...values];
  }
  get length(): number {
    return this.items.length;
  }
  *[Symbol.iterator](): Iterator<FeatValue> {
    yield* this.items;
  }
  variables(): Variable[] {
    return seqVariables(this.items);
  }
  substituteBindings(bindings: Bindings): FeatValue {
    return new FeatureValueTuple(this.items.map((v) => substSeqElt(v, bindings)));
  }
  toString(): string {
    if (this.items.length === 0) return "()";
    return `(${this.items.map((v) => `${v}`).join(", ")})`;
  }
}

/** nltk.featstruct.FeatureValueConcat — `a + b` inside `()`. */
export class FeatureValueConcat {
  readonly items: FeatValue[];
  private constructor(values: FeatValue[]) {
    this.items = values;
  }
  /** Mirrors FeatureValueConcat.__new__: flatten concats; if no variables
   * remain, collapse tuple elements into a FeatureValueTuple; a single
   * remaining value collapses to that value. */
  static create(values: Iterable<FeatValue>): FeatValue {
    let flat = flattenSeq(values, FeatureValueConcat);
    if (!flat.some((v) => v instanceof Variable)) {
      flat = flattenSeq(flat, FeatureValueTuple);
      return new FeatureValueTuple(flat);
    }
    if (flat.length === 1) return flat[0]!;
    return new FeatureValueConcat(flat);
  }
  get length(): number {
    return this.items.length;
  }
  *[Symbol.iterator](): Iterator<FeatValue> {
    yield* this.items;
  }
  variables(): Variable[] {
    return new FeatureValueTuple(this.items).variables();
  }
  substituteBindings(bindings: Bindings): FeatValue {
    return FeatureValueConcat.create(this.items.map((v) => substSeqElt(v, bindings)));
  }
  toString(): string {
    return `(${this.items.map((v) => `${v}`).join("+")})`;
  }
}

/** nltk.featstruct.FeatureValueSet — immutable set of base values (dedup'd). */
export class FeatureValueSet {
  readonly items: FeatValue[];
  constructor(values: Iterable<FeatValue> = []) {
    const out: FeatValue[] = [];
    for (const v of values) if (!out.some((x) => seqItemsEq(x, v))) out.push(v);
    this.items = out;
  }
  get length(): number {
    return this.items.length;
  }
  *[Symbol.iterator](): Iterator<FeatValue> {
    yield* this.items;
  }
  variables(): Variable[] {
    return new FeatureValueTuple(this.items).variables();
  }
  substituteBindings(bindings: Bindings): FeatValue {
    return new FeatureValueSet(this.items.map((v) => substSeqElt(v, bindings)));
  }
  toString(): string {
    if (this.items.length === 0) return "{/}";
    return `{${this.items.map((v) => `${v}`).sort().join(", ")}}`;
  }
}

/** nltk.featstruct.FeatureValueUnion — `a + b` inside `{}`. */
export class FeatureValueUnion {
  readonly items: FeatValue[];
  private constructor(values: FeatValue[]) {
    this.items = values;
  }
  /** Mirrors FeatureValueUnion.__new__: flatten unions; if no variables
   * remain, collapse set elements into a FeatureValueSet; a single
   * remaining value collapses to that value. */
  static create(values: Iterable<FeatValue>): FeatValue {
    let flat = flattenSeq(values, FeatureValueUnion);
    if (!flat.some((v) => v instanceof Variable)) {
      flat = flattenSeq(flat, FeatureValueSet);
      return new FeatureValueSet(flat);
    }
    if (flat.length === 1) return flat[0]!;
    return new FeatureValueUnion(flat);
  }
  get length(): number {
    return this.items.length;
  }
  *[Symbol.iterator](): Iterator<FeatValue> {
    yield* this.items;
  }
  variables(): Variable[] {
    return new FeatureValueTuple(this.items).variables();
  }
  substituteBindings(bindings: Bindings): FeatValue {
    return FeatureValueUnion.create(this.items.map((v) => substSeqElt(v, bindings)));
  }
  toString(): string {
    return `{${this.items.map((v) => `${v}`).sort().join("+")}}`;
  }
}

function isSeqValue(v: unknown): v is FeatSeqValue {
  return v instanceof FeatureValueTuple || v instanceof FeatureValueConcat ||
    v instanceof FeatureValueSet || v instanceof FeatureValueUnion;
}

/** SubstituteBindingsSequence.variables: Variable elements first (in order),
 * then the variables() of nested SubstituteBindingsI elements. */
function seqVariables(items: readonly FeatValue[]): Variable[] {
  const out: Variable[] = [];
  for (const elt of items) if (elt instanceof Variable) out.push(elt);
  for (const elt of items) {
    if (isSeqValue(elt)) out.push(...elt.variables());
    else if (elt instanceof Expression) for (const v of elt.variables()) out.push(new Variable(v.name));
  }
  return out;
}

/** Translate a feature-structure bindings map into the Variable|Expression
 * map that Expression.substituteBindings expects (oracle keys on Variable;
 * feature-structure Variables map to identically-named logic Variables). */
function exprBindings(bindings: Bindings): Map<string, LogicVariable | Expression> {
  const out = new Map<string, LogicVariable | Expression>();
  for (const [k, v] of bindings) {
    if (v instanceof Variable) out.set(k, new LogicVariable(v.name));
    else out.set(k, v as LogicVariable | Expression);
  }
  return out;
}

function flattenSeq(values: Iterable<FeatValue>, cls: Function): FeatValue[] {
  const result: FeatValue[] = [];
  for (const elt of values) {
    if (elt instanceof cls) result.push(...(elt as FeatSeqValue).items);
    else result.push(elt);
  }
  return result;
}

function substSeqElt(v: FeatValue, bindings: Bindings): FeatValue {
  if (v instanceof FeatureValueTuple || v instanceof FeatureValueConcat ||
      v instanceof FeatureValueSet || v instanceof FeatureValueUnion) {
    return v.substituteBindings(bindings);
  }
  if (v instanceof Expression) return v.substituteBindings(exprBindings(bindings));
  if (v instanceof Variable) return bindings.get(v.name) ?? v;
  return v;
}

/** Structural equality for base feature values (oracle `fval1 == fval2`). */
export function featValueEq(a: FeatValue, b: FeatValue): boolean {
  if (a instanceof Variable || b instanceof Variable) {
    return a instanceof Variable && b instanceof Variable && a.name === b.name;
  }
  if (a instanceof Expression || b instanceof Expression) {
    return a instanceof Expression && b instanceof Expression && a.equals(b);
  }
  const seqA = a instanceof FeatureValueTuple || a instanceof FeatureValueConcat;
  const seqB = b instanceof FeatureValueTuple || b instanceof FeatureValueConcat;
  if (seqA || seqB) {
    if (!seqA || !seqB || a!.constructor !== b!.constructor) return false;
    const x = (a as FeatSeqValue).items, y = (b as FeatSeqValue).items;
    return x.length === y.length && x.every((v, i) => featValueEq(v, y[i]!));
  }
  const setA = a instanceof FeatureValueSet || a instanceof FeatureValueUnion;
  const setB = b instanceof FeatureValueSet || b instanceof FeatureValueUnion;
  if (setA || setB) {
    if (!setA || !setB || a!.constructor !== b!.constructor) return false;
    const x = (a as FeatSeqValue).items, y = (b as FeatSeqValue).items;
    return x.length === y.length && x.every((v) => y.some((w) => featValueEq(v, w)));
  }
  return a === b;
}

/** nltk.featstruct.FeatDict — mapping feature value (the canonical FeatStruct). */
export class FeatDict {
  readonly map = new Map<string, FeatValue>();
  constructor(init?: Record<string, FeatValue>) {
    if (init) for (const [k, v] of Object.entries(init)) this.map.set(k, v);
  }
  get(name: string): FeatValue | undefined {
    return this.map.get(name);
  }
  set(name: string, value: FeatValue): void {
    this.map.set(name, value);
  }
  has(name: string): boolean {
    return this.map.has(name);
  }
  delete(name: string): void {
    this.map.delete(name);
  }
  entries(): IterableIterator<[string, FeatValue]> {
    return this.map.entries();
  }
  get size(): number {
    return this.map.size;
  }
}

/** nltk.featstruct.FeatStruct — alias of FeatDict for parity naming. */
export class FeatStruct extends FeatDict {
  static fromstring(text: string): FeatDict {
    const [v] = featstructReader.read(text);
    if (!(v instanceof FeatDict)) throw pyError("ValueError", "Expected a feature dictionary");
    return v as FeatDict;
  }
}

export function isFeatStruct(v: unknown): v is FeatDict | FeatList {
  return v instanceof FeatDict || v instanceof FeatList;
}

function isVariable(v: unknown): v is Variable {
  return v instanceof Variable;
}

// ---- bindings / variables ----------------------------------------------------

export type Bindings = Map<string, FeatValue>;

function deepClone<T extends FeatValue>(value: T, memo: Map<object, FeatValue>): T {
  if (value instanceof FeatDict) {
    const hit = memo.get(value);
    if (hit) return hit as T;
    const copy = new FeatDict();
    memo.set(value, copy);
    for (const [k, v] of value.entries()) copy.set(k, deepClone(v, memo));
    return copy as T;
  }
  if (value instanceof FeatList) {
    const hit = memo.get(value);
    if (hit) return hit as T;
    const copy = new FeatList();
    memo.set(value, copy);
    copy.items = value.items.map((v) => deepClone(v, memo));
    return copy as T;
  }
  return value;
}

function* eachPair(fstruct: FeatDict | FeatList): Generator<[string | number, FeatValue]> {
  if (fstruct instanceof FeatDict) yield* fstruct.entries();
  else for (let i = 0; i < fstruct.items.length; i++) yield [i, fstruct.items[i]!];
}

function setSlot(fstruct: FeatDict | FeatList, key: string | number, value: FeatValue): void {
  if (fstruct instanceof FeatDict) fstruct.set(String(key), value);
  else fstruct.items[Number(key)] = value;
}

/** nltk.featstruct.substitute_bindings. */
export function substitute_bindings<T extends FeatDict | FeatList>(fstruct: T, bindings: Bindings): T {
  const copy = deepClone(fstruct, new Map());
  _substitute(copy, bindings, new Set());
  return copy;
}
export const substituteBindings = substitute_bindings;

function _substitute(fstruct: FeatDict | FeatList, bindings: Bindings, visited: Set<object>): void {
  if (visited.has(fstruct)) return;
  visited.add(fstruct);
  for (const [k, fv] of eachPair(fstruct)) {
    let v = fv;
    while (isVariable(v) && bindings.has(v.name)) {
      v = bindings.get(v.name)!;
      setSlot(fstruct, k, v);
    }
    if (isFeatStruct(v)) _substitute(v, bindings, visited);
    else if (v instanceof FeatStructNonterminalLike) {
      setSlot(fstruct, k, v.substitute_bindings(bindings));
    } else if (isSeqValue(v) || v instanceof Expression) {
      setSlot(fstruct, k, substSeqElt(v, bindings));
    }
  }
}

/** nltk.featstruct.find_variables — accepts one structure or an iterable of them. */
export function find_variables(fstruct: FeatValue | Iterable<FeatValue>, _fsClass?: unknown): Variable[] {
  const out = new Map<string, Variable>();
  const items = isIterable(fstruct) ? fstruct : [fstruct as FeatValue];
  for (const item of items) _findVars(item, out, new Set());
  return [...out.values()];
}
export const findVariables = find_variables;

function isIterable(v: unknown): v is Iterable<FeatValue> {
  return typeof v === "object" && v !== null && !(v instanceof FeatDict) && !(v instanceof FeatList) &&
    !(v instanceof Variable) && !(v instanceof Expression) && Symbol.iterator in v;
}

function _findVars(v: FeatValue, out: Map<string, Variable>, visited: Set<object>): void {
  if (isVariable(v)) {
    out.set(v.name, v);
    return;
  }
  if (v instanceof FeatStructNonterminalLike) {
    for (const inner of v.variables()) out.set(inner.name, inner);
    return;
  }
  if (isSeqValue(v)) {
    for (const inner of v.variables()) out.set(inner.name, inner);
    return;
  }
  if (v instanceof Expression) {
    for (const inner of v.variables()) out.set(inner.name, new Variable(inner.name));
    return;
  }
  if (!isFeatStruct(v) || visited.has(v)) return;
  visited.add(v);
  for (const [, fv] of eachPair(v)) _findVars(fv, out, visited);
}

/** nltk.featstruct.rename_variables. */
export function rename_variables<T extends FeatDict | FeatList>(
  fstruct: T,
  options: { vars?: Iterable<Variable>; usedVars?: Iterable<Variable>; newVars?: Map<string, Variable> } = {},
): T {
  const newVars = options.newVars ?? new Map<string, Variable>();
  const vars = options.vars ? new Set([...options.vars].map((v) => v.name)) : new Set(find_variables(fstruct).map((v) => v.name));
  const used = new Map<string, Variable>();
  for (const v of find_variables(fstruct)) used.set(v.name, v);
  for (const v of options.usedVars ?? []) used.set(v.name, v);
  const copy = deepClone(fstruct, new Map());
  _rename(copy, vars, used, newVars, new Set());
  return copy;
}
export const renameVariables = rename_variables;

function _rename(fstruct: FeatDict | FeatList, vars: Set<string>, used: Map<string, Variable>, newVars: Map<string, Variable>, visited: Set<object>): void {
  if (visited.has(fstruct)) return;
  visited.add(fstruct);
  for (const [k, fv] of eachPair(fstruct)) {
    if (isVariable(fv)) {
      if (newVars.has(fv.name)) {
        setSlot(fstruct, k, newVars.get(fv.name)!);
      } else if (vars.has(fv.name)) {
        const nv = _renameVariable(fv, used);
        newVars.set(fv.name, nv);
        setSlot(fstruct, k, nv);
        used.set(nv.name, nv);
      }
    } else if (isFeatStruct(fv)) {
      _rename(fv, vars, used, newVars, visited);
    } else if (fv instanceof FeatStructNonterminalLike) {
      for (const v of fv.variables()) {
        if (vars.has(v.name) && !newVars.has(v.name)) {
          const nv = _renameVariable(v, used);
          newVars.set(v.name, nv);
          used.set(nv.name, nv);
        }
      }
      setSlot(fstruct, k, fv.substitute_bindings(new Map([...newVars].map(([k2, v2]) => [k2, v2 as FeatValue]))));
    } else if (isSeqValue(fv) || fv instanceof Expression) {
      const fvars = fv instanceof Expression
        ? [...fv.variables()].map((v) => new Variable(v.name))
        : fv.variables();
      for (const v of fvars) {
        if (vars.has(v.name) && !newVars.has(v.name)) {
          const nv = _renameVariable(v, used);
          newVars.set(v.name, nv);
          used.set(nv.name, nv);
        }
      }
      const nb = new Map<string, FeatValue>([...newVars].map(([k2, v2]) => [k2, v2 as FeatValue]));
      setSlot(fstruct, k, fv instanceof Expression ? fv.substituteBindings(exprBindings(nb)) : fv.substituteBindings(nb));
    }
  }
}

function _renameVariable(v: Variable, used: Map<string, Variable>): Variable {
  let name = v.name.replace(/\d+$/, "");
  if (!name) name = "?";
  let n = 2;
  while (used.has(`${name}${n}`)) n++;
  return new Variable(`${name}${n}`);
}

// ---- unification --------------------------------------------------------------

export interface UnifyOptions {
  bindings?: Bindings;
  renameVars?: boolean;
  fail?: (a: FeatValue, b: FeatValue, path: readonly (string | number)[]) => FeatValue | UnificationFailureType;
}

/** nltk.featstruct.unify — returns the unified structure, or null on failure. */
export function unify(
  fstruct1: FeatDict | FeatList,
  fstruct2: FeatDict | FeatList,
  bindings?: Bindings,
  options: { rename_vars?: boolean; fail?: UnifyOptions["fail"] } = {},
): FeatDict | FeatList | null {
  const renameVars = options.rename_vars ?? true;
  const userBindings = bindings !== undefined;
  const bnd: Bindings = bindings ?? new Map();
  const memo = new Map<object, FeatValue>();
  const f1 = deepClone(fstruct1, memo);
  const f2 = deepClone(fstruct2, memo);
  const bcopy = new Map<string, FeatValue>();
  for (const [k, v] of bnd) bcopy.set(k, deepClone(v, memo));
  for (const [k, v] of bcopy) bnd.set(k, v);

  if (renameVars) {
    const vars1 = new Map(find_variables(f1).map((v) => [v.name, v]));
    const vars2 = new Set(find_variables(f2).map((v) => v.name));
    // oracle: _rename_variables(fstruct2copy, vars=vars1, used_vars=vars2)
    // i.e., rename vars of fstruct2 that appear in fstruct1.
    _rename(f2, new Set(vars1.keys()), new Map([...vars2].map((n) => [n, new Variable(n)])), new Map(), new Set());
  }

  const forward = new Map<object, FeatDict | FeatList>();
  let result: FeatValue | UnificationFailureType;
  try {
    result = _unify(f1, f2, bnd, forward, options.fail, []);
  } catch (e) {
    if (e instanceof UnificationFailureError) return null;
    throw e;
  }
  if (result === UnificationFailure) {
    if (!options.fail) return null;
    const r = options.fail(f1, f2, []);
    if (r === UnificationFailure) return null;
    result = r;
  }
  result = _applyForwards(result as FeatDict | FeatList, forward, new Set());
  if (userBindings) _applyForwardsToBindings(forward, bnd);
  _resolveAliases(bnd);
  _substitute(result as FeatDict | FeatList, bnd, new Set());
  return result as FeatDict | FeatList;
}

function _unify(
  f1: FeatDict | FeatList,
  f2: FeatDict | FeatList,
  bindings: Bindings,
  forward: Map<object, FeatDict | FeatList>,
  fail: UnifyOptions["fail"],
  path: (string | number)[],
): FeatValue | UnificationFailureType {
  if (f1 === f2) return f1;
  forward.set(f2, f1);

  if (f1 instanceof FeatDict && f2 instanceof FeatDict) {
    for (const [k, v2] of [...f2.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (f1.has(k)) {
        f1.set(k, _unifyValue(k, f1.get(k)!, v2, bindings, forward, fail, [...path, k]) as FeatValue);
      } else {
        f1.set(k, v2);
      }
    }
    return f1;
  }
  if (f1 instanceof FeatList && f2 instanceof FeatList) {
    if (f1.length !== f2.length) return UnificationFailure;
    for (let i = 0; i < f1.length; i++) {
      f1.items[i] = _unifyValue(i, f1.items[i]!, f2.items[i]!, bindings, forward, fail, [...path, i]) as FeatValue;
    }
    return f1;
  }
  return UnificationFailure;
}

function _unifyValue(
  fname: string | number,
  a: FeatValue,
  b: FeatValue,
  bindings: Bindings,
  forward: Map<object, FeatDict | FeatList>,
  fail: UnifyOptions["fail"],
  path: (string | number)[],
): FeatValue | UnificationFailureType {
  let fval1 = a;
  let fval2 = b;
  while (isFeatStruct(fval1) && forward.has(fval1)) fval1 = forward.get(fval1)!;
  while (isFeatStruct(fval2) && forward.has(fval2)) fval2 = forward.get(fval2)!;

  let fvar1: Variable | null = null;
  let fvar2: Variable | null = null;
  while (isVariable(fval1) && bindings.has(fval1.name)) {
    fvar1 = fval1;
    fval1 = bindings.get(fval1.name)!;
  }
  while (isVariable(fval2) && bindings.has(fval2.name)) {
    fvar2 = fval2;
    fval2 = bindings.get(fval2.name)!;
  }

  let result: FeatValue | UnificationFailureType;
  if (isFeatStruct(fval1) && isFeatStruct(fval2)) {
    result = _unify(fval1, fval2, bindings, forward, fail, path);
  } else if (isVariable(fval1) && isVariable(fval2)) {
    if (fval1.name !== fval2.name) bindings.set(fval2.name, fval1);
    result = fval1;
  } else if (isVariable(fval1)) {
    bindings.set(fval1.name, fval2);
    result = fval1;
  } else if (isVariable(fval2)) {
    bindings.set(fval2.name, fval1);
    result = fval2;
  } else if (isFeatStruct(fval1) || isFeatStruct(fval2)) {
    result = UnificationFailure;
  } else {
    result = featValueEq(fval1, fval2) ? fval1 : UnificationFailure;
    if (result !== UnificationFailure) {
      if (fvar1) {
        bindings.set(fvar1.name, result as FeatValue);
        result = fvar1;
      }
      if (fvar2 && fvar2 !== fvar1) {
        bindings.set(fvar2.name, result as FeatValue);
        result = fvar2;
      }
    }
  }

  if (result === UnificationFailure) {
    if (fail) result = fail(fval1, fval2, path.slice(0, -1));
    if (result === UnificationFailure) throw new UnificationFailureError();
  }
  if (isFeatStruct(result)) result = _applyForwards(result, forward, new Set());
  return result;
}

function _applyForwards(fstruct: FeatDict | FeatList, forward: Map<object, FeatDict | FeatList>, visited: Set<object>): FeatDict | FeatList {
  while (forward.has(fstruct)) fstruct = forward.get(fstruct)!;
  if (visited.has(fstruct)) return fstruct;
  visited.add(fstruct);
  for (const [k, fv] of eachPair(fstruct)) {
    if (isFeatStruct(fv)) {
      let v = fv;
      while (forward.has(v)) v = forward.get(v)!;
      setSlot(fstruct, k, v);
      _applyForwards(v, forward, visited);
    }
  }
  return fstruct;
}

function _applyForwardsToBindings(forward: Map<object, FeatDict | FeatList>, bindings: Bindings): void {
  for (const [k, v] of bindings) {
    let value = v;
    while (isFeatStruct(value) && forward.has(value)) value = forward.get(value)!;
    bindings.set(k, value);
  }
}

function _resolveAliases(bindings: Bindings): void {
  for (const [k, v] of bindings) {
    let value = v;
    while (isVariable(value) && bindings.has(value.name)) {
      value = bindings.get(value.name)!;
      bindings.set(k, value);
    }
  }
}

// ---- repr / canonical keys ----------------------------------------------------

export function reprValue(v: FeatValue): string {
  if (v instanceof Variable) return v.name;
  if (v instanceof Expression) return `<${v.toString()}>`;
  if (isSeqValue(v)) return v.toString();
  if (v instanceof FeatDict) return reprFeatDict(v);
  if (v instanceof FeatList) return `(${v.items.map(reprValue).join(", ")})`;
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  return `'${v}'`;
}

function reprFeatEntry(k: string, v: FeatValue): string {
  if (v === true) return `+${k}`;
  if (v === false) return `-${k}`;
  return `${k}=${reprValue(v)}`;
}

export function reprFeatDict(d: FeatDict): string {
  const t = d.get(TYPE);
  const prefix = t !== undefined ? (t instanceof Variable ? t.name : String(t)) : "";
  const rest = [...d.entries()]
    .filter(([k]) => k !== TYPE && k !== SLASH)
    .sort(([a], [b]) => a.localeCompare(b));
  const slash = d.get(SLASH);
  const body = rest.map(([k, v]) => reprFeatEntry(k, v)).join(", ");
  return `${prefix}[${body}]${slash !== undefined ? `/${reprValue(slash)}` : ""}`;
}

// ---- FeatStructReader subset ----------------------------------------------------

export class FeatStructReader {
  private readonly _reent = new Map<string, FeatValue>();
  private readonly _logicParser: (s: string) => Expression;

  /** nltk FeatStructReader(..., logic_parser) — defaults to LogicParser(). */
  constructor(logicParser: ((s: string) => Expression) | null = null) {
    this._logicParser = logicParser ?? ((s) => Expression.fromstring(s));
  }

  /** read_partial: parse a symbol starting at `position`; returns [value, endPos]. */
  read_partial(s: string, position = 0): [FeatValue, number] {
    let pos = position;
    // Optional reentrance id "(n)".
    const reId = /^\s*\((\d+)\)\s*/.exec(s.slice(pos));
    let reentKey: string | null = null;
    if (reId) {
      reentKey = reId[1]!;
      if (this._reent.has(reentKey)) throw pyError("ValueError", `new identifier at ${pos}`);
      pos += reId[0].length;
    }
    // Optional prefix identifier (word or ?var).
    let prefix: string | Variable | null = null;
    const pm = /^\s*(\??[\w-]+)\s*/.exec(s.slice(pos));
    if (pm && s.slice(pos + pm[0].length).startsWith("[")) {
      prefix = pm[1]!.startsWith("?") ? new Variable(pm[1]!) : pm[1]!;
      pos += pm[0].length;
    } else if (pm && !s.slice(pos + pm[0].length).startsWith("[")) {
      // bare prefix without brackets
      prefix = pm[1]!.startsWith("?") ? new Variable(pm[1]!) : pm[1]!;
      pos += pm[0].length;
      if (prefix instanceof Variable) return [prefix, pos];
      const d = new FeatDict();
      d.set(TYPE, prefix);
      if (reentKey) this._reent.set(reentKey, d);
      return [d, pos];
    }
    if (s[pos] === "<" || s[pos] === "(" || s[pos] === "{") return this._readValue(s, pos);
    if (s[pos] !== "[") throw pyError("ValueError", `Expected open bracket or identifier at ${pos}`);
    pos++;
    // Dict vs list: lookahead for a top-level '=' or '->' before first ',' or ']'.
    const isDict = /^[^[\]'"(),=]*=/.test(s.slice(pos)) || /^\s*\]/.test(s.slice(pos)) || /^[^[\]'"(),]*->/.test(s.slice(pos)) || /^\s*[+-][^\s,\]]+/.test(s.slice(pos));
    const fstruct: FeatDict | FeatList = isDict ? new FeatDict() : new FeatList();
    if (reentKey) this._reent.set(reentKey, fstruct);
    if (fstruct instanceof FeatDict) {
      if (prefix !== null) fstruct.set(TYPE, prefix);
      pos = this._readDict(s, pos, fstruct);
      // optional trailing /slash value
      const sm = /^\s*\/\s*/.exec(s.slice(pos));
      if (sm) {
        pos += sm[0].length;
        const [v, np] = this._readValue(s, pos);
        fstruct.set(SLASH, v);
        pos = np;
      }
    } else {
      if (prefix !== null) throw pyError("ValueError", "open bracket (prefix not allowed on feature lists)");
      pos = this._readList(s, pos, fstruct);
    }
    return [fstruct, pos];
  }

  private _readDict(s: string, pos: number, out: FeatDict): number {
    for (;;) {
      if (/^\s*\]/.test(s.slice(pos))) return pos + s.slice(pos).indexOf("]") + 1;
      // feature -> (n) reentrance
      let m = /^\s*([^\s()<>"'=\-[\],/]+)\s*->\s*\((\d+)\)\s*/.exec(s.slice(pos));
      if (m) {
        const target = this._reent.get(m[2]!);
        if (target === undefined) throw pyError("ValueError", `bound identifier at ${pos}`);
        out.set(m[1]!, target);
        pos += m[0].length;
      } else if ((m = /^\s*\+([^\s,\]]+)\s*/.exec(s.slice(pos)))) {
        out.set(m[1]!, true);
        pos += m[0].length;
      } else if ((m = /^\s*-([^\s,\]]+)\s*/.exec(s.slice(pos)))) {
        out.set(m[1]!, false);
        pos += m[0].length;
      } else if ((m = /^\s*([^\s()<>"'=\-[\],/]+)\s*=\s*/.exec(s.slice(pos)))) {
        const name = m[1]!;
        pos += m[0].length;
        const [v, np] = this._readValue(s, pos);
        out.set(name, v);
        pos = np;
      } else {
        throw pyError("ValueError", `Expected feature name/value at ${pos}`);
      }
      const cm = /^\s*,\s*/.exec(s.slice(pos));
      if (cm) {
        pos += cm[0].length;
      }
    }
  }

  private _readList(s: string, pos: number, out: FeatList): number {
    for (;;) {
      if (/^\s*\]/.test(s.slice(pos))) return pos + s.slice(pos).indexOf("]") + 1;
      const rm = /^\s*->\s*\((\d+)\)\s*/.exec(s.slice(pos));
      if (rm) {
        const target = this._reent.get(rm[1]!);
        if (target === undefined) throw pyError("ValueError", `bound identifier at ${pos}`);
        out.items.push(target);
        pos += rm[0].length;
      } else {
        const [v, np] = this._readValue(s, pos);
        out.items.push(v);
        pos = np;
      }
      const cm = /^\s*,\s*/.exec(s.slice(pos));
      if (cm) pos += cm[0].length;
    }
  }

  private _readValue(s: string, pos: number): [FeatValue, number] {
    const rest = s.slice(pos);
    let m = /^\s*\((\d+)\)\s*/.exec(rest);
    if (m || rest.trimStart().startsWith("[") || /^\s*[\w?-]+\s*\[/.test(rest)) {
      return this.read_partial(s, pos);
    }
    if ((m = /^\s*\?[\w-]+/.exec(rest))) return [new Variable(m[0]!.trimStart()), pos + m[0].length];
    if ((m = /^\s*(None|True|False)(?![\w])/.exec(rest))) {
      const v = m[1] === "None" ? null : m[1] === "True";
      return [v, pos + m[0].length];
    }
    if ((m = /^\s*-?\d+/.exec(rest))) return [parseInt(m[0]!, 10), pos + m[0].length];
    if ((m = /^\s*->\s*\((\d+)\)\s*/.exec(rest))) {
      const target = this._reent.get(m[1]!);
      if (target === undefined) throw pyError("ValueError", `bound identifier at ${pos}`);
      return [target, pos + m[0].length];
    }
    if ((m = /^\s*<app\((\?[a-z][a-z]*)\s*,\s*(\?[a-z][a-z]*)\)>/.exec(rest))) {
      return [this._logicParser(`${m[1]!}(${m[2]!})`), pos + m[0].length];
    }
    if ((m = /^\s*<(.*?)(?<!-)>/.exec(rest))) {
      let expr: Expression;
      try {
        expr = this._logicParser(m[1]!);
      } catch (e) {
        throw pyError("ValueError", `logic expression at ${pos}: ${(e as Error).message}`);
      }
      return [expr, pos + m[0].length];
    }
    if ((m = /^\s*'([^']*)'/.exec(rest)) || (m = /^\s*"([^"]*)"/.exec(rest))) {
      return [m[1]!, pos + m[0].length];
    }
    if (rest.trimStart().startsWith("(")) return this._readSeqValue(s, pos, ")", "tuple");
    if (rest.trimStart().startsWith("{")) return this._readSeqValue(s, pos, "}", "set");
    if ((m = /^\s*[^\s,\])}]+/.exec(rest))) return [m[0]!.trim(), pos + m[0].length];
    throw pyError("ValueError", `Expected value at ${pos}`);
  }

  /** _read_seq_value: `(...)` tuples/concats and `{...}` sets/unions. */
  private _readSeqValue(s: string, pos: number, close: ")" | "}", kind: "tuple" | "set"): [FeatValue, number] {
    pos = pos + s.slice(pos).indexOf(kind === "tuple" ? "(" : "{") + 1;
    const cp = close === ")" ? "\\)" : "\\}";
    let m = new RegExp(`^\\s*/?\\s*${cp}`).exec(s.slice(pos));
    if (m) {
      return [kind === "tuple" ? new FeatureValueTuple() : new FeatureValueSet(), pos + m[0].length];
    }
    const values: FeatValue[] = [];
    let seenPlus = false;
    for (;;) {
      m = new RegExp(`^\\s*${cp}`).exec(s.slice(pos));
      if (m) {
        const end = pos + m[0].length;
        if (seenPlus) {
          return [kind === "tuple" ? FeatureValueConcat.create(values) : FeatureValueUnion.create(values), end];
        }
        return [kind === "tuple" ? new FeatureValueTuple(values) : new FeatureValueSet(values), end];
      }
      const [v, np] = this._readValue(s, pos);
      values.push(v);
      pos = np;
      m = new RegExp(`^\\s*(,|\\+|(?=${cp}))`).exec(s.slice(pos));
      if (!m) throw pyError("ValueError", `',' or '+' or '${close}' at ${pos}`);
      if (m[1] === "+") seenPlus = true;
      pos += m[0].length;
    }
  }

  /** fromstring — parse a complete feature-structure string. */
  read(s: string): [FeatValue, number] {
    const v = this.read_partial(s, 0);
    return v;
  }

  fromstring(s: string): FeatValue {
    const [v, pos] = this.read_partial(s.trim(), 0);
    if (pos !== s.trim().length) throw pyError("ValueError", "Expected end of string");
    return v;
  }
}

export const featstructReader = new FeatStructReader();

/**
 * Minimal FeatStructNonterminal-shaped value — a feature structure can carry a
 * nonterminal as a value (NLTK FeatStructNonterminal is a FeatDict+Nonterminal
 * mixin). Defined here so FeatValue can include it without a module cycle.
 */
export abstract class FeatStructNonterminalLike {
  abstract substitute_bindings(bindings: Bindings): FeatStructNonterminalLike;
  abstract rename_variables(usedVars?: Iterable<Variable>): FeatStructNonterminalLike;
  abstract variables(): Variable[];
  abstract toString(): string;
}

// Back-compat export used by older callers.
export function parseFeatStruct(s: string): FeatDict {
  return FeatStruct.fromstring(s);
}
