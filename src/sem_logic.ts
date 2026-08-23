/*
 * Port of the core of nltk.sem.logic (first-order logic with lambda calculus)
 * plus the basics of nltk.sem.evaluate (Valuation / Model / Assignment).
 *
 * Skipped deliberately: DRSs, linear logic, type checking/inference, skolemization,
 * quoted tokens, and `?`/`@`-prefixed predicate variables.
 */

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
  abstract str(): string;
  toString(): string {
    return this.str();
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

  /** All free variables (constants excluded unless ?/@-prefixed, which are unsupported). */
  variables(): Set<Variable> {
    return this.free();
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
    let result: Expression = this;
    const names = Array.from(indivVars.keys()).sort();
    for (let i = 0; i < names.length; i++) {
      const e = indivVars.get(names[i]!)!;
      const newVar =
        e instanceof EventVariableExpression
          ? new Variable(`e0${i + 1}`)
          : new Variable(`z${i + 1}`);
      result = result.replace(e.variable, makeVariableExpression(newVar.name), true);
    }
    return result;
  }

  substituteBindings(bindings: Map<string, Variable | Expression>): Expression {
    let expr: Expression = this;
    for (const v of Array.from(expr.free())) {
      if (bindings.has(v.name)) {
        let val = bindings.get(v.name)!;
        if (val instanceof Variable) {
          val = makeVariableExpression(val.name);
        }
        val = val.substituteBindings(bindings);
        expr = expr.replace(v, val);
      }
    }
    return expr.simplify();
  }

  applyto(other: Expression): ApplicationExpression {
    return new ApplicationExpression(this, other);
  }

  negate(): Expression {
    return new NegatedExpression(this);
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
  str(): string {
    return this.variable.name;
  }
}

export class IndividualVariableExpression extends AbstractVariableExpression {
  override free(): Set<Variable> {
    return new Set([this.variable]);
  }
}

export class FunctionVariableExpression extends AbstractVariableExpression {
  override free(): Set<Variable> {
    return new Set([this.variable]);
  }
}

export class EventVariableExpression extends IndividualVariableExpression {}

export class ConstantExpression extends AbstractVariableExpression {
  override constants(): Set<Variable> {
    return new Set([this.variable]);
  }
}

/** Factory mirroring nltk.sem.logic.VariableExpression(). */
export function makeVariableExpression(name: string): AbstractVariableExpression {
  if (is_indvar(name)) return new IndividualVariableExpression(new Variable(name));
  if (is_funcvar(name)) return new FunctionVariableExpression(new Variable(name));
  if (is_eventvar(name)) return new EventVariableExpression(new Variable(name));
  return new ConstantExpression(new Variable(name));
}

// -- Application ------------------------------------------------------------

export class ApplicationExpression extends Expression {
  function: Expression;
  argument: Expression;
  constructor(func: Expression, argument: Expression) {
    super();
    this.function = func;
    this.argument = argument;
  }

  simplify(): Expression {
    const fn = this.function.simplify();
    const arg = this.argument.simplify();
    if (fn instanceof LambdaExpression) {
      return fn.term.replace(fn.variable, arg).simplify();
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
    let self: VariableBinderExpression = this;
    if (alphaConvert && setHasVar(expression.free(), this.variable)) {
      self = self.alphaConvert(uniqueVariable(this.variable));
    }
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

abstract class QuantifiedExpression extends VariableBinderExpression {
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

export abstract class BooleanExpression extends BinaryExpression {}

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

export class LogicParser {
  private currentIndex = 0;
  private buffer: string[] = [];
  private symbolTrie = buildSymbolTrie(SYMBOLS);

  parse(data: string): Expression {
    data = data.replace(/\s+$/, "");
    this.currentIndex = 0;
    this.buffer = this.process(data);

    let result: Expression;
    try {
      result = this.processNextExpression(null);
      if (this.inRange(0)) {
        throw new UnexpectedTokenException(this.currentIndex + 1, this.token(0));
      }
    } catch (e) {
      // NLTK wraps every parser error in a fresh LogicalExpressionException,
      // erasing the original subclass.
      if (e instanceof LogicalExpressionException) {
        throw new LogicalExpressionException(null, e.message);
      }
      throw e;
    }
    return result;
  }

  /** Split the data into tokens (trie-based longest symbol match, like NLTK). */
  process(data: string): string[] {
    const out: string[] = [];
    let token = "";
    let dataIdx = 0;
    while (dataIdx < data.length) {
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
          out.push(token);
          token = "";
        }
        out.push(symbol);
        dataIdx += symbol.length;
      } else {
        const ch = data[dataIdx];
        if (ch === " " || ch === "\t" || ch === "\n") {
          if (token) {
            out.push(token);
            token = "";
          }
        } else {
          token += ch;
        }
        dataIdx += 1;
      }
    }
    if (token) out.push(token);
    return out;
  }

  getAllSymbols(): string[] {
    return SYMBOLS;
  }

  inRange(location: number): boolean {
    return this.currentIndex + location < this.buffer.length;
  }

  token(location?: number): string {
    const idx = location === undefined ? this.currentIndex : this.currentIndex + location;
    if (idx >= this.buffer.length || idx < 0) {
      throw new ExpectedMoreTokensException(this.currentIndex + 1);
    }
    if (location === undefined) this.currentIndex += 1;
    return this.buffer[idx]!;
  }

  isvariable(tok: string): boolean {
    return !TOKENS.includes(tok);
  }

  processNextExpression(context: string | null): Expression {
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

  handleNegation(_tok: string, _context: string | null): Expression {
    return new NegatedExpression(this.processNextExpression(Tokens.NOT));
  }

  handleVariable(tok: string, _context: string | null): Expression {
    let accum: Expression = makeVariableExpression(tok);
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
      accum = new ApplicationExpression(accum, this.processNextExpression(APP));
      while (this.inRange(0) && this.token(0) === Tokens.COMMA) {
        this.token(); // swallow the comma
        accum = new ApplicationExpression(accum, this.processNextExpression(APP));
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
    if (makeVariableExpression(tok) instanceof ConstantExpression) {
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
      accum = new LambdaExpression(vars.pop()!, accum);
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
      accum = new factory(vars.pop()!, accum);
    }
    return accum;
  }

  getQuantifiedExpressionFactory(
    tok: string,
  ): new (v: Variable, t: Expression) => QuantifiedExpression {
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
        let expr: Expression = new EqualityExpression(
          expression,
          this.processNextExpression(tok),
        );
        if (Tokens.NEQ_LIST.includes(tok)) {
          expr = new NegatedExpression(expr);
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
        expr = new factory(expr, this.processNextExpression(tok));
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
        let accum = new ApplicationExpression(expression, this.processNextExpression(APP));
        while (this.inRange(0) && this.token(0) === Tokens.COMMA) {
          this.token(); // swallow the comma
          accum = new ApplicationExpression(accum, this.processNextExpression(APP));
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
}

/** Convenience mirror of Expression.fromstring. */
export function fromstring(s: string): Expression {
  return new LogicParser().parse(s);
}

export const lexpr = fromstring;

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
