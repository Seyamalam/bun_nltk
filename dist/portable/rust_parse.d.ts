import { ParsingRuntime } from './parsing_runtime.js';

type PlainRustTree<L = string> = {
    label: string;
    children: Array<PlainRustTree<L> | L>;
};
type StringTree = PlainRustTree<string>;
type GrammarSymbol = Nonterminal | string;
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
/** String-valued nonterminal, deliberately distinct from terminal strings. */
declare class Nonterminal {
    private readonly name;
    constructor(name: string);
    symbol(): string;
    toString(): string;
    equals(other: unknown): boolean;
    slash(other: Nonterminal): Nonterminal;
}
declare function nonterminals(symbols: string): Nonterminal[];
declare class Production {
    private readonly runtime;
    private readonly left;
    private readonly right;
    constructor(runtime: ParsingRuntime, left: Nonterminal, rhs: Iterable<GrammarSymbol>);
    static fromWire(runtime: ParsingRuntime, wire: WireProduction): Production;
    toWire(): WireProduction;
    lhs(): Nonterminal;
    rhs(): readonly GrammarSymbol[];
    get length(): number;
    is_lexical(): boolean;
    is_nonlexical(): boolean;
    isLexical(): boolean;
    isNonlexical(): boolean;
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

export { RustCFG as CFG, Nonterminal, RustPCFG as PCFG, ParsingRuntime, ProbabilisticProduction, Production, RustCFG, RustEarleyParser, RustPCFG, RustViterbiParser, Tree, nonterminals };
export type { GrammarSymbol, PlainRustTree, RustParseOptions, RustParseResult, RustTreeOrder, RustTreePosition, RustViterbiResult, StringTree, TreeFormatOptions, TreeSlice };
