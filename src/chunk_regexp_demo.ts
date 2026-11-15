import type { ChunkTree, IobRow, TaggedToken } from "./chunk_nltk";
import { ChunkScore, RegexpParser, tree2conlltags } from "./chunk_nltk";
import { SimpleTree, tagstr2tree } from "./corpus_tree";
import { ConllChunkCorpusReader } from "./corpus_readers2";
import { find } from "./data";
import { withConsoleLog } from "./demos";
import { pyEnd, pyFloatRepr, pyPrint, pyRepr, type PrintSink } from "./ext_pure";

function isTree(node: ChunkTree | TaggedToken): node is ChunkTree {
  return typeof (node as ChunkTree).label === "string" && Array.isArray((node as ChunkTree).children);
}

/** Python str() of a chunk tree/leaf: `(NP the/DT little/JJ cat/NN)` / `w/t`. */
export function chunkTreeStr(node: ChunkTree | TaggedToken): string {
  if (!isTree(node)) return `${node.token}/${node.tag}`;
  return `(${node.label} ${node.children.map(chunkTreeStr).join(" ")})`;
}

/** SimpleTree ([w,t] leaves) -> ChunkTree ({token,tag} leaves). */
function toChunkTree(tree: SimpleTree): ChunkTree {
  return {
    label: tree.label,
    children: tree.children.map((c) =>
      c instanceof SimpleTree ? toChunkTree(c) : { token: c[0], tag: c[1] ?? "" } as TaggedToken),
  };
}

/** ChunkTree -> SimpleTree (for python Tree.pformat printing). */
function toSimpleTree(tree: ChunkTree | TaggedToken): SimpleTree | [string, string] {
  if (!isTree(tree)) return [tree.token, tree.tag];
  return new SimpleTree(tree.label, tree.children.map(toSimpleTree));
}

/** Python str(RegexpParser): `chunk.RegexpParser with N stages:\n...`. */
function parserStr(cp: RegexpParser): string {
  const stages = (cp as unknown as { _stages: Array<{ _rules: Array<{ descr(): string; toString(): string }> }> })._stages;
  return "chunk.RegexpParser with " + stages.length + " stages:\n" +
    stages.map((s) => {
      let margin = 0;
      for (const rule of s._rules) margin = Math.max(margin, rule.descr().length);
      const lines = s._rules.map((rule) =>
        margin < 35
          ? `    ${rule.descr().padEnd(margin + 3)}${String(rule)}`
          : `    ${rule.descr()}\n      ${String(rule)}`);
      return `RegexpChunkParser with ${s._rules.length} rules:\n` + lines.join("\n");
    }).join("\n");
}

/** str() of a piece child: `('the', 'DT')` tuple repr, or subtree pformat. */
function pieceChildStr(node: ChunkTree | TaggedToken): string {
  return isTree(node) ? chunkTreeStr(node) : `(${pyRepr(node.token)}, ${pyRepr(node.tag)})`;
}

/** nltk.chunk.accuracy — IOB tag accuracy of `chunker` against `gold` trees. */
export function accuracy(chunker: { parse(t: TaggedToken[] | ChunkTree): ChunkTree }, gold: ChunkTree[]): number {
  const goldTags: IobRow[] = [];
  const testTags: IobRow[] = [];
  for (const goldTree of gold) {
    const flat: TaggedToken[] = [];
    const walk = (n: ChunkTree | TaggedToken): void => {
      if (isTree(n)) n.children.forEach(walk);
      else flat.push(n);
    };
    goldTree.children.forEach(walk);
    const testTree = chunker.parse({ label: goldTree.label, children: flat });
    goldTags.push(...tree2conlltags(goldTree));
    testTags.push(...tree2conlltags(testTree));
  }
  let correct = 0;
  for (let i = 0; i < goldTags.length; i++) {
    const g = goldTags[i]!, t = testTags[i]!;
    if (g.token === t.token && g.tag === t.tag && g.iob === t.iob) correct++;
  }
  return correct / goldTags.length;
}

/**
 * nltk.chunk.regexp.demo_eval — run `chunkparser` on each line of `text`
 * (bracketed tagged sentences) with trace=1 and print a ChunkScore.
 */
export function demo_eval(chunkparser: RegexpParser, text: string, out: PrintSink = (s) => process.stdout.write(s)): void {
  const chunkscore = new ChunkScore();

  for (const rawLine of text.split("\n")) {
    pyPrint(out, rawLine);
    const sentence = rawLine.trim();
    if (!sentence) continue;
    const gold = toChunkTree(tagstr2tree(sentence));
    const tokens: TaggedToken[] = [];
    const collectLeaves = (n: ChunkTree | TaggedToken): void => {
      if (isTree(n)) n.children.forEach(collectLeaves);
      else tokens.push(n);
    };
    gold.children.forEach(collectLeaves);
    const test = withConsoleLog(out, () => chunkparser.parse({ label: "S", children: tokens }, 1));
    chunkscore.score(gold, test);
    pyPrint(out, "");
  }

  pyPrint(out, "/" + "=".repeat(75) + "\\");
  pyPrint(out, "Scoring", parserStr(chunkparser));
  pyPrint(out, "-".repeat(77));
  pyPrint(out, `Precision: ${(chunkscore.precision() * 100).toFixed(1).padStart(5)}%`, "    ", pyEnd(" "));
  pyPrint(out, `Recall: ${(chunkscore.recall() * 100).toFixed(1).padStart(5)}%`, "      ", pyEnd(" "));
  pyPrint(out, `F-Measure: ${(chunkscore.f_measure() * 100).toFixed(1).padStart(5)}%`);

  if (chunkscore.missed().length) {
    pyPrint(out, "Missed:");
    const missed = chunkscore.missed();
    for (const piece of missed.slice(0, 10)) {
      const t = piece as ChunkTree;
      pyPrint(out, "  ", t.children.map(pieceChildStr).join(" "));
    }
    if (missed.length > 10) pyPrint(out, "  ...");
  }
  if (chunkscore.incorrect().length) {
    pyPrint(out, "Incorrect:");
    const incorrect = chunkscore.incorrect();
    for (const piece of incorrect.slice(0, 10)) {
      const t = piece as ChunkTree;
      pyPrint(out, "  ", t.children.map(pieceChildStr).join(" "));
    }
    if (incorrect.length > 10) pyPrint(out, "  ...");
  }

  pyPrint(out, "\\" + "=".repeat(75) + "/");
  pyPrint(out, "");
}
export const demoEval = demo_eval;

/** nltk.chunk.regexp.demo — four RegexpParser grammars + CoNLL-2000 evals. */
export function demo(out: PrintSink = (s) => process.stdout.write(s)): void {
  const text = `\
    [ the/DT little/JJ cat/NN ] sat/VBD on/IN [ the/DT mat/NN ] ./.
    [ John/NNP ] saw/VBD [the/DT cats/NNS] [the/DT dog/NN] chased/VBD ./.
    [ John/NNP ] thinks/VBZ [ Mary/NN ] saw/VBD [ the/DT cat/NN ] sit/VB on/IN [ the/DT mat/NN ]./.
    `;

  pyPrint(out, "*".repeat(75));
  pyPrint(out, "Evaluation text:");
  pyPrint(out, text);
  pyPrint(out, "*".repeat(75));
  pyPrint(out, "");

  let grammar = `
    NP:                   # NP stage
      {<DT>?<JJ>*<NN>}    # chunk determiners, adjectives and nouns
      {<NNP>+}            # chunk proper nouns
    `;
  let cp = new RegexpParser(grammar);
  demo_eval(cp, text, out);

  grammar = `
    NP:
      {<.*>}              # start by chunking each tag
      }<[\\.VI].*>+{       # unchunk any verbs, prepositions or periods
      <DT|JJ>{}<NN.*>     # merge det/adj with nouns
    `;
  cp = new RegexpParser(grammar);
  demo_eval(cp, text, out);

  grammar = `
    NP: {<DT>?<JJ>*<NN>}    # chunk determiners, adjectives and nouns
    VP: {<TO>?<VB.*>}       # VP = verb words
    `;
  cp = new RegexpParser(grammar);
  demo_eval(cp, text, out);

  grammar = `
    NP: {<.*>*}             # start by chunking everything
        }<[\\.VI].*>+{       # strip any verbs, prepositions or periods
        <.*>}{<DT>          # separate on determiners
    PP: {<IN><NP>}          # PP = preposition + noun phrase
    VP: {<VB.*><NP|PP>*}    # VP = verb words + NPs and PPs
    `;
  cp = new RegexpParser(grammar);
  demo_eval(cp, text, out);

  // Evaluation
  const conll2000 = new ConllChunkCorpusReader(find("corpora/conll2000"), "test.txt");

  pyPrint(out, "");
  pyPrint(out, "Demonstration of empty grammar:");

  cp = new RegexpParser("");
  const npOnly = toArray(conll2000.chunked_sents("test.txt", ["NP"]) as Iterable<SimpleTree>).map(toChunkTree);
  pyPrint(out, pyFloatRepr(accuracy(cp, npOnly)));

  pyPrint(out, "");
  pyPrint(out, "Demonstration of accuracy evaluation using CoNLL tags:");

  grammar = `
    NP:
      {<.*>}              # start by chunking each tag
      }<[\\.VI].*>+{       # unchunk any verbs, prepositions or periods
      <DT|JJ>{}<NN.*>     # merge det/adj with nouns
    `;
  cp = new RegexpParser(grammar);
  const first5 = toArray(conll2000.chunked_sents("test.txt") as Iterable<SimpleTree>).slice(0, 5).map(toChunkTree);
  pyPrint(out, pyFloatRepr(accuracy(cp, first5)));

  pyPrint(out, "");
  pyPrint(out, "Demonstration of tagged token input");

  grammar = `
    NP: {<.*>*}          
        }<[\\.VI].*>+{     
        <.*>}{<DT>         
    PP: {<IN><NP>}         
    VP: {<VB.*><NP|PP>*}   
    `;
  cp = new RegexpParser(grammar);
  pyPrint(out, (toSimpleTree(cp.parse([
    { token: "the", tag: "DT" },
    { token: "little", tag: "JJ" },
    { token: "cat", tag: "NN" },
    { token: "sat", tag: "VBD" },
    { token: "on", tag: "IN" },
    { token: "the", tag: "DT" },
    { token: "mat", tag: "NN" },
    { token: ".", tag: "." },
  ])) as SimpleTree).pformat());
}

function toArray<T>(view: Iterable<T> | { toArray(): T[] }): T[] {
  if (typeof (view as { toArray?: unknown }).toArray === "function") return (view as { toArray(): T[] }).toArray();
  return [...(view as Iterable<T>)];
}
