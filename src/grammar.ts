import type { CfgGrammar, CfgProduction, PcfgGrammar, PcfgProduction } from "./parse";

export type GrammarSymbol = Nonterminal | string;

function pyRepr(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pyTypeName(value: unknown): string {
  if (typeof value === "string") return "str";
  if (typeof value === "number") return "float";
  if (typeof value === "boolean") return "bool";
  if (value === null || value === undefined) return "NoneType";
  return (value as object).constructor?.name ?? typeof value;
}

function symbolKey(symbol: GrammarSymbol): string {
  return symbol instanceof Nonterminal ? `nt:${symbol.symbol()}` : `t:${symbol}`;
}

// C/Python "%g": 6 significant digits, %e when exponent < -4 or >= 6,
// trailing zeros stripped.
function pyGFormat(value: number, precision = 6): string {
  if (value === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp < -4 || exp >= precision) {
    const s = value.toExponential(precision - 1);
    const [mant, e] = s.split("e");
    const expNum = parseInt(e!, 10);
    return `${mant!.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}e${expNum < 0 ? "-" : "+"}${String(Math.abs(expNum)).padStart(2, "0")}`;
  }
  const decimals = Math.max(0, precision - 1 - exp);
  const s = value.toFixed(decimals);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

export class Nonterminal {
  constructor(private readonly name: string) {
    if (typeof name !== "string") throw new TypeError("nonterminal symbols must be strings");
  }

  symbol(): string {
    return this.name;
  }

  equals(other: unknown): boolean {
    return other instanceof Nonterminal && this.name === other.name;
  }

  lessThan(other: Nonterminal): boolean {
    if (!(other instanceof Nonterminal)) throw new TypeError("'<' not supported between Nonterminal and non-Nonterminal");
    return this.name < other.name;
  }

  slash(other: Nonterminal): Nonterminal {
    return new Nonterminal(`${this.name}/${other.name}`);
  }

  toString(): string {
    return this.name;
  }
}

export function nonterminals(symbols: string): Nonterminal[] {
  const list = symbols.includes(",") ? symbols.split(",") : symbols.split(/\s+/).filter((s) => s.length > 0);
  return list.map((s) => new Nonterminal(s.trim()));
}

export function isNonterminal(item: unknown): item is Nonterminal {
  return item instanceof Nonterminal;
}

export function isTerminal(item: unknown): boolean {
  return item != null && typeof (item as object)["hasOwnProperty"] === "function" && !(item instanceof Nonterminal);
}

export function is_nonterminal(item: unknown): item is Nonterminal {
  return isNonterminal(item);
}

export function is_terminal(item: unknown): boolean {
  return isTerminal(item);
}

export class Production {
  private readonly left: Nonterminal;
  private readonly right: readonly GrammarSymbol[];

  constructor(lhs: Nonterminal, rhs: Iterable<GrammarSymbol>) {
    if (typeof rhs === "string") {
      throw new TypeError("production right hand side should be a list, not a string");
    }
    this.left = lhs;
    this.right = [...rhs];
  }

  lhs(): Nonterminal {
    return this.left;
  }

  rhs(): readonly GrammarSymbol[] {
    return [...this.right];
  }

  get length(): number {
    return this.right.length;
  }

  is_nonlexical(): boolean {
    return this.right.every((n) => n instanceof Nonterminal);
  }

  is_lexical(): boolean {
    return !this.is_nonlexical();
  }

  isNonlexical(): boolean {
    return this.is_nonlexical();
  }

  isLexical(): boolean {
    return this.is_lexical();
  }

  equals(other: unknown): boolean {
    return (
      other instanceof Production &&
      this.left.equals(other.left) &&
      this.right.length === other.right.length &&
      this.right.every((sym, i) => symbolKey(sym) === symbolKey(other.right[i]!))
    );
  }

  toString(): string {
    let result = `${this.left} -> `;
    result += this.right.map((el) => (el instanceof Nonterminal ? `${el}` : pyRepr(el))).join(" ");
    return result;
  }
}

export class DependencyProduction extends Production {
  override toString(): string {
    return `'${this.lhs()}' ->${this.rhs().map((elt) => ` '${elt}'`).join("")}`;
  }
}

export class ProbabilisticProduction extends Production {
  private probability: number;

  constructor(lhs: Nonterminal, rhs: Iterable<GrammarSymbol>, options: { prob?: number } = {}) {
    super(lhs, rhs);
    this.probability = options.prob ?? 0;
  }

  prob(): number {
    return this.probability;
  }

  set_prob(prob: number): void {
    this.probability = prob;
  }

  setProb(prob: number): void {
    this.set_prob(prob);
  }

  logprob(): number {
    return Math.log2(this.prob());
  }

  set_logprob(logprob: number): void {
    this.set_prob(2 ** logprob);
  }

  setLogprob(logprob: number): void {
    this.set_logprob(logprob);
  }

  override equals(other: unknown): boolean {
    return other instanceof ProbabilisticProduction && super.equals(other) && this.probability === other.probability;
  }

  override toString(): string {
    const inner = `${this.lhs()} -> ${this.rhs().map((el) => (el instanceof Nonterminal ? `${el}` : pyRepr(el))).join(" ")}`;
    return `${inner} ${this.probability === 1.0 ? "[1.0]" : `[${pyGFormat(this.probability)}]`}`;
  }
}

export function transitiveClosure(graph: Map<string, Set<string>>, reflexive = false): Map<string, Set<string>> {
  const base = (k: string): Set<string> => (reflexive ? new Set([k]) : new Set());
  const agendaGraph = new Map<string, Set<string>>([...graph].map(([k, v]) => [k, new Set(v)]));
  const closureGraph = new Map<string, Set<string>>([...graph.keys()].map((k) => [k, base(k)]));
  for (const i of graph.keys()) {
    const agenda = agendaGraph.get(i)!;
    const closure = closureGraph.get(i)!;
    while (agenda.size > 0) {
      const j = [...agenda].pop()!;
      agenda.delete(j);
      closure.add(j);
      if (!closureGraph.has(j)) closureGraph.set(j, base(j));
      for (const n of closureGraph.get(j)!) closure.add(n);
      for (const n of agendaGraph.get(j) ?? base(j)) if (!closure.has(n)) agenda.add(n);
    }
  }
  return closureGraph;
}

export function invertGraph(graph: Map<string, Set<string>>): Map<string, Set<string>> {
  const inverted = new Map<string, Set<string>>();
  for (const [key, values] of graph) {
    for (const value of values) {
      if (!inverted.has(value)) inverted.set(value, new Set());
      inverted.get(value)!.add(key);
    }
  }
  return inverted;
}

const ARROW_RE = /\s*->\s*/y;
const PROBABILITY_RE = /(\[[\d.]+\])\s*/y;
const TERMINAL_RE = /("[^"]*"|'[^']*')\s*/y;
const DISJUNCTION_RE = /\|\s*/y;
const STANDARD_NONTERM_RE = /([\w/][\w/^<>-]*)\s*/uy;
const STANDARD_NONTERM_FINDALL = /[\w/][\w/^<>-]*/gu;

function matchAt(re: RegExp, line: string, pos: number): RegExpExecArray | null {
  re.lastIndex = pos;
  return re.exec(line);
}

export function standardNontermParser(line: string, pos: number): [Nonterminal, number] {
  const m = matchAt(STANDARD_NONTERM_RE, line, pos);
  if (!m || m.index !== pos) throw new Error(`Expected a nonterminal, found: ${line.slice(pos)}`);
  return [new Nonterminal(m[1]!), m[0].length + pos];
}

export function standard_nonterm_parser(line: string, pos: number): [Nonterminal, number] {
  return standardNontermParser(line, pos);
}

type NontermParser = (line: string, pos: number) => [Nonterminal, number];

function readProduction(line: string, nontermParser: NontermParser, probabilistic: boolean): Production[] {
  let pos = 0;
  const [lhs, lhsEnd] = nontermParser(line, pos);
  pos = lhsEnd;

  let m = matchAt(ARROW_RE, line, pos);
  if (!m || m.index !== pos) throw new Error("Expected an arrow");
  pos += m[0].length;

  const probabilities = [0.0];
  const rhsides: GrammarSymbol[][] = [[]];
  while (pos < line.length) {
    m = matchAt(PROBABILITY_RE, line, pos);
    if (probabilistic && m && m.index === pos) {
      pos += m[0].length;
      probabilities[probabilities.length - 1] = parseFloat(m[1]!.slice(1, -1));
      if (probabilities[probabilities.length - 1]! > 1.0) {
        throw new Error(`Production probability ${probabilities[probabilities.length - 1]}, should not be greater than 1.0`);
      }
    } else if (line[pos] === "'" || line[pos] === '"') {
      m = matchAt(TERMINAL_RE, line, pos);
      if (!m || m.index !== pos) throw new Error("Unterminated string");
      rhsides[rhsides.length - 1]!.push(m[1]!.slice(1, -1));
      pos += m[0].length;
    } else if (line[pos] === "|") {
      m = matchAt(DISJUNCTION_RE, line, pos);
      probabilities.push(0.0);
      rhsides.push([]);
      pos += m![0].length;
    } else {
      const [nonterm, next] = nontermParser(line, pos);
      rhsides[rhsides.length - 1]!.push(nonterm);
      pos = next;
    }
  }

  if (probabilistic) {
    return rhsides.map((rhs, i) => new ProbabilisticProduction(lhs, rhs, { prob: probabilities[i]! }));
  }
  return rhsides.map((rhs) => new Production(lhs, rhs));
}

export function readGrammar(
  input: string | readonly string[],
  nontermParser: NontermParser,
  options: { probabilistic?: boolean } = {},
): [Nonterminal, Production[]] {
  const probabilistic = options.probabilistic ?? false;
  const lines = typeof input === "string" ? input.split("\n") : [...input];

  let start: Nonterminal | null = null;
  const productions: Production[] = [];
  let continueLine = "";
  for (let linenum = 0; linenum < lines.length; linenum++) {
    const line = continueLine + lines[linenum]!.trim();
    if (line.startsWith("#") || line === "") continue;
    if (line.endsWith("\\")) {
      continueLine = `${line.slice(0, -1).trimEnd()} `;
      continue;
    }
    continueLine = "";
    try {
      if (line[0] === "%") {
        const [directive, args] = splitOnce(line.slice(1));
        if (directive === "start") {
          const [s, pos] = nontermParser(args, 0);
          start = s;
          if (pos !== args.length) throw new Error("Bad argument to start directive");
        } else {
          throw new Error("Bad directive");
        }
      } else {
        productions.push(...readProduction(line, nontermParser, probabilistic));
      }
    } catch (e) {
      throw new Error(`Unable to parse line ${linenum + 1}: ${line}\n${(e as Error).message}`);
    }
  }

  if (productions.length === 0) throw new Error("No productions found!");
  if (!start) start = productions[0]!.lhs() as Nonterminal;
  return [start, productions];
}

export function read_grammar(
  input: string | readonly string[],
  nontermParser: NontermParser,
  options: { probabilistic?: boolean } = {},
): [Nonterminal, Production[]] {
  return readGrammar(input, nontermParser, options);
}

function splitOnce(text: string): [string, string] {
  const idx = text.search(/\s/);
  if (idx < 0) return [text, ""];
  return [text.slice(0, idx), text.slice(idx + 1).trimStart()];
}

export class CFG {
  private readonly _start: Nonterminal;
  private readonly _productions: Production[];
  private readonly _categories: Set<string>;
  private _lhsIndex = new Map<string, Production[]>();
  private _rhsIndex = new Map<string, Production[]>();
  private _emptyIndex = new Map<string, Production>();
  private _lexicalIndex = new Map<string, Set<Production>>();
  private _immediateLeftcornerCategories = new Map<string, Set<string>>();
  private _immediateLeftcornerWords = new Map<string, Set<string>>();
  private _leftcorners = new Map<string, Set<string>>();
  private _leftcornerParents = new Map<string, Set<string>>();
  private _leftcornerWords: Map<string, Set<string>> | null = new Map();
  private _isLexical = false;
  private _isNonlexical = false;
  private _minLen = 0;
  private _maxLen = 0;
  private _allUnaryAreLexical = false;
  private readonly bySymbol = new Map<string, Nonterminal>();

  constructor(start: Nonterminal, productions: Iterable<Production>, calculateLeftcorners = true) {
    if (!(start instanceof Nonterminal)) {
      throw new TypeError(`start should be a Nonterminal object, not a ${pyTypeName(start)}`);
    }
    this._start = start;
    this._productions = [...productions];
    this._categories = new Set(this._productions.map((p) => p.lhs().symbol()));
    this._calculateIndexes();
    this._calculateGrammarForms();
    if (calculateLeftcorners) this._calculateLeftcorners();
  }

  private nonterm(symbol: string): Nonterminal {
    let nt = this.bySymbol.get(symbol);
    if (!nt) {
      nt = new Nonterminal(symbol);
      this.bySymbol.set(symbol, nt);
    }
    return nt;
  }

  private _calculateIndexes(): void {
    for (const prod of this._productions) {
      const lhs = prod.lhs();
      if (!this._lhsIndex.has(lhs.symbol())) this._lhsIndex.set(lhs.symbol(), []);
      this._lhsIndex.get(lhs.symbol())!.push(prod);
      const rhs = prod.rhs();
      if (rhs.length > 0) {
        const key = symbolKey(rhs[0]!);
        if (!this._rhsIndex.has(key)) this._rhsIndex.set(key, []);
        this._rhsIndex.get(key)!.push(prod);
      } else {
        this._emptyIndex.set(lhs.symbol(), prod);
      }
      for (const token of rhs) {
        if (!(token instanceof Nonterminal)) {
          if (!this._lexicalIndex.has(token)) this._lexicalIndex.set(token, new Set());
          this._lexicalIndex.get(token)!.add(prod);
        }
      }
    }
  }

  private _calculateLeftcorners(): void {
    this._immediateLeftcornerCategories = new Map([...this._categories].map((cat) => [cat, new Set([cat])]));
    this._immediateLeftcornerWords = new Map([...this._categories].map((cat) => [cat, new Set<string>()]));
    for (const prod of this.productions()) {
      const rhs = prod.rhs();
      if (rhs.length > 0) {
        const cat = prod.lhs().symbol();
        const left = rhs[0]!;
        if (left instanceof Nonterminal) this._immediateLeftcornerCategories.get(cat)!.add(left.symbol());
        else this._immediateLeftcornerWords.get(cat)!.add(left);
      }
    }

    this._leftcorners = transitiveClosure(this._immediateLeftcornerCategories, true);
    this._leftcornerParents = invertGraph(this._leftcorners);

    const nrLeftcornerCategories = [...this._immediateLeftcornerCategories.values()].reduce((n, s) => n + s.size, 0);
    const nrLeftcornerWords = [...this._immediateLeftcornerWords.values()].reduce((n, s) => n + s.size, 0);
    if (nrLeftcornerWords > nrLeftcornerCategories && nrLeftcornerCategories > 10000) {
      this._leftcornerWords = null;
      return;
    }

    this._leftcornerWords = new Map();
    for (const [cat, lefts] of this._leftcorners) {
      const lc = new Set<string>();
      for (const left of lefts) {
        for (const w of this._immediateLeftcornerWords.get(left) ?? new Set<string>()) lc.add(w);
      }
      this._leftcornerWords.set(cat, lc);
    }
  }

  static fromstring(input: string | readonly string[], _options: { encoding?: string } = {}): CFG {
    const [start, productions] = readGrammar(input, standardNontermParser);
    return new CFG(start, productions);
  }

  static fromString(input: string | readonly string[]): CFG {
    return CFG.fromstring(input);
  }

  start(): Nonterminal {
    return this._start;
  }

  productions(options: { lhs?: Nonterminal; rhs?: GrammarSymbol; empty?: boolean } = {}): Production[] {
    const { lhs, rhs, empty = false } = options;
    if (rhs !== undefined && empty) {
      throw new Error("You cannot select empty and non-empty productions at the same time.");
    }

    if (lhs === undefined && rhs === undefined) {
      return empty ? [...this._emptyIndex.values()] : [...this._productions];
    }
    const lhsSym = lhs instanceof Nonterminal ? lhs.symbol() : null;
    if (lhs !== undefined && rhs === undefined) {
      if (!empty) return lhsSym === null ? [] : [...(this._lhsIndex.get(lhsSym) ?? [])];
      const prod = lhsSym === null ? undefined : this._emptyIndex.get(lhsSym);
      return prod ? [prod] : [];
    }
    if (rhs !== undefined && lhs === undefined) {
      return [...(this._rhsIndex.get(symbolKey(rhs)) ?? [])];
    }
    const rhsKey = symbolKey(rhs!);
    return (lhsSym === null ? [] : (this._lhsIndex.get(lhsSym) ?? [])).filter((prod) =>
      (this._rhsIndex.get(rhsKey) ?? []).includes(prod),
    );
  }

  leftcorners(cat: Nonterminal): Nonterminal[] {
    const sym = cat instanceof Nonterminal ? cat.symbol() : String(cat);
    const syms = this._leftcorners.get(sym) ?? new Set([sym]);
    return [...syms].map((s) => this.nonterm(s));
  }

  is_leftcorner(cat: Nonterminal, left: GrammarSymbol): boolean {
    if (left instanceof Nonterminal) {
      return this.leftcorners(cat).some((nt) => nt.symbol() === left.symbol());
    }
    const catSym = cat instanceof Nonterminal ? cat.symbol() : String(cat);
    if (this._leftcornerWords) {
      return this._leftcornerWords.get(catSym)?.has(left) ?? false;
    }
    for (const parent of this.leftcorners(cat)) {
      if (this._immediateLeftcornerWords.get(parent.symbol())?.has(left)) return true;
    }
    return false;
  }

  isLeftcorner(cat: Nonterminal, left: GrammarSymbol): boolean {
    return this.is_leftcorner(cat, left);
  }

  leftcorner_parents(cat: Nonterminal): Nonterminal[] {
    const sym = cat instanceof Nonterminal ? cat.symbol() : String(cat);
    const syms = this._leftcornerParents.get(sym) ?? new Set([sym]);
    return [...syms].map((s) => this.nonterm(s));
  }

  leftcornerParents(cat: Nonterminal): Nonterminal[] {
    return this.leftcorner_parents(cat);
  }

  check_coverage(tokens: Iterable<string>): void {
    const missing = [...tokens].filter((tok) => !this._lexicalIndex.has(tok));
    if (missing.length > 0) {
      const joined = missing.map((w) => pyRepr(w)).join(", ");
      throw new Error(`Grammar does not cover some of the input words: ${pyRepr(joined)}.`);
    }
  }

  checkCoverage(tokens: Iterable<string>): void {
    this.check_coverage(tokens);
  }

  private _calculateGrammarForms(): void {
    const prods = this._productions;
    this._isLexical = prods.every((p) => p.is_lexical());
    this._isNonlexical = prods.filter((p) => p.length !== 1).every((p) => p.is_nonlexical());
    this._minLen = Math.min(...prods.map((p) => p.length));
    this._maxLen = Math.max(...prods.map((p) => p.length));
    this._allUnaryAreLexical = prods.filter((p) => p.length === 1).every((p) => p.is_lexical());
  }

  is_lexical(): boolean {
    return this._isLexical;
  }

  isLexical(): boolean {
    return this._isLexical;
  }

  is_nonlexical(): boolean {
    return this._isNonlexical;
  }

  isNonlexical(): boolean {
    return this._isNonlexical;
  }

  min_len(): number {
    return this._minLen;
  }

  minLen(): number {
    return this._minLen;
  }

  max_len(): number {
    return this._maxLen;
  }

  maxLen(): number {
    return this._maxLen;
  }

  is_nonempty(): boolean {
    return this._minLen > 0;
  }

  isNonempty(): boolean {
    return this._isNonempty();
  }

  private _isNonempty(): boolean {
    return this._minLen > 0;
  }

  is_binarised(): boolean {
    return this._maxLen <= 2;
  }

  isBinarised(): boolean {
    return this._maxLen <= 2;
  }

  is_flexible_chomsky_normal_form(): boolean {
    return this.is_nonempty() && this.is_nonlexical() && this.is_binarised();
  }

  isFlexibleChomskyNormalForm(): boolean {
    return this.is_flexible_chomsky_normal_form();
  }

  is_chomsky_normal_form(): boolean {
    return this.is_flexible_chomsky_normal_form() && this._allUnaryAreLexical;
  }

  isChomskyNormalForm(): boolean {
    return this.is_chomsky_normal_form();
  }

  chomsky_normal_form(newTokenPadding = "@$@", flexible = false): CFG {
    if (this.is_chomsky_normal_form()) return this;
    if (this.productions({ empty: true }).length > 0) {
      throw new Error("Grammar has Empty rules. Cannot deal with them at the moment");
    }
    const step1 = CFG.eliminate_start(this);
    const step2 = CFG.binarize(step1, newTokenPadding);
    const step3 = CFG.remove_mixed_rules(step2, newTokenPadding);
    if (flexible) return step3;
    const step4 = CFG.remove_unitary_rules(step3);
    const seen = new Set<string>();
    const deduped: Production[] = [];
    for (const p of step4.productions()) {
      const key = `${p.lhs().symbol()}|${p.rhs().map(symbolKey).join(",")}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(p);
      }
    }
    return new CFG(step4.start(), deduped);
  }

  chomskyNormalForm(newTokenPadding = "@$@", flexible = false): CFG {
    return this.chomsky_normal_form(newTokenPadding, flexible);
  }

  static remove_unitary_rules(grammar: CFG): CFG {
    const result: Production[] = [];
    const unitary: Production[] = [];
    for (const rule of grammar.productions()) {
      if (rule.length === 1 && rule.is_nonlexical()) unitary.push(rule);
      else result.push(rule);
    }

    const seen = new Set<string>();
    while (unitary.length > 0) {
      const rule = unitary.shift()!;
      const key = `${rule.lhs().symbol()}->${symbolKey(rule.rhs()[0]!)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const item of grammar.productions({ lhs: rule.rhs()[0] as Nonterminal })) {
        const newRule = new Production(rule.lhs(), item.rhs());
        if (newRule.length !== 1 || newRule.is_lexical()) result.push(newRule);
        else unitary.push(newRule);
      }
    }
    return new CFG(grammar.start(), result);
  }

  static removeUnitaryRules(grammar: CFG): CFG {
    return CFG.remove_unitary_rules(grammar);
  }

  static binarize(grammar: CFG, padding = "@$@"): CFG {
    const result: Production[] = [];
    for (const rule of grammar.productions()) {
      const rhs = rule.rhs();
      if (rhs.length > 2) {
        let leftSide = rule.lhs();
        for (let k = 0; k < rhs.length - 2; k++) {
          const tsym = rhs[k]! as Nonterminal;
          const newSym = new Nonterminal(leftSide.symbol() + padding + tsym.symbol());
          result.push(new Production(leftSide, [tsym, newSym]));
          leftSide = newSym;
        }
        result.push(new Production(leftSide, rhs.slice(-2)));
      } else {
        result.push(rule);
      }
    }
    return new CFG(grammar.start(), result);
  }

  static eliminate_start(grammar: CFG): CFG {
    let start = grammar.start();
    const result: Production[] = [];
    let needToAdd = false;
    for (const rule of grammar.productions()) {
      if (rule.rhs().some((sym) => sym instanceof Nonterminal && sym.symbol() === start.symbol())) needToAdd = true;
      result.push(rule);
    }
    if (needToAdd) {
      start = new Nonterminal("S0_SIGMA");
      result.push(new Production(start, [grammar.start()]));
      return new CFG(start, result);
    }
    return grammar;
  }

  static eliminateStart(grammar: CFG): CFG {
    return CFG.eliminate_start(grammar);
  }

  static remove_mixed_rules(grammar: CFG, padding = "@$@"): CFG {
    const result: Production[] = [];
    const dummyNonterms = new Map<string, Nonterminal>();
    for (const rule of grammar.productions()) {
      if (!rule.is_lexical() || rule.rhs().length <= 1) {
        result.push(rule);
        continue;
      }
      const newRhs: GrammarSymbol[] = [];
      for (const item of rule.rhs()) {
        if (item instanceof Nonterminal) {
          newRhs.push(item);
        } else {
          let dummy = dummyNonterms.get(item);
          if (!dummy) {
            const sanitized = [...item.toUpperCase().matchAll(STANDARD_NONTERM_FINDALL)].map((m) => m[0]).join("");
            dummy = new Nonterminal(`${sanitized}${padding}${sanitized}`);
            dummyNonterms.set(item, dummy);
          }
          newRhs.push(dummy);
          result.push(new Production(dummy, [item]));
        }
      }
      result.push(new Production(rule.lhs(), newRhs));
    }
    return new CFG(grammar.start(), result);
  }

  static removeMixedRules(grammar: CFG, padding = "@$@"): CFG {
    return CFG.remove_mixed_rules(grammar, padding);
  }

  get grammar(): CfgGrammar {
    const productions: CfgProduction[] = this._productions.map((p) => ({
      lhs: p.lhs().symbol(),
      rhs: p.rhs().map((sym) => (sym instanceof Nonterminal ? sym.symbol() : sym)),
    }));
    return { startSymbol: this._start.symbol(), productions };
  }

  toString(): string {
    let result = `Grammar with ${this._productions.length} productions`;
    result += ` (start state = ${this._start})`;
    for (const production of this._productions) {
      result += `\n    ${production}`;
    }
    return result;
  }

  repr(): string {
    return `<Grammar with ${this._productions.length} productions>`;
  }
}

export { CFG as Grammar };

const READ_DG_RE = /^\s*('[^']+')\s*[-=]+>\s*(?:(?:"[^"]+"|'[^']+'|\|)\s*)*$/;
const SPLIT_DG_RE = /('[^']'|[-=]+>|"[^"]+"|'[^']+'|\|)/g;

function readDependencyProduction(s: string): DependencyProduction[] {
  if (!READ_DG_RE.test(s)) throw new Error("Bad production string");
  const pieces: string[] = [];
  for (const m of s.matchAll(SPLIT_DG_RE)) pieces.push(m[0]);
  const strip = (p: string) => p.replace(/^['"]+|['"]+$/g, "");
  const lhside = strip(pieces[0]!);
  const rhsides: string[][] = [[]];
  for (const piece of pieces.slice(2)) {
    if (piece === "|") rhsides.push([]);
    else rhsides[rhsides.length - 1]!.push(strip(piece));
  }
  return rhsides.map((rhs) => new DependencyProduction(new Nonterminal(lhside), rhs));
}

export class DependencyGrammar {
  private readonly _productions: DependencyProduction[];

  constructor(productions: DependencyProduction[]) {
    this._productions = productions;
  }

  static fromstring(input: string): DependencyGrammar {
    const productions: DependencyProduction[] = [];
    const lines = input.split("\n");
    for (let linenum = 0; linenum < lines.length; linenum++) {
      const line = lines[linenum]!.trim();
      if (line.startsWith("#") || line === "") continue;
      try {
        productions.push(...readDependencyProduction(line));
      } catch (e) {
        throw new Error(`Unable to parse line ${linenum}: ${line}`, { cause: e });
      }
    }
    if (productions.length === 0) throw new Error("No productions found!");
    return new DependencyGrammar(productions);
  }

  static fromString(input: string): DependencyGrammar {
    return DependencyGrammar.fromstring(input);
  }

  contains(head: string, mod: string): boolean {
    for (const production of this._productions) {
      for (const possibleMod of production.rhs()) {
        if (production.lhs().symbol() === head && possibleMod === mod) return true;
      }
    }
    return false;
  }

  has(headMod: [string, string]): boolean {
    let head: string, mod: string;
    try {
      [head, mod] = headMod;
    } catch (e) {
      throw new Error("Must use a tuple of strings, e.g. `('price', 'of') in grammar`", { cause: e as Error });
    }
    return this.contains(head, mod);
  }

  toString(): string {
    let str = `Dependency grammar with ${this._productions.length} productions`;
    for (const production of this._productions) str += `\n  ${production}`;
    return str;
  }

  repr(): string {
    return `Dependency grammar with ${this._productions.length} productions`;
  }
}

export class ProbabilisticDependencyGrammar {
  private readonly _productions: ProbabilisticProduction[];
  private readonly _events: Map<string, number>;
  private readonly _tags: Map<string, unknown>;

  constructor(productions: ProbabilisticProduction[], events: Map<string, number>, tags: Map<string, unknown>) {
    this._productions = productions;
    this._events = events;
    this._tags = tags;
  }

  contains(head: string, mod: string): boolean {
    for (const production of this._productions) {
      for (const possibleMod of production.rhs()) {
        if (production.lhs().symbol() === head && possibleMod === mod) return true;
      }
    }
    return false;
  }

  toString(): string {
    let str = `Statistical dependency grammar with ${this._productions.length} productions`;
    for (const production of this._productions) str += `\n  ${production}`;
    str += "\nEvents:";
    for (const [event, count] of this._events) str += `\n  ${count}:${event}`;
    str += "\nTags:";
    for (const [tagWord, tag] of this._tags) str += `\n ${tagWord}:\t(${tag})`;
    return str;
  }

  repr(): string {
    return `Statistical Dependency grammar with ${this._productions.length} productions`;
  }
}

export class PCFG extends CFG {
  static readonly EPSILON = 0.01;

  constructor(start: Nonterminal, productions: Iterable<Production>, calculateLeftcorners = true) {
    const prods = [...productions];
    super(start, prods, calculateLeftcorners);
    const probs = new Map<string, number>();
    for (const production of prods) {
      const lhs = production.lhs().symbol();
      probs.set(lhs, (probs.get(lhs) ?? 0) + (production as ProbabilisticProduction).prob());
    }
    for (const [lhs, p] of probs) {
      if (!(1 - PCFG.EPSILON < p && p < 1 + PCFG.EPSILON)) {
        throw new Error(`Productions for ${lhs} do not sum to 1`);
      }
    }
  }

  static override fromstring(input: string | readonly string[], _options: { encoding?: string } = {}): PCFG {
    const [start, productions] = readGrammar(input, standardNontermParser, { probabilistic: true });
    return new PCFG(start, productions);
  }

  override get grammar(): PcfgGrammar {
    const productions: PcfgProduction[] = this.productions().map((p) => ({
      lhs: p.lhs().symbol(),
      rhs: p.rhs().map((sym) => (sym instanceof Nonterminal ? sym.symbol() : sym)),
      prob: p instanceof ProbabilisticProduction ? p.prob() : 0,
    }));
    return { startSymbol: this.start().symbol(), productions };
  }

  static override fromString(input: string | readonly string[]): PCFG {
    return PCFG.fromstring(input);
  }
}

export function induce_pcfg(start: Nonterminal, productions: Iterable<Production>): PCFG {
  const pcount = new Map<string, number>();
  const lcount = new Map<string, number>();
  const order: Production[] = [];

  for (const prod of productions) {
    const key = `${prod.lhs().symbol()}|${prod.rhs().map(symbolKey).join(",")}`;
    if (!pcount.has(key)) order.push(prod);
    lcount.set(prod.lhs().symbol(), (lcount.get(prod.lhs().symbol()) ?? 0) + 1);
    pcount.set(key, (pcount.get(key) ?? 0) + 1);
  }

  const prods = order.map((p) => {
    const key = `${p.lhs().symbol()}|${p.rhs().map(symbolKey).join(",")}`;
    return new ProbabilisticProduction(p.lhs(), p.rhs(), { prob: pcount.get(key)! / lcount.get(p.lhs().symbol())! });
  });
  return new PCFG(start, prods);
}

export function inducePcfg(start: Nonterminal, productions: Iterable<Production>): PCFG {
  return induce_pcfg(start, productions);
}
