import { ParsingRuntime } from "./parsing_runtime";

export { ParsingRuntime } from "./parsing_runtime";
export { RustCFG as CFG };
export type PlainRustTree<L = string> = { label: string; children: Array<PlainRustTree<L> | L> };
export type StringTree = PlainRustTree<string>;
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
  isLexical(): boolean { return this.is_lexical(); }
  isNonlexical(): boolean { return this.is_nonlexical(); }
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
  static fromString(runtime: ParsingRuntime, text: string | readonly string[]): RustCFG { return RustCFG.fromstring(runtime, text); }
  toWire(): WireGrammar { return structuredClone(this.wire); }
  start(): Nonterminal { return new Nonterminal(this.wire.start); }
  productions(options: { lhs?: Nonterminal; rhs?: GrammarSymbol; empty?: boolean } = {}): Production[] {
    const rows = this.runtime.request<WireProduction[]>({ op: "grammar_productions", grammar: this.wire,
      lhs: options.lhs?.symbol() ?? null, rhs: options.rhs === undefined ? null : symbolToWire(options.rhs), empty: options.empty ?? false });
    return rows.map((p) => Production.fromWire(this.runtime, p));
  }
  check_coverage(tokens: Iterable<string>): void { this.runtime.request({ op: "grammar_coverage", grammar: this.wire, tokens: [...tokens] }); }
  checkCoverage(tokens: Iterable<string>): void { this.check_coverage(tokens); }
  private info(): GrammarInfo { return this.runtime.request({ op: "grammar_info", grammar: this.wire }); }
  min_len(): number { return this.info().min_len; }
  max_len(): number { return this.info().max_len; }
  is_lexical(): boolean { return this.info().is_lexical; }
  is_nonlexical(): boolean { return this.info().is_nonlexical; }
  is_nonempty(): boolean { return this.info().is_nonempty; }
  is_binarised(): boolean { return this.info().is_binarised; }
  is_flexible_chomsky_normal_form(): boolean { return this.info().is_flexible_chomsky_normal_form; }
  is_chomsky_normal_form(): boolean { return this.info().is_chomsky_normal_form; }
  minLen(): number { return this.min_len(); }
  maxLen(): number { return this.max_len(); }
  isLexical(): boolean { return this.is_lexical(); }
  isNonlexical(): boolean { return this.is_nonlexical(); }
  isNonempty(): boolean { return this.is_nonempty(); }
  isBinarised(): boolean { return this.is_binarised(); }
  isFlexibleChomskyNormalForm(): boolean { return this.is_flexible_chomsky_normal_form(); }
  isChomskyNormalForm(): boolean { return this.is_chomsky_normal_form(); }
  leftcorners(category: Nonterminal): Nonterminal[] {
    return this.runtime.request<string[]>({ op: "grammar_leftcorners", grammar: this.wire, category: category.symbol() }).map((s) => new Nonterminal(s));
  }
  leftcorner_parents(category: Nonterminal): Nonterminal[] {
    return this.runtime.request<string[]>({ op: "grammar_leftcorner_parents", grammar: this.wire, category: category.symbol() }).map((s) => new Nonterminal(s));
  }
  is_leftcorner(category: Nonterminal, left: GrammarSymbol): boolean {
    return this.runtime.request({ op: "grammar_is_leftcorner", grammar: this.wire, category: category.symbol(), left: symbolToWire(left) });
  }
  leftCorners(category: Nonterminal): Nonterminal[] { return this.leftcorners(category); }
  leftcornerParents(category: Nonterminal): Nonterminal[] { return this.leftcorner_parents(category); }
  isLeftcorner(category: Nonterminal, left: GrammarSymbol): boolean { return this.is_leftcorner(category, left); }
}

export type TreeFormatOptions = {
  margin?: number; indent?: number; nodesep?: string; parens?: readonly [string, string];
  quotes?: boolean | readonly [string, string];
};

type TreeSlot<L> = { kind: "tree"; node: TreeNode<L> } | { kind: "leaf"; value: L };
type TreeNode<L> = { label: string; children: TreeSlot<L>[] };
export type TreeSlice = { start?: number; stop?: number; step?: number };

/** Rust structural/list operations with opaque leaf slots, never stringified objects. */
export class Tree<L = string> implements Iterable<Tree<L> | L> {
  private readonly node: TreeNode<L>;
  constructor(readonly runtime: ParsingRuntime, label: string, children: Iterable<Tree<L> | L> = []) {
    if (typeof label !== "string") throw new TypeError("tree labels must be strings");
    this.node = { label, children: [...children].map((c) => this.slot(c)) };
  }
  private slot(value: Tree<L> | L): TreeSlot<L> {
    return value instanceof Tree ? { kind: "tree", node: value.node } : { kind: "leaf", value };
  }
  private value(slot: TreeSlot<L>): Tree<L> | L {
    return slot.kind === "tree" ? Tree.view(this.runtime, slot.node) : slot.value;
  }
  private static view<L>(runtime: ParsingRuntime, node: TreeNode<L>): Tree<L> {
    const tree = Object.create(Tree.prototype) as Tree<L>;
    Object.defineProperties(tree, { runtime: { value: runtime }, node: { value: node } });
    return tree;
  }
  static fromPlain(runtime: ParsingRuntime, node: StringTree): Tree {
    return new Tree(runtime, node.label, node.children.map((c) => typeof c === "string" ? c : Tree.fromPlain(runtime, c)));
  }
  static fromstring(runtime: ParsingRuntime, text: string, options?: { remove_empty_top_bracketing?: false; brackets?: string }): Tree;
  static fromstring(runtime: ParsingRuntime, text: string, options: { remove_empty_top_bracketing: boolean; brackets?: string }): Tree | string;
  static fromstring(runtime: ParsingRuntime, text: string, options: { remove_empty_top_bracketing?: boolean; brackets?: string } = {}): Tree | string {
    const node = runtime.request<StringTree | string>({ op: "tree_fromstring", text, brackets: options.brackets ?? "()", remove_top: options.remove_empty_top_bracketing ?? false });
    return typeof node === "string" ? node : Tree.fromPlain(runtime, node);
  }
  static fromString(runtime: ParsingRuntime, text: string): Tree { return Tree.fromstring(runtime, text); }
  toPlain(): PlainRustTree<L> {
    this.wire();
    const plain = (node: TreeNode<L>): PlainRustTree<L> => ({ label: node.label,
      children: node.children.map((c) => c.kind === "tree" ? plain(c.node) : c.value) });
    return plain(this.node);
  }
  /** Every leaf uses its own numeric slot even if values have identical string/repr forms. */
  private wire(strings = false): { tree: StringTree; leaves: L[] } {
    const leaves: L[] = [];
    const active = new Set<TreeNode<L>>();
    const visit = (node: TreeNode<L>, depth: number): StringTree => {
      if (depth > 256 || active.has(node)) throw new RangeError("cyclic or excessive tree depth");
      active.add(node);
      const tree = { label: node.label, children: node.children.map((c): StringTree | string => {
        if (c.kind === "tree") return visit(c.node, depth + 1);
        leaves.push(c.value);
        if (strings) {
          if (typeof c.value !== "string") throw new TypeError("formatting/productions currently require string leaves");
          return c.value;
        }
        return String(leaves.length - 1);
      }) };
      active.delete(node);
      return tree;
    };
    return { tree: visit(this.node, 0), leaves };
  }
  label(): string { return this.node.label; }
  set_label(label: string): void {
    if (typeof label !== "string") throw new TypeError("tree labels must be strings");
    this.node.label = label;
  }
  setLabel(label: string): void { this.set_label(label); }
  get length(): number { return this.node.children.length; }
  private atPath(path: readonly number[]): TreeSlot<L> {
    let slot: TreeSlot<L> = { kind: "tree", node: this.node };
    for (const i of path) {
      if (slot.kind === "leaf") throw new RangeError("tree position descends through a leaf");
      slot = slot.node.children[i]!;
    }
    return slot;
  }
  private position(position: number | RustTreePosition): number[] {
    return this.runtime.request({ op: "tree_position", tree: this.wire().tree, position: typeof position === "number" ? [position] : position });
  }
  get(position: number | RustTreePosition): Tree<L> | L {
    const path = this.position(position);
    if (path.length === 0) return this;
    return this.value(this.atPath(path));
  }
  set(position: number | RustTreePosition, value: Tree<L> | L): void {
    const path = this.position(position);
    if (!path.length) throw new RangeError("cannot assign the root tree position");
    const parent = this.atPath(path.slice(0, -1));
    if (parent.kind === "leaf") throw new RangeError("tree position descends through a leaf");
    parent.node.children[path[path.length - 1]!] = this.slot(value);
  }
  delete(position: number | RustTreePosition): void {
    const path = this.position(position);
    if (!path.length) throw new RangeError("cannot delete the root tree position");
    const parent = this.atPath(path.slice(0, -1));
    if (parent.kind === "leaf") throw new RangeError("tree position descends through a leaf");
    parent.node.children.splice(path[path.length - 1]!, 1);
  }
  private listPlan(action: string, options: object = {}): number[] {
    for (const [name, value] of Object.entries(options)) {
      if (value !== null && !Number.isSafeInteger(value)) throw new TypeError(`${name} must be a safe integer`);
    }
    return this.runtime.request({ op: "tree_list_plan", len: this.length, edit: { action, ...options } });
  }
  private applyPlan(plan: number[], values: Array<Tree<L> | L> = []): void {
    const old = this.node.children;
    this.node.children = plan.map((slot) => slot < 0 ? this.slot(values[-slot - 1]!) : old[slot]!);
  }
  append(value: Tree<L> | L): void { this.insert(this.length, value); }
  extend(values: Iterable<Tree<L> | L>): void { this.setSlice({ start: this.length }, values); }
  insert(index: number, value: Tree<L> | L): void { this.applyPlan(this.listPlan("insert", { index }), [value]); }
  pop(index = -1): Tree<L> | L {
    const plan = this.listPlan("pop", { index });
    const normalized = index < 0 ? this.length + index : index;
    const value = this.value(this.node.children[normalized]!);
    this.applyPlan(plan);
    return value;
  }
  reverse(): void { this.applyPlan(this.listPlan("reverse")); }
  clear(): void { this.deleteSlice({}); }
  slice(options: TreeSlice = {}): Array<Tree<L> | L> {
    return this.listPlan("slice", { start: options.start ?? null, stop: options.stop ?? null, step: options.step ?? 1 })
      .map((i) => this.value(this.node.children[i]!));
  }
  setSlice(options: TreeSlice, values: Iterable<Tree<L> | L>): void {
    const replacements = [...values];
    this.applyPlan(this.listPlan("set_slice", { start: options.start ?? null, stop: options.stop ?? null, step: options.step ?? 1, count: replacements.length }), replacements);
  }
  deleteSlice(options: TreeSlice): void {
    this.applyPlan(this.listPlan("delete_slice", { start: options.start ?? null, stop: options.stop ?? null, step: options.step ?? 1 }));
  }
  set_slice(options: TreeSlice, values: Iterable<Tree<L> | L>): void { this.setSlice(options, values); }
  delete_slice(options: TreeSlice): void { this.deleteSlice(options); }
  *[Symbol.iterator](): IterableIterator<Tree<L> | L> {
    for (const child of this.node.children) yield this.value(child);
  }
  leaves(): L[] {
    const wire = this.wire();
    return this.runtime.request<string[]>({ op: "tree_leaves", tree: wire.tree }).map((i) => wire.leaves[Number(i)]!);
  }
  height(): number { return this.runtime.request({ op: "tree_height", tree: this.wire().tree }); }
  treepositions(order: RustTreeOrder = "preorder"): number[][] { return this.runtime.request({ op: "tree_positions", tree: this.wire().tree, order }); }
  treePositions(order: RustTreeOrder = "preorder"): number[][] { return this.treepositions(order); }
  leaf_treeposition(index: number): number[] { return this.runtime.request({ op: "tree_leaf_position", tree: this.wire().tree, index }); }
  leafTreeposition(index: number): number[] { return this.leaf_treeposition(index); }
  treeposition_spanning_leaves(start: number, end: number): number[] { return this.runtime.request({ op: "tree_spanning", tree: this.wire().tree, start, end }); }
  treepositionSpanningLeaves(start: number, end: number): number[] { return this.treeposition_spanning_leaves(start, end); }
  pos(): Array<[L, string]> {
    const wire = this.wire();
    return this.runtime.request<Array<[string, string]>>({ op: "tree_pos", tree: wire.tree }).map(([i, label]) => [wire.leaves[Number(i)]!, label]);
  }
  productions(): Production[] { return this.runtime.request<WireProduction[]>({ op: "tree_productions", tree: this.wire(true).tree }).map((p) => Production.fromWire(this.runtime, p)); }
  *subtrees(filter?: (tree: Tree<L>) => boolean): IterableIterator<Tree<L>> {
    const paths = this.runtime.request<number[][]>({ op: "tree_subtrees", tree: this.wire().tree });
    for (const path of paths) {
      const node = this.atPath(path);
      if (node.kind === "leaf") continue;
      const tree = path.length === 0 ? this : Tree.view(this.runtime, node.node);
      if (!filter || filter(tree)) yield tree;
    }
  }
  flatten(): Tree<L> { return new Tree(this.runtime, this.label(), this.leaves()); }
  copy(deep = true): Tree<L> {
    this.wire();
    const clone = (tree: Tree<L>): Tree<L> => new Tree(this.runtime, tree.label(), [...tree].map((c) => deep && c instanceof Tree ? clone(c) : c));
    return clone(this);
  }
  pformat(options: TreeFormatOptions = {}): string {
    return this.runtime.request({ op: "tree_format", tree: this.wire(true).tree, format: {
      margin: options.margin ?? 70, indent: options.indent ?? 0, nodesep: options.nodesep ?? "", parens: options.parens ?? ["(", ")"],
      quotes: typeof options.quotes === "boolean" ? ["", ""] : options.quotes ?? ["", ""], repr_leaves: options.quotes === true,
    } });
  }
  toString(): string { return this.pformat(); }
}

export type RustParseOptions = { maxTrees?: number; maxStates?: number; max_trees?: number; max_states?: number };
export type RustParseResult = { recognized: boolean; trees: Tree[]; truncated: boolean; cyclic: boolean; states: number };

/** Packed Earley chart parser, not an alias for the existing JS ChartParser. */
export class RustEarleyParser {
  constructor(private readonly grammar: RustCFG, private readonly options: RustParseOptions = {}) {}
  parseResult(tokens: Iterable<string>): RustParseResult {
    const result = this.grammar.runtime.request<Omit<RustParseResult, "trees"> & { trees: StringTree[] }>({ op: "parse", grammar: this.grammar.toWire(),
      tokens: [...tokens], max_trees: this.options.maxTrees ?? this.options.max_trees ?? 1000, max_states: this.options.maxStates ?? this.options.max_states ?? 100000 });
    return { ...result, trees: result.trees.map((t) => Tree.fromPlain(this.grammar.runtime, t)) };
  }
  parse(tokens: Iterable<string>): Tree[] {
    const result = this.parseResult(tokens);
    if (result.cyclic) throw new Error("cyclic parse forest: use parseResult for explicit cycle metadata");
    if (result.truncated) throw new Error("parse forest exceeds maxTrees: use parseResult for explicit truncation metadata");
    return result.trees;
  }
  parse_result(tokens: Iterable<string>): RustParseResult { return this.parseResult(tokens); }
  recognize(tokens: Iterable<string>): boolean {
    return new RustEarleyParser(this.grammar, { ...this.options, maxTrees: 0 }).parseResult(tokens).recognized;
  }
}

type WireWeightedProduction = WireProduction & { prob: number };
type WirePcfg = { start: string; productions: WireWeightedProduction[] };

export class ProbabilisticProduction extends Production {
  constructor(private readonly weightedRuntime: ParsingRuntime, lhs: Nonterminal, rhs: Iterable<GrammarSymbol>, private readonly probability: number) {
    super(weightedRuntime, lhs, rhs);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new RangeError("production probability must be in [0, 1]");
  }
  prob(): number { return this.probability; }
  logprob(): number { return Math.log2(this.probability); }
  override toWire(): WireWeightedProduction { return { ...super.toWire(), prob: this.probability }; }
  override equals(other: unknown): boolean { return other instanceof ProbabilisticProduction && super.equals(other); }
  override toString(): string { return this.weightedRuntime.request({ op: "weighted_production_format", production: this.toWire() }); }
}

/** PCFG is additive: it does not replace the legacy root probability grammar. */
export class RustPCFG extends RustCFG {
  private readonly weighted: WirePcfg;
  constructor(runtime: ParsingRuntime, start: Nonterminal, productions: Iterable<ProbabilisticProduction>) {
    const rows = [...productions];
    super(runtime, start, rows);
    this.weighted = { start: start.symbol(), productions: rows.map((p) => p.toWire()) };
    runtime.request({ op: "pcfg_validate", grammar: this.weighted });
  }
  static override fromstring(runtime: ParsingRuntime, text: string | readonly string[]): RustPCFG {
    const wire = runtime.request<WirePcfg>({ op: "pcfg_fromstring", text: typeof text === "string" ? text : text.join("\n") });
    return new RustPCFG(runtime, new Nonterminal(wire.start), wire.productions.map((p) => new ProbabilisticProduction(runtime, new Nonterminal(p.lhs), p.rhs.map(symbolFromWire), p.prob)));
  }
  static override fromString(runtime: ParsingRuntime, text: string | readonly string[]): RustPCFG { return RustPCFG.fromstring(runtime, text); }
  override toWire(): WirePcfg { return structuredClone(this.weighted); }
  override productions(options: { lhs?: Nonterminal; rhs?: GrammarSymbol; empty?: boolean } = {}): ProbabilisticProduction[] {
    const rows = this.runtime.request<WireWeightedProduction[]>({ op: "pcfg_productions", grammar: this.weighted,
      lhs: options.lhs?.symbol() ?? null, rhs: options.rhs === undefined ? null : symbolToWire(options.rhs), empty: options.empty ?? false });
    return rows.map((p) => new ProbabilisticProduction(this.runtime, new Nonterminal(p.lhs), p.rhs.map(symbolFromWire), p.prob));
  }
}
export { RustPCFG as PCFG };
export type RustViterbiResult = { tree: Tree; prob: number; logProb: number };

export class RustViterbiParser {
  constructor(private readonly grammar: RustPCFG, private readonly options: { maxWork?: number; max_work?: number } = {}) {}
  parseResult(tokens: Iterable<string>): RustViterbiResult | null {
    const result = this.grammar.runtime.request<{ tree: StringTree; prob: number; log_prob: number | null } | null>({ op: "viterbi", grammar: this.grammar.toWire(), tokens: [...tokens],
      max_work: this.options.maxWork ?? this.options.max_work ?? 1000000 });
    return result === null ? null : { tree: Tree.fromPlain(this.grammar.runtime, result.tree), prob: result.prob, logProb: result.log_prob ?? -Infinity };
  }
  parse_result(tokens: Iterable<string>): RustViterbiResult | null { return this.parseResult(tokens); }
  parse(tokens: Iterable<string>): Tree[] { const result = this.parseResult(tokens); return result ? [result.tree] : []; }
}
