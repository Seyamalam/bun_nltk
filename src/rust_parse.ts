import { ParsingRuntime } from "./parsing_runtime";
import { Nonterminal, Production as BaseProduction, type GrammarSymbol } from "./grammar";

export { ParsingRuntime } from "./parsing_runtime";
export { RustCFG as CFG };
export type PlainRustTree<L = string> = { label: string; children: Array<PlainRustTree<L> | L> };
export type StringTree = PlainRustTree<string>;
export { Nonterminal, nonterminals, type GrammarSymbol } from "./grammar";
export type RustTreePosition = readonly number[];
export type RustTreeOrder = "preorder" | "postorder" | "bothorder" | "leaves";
type WireSymbol = { kind: "nonterminal" | "terminal"; value: string };
type WireProduction = { lhs: string; rhs: WireSymbol[] };
type WireGrammar = { start: string; productions: WireProduction[] };

function symbolToWire(symbol: GrammarSymbol): WireSymbol {
  if (symbol instanceof Nonterminal) return { kind: "nonterminal", value: symbol.symbol() };
  if (typeof symbol === "string") return { kind: "terminal", value: symbol };
  throw new TypeError("grammar symbols must be Nonterminal or string");
}
function symbolFromWire(symbol: WireSymbol): GrammarSymbol {
  return symbol.kind === "nonterminal" ? new Nonterminal(symbol.value) : symbol.value;
}

export class Production extends BaseProduction {
  constructor(private readonly runtime: ParsingRuntime, lhs: Nonterminal, rhs: Iterable<GrammarSymbol>) {
    super(lhs, rhs);
    if (!(lhs instanceof Nonterminal)) throw new TypeError("production lhs must be a Nonterminal");
    for (const symbol of this.rhs()) symbolToWire(symbol);
  }
  static fromWire(runtime: ParsingRuntime, wire: WireProduction): Production {
    return new Production(runtime, new Nonterminal(wire.lhs), wire.rhs.map(symbolFromWire));
  }
  toWire(): WireProduction { return { lhs: this.lhs().symbol(), rhs: this.rhs().map(symbolToWire) }; }
  override is_lexical(): boolean { return this.runtime.request({ op: "production_lexical", production: this.toWire() }); }
  override is_nonlexical(): boolean { return !this.is_lexical(); }
  override toString(): string { return this.runtime.request({ op: "production_format", production: this.toWire() }); }
  override equals(other: unknown): boolean {
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

  // ---- NLTK nltk.tree.tree.Tree surface --------------------------------------

  private childEquals(slot: TreeSlot<L>, value: Tree<L> | L): boolean {
    if (slot.kind === "tree") return value instanceof Tree && this.plainNode(slot.node) === (value as Tree<L>).plainNode((value as Tree<L>).node);
    return Object.is(slot.value, value);
  }
  private plainNode(node: TreeNode<L>): string {
    return JSON.stringify(node, (_k, v) => v instanceof Tree ? undefined : v);
  }
  /** Python list.index — first child equal (by structure/leaf value) to `value`. */
  index(value: Tree<L> | L, start = 0, stop?: number): number {
    const n = this.length;
    const lo = Math.max(0, start < 0 ? n + start : start);
    const hi = Math.min(n, stop === undefined ? n : stop < 0 ? n + stop : stop);
    for (let i = lo; i < hi; i++) if (this.childEquals(this.node.children[i]!, value)) return i;
    throw new Error(`${JSON.stringify(value)} is not in list`);
  }
  /** Python list.count — number of children equal to `value`. */
  count(value: Tree<L> | L): number {
    let n = 0;
    for (const child of this.node.children) if (this.childEquals(child, value)) n += 1;
    return n;
  }
  /** Python list.remove — deletes the first child equal to `value`. */
  remove(value: Tree<L> | L): void { this.delete(this.index(value)); }
  /**
   * Python list.sort. With no key, sorts by node label then structure —
   * matching NLTK's homogeneous-children ordering (`Tree.__lt__` compares
   * label then children).
   */
  sort(key?: (child: Tree<L> | L) => string | number, reverse = false): void {
    const keyFn = key ?? ((c: Tree<L> | L) => (c instanceof Tree ? "" + c.label() : String(c)));
    const order = new Map<TreeSlot<L>, string | number>();
    for (const child of this.node.children) order.set(child, keyFn(this.value(child)));
    this.node.children.sort((a, b) => {
      const ka = order.get(a)!, kb = order.get(b)!;
      const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
      return reverse ? -cmp : cmp;
    });
  }
  /** NLTK `Tree.freeze` — returns an immutable deep copy (leaves optionally mapped). */
  freeze(leafFreezer?: (leaf: L) => L): Tree<L> {
    const copy = this.copy(true);
    if (leafFreezer) {
      for (const pos of copy.treepositions("leaves")) {
        const path = pos as number[];
        let node = copy.node;
        for (let i = 0; i < path.length - 1; i++) node = (node.children[path[i]!] as { node: TreeNode<L> }).node;
        const last = path[path.length - 1]!;
        node.children[last] = { kind: "leaf", value: leafFreezer((node.children[last] as { value: L }).value) };
      }
    }
    Object.freeze(copy.node);
    return copy;
  }
  /** NLTK `Tree.convert` classmethod — builds a `cls` tree from any tree. */
  static convert<L>(runtime: ParsingRuntime, tree: Tree<L> | L, cls?: new (label: string, children: Array<Tree<L> | L>) => Tree<L>): Tree<L> | L {
    if (!(tree instanceof Tree)) return tree;
    const children = [...tree].map((c) => Tree.convert(runtime, c, cls));
    if (cls) return new cls(tree.label(), children);
    return new Tree(runtime, tree.label(), children);
  }
  /** NLTK `Tree.fromlist` — converts nested lists to a Tree (repr'd first element labels). */
  static fromlist(runtime: ParsingRuntime, l: unknown): Tree | string {
    const pyRepr = (v: unknown): string => {
      if (Array.isArray(v)) return `[${v.map(pyRepr).join(", ")}]`;
      if (typeof v === "string") return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
      return String(v);
    };
    if (Array.isArray(l) && l.length > 0) {
      const label = pyRepr(l[0]);
      if (l.length > 1) return new Tree(runtime, label, l.slice(1).map((c) => Tree.fromlist(runtime, c) as Tree | string));
      return label;
    }
    // NLTK falls through and returns None for non-list children.
    return null as unknown as string;
  }
  /** NLTK `Tree.pprint` — prints pformat; returns the printed text. */
  pprint(options: TreeFormatOptions = {}): string {
    const text = this.pformat(options);
    console.log(text);
    return text;
  }
  /** NLTK `Tree.pformat_latex_qtree`. */
  pformat_latex_qtree(): string {
    const pformat = this.pformat({ indent: 6, nodesep: "", parens: ["[.", " ]"] });
    return "\\Tree " + pformat.replace(/([#$%&~_{}])/g, "\\$1");
  }
  pformatLatexQtree(): string { return this.pformat_latex_qtree(); }
  /** NLTK `Tree.pformat_latex_forest`. */
  pformat_latex_forest(): string {
    const pformat = this.pformat({ indent: 2, parens: ["[", " ]"], quotes: ["[", "]"] })
      .replace(/([#$%&~_{}])/g, "\\$1");
    return "\\begin{forest}\n  " + pformat + "\n\\end{forest}";
  }
  pformatLatexForest(): string { return this.pformat_latex_forest(); }
  /** NLTK `Tree.pretty_print` — ASCII-art rendering requires the full
   *  nltk.tree.prettyprinter port; gap for now. */
  pretty_print(): string { throw new Error("pretty_print requires nltk.tree.prettyprinter (not yet ported)"); }
  /** NLTK `Tree.draw` — tkinter-backed in Python; unsupported here. */
  draw(): never { throw new Error("Tree.draw requires tkinter (unsupported)"); }

  /** NLTK nltk.tree.transforms.chomsky_normal_form — mutates this tree. */
  chomsky_normal_form(factor: "right" | "left" = "right", horzMarkov?: number, vertMarkov = 0, childChar = "|", parentChar = "^"): void {
    const horz = horzMarkov ?? 999;
    type Entry = { node: Tree<L> | L; parent: string[] };
    const nodeList: Entry[] = [{ node: this, parent: [this.label()] }];
    while (nodeList.length) {
      const { node, parent: parentChain } = nodeList.pop()!;
      let parent = parentChain;
      if (!(node instanceof Tree)) continue;
      let parentString = "";
      const originalNode = node.label();
      const firstChild = node.get(0);
      if (vertMarkov !== 0 && node !== (this as Tree<L>) && firstChild instanceof Tree) {
        parentString = `${parentChar}<${parent.join("-")}>`;
        node.set_label(node.label() + parentString);
        parent = [originalNode, ...parent.slice(0, vertMarkov - 1)];
      }
      for (const child of node) nodeList.push({ node: child, parent });
      if (node.length > 2) {
        const childNodes = [...node].map((c) => (c instanceof Tree ? c.label() : String(c)));
        const nodeCopy = node.copy();
        node.deleteSlice({});
        let curNode = node;
        const numChildren = nodeCopy.length;
        for (let i = 1; i < numChildren - 1; i++) {
          if (factor === "right") {
            const newHead = `${originalNode}${childChar}<${childNodes.slice(i, Math.min(i + horz, numChildren)).join("-")}>${parentString}`;
            const newNode = new Tree(this.runtime, newHead, []);
            const popped = nodeCopy.pop(0)!;
            curNode.setSlice({}, [popped, newNode]);
            curNode = newNode;
          } else {
            const newHead = `${originalNode}${childChar}<${childNodes.slice(Math.max(numChildren - i - horz, 0), numChildren - i).join("-")}>${parentString}`;
            const newNode = new Tree(this.runtime, newHead, []);
            const popped = nodeCopy.pop()!;
            curNode.setSlice({}, [newNode, popped]);
            curNode = newNode;
          }
        }
        curNode.setSlice({}, [...nodeCopy]);
      }
    }
  }
  chomskyNormalForm(factor: "right" | "left" = "right", horzMarkov?: number, vertMarkov = 0, childChar = "|", parentChar = "^"): void {
    this.chomsky_normal_form(factor, horzMarkov, vertMarkov, childChar, parentChar);
  }

  /** NLTK nltk.tree.transforms.un_chomsky_normal_form — mutates this tree. */
  un_chomsky_normal_form(expandUnary = true, childChar = "|", parentChar = "^", unaryChar = "+"): void {
    const nodeList: Array<Tree<L> | L> = [this];
    while (nodeList.length) {
      const node = nodeList.pop()!;
      if (!(node instanceof Tree)) continue;
      const children = [...node];
      if (children.some((c) => c instanceof Tree && c.label().includes(childChar))) {
        const newChildren: Array<Tree<L> | L> = [];
        const stack = [...children].reverse();
        while (stack.length) {
          const child = stack.pop()!;
          if (child instanceof Tree && child.label().includes(childChar)) {
            stack.push(...[...child].reverse());
          } else {
            newChildren.push(child);
          }
        }
        node.setSlice({}, newChildren);
      }
      const parentIndex = node.label().indexOf(parentChar);
      if (parentIndex !== -1) node.set_label(node.label().slice(0, parentIndex));
      if (expandUnary) {
        const unaryIndex = node.label().indexOf(unaryChar);
        if (unaryIndex !== -1) {
          const newNode = new Tree(this.runtime, node.label().slice(unaryIndex + 1), [...node]);
          node.set_label(node.label().slice(0, unaryIndex));
          node.setSlice({}, [newNode]);
        }
      }
      for (const child of node) nodeList.push(child);
    }
  }
  unChomskyNormalForm(expandUnary = true, childChar = "|", parentChar = "^", unaryChar = "+"): void {
    this.un_chomsky_normal_form(expandUnary, childChar, parentChar, unaryChar);
  }

  /** NLTK nltk.tree.transforms.collapse_unary — mutates this tree. */
  collapse_unary(collapsePOS = false, collapseRoot = false, joinChar = "+"): void {
    let nodeList: Array<Tree<L> | L>;
    const rootFirst = this.get(0);
    if (!collapseRoot && this.length === 1) {
      nodeList = [rootFirst];
    } else {
      nodeList = [this];
    }
    while (nodeList.length) {
      const node = nodeList.pop()!;
      if (!(node instanceof Tree)) continue;
      const first = node.get(0);
      const grandchild = first instanceof Tree ? first.get(0) : undefined;
      if (node.length === 1 && first instanceof Tree && (collapsePOS || grandchild instanceof Tree)) {
        node.set_label(node.label() + joinChar + first.label());
        node.setSlice({}, [...first]);
        nodeList.push(node);
      } else {
        for (const child of node) nodeList.push(child);
      }
    }
  }
  collapseUnary(collapsePOS = false, collapseRoot = false, joinChar = "+"): void {
    this.collapse_unary(collapsePOS, collapseRoot, joinChar);
  }
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
