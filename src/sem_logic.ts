/*
 * Port of the core of nltk.sem.logic (first-order logic with lambda calculus)
 * plus the basics of nltk.sem.evaluate (Valuation / Model / Assignment).
 *
 * Skipped deliberately: DRSs, linear logic, type checking/inference, skolemization,
 * quoted tokens, and `?`/`@`-prefixed predicate variables.
 */

import { pyError } from "./internals";

export const APP = "APP";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export const Tokens = {
  LAMBDA: "\\",
  LAMBDA_LIST: ["\\"],
  EXISTS: "exists",
  EXISTS_LIST: ["some", "exists", "exist"],
  ALL: "all",
  ALL_LIST: ["all", "forall"],
  IOTA: "iota",
  IOTA_LIST: ["iota"],
  DOT: ".",
  OPEN: "(",
  CLOSE: ")",
  COMMA: ",",
  NOT: "-",
  NOT_LIST: ["not", "-", "!"],
  AND: "&",
  AND_LIST: ["and", "&", "^"],
  OR: "|",
  OR_LIST: ["or", "|"],
  IMP: "->",
  IMP_LIST: ["implies", "->", "=>"],
  IFF: "<->",
  IFF_LIST: ["iff", "<->", "<=>"],
  EQ: "=",
  EQ_LIST: ["=", "=="],
  NEQ: "!=",
  NEQ_LIST: ["!="],
};

const BINOPS = [
  ...Tokens.AND_LIST,
  ...Tokens.OR_LIST,
  ...Tokens.IMP_LIST,
  ...Tokens.IFF_LIST,
];
export const QUANTS = [...Tokens.EXISTS_LIST, ...Tokens.ALL_LIST, ...Tokens.IOTA_LIST];

export const TOKENS = [
  ...BINOPS,
  ...Tokens.EQ_LIST,
  ...Tokens.NEQ_LIST,
  ...QUANTS,
  ...Tokens.LAMBDA_LIST,
  [Tokens.DOT, Tokens.OPEN, Tokens.CLOSE, Tokens.COMMA],
  ...Tokens.NOT_LIST,
].flat();

const SYMBOLS = TOKENS.filter((t) => /^[-\\().,!&^|>=<]*$/.test(t));

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export class LogicalExpressionException extends Error {
  index: number | null;
  constructor(index: number | null, message: string) {
    super(message);
    this.name = "LogicalExpressionException";
    this.index = index;
  }
}

export class UnexpectedTokenException extends LogicalExpressionException {
  constructor(index: number | null, unexpected?: string, expected?: string, message?: string) {
    let msg: string;
    if (unexpected && expected) {
      msg = `Unexpected token: '${unexpected}'.  Expected token '${expected}'.`;
    } else if (unexpected) {
      msg = `Unexpected token: '${unexpected}'.`;
      if (message) msg += "  " + message;
    } else {
      msg = `Expected token '${expected}'.`;
    }
    super(index, msg);
    this.name = "UnexpectedTokenException";
  }
}

export class ExpectedMoreTokensException extends LogicalExpressionException {
  constructor(index: number | null, message?: string) {
    super(index, "End of input found.  " + (message ?? "More tokens expected."));
    this.name = "ExpectedMoreTokensException";
  }
}

export class UndefinedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Undefined";
  }
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

export class Variable {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  equals(other: Variable): boolean {
    return other instanceof Variable && this.name === other.name;
  }
  /** NLTK Variable.substitute_bindings: return bound value, or self. */
  substituteBindings(bindings: Map<string, Variable | Expression>): Variable | Expression {
    return bindings.get(this.name) ?? this;
  }
  toString(): string {
    return this.name;
  }
}

export function is_indvar(expr: string): boolean {
  return /^[a-df-z]\d*$/.test(expr);
}
export function is_funcvar(expr: string): boolean {
  return /^[A-Z]\d*$/.test(expr);
}
export function is_eventvar(expr: string): boolean {
  return /^e\d*$/.test(expr);
}

let _counter = 0;

/** Reset the unique-variable counter (mirrors nltk.internals.Counter state). */
export function resetUniqueVariableCounter(): void {
  _counter = 0;
}

/** Next value of the shared unique-variable counter (nltk.internals.Counter.get()). */
export function nextUniqueCounterValue(): number {
  return ++_counter;
}

export function uniqueVariable(pattern?: Variable, ignore?: Set<string>): Variable {
  let prefix = "z";
  if (pattern !== undefined) {
    if (is_indvar(pattern.name)) {
      prefix = "z";
    } else if (is_funcvar(pattern.name)) {
      prefix = "F";
    } else if (is_eventvar(pattern.name)) {
      prefix = "e0";
    } else {
      throw new Error("Cannot generate a unique constant");
    }
  }
  let v = new Variable(`${prefix}${++_counter}`);
  while (ignore !== undefined && ignore.has(v.name)) {
    v = new Variable(`${prefix}${++_counter}`);
  }
  return v;
}

export const unique_variable = uniqueVariable;

// ---------------------------------------------------------------------------
// Types (nltk.sem.logic type hierarchy)
// ---------------------------------------------------------------------------

export class Type {
  static fromstring(s: string): Type {
    return read_type(s);
  }
  equals(other: unknown): boolean {
    return this === other;
  }
  matches(_other: Type): boolean {
    throw new Error("NotImplementedError");
  }
  resolve(_other: Type): Type | null {
    throw new Error("NotImplementedError");
  }
  toString(): string {
    return "Type";
  }
  /** NLTK Type.str() — verbose form distinct from __str__. */
  str(): string {
    return this.toString();
  }
}

export class ComplexType extends Type {
  first: Type;
  second: Type;
  constructor(first: Type, second: Type) {
    super();
    if (!(first instanceof Type)) throw new Error(`${first} is not a Type`);
    if (!(second instanceof Type)) throw new Error(`${second} is not a Type`);
    this.first = first;
    this.second = second;
  }
  override equals(other: unknown): boolean {
    return (
      other instanceof ComplexType &&
      this.first.equals(other.first) &&
      this.second.equals(other.second)
    );
  }
  override matches(other: Type): boolean {
    if (other instanceof ComplexType) {
      return this.first.matches(other.first) && this.second.matches(other.second);
    }
    return this.equals(ANY_TYPE);
  }
  override resolve(other: Type): Type | null {
    if (other instanceof AnyType) {
      return this;
    } else if (other instanceof ComplexType) {
      const f = this.first.resolve(other.first);
      const s = this.second.resolve(other.second);
      if (f && s) return new ComplexType(f, s);
      return null;
    } else if (this.equals(ANY_TYPE)) {
      return other;
    }
    return null;
  }
  override toString(): string {
    if (this.equals(ANY_TYPE)) return `${ANY_TYPE}`;
    return `<${this.first},${this.second}>`;
  }
  override str(): string {
    if (this.equals(ANY_TYPE)) return ANY_TYPE.str();
    return `(${this.first.str()} -> ${this.second.str()})`;
  }
}

export class BasicType extends Type {
  override equals(other: unknown): boolean {
    return other instanceof BasicType && `${this}` === `${other}`;
  }
  override matches(other: Type): boolean {
    return other instanceof AnyType || this.equals(other);
  }
  override resolve(other: Type): Type | null {
    return this.matches(other) ? this : null;
  }
}

export class EntityType extends BasicType {
  override toString(): string {
    return "e";
  }
  override str(): string {
    return "IND";
  }
}

export class TruthValueType extends BasicType {
  override toString(): string {
    return "t";
  }
  override str(): string {
    return "BOOL";
  }
}

export class EventType extends BasicType {
  override toString(): string {
    return "v";
  }
  override str(): string {
    return "EVENT";
  }
}

/** NLTK AnyType(BasicType, ComplexType) — TS single-inherits ComplexType; the
 * BasicType-side behaviors are special-cased via AnyType instanceof checks. */
export class AnyType extends ComplexType {
  constructor() {
    super(new Type(), new Type());
    this.first = this;
    this.second = this;
  }
  override equals(other: unknown): boolean {
    return other instanceof AnyType || (other instanceof Type && other.equals(this));
  }
  override matches(_other: Type): boolean {
    return true;
  }
  override resolve(other: Type): Type | null {
    return other;
  }
  override toString(): string {
    return "?";
  }
  override str(): string {
    return "ANY";
  }
}

export const TRUTH_TYPE = new TruthValueType();
export const ENTITY_TYPE = new EntityType();
export const EVENT_TYPE = new EventType();
export const ANY_TYPE = new AnyType();

/** Port of nltk.sem.logic.read_type. Note: 'v' is NOT accepted by NLTK (only
 * e, t, ?, and <first,second> forms) — divergence preserved. */
export function read_type(typeString: string): Type {
  const s = typeString.replace(/ /g, "");
  if (s.length === 0) throw pyError("IndexError", "string index out of range");
  if (s[0] === "<") {
    if (s[s.length - 1] !== ">") throw pyError("AssertionError", "");
    let parenCount = 0;
    let i = 0;
    for (; i < s.length; i++) {
      const char = s[i]!;
      if (char === "<") {
        parenCount += 1;
      } else if (char === ">") {
        parenCount -= 1;
        if (parenCount <= 0) throw pyError("AssertionError", "");
      } else if (char === ",") {
        if (parenCount === 1) break;
      }
    }
    return new ComplexType(read_type(s.slice(1, i)), read_type(s.slice(i + 1, -1)));
  } else if (s[0] === `${ENTITY_TYPE}`) {
    return ENTITY_TYPE;
  } else if (s[0] === `${TRUTH_TYPE}`) {
    return TRUTH_TYPE;
  } else if (s[0] === `${ANY_TYPE}`) {
    return ANY_TYPE;
  }
  throw new LogicalExpressionException(null, `Unexpected character: '${s[0]}'.`);
}
export const readType = read_type;

export class TypeException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypeException";
  }
}

export class InconsistentTypeHierarchyException extends TypeException {
  constructor(variable: Expression, expression?: Expression) {
    super(
      expression
        ? `The variable '${variable}' was found in multiple places with different types in '${expression}'.`
        : `The variable '${variable}' was found in multiple places with different types.`,
    );
    this.name = "InconsistentTypeHierarchyException";
  }
}

export class TypeResolutionException extends TypeException {
  constructor(expression: Expression, otherType: Type) {
    super(
      `The type of '${expression}', '${expression.type}', cannot be resolved with type '${otherType}'`,
    );
    this.name = "TypeResolutionException";
  }
}

export class IllegalTypeException extends TypeException {
  constructor(expression: Expression, otherType: Type, allowedType: Type) {
    super(
      `Cannot set type of ${expression.constructor.name} '${expression}' to '${otherType}'; must match type '${allowedType}'.`,
    );
    this.name = "IllegalTypeException";
  }
}

/** A signature maps variable names to type-annotated variable expressions. */
type TypeSignature = Map<string, AbstractVariableExpression[]>;

function sigPush(sig: TypeSignature, name: string, expr: AbstractVariableExpression): void {
  let list = sig.get(name);
  if (!list) {
    list = [];
    sig.set(name, list);
  }
  list.push(expr);
}

/**
 * Port of nltk.sem.logic.typecheck: infer and check types across a collection
 * of Expression objects. Returns the (augmented) signature.
 */
export function typecheck(
  expressions: Expression[],
  signature?: Record<string, Type | string>,
): Record<string, Type> {
  let sig: Record<string, Type> | undefined;
  if (signature) {
    for (const key of Object.keys(signature)) {
      const val = signature[key]!;
      (sig ??= {})[key] = val instanceof Type ? val : read_type(val);
    }
  }
  for (const expression of expressions) {
    sig = expression.typecheck(sig);
  }
  for (const expression of expressions.slice(0, -1)) {
    expression.typecheck(sig);
  }
  return sig ?? {};
}

// ---------------------------------------------------------------------------
// Expression hierarchy
// ---------------------------------------------------------------------------

function unionVars(a: Set<Variable>, b: Set<Variable>): Set<Variable> {
  const out = new Set<Variable>(a);
  for (const v of b) out.add(v);
  return out;
}

function setHasVar(set: Set<Variable>, v: Variable): boolean {
  for (const x of set) if (x.equals(v)) return true;
  return false;
}

export abstract class Expression {
  /** NLTK raises AttributeError when `.type` is read before typechecking or on
   * expressions that carry no stored type; subclasses override as needed. */
  get type(): Type {
    throw new Error(`AttributeError: '${this.constructor.name}' object has no attribute 'type'`);
  }
  set type(_value: Type) {
    throw new Error("AttributeError: can't set attribute");
  }
  abstract str(): string;
  toString(): string {
    return this.str();
  }
  /** NLTK __repr__: ``<ClassName str>``. */
  repr(): string {
    return `<${this.constructor.name} ${this.str()}>`;
  }
  abstract equals(other: Expression): boolean;
  /** Free (non-bound) variables; includes individual and function variables, not constants. */
  abstract free(): Set<Variable>;
  abstract simplify(): Expression;
  abstract replace(
    variable: Variable,
    expression: Expression,
    replaceBound?: boolean,
    alphaConvert?: boolean,
  ): Expression;

  static fromstring(
    s: string,
    typeCheck = false,
    signature?: Record<string, Type | string>,
  ): Expression {
    return new LogicParser(typeCheck).parse(s, signature);
  }

  /** All free variables plus ?/@-prefixed predicates and constants (NLTK quirk). */
  variables(): Set<Variable> {
    const out = new Set<Variable>(this.free());
    for (const p of unionVars(this.predicates(), this.constants())) {
      if (/^[?@]/.test(p.name)) out.add(p);
    }
    return out;
  }

  constants(): Set<Variable> {
    return new Set();
  }

  predicates(): Set<Variable> {
    return new Set();
  }

  normalize(): Expression {
    const indivVars = new Map<string, IndividualVariableExpression>();
    collectIndivVars(this, indivVars);
    const names = Array.from(indivVars.keys()).sort();
    return names.reduce<Expression>((result, name, i) => {
      const e = indivVars.get(name)!;
      const newVar =
        e instanceof EventVariableExpression
          ? new Variable(`e0${i + 1}`)
          : new Variable(`z${i + 1}`);
      return result.replace(e.variable, makeVariableExpression(newVar.name), true);
    }, this);
  }

  substituteBindings(bindings: Map<string, Variable | Expression>): Expression {
    const expr = Array.from(this.variables()).reduce<Expression>((acc, v) => {
      if (!bindings.has(v.name)) return acc;
      let val = bindings.get(v.name)!;
      if (val instanceof Variable) {
        val = this.make_VariableExpression(val);
      } else if (!(val instanceof Expression)) {
        throw pyError(
          "ValueError",
          `Can not substitute a non-expression value into an expression: ${val}`,
        );
      }
      val = val.substituteBindings(bindings);
      return acc.replace(v, val);
    }, this);
    return expr.simplify();
  }

  applyto(other: Expression): ApplicationExpression {
    if (!(other instanceof Expression)) {
      throw pyError("AssertionError", `${other} is not an Expression`);
    }
    return new ApplicationExpression(this, other);
  }

  /** Logical equivalence via a theorem prover. Without an explicit prover,
   * delegates to Prover9 — unavailable without the external binary. */
  equiv(other: Expression, prover?: { prove(e: Expression): boolean }): boolean {
    if (!(other instanceof Expression)) {
      throw pyError("AssertionError", `${other} is not an Expression`);
    }
    if (prover === undefined) {
      throw new Error("equiv requires a Prover9 binary — not available in JS");
    }
    const bicond = new IffExpression(this.simplify(), other.simplify());
    return prover.prove(bicond);
  }

  negate(): Expression {
    return new NegatedExpression(this);
  }

  make_VariableExpression(variable: Variable): AbstractVariableExpression {
    return VariableExpression(variable);
  }

  /**
   * Port of Expression.typecheck: infer/check types, returning the signature
   * plus any additional type mappings.
   */
  typecheck(signature?: Record<string, Type | string>): Record<string, Type> {
    const sig: TypeSignature = new Map();
    if (signature) {
      for (const key of Object.keys(signature)) {
        const varEx = VariableExpression(new Variable(key));
        const val = signature[key]!;
        varEx.type = val instanceof Type ? val : read_type(val);
        sigPush(sig, key, varEx);
      }
    }
    this.setType(ANY_TYPE, sig);
    const out: Record<string, Type> = {};
    for (const [key, list] of sig) out[key] = list[0]!.type;
    return out;
  }

  /** Find the type of `variable` as used in this expression. */
  findtype(variable: Variable): Type {
    void variable;
    throw pyError("NotImplementedError", "");
  }

  /**
   * Set the type of this expression to `otherType`, recording variable
   * expressions in `signature` (NLTK _set_type).
   */
  setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    void otherType;
    void signature;
    throw pyError("NotImplementedError", "");
  }

  /** Recursively visit subexpressions; combinator aggregates the results. */
  visit<T, R>(fn: (e: Expression) => T, combinator: (parts: T[]) => R): R {
    void fn;
    void combinator;
    throw pyError("NotImplementedError", "");
  }

  /** Like visit, but the combinator takes the node's own constructor args. */
  visitStructured<T>(fn: (e: Expression) => T, combinator: (...parts: unknown[]) => Expression): Expression {
    return this.visit(fn, (parts) => combinator(...parts));
  }
}

function collectIndivVars(
  e: Expression,
  acc: Map<string, IndividualVariableExpression>,
): void {
  if (e instanceof IndividualVariableExpression) {
    acc.set(e.variable.name, e);
  } else if (e instanceof AbstractVariableExpression) {
    // constants / function variables contribute nothing
  } else if (e instanceof ApplicationExpression) {
    collectIndivVars(e.function, acc);
    collectIndivVars(e.argument, acc);
  } else if (e instanceof VariableBinderExpression) {
    collectIndivVars(e.term, acc);
  } else if (e instanceof NegatedExpression) {
    collectIndivVars(e.term, acc);
  } else if (e instanceof BinaryExpression) {
    collectIndivVars(e.first, acc);
    collectIndivVars(e.second, acc);
  }
}

// -- AbstractVariableExpression family --------------------------------------

export class AbstractVariableExpression extends Expression {
  protected _type: Type | undefined;
  override get type(): Type {
    return this._type as Type;
  }
  override set type(value: Type) {
    this._type = value;
  }
  variable: Variable;
  constructor(variable: Variable) {
    super();
    this.variable = variable;
  }
  simplify(): Expression {
    return this;
  }
  replace(
    variable: Variable,
    expression: Expression,
    _replaceBound = false,
    _alphaConvert = true,
  ): Expression {
    return this.variable.equals(variable) ? expression : this;
  }
  free(): Set<Variable> {
    return new Set();
  }
  override predicates(): Set<Variable> {
    return new Set();
  }
  equals(other: Expression): boolean {
    return (
      other instanceof AbstractVariableExpression && this.variable.equals(other.variable)
    );
  }
  /** NLTK _set_type: resolve `otherType` against every recorded use of this
   * variable name, then apply the result to all of them. */
  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    let resolution: Type = otherType;
    for (const varEx of sig.get(this.variable.name) ?? []) {
      const r = varEx.type.resolve(resolution);
      if (!r) throw new InconsistentTypeHierarchyException(this);
      resolution = r;
    }
    sigPush(sig, this.variable.name, this);
    for (const varEx of sig.get(this.variable.name)!) {
      varEx.type = resolution;
    }
  }
  override findtype(variable: Variable): Type {
    return this.variable.equals(variable) ? this.type : ANY_TYPE;
  }
  str(): string {
    return this.variable.name;
  }
}

export class IndividualVariableExpression extends AbstractVariableExpression {
  /** NLTK exposes `type` as a property: reading yields ENTITY_TYPE, assigning
   * runs _set_type (the entity-type check). */
  override get type(): Type {
    return ENTITY_TYPE;
  }
  override set type(otherType: Type) {
    this.setType(otherType);
  }
  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    if (!otherType.matches(ENTITY_TYPE)) {
      throw new IllegalTypeException(this, otherType, ENTITY_TYPE);
    }
    sigPush(sig, this.variable.name, this);
  }
  override free(): Set<Variable> {
    return new Set([this.variable]);
  }
}

export class FunctionVariableExpression extends AbstractVariableExpression {
  protected override _type: Type | undefined = ANY_TYPE;
  override free(): Set<Variable> {
    return new Set([this.variable]);
  }
}

export class EventVariableExpression extends IndividualVariableExpression {
  protected override _type: Type | undefined = EVENT_TYPE;
  /** NLTK stores type as a plain class attribute on EventVariableExpression —
   * reads/writes bypass the individual-variable property. */
  override get type(): Type {
    return this._type as Type;
  }
  override set type(value: Type) {
    this._type = value;
  }
}

export class ConstantExpression extends AbstractVariableExpression {
  protected override _type: Type | undefined = ENTITY_TYPE;
  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    let resolution: Type | null;
    if (otherType instanceof AnyType) {
      // entity type by default, for individuals
      resolution = ENTITY_TYPE;
    } else {
      resolution = otherType;
      if (!this.type.equals(ENTITY_TYPE)) {
        // NLTK lets this resolve to None; the inconsistency only surfaces if
        // the variable name already has recorded uses.
        resolution = resolution.resolve(this.type);
      }
    }
    for (const varEx of sig.get(this.variable.name) ?? []) {
      resolution = varEx.type.resolve(resolution as Type);
      if (!resolution) throw new InconsistentTypeHierarchyException(this);
    }
    sigPush(sig, this.variable.name, this);
    for (const varEx of sig.get(this.variable.name)!) {
      varEx.type = resolution as Type;
    }
  }
  override constants(): Set<Variable> {
    return new Set([this.variable]);
  }
}

/** Port of nltk.sem.logic.VariableExpression() — factory dispatching on the
 * variable's lexical class. */
export function VariableExpression(variable: Variable): AbstractVariableExpression {
  if (is_indvar(variable.name)) return new IndividualVariableExpression(variable);
  if (is_funcvar(variable.name)) return new FunctionVariableExpression(variable);
  if (is_eventvar(variable.name)) return new EventVariableExpression(variable);
  return new ConstantExpression(variable);
}

/** Name-based convenience wrapper around VariableExpression(). */
export function makeVariableExpression(name: string): AbstractVariableExpression {
  return VariableExpression(new Variable(name));
}

// -- Application ------------------------------------------------------------

/** Upper bound on subexpressions a single beta-reduction may produce
 * (nltk.sem.logic.MAX_SIMPLIFY_SIZE, CWE-400). */
export const MAX_SIMPLIFY_SIZE = 10_000;

function exceedsSize(expression: Expression, limit: number): boolean {
  let count = 0;
  const stack = [expression];
  while (stack.length) {
    const node = stack.pop()!;
    count += 1;
    if (count > limit) return true;
    if (!(node instanceof AbstractVariableExpression)) {
      node.visit((e) => {
        stack.push(e);
      }, () => undefined);
    }
  }
  return false;
}

export class ApplicationExpression extends Expression {
  function: Expression;
  argument: Expression;
  constructor(func: Expression, argument: Expression) {
    super();
    this.function = func;
    this.argument = argument;
  }

  /** NLTK property: the result type is the second half of the function's
   * complex type, or ANY_TYPE when the function type is not complex. */
  override get type(): Type {
    return this.function.type instanceof ComplexType
      ? this.function.type.second
      : ANY_TYPE;
  }

  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    this.argument.setType(ANY_TYPE, sig);
    try {
      this.function.setType(new ComplexType(this.argument.type, otherType), sig);
    } catch (e) {
      if (e instanceof TypeResolutionException) {
        throw new TypeException(
          `The function '${this.function}' is of type '${this.function.type}' and cannot be applied ` +
            `to '${this.argument}' of type '${this.argument.type}'.  Its argument must match type '${(this.function.type as ComplexType).first}'.`,
        );
      }
      throw e;
    }
  }

  override findtype(variable: Variable): Type {
    let function_: Expression;
    let args: Expression[];
    if (this.isAtom()) {
      [function_, args] = this.uncurry();
    } else {
      // It's not a predicate expression ("P(x,y)"), so leave args curried
      function_ = this.function;
      args = [this.argument];
    }
    const found = [function_, ...args].map((a) => a.findtype(variable));
    // NLTK quirk: `unique` only ever receives the first non-ANY type — the
    // inner matches() loop has no else, so the list can never grow past one.
    const unique: Type[] = [];
    for (const f of found) {
      if (!f.equals(ANY_TYPE)) {
        if (unique.length) {
          for (const u of unique) {
            if (f.matches(u)) break;
          }
        } else {
          unique.push(f);
        }
      }
    }
    return unique.length === 1 ? unique[0]! : ANY_TYPE;
  }

  override visit<T, R>(fn: (e: Expression) => T, combinator: (parts: T[]) => R): R {
    return combinator([fn(this.function), fn(this.argument)]);
  }

  simplify(): Expression {
    const fn = this.function.simplify();
    const arg = this.argument.simplify();
    if (fn instanceof LambdaExpression) {
      const result = fn.term.replace(fn.variable, arg);
      if (exceedsSize(result, MAX_SIMPLIFY_SIZE)) {
        throw new Error(
          `The following expression has more than ${MAX_SIMPLIFY_SIZE} subexpressions; the expression may ` +
            `cause exponential blow-up (CWE-400). Raise ` +
            `nltk.sem.logic.MAX_SIMPLIFY_SIZE to allow it.`,
        );
      }
      return result.simplify();
    }
    return new ApplicationExpression(fn, arg);
  }

  replace(
    variable: Variable,
    expression: Expression,
    replaceBound = false,
    alphaConvert = true,
  ): Expression {
    return new ApplicationExpression(
      this.function.replace(variable, expression, replaceBound, alphaConvert),
      this.argument.replace(variable, expression, replaceBound, alphaConvert),
    );
  }

  free(): Set<Variable> {
    return unionVars(this.function.free(), this.argument.free());
  }

  override constants(): Set<Variable> {
    const functionConstants =
      this.function instanceof AbstractVariableExpression
        ? new Set<Variable>()
        : this.function.constants();
    return unionVars(functionConstants, this.argument.constants());
  }

  override predicates(): Set<Variable> {
    const functionPreds =
      this.function instanceof ConstantExpression
        ? new Set([this.function.variable])
        : this.function.predicates();
    return unionVars(functionPreds, this.argument.predicates());
  }

  equals(other: Expression): boolean {
    return (
      other instanceof ApplicationExpression &&
      this.function.equals(other.function) &&
      this.argument.equals(other.argument)
    );
  }

  /** Uncurry: returns [base-function, arg-list]. */
  uncurry(): [Expression, Expression[]] {
    let func = this.function;
    const args = [this.argument];
    while (func instanceof ApplicationExpression) {
      args.unshift(func.argument);
      func = func.function;
    }
    return [func, args];
  }

  isAtom(): boolean {
    return this.uncurry()[0] instanceof AbstractVariableExpression;
  }

  str(): string {
    let fn: Expression;
    let argStr: string;
    if (this.isAtom()) {
      const [f, args] = this.uncurry();
      fn = f;
      argStr = args.map((a) => a.str()).join(",");
    } else {
      fn = this.function;
      argStr = this.argument.str();
    }
    let functionStr = fn.str();
    let parenthesizeFunction = false;
    if (fn instanceof LambdaExpression) {
      if (fn.term instanceof ApplicationExpression) {
        if (!(fn.term.function instanceof AbstractVariableExpression)) {
          parenthesizeFunction = true;
        }
      } else if (!(fn.term instanceof BooleanExpression)) {
        parenthesizeFunction = true;
      }
    } else if (fn instanceof ApplicationExpression) {
      parenthesizeFunction = true;
    }
    if (parenthesizeFunction) {
      functionStr = Tokens.OPEN + functionStr + Tokens.CLOSE;
    }
    return functionStr + Tokens.OPEN + argStr + Tokens.CLOSE;
  }
}

// -- Variable binder expressions --------------------------------------------

export abstract class VariableBinderExpression extends Expression {
  variable: Variable;
  term: Expression;
  constructor(variable: Variable, term: Expression) {
    super();
    this.variable = variable;
    this.term = term;
  }

  protected abstract rebuild(variable: Variable, term: Expression): VariableBinderExpression;

  alphaConvert(newvar: Variable): VariableBinderExpression {
    return this.rebuild(
      newvar,
      this.term.replace(this.variable, makeVariableExpression(newvar.name), true),
    );
  }

  replace(
    variable: Variable,
    expression: Expression,
    replaceBound = false,
    alphaConvert = true,
  ): Expression {
    if (this.variable.equals(variable)) {
      if (replaceBound) {
        if (!(expression instanceof AbstractVariableExpression)) {
          throw new Error(`${expression.str()} is not a AbstractVariableExpression`);
        }
        return this.rebuild(
          expression.variable,
          this.term.replace(variable, expression, true, alphaConvert),
        );
      }
      return this;
    }
    const self = alphaConvert && setHasVar(expression.free(), this.variable)
      ? this.alphaConvert(uniqueVariable(this.variable))
      : this;
    return self.rebuild(
      self.variable,
      self.term.replace(variable, expression, replaceBound, alphaConvert),
    );
  }

  free(): Set<Variable> {
    const out = this.term.free();
    for (const v of out) if (v.equals(this.variable)) out.delete(v);
    return out;
  }

  override findtype(variable: Variable): Type {
    if (variable.equals(this.variable)) return ANY_TYPE;
    return this.term.findtype(variable);
  }

  override visit<T, R>(fn: (e: Expression) => T, combinator: (parts: T[]) => R): R {
    return combinator([fn(this.term)]);
  }

  override visitStructured<T>(
    fn: (e: Expression) => T,
    combinator: (...parts: unknown[]) => Expression,
  ): Expression {
    return combinator(this.variable, fn(this.term));
  }

  equals(other: Expression): boolean {
    if (!(other instanceof VariableBinderExpression)) return false;
    if (this.constructor !== other.constructor) return false;
    if (this.variable.equals(other.variable)) {
      return this.term.equals(other.term);
    }
    const varex = makeVariableExpression(this.variable.name);
    return this.term.equals(other.term.replace(other.variable, varex));
  }
}

export class LambdaExpression extends VariableBinderExpression {
  /** NLTK property: <type-of-variable, type-of-term>. */
  override get type(): Type {
    return new ComplexType(this.term.findtype(this.variable), this.term.type);
  }
  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    this.term.setType((otherType as ComplexType).second, sig);
    if (!this.type.resolve(otherType)) {
      throw new TypeResolutionException(this, otherType);
    }
  }
  protected rebuild(variable: Variable, term: Expression): VariableBinderExpression {
    return new LambdaExpression(variable, term);
  }
  simplify(): Expression {
    return new LambdaExpression(this.variable, this.term.simplify());
  }
  str(): string {
    const variables = [this.variable];
    let term: Expression = this.term;
    while (term instanceof LambdaExpression) {
      variables.push(term.variable);
      term = term.term;
    }
    return Tokens.LAMBDA + variables.map((v) => v.name).join(" ") + Tokens.DOT + term.str();
  }
}

export abstract class QuantifiedExpression extends VariableBinderExpression {
  /** NLTK property: quantified expressions are truth-valued. */
  override get type(): Type {
    return TRUTH_TYPE;
  }
  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    if (!otherType.matches(TRUTH_TYPE)) {
      throw new IllegalTypeException(this, otherType, TRUTH_TYPE);
    }
    this.term.setType(TRUTH_TYPE, sig);
  }
  abstract getQuantifier(): string;
  str(): string {
    const variables = [this.variable];
    let term: Expression = this.term;
    while (term instanceof QuantifiedExpression && term.getQuantifier() === this.getQuantifier()) {
      variables.push(term.variable);
      term = term.term;
    }
    return (
      this.getQuantifier() + " " + variables.map((v) => v.name).join(" ") + Tokens.DOT + term.str()
    );
  }
}

// NLTK collapses only same-class binders in __str__ (term.__class__ == self.__class__);
// each concrete quantifier class maps to exactly one quantifier word, so the
// getQuantifier() comparison above is equivalent.

export class ExistsExpression extends QuantifiedExpression {
  getQuantifier(): string {
    return Tokens.EXISTS;
  }
  protected rebuild(variable: Variable, term: Expression): VariableBinderExpression {
    return new ExistsExpression(variable, term);
  }
  simplify(): Expression {
    return new ExistsExpression(this.variable, this.term.simplify());
  }
}

export class AllExpression extends QuantifiedExpression {
  getQuantifier(): string {
    return Tokens.ALL;
  }
  protected rebuild(variable: Variable, term: Expression): VariableBinderExpression {
    return new AllExpression(variable, term);
  }
  simplify(): Expression {
    return new AllExpression(this.variable, this.term.simplify());
  }
}

export class IotaExpression extends QuantifiedExpression {
  getQuantifier(): string {
    return Tokens.IOTA;
  }
  protected rebuild(variable: Variable, term: Expression): VariableBinderExpression {
    return new IotaExpression(variable, term);
  }
  simplify(): Expression {
    return new IotaExpression(this.variable, this.term.simplify());
  }
}

// -- Negation ----------------------------------------------------------------

export class NegatedExpression extends Expression {
  term: Expression;
  constructor(term: Expression) {
    super();
    this.term = term;
  }
  /** NLTK property: negations are truth-valued. */
  override get type(): Type {
    return TRUTH_TYPE;
  }
  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    if (!otherType.matches(TRUTH_TYPE)) {
      throw new IllegalTypeException(this, otherType, TRUTH_TYPE);
    }
    this.term.setType(TRUTH_TYPE, sig);
  }
  override findtype(variable: Variable): Type {
    return this.term.findtype(variable);
  }
  override visit<T, R>(fn: (e: Expression) => T, combinator: (parts: T[]) => R): R {
    return combinator([fn(this.term)]);
  }
  simplify(): Expression {
    return new NegatedExpression(this.term.simplify());
  }
  replace(
    variable: Variable,
    expression: Expression,
    replaceBound = false,
    alphaConvert = true,
  ): Expression {
    return new NegatedExpression(
      this.term.replace(variable, expression, replaceBound, alphaConvert),
    );
  }
  free(): Set<Variable> {
    return new Set(this.term.free());
  }
  override negate(): Expression {
    return this.term;
  }
  equals(other: Expression): boolean {
    return other instanceof NegatedExpression && this.term.equals(other.term);
  }
  str(): string {
    return Tokens.NOT + this.term.str();
  }
}

// -- Binary expressions -------------------------------------------------------

export abstract class BinaryExpression extends Expression {
  first: Expression;
  second: Expression;
  constructor(first: Expression, second: Expression) {
    super();
    this.first = first;
    this.second = second;
  }
  /** NLTK property: binary connectives are truth-valued. */
  override get type(): Type {
    return TRUTH_TYPE;
  }
  override findtype(variable: Variable): Type {
    const f = this.first.findtype(variable);
    const s = this.second.findtype(variable);
    if (f.equals(s) || s.equals(ANY_TYPE)) return f;
    if (f.equals(ANY_TYPE)) return s;
    return ANY_TYPE;
  }
  override visit<T, R>(fn: (e: Expression) => T, combinator: (parts: T[]) => R): R {
    return combinator([fn(this.first), fn(this.second)]);
  }
  abstract getOp(): string;
  protected subexStr(subex: Expression): string {
    return subex.str();
  }
  simplify(): Expression {
    const cls = this.constructor as new (f: Expression, s: Expression) => BinaryExpression;
    return new cls(this.first.simplify(), this.second.simplify());
  }
  replace(
    variable: Variable,
    expression: Expression,
    replaceBound = false,
    alphaConvert = true,
  ): Expression {
    const cls = this.constructor as new (f: Expression, s: Expression) => BinaryExpression;
    return new cls(
      this.first.replace(variable, expression, replaceBound, alphaConvert),
      this.second.replace(variable, expression, replaceBound, alphaConvert),
    );
  }
  free(): Set<Variable> {
    return unionVars(this.first.free(), this.second.free());
  }
  override constants(): Set<Variable> {
    return unionVars(this.first.constants(), this.second.constants());
  }
  override predicates(): Set<Variable> {
    return unionVars(this.first.predicates(), this.second.predicates());
  }
  equals(other: Expression): boolean {
    return (
      other instanceof BinaryExpression &&
      this.constructor === other.constructor &&
      this.first.equals(other.first) &&
      this.second.equals(other.second)
    );
  }
  str(): string {
    const first = this.subexStr(this.first);
    const second = this.subexStr(this.second);
    return Tokens.OPEN + first + " " + this.getOp() + " " + second + Tokens.CLOSE;
  }
}

export abstract class BooleanExpression extends BinaryExpression {
  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    if (!otherType.matches(TRUTH_TYPE)) {
      throw new IllegalTypeException(this, otherType, TRUTH_TYPE);
    }
    this.first.setType(TRUTH_TYPE, sig);
    this.second.setType(TRUTH_TYPE, sig);
  }
}

export class AndExpression extends BooleanExpression {
  getOp(): string {
    return Tokens.AND;
  }
  protected override subexStr(subex: Expression): string {
    const s = subex.str();
    return subex instanceof AndExpression ? s.slice(1, -1) : s;
  }
}

export class OrExpression extends BooleanExpression {
  getOp(): string {
    return Tokens.OR;
  }
  protected override subexStr(subex: Expression): string {
    const s = subex.str();
    return subex instanceof OrExpression ? s.slice(1, -1) : s;
  }
}

export class ImpExpression extends BooleanExpression {
  getOp(): string {
    return Tokens.IMP;
  }
}

export class IffExpression extends BooleanExpression {
  getOp(): string {
    return Tokens.IFF;
  }
}

export class EqualityExpression extends BinaryExpression {
  override setType(otherType: Type = ANY_TYPE, signature?: TypeSignature): void {
    const sig = signature ?? new Map<string, AbstractVariableExpression[]>();
    if (!otherType.matches(TRUTH_TYPE)) {
      throw new IllegalTypeException(this, otherType, TRUTH_TYPE);
    }
    this.first.setType(ENTITY_TYPE, sig);
    this.second.setType(ENTITY_TYPE, sig);
  }
  getOp(): string {
    return Tokens.EQ;
  }
}

// ---------------------------------------------------------------------------
// LogicParser
// ---------------------------------------------------------------------------

const OPERATOR_PRECEDENCE: Record<string, number> = {};
for (const t of Tokens.LAMBDA_LIST) OPERATOR_PRECEDENCE[t] = 1;
for (const t of Tokens.NOT_LIST) OPERATOR_PRECEDENCE[t] = 2;
OPERATOR_PRECEDENCE[APP] = 3;
for (const t of [...Tokens.EQ_LIST, ...Tokens.NEQ_LIST]) OPERATOR_PRECEDENCE[t] = 4;
for (const t of QUANTS) OPERATOR_PRECEDENCE[t] = 5;
for (const t of Tokens.AND_LIST) OPERATOR_PRECEDENCE[t] = 6;
for (const t of Tokens.OR_LIST) OPERATOR_PRECEDENCE[t] = 7;
for (const t of Tokens.IMP_LIST) OPERATOR_PRECEDENCE[t] = 8;
for (const t of Tokens.IFF_LIST) OPERATOR_PRECEDENCE[t] = 9;
OPERATOR_PRECEDENCE["None"] = 10;

const RIGHT_ASSOCIATED_OPERATIONS = [APP];

const LEAF = "__leaf__";

interface TrieNode {
  [key: string]: TrieNode;
}

function buildSymbolTrie(symbols: string[]): TrieNode {
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

type BooleanFactory =
  | typeof AndExpression
  | typeof OrExpression
  | typeof ImpExpression
  | typeof IffExpression;

type QuantifiedFactory =
  | typeof ExistsExpression
  | typeof AllExpression
  | typeof IotaExpression;

export class LogicParser {
  /** Maximum expression-nesting depth (nltk.sem.logic LogicParser.MAX_PARSE_DEPTH). */
  static MAX_PARSE_DEPTH = 200;

  private currentIndex = 0;
  private buffer: string[] = [];
  private parseDepth = 0;
  private typeCheck: boolean;
  private symbolTrie = buildSymbolTrie(SYMBOLS);
  private quoteChars: [string, string, string, boolean][] = [];

  constructor(typeCheck = false) {
    this.typeCheck = typeCheck;
  }

  parse(data: string, signature?: Record<string, Type | string>): Expression {
    data = data.replace(/\s+$/, "");
    this.currentIndex = 0;
    this.parseDepth = 0;
    const [buffer, mapping] = this.process(data);
    this.buffer = buffer;

    let result: Expression;
    try {
      result = this.processNextExpression(null);
      if (this.inRange(0)) {
        throw new UnexpectedTokenException(this.currentIndex + 1, this.token(0));
      }
    } catch (e) {
      // NLTK wraps every parser error in a fresh LogicalExpressionException,
      // rendering the input and a caret at the error position.
      if (e instanceof LogicalExpressionException) {
        const caret = mapping.get(e.index! - 1)!;
        const msg = `${e.message}\n${data}\n${" ".repeat(caret)}^`;
        throw new LogicalExpressionException(null, msg);
      }
      throw e;
    }
    if (this.typeCheck) result.typecheck(signature);
    return result;
  }

  /** Split the data into tokens (trie-based longest symbol match, like NLTK).
   * Returns [tokens, mapping] where mapping indexes token positions to
   * character offsets in `data`. */
  process(data: string): [string[], Map<number, number>] {
    const out: string[] = [];
    const mapping = new Map<number, number>();
    let token = "";
    let dataIdx = 0;
    let tokenStartIdx = dataIdx;
    while (dataIdx < data.length) {
      const [quotedToken, nextIdx] = this.processQuotedToken(dataIdx, data);
      if (quotedToken) {
        if (!token) tokenStartIdx = dataIdx;
        token += quotedToken;
        dataIdx = nextIdx;
        continue;
      }

      let st: TrieNode = this.symbolTrie;
      let c = data[dataIdx]!;
      let symbol = "";
      while (c in st) {
        symbol += c;
        st = st[c]!;
        if (data.length - dataIdx > symbol.length) {
          c = data[dataIdx + symbol.length]!;
        } else {
          break;
        }
      }
      if (LEAF in st) {
        if (token) {
          mapping.set(out.length, tokenStartIdx);
          out.push(token);
          token = "";
        }
        mapping.set(out.length, dataIdx);
        out.push(symbol);
        dataIdx += symbol.length;
      } else {
        const ch = data[dataIdx]!;
        if (ch === " " || ch === "\t" || ch === "\n") {
          if (token) {
            mapping.set(out.length, tokenStartIdx);
            out.push(token);
            token = "";
          }
        } else {
          if (!token) tokenStartIdx = dataIdx;
          token += ch;
        }
        dataIdx += 1;
      }
    }
    if (token) {
      mapping.set(out.length, tokenStartIdx);
      out.push(token);
    }
    mapping.set(out.length, data.length);
    mapping.set(out.length + 1, data.length + 1);
    return [out, mapping];
  }

  /** Quote-char handling; the base parser defines no quote chars, so this
   * always returns no token (NLTK parity hook for subclasses). */
  processQuotedToken(dataIdx: number, data: string): [string, number] {
    let token = "";
    const c = data[dataIdx]!;
    let i = dataIdx;
    for (const [start, end, escape, inclQuotes] of this.quoteChars) {
      if (c === start) {
        if (inclQuotes) token += c;
        i += 1;
        while (data[i] !== end) {
          if (data[i] === escape) {
            if (inclQuotes) token += data[i];
            i += 1;
            if (data.length === i) {
              throw new LogicalExpressionException(
                null,
                `End of input reached.  Escape character [${escape}] found at end.`,
              );
            }
            token += data[i]!;
          } else {
            token += data[i]!;
          }
          i += 1;
          if (data.length === i) {
            throw new LogicalExpressionException(null, `End of input reached.  Expected: [${end}]`);
          }
        }
        if (inclQuotes) token += data[i];
        i += 1;
        if (!token) {
          throw new LogicalExpressionException(null, "Empty quoted token found");
        }
        break;
      }
    }
    return [token, i];
  }

  getAllSymbols(): string[] {
    return SYMBOLS;
  }

  inRange(location: number): boolean {
    return this.currentIndex + location < this.buffer.length;
  }

  token(location?: number): string {
    const idx = location === undefined ? this.currentIndex : this.currentIndex + location;
    // NLTK indexes a Python list, so negative locations wrap around.
    const tok = idx < 0 ? this.buffer[this.buffer.length + idx] : this.buffer[idx];
    if (tok === undefined) {
      throw new ExpectedMoreTokensException(this.currentIndex + 1);
    }
    if (location === undefined) this.currentIndex += 1;
    return tok;
  }

  isvariable(tok: string): boolean {
    return !TOKENS.includes(tok);
  }

  processNextExpression(context: string | null): Expression {
    this.parseDepth += 1;
    try {
      if (this.parseDepth > LogicParser.MAX_PARSE_DEPTH) {
        throw new LogicalExpressionException(
          this.currentIndex + 1,
          `Expression nesting exceeds the maximum depth (${LogicParser.MAX_PARSE_DEPTH}).`,
        );
      }
      let tok: string;
      try {
        tok = this.token();
      } catch (e) {
        if (e instanceof ExpectedMoreTokensException) {
          throw new ExpectedMoreTokensException(this.currentIndex + 1, "Expression expected.");
        }
        throw e;
      }
      const accum = this.handle(tok, context);
      if (!accum) {
        throw new UnexpectedTokenException(this.currentIndex, tok, undefined, "Expression expected.");
      }
      return this.attemptAdjuncts(accum, context);
    } finally {
      this.parseDepth -= 1;
    }
  }

  handle(tok: string, context: string | null): Expression | undefined {
    if (this.isvariable(tok)) {
      return this.handleVariable(tok, context);
    } else if (Tokens.NOT_LIST.includes(tok)) {
      return this.handleNegation(tok, context);
    } else if (Tokens.LAMBDA_LIST.includes(tok)) {
      return this.handleLambda(tok, context);
    } else if (QUANTS.includes(tok)) {
      return this.handleQuant(tok, context);
    } else if (tok === Tokens.OPEN) {
      return this.handleOpen(tok, context);
    }
    return undefined;
  }

  attemptAdjuncts(expression: Expression, context: string | null): Expression {
    let curIdx = -1;
    let expr = expression;
    while (curIdx !== this.currentIndex) {
      curIdx = this.currentIndex;
      expr = this.attemptEqualityExpression(expr, context);
      expr = this.attemptApplicationExpression(expr, context);
      expr = this.attemptBooleanExpression(expr, context);
    }
    return expr;
  }

  makeApplicationExpression(function_: Expression, argument: Expression): ApplicationExpression {
    return new ApplicationExpression(function_, argument);
  }

  makeVariableExpression(name: string): AbstractVariableExpression {
    return VariableExpression(new Variable(name));
  }

  makeLambdaExpression(variable: Variable, term: Expression): LambdaExpression {
    return new LambdaExpression(variable, term);
  }

  makeNegatedExpression(term: Expression): NegatedExpression {
    return new NegatedExpression(term);
  }

  makeEqualityExpression(first: Expression, second: Expression): EqualityExpression {
    return new EqualityExpression(first, second);
  }

  makeQuanifiedExpression(factory: QuantifiedFactory, variable: Variable, term: Expression): QuantifiedExpression {
    return new factory(variable, term);
  }

  makeBooleanExpression(factory: BooleanFactory, first: Expression, second: Expression): BooleanExpression {
    return new factory(first, second);
  }

  handleNegation(_tok: string, _context: string | null): Expression {
    return this.makeNegatedExpression(this.processNextExpression(Tokens.NOT));
  }

  handleVariable(tok: string, _context: string | null): Expression {
    let accum: Expression = this.makeVariableExpression(tok);
    if (this.inRange(0) && this.token(0) === Tokens.OPEN) {
      if (
        !(accum instanceof FunctionVariableExpression) &&
        !(accum instanceof ConstantExpression)
      ) {
        throw new LogicalExpressionException(
          this.currentIndex,
          `'${tok}' is an illegal predicate name.  Individual variables may not be used as predicates.`,
        );
      }
      this.token(); // swallow the open paren
      accum = this.makeApplicationExpression(accum, this.processNextExpression(APP));
      while (this.inRange(0) && this.token(0) === Tokens.COMMA) {
        this.token(); // swallow the comma
        accum = this.makeApplicationExpression(accum, this.processNextExpression(APP));
      }
      this.assertNextToken(Tokens.CLOSE);
    }
    return accum;
  }

  getNextTokenVariable(description: string): Variable {
    let tok: string;
    try {
      tok = this.token();
    } catch (e) {
      if (e instanceof ExpectedMoreTokensException) {
        throw new ExpectedMoreTokensException(e.index, "Variable expected.");
      }
      throw e;
    }
    if (this.makeVariableExpression(tok) instanceof ConstantExpression) {
      throw new LogicalExpressionException(
        this.currentIndex,
        `'${tok}' is an illegal variable name.  Constants may not be ${description}.`,
      );
    }
    return new Variable(tok);
  }

  handleLambda(tok: string, _context: string | null): Expression {
    if (!this.inRange(0)) {
      throw new ExpectedMoreTokensException(
        this.currentIndex + 2,
        "Variable and Expression expected following lambda operator.",
      );
    }
    const vars: Variable[] = [this.getNextTokenVariable("abstracted")];
    for (;;) {
      if (!this.inRange(0) || (this.token(0) === Tokens.DOT && !this.inRange(1))) {
        throw new ExpectedMoreTokensException(this.currentIndex + 2, "Expression expected.");
      }
      if (!this.isvariable(this.token(0))) break;
      vars.push(this.getNextTokenVariable("abstracted"));
    }
    if (this.inRange(0) && this.token(0) === Tokens.DOT) {
      this.token(); // swallow the dot
    }
    let accum = this.processNextExpression(tok);
    while (vars.length) {
      accum = this.makeLambdaExpression(vars.pop()!, accum);
    }
    return accum;
  }

  handleQuant(tok: string, _context: string | null): Expression {
    const factory = this.getQuantifiedExpressionFactory(tok);
    if (!this.inRange(0)) {
      throw new ExpectedMoreTokensException(
        this.currentIndex + 2,
        `Variable and Expression expected following quantifier '${tok}'.`,
      );
    }
    const vars: Variable[] = [this.getNextTokenVariable("quantified")];
    for (;;) {
      if (!this.inRange(0) || (this.token(0) === Tokens.DOT && !this.inRange(1))) {
        throw new ExpectedMoreTokensException(this.currentIndex + 2, "Expression expected.");
      }
      if (!this.isvariable(this.token(0))) break;
      vars.push(this.getNextTokenVariable("quantified"));
    }
    if (this.inRange(0) && this.token(0) === Tokens.DOT) {
      this.token(); // swallow the dot
    }
    let accum = this.processNextExpression(tok);
    while (vars.length) {
      accum = this.makeQuanifiedExpression(factory, vars.pop()!, accum);
    }
    return accum;
  }

  getQuantifiedExpressionFactory(tok: string): QuantifiedFactory {
    if (Tokens.EXISTS_LIST.includes(tok)) return ExistsExpression;
    if (Tokens.ALL_LIST.includes(tok)) return AllExpression;
    if (Tokens.IOTA_LIST.includes(tok)) return IotaExpression;
    throw new LogicalExpressionException(this.currentIndex, `Unexpected token: '${tok}'.`);
  }

  handleOpen(_tok: string, _context: string | null): Expression {
    const accum = this.processNextExpression(null);
    this.assertNextToken(Tokens.CLOSE);
    return accum;
  }

  attemptEqualityExpression(expression: Expression, context: string | null): Expression {
    if (this.inRange(0)) {
      const tok = this.token(0);
      if (
        ([...Tokens.EQ_LIST, ...Tokens.NEQ_LIST].includes(tok) &&
          this.hasPriority(tok, context))
      ) {
        this.token(); // swallow the operator
        let expr: Expression = this.makeEqualityExpression(
          expression,
          this.processNextExpression(tok),
        );
        if (Tokens.NEQ_LIST.includes(tok)) {
          expr = this.makeNegatedExpression(expr);
        }
        return expr;
      }
    }
    return expression;
  }

  attemptBooleanExpression(expression: Expression, context: string | null): Expression {
    let expr = expression;
    while (this.inRange(0)) {
      const tok = this.token(0);
      const factory = this.getBooleanExpressionFactory(tok);
      if (factory && this.hasPriority(tok, context)) {
        this.token(); // swallow the operator
        expr = this.makeBooleanExpression(factory, expr, this.processNextExpression(tok));
      } else {
        break;
      }
    }
    return expr;
  }

  getBooleanExpressionFactory(tok: string): BooleanFactory | null {
    if (Tokens.AND_LIST.includes(tok)) return AndExpression;
    if (Tokens.OR_LIST.includes(tok)) return OrExpression;
    if (Tokens.IMP_LIST.includes(tok)) return ImpExpression;
    if (Tokens.IFF_LIST.includes(tok)) return IffExpression;
    return null;
  }

  attemptApplicationExpression(expression: Expression, context: string | null): Expression {
    if (this.hasPriority(APP, context)) {
      if (this.inRange(0) && this.token(0) === Tokens.OPEN) {
        if (
          !(expression instanceof LambdaExpression) &&
          !(expression instanceof ApplicationExpression) &&
          !(expression instanceof FunctionVariableExpression) &&
          !(expression instanceof ConstantExpression)
        ) {
          throw new LogicalExpressionException(
            this.currentIndex,
            `The function '${expression.str()}' is not a Lambda Expression, an Application Expression, or a functional predicate, so it may not take arguments.`,
          );
        }
        this.token(); // swallow the open paren
        let accum = this.makeApplicationExpression(expression, this.processNextExpression(APP));
        while (this.inRange(0) && this.token(0) === Tokens.COMMA) {
          this.token(); // swallow the comma
          accum = this.makeApplicationExpression(accum, this.processNextExpression(APP));
        }
        this.assertNextToken(Tokens.CLOSE);
        return accum;
      }
    }
    return expression;
  }

  hasPriority(operation: string, context: string | null): boolean {
    const opPrec = OPERATOR_PRECEDENCE[operation]!;
    const ctxPrec = OPERATOR_PRECEDENCE[context === null ? "None" : context]!;
    return (
      opPrec < ctxPrec ||
      (RIGHT_ASSOCIATED_OPERATIONS.includes(operation) && opPrec === ctxPrec)
    );
  }

  assertNextToken(expected: string): void {
    let tok: string;
    try {
      tok = this.token();
    } catch (e) {
      if (e instanceof ExpectedMoreTokensException) {
        throw new ExpectedMoreTokensException(e.index, `Expected token '${expected}'.`);
      }
      throw e;
    }
    if (tok !== expected) {
      throw new UnexpectedTokenException(this.currentIndex, tok, expected);
    }
  }

  assertToken(tok: string, expected: string | string[]): void {
    if (Array.isArray(expected)) {
      if (!expected.includes(tok)) {
        throw new UnexpectedTokenException(this.currentIndex, tok, expected.join(","));
      }
    } else if (tok !== expected) {
      throw new UnexpectedTokenException(this.currentIndex, tok, expected);
    }
  }
}

/** Convenience mirror of Expression.fromstring. */
export function fromstring(s: string): Expression {
  return new LogicParser().parse(s);
}

export const lexpr = fromstring;

/** NLTK SubstituteBindingsI — interface for objects that can substitute
 * variables. Methods raise NotImplementedError, as in NLTK. */
export class SubstituteBindingsI {
  substitute_bindings(_bindings: unknown): unknown {
    throw new Error("NotImplementedError");
  }
  variables(): unknown {
    throw new Error("NotImplementedError");
  }
}

/** Port of nltk.sem.logic.read_logic: parse a string containing one logical
 * formula per line ('#' comments and blank lines skipped). */
export function read_logic(
  s: string | Uint8Array,
  logicParser?: LogicParser,
  encoding?: string,
): Expression[] {
  let text: string;
  if (encoding !== undefined && typeof s !== "string") {
    text = new TextDecoder(encoding as ConstructorParameters<typeof TextDecoder>[0]).decode(s);
  } else {
    text = s as string;
  }
  const parser = logicParser ?? new LogicParser();
  const statements: Expression[] = [];
  const lines = text.split(/\r?\n/);
  for (let linenum = 0; linenum < lines.length; linenum++) {
    const line = lines[linenum]!.trim();
    if (line.startsWith("#") || line === "") continue;
    try {
      statements.push(parser.parse(line));
    } catch (e) {
      if (e instanceof LogicalExpressionException) {
        const err = new Error(`Unable to parse line ${linenum}: ${line}`, { cause: e });
        err.name = "ValueError";
        throw err;
      }
      throw e;
    }
  }
  return statements;
}
export const readLogic = read_logic;

/** Port of nltk.sem.logic.skolem_function: a fresh F-counter function variable
 * applied to each variable in `univScope`. */
export function skolem_function(univScope?: Iterable<Variable>): Expression {
  let skolem: Expression = VariableExpression(new Variable(`F${nextUniqueCounterValue()}`));
  if (univScope) {
    for (const v of univScope) {
      skolem = skolem.applyto(VariableExpression(v));
    }
  }
  return skolem;
}
export const skolemFunction = skolem_function;

/** NLTK boolean_ops — print the boolean operator table. */
export function boolean_ops(): void {
  const names = ["negation", "conjunction", "disjunction", "implication", "equivalence"];
  const ops = [Tokens.NOT, Tokens.AND, Tokens.OR, Tokens.IMP, Tokens.IFF];
  names.forEach((name, i) => console.log(`${name.padEnd(15)}\t${ops[i]}`));
}

/** NLTK equality_preds — print the equality predicate table. */
export function equality_preds(): void {
  const names = ["equality", "inequality"];
  const ops = [Tokens.EQ, Tokens.NEQ];
  names.forEach((name, i) => console.log(`${name.padEnd(15)}\t${ops[i]}`));
}

/** NLTK binding_ops — print the binding operator table. Quirk preserved: the
 * zip truncates to the 3 names, so the iota token is never printed. */
export function binding_ops(): void {
  const names = ["existential", "universal", "lambda"];
  const ops = [Tokens.EXISTS, Tokens.ALL, Tokens.LAMBDA, Tokens.IOTA];
  names.forEach((name, i) => console.log(`${name.padEnd(15)}\t${ops[i]}`));
}

/** NLTK printtype — broken in NLTK 3.10.3: it calls ``ex.str()``, which does
 * not exist on NLTK expressions, so it always raises AttributeError. The
 * py3-broken contract is preserved rather than silently fixed. */
export function printtype(ex: Expression): void {
  throw new Error(`AttributeError: '${ex.constructor.name}' object has no attribute 'str'`);
}

/** NLTK demoException — parse `s`, printing the exception class and message. */
export function demoException(s: string): void {
  try {
    Expression.fromstring(s);
  } catch (e) {
    if (e instanceof LogicalExpressionException) {
      console.log(`${e.name}: ${e.message}`);
    } else {
      throw e;
    }
  }
}

/** NLTK nltk.sem.logic.demo() — deterministic parser demonstration. */
export function semLogicDemo(): void {
  const lexpr = (s: string) => Expression.fromstring(s);
  console.log("=".repeat(20) + "Test reader" + "=".repeat(20));
  console.log(`${lexpr("john")}`);
  console.log(`${lexpr("man(x)")}`);
  console.log(`${lexpr("-man(x)")}`);
  console.log(`${lexpr("(man(x) & tall(x) & walks(x))")}`);
  console.log(`${lexpr("exists x.(man(x) & tall(x) & walks(x))")}`);
  console.log(`${lexpr("\\x.man(x)")}`);
  console.log(`${lexpr("\\x.man(x)(john)")}`);
  console.log(`${lexpr("\\x y.sees(x,y)")}`);
  console.log(`${lexpr("\\x y.sees(x,y)(a,b)")}`);
  console.log(`${lexpr("(\\x.exists y.walks(x,y))(x)")}`);
  console.log(`${lexpr("exists x.x = y")}`);
  console.log(`${lexpr("exists x.(x = y)")}`);
  console.log(`${lexpr("P(x) & x=y & P(y)")}`);
  console.log(`${lexpr("\\P Q.exists x.(P(x) & Q(x))")}`);
  console.log(`${lexpr("man(x) <-> tall(x)")}`);

  console.log("=".repeat(20) + "Test simplify" + "=".repeat(20));
  console.log(`${lexpr("\\x.\\y.sees(x,y)(john)(mary)").simplify()}`);
  console.log(`${lexpr("\\x.\\y.sees(x,y)(john, mary)").simplify()}`);
  console.log(`${lexpr("all x.(man(x) & (\\x.exists y.walks(x,y))(x))").simplify()}`);
  console.log(`${lexpr("(\\P.\\Q.exists x.(P(x) & Q(x)))(\\x.dog(x))(\\x.bark(x))").simplify()}`);

  console.log("=".repeat(20) + "Test alpha conversion and binder expression equality" + "=".repeat(20));
  const e1 = lexpr("exists x.P(x)");
  console.log(`${e1}`);
  const e2 = (e1 as VariableBinderExpression).alphaConvert(new Variable("z"));
  console.log(`${e2}`);
  console.log(e1.equals(e2) ? "True" : "False");
}

/** NLTK nltk.sem.logic.demo_errors() — prints one line per parse failure. */
export function semLogicDemoErrors(): void {
  console.log("=".repeat(20) + "Test reader errors" + "=".repeat(20));
  demoException("(P(x) & Q(x)");
  demoException("((P(x) &) & Q(x))");
  demoException("P(x) -> ");
  demoException("P(x");
  demoException("P(x,");
  demoException("P(x,)");
  demoException("exists");
  demoException("exists x.");
  demoException("\\");
  demoException("\\ x y.");
  demoException("P(x)Q(x)");
  demoException("(P(x)Q(x)");
  demoException("exists x -> y");
}

// ---------------------------------------------------------------------------
// Evaluation (core of nltk.sem.evaluate)
// ---------------------------------------------------------------------------

export type SemanticValue = string | boolean | string[][];
export type ValuationSpec = Record<string, string | boolean | string[] | string[][]>;

export class Valuation {
  private values = new Map<string, SemanticValue>();

  constructor(spec: ValuationSpec) {
    for (const [sym, val] of Object.entries(spec)) {
      this.values.set(sym, Valuation.normalizeValue(val));
    }
  }

  static normalizeValue(val: string | boolean | string[] | string[][]): SemanticValue {
    if (typeof val === "string" || typeof val === "boolean") return val;
    if (Array.isArray(val)) {
      if (val.every((x) => Array.isArray(x))) {
        return val as string[][];
      }
      // set of individuals -> unary tuples (set2rel)
      return (val as string[]).map((x) => [x]);
    }
    throw new Error(`Error in initializing Valuation. Unrecognized value for symbol.`);
  }

  has(sym: string): boolean {
    return this.values.has(sym);
  }

  get(sym: string): SemanticValue {
    if (!this.values.has(sym)) {
      throw new UndefinedError(`Unknown expression: '${sym}'`);
    }
    return this.values.get(sym)!;
  }

  get domain(): Set<string> {
    const dom = new Set<string>();
    for (const val of this.values.values()) {
      if (typeof val === "string") {
        dom.add(val);
      } else if (typeof val !== "boolean") {
        for (const tuple of val) {
          for (const elem of tuple) {
            if (elem !== undefined) dom.add(elem);
          }
        }
      }
    }
    return dom;
  }

  get symbols(): string[] {
    return Array.from(this.values.keys()).sort();
  }
}

export class Assignment {
  domain: Set<string>;
  private map = new Map<string, string>();

  constructor(domain: Iterable<string>, assign?: Record<string, string>) {
    this.domain = new Set(domain);
    if (assign) {
      for (const [v, val] of Object.entries(assign)) {
        this.add(v, val);
      }
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): string {
    if (!this.map.has(key)) {
      throw new UndefinedError(`Not recognized as a variable: '${key}'`);
    }
    return this.map.get(key)!;
  }

  add(v: string, val: string): Assignment {
    if (!this.domain.has(val)) {
      throw new Error(`'${val}' is not in the domain: ${Array.from(this.domain).sort()}`);
    }
    if (!is_indvar(v)) {
      throw new Error(`Wrong format for an Individual Variable: '${v}'`);
    }
    this.map.set(v, val);
    return this;
  }

  copy(): Assignment {
    const newG = new Assignment(this.domain);
    for (const [k, v] of this.map.entries()) newG.map.set(k, v);
    return newG;
  }

  purge(v?: string): void {
    if (v) this.map.delete(v);
    else this.map.clear();
  }

  entries(): [string, string][] {
    return Array.from(this.map.entries());
  }
}

export interface ModelSpec {
  domain: string[];
  valuations: ValuationSpec;
}

export class Model {
  domain: Set<string>;
  valuation: Valuation;

  constructor(domain: Iterable<string>, valuation: Valuation) {
    this.domain = new Set(domain);
    this.valuation = valuation;
    for (const d of valuation.domain) {
      if (!this.domain.has(d)) {
        throw new Error(
          `The valuation domain must be a subset of the model's domain ('${d}' missing)`,
        );
      }
    }
  }

  evaluate(expr: string | Expression, g: Assignment): boolean | "Undefined" {
    try {
      const parsed = typeof expr === "string" ? fromstring(expr) : expr;
      return this.satisfy(parsed, g) as boolean | "Undefined";
    } catch (e) {
      if (e instanceof UndefinedError) return "Undefined";
      throw e;
    }
  }

  satisfy(parsed: Expression, g: Assignment): unknown {
    if (parsed instanceof ApplicationExpression) {
      const [fn, args] = parsed.uncurry();
      if (fn instanceof AbstractVariableExpression) {
        // Predicate expression ("P(x,y)"): use uncurried arguments.
        const funval = this.satisfy(fn, g);
        const argvals = args.map((a) => this.satisfy(a, g));
        return relationContains(funval, argvals);
      }
      // Lambda application: use curried form.
      const funval = this.satisfy(parsed.function, g) as Record<string, unknown>;
      const argval = this.satisfy(parsed.argument, g) as string;
      return funval[argval];
    } else if (parsed instanceof NegatedExpression) {
      return !this.satisfy(parsed.term, g);
    } else if (parsed instanceof AndExpression) {
      return this.satisfy(parsed.first, g) && this.satisfy(parsed.second, g);
    } else if (parsed instanceof OrExpression) {
      return this.satisfy(parsed.first, g) || this.satisfy(parsed.second, g);
    } else if (parsed instanceof ImpExpression) {
      return !this.satisfy(parsed.first, g) || this.satisfy(parsed.second, g);
    } else if (parsed instanceof IffExpression) {
      return this.satisfy(parsed.first, g) === this.satisfy(parsed.second, g);
    } else if (parsed instanceof EqualityExpression) {
      return this.satisfy(parsed.first, g) === this.satisfy(parsed.second, g);
    } else if (parsed instanceof AllExpression) {
      for (const u of this.domain) {
        const newG = g.copy();
        newG.add(parsed.variable.name, u);
        if (!this.satisfy(parsed.term, newG)) return false;
      }
      return true;
    } else if (parsed instanceof ExistsExpression) {
      for (const u of this.domain) {
        const newG = g.copy();
        newG.add(parsed.variable.name, u);
        if (this.satisfy(parsed.term, newG)) return true;
      }
      return false;
    } else if (parsed instanceof IotaExpression) {
      // Faithful to NLTK: iota satisfies like exists here.
      for (const u of this.domain) {
        const newG = g.copy();
        newG.add(parsed.variable.name, u);
        if (this.satisfy(parsed.term, newG)) return true;
      }
      return false;
    } else if (parsed instanceof LambdaExpression) {
      const cf: Record<string, unknown> = {};
      for (const u of this.domain) {
        const newG = g.copy();
        newG.add(parsed.variable.name, u);
        cf[u] = this.satisfy(parsed.term, newG);
      }
      return cf;
    } else if (parsed instanceof AbstractVariableExpression) {
      return this.i(parsed, g);
    }
    throw new UndefinedError(`Can't find a value for ${parsed.str()}`);
  }

  i(parsed: AbstractVariableExpression, g: Assignment): SemanticValue {
    if (this.valuation.has(parsed.variable.name)) {
      return this.valuation.get(parsed.variable.name);
    } else if (parsed instanceof IndividualVariableExpression) {
      return g.get(parsed.variable.name);
    }
    throw new UndefinedError(`Can't find a value for ${parsed.str()}`);
  }

  satisfiers(parsed: Expression, varex: Variable | string, g: Assignment): Set<string> {
    const v = typeof varex === "string" ? new Variable(varex) : varex;
    if (!setHasVar(parsed.free(), v)) {
      throw new UndefinedError(`${v.name} is not free in ${parsed.str()}`);
    }
    const result = new Set<string>();
    for (const u of this.domain) {
      const newG = g.copy();
      newG.add(v.name, u);
      const value = this.satisfy(parsed, newG);
      if (value !== false) {
        result.add(u);
      }
    }
    return result;
  }
}

function relationContains(funval: unknown, argvals: unknown[]): boolean {
  if (!Array.isArray(funval)) {
    throw new TypeError("Relation value expected");
  }
  return funval.some(
    (tuple) =>
      Array.isArray(tuple) &&
      tuple.length === argvals.length &&
      tuple.every((elem, idx) => elem === argvals[idx]),
  );
}
