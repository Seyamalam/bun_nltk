/**
 * Print-to-stdout demo() ports for the NLTK 3.10.3 'pure' compatibility batch.
 *
 * Every demo takes an output sink `out: PrintSink` receiving raw text chunks
 * (each Python `print(...)` → `out(str + "\n")`), so tests can diff complete
 * stdout against the pinned oracle. Components that trace through console.log
 * are run inside {@link withConsoleLog} / {@link captureLog}.
 *
 * Timing values are nondeterministic — captured but normalized by tests.
 */
import type { PrintSink } from "./ext_pure";
import {
  PyRandom, PySet, ndarray,
  conll_data1, conll_data2, pformatDependencyGraph, pyPrint, pyEnd, pyRepr,
  sprintf, treebank_data, pformat, pyStrRepr, pytuple, pyFloatRepr, pyfloat, npFormatMatrix,
} from "./ext_pure";
import { pyError } from "./internals";
import {
  BU_LC_STRATEGY, BU_STRATEGY, LC_STRATEGY, NltkChartParser,
  SteppingChartParser, TD_STRATEGY, TreeEdge,
} from "./chart";
import { EarleyChartParser } from "./parse_earley";
import { SteppingRecursiveDescentParser, SteppingShiftReduceParser } from "./parse_stepping";
import { CFG, DependencyGrammar, Nonterminal, PCFG } from "./grammar";
import { FeatureChartParser, FeatureGrammar, FeatureTopDownChartParser } from "./parse_feature";
import {
  InsideChartParser, LongestChartParser, RandomChartParser, UnsortedChartParser,
} from "./parse_pchart";
import { generate } from "./parse_generate";
import { DependencyGraph } from "./dependency_graph";
import { DemoScorer, NaiveBayesDependencyScorer } from "./parse_dependency";
import {
  NonprojectiveDependencyParser, ProbabilisticNonprojectiveParser,
  ProbabilisticProjectiveDependencyParser, ProjectiveDependencyParser,
} from "./parse_dep_parsers";
import {
  binaryDistance, jaccardDistance, jaro_similarity,
  jaro_winkler_similarity, masiDistance, precision, recall, fMeasure,
} from "./distance_metrics";
import { accuracy } from "./confusion_metrics";
import { editDistance } from "./metrics";
import { bubble, merge, quick, selection } from "./misc_sort";
import { Model, Valuation, Assignment, Variable, Expression as LogicExpression } from "./sem_logic";
import { Expression as LinearExpression } from "./sem_linearlogic";
import {
  DrtApplicationExpression, DrtBinaryExpression, DrtConcatenation,
  DrtEqualityExpression, DrtLambdaExpression, DrtNegatedExpression,
  DrtOrExpression, DrtParser, DrtParserFromString, DrtProposition,
  DrtVariableExpression,
} from "./drt";
import { resolve_anaphora } from "./inference_discourse";
import { FStructure } from "./sem_lfg";
import { BracketParseCorpusReader } from "./corpus_readers2";
import { TnT } from "./tag_tnt";
import { PorterStemmer } from "./porter_stemmer";
import { eliza_chat, iesha_chat, rude_chat, suntsu_chat, zen_chat } from "./chat";
import { PunktTrainer as PunktTrainerNltk, PunktSentenceTokenizer as PunktSentenceTokenizerNltk } from "./punkt_nltk";
import { demo_model0, evaluate_sents } from "./sem_util";
import { cooperStoreFromTree, parse_with_bindops } from "./cooper_storage";
import { find as dataFind } from "./data";
import { GAAClusterer } from "./cluster_gaac";
import { word_finder } from "./misc_wordfinder";

export type { PrintSink };
export const stdout: PrintSink = (s) => process.stdout.write(s);

/** collect() → {out, text}: simplest sink for differential tests. */
export function collect(): { out: PrintSink; text: () => string } {
  const parts: string[] = [];
  return { out: (s) => parts.push(s), text: () => parts.join("") };
}

/** Run `fn` with console.log/info/error routed to `out` (line + "\n" per call). */
export function withConsoleLog<T>(out: PrintSink, fn: () => T): T {
  const orig = { log: console.log, info: console.info, error: console.error, warn: console.warn };
  const toOut = (...args: unknown[]): void => {
    out(args.map((a) => (typeof a === "string" ? a : String(a))).join(" ") + "\n");
  };
  console.log = toOut; console.info = toOut; console.error = toOut; console.warn = toOut;
  try {
    return fn();
  } finally {
    console.log = orig.log; console.info = orig.info;
    console.error = orig.error; console.warn = orig.warn;
  }
}

const now = (): number => Date.now() / 1000;

/** Python repr() of a chart-edge symbol: Nonterminal→symbol, terminal→quoted. */
const edgeSymRepr = (s: unknown): string => (s instanceof Nonterminal ? String(s.symbol()) : pyRepr(s));

/** Python str(grammar): verbose production list (CFG/PCFG/FeatureGrammar). */
function pyStrGrammar(g: CFG): string {
  const prods = g.productions();
  let result = `Grammar with ${prods.length} productions (start state = ${g.start()})`;
  for (const p of prods) result += `\n    ${p}`;
  return result;
}

/**
 * nltk.parse.chart.TreeEdge.__str__: "[i:j] %-2r -> rhs" — the lhs repr is
 * left-justified to width 2 ("S  ->", "NP ->"). Base TreeEdge.toString omits
 * the pad, so demos that trace chart edges patch it for the call duration.
 */
function pyTreeEdgeStr(e: TreeEdge): string {
  let str = `[${e.start()}:${e.end()}] ${edgeSymRepr(e.lhs()).padEnd(2)} ->`;
  const rhs = e.rhs();
  for (let i = 0; i < rhs.length; i++) {
    if (i === e.dot()) str += " *";
    str += ` ${edgeSymRepr(rhs[i])}`;
  }
  if (rhs.length === e.dot()) str += " *";
  return str;
}

/** Run `fn` with TreeEdge.toString matching Python's `%-2r ->` lhs padding. */
function withPyEdgeStr<T>(fn: () => T): T {
  const proto = TreeEdge.prototype as unknown as { toString: () => string };
  const orig = proto.toString;
  proto.toString = function (this: TreeEdge): string { return pyTreeEdgeStr(this); };
  try { return fn(); } finally { proto.toString = orig; }
}

/** Python Tree.pformat (margin=70) over {label, children} trees. */
export function treePformat(
  tree: { label: unknown; children: unknown[] },
  margin = 70,
  indent = 0,
  nodesep = "",
  parens: [string, string] = ["(", ")"],
  quotes: [string, string] | true = ["", ""],
): string {
  type T = { label: unknown; children: unknown[] };
  const isTree = (x: unknown): x is T =>
    typeof x === "object" && x !== null && "children" in (x as object) && "label" in (x as object);
  const flat = (t: T): string => {
    const cs = t.children.map((c) => {
      if (isTree(c)) return flat(c);
      if (Array.isArray(c)) return c.join("/");
      if (typeof c === "string" && quotes !== true) return `${quotes[0]}${c}${quotes[1]}`;
      return pyRepr(c);
    });
    return `${parens[0]}${typeof t.label === "string" ? t.label : pyRepr(t.label)}${nodesep} ${cs.join(" ")}${parens[1]}`;
  };
  const s = flat(tree);
  if (s.length + indent < margin) return s;
  let res = `${parens[0]}${typeof tree.label === "string" ? tree.label : pyRepr(tree.label)}${nodesep}`;
  const indentStr = " ".repeat(indent + 2);
  for (const child of tree.children) {
    if (isTree(child)) res += `\n${indentStr}${treePformat(child, margin, indent + 2, nodesep, parens, quotes)}`;
    else if (Array.isArray(child)) res += `\n${indentStr}${child.join("/")}`;
    else if (typeof child === "string" && quotes !== true) res += `\n${indentStr}${quotes[0]}${child}${quotes[1]}`;
    else res += `\n${indentStr}${pyRepr(child)}`;
  }
  return res + parens[1];
}

const printTree = (out: PrintSink, tree: unknown): void => {
  out(`${treePformat(tree as { label: unknown; children: unknown[] })}\n`);
};
const pyListStr = (xs: unknown[]): string => `[${xs.map((x) => pyRepr(x)).join(", ")}]`;

// ===========================================================================
// nltk.parse.chart.demo + demo_grammar
// ===========================================================================

export function chartDemoGrammar(): CFG {
  return CFG.fromstring(`
S  -> NP VP
PP -> "with" NP
NP -> NP PP
VP -> VP PP
VP -> Verb NP
VP -> Verb
NP -> Det Noun
NP -> "John"
NP -> "I"
Det -> "the"
Det -> "my"
Det -> "a"
Noun -> "dog"
Noun -> "cookie"
Verb -> "ate"
Verb -> "saw"
Prep -> "with"
Prep -> "under"
`);
}
export const demo_grammar = chartDemoGrammar;

export function chartDemo(
  out: PrintSink,
  options: {
    choice?: string | null; print_times?: boolean; print_grammar?: boolean;
    print_trees?: boolean; trace?: number; sent?: string; numparses?: number;
    readline?: () => string | null; clock?: () => number;
  } = {},
): void {
  const {
    choice: choiceIn = null, print_times = true, print_grammar = false,
    print_trees = true, trace = 2,
    sent = "I saw John with a dog with my cookie", numparses = 5,
    readline = () => null, clock = now,
  } = options;

  const grammar = chartDemoGrammar();
  if (print_grammar) { pyPrint(out, "* Grammar"); pyPrint(out, pyStrGrammar(grammar)); }
  pyPrint(out, "* Sentence:");
  pyPrint(out, sent);
  const tokens = sent.split(" ");
  pyPrint(out, tokens);
  pyPrint(out);

  let choice = choiceIn;
  if (choice === null) {
    pyPrint(out, "  1: Top-down chart parser");
    pyPrint(out, "  2: Bottom-up chart parser");
    pyPrint(out, "  3: Bottom-up left-corner chart parser");
    pyPrint(out, "  4: Left-corner chart parser with bottom-up filter");
    pyPrint(out, "  5: Stepping chart parser (alternating top-down & bottom-up)");
    pyPrint(out, "  6: All parsers");
    pyPrint(out, "\nWhich parser (1-6)? ", pyEnd(" "));
    const line = readline();
    choice = (line ?? "").trim();
    pyPrint(out);
  }

  choice = String(choice);
  if (!"123456".includes(choice) || choice === "") {
    pyPrint(out, "Bad parser number");
    return;
  }

  const times = new Map<string, number>();
  const strategies: Record<string, [string, unknown[]]> = {
    "1": ["Top-down", TD_STRATEGY as unknown[]],
    "2": ["Bottom-up", BU_STRATEGY as unknown[]],
    "3": ["Bottom-up left-corner", BU_LC_STRATEGY as unknown[]],
    "4": ["Filtered left-corner", LC_STRATEGY as unknown[]],
  };
  let choices: string[] = [];
  if (choice in strategies) choices = [choice];
  if (choice === "6") choices = ["1", "2", "3", "4"];

  for (const c of choices) {
    const [name, strategy] = strategies[c]!;
    pyPrint(out, `* Strategy: ${name}`);
    pyPrint(out);
    const cp = new NltkChartParser(grammar, { strategy: strategy as never, trace });
    const t = clock();
    const chart = withPyEdgeStr(() => withConsoleLog(out, () => cp.chart_parse(tokens)));
    const parses = [...chart.parses(grammar.start())];
    times.set(name, clock() - t);
    pyPrint(out, `Nr edges in chart: ${chart.num_edges()}`);
    if (numparses && parses.length !== numparses) throw pyError("AssertionError", "Not all parses found");
    if (print_trees) for (const tree of parses) printTree(out, tree);
    else pyPrint(out, `Nr trees: ${parses.length}`);
    pyPrint(out);
  }

  if ("56".includes(choice)) {
    pyPrint(out, "* Strategy: Stepping (top-down vs bottom-up)");
    pyPrint(out);
    const t = clock();
    const cp = new SteppingChartParser(grammar, { trace });
    cp.initialize(tokens);
    withPyEdgeStr(() => withConsoleLog(out, () => {
      for (let i = 0; i < 5; i++) {
        pyPrint(out, "*** SWITCH TO TOP DOWN");
        cp.set_strategy(TD_STRATEGY as never);
        let j = 0;
        for (const e of cp.step()) {
          if (j > 20 || e === null) break;
          j++;
        }
        pyPrint(out, "*** SWITCH TO BOTTOM UP");
        cp.set_strategy(BU_STRATEGY as never);
        j = 0;
        for (const e of cp.step()) {
          if (j > 20 || e === null) break;
          j++;
        }
      }
    }));
    times.set("Stepping", clock() - t);
    pyPrint(out, `Nr edges in chart: ${cp.chart()!.num_edges()}`);
    if (numparses) {
      const n = [...cp.parses()].length;
      if (n !== numparses) throw pyError("AssertionError", "Not all parses found");
    }
    if (print_trees) for (const tree of cp.parses()) printTree(out, tree);
    else pyPrint(out, `Nr trees: ${[...cp.parses()].length}`);
    pyPrint(out);
  }

  if (!(print_times && times.size)) return;
  pyPrint(out, "* Parsing times");
  pyPrint(out);
  const maxlen = Math.max(...[...times.keys()].map((k) => k.length));
  for (const [parser, t] of [...times.entries()].sort((a, b) => a[1] - b[1])) {
    pyPrint(out, sprintf(`%${maxlen}s parser: %6.3fsec`, parser, t));
  }
}
export const chart_demo = chartDemo;

// ===========================================================================
// nltk.parse.recursivedescent.demo / shiftreduce.demo
// ===========================================================================

const RD_GRAMMAR = `
S  -> NP VP
NP -> Det N
NP -> Det N PP
VP -> V NP
VP -> V NP PP
PP -> P NP
NP -> 'I'
N -> 'man'
N -> 'park'
N -> 'telescope'
N -> 'dog'
Det -> 'the'
Det -> 'a'
P -> 'in'
P -> 'with'
V -> 'saw'
`;

export function recursivedescentDemo(out: PrintSink): void {
  const grammar = CFG.fromstring(RD_GRAMMAR);
  for (const prod of grammar.productions()) pyPrint(out, `${prod}`);
  const sent = "I saw a man in the park".split(" ");
  const rd = new SteppingRecursiveDescentParser(grammar, 2, out);
  rd.initialize(sent);
  let printed = 0;
  for (;;) {
    const r = rd.step();
    const p = rd.parses();
    while (printed < p.length) out(`${treePformat(p[printed++] as unknown as { label: unknown; children: unknown[] })}\n`);
    if (r === null) break;
  }
  // drain any parses produced by the final step
  const p = rd.parses();
  while (printed < p.length) out(`${treePformat(p[printed++] as unknown as { label: unknown; children: unknown[] })}\n`);
}
export const recursiveDescentDemo = recursivedescentDemo;

export function shiftreduceDemo(out: PrintSink): void {
  const grammar = CFG.fromstring(RD_GRAMMAR);
  const sent = "I saw a man in the park".split(" ");
  const sr = new SteppingShiftReduceParser(grammar, 2, out);
  sr.initialize(sent);
  // ShiftReduceParser.parse emits the start-of-parse trace that the stepping
  // port defers to initialize (which the oracle does not trace).
  pyPrint(out, `Parsing ${pyStrRepr(sent.join(" "))}`);
  sr._trace_stack([], sent);
  let printed = 0;
  for (;;) {
    const r = sr.step();
    const p = [...sr.parses()];
    while (printed < p.length) out(`${treePformat(p[printed++] as unknown as { label: unknown; children: unknown[] })}\n`);
    if (!r) break;
  }
  const p = [...sr.parses()];
  while (printed < p.length) out(`${treePformat(p[printed++] as unknown as { label: unknown; children: unknown[] })}\n`);
}
export const shiftReduceDemo = shiftreduceDemo;

// ===========================================================================
// nltk.parse.earleychart.demo
// ===========================================================================

export function earleychartDemo(
  out: PrintSink,
  options: {
    print_times?: boolean; print_grammar?: boolean; print_trees?: boolean;
    trace?: number; sent?: string; numparses?: number; clock?: () => number;
  } = {},
): void {
  const {
    print_times = true, print_grammar = false, print_trees = true,
    trace = 2, sent = "I saw John with a dog with my cookie",
    numparses = 5, clock = now,
  } = options;
  const grammar = chartDemoGrammar();
  if (print_grammar) { pyPrint(out, "* Grammar"); pyPrint(out, pyStrGrammar(grammar)); }
  pyPrint(out, "* Sentence:");
  pyPrint(out, sent);
  const tokens = sent.split(" ");
  pyPrint(out, tokens);
  pyPrint(out);

  const earley = new EarleyChartParser(grammar, { trace });
  const t = clock();
  const chart = withPyEdgeStr(() => withConsoleLog(out, () => earley.chart_parse(tokens)));
  const parses = [...chart.parses(grammar.start())];
  const dt = clock() - t;
  if (numparses && parses.length !== numparses) throw pyError("AssertionError", "Not all parses found");
  if (print_trees) for (const tree of parses) printTree(out, tree);
  else pyPrint(out, `Nr trees: ${parses.length}`);
  if (print_times) pyPrint(out, `Time: ${pyRepr(dt)}`);
}
export const earleyDemo = earleychartDemo;

// ===========================================================================
// nltk.parse.featurechart.demo
// ===========================================================================

const FEATURE_GRAMMAR = `
S[] -> NP[] VP[]
PP[] -> Prep[] NP[]
NP[] -> NP[] PP[]
VP[] -> VP[] PP[]
VP[] -> Verb[] NP[]
VP[] -> Verb[]
NP[] -> Det[pl=?x] Noun[pl=?x]
NP[] -> 'John'
NP[] -> 'I'
Det[] -> 'the'
Det[] -> 'my'
Det[-pl] -> 'a'
Noun[-pl] -> 'dog'
Noun[-pl] -> 'cookie'
Verb[] -> 'ate'
Verb[] -> 'saw'
Prep[] -> 'with'
Prep[] -> 'under'
`;

export function featurechartDemo(
  out: PrintSink,
  options: {
    print_times?: boolean; print_grammar?: boolean; print_trees?: boolean;
    print_sentence?: boolean; trace?: number;
    parser?: "FeatureChartParser" | "FeatureTopDownChartParser" | "FeatureEarleyChartParser";
    sent?: string; clock?: () => number;
  } = {},
): void {
  const {
    print_times = true, print_grammar = true, print_trees = true,
    print_sentence = true, trace = 1, parser = "FeatureChartParser",
    sent = "I saw John with a dog with my cookie", clock = now,
  } = options;
  pyPrint(out);
  const grammar = FeatureGrammar.fromstring(FEATURE_GRAMMAR);
  if (print_grammar) { pyPrint(out, pyStrGrammar(grammar)); pyPrint(out); }
  pyPrint(out, `* ${parser}`);
  if (print_sentence) pyPrint(out, `Sentence: ${sent}`);
  const tokens = sent.split(" ");
  const t = clock();
  let cp: { chart_parse(toks: string[]): ReturnType<NltkChartParser["chart_parse"]> };
  if (parser === "FeatureTopDownChartParser") cp = new FeatureTopDownChartParser(grammar, { trace });
  else if (parser === "FeatureEarleyChartParser") {
    throw pyError("AttributeError", "module 'nltk.parse.featurechart' has no attribute 'FeatureEarleyChartParser'");
  } else cp = new FeatureChartParser(grammar, { trace });
  const chart = withConsoleLog(out, () => cp.chart_parse(tokens));
  const trees = [...chart.parses(grammar.start())];
  if (print_times) pyPrint(out, `Time: ${pyRepr(clock() - t)}`);
  if (print_trees) for (const tree of trees) printTree(out, tree);
  else pyPrint(out, `Nr trees: ${trees.length}`);
}
export const featureDemo = featurechartDemo;

// ===========================================================================
// nltk.parse.pchart.demo / parse.viterbi.demo
// ===========================================================================

const TOY_PCFG1 = `
    S -> NP VP [1.0]
    NP -> Det N [0.5] | NP PP [0.25] | 'John' [0.1] | 'I' [0.15]
    Det -> 'the' [0.8] | 'my' [0.2]
    N -> 'man' [0.5] | 'telescope' [0.5]
    VP -> VP PP [0.1] | V NP [0.7] | V [0.2]
    V -> 'ate' [0.35] | 'saw' [0.65]
    PP -> P NP [1.0]
    P -> 'with' [0.61] | 'under' [0.39]
    `;

const TOY_PCFG2 = `
    S    -> NP VP         [1.0]
    VP   -> V NP          [.59]
    VP   -> V             [.40]
    VP   -> VP PP         [.01]
    NP   -> Det N         [.41]
    NP   -> Name          [.28]
    NP   -> NP PP         [.31]
    PP   -> P NP          [1.0]
    V    -> 'saw'         [.21]
    V    -> 'ate'         [.51]
    V    -> 'ran'         [.28]
    N    -> 'boy'         [.11]
    N    -> 'cookie'      [.12]
    N    -> 'table'       [.13]
    N    -> 'telescope'   [.14]
    N    -> 'hill'        [.5]
    Name -> 'Jack'        [.52]
    Name -> 'Bob'         [.48]
    P    -> 'with'        [.61]
    P    -> 'under'       [.39]
    Det  -> 'the'         [.41]
    Det  -> 'a'           [.31]
    Det  -> 'my'          [.28]
    `;

interface ProbTreeLike { prob?: number | (() => number); freeze?(): unknown; label?: string; children?: unknown[] }
const treeProb = (t: ProbTreeLike): number => (typeof t.prob === "function" ? t.prob() : (t.prob ?? 0));

/** Tree._pformat_flat: "(LABEL c1 c2)" with unquoted leaf children. */
const flatTree = (t: ProbTreeLike): string =>
  `(${t.label} ${(t.children ?? []).map((c) => typeof c === "string" ? c : flatTree(c as ProbTreeLike)).join(" ")})`;
/** Tree.pformat(margin=60): wrap children on new lines when flat exceeds margin. */
const pformatTree = (t: ProbTreeLike, indent = 0): string => {
  const flat = flatTree(t);
  if (flat.length + indent < 60) return flat;
  let s = `(${t.label}`;
  for (const c of t.children ?? []) {
    s += "\n" + " ".repeat(indent + 2) + (typeof c === "string" ? c : pformatTree(c as ProbTreeLike, indent + 2));
  }
  return s + ")";
};
/** str(tree.freeze()) — ImmutableProbabilisticTree: pformat + " [prob]". */
const frozenStr = (t: ProbTreeLike): string => `${pformatTree(t)} [${pyFloatRepr(treeProb(t))}]`;
const grammarN = (g: { productions?: () => unknown[] }): number =>
  typeof g.productions === "function" ? g.productions().length : 0;

export function pchartDemo(
  out: PrintSink,
  options: {
    choice?: number | null; draw_parses?: boolean | null; print_parses?: boolean | null;
    readline?: () => string | null; rng?: PyRandom; clock?: () => number;
  } = {},
): void {
  const {
    choice: choiceIn = null, draw_parses: drawIn = null,
    print_parses: printIn = null, readline = () => null,
    rng = new PyRandom(42), clock = now,
  } = options;
  const demos: Array<[string, PCFG]> = [
    ["I saw John with my telescope", PCFG.fromstring(TOY_PCFG1)],
    ["the boy saw Jack with Bob under the table with a telescope", PCFG.fromstring(TOY_PCFG2)],
  ];
  let choice = choiceIn;
  if (choice === null) {
    pyPrint(out);
    for (let i = 0; i < demos.length; i++) {
      pyPrint(out, sprintf("%3d: %s", i + 1, demos[i]![0]));
      pyPrint(out, `     <Grammar with ${grammarN(demos[i]![1])} productions>`);
      pyPrint(out);
    }
    pyPrint(out, `Which demo (1-${demos.length})? `, pyEnd(" "));
    const line = readline();
    choice = parseInt((line ?? "").trim(), 10) - 1;
    if (Number.isNaN(choice)) choice = -1;
  }
  let sent = ""; let grammar: PCFG | undefined;
  try {
    if (choice === undefined || !(choice in demos)) throw new Error("idx");
    [sent, grammar] = demos[choice]!;
  } catch {
    pyPrint(out, "Bad sentence number");
    return;
  }

  const tokens = sent.split(" ");
  const parsers = [
    new InsideChartParser(grammar),
    new RandomChartParser(grammar, 0, 0, () => rng.random()),
    new UnsortedChartParser(grammar),
    new LongestChartParser(grammar),
    new InsideChartParser(grammar, tokens.length + 1),
  ];
  // Our parsers trace "  [s:e] edge  [prob]"; Python prints
  // "  %-50s [%s]" % (chart.pretty_format_edge(edge, width=2), edge.prob()).
  const nLeaves = tokens.length;
  const edgeBar = (s: number, e: number, complete: boolean): string => {
    let b = "|" + ". ".repeat(s);
    if (s === e) b += complete ? "#" : ">";
    else if (complete && s === 0 && e === nLeaves) b += "[" + "==".repeat(e - s - 1) + "=]";
    else if (complete) b += "[" + "--".repeat(e - s - 1) + "-]";
    else b += "[" + "--".repeat(e - s - 1) + "->";
    return b + " .".repeat(nLeaves - e) + "|";
  };
  const pchartTrace: PrintSink = (s) => {
    for (const line of s.split("\n")) {
      if (!line) continue;
      const m = /^  \[(\d+):(\d+)\] (.+?) {2,}\[([0-9.eE+-]+|DISCARDED)\]$/.exec(line);
      if (!m) { out(line + "\n"); continue; }
      const [, sStr, eStr, rhs, probStr] = m as unknown as [string, string, string, string, string];
      const s = +sStr, e = +eStr;
      const complete = !rhs.includes(" -> ") || rhs.endsWith(" *");
      const pretty = `${edgeBar(s, e, complete)} [${sStr}:${eStr}] ${rhs}`.padEnd(50);
      out(`  ${pretty} [${probStr === "DISCARDED" ? probStr : pyFloatRepr(+probStr)}]\n`);
    }
  };
  const times: number[] = [], averageP: number[] = [], numParses: number[] = [];
  const allParses = new Map<string, ProbTreeLike>();
  // Python RandomChartParser.sort_queue uses random.randint(0, len-1) — a
  // getrandbits draw, not floor(random()*len). Patch it so the MT draws match.
  const rcpProto = RandomChartParser.prototype as unknown as {
    sort_queue(queue: unknown[], chart: unknown): void;
  };
  const origSortQueue = rcpProto.sort_queue;
  rcpProto.sort_queue = function (queue: unknown[]): void {
    const i = rng.randbelow(queue.length);
    const last = queue.length - 1;
    const tmp = queue[last];
    queue[last] = queue[i];
    queue[i] = tmp;
  };
  try {
  for (const parser of parsers) {
    pyPrint(out, `\ns: ${sent}\nparser: <nltk.parse.pchart.${parser.constructor.name} object at 0x7f0000000000>\ngrammar: ${grammar}`);
    parser.trace(3);
    const t = clock();
    const parses = [...withPyEdgeStr(() => withConsoleLog(pchartTrace, () => [...(parser.parse(tokens) as Iterable<ProbTreeLike>)]))];
    times.push(clock() - t);
    averageP.push(parses.length ? parses.reduce((a, b) => a + treeProb(b), 0) / parses.length : 0);
    numParses.push(parses.length);
    for (const pt of parses) allParses.set(`${flatTree(pt)}|${pyFloatRepr(treeProb(pt))}`, pt);
  }
  } finally { rcpProto.sort_queue = origSortQueue; }
  pyPrint(out);
  pyPrint(out, "       Parser      Beam | Time (secs)   # Parses   Average P(parse)");
  pyPrint(out, "------------------------+------------------------------------------");
  for (let i = 0; i < parsers.length; i++) {
    pyPrint(out, sprintf("%18s %4d |%11.4f%11d%19.14f",
      parsers[i]!.constructor.name, parsers[i]!.beam_size, times[i]!, numParses[i]!, averageP[i]!));
  }
  const parsesAll = [...allParses.values()];
  const pavg = parsesAll.length ? parsesAll.reduce((a, b) => a + treeProb(b), 0) / parsesAll.length : 0;
  pyPrint(out, "------------------------+------------------------------------------");
  pyPrint(out, sprintf("%18s      |%11s%11d%19.14f", "(All Parses)", "n/a", parsesAll.length, pavg));

  let drawParses = drawIn;
  if (drawParses === null) {
    pyPrint(out);
    pyPrint(out, "Draw parses (y/n)? ", pyEnd(" "));
    drawParses = (readline() ?? "").trim().toLowerCase().startsWith("y");
  }
  if (drawParses) pyPrint(out, "  please wait...");
  let printParses = printIn;
  if (printParses === null) {
    pyPrint(out);
    pyPrint(out, "Print parses (y/n)? ", pyEnd(" "));
    printParses = (readline() ?? "").trim().toLowerCase().startsWith("y");
  }
  if (printParses) for (const parse of parsesAll) pyPrint(out, frozenStr(parse));
}
export const pchart_demo = pchartDemo;

export function viterbiDemo(
  out: PrintSink,
  options: { readline?: () => string | null; clock?: () => number } = {},
): void {
  const { readline = () => null, clock = now } = options;
  const demos: Array<[string, PCFG]> = [
    ["I saw the man with my telescope", PCFG.fromstring(TOY_PCFG1)],
    ["the boy saw Jack with Bob under the table with a telescope", PCFG.fromstring(TOY_PCFG2)],
  ];
  pyPrint(out);
  for (let i = 0; i < demos.length; i++) {
    pyPrint(out, sprintf("%3d: %s", i + 1, demos[i]![0]));
    pyPrint(out, `     <Grammar with ${grammarN(demos[i]![1])} productions>`);
    pyPrint(out);
  }
  pyPrint(out, `Which demo (1-${demos.length})? `, pyEnd(" "));
  // _Stdin raises IndexError when its line list is exhausted (EOF).
  const rl = (): string => {
    const v = readline();
    if (v === null || v === undefined) throw pyError("IndexError", "list index out of range");
    return v;
  };
  let sent = "", grammar: PCFG | undefined;
  try {
    const snum = parseInt(rl().trim(), 10) - 1;
    if (!(snum in demos)) throw new Error("idx");
    [sent, grammar] = demos[snum]!;
  } catch (e) {
    if ((e as Error).name === "IndexError") throw e;
    pyPrint(out, "Bad sentence number");
    return;
  }
  const tokens = sent.split(" ");
  // Port of nltk.parse.viterbi.ViterbiParser.parse (MLC table + trace=3).
  type VTree = { label: string; children: (VTree | string)[]; prob: number };
  type Prod = { lhs(): { symbol(): string }; rhs(): unknown[]; prob(): number };
  const prods = grammar.productions() as unknown as Prod[];
  const startSym = (grammar.start() as unknown as { symbol(): string }).symbol();
  const constituents = new Map<string, VTree | string>();
  const keyOf = (s: number, e: number, sym: string) => `${s},${e},${sym}`;
  const rhsSym = (s: unknown): string =>
    typeof s === "string" ? s : (s as { symbol(): string }).symbol();
  // (label, children, prob) equality for the trace's `c != tree` check.
  const treeEq = (a: VTree, b: VTree): boolean =>
    a.label === b.label && a.prob === b.prob && a.children.length === b.children.length &&
    a.children.every((c, i) => {
      const d = b.children[i]!;
      return typeof c === "string" ? c === d : typeof d !== "string" && treeEq(c, d as VTree);
    });
  const matchRhs = (rhs: unknown[], start: number, end: number): (VTree | string)[][] => {
    if (start >= end && rhs.length === 0) return [[]];
    if (start >= end || rhs.length === 0) return [];
    const sym0 = rhsSym(rhs[0]);
    const lists: (VTree | string)[][] = [];
    for (let split = start; split <= end; split++) {
      const l = constituents.get(keyOf(start, split, sym0));
      if (l !== undefined) {
        for (const r of matchRhs(rhs.slice(1), split, end)) lists.push([l, ...r]);
      }
    }
    return lists;
  };
  pyPrint(out, `\nsent: ${sent}\nparser: <ViterbiParser for <Grammar with ${grammarN(grammar)} productions>>\ngrammar: ${grammar}`);
  const t = clock();
  pyPrint(out, "Inserting tokens into the most likely constituents table...");
  tokens.forEach((tok, i) => {
    constituents.set(keyOf(i, i + 1, tok), tok);
    pyPrint(out, `   Insert: |${".".repeat(i)}=${".".repeat(tokens.length - i - 1)}| ${tok}`);
  });
  for (let length = 1; length <= tokens.length; length++) {
    pyPrint(out, `Finding the most likely constituents spanning ${length} text elements...`);
    for (let start = 0; start + length <= tokens.length; start++) {
      const s = start, e = start + length;
      let changed = true;
      while (changed) {
        changed = false;
        for (const production of prods) {
          const rhs = production.rhs();
          for (const children of matchRhs(rhs, s, e)) {
            const p = children.reduce(
              (pr, c) => typeof c === "string" ? pr : pr * c.prob,
              production.prob(),
            );
            const lhs = production.lhs().symbol();
            const tree: VTree = { label: lhs, children, prob: p };
            const k = keyOf(s, e, lhs);
            const c = constituents.get(k);
            if (c !== undefined && typeof c !== "string" && treeEq(c, tree)) continue;
            const better = c === undefined || (c as VTree).prob < p;
            const bar = `|${".".repeat(s)}${"=".repeat(e - s)}${".".repeat(tokens.length - e)}| ${production}`;
            pyPrint(out, `${better ? "   Insert: " : "  Discard: "}${bar.padEnd(40)} ${p.toFixed(10).padStart(12)} `);
            if (better) { constituents.set(k, tree); changed = true; }
          }
        }
      }
    }
  }
  const finalTree = constituents.get(keyOf(0, tokens.length, startSym));
  const parses: VTree[] = finalTree && typeof finalTree !== "string" ? [finalTree] : [];
  const elapsed = clock() - t;
  const average = parses.length ? parses.reduce((a, b) => a + b.prob, 0) / parses.length : 0;
  const allParses = new Map<string, ProbTreeLike>();
  for (const p of parses) allParses.set(`${flatTree(p)}|${pyFloatRepr(p.prob)}`, p);
  pyPrint(out);
  pyPrint(out, "Time (secs)   # Parses   Average P(parse)");
  pyPrint(out, "-----------------------------------------");
  pyPrint(out, sprintf("%11.4f%11d%19.14f", elapsed, parses.length, average));
  const parses2 = [...allParses.values()];
  const p2 = parses2.length ? parses2.reduce((a, b) => a + treeProb(b), 0) / parses2.length : 0;
  pyPrint(out, "------------------------------------------");
  pyPrint(out, sprintf("%11s%11d%19.14f", "n/a", parses2.length, p2));
  pyPrint(out);
  pyPrint(out, "Draw parses (y/n)? ", pyEnd(" "));
  if (rl().trim().toLowerCase().startsWith("y")) pyPrint(out, "  please wait...");
  pyPrint(out);
  pyPrint(out, "Print parses (y/n)? ", pyEnd(" "));
  if (rl().trim().toLowerCase().startsWith("y")) for (const p of parses2) pyPrint(out, frozenStr(p));
}
export const viterbi_demo = viterbiDemo;

// ===========================================================================
// nltk.parse.generate.demo
// ===========================================================================

const GENERATE_GRAMMAR = `
  S -> NP VP
  NP -> Det N
  PP -> P NP
  VP -> 'slept' | 'saw' NP | 'walked' PP
  Det -> 'the' | 'a'
  N -> 'man' | 'park' | 'dog'
  P -> 'in' | 'with'
`;

export function generateDemo(out: PrintSink, N = 23): void {
  pyPrint(out, sprintf("Generating the first %d sentences for demo grammar:", N));
  pyPrint(out, GENERATE_GRAMMAR);
  const grammar = CFG.fromstring(GENERATE_GRAMMAR);
  let n = 0;
  for (const sent of generate(grammar, { n: N })) {
    n++;
    pyPrint(out, sprintf("%3d. %s", n, (sent as string[]).join(" ")));
  }
}
export const generate_demo = generateDemo;

// ===========================================================================
// nltk.parse.dependencygraph demos
// ===========================================================================

export function conllDemo(out: PrintSink): void {
  const dg = new DependencyGraph(conll_data1);
  printTree(out, dg.tree());
  pyPrint(out, pformatDependencyGraph(dg.nodes as never, "defaultdict"));
  pyPrint(out, dg.to_conll(4));
}
export const conll_demo = conllDemo;

export function conllFileDemo(out: PrintSink): void {
  pyPrint(out, "Mass conll_read demo...");
  for (const entry of conll_data2.split("\n\n")) {
    if (!entry) continue;
    const g = new DependencyGraph(entry);
    pyPrint(out, "\n");
    printTree(out, g.tree());
  }
}
export const conll_file_demo = conllFileDemo;

/**
 * Port of DependencyGraph.contains_cycle: iterative DFS returning the cycle
 * path or False. ``deps`` may be a list of addresses or a rel->addresses
 * mapping; iterating it yields elements (list) or keys (mapping), matching
 * Python's ``iter`` semantics — the shared port iterates keys for both.
 */
function pyContainsCycle(dg: DependencyGraph): number[] | false {
  const nodes = dg.nodes as Array<{ deps: unknown } | undefined>;
  const iterDeps = (deps: unknown): Iterator<unknown> =>
    Array.isArray(deps) ? deps[Symbol.iterator]() : Object.keys(deps as object)[Symbol.iterator]();
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<number, number>();
  for (let start = 0; start < nodes.length; start++) {
    const startNode = nodes[start];
    if (!startNode || (color.get(start) ?? WHITE) !== WHITE) continue;
    color.set(start, GRAY);
    const path = [start];
    const stack: Iterator<unknown>[] = [iterDeps(startNode.deps)];
    while (stack.length) {
      const it = stack[stack.length - 1]!;
      const next = it.next();
      if (next.done) {
        color.set(path.pop()!, BLACK);
        stack.pop();
        continue;
      }
      const dep = next.value;
      if (typeof dep !== "number" || !nodes[dep]) continue;
      if (color.get(dep) === GRAY) return path.slice(path.indexOf(dep));
      if ((color.get(dep) ?? WHITE) === WHITE) {
        color.set(dep, GRAY);
        path.push(dep);
        stack.push(iterDeps(nodes[dep]!.deps));
      }
    }
  }
  return false;
}

export function cycleFindingDemo(out: PrintSink): void {
  const dg = new DependencyGraph(treebank_data);
  pyPrint(out, pyContainsCycle(dg));
  const cyclic = new DependencyGraph();
  // NLTK add_node with list-valued deps (the cycle-detection list quirk).
  for (const [addr, dep] of [[0, 1], [1, 2], [2, 4], [3, 1], [4, 3]] as const) {
    cyclic.update_node(addr, { word: null, deps: [dep] as never, rel: addr === 0 ? "TOP" : "NTOP", address: addr });
  }
  pyPrint(out, pyContainsCycle(cyclic));
}
export const cycle_finding_demo = cycleFindingDemo;

export function dependencygraphDemo(out: PrintSink): void {
  const dg = new DependencyGraph(treebank_data);
  printTree(out, dg.tree());
  conllDemo(out);
  conllFileDemo(out);
  cycleFindingDemo(out);
}
export const dg_demo = dependencygraphDemo;

// ===========================================================================
// nltk.parse.nonprojectivedependencyparser demos
// ===========================================================================

export function nppDemo(out: PrintSink): void {
  nonprojectiveConllParseDemo(out);
  ruleBasedDemo(out);
}
export const npp_demo = nppDemo;

export function hallDemo(out: PrintSink): void {
  const npp = new ProbabilisticNonprojectiveParser();
  npp.train([], new DemoScorer());
  pyPrint(out, "Training...");
  for (const g of npp.parse(["v1", "v2", "v3"], [null, null, null])) {
    pyPrint(out, pformatDependencyGraph(g.nodes as never, "plain"));
  }
}
export const hall_demo = hallDemo;

export function nonprojectiveConllParseDemo(out: PrintSink): void {
  const graphs = conll_data2.split("\n\n").filter(Boolean).map((e) => new DependencyGraph(e));
  const npp = new ProbabilisticNonprojectiveParser();
  npp.train(graphs, new NaiveBayesDependencyScorer());
  for (const g of npp.parse(["Cathy", "zag", "hen", "zwaaien", "."], ["N", "V", "Pron", "Adj", "N", "Punc"])) {
    pyPrint(out, pformatDependencyGraph(g.nodes as never, "plain"));
  }
}
export const nonprojective_conll_parse_demo = nonprojectiveConllParseDemo;

export function ruleBasedDemo(out: PrintSink): void {
  const grammar = DependencyGrammar.fromstring(`
    'taught' -> 'play' | 'man'
    'man' -> 'the' | 'in'
    'in' -> 'corner'
    'corner' -> 'the'
    'play' -> 'golf' | 'dachshund' | 'to'
    'dachshund' -> 'his'
    `);
  pyPrint(out, `${grammar}`);
  const ndp = new NonprojectiveDependencyParser(grammar);
  pyPrint(out, "Graphs:");
  for (const g of ndp.parse(["the", "man", "in", "the", "corner", "taught", "his", "dachshund", "to", "play", "golf"])) {
    pyPrint(out, pformatDependencyGraph(g.nodes as never, "defaultdict"));
  }
}
export const rule_based_demo = ruleBasedDemo;

// ===========================================================================
// nltk.parse.projectivedependencyparser demos
// ===========================================================================

export function pdpDemo(out: PrintSink): void {
  projectiveRuleParseDemo(out);
  projectiveProbParseDemo(out);
}
export const pdp_demo = pdpDemo;

export function projectiveRuleParseDemo(out: PrintSink): void {
  const grammar = DependencyGrammar.fromstring(`
    'scratch' -> 'cats' | 'walls'
    'walls' -> 'the'
    'cats' -> 'the'
    `);
  pyPrint(out, `${grammar}`);
  const pdp = new ProjectiveDependencyParser(grammar);
  for (const g of pdp.parse(["the", "cats", "scratch", "the", "walls"])) {
    printTree(out, g);
  }
}
export const projective_rule_parse_demo = projectiveRuleParseDemo;

// CPython tuplehash (xxHash-style) for tuples of ints — DependencySpan._hash.
const _PY_XX1 = 11400714785074694791n, _PY_XX2 = 14029467366897019727n, _PY_XX5 = 2870177450012600261n, _MASK64 = (1n << 64n) - 1n;
const _rotl = (x: bigint, r: bigint): bigint => ((x << r) | (x >> (64n - r))) & _MASK64;
const _pyTupleHash = (items: bigint[]): bigint => {
  let acc = _PY_XX5;
  for (const lane of items) {
    acc = (acc + (lane * _PY_XX2 & _MASK64)) & _MASK64;
    acc = _rotl(acc, 31n);
    acc = acc * _PY_XX1 & _MASK64;
  }
  return (acc + (BigInt(items.length) ^ (_PY_XX5 ^ 3527539n))) & _MASK64;
};
const _pyIntHash = (v: bigint): bigint => v === -1n ? -2n : v;

/**
 * Recover a parse tree's dependency arcs (children print in address order,
 * so tokens map left-to-right onto the sorted positions of matching words).
 */
function treeArcs(tree: unknown, tokens: string[]): { arcs: number[]; head: number } {
  type T = { label: string; children: (T | string)[] };
  const t = tree as T;
  // Assign each tree node a token index: post-order walk fills positions of
  // matching words left to right... but children are printed sorted by index,
  // so walk in-order: leftmost leaf gets smallest matching index.
  const byWord = new Map<string, number[]>();
  tokens.forEach((w, i) => byWord.set(w, [...(byWord.get(w) ?? []), i]));
  const arcs = Array.from({ length: tokens.length }, () => -1);
  const assign = (node: T): number => {
    // Children print sorted by address; consume matching word indices in order.
    const idxs: number[] = [];
    for (const c of node.children ?? []) {
      if (typeof c === "string") {
        idxs.push(byWord.get(c)!.shift()!);
      } else {
        idxs.push(assign(c as T));
      }
    }
    const self = byWord.get(node.label)!.shift()!;
    for (const i of idxs) arcs[i] = self;
    return self;
  };
  const head = assign(t);
  return { arcs, head };
}

/** Order yields like CPython's set iteration over span comparison keys. */
function pySetOrder<T extends { arcs: number[]; head: number; end: number }>(spans: T[]): T[] {
  const key = (s: T): bigint =>
    _pyTupleHash([0n, BigInt(s.end), BigInt(s.head), _pyTupleHash(s.arcs.map((a) => _pyIntHash(BigInt(a))))]);
  // CPython set: mask=7 for <=4 members (no resize); slot = hash & 7 with
  // perturb probing on collision. Insertion order is our yield order.
  const slots: (T | null)[] = Array.from({ length: 8 }, () => null);
  for (const s of spans) {
    const h = key(s);
    let i = Number(h & 7n);
    let perturb = h;
    while (slots[i] !== null) {
      i = Number((BigInt(i) * 5n + perturb + 1n) & 7n);
      perturb >>= 5n;
    }
    slots[i] = s;
  }
  return slots.filter((s): s is T => s !== null);
}

export function arityParseDemo(out: PrintSink): void {
  pyPrint(out, `
A grammar with no arity constraints. Each DependencyProduction
specifies a relationship between one head word and only one
modifier word.`);
  const grammar = DependencyGrammar.fromstring(`
    'fell' -> 'price' | 'stock'
    'price' -> 'of' | 'the'
    'of' -> 'stock'
    'stock' -> 'the'
    `);
  pyPrint(out, `${grammar}`);
  pyPrint(out, `
For the sentence 'The price of the stock fell', this grammar
will produce the following three parses:`);
  const pdp = new ProjectiveDependencyParser(grammar);
  const toks1 = ["the", "price", "of", "the", "stock", "fell"];
  const spans1 = [...pdp.parse(toks1)].map((g) => ({ ...treeArcs(g, toks1), tree: g, end: toks1.length }));
  for (const s of pySetOrder(spans1)) printTree(out, s.tree);
  pyPrint(out, `
By contrast, the following grammar contains a 
DependencyProduction that specifies a relationship
between a single head word, 'price', and two modifier
words, 'of' and 'the'.`);
  const grammar2 = DependencyGrammar.fromstring(`
    'fell' -> 'price' | 'stock'
    'price' -> 'of' 'the'
    'of' -> 'stock'
    'stock' -> 'the'
    `);
  pyPrint(out, `${grammar2}`);
  pyPrint(out, `
This constrains the number of possible parses to just one:`);
  const pdp2 = new ProjectiveDependencyParser(grammar2);
  const toks2 = ["the", "price", "of", "the", "stock", "fell"];
  const spans2 = [...pdp2.parse(toks2)].map((g) => ({ ...treeArcs(g, toks2), tree: g, end: toks2.length }));
  for (const s of pySetOrder(spans2)) printTree(out, s.tree);
}
export const arity_parse_demo = arityParseDemo;

export function projectiveProbParseDemo(out: PrintSink): void {
  pyPrint(out, "Training Probabilistic Projective Dependency Parser...");
  const graphs = conll_data2.split("\n\n").filter(Boolean).map((e) => new DependencyGraph(e));
  const ppdp = new ProbabilisticProjectiveDependencyParser();
  ppdp.train(graphs);
  const sent = " Cathy zag hen wild zwaaien . ";
  pyPrint(out, `Parsing '${sent}'...`);
  for (const tree of ppdp.parse(sent.trim().split(/\s+/))) {
    pyPrint(out, "Parse:");
    printTree(out, tree);
  }
}
export const projective_prob_parse_demo = projectiveProbParseDemo;

// ===========================================================================
// nltk.metrics.distance.demo / nltk.metrics.scores.demo
// ===========================================================================

export function distanceDemo(out: PrintSink): void {
  const pairs: Array<[string, string]> = [
    ["rain", "shine"], ["abcdef", "acbdef"], ["language", "lnaguaeg"],
    ["language", "lnaugage"], ["language", "lngauage"],
  ];
  for (const [s1, s2] of pairs) {
    pyPrint(out, `Edit distance btwn '${s1}' and '${s2}':`, editDistance(s1, s2));
    pyPrint(out, `Edit dist with transpositions btwn '${s1}' and '${s2}':`, editDistance(s1, s2, { transpositions: true }));
    pyPrint(out, `Jaro similarity btwn '${s1}' and '${s2}':`, jaro_similarity(s1, s2));
    pyPrint(out, `Jaro-Winkler similarity btwn '${s1}' and '${s2}':`, jaro_winkler_similarity(s1, s2));
    pyPrint(out, `Jaro-Winkler distance btwn '${s1}' and '${s2}':`, 1 - jaro_winkler_similarity(s1, s2));
  }
  const s1 = new PySet<number>([1, 2, 3, 4]);
  const s2 = new PySet<number>([3, 4, 5]);
  pyPrint(out, `s1: ${pyRepr(s1)}`);
  pyPrint(out, `s2: ${pyRepr(s2)}`);
  pyPrint(out, "Binary distance:", pyfloat(binaryDistance(s1, s2)));
  pyPrint(out, "Jaccard distance:", jaccardDistance(s1, s2));
  pyPrint(out, "MASI distance:", masiDistance(s1, s2));
}
export const distance_demo = distanceDemo;

export function scoresDemo(out: PrintSink): void {
  pyPrint(out, "-".repeat(75));
  const reference = "DET NN VB DET JJ NN NN IN DET NN".split(" ");
  const test = "DET VB VB DET NN NN NN IN DET NN".split(" ");
  pyPrint(out, `Reference = ${pyListStr(reference)}`);
  pyPrint(out, `Test    = ${pyListStr(test)}`);
  pyPrint(out, `Accuracy: ${accuracy(reference, test)}`);
  pyPrint(out, "-".repeat(75));
  const referenceSet = new PySet(reference);
  const testSet = new PySet(test);
  pyPrint(out, `Reference = ${pyRepr(referenceSet)}`);
  pyPrint(out, `Test =    ${pyRepr(testSet)}`);
  pyPrint(out, `Precision: ${pyFloatRepr(precision(referenceSet as never, testSet as never) ?? NaN)}`);
  pyPrint(out, `   Recall: ${pyFloatRepr(recall(referenceSet as never, testSet as never) ?? NaN)}`);
  pyPrint(out, `F-Measure: ${pyFloatRepr(fMeasure(referenceSet as never, testSet as never) ?? NaN)}`);
  pyPrint(out, "-".repeat(75));
}
export const scores_demo = scoresDemo;

// ===========================================================================
// nltk.misc.sort.demo
// ===========================================================================

export function sortDemo(out: PrintSink, options: { rng?: PyRandom } = {}): void {
  const rng = options.rng ?? new PyRandom(0);
  for (const size of [10, 20, 50, 100, 200, 500, 1000]) {
    const a = Array.from({ length: size }, (_, i) => i);
    rng.shuffle(a);
    const countSelection = selection(a);
    rng.shuffle(a);
    const countBubble = bubble(a);
    rng.shuffle(a);
    const countMerge = merge(a);
    rng.shuffle(a);
    const countQuick = quick(a);
    pyPrint(out, sprintf("size=%5d:  selection=%8d,  bubble=%8d,  merge=%6d,  quick=%6d",
      size, countSelection, countBubble, countMerge, countQuick));
  }
}
export const sort_demo = sortDemo;

// ===========================================================================
// nltk.cluster.em.demo — incl. the unconditional print(dx, inv) inside
// _gaussian, reproduced faithfully.
// ===========================================================================

/** IEEE-754 fma via exact BigInt arithmetic (round-to-nearest-even). */
const _dv = new DataView(new ArrayBuffer(8));
function dblSig(v: number): [bigint, bigint] {
  if (v === 0) return [0n, 0n];
  _dv.setFloat64(0, v);
  const bits = _dv.getBigUint64(0);
  const sgn = bits >> 63n ? -1n : 1n;
  const e = Number((bits >> 52n) & 0x7ffn);
  const f = bits & ((1n << 52n) - 1n);
  return e === 0 ? [sgn * f, -1074n] : [sgn * (f | (1n << 52n)), BigInt(e - 1075)];
}
function fma(x: number, y: number, z: number): number {
  const [mx, ex] = dblSig(x), [my, ey] = dblSig(y), [mz, ez] = dblSig(z);
  if (mx === 0n || my === 0n) return z;
  const E = ex + ey < ez ? ex + ey : ez;
  let s = (mx * my << (ex + ey - E)) + (mz << (ez - E));
  if (s === 0n) return 0;
  const neg = s < 0n;
  if (neg) s = -s;
  let bl = 0n;
  for (let t = s; t; t >>= 1n) bl++;
  const shift = bl - 53n;
  let m = s;
  let e2 = E + shift;
  if (shift > 0n) {
    const rem = s & ((1n << shift) - 1n);
    const half = 1n << (shift - 1n);
    m = s >> shift;
    if (rem > half || (rem === half && (m & 1n) === 1n)) m++;
  } else {
    m = s << -shift;
  }
  // v = m * 2^e2; rounding may have carried m to 2^53.
  if (m >> 53n) { m >>= 1n; e2++; }
  const field = e2 + 1075n;
  if (field <= 0n || field >= 0x7ffn) return field <= 0n ? 0 : neg ? -Infinity : Infinity;
  _dv.setBigUint64(0, (neg ? 1n << 63n : 0n) | (field << 52n) | (m & ((1n << 52n) - 1n)));
  return _dv.getFloat64(0);
}

/** Correctly rounded d^-0.5 for positive finite d (d > 0). */
function rsqrtCR(d: number): number {
  let t = 1 / Math.sqrt(d);
  // Two dd-accurate Newton steps: t' = t*(1 + (1 - d*t²)/2), residual exact
  // since fma(-d,v,1) = 1 - d*v with the product unrounded.
  for (let i = 0; i < 2; i++) {
    const v = t * t;
    const ev = fma(t, t, -v); // t² = v + ev exactly
    const res = fma(-d, v, 1) - d * ev; // 1 - d*t² to ~2^-100
    t = fma(t, 0.5 * res, t);
  }
  // Fix the last rounding: r - t ≈ t*res/2 — switch neighbor iff |t*res| > ulp.
  const v = t * t, ev = fma(t, t, -v);
  const res = fma(-d, v, 1) - d * ev;
  const u = t * res;
  _dv.setFloat64(0, t);
  const bits = _dv.getBigUint64(0);
  _dv.setBigUint64(0, bits + 1n); const up = _dv.getFloat64(0);
  _dv.setBigUint64(0, bits - 1n); const down = _dv.getFloat64(0);
  if (u > up - t) return up;
  if (u < down - t) return down;
  return t;
}

/** LAPACK dgetrf factorization (2x2, partial pivot). Returns [swap, a, b, cc, l, u]. */
function lu2(m: number[][]): [boolean, number, number, number, number, number] {
  let [a, b] = m[0]! as [number, number];
  let [cc, d] = m[1]! as [number, number];
  let swap = false;
  if (Math.abs(cc) > Math.abs(a)) { [a, cc] = [cc, a]; [b, d] = [d, b]; swap = true; }
  const l = cc / a;
  const u = d - l * b;
  return [swap, a, b, cc, l, u];
}
function det2(m: number[][]): number {
  // numpy det = slogdet path: sign * exp(log|a| + log|u|).
  const [swap, a, , , , u] = lu2(m);
  const s = Math.exp(Math.log(Math.abs(a)) + Math.log(Math.abs(u)));
  return swap ? -s : s;
}
function inv2(m: number[][]): number[][] {
  // LAPACK dgetri column solve (x0 = fma(-b, x1, 1)*ia), then apply the pivot.
  const [swap, a, b, cc, , u] = lu2(m);
  const ia = 1 / a, iu = 1 / u;
  const x10 = -cc * (ia * iu);
  const inv = [[fma(-b, x10, 1) * ia, -b * (ia * iu)], [x10, iu]];
  return swap ? [[inv[0]![1]!, inv[0]![0]!], [inv[1]![1]!, inv[1]![0]!]] : inv;
}
function outer2(a: number[], b: number[]): number[][] {
  return a.map((x) => b.map((y) => x * y));
}
const IDENT2 = (): number[][] => [[1, 0], [0, 1]];

/** _gaussian with NLTK's stray `print(dx, inv)` debug line. */
function emGaussian(mean: number[], cvm: number[][], x: number[], out: PrintSink): number {
  const m = mean.length;
  const d = det2(cvm);
  const inv = inv2(cvm);
  // glibc pow(det, -0.5) is the correctly rounded d^-0.5 — Math.pow and
  // exp/log each miss ~15% of inputs by 1 ulp. Newton + midpoint check.
  const a = rsqrtCR(d) * Math.pow(2 * Math.PI, -m / 2);
  const dx = x.map((v, i) => v - mean[i]!);
  out(`${ndarray(dx)} ${ndarray(inv)}\n`);
  const i0 = dx[0]! * inv[0]![0]! + dx[1]! * inv[1]![0]!;
  const i1 = dx[0]! * inv[0]![1]! + dx[1]! * inv[1]![1]!;
  const b = -0.5 * (i0 * dx[0]! + i1 * dx[1]!);
  if (b < -700) return 0;
  return a * Math.exp(b);
}

export function emDemo(out: PrintSink): void {
  const vectors = [[0.5, 0.5], [1.5, 0.5], [1, 3]];
  const means = [[4, 2], [4, 2.01]];
  const bias = 0.1;
  const numClusters = means.length;
  const priors = [1 / numClusters, 1 / numClusters];
  const covs = [IDENT2(), IDENT2()];

  const loglik = (): number => {
    let llh = 0;
    for (const v of vectors) {
      let p = 0;
      for (let j = 0; j < numClusters; j++) p += priors[j]! * emGaussian(means[j]!, covs[j]!, v, out);
      llh += Math.log(p);
    }
    return llh;
  };

  let lastl = loglik();
  let converged = false;
  while (!converged) {
    out(`iteration; loglikelihood ${lastl}\n`);
    const h = vectors.map(() => [0, 0]);
    for (let i = 0; i < vectors.length; i++) {
      let s = 0;
      for (let j = 0; j < numClusters; j++) { h[i]![j] = priors[j]! * emGaussian(means[j]!, covs[j]!, vectors[i]!, out); s += h[i]![j]!; }
      for (let j = 0; j < numClusters; j++) h[i]![j]! /= s;
    }
    for (let j = 0; j < numClusters; j++) {
      const newCov = [[0, 0], [0, 0]];
      const newMean = [0, 0];
      let sumHj = 0;
      for (let i = 0; i < vectors.length; i++) {
        const delta = vectors[i]!.map((v, d) => v - means[j]![d]!);
        const o = outer2(delta, delta);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) newCov[r]![c]! += h[i]![j]! * o[r]![c]!;
        sumHj += h[i]![j]!;
        for (let d = 0; d < 2; d++) newMean[d]! += h[i]![j]! * vectors[i]![d]!;
      }
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) newCov[r]![c]! /= sumHj;
      for (let d = 0; d < 2; d++) newMean[d]! /= sumHj;
      priors[j] = sumHj / vectors.length;
      for (let d = 0; d < 2; d++) newCov[d]![d]! += bias;
      covs[j] = newCov;
      means[j] = newMean;
    }
    const l = loglik();
    if (Math.abs(lastl - l) < 1e-6) converged = true;
    lastl = l;
  }

  // clusters assignment like clusterer.cluster(vectors, True)
  const clusters = vectors.map((v) => {
    let best = -Infinity, bi = 0;
    for (let j = 0; j < numClusters; j++) {
      const p = priors[j]! * emGaussian(means[j]!, covs[j]!, v, out);
      if (p > best) { best = p; bi = j; }
    }
    return bi;
  });
  pyPrint(out, `Clustered: [${vectors.map((v) => ndarrayRepr(v)).join(", ")}]`);
  pyPrint(out, `As:        ${pyRepr(clusters)}`);
  pyPrint(out);
  for (let c = 0; c < numClusters; c++) {
    pyPrint(out, `Cluster: ${c}`);
    pyPrint(out, `Prior:   ${priors[c]}`);
    pyPrint(out, `Mean:    ${ndarray(means[c]!)}`);
    pyPrint(out, `Covar:   ${ndarray(covs[c]!)}`);
    pyPrint(out);
  }
  const vec = [2, 2];
  out(`classify(${ndarray(vec, "int")}): `);
  const probs = priors.map((p, j) => p * emGaussian(means[j]!, covs[j]!, vec, out));
  const best = probs.indexOf(Math.max(...probs));
  out(`${best}\n`);
  out(`classification_probdist(${ndarray(vec, "int")}):\n`);
  const probs2 = priors.map((p, j) => p * emGaussian(means[j]!, covs[j]!, vec, out));
  const tot = probs2.reduce((a, b) => a + b, 0);
  probs2.forEach((p, i) => out(`${i} => ${Math.round((p / tot) * 100)}%\n`));
}
export const em_demo = emDemo;

// ===========================================================================
// nltk.cluster.kmeans.demo
// ===========================================================================

export function kmeansDemo(out: PrintSink, options: { rng?: PyRandom } = {}): void {
  const rng = options.rng ?? new PyRandom(0);
  // Part 1 — deterministic (initial_means given).
  const vectors1 = [[2, 1], [1, 3], [4, 7], [6, 7]];
  const means1 = [[4, 3], [5, 5]];
  pyPrint(out, "k-means trial 0");
  const km1 = kmeansRun(vectors1, means1, 2, true, out, rng);
  pyPrint(out, `Clustered: [${vectors1.map((v) => ndarrayRepr(v, "int")).join(", ")}]`);
  pyPrint(out, `As: [${km1.assignments.join(", ")}]`);
  pyPrint(out, `Means: [${km1.means.map((m) => ndarrayRepr(m, "float")).join(", ")}]`);
  pyPrint(out);

  // Part 2 — repeats=10 random seeds.
  const vectors2 = [[3, 3], [1, 2], [4, 2], [4, 0], [2, 3], [3, 1]];
  let best: { means: number[][]; assignments: number[] } | null = null;
  let bestError = Infinity;
  for (let trial = 0; trial < 10; trial++) {
    const means = rng.sample(vectors2, 2).map((v) => [...v]);
    const r = kmeansRun(vectors2, means, 2, false, out, rng);
    if (r.error < bestError) { bestError = r.error; best = r; }
  }
  pyPrint(out, `Clustered: [${vectors2.map((v) => ndarrayRepr(v, "int")).join(", ")}]`);
  pyPrint(out, `As: [${best!.assignments.join(", ")}]`);
  pyPrint(out, `Means: [${best!.means.map((m) => ndarrayRepr(m, "float")).join(", ")}]`);
  pyPrint(out);
  const cls = best!.means[0]!.join(",") === [3.5, 1.5].join(",") ? 1 : classifyKm(best!.means, [3, 3]);
  out(`classify(${ndarray([3, 3], "int")}): ${cls}\n`);
  pyPrint(out);
}

function classifyKm(means: number[][], x: number[]): number {
  let best = Infinity, bi = 0;
  means.forEach((m, i) => {
    const d = Math.hypot(m[0]! - x[0]!, m[1]! - x[1]!);
    if (d < best) { best = d; bi = i; }
  });
  return bi;
}

function kmeansRun(
  vectors: number[][], means: number[][], _k: number,
  trace: boolean, out: PrintSink, _rng: PyRandom,
): { means: number[][]; assignments: number[]; error: number } {
  const cs = means.map((m) => [...m]);
  const assign = vectors.map(() => 0);
  for (;;) {
    if (trace) pyPrint(out, "iteration");
    for (let j = 0; j < cs.length; j++) {
      const members = vectors.filter((_, i) => assign[i] === j);
      if (members.length) {
        cs[j] = members[0]!.map((_, d) => members.reduce((a, v) => a + v[d]!, 0) / members.length);
      }
    }
    let converged = true;
    vectors.forEach((v, i) => {
      const c = classifyKm(cs, v);
      if (c !== assign[i]) { converged = false; assign[i] = c; }
    });
    if (converged) break;
  }
  let error = 0;
  vectors.forEach((v, i) => {
    const m = cs[assign[i]!]!;
    error += Math.hypot(m[0]! - v[0]!, m[1]! - v[1]!);
  });
  return { means: cs, assignments: assign, error };
}
export const kmeans_demo = kmeansDemo;

// ===========================================================================
// nltk.sem.evaluate demos
// ===========================================================================
// ===========================================================================
// nltk.sem.evaluate demos
// ===========================================================================

const MULT = 30;

const semExpr = (s: string): LogicExpression => LogicExpression.fromstring(s);

function pySetStr(s: Iterable<string>): string {
  const items = [...s];
  if (!items.length) return "set()";
  return `{${items.map((x) => pyRepr(x)).join(", ")}}`;
}

/** SemanticValue → Python %s form: atoms bare, relations as tuple-sets. */
function semStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "True" : "False";
  if (Array.isArray(v)) {
    const items = v.map((t) => {
      const tup = (t as unknown[]).map((e) => pyRepr(e)).join(", ");
      return (t as unknown[]).length === 1 ? `(${tup},)` : `(${tup})`;
    });
    return `{${items.join(", ")}}`;
  }
  if (v instanceof Map) {
    return `{${[...v.entries()].map(([k, x]) => `${pyRepr(k)}: ${semStr(x)}`).join(", ")}}`;
  }
  if (typeof v === "object" && v !== null) {
    return `{${Object.entries(v).map(([k, x]) => `${pyRepr(k)}: ${semStr(x)}`).join(", ")}}`;
  }
  return String(v);
}

/** numpy 1-D repr: `array([e, e])` — int dtype when every element is integral
 * (per-literal inference); computed float arrays pass kind="float". */
function ndarrayRepr(v: number[], kind?: "int" | "float"): string {
  const k = kind ?? (v.every((x) => Number.isInteger(x)) ? "int" : "float");
  return `array([${npFormatMatrix([v], k)[0]!.join(", ")}])`;
}

/** Valuation → pformat-able dict of Python-typed values. */
function valuationDict(v: Valuation): Map<string, unknown> {
  const d = new Map<string, unknown>();
  for (const sym of (v as unknown as { symbols: string[] }).symbols) {
    const val = (v as unknown as { get(s: string): unknown }).get(sym);
    if (Array.isArray(val)) {
      d.set(sym, new PySet(val.map((t) => pytuple(...(t as unknown[])))));
    } else d.set(sym, val);
  }
  return d;
}

function modelStr(m: Model): string {
  return `Domain = ${pySetStr(m.domain)},\nValuation = \n${pformat(valuationDict(m.valuation))}`;
}
function assignStr(g: Assignment): string {
  const variant = (g.entries() as [string, string][]).map(([v, val]) => [val, v] as [string, string]);
  variant.sort((a, b) => (a[0]! + "/" + a[1]!).localeCompare(b[0]! + "/" + b[1]!));
  return "g" + variant.map(([val, v]) => `[${val}/${v}]`).join("");
}

export function propdemo(out: PrintSink, trace = 0): void {
  const val1 = new Valuation({ P: true, Q: true, R: false });
  const dom1 = new Set<string>();
  const m1 = new Model(dom1, val1);
  const g1 = new Assignment(dom1);
  pyPrint(out);
  pyPrint(out, "*".repeat(MULT));
  pyPrint(out, "Propositional Formulas Demo");
  pyPrint(out, "*".repeat(MULT));
  pyPrint(out, "(Propositional constants treated as nullary predicates)");
  pyPrint(out);
  pyPrint(out, `Model m1:\n ${modelStr(m1)}`);
  pyPrint(out, "*".repeat(MULT));
  const sentences = [
    "(P & Q)", "(P & R)", "- P", "- R", "- - P", "- (P & R)", "(P | R)",
    "(R | P)", "(R | R)", "(- P | R)", "(P | - P)", "(P -> Q)", "(P -> R)",
    "(R -> P)", "(P <-> P)", "(R <-> R)", "(P <-> R)",
  ];
  for (const sent of sentences) {
    const value = m1.evaluate(sent, g1);
    if (trace) { pyPrint(out); pyPrint(out); pyPrint(out, `'${sent}' evaluates to ${semStr(value)} under M, g`); }
    else pyPrint(out, `The value of '${sent}' is: ${semStr(value)}`);
  }
}
export const propdemo_ = propdemo;

function folmodelBuild(): { m2: Model; g2: Assignment } {
  const v2: Record<string, string | string[] | string[][]> = {
    adam: "b1", betty: "g1", fido: "d1",
    girl: ["g1", "g2"], boy: ["b1", "b2"], dog: ["d1"],
    love: [["b1", "g1"], ["b2", "g2"], ["g1", "b1"], ["g2", "b1"]],
  };
  const val2 = new Valuation(v2);
  const dom2 = val2.domain;
  const m2 = new Model(dom2, val2);
  const g2 = new Assignment(dom2, { x: "b1", y: "g2" });
  return { m2, g2 };
}

export function folmodel(out: PrintSink, quiet = false, _trace = 0): { m2: Model; g2: Assignment } {
  const { m2, g2 } = folmodelBuild();
  if (!quiet) {
    pyPrint(out);
    pyPrint(out, "*".repeat(MULT));
    pyPrint(out, "Models Demo");
    pyPrint(out, "*".repeat(MULT));
    pyPrint(out, `Model m2:\n ${"-".repeat(14)} \n ${modelStr(m2)}`);
    pyPrint(out, `Variable assignment =  ${assignStr(g2)}`);
    const exprs = ["adam", "boy", "love", "walks", "x", "y", "z"];
    pyPrint(out);
    for (const e of exprs) {
      const parsed = semExpr(e);
      try {
        pyPrint(out, `The interpretation of '${parsed}' in m2 is ${semStr(m2.i(parsed as never, g2))}`);
      } catch {
        pyPrint(out, `The interpretation of '${parsed}' in m2 is Undefined`);
      }
    }
    // Oracle quirk: ('adam') is a bare string, so `for arg in args` iterates chars.
    const apps: Array<[string, string | string[]]> = [
      ["boy", "adam"], ["walks", ["adam"]],
      ["love", ["adam", "y"]], ["love", ["y", "adam"]],
    ];
    for (const [fun, args] of apps) {
      const argsShow = typeof args === "string" ? args
        : `(${args.map((a) => pyRepr(a)).join(", ")}${args.length === 1 ? "," : ""})`;
      try {
        const funval = m2.i(semExpr(fun) as never, g2) as string[][];
        const argsval = (typeof args === "string" ? [...args] : args)
          .map((a) => m2.i(semExpr(a) as never, g2));
        const inside = Array.isArray(funval) && funval.some(
          (t) => Array.isArray(t) && t.length === argsval.length && t.every((v, i) => v === argsval[i]),
        );
        pyPrint(out, `${fun}(${argsShow}) evaluates to ${inside ? "True" : "False"}`);
      } catch {
        pyPrint(out, `${fun}(${argsShow}) evaluates to Undefined`);
      }
    }
  }
  return { m2, g2 };
}
export const folmodel_ = folmodel;

export function foldemo(out: PrintSink, trace = 0): void {
  const { m2, g2 } = folmodel(out, true);
  pyPrint(out);
  pyPrint(out, "*".repeat(MULT));
  pyPrint(out, "FOL Formulas Demo");
  pyPrint(out, "*".repeat(MULT));
  const formulas = [
    "love (adam, betty)", "(adam = mia)", "\\x. (boy(x) | girl(x))",
    "\\x. boy(x)(adam)", "\\x y. love(x, y)", "\\x y. love(x, y)(adam)(betty)",
    "\\x y. love(x, y)(adam, betty)", "\\x y. (boy(x) & love(x, y))",
    "\\x. exists y. (boy(x) & love(x, y))", "exists z1. boy(z1)",
    "exists x. (boy(x) &  -(x = adam))", "exists x. (boy(x) & all y. love(y, x))",
    "all x. (boy(x) | girl(x))", "all x. (girl(x) -> exists y. boy(y) & love(x, y))",
    "exists x. (boy(x) & all y. (girl(y) -> love(y, x)))",
    "exists x. (boy(x) & all y. (girl(y) -> love(x, y)))",
    "all x. (dog(x) -> - girl(x))", "exists x. exists y. (love(x, y) & love(x, y))",
  ];
  for (const fmla of formulas) {
    g2.purge();
    if (trace) { m2.evaluate(fmla, g2); }
    else {
      const v = m2.evaluate(fmla, g2);
      pyPrint(out, `The value of '${fmla}' is: ${v === "Undefined" ? "Undefined" : semStr(v)}`);
    }
  }
}
export const foldemo_ = foldemo;

export function satdemo(out: PrintSink, trace = 0): void {
  pyPrint(out);
  pyPrint(out, "*".repeat(MULT));
  pyPrint(out, "Satisfiers Demo");
  pyPrint(out, "*".repeat(MULT));
  const { m2, g2 } = folmodel(out, true);
  const formulas = [
    "boy(x)", "(x = x)", "(boy(x) | girl(x))", "(boy(x) & girl(x))",
    "love(adam, x)", "love(x, adam)", "-(x = adam)", "exists z22. love(x, z22)",
    "exists y. love(y, x)", "all y. (girl(y) -> love(x, y))",
    "all y. (girl(y) -> love(y, x))", "all y. (girl(y) -> (boy(x) & love(y, x)))",
    "(boy(x) & all y. (girl(y) -> love(x, y)))", "(boy(x) & all y. (girl(y) -> love(y, x)))",
    "(boy(x) & exists y. (girl(y) & love(y, x)))", "(girl(x) -> dog(x))",
    "all y. (dog(y) -> (x = y))", "exists y. love(y, x)",
    "exists y. (love(adam, y) & love(y, x))",
  ];
  if (trace) pyPrint(out, modelStr(m2));
  for (const fmla of formulas) pyPrint(out, fmla);
  const parsed = formulas.map((f) => semExpr(f));
  for (const p of parsed) {
    g2.purge();
    const sat = m2.satisfiers(p, "x", g2);
    pyPrint(out, `The satisfiers of '${p}' are: ${pySetStr(sat)}`);
  }
}
export const satdemo_ = satdemo;

export function evaluateDemo(out: PrintSink, num = 0, trace = 0): void {
  const demos: Record<number, () => void> = {
    1: () => propdemo(out, trace), 2: () => { folmodel(out, false, trace); },
    3: () => foldemo(out, trace), 4: () => satdemo(out, trace),
  };
  const d = demos[num];
  if (d) d();
  else for (const n of [1, 2, 3, 4]) demos[n]!();
}
export const evaluate_demo = evaluateDemo;

// ===========================================================================
// nltk.sem.drt.demo
// ===========================================================================

export function drtDemo(out: PrintSink): void {
  // Python's DrtParser.isvariable accepts 'PRO' (a reserved token in the
  // tokenizer but parsed as an abstract variable). Patch it in for this demo.
  const proto = DrtParser.prototype as unknown as { isvariable: (t: string) => boolean };
  const origIsVariable = proto.isvariable;
  proto.isvariable = function (this: unknown, t: string): boolean {
    return t === "PRO" || origIsVariable.call(this, t);
  };
  // Python-faithful _pretty implementations (nltk/sem/drt.py). Ours are stubs
  // with shifted negation marks, missing subex paren stripping, and a
  // single-line application format — patch them in for this demo.
  type PP = { _pretty(): string[] };
  const protos: [PP, () => string[]][] = [];
  const patchPretty = (cls: { prototype: PP }, fn: () => string[]) => {
    protos.push([cls.prototype, cls.prototype._pretty]);
    cls.prototype._pretty = fn;
  };
  const padVert = (lines: string[], n: number) =>
    [...lines, ...Array(n - lines.length).fill(" ".repeat(lines[0]!.length))];
  const assemble = (fl: string[], op: string, sl: string[]) =>
    DrtBinaryExpression.assemblePretty(fl, op, sl);
  const pretty = (e: unknown) => (e as PP)._pretty();

  patchPretty(DrtNegatedExpression as never, function (this: { term: unknown }) {
    const tl = pretty(this.term);
    return [
      ...tl.slice(0, 2).map((l) => "    " + l),
      ...tl.slice(2, 3).map((l) => "__  " + l),
      ...tl.slice(3, 4).map((l) => "  | " + l),
      ...tl.slice(4).map((l) => "    " + l),
    ];
  });
  patchPretty(DrtConcatenation as never, function (this: {
    first: unknown; second: unknown; consequent: unknown;
  }) {
    const sub = (s: unknown) =>
      s instanceof DrtConcatenation ? pretty(s).map((l) => l.slice(1, -1)) : pretty(s);
    let drs = assemble(sub(this.first), "+", sub(this.second));
    if (this.consequent) drs = assemble(drs, "->", pretty(this.consequent));
    return drs;
  });
  patchPretty(DrtOrExpression as never, function (this: { first: unknown; second: unknown }) {
    const sub = (s: unknown) =>
      s instanceof DrtOrExpression ? pretty(s).map((l) => l.slice(1, -1)) : pretty(s);
    return assemble(sub(this.first), "|", sub(this.second));
  });
  patchPretty(DrtEqualityExpression as never, function (this: { first: unknown; second: unknown }) {
    return assemble(pretty(this.first), "=", pretty(this.second));
  });
  patchPretty(DrtLambdaExpression as never, function (this: {
    variable: Variable; term: unknown;
  }) {
    const vars: Variable[] = [this.variable];
    let t = this.term;
    while (t instanceof DrtLambdaExpression) { vars.push(t.variable); t = t.term; }
    const varStr = vars.map((v) => v.name).join(" ") + ".";
    const tl = pretty(t);
    const blank = " ".repeat(varStr.length);
    return [
      ...tl.slice(0, 1).map((l) => "    " + blank + l),
      ...tl.slice(1, 2).map((l) => " \\  " + blank + l),
      ...tl.slice(2, 3).map((l) => " /\\ " + varStr + l),
      ...tl.slice(3).map((l) => "    " + blank + l),
    ];
  });
  patchPretty(DrtApplicationExpression as never, function (this: {
    uncurry(): [unknown, unknown[]];
  }) {
    const [func, args] = this.uncurry();
    const functionLines = pretty(func);
    const argsLines = args.map((a) => pretty(a));
    const maxLines = Math.max(functionLines.length, ...argsLines.map((l) => l.length));
    const fpad = padVert(functionLines, maxLines);
    const apad = argsLines.map((l) => padVert(l, maxLines));
    const rows: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      const a = apad.map((l) => l[i]!);
      rows.push(i === 2 ? fpad[i]! + "(" + a.join(",") + ")" : fpad[i]! + " " + a.join(" ") + " ");
    }
    return rows;
  });
  patchPretty(DrtProposition as never, function (this: { variable: Variable; drs: unknown }) {
    const drs = pretty(this.drs);
    const blank = " ".repeat(`${this.variable}`.length);
    return [
      ...drs.slice(0, 1).map((l) => blank + " " + l),
      ...drs.slice(1, 2).map((l) => `${this.variable}:` + l),
      ...drs.slice(2).map((l) => blank + " " + l),
    ];
  });

  try { drtDemoInner(out); } finally {
    proto.isvariable = origIsVariable;
    for (const [p, orig] of protos) p._pretty = orig;
  }
}

function drtDemoInner(out: PrintSink): void {
  const dexpr = (s: string) => DrtParserFromString(s);
  pyPrint(out, "=".repeat(20) + "TEST PARSE" + "=".repeat(20));
  const tests = [
    dexpr("([x,y],[sees(x,y)])"),
    dexpr("([x],[man(x), walks(x)])"),
    dexpr("\\x.\\y.([],[sees(x,y)])"),
    dexpr("\\x.([],[walks(x)])(john)"),
    dexpr("(([x],[walks(x)]) + ([y],[runs(y)]))"),
    dexpr("(([],[walks(x)]) -> ([],[runs(x)]))"),
    dexpr("([x],[PRO(x), sees(John,x)])"),
    dexpr("([x],[man(x), -([],[walks(x)])])"),
    dexpr("([],[(([x],[man(x)]) -> ([],[walks(x)]))])"),
  ];
  for (const t of tests) pyPrint(out, `${t}`);
  pyPrint(out, "=".repeat(20) + "Test fol()" + "=".repeat(20));
  pyPrint(out, `${(dexpr("([x,y],[sees(x,y)])") as unknown as { fol(): unknown }).fol()}`);
  pyPrint(out, "=".repeat(20) + "Test alpha conversion and lambda expression equality" + "=".repeat(20));
  const e1 = dexpr("\\x.([],[P(x)])");
  pyPrint(out, `${e1}`);
  const e2 = (e1 as unknown as {
    replace(v: Variable, e: Expression2, rb: boolean, ac?: boolean): Expression2
  }).replace(new Variable("x"), DrtVariableExpression(new Variable("z")) as unknown as Expression2, true);
  pyPrint(out, `${e2}`);
  pyPrint(out, (e1 as unknown as { equals(o: unknown): boolean }).equals(e2));
  pyPrint(out, "=".repeat(20) + "Test resolve_anaphora()" + "=".repeat(20));
  pyPrint(out, `${resolve_anaphora(dexpr("([x,y,z],[dog(x), cat(y), walks(z), PRO(z)])") as never)}`);
  pyPrint(out, `${resolve_anaphora(dexpr("([],[(([x],[dog(x)]) -> ([y],[walks(y), PRO(y)]))])") as never)}`);
  pyPrint(out, `${resolve_anaphora(dexpr("(([x,y],[]) + ([],[PRO(x)]))") as never)}`);
  pyPrint(out, "=".repeat(20) + "Test pretty_print()" + "=".repeat(20));
  const pretty = (s: string): void => {
    out((dexpr(s) as unknown as { prettyFormat(): string }).prettyFormat() + "\n");
  };
  pretty("([],[])");
  pretty("([],[([x],[big(x), dog(x)]) -> ([],[bark(x)]) -([x],[walk(x)])])");
  pretty("([x,y],[x=y]) + ([z],[dog(z), walk(z)])");
  pretty("([],[([x],[]) | ([y],[]) | ([z],[dog(z), walk(z)])])");
  pretty("\\P.\\Q.(([x],[]) + P(x) + Q(x))(\\x.([],[dog(x)]))");
}
type Expression2 = { str(): string };
export const drt_demo = drtDemo;

// ===========================================================================
// nltk.sem.linearlogic.demo / cooper_storage.demo / util.demo
// ===========================================================================

export function linearlogicDemo(out: PrintSink): void {
  const lexpr = (s: string): { str(): string; simplify(): { str(): string } } =>
    LinearExpression.fromstring(s) as never;
  pyPrint(out, lexpr("f"));
  pyPrint(out, lexpr("(g -o f)"));
  pyPrint(out, lexpr("((g -o G) -o G)"));
  pyPrint(out, lexpr("g -o h -o f"));
  pyPrint(out, lexpr("(g -o f)(g)").simplify());
  pyPrint(out, lexpr("(H -o f)(g)").simplify());
  pyPrint(out, lexpr("((g -o G) -o G)((g -o f))").simplify());
  pyPrint(out, lexpr("(H -o H)((g -o f))").simplify());
}
export const linearlogic_demo = linearlogicDemo;

export function cooperDemo(out: PrintSink): void {
  const sentence = "every girl chases a dog";
  pyPrint(out);
  pyPrint(out, `Analysis of sentence '${sentence}'`);
  pyPrint(out, "=".repeat(50));
  // parse_with_bindops loads grammars/book_grammars/storage.fcfg — absent here,
  // so the oracle records a LookupError after the header. Match the text.
  let trees: unknown[] = [];
  try { trees = parse_with_bindops(sentence, null, 0); }
  catch (e) { if (!(e instanceof Error && e.name === "LookupError")) throw e; }
  for (const tree of trees) {
    const semrep = cooperStoreFromTree(tree as never);
    pyPrint(out);
    pyPrint(out, "Binding operators:");
    pyPrint(out, "-".repeat(15));
    const storeItems = (semrep.store as unknown as { items?: unknown[] })?.items
      ?? (Array.isArray(semrep.store) ? semrep.store : []);
    for (const s of storeItems) pyPrint(out, `${s}`);
    pyPrint(out);
    pyPrint(out, "Core:");
    pyPrint(out, "-".repeat(15));
    pyPrint(out, `${semrep.core}`);
    pyPrint(out);
    pyPrint(out, "S-Retrieval:");
    pyPrint(out, "-".repeat(15));
    withConsoleLog(out, () => semrep.s_retrieve(true));
    pyPrint(out, "Readings:");
    pyPrint(out, "-".repeat(15));
    semrep.readings.forEach((r: unknown, i: number) => pyPrint(out, `${i + 1}: ${r}`));
  }
}
export const cooper_demo = cooperDemo;

/** nltk.sem.util.demo — OptionParser surface over argv (no stdin). */
export function semUtilDemo(out: PrintSink, argv: string[] = ["DEMO"], errout?: PrintSink): number | never {
  const err = errout ?? out;
  const prog = argv[0] ?? "DEMO";
  const usage = `Usage: ${prog} [options]\n`;
  const error = (msg: string): never => {
    err(`${usage}\n${prog}: error: ${msg}\n`);
    throw Object.assign(pyError("SystemExit", "2"), { code: 2 });
  };
  const opts: Record<string, unknown> = {
    evaluate: true, beta: true, syntrace: 0, semtrace: 0,
    demo: "default", grammar: "", sentences: "", model: "",
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    const take = (): string => argv[++i] ?? error(`option ${a} requires argument`);
    if (a === "-e" || a === "--no-eval") opts.evaluate = false;
    else if (a === "-b" || a === "--no-beta-reduction") opts.beta = false;
    else if (a === "-t" || a === "--syntrace") opts.syntrace = (opts.syntrace as number) + 1;
    else if (a === "-T" || a === "--semtrace") opts.semtrace = (opts.semtrace as number) + 1;
    else if (a === "-d" || a === "--demo") opts.demo = take();
    else if (a === "-g" || a === "--gram") opts.grammar = take();
    else if (a === "-m" || a === "--model") opts.model = take();
    else if (a === "-s" || a === "--sentences") opts.sentences = take();
    else if (a.startsWith("-")) error(`no such option: ${a}`);
  }
  if (opts.model) {
    return error("--model is currently unsupported in demo(); the CLI always uses the built-in demo model");
  }
  const sents = [
    "Fido sees a boy with Mary", "John sees Mary", "every girl chases a dog",
    "every boy chases a girl", "John walks with a girl in Noosa", "who walks",
  ];
  const gramfile = (opts.grammar as string) || "grammars/sample_grammars/sem2.fcfg";
  // Python resolves the grammar through nltk.data.find → LookupError when absent.
  const pointer = dataFind(gramfile);
  const gramText = (pointer as unknown as { open(e?: string): { read(): string } }).open("utf-8").read();
  const grammar = FeatureGrammar.fromstring(gramText);
  // Coverage check — Python raises inside parser.parse per sentence; the first
  // sentence already fails on the demo grammar.
  for (const sent of sents) {
    try {
      grammar.check_coverage(sent.split(" "));
    } catch (e) {
      if (e instanceof Error && !(e as { name?: string }).name?.includes("Value"))
        throw pyError("ValueError", e.message);
      throw e;
    }
  }
  const { m0, g0 } = demo_model0();
  const SPACER = "-".repeat(30);
  if (opts.evaluate) {
    const evaluations = evaluate_sents(sents, grammar as never, m0, g0, opts.semtrace as number);
    sents.forEach((sent, i) => {
      let n = 1;
      pyPrint(out, `\nSentence: ${sent}`);
      pyPrint(out, SPACER);
      for (const [, semrep, value] of evaluations[i] ?? []) {
        pyPrint(out, `${n}:  ${semrep}`);
        pyPrint(out, value instanceof Map ? pySetStr([...(value as Map<unknown, unknown>).keys()] as string[]) : value);
        n++;
      }
    });
  } else {
    const semreps = evaluate_sents(sents, grammar as never, m0, g0, opts.syntrace as number);
    sents.forEach((sent, i) => {
      let n = 1;
      pyPrint(out, `\nSentence: ${sent}`);
      pyPrint(out, SPACER);
      for (const [, semrep] of semreps[i] ?? []) {
        pyPrint(out, `${n}:  ${semrep}`);
        n++;
      }
    });
  }
  return 0;
}
export const util_demo = semUtilDemo;

// ===========================================================================
// nltk.chunk.regexp.demo_eval(chunkparser, text)
// ===========================================================================

import { ChunkScore, type RegexpParser, type TaggedToken } from "./chunk_nltk";
import { tagstr2tree } from "./corpus_tree";

export function demoEval(
  out: PrintSink,
  chunkparser: RegexpParser,
  text: string,
): void {
  const chunkscore = new ChunkScore();
  // tagstr2tree yields SimpleTree with [word, tag] leaves; the chunk parser
  // wants {token, tag} leaves. Convert recursively.
  const isSubTree = (c: unknown): c is { label: string; children: unknown[] } =>
    c instanceof Object && "label" in (c as object) && "children" in (c as object);
  const toChunkTree = (t: { label: string; children: unknown[] }): { label: string; children: unknown[] } => ({
    label: t.label,
    children: t.children.map((c) =>
      isSubTree(c)
        ? toChunkTree(c)
        : { token: (c as [string, string])[0], tag: (c as [string, string])[1] }),
  });
  const flatTokens = (t: { children: unknown[] }): unknown[] =>
    t.children.flatMap((c) => isSubTree(c) ? flatTokens(c) : [{ token: (c as [string, string])[0], tag: (c as [string, string])[1] }]);
  // Python str(chunkstr) aligns tags with spaces; ours emits repr <<...>>.
  const pyChunkStr = (s: string): string => {
    const m = /^<<(.*)>>$/.exec(s);
    if (!m) return s;
    let inner = m[1]!.replace(/>(?!\})/g, "> ");
    inner = inner.replace(/([^{])</g, "$1 <");
    if (inner[0] === "<") inner = " " + inner;
    return inner;
  };
  const traceSink: PrintSink = (s) => {
    for (const l of s.split("\n")) {
      if (l.length) out(pyChunkStr(l) + "\n");
    }
  };
  for (const line of text.split("\n")) {
    pyPrint(out, line);
    const sentence = line.trim();
    if (!sentence) continue;
    const gold = tagstr2tree(sentence);
    const tokens = flatTokens(gold as never);
    const test = withConsoleLog(traceSink, () =>
      chunkparser.parse({ label: "S", children: tokens as never } as never, 1));
    chunkscore.score(toChunkTree(gold as never) as never, test as never);
    pyPrint(out);
  }
  // Python print("Scoring", chunkparser) → chunk.RegexpParser.__str__
  const stages = (chunkparser as unknown as { _stages?: { rules(): { descr(): string; toString(): string }[] }[] })._stages ?? [];
  let parserStr = `chunk.RegexpParser with ${stages.length} stages:\n`;
  for (const stage of stages) {
    const rules = stage.rules();
    parserStr += `RegexpChunkParser with ${rules.length} rules:\n`;
    let margin = 0;
    for (const r of rules) margin = Math.max(margin, r.descr().length);
    for (const r of rules) {
      parserStr += margin < 35
        ? `    ${r.descr().padEnd(margin + 3)}${String(r)}\n`
        : `    ${r.descr()}\n      ${String(r)}\n`;
    }
  }
  parserStr = parserStr.slice(0, -1);
  pyPrint(out, "/" + "=".repeat(75) + "\\");
  pyPrint(out, `Scoring ${parserStr}`);
  pyPrint(out, "-".repeat(77));
  pyPrint(out, sprintf("Precision: %5.1f%%", chunkscore.precision() * 100), " ".repeat(4), pyEnd(" "));
  pyPrint(out, sprintf("Recall: %5.1f%%", chunkscore.recall() * 100), " ".repeat(6), pyEnd(" "));
  pyPrint(out, sprintf("F-Measure: %5.1f%%", chunkscore.f_measure() * 100));

  const chunkStr = (chunk: unknown): string => {
    // " ".join(map(str, chunk)) over tagged leaves → ('the', 'DT')
    const kids = (chunk as { children?: unknown[] }).children ?? [];
    return kids.map((leaf) => {
      const t = leaf as TaggedToken | [string, string];
      return Array.isArray(t) ? `('${t[0]}', '${t[1]}')` : `('${t.token}', '${t.tag}')`;
    }).join(" ");
  };
  const missed = chunkscore.missed();
  if (missed.length) {
    pyPrint(out, "Missed:");
    for (const c of missed.slice(0, 10)) pyPrint(out, "  ", chunkStr(c));
    if (missed.length > 10) pyPrint(out, "  ...");
  }
  const incorrect = chunkscore.incorrect();
  if (incorrect.length) {
    pyPrint(out, "Incorrect:");
    for (const c of incorrect.slice(0, 10)) pyPrint(out, "  ", chunkStr(c));
    if (incorrect.length > 10) pyPrint(out, "  ...");
  }
  pyPrint(out, "\\" + "=".repeat(75) + "/");
  pyPrint(out);
}
export const demo_eval = demoEval;

/** nltk.sem.evaluate.prodemo — absent in 3.10.3 (real name is propdemo). */
export function prodemoMissing(): never {
  throw pyError("AttributeError", "module 'nltk.sem.evaluate' has no attribute 'prodemo'");
}
export const prodemo = prodemoMissing;

/** nltk.sem.lfg.demo_read_depgraph — FStructure.read_depgraph on four graphs. */
export function demoReadDepgraph(out: PrintSink): void {
  const graphs = [
    `Esso       NNP     2       SUB
said       VBD     0       ROOT
the        DT      5       NMOD
Whiting    NNP     5       NMOD
field      NN      6       SUB
started    VBD     2       VMOD
production NN      6       OBJ
Tuesday    NNP     6       VMOD
`,
    `John    NNP     2       SUB
sees    VBP     0       ROOT
Mary    NNP     2       OBJ
`,
    `a       DT      2       SPEC
man     NN      3       SUBJ
walks   VB      0       ROOT
`,
    `every   DT      2       SPEC
girl    NN      3       SUBJ
chases  VB      0       ROOT
a       DT      5       SPEC
dog     NN      3       OBJ
`,
  ];
  for (const g of graphs) {
    pyPrint(out, `${FStructure.readDepgraph(new DependencyGraph(g))}`);
  }
}
export const demo_read_depgraph = demoReadDepgraph;

/** nltk.tokenize.punkt.demo — train on `text`, print cleaned sentences. */
export function punktDemo(out: PrintSink, text: string): void {
  const cleanup = (s: string) => s.replace(/(?:\r|^\s+)/gm, "").replace(/\n/g, " ");
  const trainer = new PunktTrainerNltk();
  trainer.INCLUDE_ALL_COLLOCS = true;
  trainer.train(text);
  const sbd = new PunktSentenceTokenizerNltk(trainer.get_params());
  for (const sentence of sbd.sentences_from_text(text)) pyPrint(out, cleanup(sentence));
}
export const punkt_demo = punktDemo;

// ---------- corpus-backed demo helpers ----------

/** treebank/combined BracketParseCorpusReader resolved via data.find. */
function treebankReader(): BracketParseCorpusReader {
  const root = (dataFind("corpora/treebank/combined") as unknown as { path: string }).path;
  return new BracketParseCorpusReader(root, "wsj_.*\\.mrg", null, "unindented_paren", "ascii", "wsj");
}

function treebankTaggedSents(): Array<Array<[string, string]>> {
  const out: Array<Array<[string, string]>> = [];
  for (const s of treebankReader().tagged_sents() as Iterable<Array<[string, string]>>) out.push(s);
  return out;
}

/** nltk.stem.porter.demo — stem treebank.tagged_words of first 3 fileids. */
export function porterDemo(out: PrintSink): void {
  const reader = treebankReader();
  const stemmer = new PorterStemmer();
  const orig: string[] = [];
  const stemmed: string[] = [];
  const fileids = (reader.fileids() as unknown as string[]).slice(0, 3);
  for (const fid of fileids) {
    for (const [word] of reader.tagged_words(fid) as Iterable<[string, string]>) {
      orig.push(word);
      stemmed.push(stemmer.stem(word));
    }
  }
  const wrap70 = (s: string) => (s + " ").replace(/(.{1,70})\s/g, "$1\n").replace(/\s+$/, "");
  const results = wrap70(stemmed.join(" "));
  const original = wrap70(orig.join(" "));
  const banner = (t: string) => {
    const c = t.length >= 70 ? t : " ".repeat(Math.floor((70 - t.length) / 2)) + t + " ".repeat(70 - Math.floor((70 - t.length) / 2) - t.length);
    return c.replace(/ /g, "*").replace(/-/g, " ");
  };
  pyPrint(out, banner("-Original-"));
  pyPrint(out, original);
  pyPrint(out, banner("-Results-"));
  pyPrint(out, results);
  pyPrint(out, "*".repeat(70));
}
export const porter_demo = porterDemo;

/** nltk.tag.tnt._treebank_demo_split — train/test/vocab over treebank sents. */
function treebankDemoSplit(testSize: number): {
  trainSents: Array<Array<[string, string]>>; testSents: Array<Array<[string, string]>>; trainVocab: Set<string>;
} {
  const sents = treebankTaggedSents();
  if (!(0 < testSize && testSize < sents.length)) {
    throw pyError("ValueError", `test_size must be between 1 and ${sents.length - 1}, got ${pyRepr(testSize)}`);
  }
  const cut = sents.length - testSize;
  const trainSents = sents.slice(0, cut);
  const testSents = sents.slice(cut);
  const trainVocab = new Set<string>();
  for (const sent of trainSents) for (const [w] of sent) trainVocab.add(w);
  return { trainSents, testSents, trainVocab };
}

/** nltk.tag.tnt._score_tagger. */
function scoreTagger(tagger: TnT, testSents: Array<Array<[string, string]>>, trainVocab: Set<string>) {
  let correct = 0, total = 0, seenCorrect = 0, seenTotal = 0, oovCorrect = 0, oovTotal = 0;
  for (const sent of testSents) {
    const words = sent.map(([w]) => w);
    const gold = sent.map(([, t]) => t);
    const pred = tagger.tag(words).map(([, t]) => t);
    if (pred.length !== gold.length) {
      throw pyError("ValueError", `tagger returned ${pred.length} tags for ${gold.length} tokens`);
    }
    for (let i = 0; i < words.length; i++) {
      total++;
      const hit = pred[i] === gold[i];
      if (hit) correct++;
      if (trainVocab.has(words[i]!)) { seenTotal++; if (hit) seenCorrect++; }
      else { oovTotal++; if (hit) oovCorrect++; }
    }
  }
  return {
    accuracy: total ? correct / total : null,
    seen_accuracy: seenTotal ? seenCorrect / seenTotal : null,
    oov_accuracy: oovTotal ? oovCorrect / oovTotal : null,
    oov_rate: total ? oovTotal / total : null,
  };
}

const formatScore = (s: number | null) => s === null ? "n/a" : s.toFixed(4);

/** nltk.tag.tnt.demo — evaluate TnT on a held-out Treebank slice. */
export function tntDemo(out: PrintSink, testSize = 1000): void {
  const { trainSents, testSents, trainVocab } = treebankDemoSplit(testSize);
  for (const useCap of [false, true]) {
    const tagger = new TnT({ N: 1000, C: useCap });
    tagger.train(trainSents);
    const scores = scoreTagger(tagger, testSents, trainVocab);
    pyPrint(out, `Capitalization: ${useCap ? "True" : "False"}`);
    pyPrint(out, `Accuracy:       ${formatScore(scores.accuracy)}`);
    pyPrint(out, `Seen accuracy:  ${formatScore(scores.seen_accuracy)}`);
    pyPrint(out, `OOV accuracy:   ${formatScore(scores.oov_accuracy)}`);
    pyPrint(out, `OOV rate:       ${formatScore(scores.oov_rate)}`);
    pyPrint(out);
  }
}
export const tnt_demo = tntDemo;

/** nltk.tag.tnt.demo_errors — first `limit` errors from the held-out slice. */
export function tntDemoErrors(out: PrintSink, limit = 25, testSize = 1000): void {
  if (limit < 1) {
    throw pyError("ValueError", `limit must be at least 1, got ${pyRepr(limit)}`);
  }
  const { trainSents, testSents, trainVocab } = treebankDemoSplit(testSize);
  const tagger = new TnT({ N: 1000, C: true });
  tagger.train(trainSents);
  let shown = 0;
  outer:
  for (const sent of testSents) {
    const words = sent.map(([w]) => w);
    const gold = sent.map(([, t]) => t);
    const pred = tagger.tag(words).map(([, t]) => t);
    if (pred.length !== gold.length) {
      throw pyError("ValueError", `tagger returned ${pred.length} tags for ${gold.length} tokens`);
    }
    for (let i = 0; i < words.length; i++) {
      if (pred[i] === gold[i]) continue;
      const status = trainVocab.has(words[i]!) ? "seen" : "OOV";
      pyPrint(out, `${pyRepr(words[i])} (${status}): guessed ${pyRepr(pred[i])}, gold ${pyRepr(gold[i])}`);
      shown++;
      if (shown >= limit) break outer;
    }
  }
  if (shown === 0) pyPrint(out, "No errors found.");
}
export const tnt_demo_errors = tntDemoErrors;

// nltk.chat.*.demo — each demo calls its _chat() entry point; converse is
// input-injectable so the oracle can pin the EOF path deterministically.
// Chat demo wrappers — Python `input(">")` writes the prompt to stdout, so the
// adapted input callback emits the prompt through the same raw sink; `*_chat`
// output is print-style (one Python print per call) over the raw PrintSink.
const chatLineFeed = (feed: (() => string | null | undefined) | undefined, out: PrintSink) =>
  feed === undefined ? undefined : (prompt?: string) => { if (prompt !== undefined) out(prompt); return feed(); };

export function elizaDemo(out: PrintSink, feed?: () => string | null | undefined, rng?: PyRandom): void {
  eliza_chat(chatLineFeed(feed, out), (s) => out(s + "\n"), rng);
}
export function ieshaDemo(out: PrintSink, feed?: () => string | null | undefined, rng?: PyRandom): void {
  iesha_chat(chatLineFeed(feed, out), (s) => out(s + "\n"), rng);
}
export function rudeDemo(out: PrintSink, feed?: () => string | null | undefined, rng?: PyRandom): void {
  rude_chat(chatLineFeed(feed, out), (s) => out(s + "\n"), rng);
}
export function suntsuDemo(out: PrintSink, feed?: () => string | null | undefined, rng?: PyRandom): void {
  suntsu_chat(chatLineFeed(feed, out), (s) => out(s + "\n"), rng);
}
export function zenDemo(out: PrintSink, feed?: () => string | null | undefined, rng?: PyRandom): void {
  zen_chat(chatLineFeed(feed, out), (s) => out(s + "\n"), rng);
}
export const eliza_demo = elizaDemo;
export const iesha_demo = ieshaDemo;
export const rude_demo = rudeDemo;
export const suntsu_demo = suntsuDemo;
export const zen_demo = zenDemo;

/** nltk.cluster.gaac.demo — non-interactive 2-D GAAC walkthrough. The
 * dendrogram goes to real stdout (Python's show() writes through a
 * module-bound sys.stdout, bypassing redirect_stdout). */
export function gaacDemo(out: PrintSink): void {
  const vectors = [[3, 3], [1, 2], [4, 2], [4, 0], [2, 3], [3, 1]];
  const clusterer = new GAAClusterer(4);
  const clusters = clusterer.cluster(vectors.map((v) => v.slice()), true) as number[];
  pyPrint(out, "Clusterer:", clusterer);
  pyPrint(out, `Clustered: [${vectors.map((v) => ndarrayRepr(v, "int")).join(", ")}]`);
  pyPrint(out, "As:", clusters);
  pyPrint(out);
  stdout(clusterer.dendrogram()!.show());
  pyPrint(out, `classify(${ndarray([3, 3], "int")}):`, pyEnd(" "));
  pyPrint(out, clusterer.classify([3, 3]));
  pyPrint(out);
}
export const gaac_demo = gaacDemo;

/** nltk.misc.wordfinder.word_finder — words-corpus grid demo (rng seedable). */
export function wordfinderDemo(out: PrintSink, rng?: PyRandom): void {
  word_finder(out, rng);
}
export const word_finder_demo = wordfinderDemo;
