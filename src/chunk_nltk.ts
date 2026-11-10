export type TaggedToken = { token: string; tag: string };
export type ChunkTree = { label: string; children: Array<ChunkTree | TaggedToken> };

type Piece = ChunkTree | TaggedToken;

function isTree(piece: Piece): piece is ChunkTree {
  return typeof (piece as ChunkTree).label === "string" && Array.isArray((piece as ChunkTree).children);
}

function tagOf(piece: Piece): string {
  if (isTree(piece)) return piece.label;
  if (typeof (piece as TaggedToken).tag === "string") return piece.tag;
  throw new Error("chunk structures must contain tagged tokens or trees");
}

const CHUNK_TAG_CHAR = "[^{}<>]";
const CHUNK_TAG = "(<" + CHUNK_TAG_CHAR + "+?>)";
const VALID = new RegExp(`^(\\{?${CHUNK_TAG}\\}?)*?$`);
const BRACKETS = /[^{}]+/g;
const BALANCED_BRACKETS = /(\{\})*$/;
const CHUNK_TAG_PATTERN = /^(([^<>{}]|\{\d+,?\}|\{\d*,\d+\})|<[^<>{}]+>)*$/;

export function tagPattern2rePattern(tagPattern: string): string {
  let p = tagPattern.replace(/\s/g, "");
  p = p.replace(/</g, "(<(");
  p = p.replace(/>/g, ")>)");
  if (!CHUNK_TAG_PATTERN.test(p)) throw new Error(`Bad tag pattern: '${tagPattern}'`);
  // Replace unescaped '.' with CHUNK_TAG_CHAR (reverse twice, use lookahead).
  const rev = (s: string) => [...s].reverse().join("");
  const tcRev = rev(CHUNK_TAG_CHAR);
  const reversed = rev(p).replace(/\.(?!\\(\\\\)*($|[^\\]))/g, tcRev);
  return rev(reversed);
}

export const tag_pattern2re_pattern = tagPattern2rePattern;

export class ChunkString {
  static readonly IN_CHUNK_PATTERN = "(?=[^{]*\\})";
  static readonly IN_STRIP_PATTERN = "(?=[^}]*(\\{|$))";
  private _str = "";

  constructor(
    private readonly rootLabel: string,
    private readonly pieces: Piece[],
    private readonly debug = 1,
  ) {
    this._str = `<${pieces.map(tagOf).join("><")}>`;
  }

  get str(): string {
    return this._str;
  }

  private _verify(s: string, verifyTags: boolean): void {
    if (!VALID.test(s)) {
      throw new Error(`Transformation generated invalid chunkstring:\n  ${s}`);
    }
    const brackets = s.replace(BRACKETS, "");
    for (let i = 0; i < 1 + Math.floor(brackets.length / 5000); i++) {
      const substr = brackets.slice(i * 5000, i * 5000 + 5000);
      if (!BALANCED_BRACKETS.test(substr)) {
        throw new Error(`Transformation generated invalid chunkstring:\n  ${s}`);
      }
    }
    if (verifyTags) {
      const tags1 = s.split(/[{}<>]+/).slice(1, -1);
      const tags2 = this.pieces.map(tagOf);
      if (JSON.stringify(tags1) !== JSON.stringify(tags2)) {
        throw new Error("Transformation generated invalid chunkstring: tag changed");
      }
    }
  }

  to_chunkstruct(chunkLabel = "CHUNK"): ChunkTree {
    if (this.debug > 0) this._verify(this._str, true);
    const out: Piece[] = [];
    let index = 0;
    let pieceInChunk = false;
    for (const piece of this._str.split(/[{}]/)) {
      const length = (piece.match(/</g) ?? []).length;
      const subsequence = this.pieces.slice(index, index + length);
      if (pieceInChunk) out.push({ label: chunkLabel, children: subsequence });
      else out.push(...subsequence);
      index += length;
      pieceInChunk = !pieceInChunk;
    }
    return { label: this.rootLabel, children: out };
  }

  toChunkstruct(chunkLabel = "CHUNK"): ChunkTree {
    return this.to_chunkstruct(chunkLabel);
  }

  xform(regexp: RegExp | string, repl: string): void {
    const re = typeof regexp === "string" ? new RegExp(regexp, "g") : regexp;
    const flags = re.global ? re.flags : re.flags + "g";
    let s = this._str.replace(new RegExp(re.source, flags), pySub(repl));
    s = s.replace(/\{\}/g, "");
    if (this.debug > 1) this._verify(s, this.debug - 2 > 0);
    this._str = s;
  }

  toString(): string {
    return `<<${this._str}>>`;
  }
}

function pySub(repl: string): string {
  return repl
    .replace(/\\g<0>/g, "$&")
    .replace(/\\g<([A-Za-z_][A-Za-z0-9_]*)>/g, "$$<$1>")
    .replace(/\\([0-9]+)/g, "$$$1")
    .replace(/\\([\\])/g, "\\$1");
}

export class RegexpChunkRule {
  constructor(
    public readonly regexp: RegExp,
    public readonly repl: string,
    private readonly _descr: string,
  ) {}

  apply(chunkstr: ChunkString): void {
    chunkstr.xform(this.regexp, this.repl);
  }

  descr(): string {
    return this._descr;
  }

  static fromstring(s: string): RegexpChunkRule {
    const m = /^(?<rule>(\\.|[^#])*)(?<comment>#.*)?$/.exec(s)!;
    const rule = m.groups!.rule!.trim();
    const comment = (m.groups!.comment ?? "").slice(1).trim();
    try {
      if (!rule) throw new Error("Empty chunk pattern");
      if (rule[0] === "{" && rule[rule.length - 1] === "}") {
        return new ChunkRule(rule.slice(1, -1), comment);
      } else if (rule[0] === "}" && rule[rule.length - 1] === "{") {
        return new StripRule(rule.slice(1, -1), comment);
      } else if (rule.includes("}{")) {
        const [left, right] = rule.split("}{");
        return new SplitRule(left!, right!, comment);
      } else if (rule.includes("{}")) {
        const [left, right] = rule.split("{}");
        return new MergeRule(left!, right!, comment);
      } else if (/[^{}]*\{[^{}]*\}[^{}]*/.test(rule)) {
        const [left, chunk, right] = rule.split(/[{}]/);
        return new ChunkRuleWithContext(left!, chunk!, right!, comment);
      }
      throw new Error(`Illegal chunk pattern: ${rule}`);
    } catch {
      throw new Error(`Illegal chunk pattern: ${rule}`);
    }
  }

  toString(): string {
    return `<RegexpChunkRule: '${this.regexp.source}'->'${this.repl}'>`;
  }
}

function tp2re(p: string): string {
  return tagPattern2rePattern(p);
}

export class ChunkRule extends RegexpChunkRule {
  constructor(public readonly pattern: string, descr: string) {
    super(new RegExp(`(?<chunk>${tp2re(pattern)})${ChunkString.IN_STRIP_PATTERN}`, "g"), "{\\g<chunk>}", descr);
  }
  override toString(): string {
    return `<ChunkRule: '${this.pattern}'>`;
  }
}

export class StripRule extends RegexpChunkRule {
  constructor(public readonly pattern: string, descr: string) {
    super(new RegExp(`(?<strip>${tp2re(pattern)})${ChunkString.IN_CHUNK_PATTERN}`, "g"), "}\\g<strip>{", descr);
  }
}

export class UnChunkRule extends RegexpChunkRule {
  constructor(public readonly pattern: string, descr: string) {
    super(new RegExp(`\\{(?<chunk>${tp2re(pattern)})\\}`, "g"), "\\g<chunk>", descr);
  }
}

export class MergeRule extends RegexpChunkRule {
  constructor(
    public readonly leftTagPattern: string,
    public readonly rightTagPattern: string,
    descr: string,
  ) {
    super(new RegExp(`(?<left>${tp2re(leftTagPattern)})\\}\\{(?=${tp2re(rightTagPattern)})`, "g"), "\\g<left>", descr);
  }
}

export class SplitRule extends RegexpChunkRule {
  constructor(
    public readonly leftTagPattern: string,
    public readonly rightTagPattern: string,
    descr: string,
  ) {
    super(new RegExp(`(?<left>${tp2re(leftTagPattern)})(?=${tp2re(rightTagPattern)})`, "g"), "\\g<left>}{", descr);
  }
}

export class ExpandLeftRule extends RegexpChunkRule {
  constructor(
    public readonly leftTagPattern: string,
    public readonly rightTagPattern: string,
    descr: string,
  ) {
    super(new RegExp(`(?<left>${tp2re(leftTagPattern)})\\{(?<right>${tp2re(rightTagPattern)})`, "g"), "{\\g<left>\\g<right>", descr);
  }
}

export class ExpandRightRule extends RegexpChunkRule {
  constructor(
    public readonly leftTagPattern: string,
    public readonly rightTagPattern: string,
    descr: string,
  ) {
    super(new RegExp(`(?<left>${tp2re(leftTagPattern)})\\}(?<right>${tp2re(rightTagPattern)})`, "g"), "\\g<left>\\g<right>}", descr);
  }
}

export class ChunkRuleWithContext extends RegexpChunkRule {
  constructor(
    public readonly leftTagPattern: string,
    public readonly tagPattern: string,
    public readonly rightTagPattern: string,
    descr: string,
  ) {
    super(
      new RegExp(
        `(?<left>${tp2re(leftTagPattern)})(?<chunk>${tp2re(tagPattern)})(?<right>${tp2re(rightTagPattern)})${ChunkString.IN_STRIP_PATTERN}`,
        "g",
      ),
      "\\g<left>{\\g<chunk>}\\g<right>",
      descr,
    );
  }
}

export type IobRow = { token: string; tag: string; iob: string };

export function tree2conlltags(tree: ChunkTree): IobRow[] {
  const rows: IobRow[] = [];
  const walk = (children: Piece[]): void => {
    for (const child of children) {
      if (isTree(child)) {
        if (child.children.some(isTree)) throw new Error("Tree is too deeply nested to be printed in CoNLL format.");
        child.children.forEach((tok, i) => {
          const t = tok as TaggedToken;
          rows.push({ token: t.token, tag: t.tag, iob: `${i === 0 ? "B" : "I"}-${child.label}` });
        });
      } else {
        rows.push({ token: child.token, tag: child.tag, iob: "O" });
      }
    }
  };
  walk(tree.children);
  return rows;
}

export function conlltags2tree(rows: IobRow[], chunkLabel = "NP", rootLabel = "S"): ChunkTree {
  const children: Piece[] = [];
  for (const row of rows) {
    const tok: TaggedToken = { token: row.token, tag: row.tag };
    if (row.iob.startsWith("B-")) children.push({ label: row.iob.slice(2), children: [tok] });
    else if (row.iob.startsWith("I-")) {
      const last = children[children.length - 1];
      if (last && isTree(last) && last.label === row.iob.slice(2)) last.children.push(tok);
      else children.push({ label: row.iob.slice(2), children: [tok] });
    } else children.push(tok);
  }
  return { label: rootLabel, children };
}

function leaves(tree: ChunkTree): TaggedToken[] {
  const out: TaggedToken[] = [];
  for (const child of tree.children) {
    if (isTree(child)) out.push(...leaves(child));
    else out.push(child);
  }
  return out;
}

export class ChunkScore {
  private _correct = new Map<string, Piece>();
  private _guessed = new Map<string, Piece>();
  private _tp: Piece[] = [];
  private _fp: Piece[] = [];
  private _fn: Piece[] = [];
  private _tagsCorrect = 0;
  private _tagsTotal = 0;
  private _measuresNeedUpdate = false;

  constructor(private readonly chunkLabel = ".*") {}

  private _chunksets(tree: ChunkTree, count: number): Map<string, Piece> {
    const chunks = new Map<string, Piece>();
    let pos = 0;
    for (const child of tree.children) {
      if (isTree(child)) {
        if (new RegExp(this.chunkLabel).test(child.label)) {
          chunks.set(`${count}:${pos}`, child);
        }
        pos += leaves(child).length;
      } else {
        pos += 1;
      }
    }
    return chunks;
  }

  score(correct: ChunkTree, guessed: ChunkTree): void {
    for (const [k, v] of this._chunksets(correct, this._count)) {
      this._correct.set(k, v);
    }
    for (const [k, v] of this._chunksets(guessed, this._count)) {
      this._guessed.set(k, v);
    }
    this._count += 1;
    this._measuresNeedUpdate = true;
    let correctTags: IobRow[] = [];
    let guessedTags: IobRow[] = [];
    try {
      correctTags = tree2conlltags(correct);
      guessedTags = tree2conlltags(guessed);
    } catch {
      correctTags = guessedTags = [];
    }
    this._tagsTotal += correctTags.length;
    for (let i = 0; i < Math.min(guessedTags.length, correctTags.length); i++) {
      const g = guessedTags[i]!;
      const c = correctTags[i]!;
      if (g.token === c.token && g.tag === c.tag && g.iob === c.iob) this._tagsCorrect += 1;
    }
  }

  private _count = 0;

  private _updateMeasures(): void {
    if (this._measuresNeedUpdate) {
      this._tp = [...this._guessed.entries()].filter(([k]) => this._correct.has(k)).map(([, v]) => v);
      this._fn = [...this._correct.entries()].filter(([k]) => !this._guessed.has(k)).map(([, v]) => v);
      this._fp = [...this._guessed.entries()].filter(([k]) => !this._correct.has(k)).map(([, v]) => v);
      this._measuresNeedUpdate = false;
    }
  }

  accuracy(): number {
    return this._tagsTotal === 0 ? 1 : this._tagsCorrect / this._tagsTotal;
  }

  precision(): number {
    this._updateMeasures();
    const div = this._tp.length + this._fp.length;
    return div === 0 ? 0 : this._tp.length / div;
  }

  recall(): number {
    this._updateMeasures();
    const div = this._tp.length + this._fn.length;
    return div === 0 ? 0 : this._tp.length / div;
  }

  f_measure(alpha = 0.5): number {
    this._updateMeasures();
    const p = this.precision();
    const r = this.recall();
    if (p === 0 || r === 0) return 0;
    return 1 / (alpha / p + (1 - alpha) / r);
  }

  fMeasure(alpha = 0.5): number {
    return this.f_measure(alpha);
  }

  missed(): Piece[] {
    this._updateMeasures();
    return this._fn;
  }

  incorrect(): Piece[] {
    this._updateMeasures();
    return this._fp;
  }

  correct(): Piece[] {
    return [...this._correct.values()];
  }

  guessed(): Piece[] {
    return [...this._guessed.values()];
  }

  chunked(): Piece[] {
    this._updateMeasures();
    return this._tp;
  }

  get length(): number {
    this._updateMeasures();
    return this._tp.length + this._fn.length;
  }

  repr(): string {
    return `<ChunkScoring of ${this.length} chunks>`;
  }

  toString(): string {
    const pct = (v: number) => `${(v * 100).toFixed(1).padStart(5)}%`;
    return (
      `ChunkParse score:\n    IOB Accuracy: ${pct(this.accuracy())}\n` +
      `    Precision:    ${pct(this.precision())}\n    Recall:       ${pct(this.recall())}\n` +
      `    F-Measure:    ${pct(this.f_measure())}`
    );
  }
}

export class RegexpChunkParser {
  protected readonly _trace: number;

  constructor(
    private readonly _rules: RegexpChunkRule[],
    private readonly chunkLabel = "NP",
    private readonly rootLabel = "S",
    trace = 0,
  ) {
    this._trace = trace;
  }

  rules(): RegexpChunkRule[] {
    return this._rules;
  }

  private _apply(chunkstr: ChunkString, verbose: boolean): void {
    if (verbose) {
      console.log("# Input:");
      console.log(String(chunkstr));
      for (const rule of this._rules) {
        rule.apply(chunkstr);
        console.log("#", `${rule.descr()} (${String(rule)}):`);
        console.log(String(chunkstr));
      }
      return;
    }
    console.log("# Input:");
    console.log(String(chunkstr));
    for (const rule of this._rules) {
      rule.apply(chunkstr);
      console.log("#", `${rule.descr()}:`);
      console.log(String(chunkstr));
    }
  }

  parse(chunkStruct: ChunkTree | TaggedToken[], trace?: number): ChunkTree {
    const tree: ChunkTree = Array.isArray(chunkStruct)
      ? { label: this.rootLabel, children: chunkStruct }
      : chunkStruct;
    const tr = trace ?? this._trace;
    const chunkstr = new ChunkString(tree.label, tree.children, 1);
    if (tr > 0) this._apply(chunkstr, tr > 1);
    else for (const rule of this._rules) rule.apply(chunkstr);
    return chunkstr.to_chunkstruct(this.chunkLabel);
  }

  parse_one(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree {
    return this.parse(chunkStruct);
  }

  parseOne(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree {
    return this.parse(chunkStruct);
  }

  parse_all(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree[] {
    return [this.parse(chunkStruct)];
  }

  parseAll(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree[] {
    return this.parse_all(chunkStruct);
  }

  parse_sents(sents: Iterable<ChunkTree | TaggedToken[]>): ChunkTree[] {
    return [...sents].map((s) => this.parse(s));
  }

  parseSents(sents: Iterable<ChunkTree | TaggedToken[]>): ChunkTree[] {
    return this.parse_sents(sents);
  }

  evaluate(gold: ChunkTree[]): ChunkScore {
    return this.accuracy(gold);
  }

  accuracy(gold: ChunkTree[]): ChunkScore {
    const chunkscore = new ChunkScore();
    for (const correct of gold) {
      chunkscore.score(correct, this.parse(leaves(correct)));
    }
    return chunkscore;
  }
}

export class RegexpParser {
  private readonly _trace: number;
  private readonly _grammar: string;
  private readonly _loop: number;
  private readonly _stages: RegexpChunkParser[] = [];

  constructor(grammar: string | RegexpChunkParser[], rootLabel = "S", loop = 1, trace = 0) {
    this._trace = trace;
    this._grammar = grammar as string;
    this._loop = loop;
    if (typeof grammar === "string") {
      this._readGrammar(grammar, rootLabel, trace);
    } else {
      this._stages = [...grammar];
    }
  }

  private _readGrammar(grammar: string, rootLabel: string, trace: number): void {
    let rules: RegexpChunkRule[] = [];
    let lhs: string | null = null;
    const pattern = /^(?<nonterminal>(\.|[^:])*)(:(?<rule>.*))?$/;
    for (const raw of grammar.split("\n")) {
      const line = raw.trim();
      const m = pattern.exec(line);
      if (m && m.groups!.nonterminal !== undefined && line.includes(":")) {
        this._addStage(rules, lhs, rootLabel, trace);
        lhs = m.groups!.nonterminal.trim();
        rules = [];
        const rest = m.groups!.rule!.trim();
        if (rest === "" || rest.startsWith("#")) continue;
        rules.push(RegexpChunkRule.fromstring(rest));
        continue;
      }
      if (line === "" || line.startsWith("#")) continue;
      rules.push(RegexpChunkRule.fromstring(line));
    }
    this._addStage(rules, lhs, rootLabel, trace);
  }

  private _addStage(rules: RegexpChunkRule[], lhs: string | null, rootLabel: string, trace: number): void {
    if (rules.length === 0) return;
    this._stages.push(new RegexpChunkParser(rules, lhs ?? "NP", rootLabel, trace));
  }

  grammar(): string {
    return this._grammar;
  }

  parse(chunkStruct: ChunkTree | TaggedToken[], trace?: number): ChunkTree {
    const tr = trace ?? this._trace;
    let tree: ChunkTree = Array.isArray(chunkStruct)
      ? { label: "S", children: chunkStruct }
      : chunkStruct;
    for (const stage of this._stages) {
      for (let i = 0; i < this._loop; i++) {
        tree = stage.parse(tree, tr);
      }
    }
    return tree;
  }

  parse_one(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree {
    return this.parse(chunkStruct);
  }

  parseOne(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree {
    return this.parse(chunkStruct);
  }

  parse_all(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree[] {
    return [this.parse(chunkStruct)];
  }

  parseAll(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree[] {
    return this.parse_all(chunkStruct);
  }

  parse_sents(sents: Iterable<ChunkTree | TaggedToken[]>): ChunkTree[] {
    return [...sents].map((s) => this.parse(s));
  }

  parseSents(sents: Iterable<ChunkTree | TaggedToken[]>): ChunkTree[] {
    return this.parse_sents(sents);
  }

  evaluate(gold: ChunkTree[]): ChunkScore {
    const chunkscore = new ChunkScore();
    for (const correct of gold) {
      chunkscore.score(correct, this.parse(leaves(correct)));
    }
    return chunkscore;
  }

  accuracy(gold: ChunkTree[]): ChunkScore {
    return this.evaluate(gold);
  }
}
