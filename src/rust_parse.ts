import { ParsingRuntime } from "./parsing_runtime";

export { ParsingRuntime } from "./parsing_runtime";
export { RustCFG as CFG };
export type StringTree = { label: string; children: Array<StringTree | string> };
export type GrammarSymbol = Nonterminal | string;
export type RustTreePosition = readonly number[];
export type RustTreeOrder = "preorder" | "postorder" | "bothorder" | "leaves";
type WireSymbol = { kind: "nonterminal" | "terminal"; value: string };
type WireProduction = { lhs: string; rhs: WireSymbol[] };
type WireGrammar = { start: string; productions: WireProduction[] };

/** String-valued nonterminal, deliberately distinct from terminal strings. */
export class Nonterminal {
  constructor(private readonly name: string) {
    if (typeof name !== "string") throw new TypeError("nonterminal symbols must be strings");
  }
  symbol(): string { return this.name; }
  toString(): string { return this.name; }
  equals(other: unknown): boolean { return other instanceof Nonterminal && this.name === other.name; }
  slash(other: Nonterminal): Nonterminal { return new Nonterminal(`${this.name}/${other.name}`); }
}

export function nonterminals(symbols: string): Nonterminal[] {
  return symbols.split(/[\s,]+/).filter(Boolean).map((name) => new Nonterminal(name));
}

function symbolToWire(symbol: GrammarSymbol): WireSymbol {
  if (symbol instanceof Nonterminal) return { kind: "nonterminal", value: symbol.symbol() };
  if (typeof symbol === "string") return { kind: "terminal", value: symbol };
  throw new TypeError("grammar symbols must be Nonterminal or string");
}
function symbolFromWire(symbol: WireSymbol): GrammarSymbol {
  return symbol.kind === "nonterminal" ? new Nonterminal(symbol.value) : symbol.value;
}

export class Production {
  private readonly right: GrammarSymbol[];
  constructor(private readonly runtime: ParsingRuntime, private readonly left: Nonterminal, rhs: Iterable<GrammarSymbol>) {
    if (!(left instanceof Nonterminal)) throw new TypeError("production lhs must be a Nonterminal");
    this.right = [...rhs];
    for (const symbol of this.right) symbolToWire(symbol);
  }
  static fromWire(runtime: ParsingRuntime, wire: WireProduction): Production {
    return new Production(runtime, new Nonterminal(wire.lhs), wire.rhs.map(symbolFromWire));
  }
  toWire(): WireProduction { return { lhs: this.left.symbol(), rhs: this.right.map(symbolToWire) }; }
  lhs(): Nonterminal { return this.left; }
  rhs(): readonly GrammarSymbol[] { return [...this.right]; }
  get length(): number { return this.right.length; }
  is_lexical(): boolean { return this.runtime.request({ op: "production_lexical", production: this.toWire() }); }
  is_nonlexical(): boolean { return !this.is_lexical(); }
  toString(): string { return this.runtime.request({ op: "production_format", production: this.toWire() }); }
  equals(other: unknown): boolean {
    return other instanceof Production && JSON.stringify(this.toWire()) === JSON.stringify(other.toWire());
  }
}

type GrammarInfo = {
  min_len: number; max_len: number; is_lexical: boolean; is_nonlexical: boolean;
  is_nonempty: boolean; is_binarised: boolean; is_flexible_chomsky_normal_form: boolean; is_chomsky_normal_form: boolean;
};

/** Typed CFG contract. Kept separate from the legacy root CFG until migration gates pass. */
export class RustCFG {
  private readonly wire: WireGrammar;
  constructor(readonly runtime: ParsingRuntime, start: Nonterminal, productions: Iterable<Production>) {
    if (!(start instanceof Nonterminal)) throw new TypeError("CFG start must be a Nonterminal");
    this.wire = { start: start.symbol(), productions: [...productions].map((p) => p.toWire()) };
    runtime.request({ op: "grammar_info", grammar: this.wire });
  }
  static fromstring(runtime: ParsingRuntime, text: string | readonly string[]): RustCFG {
    const wire = runtime.request<WireGrammar>({ op: "grammar_fromstring", text: typeof text === "string" ? text : text.join("\n") });
    return new RustCFG(runtime, new Nonterminal(wire.start), wire.productions.map((p) => Production.fromWire(runtime, p)));
  }
  toWire(): WireGrammar { return structuredClone(this.wire); }
  start(): Nonterminal { return new Nonterminal(this.wire.start); }
  productions(options: { lhs?: Nonterminal; rhs?: GrammarSymbol; empty?: boolean } = {}): Production[] {
    const rows = this.runtime.request<WireProduction[]>({ op: "grammar_productions", grammar: this.wire,
      lhs: options.lhs?.symbol() ?? null, rhs: options.rhs === undefined ? null : symbolToWire(options.rhs), empty: options.empty ?? false });
    return rows.map((p) => Production.fromWire(this.runtime, p));
  }
  check_coverage(tokens: Iterable<string>): void { this.runtime.request({ op: "grammar_coverage", grammar: this.wire, tokens: [...tokens] }); }
  private info(): GrammarInfo { return this.runtime.request({ op: "grammar_info", grammar: this.wire }); }
  min_len(): number { return this.info().min_len; }
  max_len(): number { return this.info().max_len; }
  is_lexical(): boolean { return this.info().is_lexical; }
  is_nonlexical(): boolean { return this.info().is_nonlexical; }
  is_nonempty(): boolean { return this.info().is_nonempty; }
  is_binarised(): boolean { return this.info().is_binarised; }
  is_flexible_chomsky_normal_form(): boolean { return this.info().is_flexible_chomsky_normal_form; }
  is_chomsky_normal_form(): boolean { return this.info().is_chomsky_normal_form; }
  leftcorners(category: Nonterminal): Nonterminal[] {
    return this.runtime.request<string[]>({ op: "grammar_leftcorners", grammar: this.wire, category: category.symbol() }).map((s) => new Nonterminal(s));
  }
  leftcorner_parents(category: Nonterminal): Nonterminal[] {
    return this.runtime.request<string[]>({ op: "grammar_leftcorner_parents", grammar: this.wire, category: category.symbol() }).map((s) => new Nonterminal(s));
  }
  is_leftcorner(category: Nonterminal, left: GrammarSymbol): boolean {
    return this.runtime.request({ op: "grammar_is_leftcorner", grammar: this.wire, category: category.symbol(), left: symbolToWire(left) });
  }
}

export type TreeFormatOptions = {
  margin?: number; indent?: number; nodesep?: string; parens?: readonly [string, string];
  quotes?: boolean | readonly [string, string];
};

/** String-label/string-leaf Tree; every structural query is executed by Rust. */
export class Tree implements Iterable<Tree | string> {
  private readonly node: StringTree;
  constructor(readonly runtime: ParsingRuntime, label: string, children: Iterable<Tree | string> = []) {
    if (typeof label !== "string") throw new TypeError("tree labels must be strings");
    this.node = { label, children: [...children].map((c) => {
      if (c instanceof Tree) return c.node;
      if (typeof c !== "string") throw new TypeError("tree children must be Tree or string");
      return c;
    }) };
  }
  private static view(runtime: ParsingRuntime, node: StringTree): Tree {
    const tree = Object.create(Tree.prototype) as Tree;
    Object.defineProperties(tree, { runtime: { value: runtime }, node: { value: node } });
    return tree;
  }
  static fromPlain(runtime: ParsingRuntime, node: StringTree): Tree { return Tree.view(runtime, structuredClone(node)); }
  static fromstring(runtime: ParsingRuntime, text: string, options?: { remove_empty_top_bracketing?: false; brackets?: string }): Tree;
  static fromstring(runtime: ParsingRuntime, text: string, options: { remove_empty_top_bracketing: boolean; brackets?: string }): Tree | string;
  static fromstring(runtime: ParsingRuntime, text: string, options: { remove_empty_top_bracketing?: boolean; brackets?: string } = {}): Tree | string {
    const node = runtime.request<StringTree | string>({ op: "tree_fromstring", text, brackets: options.brackets ?? "()", remove_top: options.remove_empty_top_bracketing ?? false });
    return typeof node === "string" ? node : Tree.view(runtime, node);
  }
  toPlain(): StringTree { return structuredClone(this.node); }
  label(): string { return this.node.label; }
  set_label(label: string): void {
    if (typeof label !== "string") throw new TypeError("tree labels must be strings");
    this.node.label = label;
  }
  get length(): number { return this.node.children.length; }
  private atPath(path: readonly number[]): StringTree | string {
    let node: StringTree | string = this.node;
    for (const i of path) {
      if (typeof node === "string") throw new RangeError("tree position descends through a leaf");
      node = node.children[i]!;
    }
    return node;
  }
  private position(position: number | RustTreePosition): number[] {
    return this.runtime.request({ op: "tree_position", tree: this.node, position: typeof position === "number" ? [position] : position });
  }
  get(position: number | RustTreePosition): Tree | string {
    const path = this.position(position);
    if (path.length === 0) return this;
    const child = this.atPath(path);
    return typeof child === "string" ? child : Tree.view(this.runtime, child);
  }
  set(position: number | RustTreePosition, value: Tree | string): void {
    const path = this.position(position);
    if (!path.length) throw new RangeError("cannot assign the root tree position");
    const parent = this.atPath(path.slice(0, -1));
    if (typeof parent === "string") throw new RangeError("tree position descends through a leaf");
    if (!(value instanceof Tree) && typeof value !== "string") throw new TypeError("tree children must be Tree or string");
    parent.children[path[path.length - 1]!] = value instanceof Tree ? value.node : value;
  }
  delete(position: number | RustTreePosition): void {
    const path = this.position(position);
    if (!path.length) throw new RangeError("cannot delete the root tree position");
    const parent = this.atPath(path.slice(0, -1));
    if (typeof parent === "string") throw new RangeError("tree position descends through a leaf");
    parent.children.splice(path[path.length - 1]!, 1);
  }
  *[Symbol.iterator](): IterableIterator<Tree | string> {
    for (const child of this.node.children) yield typeof child === "string" ? child : Tree.view(this.runtime, child);
  }
  leaves(): string[] { return this.runtime.request({ op: "tree_leaves", tree: this.node }); }
  height(): number { return this.runtime.request({ op: "tree_height", tree: this.node }); }
  treepositions(order: RustTreeOrder = "preorder"): number[][] { return this.runtime.request({ op: "tree_positions", tree: this.node, order }); }
  leaf_treeposition(index: number): number[] { return this.runtime.request({ op: "tree_leaf_position", tree: this.node, index }); }
  treeposition_spanning_leaves(start: number, end: number): number[] { return this.runtime.request({ op: "tree_spanning", tree: this.node, start, end }); }
  pos(): Array<[string, string]> { return this.runtime.request({ op: "tree_pos", tree: this.node }); }
  productions(): Production[] { return this.runtime.request<WireProduction[]>({ op: "tree_productions", tree: this.node }).map((p) => Production.fromWire(this.runtime, p)); }
  *subtrees(filter?: (tree: Tree) => boolean): IterableIterator<Tree> {
    const paths = this.runtime.request<number[][]>({ op: "tree_subtrees", tree: this.node });
    for (const path of paths) {
      const node = this.atPath(path);
      if (typeof node === "string") continue;
      const tree = path.length === 0 ? this : Tree.view(this.runtime, node);
      if (!filter || filter(tree)) yield tree;
    }
  }
  flatten(): Tree { return new Tree(this.runtime, this.label(), this.leaves()); }
  copy(): Tree { return Tree.fromPlain(this.runtime, this.node); }
  pformat(options: TreeFormatOptions = {}): string {
    return this.runtime.request({ op: "tree_format", tree: this.node, format: {
      margin: options.margin ?? 70, indent: options.indent ?? 0, nodesep: options.nodesep ?? "", parens: options.parens ?? ["(", ")"],
      quotes: typeof options.quotes === "boolean" ? ["", ""] : options.quotes ?? ["", ""], repr_leaves: options.quotes === true,
    } });
  }
  toString(): string { return this.pformat(); }
}

export type RustParseOptions = { maxTrees?: number; maxStates?: number };
export type RustParseResult = { recognized: boolean; trees: Tree[]; truncated: boolean; cyclic: boolean; states: number };

/** Packed Earley chart parser, not an alias for the existing JS ChartParser. */
export class RustEarleyParser {
  constructor(private readonly grammar: RustCFG, private readonly options: RustParseOptions = {}) {}
  parseResult(tokens: Iterable<string>): RustParseResult {
    const result = this.grammar.runtime.request<Omit<RustParseResult, "trees"> & { trees: StringTree[] }>({ op: "parse", grammar: this.grammar.toWire(),
      tokens: [...tokens], max_trees: this.options.maxTrees ?? 1000, max_states: this.options.maxStates ?? 100000 });
    return { ...result, trees: result.trees.map((t) => Tree.fromPlain(this.grammar.runtime, t)) };
  }
  parse(tokens: Iterable<string>): Tree[] {
    const result = this.parseResult(tokens);
    if (result.cyclic) throw new Error("cyclic parse forest: use parseResult for explicit cycle metadata");
    if (result.truncated) throw new Error("parse forest exceeds maxTrees: use parseResult for explicit truncation metadata");
    return result.trees;
  }
  recognize(tokens: Iterable<string>): boolean {
    return new RustEarleyParser(this.grammar, { ...this.options, maxTrees: 0 }).parseResult(tokens).recognized;
  }
}
