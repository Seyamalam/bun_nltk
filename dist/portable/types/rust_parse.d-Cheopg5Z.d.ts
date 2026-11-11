import { ParsingRuntime } from '../parsing_runtime.js';

type CfgProduction = {
    lhs: string;
    rhs: string[];
};
type CfgGrammar = {
    startSymbol: string;
    productions: CfgProduction[];
};
type PcfgProduction = {
    lhs: string;
    rhs: string[];
    prob: number;
};
type PcfgGrammar = {
    startSymbol: string;
    productions: PcfgProduction[];
};
type ParseTree = {
    label: string;
    children: Array<ParseTree | string>;
};
type ProbabilisticParse = {
    tree: ParseTree;
    logProb: number;
    prob: number;
};
declare function parseCfgGrammar(grammarText: string, options?: {
    startSymbol?: string;
}): CfgGrammar;
declare function parsePcfgGrammar(grammarText: string, options?: {
    startSymbol?: string;
}): PcfgGrammar;
declare function chartParse(tokens: string[], grammar: CfgGrammar, options?: {
    maxTrees?: number;
    startSymbol?: string;
}): ParseTree[];
declare function recursiveDescentParse(tokens: string[], grammar: CfgGrammar, options?: {
    maxTrees?: number;
    startSymbol?: string;
    maxDepth?: number;
}): ParseTree[];
declare function leftCornerParse(tokens: string[], grammar: CfgGrammar, options?: {
    maxTrees?: number;
    startSymbol?: string;
    maxDepth?: number;
}): ParseTree[];
declare function earleyRecognize(tokens: string[], grammar: CfgGrammar, options?: {
    startSymbol?: string;
}): boolean;
declare function earleyParse(tokens: string[], grammar: CfgGrammar, options?: {
    maxTrees?: number;
    startSymbol?: string;
}): ParseTree[];
declare function probabilisticChartParse(tokens: string[], grammar: PcfgGrammar, options?: {
    startSymbol?: string;
}): ProbabilisticParse | null;
declare function parseTextWithCfg(text: string, grammar: CfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
}): ParseTree[];
declare function parseTextWithEarley(text: string, grammar: CfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
}): ParseTree[];
declare function parseTextWithPcfg(text: string, grammar: PcfgGrammar | string, options?: {
    startSymbol?: string;
    normalizeTokens?: boolean;
}): ProbabilisticParse | null;
declare function parseTextWithRecursiveDescent(text: string, grammar: CfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
    maxDepth?: number;
}): ParseTree[];
declare function parseTextWithLeftCorner(text: string, grammar: CfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
    maxDepth?: number;
}): ParseTree[];

type GrammarSymbol = Nonterminal | string;
declare class Nonterminal {
    private readonly name;
    constructor(name: string);
    symbol(): string;
    equals(other: unknown): boolean;
    lessThan(other: Nonterminal): boolean;
    slash(other: Nonterminal): Nonterminal;
    toString(): string;
}
declare function nonterminals(symbols: string): Nonterminal[];
declare function isNonterminal(item: unknown): item is Nonterminal;
declare function isTerminal(item: unknown): boolean;
declare function is_nonterminal(item: unknown): item is Nonterminal;
declare function is_terminal(item: unknown): boolean;
declare class Production$1 {
    private readonly left;
    private readonly right;
    constructor(lhs: Nonterminal, rhs: Iterable<GrammarSymbol>);
    lhs(): Nonterminal;
    rhs(): readonly GrammarSymbol[];
    get length(): number;
    is_nonlexical(): boolean;
    is_lexical(): boolean;
    isNonlexical(): boolean;
    isLexical(): boolean;
    equals(other: unknown): boolean;
    toString(): string;
}
declare class DependencyProduction extends Production$1 {
    toString(): string;
}
declare class ProbabilisticProduction$1 extends Production$1 {
    private probability;
    constructor(lhs: Nonterminal, rhs: Iterable<GrammarSymbol>, options?: {
        prob?: number;
    });
    prob(): number;
    set_prob(prob: number): void;
    setProb(prob: number): void;
    logprob(): number;
    set_logprob(logprob: number): void;
    setLogprob(logprob: number): void;
    equals(other: unknown): boolean;
    toString(): string;
}
declare function transitiveClosure(graph: Map<string, Set<string>>, reflexive?: boolean): Map<string, Set<string>>;
declare function invertGraph(graph: Map<string, Set<string>>): Map<string, Set<string>>;
declare function standardNontermParser(line: string, pos: number): [Nonterminal, number];
declare function standard_nonterm_parser(line: string, pos: number): [Nonterminal, number];
type NontermParser = (line: string, pos: number) => [Nonterminal, number];
declare function readGrammar(input: string | readonly string[], nontermParser: NontermParser, options?: {
    probabilistic?: boolean;
}): [Nonterminal, Production$1[]];
declare function read_grammar(input: string | readonly string[], nontermParser: NontermParser, options?: {
    probabilistic?: boolean;
}): [Nonterminal, Production$1[]];
declare class CFG {
    private readonly _start;
    private readonly _productions;
    private readonly _categories;
    private _lhsIndex;
    private _rhsIndex;
    private _emptyIndex;
    private _lexicalIndex;
    private _immediateLeftcornerCategories;
    private _immediateLeftcornerWords;
    private _leftcorners;
    private _leftcornerParents;
    private _leftcornerWords;
    private _isLexical;
    private _isNonlexical;
    private _minLen;
    private _maxLen;
    private _allUnaryAreLexical;
    private readonly bySymbol;
    constructor(start: Nonterminal, productions: Iterable<Production$1>, calculateLeftcorners?: boolean);
    private nonterm;
    private _calculateIndexes;
    private _calculateLeftcorners;
    static fromstring(input: string | readonly string[], _options?: {
        encoding?: string;
    }): CFG;
    static fromString(input: string | readonly string[]): CFG;
    start(): Nonterminal;
    productions(options?: {
        lhs?: Nonterminal;
        rhs?: GrammarSymbol;
        empty?: boolean;
    }): Production$1[];
    leftcorners(cat: Nonterminal): Nonterminal[];
    is_leftcorner(cat: Nonterminal, left: GrammarSymbol): boolean;
    isLeftcorner(cat: Nonterminal, left: GrammarSymbol): boolean;
    leftcorner_parents(cat: Nonterminal): Nonterminal[];
    leftcornerParents(cat: Nonterminal): Nonterminal[];
    check_coverage(tokens: Iterable<string>): void;
    checkCoverage(tokens: Iterable<string>): void;
    private _calculateGrammarForms;
    is_lexical(): boolean;
    isLexical(): boolean;
    is_nonlexical(): boolean;
    isNonlexical(): boolean;
    min_len(): number;
    minLen(): number;
    max_len(): number;
    maxLen(): number;
    is_nonempty(): boolean;
    isNonempty(): boolean;
    private _isNonempty;
    is_binarised(): boolean;
    isBinarised(): boolean;
    is_flexible_chomsky_normal_form(): boolean;
    isFlexibleChomskyNormalForm(): boolean;
    is_chomsky_normal_form(): boolean;
    isChomskyNormalForm(): boolean;
    chomsky_normal_form(newTokenPadding?: string, flexible?: boolean): CFG;
    chomskyNormalForm(newTokenPadding?: string, flexible?: boolean): CFG;
    static remove_unitary_rules(grammar: CFG): CFG;
    static removeUnitaryRules(grammar: CFG): CFG;
    static binarize(grammar: CFG, padding?: string): CFG;
    static eliminate_start(grammar: CFG): CFG;
    static eliminateStart(grammar: CFG): CFG;
    static remove_mixed_rules(grammar: CFG, padding?: string): CFG;
    static removeMixedRules(grammar: CFG, padding?: string): CFG;
    get grammar(): CfgGrammar;
    toString(): string;
    repr(): string;
}

declare class DependencyGrammar {
    private readonly _productions;
    constructor(productions: DependencyProduction[]);
    static fromstring(input: string): DependencyGrammar;
    static fromString(input: string): DependencyGrammar;
    contains(head: string, mod: string): boolean;
    has(headMod: [string, string]): boolean;
    toString(): string;
    repr(): string;
}
declare class ProbabilisticDependencyGrammar {
    private readonly _productions;
    private readonly _events;
    private readonly _tags;
    constructor(productions: ProbabilisticProduction$1[], events: Map<string, number>, tags: Map<string, unknown>);
    contains(head: string, mod: string): boolean;
    toString(): string;
    repr(): string;
}
declare class PCFG extends CFG {
    static readonly EPSILON = 0.01;
    constructor(start: Nonterminal, productions: Iterable<Production$1>, calculateLeftcorners?: boolean);
    static fromstring(input: string | readonly string[], _options?: {
        encoding?: string;
    }): PCFG;
    get grammar(): PcfgGrammar;
    static fromString(input: string | readonly string[]): PCFG;
}
declare function induce_pcfg(start: Nonterminal, productions: Iterable<Production$1>): PCFG;
declare function inducePcfg(start: Nonterminal, productions: Iterable<Production$1>): PCFG;

type PlainRustTree<L = string> = {
    label: string;
    children: Array<PlainRustTree<L> | L>;
};
type StringTree = PlainRustTree<string>;

type RustTreePosition = readonly number[];
type RustTreeOrder = "preorder" | "postorder" | "bothorder" | "leaves";
type WireSymbol = {
    kind: "nonterminal" | "terminal";
    value: string;
};
type WireProduction = {
    lhs: string;
    rhs: WireSymbol[];
};
type WireGrammar = {
    start: string;
    productions: WireProduction[];
};
declare class Production extends Production$1 {
    private readonly runtime;
    constructor(runtime: ParsingRuntime, lhs: Nonterminal, rhs: Iterable<GrammarSymbol>);
    static fromWire(runtime: ParsingRuntime, wire: WireProduction): Production;
    toWire(): WireProduction;
    is_lexical(): boolean;
    is_nonlexical(): boolean;
    toString(): string;
    equals(other: unknown): boolean;
}
/** Typed CFG contract. Kept separate from the legacy root CFG until migration gates pass. */
declare class RustCFG {
    readonly runtime: ParsingRuntime;
    private readonly wire;
    constructor(runtime: ParsingRuntime, start: Nonterminal, productions: Iterable<Production>);
    static fromstring(runtime: ParsingRuntime, text: string | readonly string[]): RustCFG;
    static fromString(runtime: ParsingRuntime, text: string | readonly string[]): RustCFG;
    toWire(): WireGrammar;
    start(): Nonterminal;
    productions(options?: {
        lhs?: Nonterminal;
        rhs?: GrammarSymbol;
        empty?: boolean;
    }): Production[];
    check_coverage(tokens: Iterable<string>): void;
    checkCoverage(tokens: Iterable<string>): void;
    private info;
    min_len(): number;
    max_len(): number;
    is_lexical(): boolean;
    is_nonlexical(): boolean;
    is_nonempty(): boolean;
    is_binarised(): boolean;
    is_flexible_chomsky_normal_form(): boolean;
    is_chomsky_normal_form(): boolean;
    minLen(): number;
    maxLen(): number;
    isLexical(): boolean;
    isNonlexical(): boolean;
    isNonempty(): boolean;
    isBinarised(): boolean;
    isFlexibleChomskyNormalForm(): boolean;
    isChomskyNormalForm(): boolean;
    leftcorners(category: Nonterminal): Nonterminal[];
    leftcorner_parents(category: Nonterminal): Nonterminal[];
    is_leftcorner(category: Nonterminal, left: GrammarSymbol): boolean;
    leftCorners(category: Nonterminal): Nonterminal[];
    leftcornerParents(category: Nonterminal): Nonterminal[];
    isLeftcorner(category: Nonterminal, left: GrammarSymbol): boolean;
}
type TreeFormatOptions = {
    margin?: number;
    indent?: number;
    nodesep?: string;
    parens?: readonly [string, string];
    quotes?: boolean | readonly [string, string];
};
type TreeSlice = {
    start?: number;
    stop?: number;
    step?: number;
};
/** Rust structural/list operations with opaque leaf slots, never stringified objects. */
declare class Tree<L = string> implements Iterable<Tree<L> | L> {
    readonly runtime: ParsingRuntime;
    private readonly node;
    constructor(runtime: ParsingRuntime, label: string, children?: Iterable<Tree<L> | L>);
    private slot;
    private value;
    private static view;
    static fromPlain(runtime: ParsingRuntime, node: StringTree): Tree;
    static fromstring(runtime: ParsingRuntime, text: string, options?: {
        remove_empty_top_bracketing?: false;
        brackets?: string;
    }): Tree;
    static fromstring(runtime: ParsingRuntime, text: string, options: {
        remove_empty_top_bracketing: boolean;
        brackets?: string;
    }): Tree | string;
    static fromString(runtime: ParsingRuntime, text: string): Tree;
    toPlain(): PlainRustTree<L>;
    /** Every leaf uses its own numeric slot even if values have identical string/repr forms. */
    private wire;
    label(): string;
    set_label(label: string): void;
    setLabel(label: string): void;
    get length(): number;
    private atPath;
    private position;
    get(position: number | RustTreePosition): Tree<L> | L;
    set(position: number | RustTreePosition, value: Tree<L> | L): void;
    delete(position: number | RustTreePosition): void;
    private listPlan;
    private applyPlan;
    append(value: Tree<L> | L): void;
    extend(values: Iterable<Tree<L> | L>): void;
    insert(index: number, value: Tree<L> | L): void;
    pop(index?: number): Tree<L> | L;
    reverse(): void;
    clear(): void;
    slice(options?: TreeSlice): Array<Tree<L> | L>;
    setSlice(options: TreeSlice, values: Iterable<Tree<L> | L>): void;
    deleteSlice(options: TreeSlice): void;
    set_slice(options: TreeSlice, values: Iterable<Tree<L> | L>): void;
    delete_slice(options: TreeSlice): void;
    [Symbol.iterator](): IterableIterator<Tree<L> | L>;
    leaves(): L[];
    height(): number;
    treepositions(order?: RustTreeOrder): number[][];
    treePositions(order?: RustTreeOrder): number[][];
    leaf_treeposition(index: number): number[];
    leafTreeposition(index: number): number[];
    treeposition_spanning_leaves(start: number, end: number): number[];
    treepositionSpanningLeaves(start: number, end: number): number[];
    pos(): Array<[L, string]>;
    productions(): Production[];
    subtrees(filter?: (tree: Tree<L>) => boolean): IterableIterator<Tree<L>>;
    flatten(): Tree<L>;
    copy(deep?: boolean): Tree<L>;
    pformat(options?: TreeFormatOptions): string;
    toString(): string;
    private childEquals;
    private plainNode;
    /** Python list.index — first child equal (by structure/leaf value) to `value`. */
    index(value: Tree<L> | L, start?: number, stop?: number): number;
    /** Python list.count — number of children equal to `value`. */
    count(value: Tree<L> | L): number;
    /** Python list.remove — deletes the first child equal to `value`. */
    remove(value: Tree<L> | L): void;
    /**
     * Python list.sort. With no key, sorts by node label then structure —
     * matching NLTK's homogeneous-children ordering (`Tree.__lt__` compares
     * label then children).
     */
    sort(key?: (child: Tree<L> | L) => string | number, reverse?: boolean): void;
    /** NLTK `Tree.freeze` — returns an immutable deep copy (leaves optionally mapped). */
    freeze(leafFreezer?: (leaf: L) => L): Tree<L>;
    /** NLTK `Tree.convert` classmethod — builds a `cls` tree from any tree. */
    static convert<L>(runtime: ParsingRuntime, tree: Tree<L> | L, cls?: new (label: string, children: Array<Tree<L> | L>) => Tree<L>): Tree<L> | L;
    /** NLTK `Tree.fromlist` — converts nested lists to a Tree (repr'd first element labels). */
    static fromlist(runtime: ParsingRuntime, l: unknown): Tree | string;
    /** NLTK `Tree.pprint` — prints pformat; returns the printed text. */
    pprint(options?: TreeFormatOptions): string;
    /** NLTK `Tree.pformat_latex_qtree`. */
    pformat_latex_qtree(): string;
    pformatLatexQtree(): string;
    /** NLTK `Tree.pformat_latex_forest`. */
    pformat_latex_forest(): string;
    pformatLatexForest(): string;
    /** NLTK `Tree.pretty_print` — ASCII-art rendering requires the full
     *  nltk.tree.prettyprinter port; gap for now. */
    pretty_print(): string;
    /** NLTK `Tree.draw` — tkinter-backed in Python; unsupported here. */
    draw(): never;
    /** NLTK nltk.tree.transforms.chomsky_normal_form — mutates this tree. */
    chomsky_normal_form(factor?: "right" | "left", horzMarkov?: number, vertMarkov?: number, childChar?: string, parentChar?: string): void;
    chomskyNormalForm(factor?: "right" | "left", horzMarkov?: number, vertMarkov?: number, childChar?: string, parentChar?: string): void;
    /** NLTK nltk.tree.transforms.un_chomsky_normal_form — mutates this tree. */
    un_chomsky_normal_form(expandUnary?: boolean, childChar?: string, parentChar?: string, unaryChar?: string): void;
    unChomskyNormalForm(expandUnary?: boolean, childChar?: string, parentChar?: string, unaryChar?: string): void;
    /** NLTK nltk.tree.transforms.collapse_unary — mutates this tree. */
    collapse_unary(collapsePOS?: boolean, collapseRoot?: boolean, joinChar?: string): void;
    collapseUnary(collapsePOS?: boolean, collapseRoot?: boolean, joinChar?: string): void;
}
type RustParseOptions = {
    maxTrees?: number;
    maxStates?: number;
    max_trees?: number;
    max_states?: number;
};
type RustParseResult = {
    recognized: boolean;
    trees: Tree[];
    truncated: boolean;
    cyclic: boolean;
    states: number;
};
/** Packed Earley chart parser, not an alias for the existing JS ChartParser. */
declare class RustEarleyParser {
    private readonly grammar;
    private readonly options;
    constructor(grammar: RustCFG, options?: RustParseOptions);
    parseResult(tokens: Iterable<string>): RustParseResult;
    parse(tokens: Iterable<string>): Tree[];
    parse_result(tokens: Iterable<string>): RustParseResult;
    recognize(tokens: Iterable<string>): boolean;
}
type WireWeightedProduction = WireProduction & {
    prob: number;
};
type WirePcfg = {
    start: string;
    productions: WireWeightedProduction[];
};
declare class ProbabilisticProduction extends Production {
    private readonly weightedRuntime;
    private readonly probability;
    constructor(weightedRuntime: ParsingRuntime, lhs: Nonterminal, rhs: Iterable<GrammarSymbol>, probability: number);
    prob(): number;
    logprob(): number;
    toWire(): WireWeightedProduction;
    equals(other: unknown): boolean;
    toString(): string;
}
/** PCFG is additive: it does not replace the legacy root probability grammar. */
declare class RustPCFG extends RustCFG {
    private readonly weighted;
    constructor(runtime: ParsingRuntime, start: Nonterminal, productions: Iterable<ProbabilisticProduction>);
    static fromstring(runtime: ParsingRuntime, text: string | readonly string[]): RustPCFG;
    static fromString(runtime: ParsingRuntime, text: string | readonly string[]): RustPCFG;
    toWire(): WirePcfg;
    productions(options?: {
        lhs?: Nonterminal;
        rhs?: GrammarSymbol;
        empty?: boolean;
    }): ProbabilisticProduction[];
}

type RustViterbiResult = {
    tree: Tree;
    prob: number;
    logProb: number;
};
declare class RustViterbiParser {
    private readonly grammar;
    private readonly options;
    constructor(grammar: RustPCFG, options?: {
        maxWork?: number;
        max_work?: number;
    });
    parseResult(tokens: Iterable<string>): RustViterbiResult | null;
    parse_result(tokens: Iterable<string>): RustViterbiResult | null;
    parse(tokens: Iterable<string>): Tree[];
}

export { ProbabilisticProduction as $, leftCornerParse as A, nonterminals as B, CFG as C, DependencyGrammar as D, parseCfgGrammar as E, parsePcfgGrammar as F, parseTextWithCfg as H, parseTextWithEarley as I, parseTextWithLeftCorner as J, parseTextWithPcfg as K, parseTextWithRecursiveDescent as L, probabilisticChartParse as M, Nonterminal as N, readGrammar as O, read_grammar as Q, RustCFG as R, Tree as T, recursiveDescentParse as U, standardNontermParser as V, standard_nonterm_parser as W, transitiveClosure as X, Production as Y, RustPCFG as Z, Production$1 as a, RustViterbiParser as a0, PCFG as c, DependencyProduction as g, ProbabilisticDependencyGrammar as i, ProbabilisticProduction$1 as j, RustEarleyParser as k, chartParse as q, earleyParse as r, earleyRecognize as s, inducePcfg as t, induce_pcfg as u, invertGraph as v, isNonterminal as w, isTerminal as x, is_nonterminal as y, is_terminal as z };
export type { GrammarSymbol as G, ParseTree as P, StringTree as S, PlainRustTree as _, RustViterbiResult as a1, TreeSlice as a2, CfgGrammar as b, PcfgGrammar as d, ProbabilisticParse as e, CfgProduction as f, PcfgProduction as h, RustParseOptions as l, RustParseResult as m, RustTreeOrder as n, RustTreePosition as o, TreeFormatOptions as p };
