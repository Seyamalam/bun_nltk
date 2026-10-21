import { ParsingRuntime } from './parsing_runtime.js';

type StringTree = {
    label: string;
    children: Array<StringTree | string>;
};
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
    toString(): string;
    equals(other: unknown): boolean;
}
/** Typed CFG contract. Kept separate from the legacy root CFG until migration gates pass. */
declare class RustCFG {
    readonly runtime: ParsingRuntime;
    private readonly wire;
    constructor(runtime: ParsingRuntime, start: Nonterminal, productions: Iterable<Production>);
    static fromstring(runtime: ParsingRuntime, text: string | readonly string[]): RustCFG;
    toWire(): WireGrammar;
    start(): Nonterminal;
    productions(options?: {
        lhs?: Nonterminal;
        rhs?: GrammarSymbol;
        empty?: boolean;
    }): Production[];
    check_coverage(tokens: Iterable<string>): void;
    private info;
    min_len(): number;
    max_len(): number;
    is_lexical(): boolean;
    is_nonlexical(): boolean;
    is_nonempty(): boolean;
    is_binarised(): boolean;
    is_flexible_chomsky_normal_form(): boolean;
    is_chomsky_normal_form(): boolean;
    leftcorners(category: Nonterminal): Nonterminal[];
    leftcorner_parents(category: Nonterminal): Nonterminal[];
    is_leftcorner(category: Nonterminal, left: GrammarSymbol): boolean;
}
type TreeFormatOptions = {
    margin?: number;
    indent?: number;
    nodesep?: string;
    parens?: readonly [string, string];
    quotes?: boolean | readonly [string, string];
};
/** String-label/string-leaf Tree; every structural query is executed by Rust. */
declare class Tree implements Iterable<Tree | string> {
    readonly runtime: ParsingRuntime;
    private readonly node;
    constructor(runtime: ParsingRuntime, label: string, children?: Iterable<Tree | string>);
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
    toPlain(): StringTree;
    label(): string;
    set_label(label: string): void;
    get length(): number;
    private atPath;
    private position;
    get(position: number | RustTreePosition): Tree | string;
    set(position: number | RustTreePosition, value: Tree | string): void;
    delete(position: number | RustTreePosition): void;
    [Symbol.iterator](): IterableIterator<Tree | string>;
    leaves(): string[];
    height(): number;
    treepositions(order?: RustTreeOrder): number[][];
    leaf_treeposition(index: number): number[];
    treeposition_spanning_leaves(start: number, end: number): number[];
    pos(): Array<[string, string]>;
    productions(): Production[];
    subtrees(filter?: (tree: Tree) => boolean): IterableIterator<Tree>;
    flatten(): Tree;
    copy(): Tree;
    pformat(options?: TreeFormatOptions): string;
    toString(): string;
}
type RustParseOptions = {
    maxTrees?: number;
    maxStates?: number;
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
    recognize(tokens: Iterable<string>): boolean;
}

export { RustCFG as CFG, Nonterminal, ParsingRuntime, Production, RustCFG, RustEarleyParser, Tree, nonterminals };
export type { GrammarSymbol, RustParseOptions, RustParseResult, RustTreeOrder, RustTreePosition, StringTree, TreeFormatOptions };
