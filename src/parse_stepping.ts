/*
 * Port of nltk.parse stepping/interactive parsers (NLTK 3.10.3):
 *
 *  - SteppingRecursiveDescentParser (nltk/parse/recursivedescent.py)
 *  - SteppingShiftReduceParser      (nltk/parse/shiftreduce.py)
 *  - TestGrammar                    (nltk/parse/util.py)
 *  - transform                      (nltk/parse/corenlp.py — the pure
 *    sentence-dict -> CoNLL tuple transformer; the CoreNLP server
 *    classes themselves stay honest gaps)
 *
 * These need a mutable, index-addressable Tree (Python's Tree is a list
 * subclass supporting tree[tuple_position] get/set and copy(deep=True)),
 * so a local SteppingTree is used rather than the Rust-backed ParseTree.
 * All quirks are preserved: the SR trace>2 crash on non-lexical
 * reductions ("sequence item 0: expected str instance, Nonterminal
 * found"), the leaked accepted/rejected bindings in TestGrammar.run,
 * match() IndexError on empty rtext, and every trace string.
 */

import { pyError } from "./internals";
import { CFG, Nonterminal, Production, isNonterminal } from "./grammar";
import { load_parser } from "./inference_discourse";

export type PrintOut = (s: string) => void;

function stdout(s: string): void {
  process.stdout.write(s);
}

/** repr() of a Python str: single-quoted, with Python escaping. */
function pyStrRepr(s: string): string {
  let out = "'";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === "'") out += "\\'";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return out + "'";
}

// ---------------------------------------------------------------------------
// SteppingTree — mutable nltk.tree.Tree analogue
// ---------------------------------------------------------------------------

export type SteppingChild = SteppingTree | string;

export class SteppingTree {
  label: string;
  children: SteppingChild[];

  constructor(label: string, children: SteppingChild[] = []) {
    this.label = label;
    this.children = children;
  }

  static convert(value: SteppingTree | string | { label: string; children?: unknown[] }): SteppingTree {
    if (value instanceof SteppingTree) return value;
    if (typeof value === "string") {
      // Mirror Tree.fromstring semantics for a bare leaf string is not
      // needed by the stepping parsers — kept simple.
      return new SteppingTree(value, []);
    }
    return new SteppingTree(
      value.label,
      (value.children ?? []).map((c) => (typeof c === "string" ? c : SteppingTree.convert(c as { label: string }))),
    );
  }

  get length(): number {
    return this.children.length;
  }

  /** tree[position] where position is a tuple path (Python tree[(i,j,...)]). */
  get(pos: number[] | number): SteppingChild {
    const p = typeof pos === "number" ? [pos] : pos;
    let children: SteppingChild[] = this.children;
    for (let j = 0; j < p.length; j++) {
      const node = children[p[j]!];
      if (node === undefined) throw pyError("IndexError", "list index out of range");
      if (j === p.length - 1) return node;
      if (!(node instanceof SteppingTree)) throw pyError("IndexError", "list index out of range");
      children = node.children;
    }
    return this;
  }

  /** tree[position] = value (Python __setitem__ with tuple index). */
  set(pos: number[] | number, value: SteppingChild): void {
    const p = typeof pos === "number" ? [pos] : pos;
    if (p.length === 0) throw pyError("TypeError", "can only assign to tree children, not the root");
    let children: SteppingChild[] = this.children;
    for (let i = 0; i < p.length - 1; i++) {
      const next = children[p[i]!];
      if (!(next instanceof SteppingTree)) throw pyError("IndexError", "list index out of range");
      children = next.children;
    }
    children[p[p.length - 1]!] = value;
  }

  /** Tree.copy(deep=False/True). */
  copy(deep = false): SteppingTree {
    if (deep) {
      return new SteppingTree(
        this.label,
        this.children.map((c) => (c instanceof SteppingTree ? c.copy(true) : c)),
      );
    }
    return new SteppingTree(this.label, [...this.children]);
  }

  /** Structural equality (Tree.__eq__). */
  equals(other: unknown): boolean {
    return (
      other instanceof SteppingTree &&
      this.label === other.label &&
      this.children.length === other.children.length &&
      this.children.every((c, i) => {
        const o = other.children[i];
        if (c instanceof SteppingTree || o instanceof SteppingTree) {
          return c instanceof SteppingTree && o instanceof SteppingTree && c.equals(o);
        }
        return c === o;
      })
    );
  }

  /** Canonical frozen form — used like ImmutableTree as a dict key. */
  freezeKey(): string {
    return `${pyStrRepr(this.label)}[${this.children
      .map((c) => (c instanceof SteppingTree ? c.freezeKey() : pyStrRepr(c)))
      .join(",")}]`;
  }

  /** str(Tree) — NLTK bracket format; leafless trees render "(S )". */
  toString(): string {
    const inner = this.children.map((c) => `${c instanceof SteppingTree ? c.toString() : c}`).join(" ");
    return `(${this.label} ${inner})`;
  }
}

/** tree[frontier[0]]-style navigation; leaf strings have no label. */
function childLabel(child: SteppingChild): string {
  if (!(child instanceof SteppingTree)) {
    throw pyError("AttributeError", `'str' object has no attribute 'label'`);
  }
  return child.label;
}

// ---------------------------------------------------------------------------
// SteppingRecursiveDescentParser (nltk/parse/recursivedescent.py)
// ---------------------------------------------------------------------------

export class SteppingRecursiveDescentParser {
  _grammar: CFG;
  _trace: number;
  private _out: PrintOut;

  _rtext: string[] | null = null;
  _tree: SteppingTree | null = null;
  _frontier: number[][] = [[]];
  _tried_e: Map<string, Production[]> = new Map();
  _tried_m: Map<string, string[]> = new Map();
  _history: [string[], SteppingTree, number[][]][] = [];
  _parses: SteppingTree[] = [];

  constructor(grammar: CFG, trace = 0, out?: PrintOut) {
    this._grammar = grammar;
    this._trace = trace;
    this._out = out ?? stdout;
  }

  grammar(): CFG {
    return this._grammar;
  }

  trace(trace = 2): void {
    this._trace = trace;
  }

  private _print(s = "", end = "\n"): void {
    this._out(s + end);
  }

  private _freeze(tree: SteppingTree): string {
    // Python uses ImmutableTree.convert(tree.copy()) — structural key.
    return tree.freezeKey();
  }

  parse(tokens: Iterable<string>): SteppingTree[] {
    const toks = [...tokens];
    this.initialize(toks);
    while (this.step() !== null) {
      // pass
    }
    return this.parses();
  }

  initialize(tokens: string[]): void {
    this._rtext = tokens;
    const start = this._grammar.start().symbol();
    this._tree = new SteppingTree(start, []);
    this._frontier = [[]];
    this._tried_e = new Map();
    this._tried_m = new Map();
    this._history = [];
    this._parses = [];
    if (this._trace) {
      this._traceStart(this._tree, this._frontier, this._rtext);
    }
  }

  remaining_text(): string[] | null {
    return this._rtext;
  }
  remainingText(): string[] | null {
    return this.remaining_text();
  }

  frontier(): number[][] {
    return this._frontier;
  }

  tree(): SteppingTree | null {
    return this._tree;
  }

  step(): Production | string | true | null {
    // Try matching (if we haven't already)
    if (this.untried_match()) {
      const token = this.match();
      if (token !== null) return token;
    }
    // Try expanding.
    const production = this.expand();
    if (production !== null) return production;
    // Try backtracking
    if (this.backtrack()) {
      this._traceBacktrack(this._tree!, this._frontier);
      return true;
    }
    // Nothing left to do.
    return null;
  }

  expand(production: Production | null = null): Production | null {
    // Make sure we *can* expand.
    if (this._frontier.length === 0) return null;
    if (!(this._tree!.get(this._frontier[0]!) instanceof SteppingTree)) return null;

    // If they didn't specify a production, check all untried ones.
    const productions = production === null ? this.untried_expandable_productions() : [production];

    for (const prod of productions) {
      // Record that we've tried this production now.
      const key = this._freeze(this._tree!);
      const list = this._tried_e.get(key) ?? [];
      list.push(prod);
      this._tried_e.set(key, list);

      // Try expanding.
      for (const _result of this._expand(this._rtext!, this._tree!, this._frontier, prod)) {
        void _result;
        return prod;
      }
    }
    // We didn't expand anything.
    return null;
  }

  match(): string | null {
    // Record that we've tried matching this token.
    if (this._rtext!.length === 0) throw pyError("IndexError", "list index out of range");
    const tok = this._rtext![0]!;
    {
      const key = this._freeze(this._tree!);
      const list = this._tried_m.get(key) ?? [];
      list.push(tok);
      this._tried_m.set(key, list);
    }

    // Make sure we *can* match.
    if (this._frontier.length === 0) return null;
    if (this._tree!.get(this._frontier[0]!) instanceof SteppingTree) return null;

    for (const _result of this._match(this._rtext!, this._tree!, this._frontier)) {
      void _result;
      // Return the token we just matched.
      return this._history[this._history.length - 1]![0][0]!;
    }
    return null;
  }

  backtrack(): boolean {
    if (this._history.length === 0) return false;
    const [rtext, tree, frontier] = this._history.pop()!;
    this._rtext = rtext;
    this._tree = tree;
    this._frontier = frontier;
    return true;
  }

  expandable_productions(): Production[] {
    // Make sure we *can* expand.
    if (this._frontier.length === 0) return [];
    const frontierChild = this._tree!.get(this._frontier[0]!);
    if (this._frontier.length === 0 || !(frontierChild instanceof SteppingTree)) return [];
    return this._grammar.productions().filter((p) => p.lhs().symbol() === frontierChild.label);
  }
  expandableProductions(): Production[] {
    return this.expandable_productions();
  }

  untried_expandable_productions(): Production[] {
    const triedExpansions = this._tried_e.get(this._freeze(this._tree!)) ?? [];
    return this.expandable_productions().filter((p) => !triedExpansions.some((t) => t.equals(p)));
  }
  untriedExpandableProductions(): Production[] {
    return this.untried_expandable_productions();
  }

  untried_match(): boolean {
    if (this._rtext!.length === 0) return false;
    const triedMatches = this._tried_m.get(this._freeze(this._tree!)) ?? [];
    return !triedMatches.includes(this._rtext![0]!);
  }
  untriedMatch(): boolean {
    return this.untried_match();
  }

  currently_complete(): boolean {
    return this._frontier.length === 0 && this._rtext!.length === 0;
  }
  currentlyComplete(): boolean {
    return this.currently_complete();
  }

  *_parse(remainingText: string[], tree: SteppingTree, frontier: number[][]): Generator<number> {
    this._history.push([this._rtext!, this._tree!, this._frontier]);
    this._rtext = remainingText;
    this._tree = tree;
    this._frontier = frontier;

    // Is it a good parse?  If so, record it.
    if (frontier.length === 0 && remainingText.length === 0) {
      this._parses.push(tree);
      this._traceSucceed(this._tree, this._frontier);
    }
    yield 1;
  }

  *_match(rtext: string[], tree: SteppingTree, frontier: number[][]): Generator<number> {
    const treeLeaf = tree.get(frontier[0]!);
    if (rtext.length > 0 && !(treeLeaf instanceof SteppingTree) && treeLeaf === rtext[0]) {
      // If it's a terminal that matches rtext[0], substitute the token.
      const newtree = tree.copy(true);
      newtree.set(frontier[0]!, rtext[0]!);
      if (this._trace) {
        this._traceMatch(newtree, frontier.slice(1), rtext[0]!);
      }
      yield* this._parse(rtext.slice(1), newtree, frontier.slice(1));
    } else {
      // If it's a non-matching terminal, fail.
      if (this._trace) {
        this._traceBacktrack(tree, frontier, rtext.slice(0, 1));
      }
    }
  }

  *_expand(remainingText: string[], tree: SteppingTree, frontier: number[][], production: Production | null = null): Generator<number> {
    const productions = production === null ? this._grammar.productions() : [production];
    for (const prod of productions) {
      const lhs = prod.lhs().symbol();
      if (lhs === childLabel(tree.get(frontier[0]!))) {
        const subtree = this._production_to_tree(prod);
        let newtree: SteppingTree;
        if (frontier[0]!.length === 0) {
          newtree = subtree;
        } else {
          newtree = tree.copy(true);
          newtree.set(frontier[0]!, subtree);
        }
        const newFrontier = prod.rhs().map((_, i) => [...frontier[0]!, i]);
        if (this._trace) {
          this._traceExpand(newtree, newFrontier, prod);
        }
        yield* this._parse(remainingText, newtree, [...newFrontier, ...frontier.slice(1)]);
      }
    }
  }

  _production_to_tree(production: Production): SteppingTree {
    const children: SteppingChild[] = [];
    for (const elt of production.rhs()) {
      if (isNonterminal(elt)) {
        children.push(new SteppingTree((elt as Nonterminal).symbol(), []));
      } else {
        // This will be matched.
        children.push(elt as string);
      }
    }
    return new SteppingTree(production.lhs().symbol(), children);
  }
  _productionToTree(production: Production): SteppingTree {
    return this._production_to_tree(production);
  }

  parses(): SteppingTree[] {
    return this._parses;
  }

  set_grammar(grammar: CFG): void {
    this._grammar = grammar;
  }
  setGrammar(grammar: CFG): void {
    this.set_grammar(grammar);
  }

  // -- trace output ---------------------------------------------------------

  _trace_fringe(tree: SteppingChild, treeloc: number[] | null = null): void {
    if (treeloc !== null && treeloc.length === 0) this._out("* ");
    if (tree instanceof SteppingTree) {
      if (tree.length === 0) {
        // repr(Nonterminal(tree.label())) → the bare symbol.
        this._out(tree.label + " ");
      }
      for (let i = 0; i < tree.length; i++) {
        if (treeloc !== null && i === treeloc[0]) {
          this._trace_fringe(tree.children[i]!, treeloc.slice(1));
        } else {
          this._trace_fringe(tree.children[i]!);
        }
      }
    } else {
      this._out(pyStrRepr(tree) + " ");
    }
  }
  _traceFringe(tree: SteppingChild, treeloc: number[] | null = null): void {
    this._trace_fringe(tree, treeloc);
  }

  _trace_tree(tree: SteppingTree, frontier: number[][], operation: string): void {
    if (this._trace === 2) {
      this._out(`  ${operation} [ `);
    } else {
      this._out("    [ ");
    }
    if (frontier.length > 0) {
      this._trace_fringe(tree, frontier[0]!);
    } else {
      this._trace_fringe(tree);
    }
    this._out("]\n");
  }
  _traceTree(tree: SteppingTree, frontier: number[][], operation: string): void {
    this._trace_tree(tree, frontier, operation);
  }

  _trace_start(tree: SteppingTree, frontier: number[][], text: string[]): void {
    this._print(`Parsing ${pyStrRepr(text.join(" "))}`);
    if (this._trace > 2) this._print("Start:");
    if (this._trace > 1) this._trace_tree(tree, frontier, " ");
  }
  _traceStart(tree: SteppingTree, frontier: number[][], text: string[]): void {
    this._trace_start(tree, frontier, text);
  }

  _trace_expand(tree: SteppingTree, frontier: number[][], production: Production): void {
    if (this._trace > 2) this._print(`Expand: ${production}`);
    if (this._trace > 1) this._trace_tree(tree, frontier, "E");
  }
  _traceExpand(tree: SteppingTree, frontier: number[][], production: Production): void {
    this._trace_expand(tree, frontier, production);
  }

  _trace_match(tree: SteppingTree, frontier: number[][], tok: string): void {
    if (this._trace > 2) this._print(`Match: ${pyStrRepr(tok)}`);
    if (this._trace > 1) this._trace_tree(tree, frontier, "M");
  }
  _traceMatch(tree: SteppingTree, frontier: number[][], tok: string): void {
    this._trace_match(tree, frontier, tok);
  }

  _trace_succeed(tree: SteppingTree, frontier: number[][]): void {
    if (this._trace > 2) this._print("GOOD PARSE:");
    if (this._trace === 1) this._print(`Found a parse:\n${tree}`);
    if (this._trace > 1) this._trace_tree(tree, frontier, "+");
  }
  _traceSucceed(tree: SteppingTree, frontier: number[][]): void {
    this._trace_succeed(tree, frontier);
  }

  _trace_backtrack(tree: SteppingTree, frontier: number[][], toks: string[] | null = null): void {
    void tree;
    void frontier;
    if (this._trace > 2) {
      if (toks && toks.length) {
        this._print(`Backtrack: ${pyStrRepr(toks[0]!)} match failed`);
      } else {
        this._print("Backtrack");
      }
    }
  }
  _traceBacktrack(tree: SteppingTree, frontier: number[][], toks: string[] | null = null): void {
    this._trace_backtrack(tree, frontier, toks);
  }
}

// ---------------------------------------------------------------------------
// SteppingShiftReduceParser (nltk/parse/shiftreduce.py)
// ---------------------------------------------------------------------------

export class SteppingShiftReduceParser {
  _grammar: CFG;
  _trace: number;
  private _out: PrintOut;

  _stack: SteppingChild[] | null = null;
  _remaining_text: string[] | null = null;
  _history: [SteppingChild[], string[]][] = [];

  constructor(grammar: CFG, trace = 0, out?: PrintOut) {
    this._grammar = grammar;
    this._trace = trace;
    this._out = out ?? stdout;
    this._check_grammar();
  }

  grammar(): CFG {
    return this._grammar;
  }

  private _print(s = ""): void {
    this._out(s + "\n");
  }

  parse(tokens: Iterable<string>): SteppingTree[] {
    const toks = [...tokens];
    this.initialize(toks);
    while (this.step()) {
      // pass
    }
    return [...this.parses()];
  }

  stack(): SteppingChild[] | null {
    return this._stack;
  }

  remaining_text(): string[] | null {
    return this._remaining_text;
  }
  remainingText(): string[] | null {
    return this.remaining_text();
  }

  initialize(tokens: string[]): void {
    this._stack = [];
    this._remaining_text = tokens;
    this._history = [];
  }

  step(): Production | boolean {
    return this.reduce() || this.shift();
  }

  shift(): boolean {
    if (this._remaining_text!.length === 0) return false;
    this._history.push([[...this._stack!], [...this._remaining_text!]]);
    this._shift(this._stack!, this._remaining_text!);
    return true;
  }

  reduce(production: Production | null = null): Production | null {
    this._history.push([[...this._stack!], [...this._remaining_text!]]);
    const returnVal = this._reduce(this._stack!, this._remaining_text!, production);
    if (!returnVal) this._history.pop();
    return returnVal;
  }

  undo(): boolean {
    if (this._history.length === 0) return false;
    const [stack, remainingText] = this._history.pop()!;
    this._stack = stack;
    this._remaining_text = remainingText;
    return true;
  }

  reducible_productions(): Production[] {
    const productions: Production[] = [];
    for (const production of this._grammar.productions()) {
      const rhslen = production.length;
      if (this._match_rhs(production.rhs(), this._stack!.slice(-rhslen))) {
        productions.push(production);
      }
    }
    return productions;
  }
  reducibleProductions(): Production[] {
    return this.reducible_productions();
  }

  *parses(): Generator<SteppingTree> {
    if (
      this._remaining_text!.length === 0 &&
      this._stack!.length === 1 &&
      childLabel(this._stack![0]!) === this._grammar.start().symbol()
    ) {
      yield this._stack![0] as SteppingTree;
    }
  }

  set_grammar(grammar: CFG): void {
    this._grammar = grammar;
  }
  setGrammar(grammar: CFG): void {
    this.set_grammar(grammar);
  }

  _shift(stack: SteppingChild[], remainingText: string[]): void {
    stack.push(remainingText[0]!);
    // list.remove(remaining_text[0]) — first matching element (always idx 0).
    remainingText.splice(remainingText.indexOf(remainingText[0]!), 1);
    if (this._trace) this._trace_shift(stack, remainingText);
  }

  _match_rhs(rhs: readonly (Nonterminal | string)[], rightmostStack: SteppingChild[]): boolean {
    if (rightmostStack.length !== rhs.length) return false;
    for (let i = 0; i < rightmostStack.length; i++) {
      const elt = rightmostStack[i]!;
      const r = rhs[i]!;
      if (elt instanceof SteppingTree) {
        if (!isNonterminal(r)) return false;
        if (elt.label !== (r as Nonterminal).symbol()) return false;
      } else {
        if (isNonterminal(r)) return false;
        if (elt !== r) return false;
      }
    }
    return true;
  }
  _matchRhs(rhs: readonly (Nonterminal | string)[], rightmostStack: SteppingChild[]): boolean {
    return this._match_rhs(rhs, rightmostStack);
  }

  _reduce(stack: SteppingChild[], remainingText: string[], production: Production | null = null): Production | null {
    const productions = production === null ? this._grammar.productions() : [production];
    // Try each production, in order.
    for (const prod of productions) {
      const rhslen = prod.length;
      // check if the RHS of a production matches the top of the stack
      if (this._match_rhs(prod.rhs(), stack.slice(-rhslen))) {
        // combine the tree to reflect the reduction
        const tree = new SteppingTree(prod.lhs().symbol(), stack.slice(-rhslen));
        stack.splice(stack.length - rhslen, rhslen, tree);
        // We reduced something
        if (this._trace) this._trace_reduce(stack, prod, remainingText);
        return prod;
      }
    }
    // We didn't reduce anything
    return null;
  }

  trace(trace = 2): void {
    this._trace = trace;
  }

  _trace_stack(stack: SteppingChild[], remainingText: string[], marker = " "): void {
    let s = "  " + marker + " [ ";
    for (const elt of stack) {
      if (elt instanceof SteppingTree) {
        s += elt.label + " "; // repr(Nonterminal(label)) → bare symbol
      } else {
        s += pyStrRepr(elt) + " ";
      }
    }
    s += "* " + remainingText.join(" ") + "]";
    this._print(s);
  }
  _traceStack(stack: SteppingChild[], remainingText: string[], marker = " "): void {
    this._trace_stack(stack, remainingText, marker);
  }

  _trace_shift(stack: SteppingChild[], remainingText: string[]): void {
    if (this._trace > 2) {
      const last = stack[stack.length - 1]!;
      this._print(`Shift ${last instanceof SteppingTree ? last.toString() : pyStrRepr(last)}:`);
    }
    if (this._trace === 2) {
      this._trace_stack(stack, remainingText, "S");
    } else if (this._trace > 0) {
      this._trace_stack(stack, remainingText);
    }
  }
  _traceShift(stack: SteppingChild[], remainingText: string[]): void {
    this._trace_shift(stack, remainingText);
  }

  _trace_reduce(stack: SteppingChild[], production: Production, remainingText: string[]): void {
    if (this._trace > 2) {
      // QUIRK: " ".join(production.rhs()) crashes on Nonterminal elements.
      const rhs = production
        .rhs()
        .map((elt, i) => {
          if (isNonterminal(elt)) {
            throw pyError("TypeError", `sequence item ${i}: expected str instance, Nonterminal found`);
          }
          return elt as string;
        })
        .join(" ");
      this._print(`Reduce ${production.lhs().symbol()} <- ${rhs}`);
    }
    if (this._trace === 2) {
      this._trace_stack(stack, remainingText, "R");
    } else if (this._trace > 1) {
      this._trace_stack(stack, remainingText);
    }
  }
  _traceReduce(stack: SteppingChild[], production: Production, remainingText: string[]): void {
    this._trace_reduce(stack, production, remainingText);
  }

  _check_grammar(): void {
    // Any production whose RHS is an extension of another production's RHS
    // will never be used.
    const productions = this._grammar.productions();
    for (let i = 0; i < productions.length; i++) {
      for (let j = i + 1; j < productions.length; j++) {
        const rhs1 = productions[i]!.rhs();
        const rhs2 = productions[j]!.rhs();
        const match = rhs2.every((sym, k) => {
          const a = rhs1[k];
          if (a === undefined) return false;
          if (a instanceof Nonterminal || sym instanceof Nonterminal) {
            return a instanceof Nonterminal && sym instanceof Nonterminal && a.equals(sym);
          }
          return a === sym;
        });
        if (match) this._print(`Warning: ${productions[i]} will never be used`);
      }
    }
  }
  _checkGrammar(): void {
    this._check_grammar();
  }
}

// ---------------------------------------------------------------------------
// TestGrammar (nltk/parse/util.py)
// ---------------------------------------------------------------------------

export interface TestGrammarRecord {
  doc: string;
  accept?: string[];
  reject?: string[];
  [key: string]: unknown;
}

export class TestGrammar {
  test_grammar: string;
  cp: { parse(tokens: string[]): unknown[] };
  suite: TestGrammarRecord[];
  _accept: string[] | null;
  _reject: string[] | null;
  private _out: PrintOut;

  constructor(grammar: string, suite: TestGrammarRecord[], accept: string[] | null = null, reject: string[] | null = null, out?: PrintOut) {
    this.test_grammar = grammar;
    this.cp = load_parser(grammar, 0) as { parse(tokens: string[]): unknown[] };
    this.suite = suite;
    this._accept = accept;
    this._reject = reject;
    this._out = out ?? stdout;
  }

  run(showTrees = false): void {
    // accepted/rejected are deliberately NOT reset per record — the oracle
    // leaks these bindings across suite iterations (and UnboundLocalError's
    // if a record never sets them).
    let accepted: boolean | undefined;
    let rejected: boolean | undefined;

    for (const test of this.suite) {
      if (!("doc" in test)) throw pyError("KeyError", `'doc'`);
      this._out(`${test.doc}:` + " ");
      for (const key of ["accept", "reject"] as const) {
        if (!(key in test)) throw pyError("KeyError", `'${key}'`);
        for (const sent of test[key]!) {
          const tokens = sent.split(/\s+/).filter((t) => t.length > 0);
          const trees = [...(this.cp.parse(tokens) as Iterable<unknown>)];
          if (showTrees && trees.length) {
            this._out("\n");
            this._out(sent + "\n");
            for (const tree of trees) this._out(`${treeStr(tree)}\n`);
          }
          if (key === "accept") {
            if (trees.length === 0) {
              throw pyError("ValueError", `Sentence '${sent}' failed to parse'`);
            } else {
              accepted = true;
            }
          } else {
            if (trees.length) {
              throw pyError("ValueError", `Sentence '${sent}' received a parse'`);
            } else {
              rejected = true;
            }
          }
        }
      }
      if (accepted === undefined) {
        throw pyError("UnboundLocalError", "cannot access local variable 'accepted' where it is not associated with a value");
      }
      if (accepted && rejected === undefined) {
        throw pyError("UnboundLocalError", "cannot access local variable 'rejected' where it is not associated with a value");
      }
      if (accepted && rejected) {
        this._out("All tests passed!\n");
      }
    }
  }
}

/** `str(tree)` for the plain `{label, children}` ParseTree shape that the
 *  chart parsers yield — Python Tree.__str__ is "(label child child ...)". */
function treeStr(t: unknown): string {
  if (typeof t === "string") return t;
  const o = t as { label: unknown; children: unknown[] };
  const kids = o.children.map((c) => treeStr(c)).join(" ");
  return `(${o.label} ${kids})`;
}

// ---------------------------------------------------------------------------
// nltk.parse.corenlp.transform — pure sentence-dict -> CoNLL tuples.
// The CoreNLP server-bound classes are NOT ported (honest gap); only this
// pure transformation of a CoreNLP JSON sentence is.
// ---------------------------------------------------------------------------

export interface CoreNlpDependency {
  dependent: number;
  governor: number;
  dep: string;
  [key: string]: unknown;
}

export interface CoreNlpToken {
  word: string;
  lemma: string;
  pos: string;
  [key: string]: unknown;
}

export interface CoreNlpSentence {
  basicDependencies: CoreNlpDependency[];
  tokens: CoreNlpToken[];
  [key: string]: unknown;
}

export type ConllTuple = [number, string, string, string, string, string, string, string, string, string, string];

export function* transform(sentence: CoreNlpSentence): Generator<ConllTuple> {
  for (const dependency of sentence.basicDependencies) {
    const dependentIndex = dependency.dependent;
    const token = sentence.tokens[dependentIndex - 1]!;
    // Return values that we don't know as '_'. Also, consider tag and ctag
    // to be equal.
    yield [
      dependentIndex,
      "_",
      token.word,
      token.lemma,
      token.pos,
      token.pos,
      "_",
      String(dependency.governor),
      dependency.dep,
      "_",
      "_",
    ];
  }
}
