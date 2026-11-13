/*
 * Port of the pure-Python parts of nltk.sem.boxer (NLTK 3.10.3):
 * the Boxer DRS object hierarchy, the Prolog-output DRS parser
 * (BoxerOutputDrsParser), the re-parse parser for the repr() form
 * (BoxerDrsParser), the DRS interpreters, and the boxer-stdout ->
 * drs-dict reader.  All quirks are preserved: float-division
 * sent_index values, the undefined `_make_atom` crash inside
 * _handle_time, `get_next_token_variable` returning raw tokens in
 * BoxerDrsParser, and the trailing `assert False` for unknown
 * condition tokens.
 *
 * The `Boxer` subprocess wrapper itself is NOT ported: it shells out
 * to the C&C/Boxer binaries (honest gap).  `parseToDrsDict` keeps the
 * pure parsing half of `Boxer._parse_to_drs_dict` usable headlessly.
 */

import { pyError } from "./internals";
import {
  ExpectedMoreTokensException,
  Expression,
  LogicalExpressionException,
  UnexpectedTokenException,
  Variable,
} from "./sem_logic";
import {
  DRS,
  DrtApplicationExpression,
  DrtEqualityExpression,
  DrtNegatedExpression,
  DrtOrExpression,
  DrtProposition,
  DrtVariableExpression,
} from "./drt";

// ---------------------------------------------------------------------------
// Tokenizer (mirrors nltk.sem.logic.LogicParser.process incl. quote_chars and
// the source-index mapping used by parse() for its caret error message).
// ---------------------------------------------------------------------------

const LEAF = "__leaf__";
type TrieNode = { [k: string]: TrieNode };

function buildTrie(symbols: string[]): TrieNode {
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

type QuoteSpec = [start: string, end: string, escape: string, inclQuotes: boolean];

abstract class BoxerParserBase {
  protected _currentIndex = 0;
  protected _buffer: string[] = [];
  private _parseDepth = 0;
  protected quoteChars: QuoteSpec[] = [];

  static MAX_PARSE_DEPTH = 200;

  abstract getAllSymbols(): string[];

  parse(data: string): unknown {
    data = data.replace(/\s+$/, "");
    this._currentIndex = 0;
    this._parseDepth = 0;
    const [buffer, mapping] = this.process(data);
    this._buffer = buffer;
    try {
      const result = this.processNextExpression(null);
      if (this.inRange(0)) throw new UnexpectedTokenException(this._currentIndex + 1, this.token(0));
      return result;
    } catch (e) {
      if (e instanceof LogicalExpressionException) {
        const idx = (e.index ?? 1) - 1;
        const caret = " ".repeat(mapping[idx] ?? 0) + "^";
        throw new LogicalExpressionException(null, `${e.message}\n${data}\n${caret}`);
      }
      throw e;
    }
  }

  /** Split the data into tokens; returns [tokens, index->sourcePos mapping]. */
  process(data: string): [string[], Record<number, number>] {
    const out: string[] = [];
    const mapping: Record<number, number> = {};
    const tokenTrie = buildTrie(this.getAllSymbols());
    let token = "";
    let dataIdx = 0;
    let tokenStartIdx = dataIdx;
    while (dataIdx < data.length) {
      const curDataIdx = dataIdx;
      const [quotedToken, nextIdx] = this.processQuotedToken(dataIdx, data);
      dataIdx = nextIdx;
      if (quotedToken) {
        if (!token) tokenStartIdx = curDataIdx;
        token += quotedToken;
        continue;
      }

      let st = tokenTrie;
      let c = data[dataIdx]!;
      let symbol = "";
      while (c in st) {
        symbol += c;
        st = st[c]!;
        if (data.length - dataIdx > symbol.length) c = data[dataIdx + symbol.length]!;
        else break;
      }
      if (LEAF in st) {
        if (token) {
          mapping[out.length] = tokenStartIdx;
          out.push(token);
          token = "";
        }
        mapping[out.length] = dataIdx;
        out.push(symbol);
        dataIdx += symbol.length;
      } else {
        const ch = data[dataIdx]!;
        if (ch === " " || ch === "\t" || ch === "\n") {
          if (token) {
            mapping[out.length] = tokenStartIdx;
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
      mapping[out.length] = tokenStartIdx;
      out.push(token);
    }
    mapping[out.length] = data.length;
    mapping[out.length + 1] = data.length + 1;
    return [out, mapping];
  }

  processQuotedToken(dataIdx: number, data: string): [string, number] {
    let token = "";
    const c = data[dataIdx]!;
    let i = dataIdx;
    for (const [start, end, escape, inclQuotes] of this.quoteChars) {
      if (c === start) {
        if (inclQuotes) token += c;
        i += 1;
        while (data[i] !== end) {
          if (i >= data.length) {
            // Python: data[i] raises IndexError once i runs off the end
            throw pyError("IndexError", "string index out of range");
          }
          if (data[i] === escape) {
            if (inclQuotes) token += data[i];
            i += 1;
            if (data.length === i) {
              throw new LogicalExpressionException(null, `End of input reached.  Escape character [${escape}] found at end.`);
            }
            token += data[i];
          } else {
            token += data[i];
          }
          i += 1;
          if (data.length === i) {
            throw new LogicalExpressionException(null, `End of input reached.  Expected: [${end}]`);
          }
        }
        if (inclQuotes) token += data[i];
        i += 1;
        if (!token) throw new LogicalExpressionException(null, "Empty quoted token found");
        break;
      }
    }
    return [token, i];
  }

  inRange(location: number): boolean {
    return this._currentIndex + location < this._buffer.length;
  }

  token(location?: number): string {
    const idx = location === undefined ? this._currentIndex : this._currentIndex + location;
    if (idx >= this._buffer.length || idx < 0) {
      throw new ExpectedMoreTokensException(this._currentIndex + 1);
    }
    if (location === undefined) this._currentIndex += 1;
    return this._buffer[idx]!;
  }

  processNextExpression(context: string | null): unknown {
    this._parseDepth += 1;
    try {
      if (this._parseDepth > BoxerParserBase.MAX_PARSE_DEPTH) {
        throw new LogicalExpressionException(
          this._currentIndex + 1,
          `Expression nesting exceeds the maximum depth (${BoxerParserBase.MAX_PARSE_DEPTH}).`,
        );
      }
      let tok: string;
      try {
        tok = this.token();
      } catch (e) {
        if (e instanceof ExpectedMoreTokensException) {
          throw new ExpectedMoreTokensException(this._currentIndex + 1, "Expression expected.");
        }
        throw e;
      }
      const accum = this.handle(tok, context);
      if (accum === undefined || accum === null) {
        throw new UnexpectedTokenException(this._currentIndex, tok, undefined, "Expression expected.");
      }
      return this.attemptAdjuncts(accum, context);
    } finally {
      this._parseDepth -= 1;
    }
  }

  process_next_expression(context: string | null): unknown {
    return this.processNextExpression(context);
  }

  abstract handle(tok: string, context: string | null): unknown;

  attemptAdjuncts(expression: unknown, _context: string | null): unknown {
    return expression;
  }

  attempt_adjuncts(expression: unknown, context: string | null): unknown {
    return this.attemptAdjuncts(expression, context);
  }

  assertNextToken(expected: string | string[]): void {
    let tok: string;
    try {
      tok = this.token();
    } catch (e) {
      if (e instanceof ExpectedMoreTokensException) {
        throw new ExpectedMoreTokensException(e.index, `Expected token '${expected}'.`);
      }
      throw e;
    }
    this.assertToken(tok, expected);
  }

  assertToken(tok: string, expected: string | string[]): void {
    if (Array.isArray(expected)) {
      if (!expected.includes(tok)) throw new UnexpectedTokenException(this._currentIndex, tok, expected.join(", "));
    } else if (tok !== expected) {
      throw new UnexpectedTokenException(this._currentIndex, tok, expected);
    }
  }

  getNextTokenVariable(_description: string): unknown {
    let tok: string;
    try {
      tok = this.token();
    } catch (e) {
      if (e instanceof ExpectedMoreTokensException) {
        throw new ExpectedMoreTokensException(e.index, "Variable expected.");
      }
      throw e;
    }
    return tok;
  }

  get_next_token_variable(description: string): unknown {
    return this.getNextTokenVariable(description);
  }

  /** nltk.sem.drt.DrtParser.handle_refs — "[x,y,z]" -> list of variables/tokens. */
  handleRefs(): unknown[] {
    this.assertNextToken("[");
    const refs: unknown[] = [];
    while (this.inRange(0) && this.token(0) !== "]") {
      if (refs.length && this.token(0) === ",") this.token(); // swallow ','
      refs.push(this.getNextTokenVariable("quantified"));
    }
    this.assertNextToken("]");
    return refs;
  }

  handle_refs(): unknown[] {
    return this.handleRefs();
  }
}

// ---------------------------------------------------------------------------
// AbstractBoxerDrs hierarchy
// ---------------------------------------------------------------------------

type VarTriple = [Set<string>, Set<string>, Set<string>];

/** Python %s of a float: integral floats print with a trailing ".0". */
function pyFloatStr(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : `${n}`;
}

/** %s formatting for a sent_index (floats from the prolog parser print as
 * floats; ints from the re-parse parser print bare). */
function sentIndexStr(n: number | null, isFloat: boolean): string {
  if (n === null) return "None";
  return isFloat ? pyFloatStr(n) : `${n}`;
}

function tripleUnion(...triples: VarTriple[]): VarTriple {
  const out: VarTriple = [new Set(), new Set(), new Set()];
  for (const t of triples) for (let i = 0; i < 3; i++) for (const v of t[i]!) out[i]!.add(v);
  return out;
}

/** Python set() semantics for atoms: deduplicate by hash(repr) + eq. */
function atomSet(list: AbstractBoxerDrs[]): AbstractBoxerDrs[] {
  const seen = new Set<string>();
  const out: AbstractBoxerDrs[] = [];
  for (const a of list) {
    const k = a.hashKey();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CPython float set-order emulation — used by _sent_and_word_indices, whose
// iteration order comes from CPython's set table probing (Objects/setobject.c)
// over _Py_HashDouble values.  Implemented with BigInt so cond ordering is
// byte-identical to the oracle even for multi-sentence index lists.
// ---------------------------------------------------------------------------

const PYHASH_BITS = 61n;
const PYHASH_MODULUS = (1n << PYHASH_BITS) - 1n;
const PERTURB_SHIFT = 5n;

function frexp(v: number): [number, number] {
  if (v === 0 || !Number.isFinite(v)) return [v, 0];
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, v);
  const bits = buf.getBigUint64(0);
  let e = Number((bits >> 52n) & 0x7ffn);
  if (e === 0) e = -1022; // subnormal
  else e -= 1022;
  return [v / 2 ** e, e];
}

/** CPython _Py_HashDouble for finite floats. */
function pyHashDouble(v: number): bigint {
  let [m, e] = frexp(v);
  let sign = 1n;
  if (m < 0) {
    sign = -1n;
    m = -m;
  }
  let x = 0n;
  while (m !== 0) {
    x = ((x << 28n) & PYHASH_MODULUS) | (x >> (PYHASH_BITS - 28n));
    m *= 268435456.0; // 2**28
    e -= 28;
    const y = BigInt(Math.trunc(m));
    m -= Number(y);
    x += y;
    if (x >= PYHASH_MODULUS) x -= PYHASH_MODULUS;
  }
  const eb = BigInt(e >= 0 ? e % 61 : 61 - 1 - ((-1 - e) % 61));
  x = ((x << eb) & PYHASH_MODULUS) | (x >> (PYHASH_BITS - eb));
  x = x * sign;
  if (x === -1n) x = -2n;
  return x;
}

/** Iterate a CPython set of floats in table order. `values` is the set
 *  comprehension's insertion sequence (deduplicated). */
function cpythonFloatSetOrder(values: number[]): number[] {
  let size = 8;
  let used = 0;
  let table: (number | null)[] = Array.from({ length: size }, () => null);

  const resize = () => {
    const old = table;
    const newSize = used > 50000 ? used * 2 : used * 4;
    size = Math.max(8, newSize);
    used = 0;
    table = Array.from({ length: size }, () => null);
    for (const v of old) if (v !== null) insert(v);
  };

  const insert = (v: number) => {
    const h = pyHashDouble(v);
    const mask = BigInt(size - 1);
    const LINEAR_PROBES = 9;
    let i = Number(h & mask);
    let perturb = h;
    for (;;) {
      let probes = i + LINEAR_PROBES <= size - 1 ? LINEAR_PROBES : 0;
      let j = i;
      for (;;) {
        if (table[j] === null) {
          table[j] = v;
          used++;
          if (used * 5 >= size * 3) resize();
          return;
        }
        if (table[j] === v) return;
        if (probes === 0) break;
        probes--;
        j++;
      }
      perturb >>= PERTURB_SHIFT;
      i = Number((BigInt(i) * 5n + 1n + perturb) & mask);
    }
  };

  for (const v of values) insert(v);
  return table.filter((v): v is number => v !== null);
}

function fieldEquals(a: unknown, b: unknown): boolean {
  if (a instanceof AbstractBoxerDrs || b instanceof AbstractBoxerDrs) {
    return a instanceof AbstractBoxerDrs && b instanceof AbstractBoxerDrs && a.equals(b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => fieldEquals(x, b[i]))
    );
  }
  return a === b;
}

export class AbstractBoxerDrs {
  /** :return: [set<variables>, set<events>, set<propositions>] */
  variables(): VarTriple {
    const [variables, events, propositions] = this._variables();
    const evOrProp = new Set([...events, ...propositions]);
    const varsMinus = new Set([...variables].filter((v) => !evOrProp.has(v)));
    const propMinus = new Set([...propositions].filter((v) => !events.has(v)));
    return [varsMinus, events, propMinus];
  }

  variableTypes(): Record<string, string> {
    const vartypes: Record<string, string> = {};
    const vars = this.variables();
    (["z", "e", "p"] as const).forEach((t, i) => {
      for (const v of vars[i]!) vartypes[v] = t;
    });
    return vartypes;
  }

  variable_types(): Record<string, string> {
    return this.variableTypes();
  }

  _variables(): VarTriple {
    return [new Set(), new Set(), new Set()];
  }

  atoms(): AbstractBoxerDrs[] {
    return [];
  }

  clean(): AbstractBoxerDrs {
    return this;
  }

  protected _cleanName(name: string): string {
    return name.replace(/-/g, "_").replace(/'/g, "_");
  }

  _clean_name(name: string): string {
    return this._cleanName(name);
  }

  renumberSentences(_f: (sentIndex: number | null) => number | null): AbstractBoxerDrs {
    return this;
  }

  renumber_sentences(f: (sentIndex: number | null) => number | null): AbstractBoxerDrs {
    return this.renumberSentences(f);
  }

  equals(_other: unknown): boolean {
    return false;
  }

  /** Python __hash__ == hash(repr(self)); expose repr as the key. */
  hashKey(): string {
    return this.toString();
  }
}

export class BoxerDrs extends AbstractBoxerDrs {
  refs: string[];
  conds: AbstractBoxerDrs[];
  consequent: AbstractBoxerDrs | null;

  constructor(refs: string[], conds: AbstractBoxerDrs[], consequent: AbstractBoxerDrs | null = null) {
    super();
    this.refs = refs;
    this.conds = conds;
    this.consequent = consequent;
  }

  override _variables(): VarTriple {
    const variables: VarTriple = [new Set(), new Set(), new Set()];
    for (const cond of this.conds) {
      const v = cond._variables();
      for (let i = 0; i < 3; i++) for (const x of v[i]!) variables[i]!.add(x);
    }
    if (this.consequent !== null) {
      const v = this.consequent._variables();
      for (let i = 0; i < 3; i++) for (const x of v[i]!) variables[i]!.add(x);
    }
    return variables;
  }

  override atoms(): AbstractBoxerDrs[] {
    const atoms: AbstractBoxerDrs[] = [];
    for (const cond of this.conds) atoms.push(...cond.atoms());
    if (this.consequent !== null) atoms.push(...this.consequent.atoms());
    return atomSet(atoms);
  }

  override clean(): BoxerDrs {
    const consequent = this.consequent ? (this.consequent.clean() as AbstractBoxerDrs) : null;
    return new BoxerDrs(this.refs, this.conds.map((c) => c.clean()), consequent);
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerDrs {
    const consequent = this.consequent ? (this.consequent.renumberSentences(f) as AbstractBoxerDrs) : null;
    return new BoxerDrs(this.refs, this.conds.map((c) => c.renumberSentences(f) as AbstractBoxerDrs), consequent);
  }

  override toString(): string {
    let s = `drs([${this.refs.join(", ")}], [${this.conds.map((c) => `${c}`).join(", ")}])`;
    if (this.consequent !== null) s = `imp(${s}, ${this.consequent})`;
    return s;
  }

  override equals(other: unknown): boolean {
    return (
      other instanceof BoxerDrs &&
      this.refs.length === other.refs.length &&
      this.refs.every((r, i) => r === other.refs[i]) &&
      this.conds.length === other.conds.length &&
      this.conds.every((c, i) => c.equals(other.conds[i])) &&
      fieldEquals(this.consequent, other.consequent)
    );
  }
}

export class BoxerNot extends AbstractBoxerDrs {
  drs: AbstractBoxerDrs;
  constructor(drs: AbstractBoxerDrs) {
    super();
    this.drs = drs;
  }
  override _variables(): VarTriple {
    return this.drs._variables();
  }
  override atoms(): AbstractBoxerDrs[] {
    return this.drs.atoms();
  }
  override clean(): BoxerNot {
    return new BoxerNot(this.drs.clean());
  }
  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerNot {
    return new BoxerNot(this.drs.renumberSentences(f) as AbstractBoxerDrs);
  }
  override toString(): string {
    return `not(${this.drs})`;
  }
  override equals(other: unknown): boolean {
    return other instanceof BoxerNot && this.drs.equals(other.drs);
  }
}

export class BoxerIndexed extends AbstractBoxerDrs {
  discourse_id: string | null;
  sent_index: number | null;
  word_indices: number[];
  /** Whether sent_index is a Python float (prolog parse) vs int (re-parse) —
   *  drives %s rendering ("0.0" vs "0"). */
  sentIndexFloat = false;

  constructor(discourseId: string | null, sentIndex: number | null, wordIndices: number[]) {
    super();
    this.discourse_id = discourseId;
    this.sent_index = sentIndex;
    this.word_indices = wordIndices;
  }

  override atoms(): AbstractBoxerDrs[] {
    return [this];
  }

  /** Python __iter__ — subclass-specific field tuple. */
  fields(): unknown[] {
    return [];
  }

  protected _pred(): string {
    return "";
  }

  /** Copy sentIndexFloat onto a freshly constructed sibling (clean/renumber
   *  keep Python float values, so the repr mode must survive too). */
  protected _clone<T extends BoxerIndexed>(x: T): T {
    x.sentIndexFloat = this.sentIndexFloat;
    return x;
  }

  override equals(other: unknown): boolean {
    if (other === null || other === undefined || other.constructor !== this.constructor) return false;
    const o = other as BoxerIndexed;
    if (this.discourse_id !== o.discourse_id) return false;
    if (this.sent_index !== o.sent_index) return false;
    if (!fieldEquals(this.word_indices, o.word_indices)) return false;
    const sf = this.fields();
    const of_ = o.fields();
    return sf.length === of_.length && sf.every((s, i) => fieldEquals(s, of_[i]));
  }

  override toString(): string {
    const discId = this.discourse_id === null ? "None" : `${this.discourse_id}`;
    let s = `${this._pred()}(${discId}, ${sentIndexStr(this.sent_index, this.sentIndexFloat)}, [${this.word_indices.join(", ")}]`;
    for (const v of this.fields()) s += `, ${v}`;
    return s + ")";
  }
}

export class BoxerPred extends BoxerIndexed {
  var: string;
  name: string;
  pos: string;
  sense: number;

  constructor(discourseId: string | null, sentIndex: number | null, wordIndices: number[], v: string, name: string, pos: string, sense: number) {
    super(discourseId, sentIndex, wordIndices);
    this.var = v;
    this.name = name;
    this.pos = pos;
    this.sense = sense;
  }

  override _variables(): VarTriple {
    return [new Set([this.var]), new Set(), new Set()];
  }

  changeVar(v: string): BoxerPred {
    return this._clone(new BoxerPred(this.discourse_id, this.sent_index, this.word_indices, v, this.name, this.pos, this.sense));
  }

  change_var(v: string): BoxerPred {
    return this.changeVar(v);
  }

  override clean(): BoxerPred {
    return this._clone(new BoxerPred(this.discourse_id, this.sent_index, this.word_indices, this.var, this._cleanName(this.name), this.pos, this.sense));
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerPred {
    return this._clone(new BoxerPred(this.discourse_id, f(this.sent_index), this.word_indices, this.var, this.name, this.pos, this.sense));
  }

  override fields(): unknown[] {
    return [this.var, this.name, this.pos, this.sense];
  }

  protected override _pred(): string {
    return "pred";
  }
}

export class BoxerNamed extends BoxerIndexed {
  var: string;
  name: string;
  type: string;
  sense: string;

  constructor(discourseId: string | null, sentIndex: number | null, wordIndices: number[], v: string, name: string, type: string, sense: string) {
    super(discourseId, sentIndex, wordIndices);
    this.var = v;
    this.name = name;
    this.type = type;
    this.sense = sense;
  }

  override _variables(): VarTriple {
    return [new Set([this.var]), new Set(), new Set()];
  }

  changeVar(v: string): BoxerNamed {
    return this._clone(new BoxerNamed(this.discourse_id, this.sent_index, this.word_indices, v, this.name, this.type, this.sense));
  }

  change_var(v: string): BoxerNamed {
    return this.changeVar(v);
  }

  override clean(): BoxerNamed {
    return this._clone(new BoxerNamed(this.discourse_id, this.sent_index, this.word_indices, this.var, this._cleanName(this.name), this.type, this.sense));
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerNamed {
    return this._clone(new BoxerNamed(this.discourse_id, f(this.sent_index), this.word_indices, this.var, this.name, this.type, this.sense));
  }

  override fields(): unknown[] {
    return [this.var, this.name, this.type, this.sense];
  }

  protected override _pred(): string {
    return "named";
  }
}

export class BoxerRel extends BoxerIndexed {
  var1: string;
  var2: string;
  rel: string;
  sense: number;

  constructor(discourseId: string | null, sentIndex: number | null, wordIndices: number[], var1: string, var2: string, rel: string, sense: number) {
    super(discourseId, sentIndex, wordIndices);
    this.var1 = var1;
    this.var2 = var2;
    this.rel = rel;
    this.sense = sense;
  }

  override _variables(): VarTriple {
    return [new Set([this.var1, this.var2]), new Set(), new Set()];
  }

  override clean(): BoxerRel {
    return this._clone(new BoxerRel(this.discourse_id, this.sent_index, this.word_indices, this.var1, this.var2, this._cleanName(this.rel), this.sense));
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerRel {
    return this._clone(new BoxerRel(this.discourse_id, f(this.sent_index), this.word_indices, this.var1, this.var2, this.rel, this.sense));
  }

  override fields(): unknown[] {
    return [this.var1, this.var2, this.rel, this.sense];
  }

  protected override _pred(): string {
    return "rel";
  }
}

export class BoxerProp extends BoxerIndexed {
  var: string;
  drs: AbstractBoxerDrs;

  constructor(discourseId: string | null, sentIndex: number | null, wordIndices: number[], v: string, drs: AbstractBoxerDrs) {
    super(discourseId, sentIndex, wordIndices);
    this.var = v;
    this.drs = drs;
  }

  override _variables(): VarTriple {
    return tripleUnion([new Set(), new Set(), new Set([this.var])], this.drs._variables());
  }

  referencedLabels(): AbstractBoxerDrs[] {
    return [this.drs];
  }

  referenced_labels(): AbstractBoxerDrs[] {
    return this.referencedLabels();
  }

  override atoms(): AbstractBoxerDrs[] {
    return this.drs.atoms();
  }

  override clean(): BoxerProp {
    return this._clone(new BoxerProp(this.discourse_id, this.sent_index, this.word_indices, this.var, this.drs.clean()));
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerProp {
    return this._clone(new BoxerProp(this.discourse_id, f(this.sent_index), this.word_indices, this.var, this.drs.renumberSentences(f) as AbstractBoxerDrs));
  }

  override fields(): unknown[] {
    return [this.var, this.drs];
  }

  protected override _pred(): string {
    return "prop";
  }
}

export class BoxerEq extends BoxerIndexed {
  var1: string;
  var2: string;

  constructor(discourseId: string | null, sentIndex: number | null, wordIndices: number[], var1: string, var2: string) {
    super(discourseId, sentIndex, wordIndices);
    this.var1 = var1;
    this.var2 = var2;
  }

  override _variables(): VarTriple {
    return [new Set([this.var1, this.var2]), new Set(), new Set()];
  }

  override atoms(): AbstractBoxerDrs[] {
    return [];
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerEq {
    return this._clone(new BoxerEq(this.discourse_id, f(this.sent_index), this.word_indices, this.var1, this.var2));
  }

  override fields(): unknown[] {
    return [this.var1, this.var2];
  }

  protected override _pred(): string {
    return "eq";
  }
}

export class BoxerCard extends BoxerIndexed {
  var: string;
  value: string;
  type: string;

  constructor(discourseId: string | null, sentIndex: number | null, wordIndices: number[], v: string, value: string, type: string) {
    super(discourseId, sentIndex, wordIndices);
    this.var = v;
    this.value = value;
    this.type = type;
  }

  override _variables(): VarTriple {
    return [new Set([this.var]), new Set(), new Set()];
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerCard {
    return this._clone(new BoxerCard(this.discourse_id, f(this.sent_index), this.word_indices, this.var, this.value, this.type));
  }

  override fields(): unknown[] {
    return [this.var, this.value, this.type];
  }

  protected override _pred(): string {
    return "card";
  }
}

export class BoxerOr extends BoxerIndexed {
  drs1: AbstractBoxerDrs;
  drs2: AbstractBoxerDrs;

  constructor(discourseId: string | null, sentIndex: number | null, wordIndices: number[], drs1: AbstractBoxerDrs, drs2: AbstractBoxerDrs) {
    super(discourseId, sentIndex, wordIndices);
    this.drs1 = drs1;
    this.drs2 = drs2;
  }

  override _variables(): VarTriple {
    return tripleUnion(this.drs1._variables(), this.drs2._variables());
  }

  override atoms(): AbstractBoxerDrs[] {
    return atomSet([...this.drs1.atoms(), ...this.drs2.atoms()]);
  }

  override clean(): BoxerOr {
    return this._clone(new BoxerOr(this.discourse_id, this.sent_index, this.word_indices, this.drs1.clean(), this.drs2.clean()));
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerOr {
    return this._clone(new BoxerOr(this.discourse_id, f(this.sent_index), this.word_indices, this.drs1, this.drs2));
  }

  override fields(): unknown[] {
    return [this.drs1, this.drs2];
  }

  protected override _pred(): string {
    return "or";
  }
}

export class BoxerWhq extends BoxerIndexed {
  ans_types: string[];
  drs1: AbstractBoxerDrs;
  variable: string;
  drs2: AbstractBoxerDrs;

  constructor(
    discourseId: string | null,
    sentIndex: number | null,
    wordIndices: number[],
    ansTypes: string[],
    drs1: AbstractBoxerDrs,
    variable: string,
    drs2: AbstractBoxerDrs,
  ) {
    super(discourseId, sentIndex, wordIndices);
    this.ans_types = ansTypes;
    this.drs1 = drs1;
    this.variable = variable;
    this.drs2 = drs2;
  }

  override _variables(): VarTriple {
    // Python: tuple(map(operator.or_, ({v}, set(), set()), drs1._variables(), drs2._variables())).
    // map with 3 iterables calls the binary operator.or_ with 3 args → TypeError on every whq/duplex.
    throw pyError("TypeError", "or_ expected 2 arguments, got 3");
  }

  override atoms(): AbstractBoxerDrs[] {
    return atomSet([...this.drs1.atoms(), ...this.drs2.atoms()]);
  }

  override clean(): BoxerWhq {
    return this._clone(new BoxerWhq(this.discourse_id, this.sent_index, this.word_indices, this.ans_types, this.drs1.clean(), this.variable, this.drs2.clean()));
  }

  override renumberSentences(f: (sentIndex: number | null) => number | null): BoxerWhq {
    return this._clone(new BoxerWhq(this.discourse_id, f(this.sent_index), this.word_indices, this.ans_types, this.drs1, this.variable, this.drs2));
  }

  override fields(): unknown[] {
    return ["[" + this.ans_types.join(",") + "]", this.drs1, this.variable, this.drs2];
  }

  protected override _pred(): string {
    return "whq";
  }
}

// ---------------------------------------------------------------------------
// BoxerOutputDrsParser — parse Boxer's Prolog-format DRS output.
// ---------------------------------------------------------------------------

type CondFactory = (sentIndex: number | null, wordIndices: number[]) => AbstractBoxerDrs;
type SentWordPair = [sentIndex: number | null, wordIndices: number[]];

const BOXER_OUTPUT_SYMBOLS = ["(", ")", ",", "[", "]", ":"];

export class BoxerOutputDrsParser extends BoxerParserBase {
  discourse_id: string | null;
  sentence_id_offset: number | null;

  constructor(discourseId: string | null = null) {
    super();
    this.discourse_id = discourseId;
    this.sentence_id_offset = null;
    this.quoteChars = [["'", "'", "\\", false]];
  }

  override getAllSymbols(): string[] {
    return BOXER_OUTPUT_SYMBOLS;
  }

  get_all_symbols(): string[] {
    return this.getAllSymbols();
  }

  override handle(tok: string, _context: string | null): unknown {
    return this.handleDrs(tok);
  }

  parseCondition(indices: number[]): AbstractBoxerDrs[] {
    const tok = this.token();
    const accum = this.handleCondition(tok, indices);
    // QUIRK: the oracle raises UnexpectedTokenException(tok) — the token lands
    // in the `index` slot.
    if (accum === null) throw new UnexpectedTokenException(tok as unknown as number);
    return accum;
  }

  parse_condition(indices: number[]): AbstractBoxerDrs[] {
    return this.parseCondition(indices);
  }

  handleDrs(tok: string): unknown {
    if (tok === "drs") return this.parseDrs();
    if (tok === "merge" || tok === "smerge") {
      return (this._handleBinaryExpression((si, wi, d1, d2) => this._makeMergeExpression(si, wi, d1, d2)))(null, []);
    }
    if (tok === "alfa") {
      return (this._handleAlfa((si, wi, d1, d2) => this._makeMergeExpression(si, wi, d1, d2)))(null, []);
    }
    return undefined;
  }

  handle_drs(tok: string): unknown {
    return this.handleDrs(tok);
  }

  handleCondition(tok: string, indices: number[]): AbstractBoxerDrs[] | null {
    let conds: (CondFactory | null)[];
    if (tok === "not") return [this._handleNot()];
    if (tok === "or") conds = [this._handleBinaryExpression((si, wi, d1, d2) => this._makeOrExpression(si, wi, d1, d2))];
    else if (tok === "imp") conds = [this._handleBinaryExpression((si, wi, d1, d2) => this._makeImpExpression(si, wi, d1, d2))];
    else if (tok === "eq") conds = [this._handleEq()];
    else if (tok === "prop") conds = [this._handleProp()];
    else if (tok === "pred") conds = [this._handlePred()];
    else if (tok === "named") conds = [this._handleNamed()];
    else if (tok === "rel") conds = [this._handleRel()];
    else if (tok === "timex") conds = this._handleTimex();
    else if (tok === "card") conds = [this._handleCard()];
    else if (tok === "whq") conds = [this._handleWhq()];
    else if (tok === "duplex") conds = [this._handleDuplex()];
    else conds = [];

    // sum(([cond(si, wi) for cond in conds] for si, wi in pairs), [])
    // — pair-major iteration, matching the oracle's cond ordering.
    const out: AbstractBoxerDrs[] = [];
    for (const [sentIndex, wordIndices] of this._sentAndWordIndices(indices)) {
      for (const cond of conds) {
        // cond is null only via the timex/None path; calling None mirrors the
        // Python TypeError for a non-date/time timex body.
        if (cond === null) throw pyError("TypeError", "'NoneType' object is not callable");
        const c = cond(sentIndex, wordIndices);
        if (c instanceof BoxerIndexed) c.sentIndexFloat = true;
        out.push(c);
      }
    }
    return out;
  }

  handle_condition(tok: string, indices: number[]): AbstractBoxerDrs[] | null {
    return this.handleCondition(tok, indices);
  }

  private _handleNot(): BoxerNot {
    this.assertToken(this.token(), "(");
    const drs = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ")");
    return new BoxerNot(drs);
  }

  private _handlePred(): CondFactory {
    // pred(_G3943, dog, n, 0)
    this.assertToken(this.token(), "(");
    const variable = this.parseVariable();
    this.assertToken(this.token(), ",");
    const name = this.token();
    this.assertToken(this.token(), ",");
    const pos = this.token();
    this.assertToken(this.token(), ",");
    const sense = parseInt(this.token(), 10);
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => new BoxerPred(this.discourse_id, sentIndex, wordIndices, variable, name, pos, sense);
  }

  private _handleDuplex(): CondFactory {
    // duplex(whq, drs(...), var, drs(...))
    this.assertToken(this.token(), "(");
    const ansTypes: string[] = [];
    this.assertToken(this.token(), "whq");
    this.assertToken(this.token(), ",");
    const d1 = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ",");
    const ref = this.parseVariable();
    this.assertToken(this.token(), ",");
    const d2 = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => new BoxerWhq(this.discourse_id, sentIndex, wordIndices, ansTypes, d1, ref, d2);
  }

  private _handleNamed(): CondFactory {
    // named(x0, john, per, 0)
    this.assertToken(this.token(), "(");
    const variable = this.parseVariable();
    this.assertToken(this.token(), ",");
    const name = this.token();
    this.assertToken(this.token(), ",");
    const type = this.token();
    this.assertToken(this.token(), ",");
    const sense = this.token(); // as per boxer rev 2554
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => new BoxerNamed(this.discourse_id, sentIndex, wordIndices, variable, name, type, sense);
  }

  private _handleRel(): CondFactory {
    // rel(_G3993, _G3943, agent, 0)
    this.assertToken(this.token(), "(");
    const var1 = this.parseVariable();
    this.assertToken(this.token(), ",");
    const var2 = this.parseVariable();
    this.assertToken(this.token(), ",");
    const rel = this.token();
    this.assertToken(this.token(), ",");
    const sense = parseInt(this.token(), 10);
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => new BoxerRel(this.discourse_id, sentIndex, wordIndices, var1, var2, rel, sense);
  }

  private _handleTimex(): (CondFactory | null)[] {
    // timex(_G18322, date([]: (+), []:'XXXX', [1004]:'04', []:'XX'))
    this.assertToken(this.token(), "(");
    const arg = this.parseVariable();
    this.assertToken(this.token(), ",");
    const newConds = this._handleTimeExpression(arg);
    this.assertToken(this.token(), ")");
    return newConds;
  }

  private _handleTimeExpression(arg: string): (CondFactory | null)[] {
    // date([]: (+), []:'XXXX', [1004]:'04', []:'XX')
    const tok = this.token();
    this.assertToken(this.token(), "(");
    let conds: AbstractBoxerDrs[] | null;
    if (tok === "date") conds = this._handleDate(arg);
    else if (tok === "time") conds = this._handleTime(arg);
    else return null as unknown as (CondFactory | null)[];
    this.assertToken(this.token(), ")");

    const funcGen = (x: AbstractBoxerDrs): CondFactory => () => x;
    return [
      (sentIndex: number | null, wordIndices: number[]) => new BoxerPred(this.discourse_id, sentIndex, wordIndices, arg, tok, "n", 0),
      ...conds!.map((cond) => funcGen(cond)),
    ];
  }

  private _handleDate(arg: string): AbstractBoxerDrs[] {
    // []: (+), []:'XXXX', [1004]:'04', []:'XX'
    const conds: AbstractBoxerDrs[] = [];

    const pair1 = this._sentAndWordIndices(this._parseIndexList());
    if (pair1.length !== 1) throw pyError("ValueError", "too many values to unpack (expected 1)");
    const [sentIndex1, wordIndices1] = pair1[0]!;
    this.assertToken(this.token(), "(");
    const pol = this.token();
    this.assertToken(this.token(), ")");
    conds.push(new BoxerPred(this.discourse_id, sentIndex1, wordIndices1, arg, `date_pol_${pol}`, "a", 0));
    this.assertToken(this.token(), ",");

    const pair2 = this._sentAndWordIndices(this._parseIndexList());
    if (pair2.length !== 1) throw pyError("ValueError", "too many values to unpack (expected 1)");
    const [sentIndex2, wordIndices2] = pair2[0]!;
    let year = this.token();
    if (year !== "XXXX") {
      year = year.replace(/:/g, "_");
      conds.push(new BoxerPred(this.discourse_id, sentIndex2, wordIndices2, arg, `date_year_${year}`, "a", 0));
    }
    this.assertToken(this.token(), ",");

    const pair3 = this._sentAndWordIndices(this._parseIndexList());
    if (pair3.length !== 1) throw pyError("ValueError", "too many values to unpack (expected 1)");
    const [sentIndex3, wordIndices3] = pair3[0]!;
    const month = this.token();
    if (month !== "XX") {
      conds.push(new BoxerPred(this.discourse_id, sentIndex3, wordIndices3, arg, `date_month_${month}`, "a", 0));
    }
    this.assertToken(this.token(), ",");

    const pair4 = this._sentAndWordIndices(this._parseIndexList());
    if (pair4.length !== 1) throw pyError("ValueError", "too many values to unpack (expected 1)");
    const [sentIndex4, wordIndices4] = pair4[0]!;
    const day = this.token();
    if (day !== "XX") {
      conds.push(new BoxerPred(this.discourse_id, sentIndex4, wordIndices4, arg, `date_day_${day}`, "a", 0));
    }

    return conds;
  }

  private _handleTime(arg: string): AbstractBoxerDrs[] {
    // time([1018]:'18', []:'XX', []:'XX')
    const conds: AbstractBoxerDrs[] = [];
    this._parseIndexList();
    const hour = this.token();
    if (hour !== "XX") conds.push(this._makeAtom("r_hour_2", arg, hour));
    this.assertToken(this.token(), ",");

    this._parseIndexList();
    const min = this.token();
    if (min !== "XX") conds.push(this._makeAtom("r_min_2", arg, min));
    this.assertToken(this.token(), ",");

    this._parseIndexList();
    const sec = this.token();
    if (sec !== "XX") conds.push(this._makeAtom("r_sec_2", arg, sec));

    return conds;
  }

  /** QUIRK: nltk.sem.boxer._handle_time calls self._make_atom which does not
   * exist on the parser — Python raises AttributeError when the hour/min/sec
   * token is not 'XX'. */
  private _makeAtom(_name: string, _arg: string, _value: string): never {
    throw pyError("AttributeError", "'BoxerOutputDrsParser' object has no attribute '_make_atom'");
  }

  private _handleCard(): CondFactory {
    // card(_G18535, 28, ge)
    this.assertToken(this.token(), "(");
    const variable = this.parseVariable();
    this.assertToken(this.token(), ",");
    const value = this.token();
    this.assertToken(this.token(), ",");
    const type = this.token();
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => new BoxerCard(this.discourse_id, sentIndex, wordIndices, variable, value, type);
  }

  private _handleProp(): CondFactory {
    // prop(_G15949, drs(...))
    this.assertToken(this.token(), "(");
    const variable = this.parseVariable();
    this.assertToken(this.token(), ",");
    const drs = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => new BoxerProp(this.discourse_id, sentIndex, wordIndices, variable, drs);
  }

  private _parseIndexList(): number[] {
    // [1001,1002]:
    const indices: number[] = [];
    this.assertToken(this.token(), "[");
    while (this.token(0) !== "]") {
      indices.push(this.parseIndex());
      if (this.token(0) === ",") this.token(); // swallow ','
    }
    this.token(); // swallow ']'
    this.assertToken(this.token(), ":");
    return indices;
  }

  parseIndexList(): number[] {
    return this._parseIndexList();
  }

  parseDrs(): BoxerDrs {
    // drs([[1001]:_G3943],
    //    [[1002]:pred(_G3943, dog, n, 0)]
    //   )
    this.assertToken(this.token(), "(");
    this.assertToken(this.token(), "[");
    const refs = new Set<string>();
    while (this.token(0) !== "]") {
      this._parseIndexList();
      refs.add(this.parseVariable());
      if (this.token(0) === ",") this.token(); // swallow ','
    }
    this.token(); // swallow ']'
    this.assertToken(this.token(), ",");
    this.assertToken(this.token(), "[");
    const conds: AbstractBoxerDrs[] = [];
    while (this.token(0) !== "]") {
      const indices = this._parseIndexList();
      conds.push(...this.parseCondition(indices));
      if (this.token(0) === ",") this.token(); // swallow ','
    }
    this.token(); // swallow ']'
    this.assertToken(this.token(), ")");
    return new BoxerDrs([...refs], conds);
  }

  parse_drs(): BoxerDrs {
    return this.parseDrs();
  }

  private _handleBinaryExpression(makeCallback: (si: number | null, wi: number[], d1: AbstractBoxerDrs, d2: AbstractBoxerDrs) => AbstractBoxerDrs): CondFactory {
    this.assertToken(this.token(), "(");
    const drs1 = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ",");
    const drs2 = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => makeCallback(sentIndex, wordIndices, drs1, drs2);
  }

  private _handleAlfa(makeCallback: (si: number | null, wi: number[], d1: AbstractBoxerDrs, d2: AbstractBoxerDrs) => AbstractBoxerDrs): CondFactory {
    this.assertToken(this.token(), "(");
    this.token(); // type — discarded, as in the oracle
    this.assertToken(this.token(), ",");
    const drs1 = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ",");
    const drs2 = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => makeCallback(sentIndex, wordIndices, drs1, drs2);
  }

  private _handleEq(): CondFactory {
    this.assertToken(this.token(), "(");
    const var1 = this.parseVariable();
    this.assertToken(this.token(), ",");
    const var2 = this.parseVariable();
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => new BoxerEq(this.discourse_id, sentIndex, wordIndices, var1, var2);
  }

  private _handleWhq(): CondFactory {
    this.assertToken(this.token(), "(");
    this.assertToken(this.token(), "[");
    const ansTypes: string[] = [];
    while (this.token(0) !== "]") {
      const cat = this.token();
      this.assertToken(this.token(), ":");
      if (cat === "des") {
        ansTypes.push(this.token());
      } else if (cat === "num") {
        ansTypes.push("number");
        const typ = this.token();
        if (typ === "cou") ansTypes.push("count");
        else ansTypes.push(typ);
      } else {
        ansTypes.push(this.token());
      }
    }
    this.token(); // swallow the ']'

    this.assertToken(this.token(), ",");
    const d1 = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ",");
    const ref = this.parseVariable();
    this.assertToken(this.token(), ",");
    const d2 = this.processNextExpression(null) as AbstractBoxerDrs;
    this.assertToken(this.token(), ")");
    return (sentIndex, wordIndices) => new BoxerWhq(this.discourse_id, sentIndex, wordIndices, ansTypes, d1, ref, d2);
  }

  private _makeMergeExpression(_sentIndex: number | null, _wordIndices: number[], drs1: AbstractBoxerDrs, drs2: AbstractBoxerDrs): BoxerDrs {
    const d1 = drs1 as BoxerDrs;
    const d2 = drs2 as BoxerDrs;
    return new BoxerDrs([...d1.refs, ...d2.refs], [...d1.conds, ...d2.conds]);
  }

  private _makeOrExpression(sentIndex: number | null, wordIndices: number[], drs1: AbstractBoxerDrs, drs2: AbstractBoxerDrs): BoxerOr {
    return new BoxerOr(this.discourse_id, sentIndex, wordIndices, drs1, drs2);
  }

  private _makeImpExpression(_sentIndex: number | null, _wordIndices: number[], drs1: AbstractBoxerDrs, drs2: AbstractBoxerDrs): BoxerDrs {
    const d1 = drs1 as BoxerDrs;
    return new BoxerDrs(d1.refs, d1.conds, drs2);
  }

  parseVariable(): string {
    const v = this.token();
    if (!/^[exps]\d+$/.test(v)) throw pyError("AssertionError", v);
    return v;
  }

  parse_variable(): string {
    return this.parseVariable();
  }

  parseIndex(): number {
    return parseInt(this.token(), 10);
  }

  parse_index(): number {
    return this.parseIndex();
  }

  _sentAndWordIndices(indices: number[]): SentWordPair[] {
    // sent_indices = {(i / 1000) - 1 for i in indices if i >= 0}
    const seen = new Set<number>();
    const uniq: number[] = [];
    for (const i of indices) {
      if (i >= 0) {
        const si = i / 1000 - 1;
        if (!seen.has(si)) {
          seen.add(si);
          uniq.push(si);
        }
      }
    }
    if (uniq.length) {
      const pairs: SentWordPair[] = [];
      for (const sentIndex of cpythonFloatSetOrder(uniq)) {
        const wordIndices = indices.filter((i) => sentIndex === i / 1000 - 1).map((i) => i % 1000 - 1);
        pairs.push([sentIndex, wordIndices]);
      }
      return pairs;
    }
    // word_indices = [(i % 1000) - 1 for i in indices] — Python-style modulo
    const wordIndices = indices.map((i) => ((i % 1000) + 1000) % 1000 - 1);
    return [[null, wordIndices]];
  }

  _sent_and_word_indices(indices: number[]): SentWordPair[] {
    return this._sentAndWordIndices(indices);
  }
}

// ---------------------------------------------------------------------------
// BoxerDrsParser — re-parse the repr() form of the AbstractBoxerDrs objects.
// ---------------------------------------------------------------------------

export class BoxerDrsParser extends BoxerParserBase {
  discourse_id: string | null;

  constructor(discourseId: string | null = null) {
    super();
    this.discourse_id = discourseId;
  }

  override getAllSymbols(): string[] {
    return ["(", ")", ",", "[", "]"];
  }

  get_all_symbols(): string[] {
    return this.getAllSymbols();
  }

  override handle(tok: string, _context: string | null): unknown {
    try {
      if (tok === "pred") {
        this.assertNextToken("(");
        const discId = this.discourse_id !== null ? this.discourse_id : this.token();
        this.assertNextToken(",");
        const sentId = this.nullableIntToken();
        this.assertNextToken(",");
        const wordIds = this.handleRefs().map((v) => parseInt(v as string, 10));
        this.assertNextToken(",");
        const variable = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const name = this.token();
        this.assertNextToken(",");
        const pos = this.token();
        this.assertNextToken(",");
        const sense = parseInt(this.token(), 10);
        this.assertNextToken(")");
        return new BoxerPred(discId, sentId, wordIds, variable as unknown as string, name, pos, sense);
      } else if (tok === "named") {
        this.assertNextToken("(");
        const discId = this.discourse_id !== null ? this.discourse_id : this.token();
        this.assertNextToken(",");
        const sentId = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const wordIds = this.handleRefs().map((v) => parseInt(v as string, 10));
        this.assertNextToken(",");
        const variable = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const name = this.token();
        this.assertNextToken(",");
        const type = this.token();
        this.assertNextToken(",");
        const sense = parseInt(this.token(), 10);
        this.assertNextToken(")");
        return new BoxerNamed(discId, sentId, wordIds, variable as unknown as string, name, type, sense as unknown as string);
      } else if (tok === "rel") {
        this.assertNextToken("(");
        const discId = this.discourse_id !== null ? this.discourse_id : this.token();
        this.assertNextToken(",");
        const sentId = this.nullableIntToken();
        this.assertNextToken(",");
        const wordIds = this.handleRefs().map((v) => parseInt(v as string, 10));
        this.assertNextToken(",");
        const var1 = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const var2 = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const rel = this.token();
        this.assertNextToken(",");
        const sense = parseInt(this.token(), 10);
        this.assertNextToken(")");
        return new BoxerRel(discId, sentId, wordIds, var1 as unknown as string, var2 as unknown as string, rel, sense);
      } else if (tok === "prop") {
        this.assertNextToken("(");
        const discId = this.discourse_id !== null ? this.discourse_id : this.token();
        this.assertNextToken(",");
        const sentId = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const wordIds = this.handleRefs().map((v) => parseInt(v as string, 10));
        this.assertNextToken(",");
        const variable = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const drs = this.processNextExpression(null) as AbstractBoxerDrs;
        this.assertNextToken(")");
        return new BoxerProp(discId, sentId, wordIds, variable as unknown as string, drs);
      } else if (tok === "not") {
        this.assertNextToken("(");
        const drs = this.processNextExpression(null) as AbstractBoxerDrs;
        this.assertNextToken(")");
        return new BoxerNot(drs);
      } else if (tok === "imp") {
        this.assertNextToken("(");
        const drs1 = this.processNextExpression(null) as BoxerDrs;
        this.assertNextToken(",");
        const drs2 = this.processNextExpression(null) as AbstractBoxerDrs;
        this.assertNextToken(")");
        return new BoxerDrs(drs1.refs, drs1.conds, drs2);
      } else if (tok === "or") {
        this.assertNextToken("(");
        const discId = this.discourse_id !== null ? this.discourse_id : this.token();
        this.assertNextToken(",");
        const sentId = this.nullableIntToken();
        this.assertNextToken(",");
        const wordIds = this.handleRefs().map((v) => parseInt(v as string, 10));
        this.assertNextToken(",");
        const drs1 = this.processNextExpression(null) as AbstractBoxerDrs;
        this.assertNextToken(",");
        const drs2 = this.processNextExpression(null) as AbstractBoxerDrs;
        this.assertNextToken(")");
        return new BoxerOr(discId, sentId, wordIds as unknown as number[], drs1, drs2);
      } else if (tok === "eq") {
        this.assertNextToken("(");
        const discId = this.discourse_id !== null ? this.discourse_id : this.token();
        this.assertNextToken(",");
        const sentId = this.nullableIntToken();
        this.assertNextToken(",");
        const wordIds = this.handleRefs().map((v) => parseInt(v as string, 10));
        this.assertNextToken(",");
        const var1 = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const var2 = parseInt(this.token(), 10);
        this.assertNextToken(")");
        return new BoxerEq(discId, sentId, wordIds, var1 as unknown as string, var2 as unknown as string);
      } else if (tok === "card") {
        this.assertNextToken("(");
        const discId = this.discourse_id !== null ? this.discourse_id : this.token();
        this.assertNextToken(",");
        const sentId = this.nullableIntToken();
        this.assertNextToken(",");
        const wordIds = this.handleRefs().map((v) => parseInt(v as string, 10));
        this.assertNextToken(",");
        const v = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const value = this.token();
        this.assertNextToken(",");
        const type = this.token();
        this.assertNextToken(")");
        return new BoxerCard(discId, sentId, wordIds, v as unknown as string, value, type);
      } else if (tok === "whq") {
        this.assertNextToken("(");
        const discId = this.discourse_id !== null ? this.discourse_id : this.token();
        this.assertNextToken(",");
        const sentId = this.nullableIntToken();
        this.assertNextToken(",");
        const wordIds = this.handleRefs().map((v) => parseInt(v as string, 10));
        this.assertNextToken(",");
        const ansTypes = this.handleRefs() as string[];
        this.assertNextToken(",");
        const drs1 = this.processNextExpression(null) as AbstractBoxerDrs;
        this.assertNextToken(",");
        const variable = parseInt(this.token(), 10);
        this.assertNextToken(",");
        const drs2 = this.processNextExpression(null) as AbstractBoxerDrs;
        this.assertNextToken(")");
        return new BoxerWhq(discId, sentId, wordIds, ansTypes, drs1, variable as unknown as string, drs2);
      }
    } catch (e) {
      if (e instanceof Error) {
        throw new LogicalExpressionException(this._currentIndex, e.message);
      }
      throw e;
    }
    throw pyError("AssertionError", `'${tok}'`);
  }

  nullableIntToken(): number | null {
    const t = this.token();
    return t !== "None" ? parseInt(t, 10) : null;
  }
}

// ---------------------------------------------------------------------------
// Interpreters
// ---------------------------------------------------------------------------

/** Python's `DrtProposition.__str__` prints `prop(p1, drs)`; the shared
 *  drt.ts class renders SDRS-style `p1:drs`, so the interpreter emits this
 *  subclass to keep oracle parity. */
class BoxerDrtProposition extends DrtProposition {
  override str(): string {
    return `prop(${this.variable.name}, ${this.drs.str()})`;
  }
}

export class PassthroughBoxerDrsInterpreter {
  interpret(ex: AbstractBoxerDrs): AbstractBoxerDrs {
    return ex;
  }
}

export class NltkDrtBoxerDrsInterpreter {
  private _occur_index: boolean;

  constructor(occurIndex = false) {
    this._occur_index = occurIndex;
  }

  interpret(ex: AbstractBoxerDrs): Expression {
    if (ex instanceof BoxerDrs) {
      const drs = new DRS(ex.refs.map((r) => new Variable(r)), ex.conds.map((c) => this.interpret(c)), null);
      if (ex.consequent !== null) drs.consequent = this.interpret(ex.consequent);
      return drs;
    } else if (ex instanceof BoxerNot) {
      return new DrtNegatedExpression(this.interpret(ex.drs));
    } else if (ex instanceof BoxerPred) {
      const pred = this._addOccurIndexing(`${ex.pos}_${ex.name}`, ex);
      return this._makeAtom(pred, ex.var);
    } else if (ex instanceof BoxerNamed) {
      const pred = this._addOccurIndexing(`ne_${ex.type}_${ex.name}`, ex);
      return this._makeAtom(pred, ex.var);
    } else if (ex instanceof BoxerRel) {
      const pred = this._addOccurIndexing(`${ex.rel}`, ex);
      return this._makeAtom(pred, ex.var1, ex.var2);
    } else if (ex instanceof BoxerProp) {
      return new BoxerDrtProposition(new Variable(ex.var), this.interpret(ex.drs));
    } else if (ex instanceof BoxerEq) {
      return new DrtEqualityExpression(
        DrtVariableExpression(new Variable(ex.var1)),
        DrtVariableExpression(new Variable(ex.var2)),
      );
    } else if (ex instanceof BoxerCard) {
      const pred = this._addOccurIndexing(`card_${ex.type}_${ex.value}`, ex);
      return this._makeAtom(pred, ex.var);
    } else if (ex instanceof BoxerOr) {
      return new DrtOrExpression(this.interpret(ex.drs1), this.interpret(ex.drs2));
    } else if (ex instanceof BoxerWhq) {
      const drs1 = this.interpret(ex.drs1) as DRS;
      const drs2 = this.interpret(ex.drs2) as DRS;
      return new DRS([...drs1.refs, ...drs2.refs], [...drs1.conds, ...drs2.conds], null);
    }
    throw pyError("AssertionError", `${ex.constructor.name}: ${ex}`);
  }

  private _makeAtom(pred: string, ...args: string[]): Expression {
    let accum = DrtVariableExpression(new Variable(pred)) as unknown as Expression;
    for (const arg of args) {
      accum = new DrtApplicationExpression(accum, DrtVariableExpression(new Variable(arg)));
    }
    return accum;
  }

  private _addOccurIndexing(base: string, ex: BoxerIndexed): string {
    if (this._occur_index && ex.sent_index !== null) {
      if (ex.discourse_id) base += `_${ex.discourse_id}`;
      base += `_s${sentIndexStr(ex.sent_index, ex.sentIndexFloat)}`;
      base += `_w${[...ex.word_indices].sort((a, b) => a - b)[0]}`;
    }
    return base;
  }
}

// ---------------------------------------------------------------------------
// Pure part of Boxer._parse_to_drs_dict — parse ``id(x,1).``/``sem(1,...)``
// boxer stdout into interpreted DRS objects.  The `Boxer` subprocess wrapper
// (candc + boxer binaries) stays an honest gap; only this pure reader is
// ported.
// ---------------------------------------------------------------------------

export interface BoxerDrsInterpreter {
  interpret(ex: AbstractBoxerDrs): unknown;
}

export class UnparseableInputException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "UnparseableInputException";
  }
}

function parseDrsString(drsString: string, discourseId: string | null, useDiscId: boolean): AbstractBoxerDrs {
  return new BoxerOutputDrsParser(useDiscId ? discourseId : null).parse(drsString) as AbstractBoxerDrs;
}

/** Boxer._parse_to_drs_dict — boxer stdout -> {discourse_id: interpreted DRS}.
 *  Python takes raw bytes (`boxer_out.decode("utf-8")`); both string and
 *  Uint8Array are accepted here. */
export function parseToDrsDict(
  boxerOut: string | Uint8Array,
  useDiscId: boolean,
  interpreter: BoxerDrsInterpreter = new NltkDrtBoxerDrsInterpreter(),
): Map<string, unknown> {
  const text = typeof boxerOut === "string" ? boxerOut : new TextDecoder().decode(boxerOut);
  const lines = text.split("\n");
  const drsDict = new Map<string, unknown>();
  let i = 0;
  while (i < lines.length) {
    let line = lines[i]!;
    if (line.startsWith("id(")) {
      const commaIdx = line.indexOf(",");
      let discourseId = line.slice(3, commaIdx);
      if (discourseId[0] === "'" && discourseId[discourseId.length - 1] === "'") {
        discourseId = discourseId.slice(1, -1);
      }
      const drsId = line.slice(commaIdx + 1, line.indexOf(")"));
      i += 1;
      line = lines[i]!;
      if (!line.startsWith(`sem(${drsId},`)) throw pyError("AssertionError", `expected line starting with 'sem(${drsId},'`);
      if (line.endsWith("').'")) line = line.slice(0, -4) + ").";
      if (!line.endsWith(").")) throw pyError("AssertionError", `can't parse line: ${line}`);

      const searchStart = `sem(${drsId},[`.length;
      let braceCount = 1;
      let drsStart = -1;
      for (let j = 0; j < line.length - searchStart; j++) {
        const c = line[searchStart + j];
        if (c === "[") braceCount += 1;
        if (c === "]") {
          braceCount -= 1;
          if (braceCount === 0) {
            drsStart = searchStart + j + 1;
            if (line.slice(drsStart, drsStart + 3) === "','") drsStart = drsStart + 3;
            else drsStart = drsStart + 1;
            break;
          }
        }
      }
      if (drsStart <= -1) throw pyError("AssertionError", "drs_start not found");

      const drsInput = line.slice(drsStart, -2).trim();
      const parsed = parseDrsString(drsInput, discourseId, useDiscId);
      drsDict.set(discourseId, interpreter.interpret(parsed));
    }
    i += 1;
  }
  return drsDict;
}

export const parse_to_drs_dict = parseToDrsDict;

/** nltk.sem.boxer.Boxer — subprocess wrapper around the C&C parser and the
 * Boxer binary.  Honest gap: the external binaries are unavailable in the JS
 * runtime.  `parseToDrsDict` above covers the pure output-parsing half. */
export class Boxer {
  constructor(..._args: unknown[]) {
    throw pyError(
      "NotImplementedError",
      "nltk.sem.boxer.Boxer requires the external C&C/Boxer binaries (candc, boxer) — not available in the JS runtime. Use parseToDrsDict to parse saved Boxer output.",
    );
  }
}
