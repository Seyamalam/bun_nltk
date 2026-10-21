import { ParsingRuntime } from "./parsing_runtime.js";
export { ParsingRuntime } from "./parsing_runtime.js";
export { RustCFG as CFG };

export class Nonterminal {
  name;
  constructor(name) {
    this.name = name;
    if (typeof name !== "string")
      throw new TypeError("nonterminal symbols must be strings");
  }
  symbol() {
    return this.name;
  }
  toString() {
    return this.name;
  }
  equals(other) {
    return other instanceof Nonterminal && this.name === other.name;
  }
  slash(other) {
    return new Nonterminal(`${this.name}/${other.name}`);
  }
}
export function nonterminals(symbols) {
  return symbols.split(/[\s,]+/).filter(Boolean).map((name) => new Nonterminal(name));
}
function symbolToWire(symbol) {
  if (symbol instanceof Nonterminal)
    return { kind: "nonterminal", value: symbol.symbol() };
  if (typeof symbol === "string")
    return { kind: "terminal", value: symbol };
  throw new TypeError("grammar symbols must be Nonterminal or string");
}
function symbolFromWire(symbol) {
  return symbol.kind === "nonterminal" ? new Nonterminal(symbol.value) : symbol.value;
}

export class Production {
  runtime;
  left;
  right;
  constructor(runtime, left, rhs) {
    this.runtime = runtime;
    this.left = left;
    if (!(left instanceof Nonterminal))
      throw new TypeError("production lhs must be a Nonterminal");
    this.right = [...rhs];
    for (const symbol of this.right)
      symbolToWire(symbol);
  }
  static fromWire(runtime, wire) {
    return new Production(runtime, new Nonterminal(wire.lhs), wire.rhs.map(symbolFromWire));
  }
  toWire() {
    return { lhs: this.left.symbol(), rhs: this.right.map(symbolToWire) };
  }
  lhs() {
    return this.left;
  }
  rhs() {
    return [...this.right];
  }
  get length() {
    return this.right.length;
  }
  is_lexical() {
    return this.runtime.request({ op: "production_lexical", production: this.toWire() });
  }
  is_nonlexical() {
    return !this.is_lexical();
  }
  toString() {
    return this.runtime.request({ op: "production_format", production: this.toWire() });
  }
  equals(other) {
    return other instanceof Production && JSON.stringify(this.toWire()) === JSON.stringify(other.toWire());
  }
}

export class RustCFG {
  runtime;
  wire;
  constructor(runtime, start, productions) {
    this.runtime = runtime;
    if (!(start instanceof Nonterminal))
      throw new TypeError("CFG start must be a Nonterminal");
    this.wire = { start: start.symbol(), productions: [...productions].map((p) => p.toWire()) };
    runtime.request({ op: "grammar_info", grammar: this.wire });
  }
  static fromstring(runtime, text) {
    const wire = runtime.request({ op: "grammar_fromstring", text: typeof text === "string" ? text : text.join(`
`) });
    return new RustCFG(runtime, new Nonterminal(wire.start), wire.productions.map((p) => Production.fromWire(runtime, p)));
  }
  toWire() {
    return structuredClone(this.wire);
  }
  start() {
    return new Nonterminal(this.wire.start);
  }
  productions(options = {}) {
    const rows = this.runtime.request({
      op: "grammar_productions",
      grammar: this.wire,
      lhs: options.lhs?.symbol() ?? null,
      rhs: options.rhs === undefined ? null : symbolToWire(options.rhs),
      empty: options.empty ?? false
    });
    return rows.map((p) => Production.fromWire(this.runtime, p));
  }
  check_coverage(tokens) {
    this.runtime.request({ op: "grammar_coverage", grammar: this.wire, tokens: [...tokens] });
  }
  info() {
    return this.runtime.request({ op: "grammar_info", grammar: this.wire });
  }
  min_len() {
    return this.info().min_len;
  }
  max_len() {
    return this.info().max_len;
  }
  is_lexical() {
    return this.info().is_lexical;
  }
  is_nonlexical() {
    return this.info().is_nonlexical;
  }
  is_nonempty() {
    return this.info().is_nonempty;
  }
  is_binarised() {
    return this.info().is_binarised;
  }
  is_flexible_chomsky_normal_form() {
    return this.info().is_flexible_chomsky_normal_form;
  }
  is_chomsky_normal_form() {
    return this.info().is_chomsky_normal_form;
  }
  leftcorners(category) {
    return this.runtime.request({ op: "grammar_leftcorners", grammar: this.wire, category: category.symbol() }).map((s) => new Nonterminal(s));
  }
  leftcorner_parents(category) {
    return this.runtime.request({ op: "grammar_leftcorner_parents", grammar: this.wire, category: category.symbol() }).map((s) => new Nonterminal(s));
  }
  is_leftcorner(category, left) {
    return this.runtime.request({ op: "grammar_is_leftcorner", grammar: this.wire, category: category.symbol(), left: symbolToWire(left) });
  }
}

export class Tree {
  runtime;
  node;
  constructor(runtime, label, children = []) {
    this.runtime = runtime;
    if (typeof label !== "string")
      throw new TypeError("tree labels must be strings");
    this.node = { label, children: [...children].map((c) => {
      if (c instanceof Tree)
        return c.node;
      if (typeof c !== "string")
        throw new TypeError("tree children must be Tree or string");
      return c;
    }) };
  }
  static view(runtime, node) {
    const tree = Object.create(Tree.prototype);
    Object.defineProperties(tree, { runtime: { value: runtime }, node: { value: node } });
    return tree;
  }
  static fromPlain(runtime, node) {
    return Tree.view(runtime, structuredClone(node));
  }
  static fromstring(runtime, text, options = {}) {
    const node = runtime.request({ op: "tree_fromstring", text, brackets: options.brackets ?? "()", remove_top: options.remove_empty_top_bracketing ?? false });
    return typeof node === "string" ? node : Tree.view(runtime, node);
  }
  toPlain() {
    return structuredClone(this.node);
  }
  label() {
    return this.node.label;
  }
  set_label(label) {
    if (typeof label !== "string")
      throw new TypeError("tree labels must be strings");
    this.node.label = label;
  }
  get length() {
    return this.node.children.length;
  }
  atPath(path) {
    let node = this.node;
    for (const i of path) {
      if (typeof node === "string")
        throw new RangeError("tree position descends through a leaf");
      node = node.children[i];
    }
    return node;
  }
  position(position) {
    return this.runtime.request({ op: "tree_position", tree: this.node, position: typeof position === "number" ? [position] : position });
  }
  get(position) {
    const path = this.position(position);
    if (path.length === 0)
      return this;
    const child = this.atPath(path);
    return typeof child === "string" ? child : Tree.view(this.runtime, child);
  }
  set(position, value) {
    const path = this.position(position);
    if (!path.length)
      throw new RangeError("cannot assign the root tree position");
    const parent = this.atPath(path.slice(0, -1));
    if (typeof parent === "string")
      throw new RangeError("tree position descends through a leaf");
    if (!(value instanceof Tree) && typeof value !== "string")
      throw new TypeError("tree children must be Tree or string");
    parent.children[path[path.length - 1]] = value instanceof Tree ? value.node : value;
  }
  delete(position) {
    const path = this.position(position);
    if (!path.length)
      throw new RangeError("cannot delete the root tree position");
    const parent = this.atPath(path.slice(0, -1));
    if (typeof parent === "string")
      throw new RangeError("tree position descends through a leaf");
    parent.children.splice(path[path.length - 1], 1);
  }
  *[Symbol.iterator]() {
    for (const child of this.node.children)
      yield typeof child === "string" ? child : Tree.view(this.runtime, child);
  }
  leaves() {
    return this.runtime.request({ op: "tree_leaves", tree: this.node });
  }
  height() {
    return this.runtime.request({ op: "tree_height", tree: this.node });
  }
  treepositions(order = "preorder") {
    return this.runtime.request({ op: "tree_positions", tree: this.node, order });
  }
  leaf_treeposition(index) {
    return this.runtime.request({ op: "tree_leaf_position", tree: this.node, index });
  }
  treeposition_spanning_leaves(start, end) {
    return this.runtime.request({ op: "tree_spanning", tree: this.node, start, end });
  }
  pos() {
    return this.runtime.request({ op: "tree_pos", tree: this.node });
  }
  productions() {
    return this.runtime.request({ op: "tree_productions", tree: this.node }).map((p) => Production.fromWire(this.runtime, p));
  }
  *subtrees(filter) {
    const paths = this.runtime.request({ op: "tree_subtrees", tree: this.node });
    for (const path of paths) {
      const node = this.atPath(path);
      if (typeof node === "string")
        continue;
      const tree = path.length === 0 ? this : Tree.view(this.runtime, node);
      if (!filter || filter(tree))
        yield tree;
    }
  }
  flatten() {
    return new Tree(this.runtime, this.label(), this.leaves());
  }
  copy() {
    return Tree.fromPlain(this.runtime, this.node);
  }
  pformat(options = {}) {
    return this.runtime.request({ op: "tree_format", tree: this.node, format: {
      margin: options.margin ?? 70,
      indent: options.indent ?? 0,
      nodesep: options.nodesep ?? "",
      parens: options.parens ?? ["(", ")"],
      quotes: typeof options.quotes === "boolean" ? ["", ""] : options.quotes ?? ["", ""],
      repr_leaves: options.quotes === true
    } });
  }
  toString() {
    return this.pformat();
  }
}

export class RustEarleyParser {
  grammar;
  options;
  constructor(grammar, options = {}) {
    this.grammar = grammar;
    this.options = options;
  }
  parseResult(tokens) {
    const result = this.grammar.runtime.request({
      op: "parse",
      grammar: this.grammar.toWire(),
      tokens: [...tokens],
      max_trees: this.options.maxTrees ?? 1000,
      max_states: this.options.maxStates ?? 1e5
    });
    return { ...result, trees: result.trees.map((t) => Tree.fromPlain(this.grammar.runtime, t)) };
  }
  parse(tokens) {
    const result = this.parseResult(tokens);
    if (result.cyclic)
      throw new Error("cyclic parse forest: use parseResult for explicit cycle metadata");
    if (result.truncated)
      throw new Error("parse forest exceeds maxTrees: use parseResult for explicit truncation metadata");
    return result.trees;
  }
  recognize(tokens) {
    return new RustEarleyParser(this.grammar, { ...this.options, maxTrees: 0 }).parseResult(tokens).recognized;
  }
}
