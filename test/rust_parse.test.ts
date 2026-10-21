import { expect, test } from "bun:test";
import { ParsingRuntime, Tree, Nonterminal, Production, ProbabilisticProduction, RustCFG, RustPCFG, RustViterbiParser, RustEarleyParser, nonterminals, type TreeFormatOptions, type TreeSlice } from "../src/rust_parse";
import type { ParseTree } from "../src/parse";

function oracle<T>(code: string, input: object): T {
  const python = Bun.spawnSync(["python3", "-c", `import json,sys,nltk\nassert sys.version_info[:3] == (3,14,4), sys.version\nassert nltk.__version__ == '3.10.3', nltk.__version__\n${code}`], {
    stdin: new TextEncoder().encode(JSON.stringify(input)), stdout: "pipe", stderr: "pipe",
  });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  return JSON.parse(new TextDecoder().decode(python.stdout)) as T;
}

type TreeCase = { text: string; brackets?: string; remove_empty_top_bracketing?: boolean };
type TreeSnapshot = { tree: ParseTree | string; formats?: string[]; leaves?: string[]; positions?: number[][][];
  indexed?: Array<ParseTree | string>; height?: number; pos?: Array<[string, string]>; productions?: string[]; leafPositions?: number[][];
  spans?: number[][]; subtrees?: ParseTree[] };
const formats: TreeFormatOptions[] = [{}, { margin: 1 }, { margin: 20, indent: 3, nodesep: ":" },
  { margin: 70, parens: ["[.", " ]"], quotes: ["<", ">"] }, { quotes: true }, { margin: 0 }, { margin: -1 }];

test("Rust Tree fromstring/traversal/format/indexing behavior matches NLTK 3.10.3", async () => {
  const runtime = await ParsingRuntime.load();
  try {
    const cases: TreeCase[] = [
      { text: "(S (NP (D the) (N dog)) (VP (V chased) (NP (D the) (N cat))))" },
      { text: "()" }, { text: "(S)" }, { text: "(S one two (X) (Y three))" },
      { text: "((S café 😀))" }, { text: "((S café 😀))", remove_empty_top_bracketing: true },
      { text: "( leaf)", remove_empty_top_bracketing: true },
      { text: String.raw`(S (P \(x\)) (Q a\)b) c\(d)` },
      { text: "[S [NP café] [VP 😀]]", brackets: "[]" },
      { text: "(S 'quoted' \"double\" slash\\back)" },
      { text: " \n(S\t(A a)\n(B b))\n " },
    ];
    // Deterministic generated shapes exercise root/leaf/empty/multi-line corner cases.
    let seed = 42;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    const generated = (depth: number): string => {
      const count = Math.floor(random() * 4);
      return `(N${depth} ${Array.from({ length: count }, () => depth < 4 && random() < 0.5 ? generated(depth + 1) : ["café", "😀", "a", "x/y"][Math.floor(random() * 4)]!).join(" ")})`;
    };
    for (let i = 0; i < 40; i++) cases.push({ text: generated(0) });
    const expected = oracle<TreeSnapshot[]>(`
def plain(t):
 return {'label':t.label(),'children':[plain(c) if isinstance(c,nltk.Tree) else c for c in t]} if isinstance(t,nltk.Tree) else t
out=[]
for c in json.load(sys.stdin)['cases']:
 t=nltk.Tree.fromstring(c['text'],brackets=c.get('brackets','()'),remove_empty_top_bracketing=c.get('remove_empty_top_bracketing',False))
 if not isinstance(t,nltk.Tree): out.append({'tree':t}); continue
 leaves=t.leaves()
 positions=[t.treepositions(o) for o in ['preorder','postorder','bothorder','leaves']]
 out.append({'tree':plain(t),'formats':[t.pformat(**o) for o in ${JSON.stringify(formats).replace(/true/g, "True")}],
  'leaves':leaves,'positions':positions,'indexed':[plain(t[p]) for p in positions[0]],'height':t.height(),'pos':t.pos(),
  'productions':[str(p) for p in t.productions()],'leafPositions':[t.leaf_treeposition(i) for i in range(len(leaves))],
  'spans':[t.treeposition_spanning_leaves(i,j) for i in range(len(leaves)) for j in range(i+1,len(leaves)+1)],
  'subtrees':[plain(s) for s in t.subtrees()]})
print(json.dumps(out,ensure_ascii=False))`, { cases });
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]!;
      const tree = Tree.fromstring(runtime, c.text, { brackets: c.brackets, remove_empty_top_bracketing: c.remove_empty_top_bracketing ?? false });
      const e = expected[i]!;
      if (typeof tree === "string") { expect<TreeSnapshot>({ tree }).toEqual(e); continue; }
      const leaves = tree.leaves();
      const positions = (["preorder", "postorder", "bothorder", "leaves"] as const).map((o) => tree.treepositions(o));
      const spans: number[][] = [];
      for (let a = 0; a < leaves.length; a++) for (let b = a + 1; b <= leaves.length; b++) spans.push(tree.treeposition_spanning_leaves(a, b));
      const snapshot: TreeSnapshot = { tree: tree.toPlain(), formats: formats.map((o) => tree.pformat(o)), leaves, positions,
        indexed: positions[0]!.map((p) => { const t = tree.get(p); return t instanceof Tree ? t.toPlain() : t; }), height: tree.height(),
        pos: tree.pos(), productions: tree.productions().map(String), leafPositions: leaves.map((_, j) => tree.leaf_treeposition(j)),
        spans, subtrees: [...tree.subtrees()].map((s) => s.toPlain()) };
      expect(snapshot).toEqual(e);
    }
  } finally { runtime.dispose(); }
});

test("Rust Tree Python slices and list edits match NLTK across clipped, reversed and extended slices", async () => {
  const slices: TreeSlice[] = [];
  for (const start of [undefined, -20, -5, -1, 0, 2, 5, 20]) {
    for (const stop of [undefined, -20, -5, -1, 0, 2, 5, 20]) {
      for (const step of [undefined, -3, -1, 1, 2, 4, 0]) slices.push({ start, stop, step });
    }
  }
  const expected = oracle<Array<{ slice?: string[]; assigned?: string[]; deleted?: string[]; error?: boolean }>>(`
out=[]
for o in json.load(sys.stdin)['slices']:
 s=slice(o.get('start'),o.get('stop'),o.get('step'))
 try:
  t=nltk.Tree('S',list('abcde')); selected=t[s]
  replacement=['X','Y'] if s.step in (None,1) else ['X']*len(selected)
  t[s]=replacement
  d=nltk.Tree('S',list('abcde')); del d[s]
  out.append({'slice':selected,'assigned':list(t),'deleted':list(d)})
 except ValueError: out.append({'error':True})
print(json.dumps(out))`, { slices });
  const runtime = await ParsingRuntime.load();
  try {
    for (let i = 0; i < slices.length; i++) {
      const o = slices[i]!;
      const e = expected[i]!;
      const t = new Tree(runtime, "S", [..."abcde"]);
      if (e.error) { expect(() => t.slice(o)).toThrow(); expect(() => t.setSlice(o, [])).toThrow(); expect(() => t.deleteSlice(o)).toThrow(); continue; }
      const selected = t.slice(o);
      expect(selected).toEqual(e.slice!);
      const replacement = o.step === undefined || o.step === 1 ? ["X", "Y"] : Array<string>(selected.length).fill("X");
      t.setSlice(o, replacement); expect([...t]).toEqual(e.assigned!);
      const d = new Tree(runtime, "S", [..."abcde"]); d.delete_slice(o); expect([...d]).toEqual(e.deleted!);
    }
    const indices = [-100, -6, -5, -1, 0, 1, 4, 5, 100];
    const edits = oracle<Array<{ inserted: string[]; popped?: string; remaining?: string[]; error?: boolean }>>(`
out=[]
for i in json.load(sys.stdin)['indices']:
 t=nltk.Tree('S',list('abcde')); t.insert(i,'X')
 row={'inserted':list(t)}
 p=nltk.Tree('S',list('abcde'))
 try: row.update(popped=p.pop(i),remaining=list(p))
 except IndexError: row['error']=True
 out.append(row)
print(json.dumps(out))`, { indices });
    for (let i = 0; i < indices.length; i++) {
      const t = new Tree(runtime, "S", [..."abcde"]); t.insert(indices[i]!, "X"); expect([...t]).toEqual(edits[i]!.inserted);
      const p = new Tree(runtime, "S", [..."abcde"]);
      if (edits[i]!.error) expect(() => p.pop(indices[i]!)).toThrow();
      else { expect(p.pop(indices[i]!)).toBe(edits[i]!.popped!); expect([...p]).toEqual(edits[i]!.remaining!); }
    }
    const t = Tree.fromstring(runtime, "(S (A a) b)");
    t.extend(t); expect(t.length).toBe(4); t.append("c"); t.reverse(); expect(t.leaves()).toEqual(["c", "b", "a", "b", "a"]);
    const before = t.toPlain(); expect(() => t.set_slice({ step: 2 }, ["x"])).toThrow("size mismatch"); expect(t.toPlain()).toEqual(before);
    t.clear(); expect(t.length).toBe(0); expect(() => t.pop()).toThrow();
    for (const index of [0.5, Infinity, NaN]) expect(() => t.insert(index, "x")).toThrow();
    for (const start of [0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) expect(() => t.slice({ start })).toThrow();
  } finally { runtime.dispose(); }
});

test("Rust Tree nonstring leaves retain identity through traversal, slices, mutation and shallow/deep copies", async () => {
  const runtime = await ParsingRuntime.load();
  try {
    const a = { label: "not a subtree", children: ["opaque"] };
    const b = { label: "not a subtree", children: ["opaque"] };
    const tuple = ["tag", 7];
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    const token = Symbol("token");
    const values: unknown[] = [a, b, tuple, cyclic, 7, "7", false, null, undefined, NaN, -0, 123n, token];
    const subtree = new Tree<unknown>(runtime, "A", values);
    const t = new Tree<unknown>(runtime, "S", [subtree, a]);
    const expected = oracle<{ positions: number[][]; height: number; shallowShared: boolean; deepShared: boolean; deepLeafShared: boolean }>(`
a={'label':'not a subtree','children':['opaque']}
values=[a,dict(a),('tag',7),{},7,'7',False,None,None,float('nan'),0,123,object()]
t=nltk.Tree('S',[nltk.Tree('A',values),a])
shallow=t.copy(); deep=t.copy(deep=True)
print(json.dumps({'positions':t.treepositions(),'height':t.height(),'shallowShared':shallow[0] is t[0],
 'deepShared':deep[0] is t[0],'deepLeafShared':deep[0][0] is t[0][0]}))`, {});
    expect(t.treePositions()).toEqual(expected.positions); expect(t.height()).toBe(expected.height);
    const leaves = t.leaves();
    for (let i = 0; i < values.length; i++) { expect(Object.is(leaves[i], values[i])).toBeTrue(); expect(Object.is(t.get([0, i]), values[i])).toBeTrue(); }
    expect(leaves[values.length]).toBe(a);
    expect(t.pos()[0]![0]).toBe(a); expect(t.pos()[0]![1]).toBe("A");
    expect(t.leafTreeposition(2)).toEqual([0, 2]); expect(t.treepositionSpanningLeaves(0, values.length)).toEqual([0]);
    const shallow = t.copy(false); const deep = t.copy(true);
    const shallowChild = shallow.get(0); const deepChild = deep.get(0);
    if (!(shallowChild instanceof Tree) || !(deepChild instanceof Tree)) throw new Error("expected trees");
    shallowChild.setLabel("shared"); expect((t.get(0) as Tree<unknown>).label() === "shared").toBe(expected.shallowShared);
    deepChild.setLabel("deep"); expect((t.get(0) as Tree<unknown>).label() === "deep").toBe(expected.deepShared);
    expect(deepChild.get(0) === a).toBe(expected.deepLeafShared);
    expect(t.copy().get([0, 0])).toBe(a); // existing no-argument deep-copy API retained
    expect(t.toPlain().children[1]).toBe(a); expect(t.flatten().get(0)).toBe(a);
    const selected = subtree.slice({ step: -1 }); expect(selected[0]).toBe(token); expect(selected.at(-1)).toBe(a);
    subtree.setSlice({ start: 0, stop: 2 }, [b, a]); expect(t.get([0, 0])).toBe(b); expect(t.get([0, 1])).toBe(a);
    expect(subtree.pop()).toBe(token); subtree.insert(0, cyclic); expect(t.get([0, 0])).toBe(cyclic);
    expect(() => t.pformat()).toThrow("string leaves"); expect(() => t.productions()).toThrow("string leaves");
    const loop = new Tree<unknown>(runtime, "loop"); loop.append(loop);
    expect(() => loop.leaves()).toThrow("cyclic"); expect(() => loop.toPlain()).toThrow("cyclic"); expect(() => loop.copy()).toThrow("cyclic");
  } finally { runtime.dispose(); }
});

test("Rust PCFG grammar probabilities, typed filters and errors match NLTK 3.10.3", async () => {
  const texts = [
    "S -> A B [.7] | 'S' [.3]\nA -> 'a' [1]\nB -> 'b' [1]",
    "%start ROOT\nROOT -> S [1]\nS -> 'a|[.2]' [.25] | \"a b\" [.75]",
    "S -> [.2] | 'a' [.8]", "S -> 'a' | 'b' [1]", "S -> 'a' [.4] | 'a' [.6]",
    "S -> 'a' [.000001] | 'b' [.999999]", "S -> A [.25] | \\\n 'b' [.75]\nA -> 'a' [1]",
    "S -> [1]", "S -> [.25] | [.75]", "S -> 'a' [1.]", "S -> 'a' [0.9999999]",
  ];
  const expected = oracle<Array<{ start: string; rows: Array<{ text: string; prob: number; logprob: number | null; lexical: boolean }>; rhs: number[]; empty: number[]; lhs: number[] }>>(`
out=[]
for text in json.load(sys.stdin)['texts']:
 g=nltk.PCFG.fromstring(text)
 out.append({'start':g.start().symbol(),'rows':[{'text':str(p),'prob':p.prob(),'logprob':p.logprob() if p.prob() else None,'lexical':p.is_lexical()} for p in g.productions()],
 'rhs':[p.prob() for p in g.productions(rhs='a')],'empty':[p.prob() for p in g.productions(empty=True)],'lhs':[p.prob() for p in g.productions(lhs=g.start())]})
print(json.dumps(out))`, { texts });
  const runtime = await ParsingRuntime.load();
  try {
    for (let i = 0; i < texts.length; i++) {
      const g = RustPCFG.fromString(runtime, texts[i]!); const e = expected[i]!;
      expect(g.start().symbol()).toBe(e.start);
      const rows = g.productions(); expect(rows.length).toBe(e.rows.length);
      for (let j = 0; j < rows.length; j++) {
        expect(String(rows[j]!)).toBe(e.rows[j]!.text); expect(rows[j]!.prob()).toBe(e.rows[j]!.prob);
        if (e.rows[j]!.logprob === null) expect(rows[j]!.logprob()).toBe(-Infinity); else expect(rows[j]!.logprob()).toBeCloseTo(e.rows[j]!.logprob!, 12);
        expect(rows[j]!.is_lexical()).toBe(e.rows[j]!.lexical);
      }
      expect(g.productions({ rhs: "a" }).map((p) => p.prob())).toEqual(e.rhs);
      expect(g.productions({ empty: true }).map((p) => p.prob())).toEqual(e.empty);
      expect(g.productions({ lhs: g.start() }).map((p) => p.prob())).toEqual(e.lhs);
    }
    const invalid = ["", "S -> 'a' [.99]", "S -> 'a' [1.01]", "S -> 'a' [.5]", "S -> 'a' [-1]", "S -> 'a' [nan]", "S -> 'a' [1e0]", "S -> 'a' [..1]", "S -> 'a' [1", "S[1] -> 'a'", "S -> 'a' [1]\nA -> 'b' [.8]", "S -> 'a' [1] # inline"];
    const errors = oracle<boolean[]>(`
out=[]
for text in json.load(sys.stdin)['invalid']:
 try: nltk.PCFG.fromstring(text); out.append(False)
 except ValueError: out.append(True)
print(json.dumps(out))`, { invalid });
    for (let i = 0; i < invalid.length; i++) { expect(errors[i]).toBeTrue(); expect(() => RustPCFG.fromstring(runtime, invalid[i]!)).toThrow(); }
    const s = new Nonterminal("S"); const p = new ProbabilisticProduction(runtime, s, ["a"], 1);
    expect(p.equals(new ProbabilisticProduction(runtime, s, ["a"], 1))).toBeTrue(); expect(p.equals(new Production(runtime, s, ["a"]))).toBeFalse();
    expect(() => new RustPCFG(runtime, s, [new ProbabilisticProduction(runtime, s, ["a"], 0.8)])).toThrow("sum to 1");
    expect(() => new ProbabilisticProduction(runtime, s, ["a"], NaN)).toThrow();
  } finally { runtime.dispose(); }
});

test("Rust Viterbi best original-rule trees and probabilities match NLTK for ambiguity, mixed RHS and unary cycles", async () => {
  const cases = [
    { grammar: "S -> NP VP [1]\nNP -> 'alice' [.6] | 'bob' [.4]\nVP -> 'sees' NP [1]", tokens: ["alice", "sees", "bob"] },
    { grammar: "S -> S S [.4] | 'a' [.6]", tokens: ["a", "a", "a", "a", "a"] },
    { grammar: "S -> A [.5] | B [.5]\nA -> 'a' [1]\nB -> 'a' [1]", tokens: ["a"] },
    { grammar: "S -> A [.2] | B [.8]\nA -> 'a' [1]\nB -> 'a' [1]", tokens: ["a"] },
    { grammar: "S -> 'a' [0] | 'b' [1]", tokens: ["a"] },
    { grammar: "S -> A [.4] | 'a' [.6]\nA -> S [.4] | 'a' [.6]", tokens: ["a"] },
    { grammar: "S -> S [.4] | 'a' [.6]", tokens: ["a"] },
    { grammar: "S -> A [1]\nA -> A [0] | 'a' [1]", tokens: ["a"] },
    { grammar: "S -> A 'x' B C [1]\nA -> 'a' [1]\nB -> 'b' [1]\nC -> 'c' [1]", tokens: ["a", "x", "b", "c"] },
    { grammar: "S -> 'S' S [.4] | 'S' [.6]", tokens: ["S", "S", "S"] },
    { grammar: "S -> 'a' 'b' [1]", tokens: ["b", "a"] },
    { grammar: "S -> A [1]\nA -> B [1]\nB -> [1]", tokens: [] },
    { grammar: "S -> A 'a' [1]\nA -> [1]", tokens: ["a"] },
    { grammar: "%start ROOT\nS -> 'unused' [1]\nROOT -> 'a|b' [.3] | \"a b\" [.7]", tokens: ["a b"] },
    { grammar: "S -> A [.5] | B [.5]\nA -> C [1]\nC -> 'a' [1]\nB -> 'a' [1]", tokens: ["a"] },
    { grammar: "S -> 'a' [.500000000000001] | A [.499999999999999]\nA -> 'a' [1]", tokens: ["a"] },
    { grammar: "%start S\nS -> A B [1]\nA -> 'café' [1]\nB -> '😀' [1]", tokens: ["café", "😀"] },
  ];
  cases.push({ grammar: Array.from({ length: 55 }, (_, i) => `N${i} -> N${i+1} [.000001] | 'b' [.999999]`).join("\n") + "\nN55 -> 'a' [1]", tokens: ["a"] });
  const inputs: string[][] = [[]];
  for (let length = 1; length <= 4; length++) {
    for (let bits = 0; bits < 2 ** length; bits++) inputs.push(Array.from({ length }, (_, i) => bits & (1 << i) ? "b" : "a"));
  }
  for (const grammar of [
    "S -> A B [.6] | B A [.3] | A [.1]\nA -> 'a' [.8] | 'b' [.2]\nB -> 'a' [.3] | 'b' [.7]",
    "S -> S S [.3] | A [.7]\nA -> 'a' [.65] | 'b' [.35]",
    "S -> A A A [.7] | 'a' A [.3]\nA -> 'a' [.4] | 'b' [.6]",
    "S -> A [.3] | B [.7]\nA -> B [.2] | 'a' [.8]\nB -> A [.1] | 'b' [.9]",
  ]) for (const tokens of inputs) cases.push({ grammar, tokens });
  const expected = oracle<Array<{ tree: ParseTree; prob: number } | null>>(`
def plain(t):
 return {'label':t.label(),'children':[plain(c) if isinstance(c,nltk.Tree) else c for c in t]}
out=[]
for c in json.load(sys.stdin)['cases']:
 rows=list(nltk.ViterbiParser(nltk.PCFG.fromstring(c['grammar'])).parse(c['tokens']))
 out.append({'tree':plain(rows[0]),'prob':rows[0].prob()} if rows else None)
print(json.dumps(out))`, { cases });
  const runtime = await ParsingRuntime.load();
  try {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]!; const e = expected[i]!;
      const parser = new RustViterbiParser(RustPCFG.fromstring(runtime, c.grammar));
      const result = parser.parse_result(c.tokens);
      if (e === null) { expect(result).toBeNull(); expect(parser.parse(c.tokens)).toEqual([]); }
      else {
        expect(result).not.toBeNull(); expect(result!.tree.toPlain()).toEqual(e.tree);
        expect(result!.prob).toBe(e.prob);
        if (e.prob === 0) expect(result!.logProb).toBe(-Infinity); else expect(result!.logProb).toBeCloseTo(Math.log(e.prob), 12);
        expect(parser.parse(c.tokens)[0]!.toPlain()).toEqual(e.tree);
      }
    }
    const grammar = RustPCFG.fromstring(runtime, "S -> S S [.4] | 'a' [.6]");
    expect(() => new RustViterbiParser(grammar, { max_work: 2 }).parse(["a"])).toThrow("resource");
    expect(() => new RustViterbiParser(grammar, { maxWork: 2000001 }).parse(["a"])).toThrow("limits");
    expect(() => new RustViterbiParser(grammar).parse(["missing"])).toThrow("cover");
    expect(() => new RustViterbiParser(grammar).parse(Array<string>(513).fill("a"))).toThrow("limits");
    const long = new RustPCFG(runtime, new Nonterminal("S"), [new ProbabilisticProduction(runtime, new Nonterminal("S"), Array<string>(257).fill("a"), 1)]);
    expect(() => new RustViterbiParser(long).parse(["a"])).toThrow("RHS depth");
    expect(new RustEarleyParser(RustCFG.fromString(runtime, "S -> 'a'"), { max_trees: 1, max_states: 100 }).parse_result(["a"]).recognized).toBeTrue();
    expect(grammar.checkCoverage(["a"])).toBeUndefined(); expect(grammar.isNonempty()).toBeTrue();
  } finally { runtime.dispose(); }
});

test("Rust Tree rejects malformed trees and invalid positions; mutation views stay live", async () => {
  const runtime = await ParsingRuntime.load();
  try {
    const invalid = ["", "leaf", "(S", "(S))", ")", "(S) (T)", "(S) leaf", "((S)"];
    const errors = oracle<boolean[]>(`
out=[]
for text in json.load(sys.stdin)['invalid']:
 try: nltk.Tree.fromstring(text); out.append(False)
 except ValueError: out.append(True)
print(json.dumps(out))`, { invalid });
    for (let i = 0; i < invalid.length; i++) { expect(errors[i]).toBeTrue(); expect(() => Tree.fromstring(runtime, invalid[i]!)).toThrow(); }
    const t = Tree.fromstring(runtime, "(S (A one two) (B three))");
    const probes = [-1, -2, [0, -1], [-1, -1], [], 2, -3, [0, 0, 0], [0, 10]];
    const indexing = oracle<Array<{ value: ParseTree | string } | { error: boolean }>>(`
t=nltk.Tree.fromstring('(S (A one two) (B three))')
def plain(t):
 return {'label':t.label(),'children':[plain(c) for c in t]} if isinstance(t,nltk.Tree) else t
out=[]
for p in json.load(sys.stdin)['probes']:
 try: out.append({'value':plain(t[tuple(p) if isinstance(p,list) else p])})
 except (IndexError,TypeError): out.append({'error':True})
print(json.dumps(out))`, { probes });
    for (let i = 0; i < probes.length; i++) {
      const expected = indexing[i]!;
      if ("error" in expected) expect(() => t.get(probes[i]!)).toThrow();
      else {
        const value = t.get(probes[i]!);
        expect<ParseTree | string>(value instanceof Tree ? value.toPlain() : value).toEqual(expected.value);
      }
    }
    const child = t.get(-2);
    expect(child).toBeInstanceOf(Tree);
    if (!(child instanceof Tree)) throw new Error("expected subtree");
    child.set_label("X"); child.set(-1, "TWO");
    expect(t.get([0, -1])).toBe("TWO");
    expect(t.pformat()).toBe("(S (X one TWO) (B three))");
    expect(t.get([])).toBe(t);
    const copy = t.copy(); copy.set([0, 0], "changed"); expect(t.get([0, 0])).toBe("one");
    expect(t.flatten().leaves()).toEqual(["one", "TWO", "three"]);
    t.delete([0, 0]); expect(t.leaves()).toEqual(["TWO", "three"]);
    for (const p of [2, -3, [0, 0, 0], [0, 10], 0.5]) expect(() => t.get(p)).toThrow();
    expect(() => t.leaf_treeposition(-1)).toThrow(); expect(() => t.leaf_treeposition(2)).toThrow();
    expect(() => t.treeposition_spanning_leaves(1, 1)).toThrow(); expect(() => t.set([], "x")).toThrow();
    expect(() => t.delete([])).toThrow();
    expect(() => Tree.fromstring(runtime, "(S)", { brackets: "(" })).toThrow();
  } finally { runtime.dispose(); }
});

test("Rust Tree real Treebank bracket strings match NLTK traversal and pformat", async () => {
  const samples = oracle<Array<{ text: string; leaves: string[]; positions: number[][]; format: string; height: number; productions: string[] }>>(`
from nltk.corpus import treebank
out=[]
for t in list(treebank.parsed_sents())[:40]:
 out.append({'text':t.pformat(margin=1000000),'leaves':t.leaves(),'positions':t.treepositions(),
 'format':t.pformat(),'height':t.height(),'productions':[str(p) for p in t.productions()]})
print(json.dumps(out))`, {});
  const runtime = await ParsingRuntime.load();
  try {
    expect(samples.length).toBe(40);
    for (const sample of samples) {
      const tree = Tree.fromstring(runtime, sample.text);
      expect(tree.leaves()).toEqual(sample.leaves);
      expect(tree.treepositions()).toEqual(sample.positions);
      expect(tree.pformat()).toBe(sample.format);
      expect(tree.height()).toBe(sample.height);
      expect(tree.productions().map(String)).toEqual(sample.productions);
    }
  } finally { runtime.dispose(); }
});

test("Rust typed CFG and Production contracts match NLTK grammar semantics", async () => {
  const runtime = await ParsingRuntime.load();
  try {
    const texts = [
      "S -> NP VP\nNP -> Det N | Name\nVP -> V NP\nDet -> 'the' | 'a'\nN -> 'dog'\nV -> 'sees'\nName -> 'alice'",
      "%start ROOT\nS -> 'a|b' | \"a b\"\nROOT -> S 'S' X\nX -> | 'x'",
      "S -> S S | 'a'", "S -> A\nA -> B\nB -> 'a'", "S -> 'S' | S", "S -> |\nS -> 'a'",
      "S/NP -> NP^X-1 \\\n VP<3>\nNP^X-1 -> '😀'\nVP<3> -> 'café'",
      "S -> UNDEFINED", "S -> 'a' 'b'", "S -> 'a' | A\nA ->", "S -> 'a'\nS ->",
    ];
    type Snapshot = { start: string; productions: string[]; lexical: boolean[]; min: number; max: number; forms: boolean[];
      lhs: string[]; rhs: string[]; empty: string[]; leftcorners: string[]; parents: string[]; word: boolean; nonterm: boolean };
    const expected = oracle<Snapshot[]>(`
out=[]
for text in json.load(sys.stdin)['texts']:
 g=nltk.CFG.fromstring(text)
 cat=g.start()
 out.append({'start':cat.symbol(),'productions':[str(p) for p in g.productions()], 'lexical':[p.is_lexical() for p in g.productions()],
 'min':g.min_len(),'max':g.max_len(),'forms':[g.is_lexical(),g.is_nonlexical(),g.is_nonempty(),g.is_binarised(),g.is_flexible_chomsky_normal_form(),g.is_chomsky_normal_form()],
 'lhs':[str(p) for p in g.productions(lhs=cat)],'rhs':[str(p) for p in g.productions(rhs='a')], 'empty':[str(p) for p in g.productions(empty=True)],
 'leftcorners':sorted(str(c) for c in g.leftcorners(cat)),'parents':sorted(str(c) for c in g.leftcorner_parents(cat)),
 'word':g.is_leftcorner(cat,'a'),'nonterm':g.is_leftcorner(cat,nltk.Nonterminal('A'))})
print(json.dumps(out))`, { texts });
    for (let i = 0; i < texts.length; i++) {
      const g = RustCFG.fromstring(runtime, texts[i]!);
      const snapshot: Snapshot = { start: g.start().symbol(), productions: g.productions().map(String), lexical: g.productions().map((p) => p.is_lexical()),
        min: g.min_len(), max: g.max_len(), forms: [g.is_lexical(), g.is_nonlexical(), g.is_nonempty(), g.is_binarised(), g.is_flexible_chomsky_normal_form(), g.is_chomsky_normal_form()],
        lhs: g.productions({ lhs: g.start() }).map(String), rhs: g.productions({ rhs: "a" }).map(String), empty: g.productions({ empty: true }).map(String),
        leftcorners: g.leftcorners(g.start()).map(String).sort(), parents: g.leftcorner_parents(g.start()).map(String).sort(),
        word: g.is_leftcorner(g.start(), "a"), nonterm: g.is_leftcorner(g.start(), new Nonterminal("A")) };
      expect(snapshot).toEqual(expected[i]!);
    }
    const [s, np] = nonterminals("S, NP");
    expect(s!.slash(np!).symbol()).toBe("S/NP"); expect(new Nonterminal("S").equals(s)).toBeTrue(); expect(s!.equals("S")).toBeFalse();
    const p = new Production(runtime, s!, [np!, "S"]);
    expect(p.lhs().symbol()).toBe("S"); expect(p.rhs()[0]).toBeInstanceOf(Nonterminal); expect(p.length).toBe(2);
    expect(p.toString()).toBe("S -> NP 'S'"); expect(p.is_nonlexical()).toBeFalse(); expect(p.equals(new Production(runtime, s!, [np!, "S"]))).toBeTrue();
    expect(() => new RustCFG(runtime, s!, [])).toThrow();
    const g = RustCFG.fromstring(runtime, "S -> 'a'"); expect(() => g.check_coverage(["b"])).toThrow();
    expect(() => g.productions({ rhs: "a", empty: true })).toThrow();
  } finally { runtime.dispose(); }
});

test("Rust grammar errors are behavioral differentials, not import checks", async () => {
  const runtime = await ParsingRuntime.load();
  try {
    const texts = ["", "# empty", "S => A", "S -> 'a", "S -> @", "S -> A # inline", "%bad S\nS -> 'a'", "%start S T\nS -> 'a'", "-> 'a'", "S -> 'a' [0.5]"];
    const errors = oracle<boolean[]>(`
out=[]
for text in json.load(sys.stdin)['texts']:
 try: nltk.CFG.fromstring(text); out.append(False)
 except ValueError: out.append(True)
print(json.dumps(out))`, { texts });
    for (let i = 0; i < texts.length; i++) { expect(errors[i]).toBeTrue(); expect(() => RustCFG.fromstring(runtime, texts[i]!)).toThrow(); }
  } finally { runtime.dispose(); }
});

test("Packed Rust Earley parse trees match NLTK on valid/invalid/ambiguous/nullable/mixed grammars", async () => {
  const runtime = await ParsingRuntime.load();
  try {
    const cases = [
      { grammar: "S -> NP VP\nNP -> 'alice' | 'bob'\nVP -> 'sees' NP", tokens: ["alice", "sees", "bob"] },
      { grammar: "S -> 'a' 'b'", tokens: ["b", "a"] },
      { grammar: "S -> S S | 'a'", tokens: ["a", "a", "a", "a", "a"] },
      { grammar: "S -> A A 'z'\nA -> | 'a'", tokens: ["a", "z"] },
      { grammar: "S -> A\nA -> B\nB ->", tokens: [] },
      { grammar: "S -> 'S'", tokens: ["S"] },
      { grammar: "S -> 'a' B 'c'\nB -> 'b'", tokens: ["a", "b", "c"] },
      { grammar: "%start X\nS -> 'unused'\nX -> 'a|b' | \"a b\"", tokens: ["a|b"] },
      { grammar: "S -> A A\nA -> | 'a'", tokens: [] },
      { grammar: "S -> A A\nA -> | 'a'", tokens: ["a", "a"] },
      { grammar: "S -> A\nA -> 'a'\nA -> 'a'", tokens: ["a"] },
      { grammar: "S -> S 'a' | 'a'", tokens: ["a", "a", "a", "a"] },
      { grammar: "S -> 'a' S | 'a'", tokens: ["a", "a", "a", "a"] },
      { grammar: "S -> A | B\nA -> 'a'\nB -> 'a'", tokens: ["a"] },
      { grammar: "S -> A\nA -> B 'a' | 'a'\nB -> A", tokens: ["a", "a", "a"] },
    ];
    for (let n = 0; n < 7; n++) {
      cases.push({ grammar: "S -> A B\nA -> 'a' A |\nB -> 'b' B |", tokens: Array(n).fill("a").concat(Array(6 - n).fill("b")) as string[] });
      cases.push({ grammar: "S -> A A A\nA -> 'a' |", tokens: Array(Math.min(n, 5)).fill("a") as string[] });
    }
    const expected = oracle<string[][]>(`
out=[]
for c in json.load(sys.stdin)['cases']:
 g=nltk.CFG.fromstring(c['grammar'])
 out.append(sorted(t.pformat(margin=1000000) for t in nltk.EarleyChartParser(g).parse(c['tokens'])))
print(json.dumps(out))`, { cases });
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]!;
      const parser = new RustEarleyParser(RustCFG.fromstring(runtime, c.grammar));
      const result = parser.parseResult(c.tokens);
      expect(result.cyclic).toBeFalse(); expect(result.truncated).toBeFalse();
      expect(result.trees.map((t) => t.pformat({ margin: 1000000 })).sort()).toEqual(expected[i]!);
      expect(result.recognized).toBe(expected[i]!.length > 0);
      expect(parser.recognize(c.tokens)).toBe(result.recognized);
      expect(parser.parse(c.tokens).length).toBe(result.trees.length);
    }
  } finally { runtime.dispose(); }
});

test("Rust parsing exposes ambiguity bounds/cycles and rejects missing vocabulary/resources", async () => {
  const runtime = await ParsingRuntime.load();
  try {
    const grammar = RustCFG.fromstring(runtime, "S -> S S | 'a'");
    const parser = new RustEarleyParser(grammar, { maxTrees: 2 });
    const result = parser.parseResult(["a", "a", "a", "a"]);
    expect(result.trees.length).toBe(2); expect(result.truncated).toBeTrue();
    expect(() => parser.parse(["a", "a", "a", "a"])).toThrow("maxTrees");
    expect(() => parser.parse(["x"])).toThrow("cover");
    expect(() => new RustEarleyParser(grammar, { maxStates: 2 }).parse(["a"])).toThrow("resource");
    const cyclic = new RustEarleyParser(RustCFG.fromstring(runtime, "S -> S | 'a'"));
    expect(cyclic.parseResult(["a"]).cyclic).toBeTrue(); expect(cyclic.recognize(["a"])).toBeTrue();
    expect(() => cyclic.parse(["a"])).toThrow("cyclic");
    const hiddenCycle = new RustEarleyParser(RustCFG.fromstring(runtime, "S -> 'a' | A\nA -> A | 'a'"), { maxTrees: 0 });
    expect(hiddenCycle.parseResult(["a"]).cyclic).toBeTrue();
    runtime.dispose(); expect(() => parser.recognize(["a"])).toThrow("disposed");
  } finally { runtime.dispose(); }
});

test("Rust Earley exhaustive short inputs match NLTK for generated acyclic nullable CFGs", async () => {
  let seed = 2026;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const cases: Array<{ grammar: string; tokens: string[] }> = [];
  const inputs: string[][] = [[]];
  for (let length = 1; length <= 3; length++) {
    for (let bits = 0; bits < 2 ** length; bits++) inputs.push(Array.from({ length }, (_, i) => bits & (1 << i) ? "b" : "a"));
  }
  for (let trial = 0; trial < 16; trial++) {
    const rules = ["A -> 'a' | 'b' |", "B -> 'a' A | A 'b' |"];
    for (let alt = 0; alt < 3; alt++) {
      const choices = ["A", "B", "'a'", "'b'"];
      rules.push(`S -> ${Array.from({ length: Math.floor(random() * 4) }, () => choices[Math.floor(random() * choices.length)]!).join(" ")}`);
    }
    const grammar = "%start S\n" + rules.join("\n");
    for (const tokens of inputs) cases.push({ grammar, tokens });
  }
  const expected = oracle<string[][]>(`
out=[]
for c in json.load(sys.stdin)['cases']:
 g=nltk.CFG.fromstring(c['grammar'])
 out.append(sorted(t.pformat(margin=1000000) for t in nltk.EarleyChartParser(g).parse(c['tokens'])))
print(json.dumps(out))`, { cases });
  const runtime = await ParsingRuntime.load();
  try {
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]!;
      const result = new RustEarleyParser(RustCFG.fromstring(runtime, c.grammar)).parseResult(c.tokens);
      expect(result.trees.map((t) => t.pformat({ margin: 1000000 })).sort()).toEqual(expected[i]!);
      expect(result.recognized).toBe(expected[i]!.length > 0);
    }
  } finally { runtime.dispose(); }
});
