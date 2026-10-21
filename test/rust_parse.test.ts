import { expect, test } from "bun:test";
import { ParsingRuntime, Tree, Nonterminal, Production, RustCFG, RustEarleyParser, nonterminals, type TreeFormatOptions } from "../src/rust_parse";
import type { ParseTree } from "../src/parse";

function oracle<T>(code: string, input: object): T {
  const python = Bun.spawnSync(["python3", "-c", `import json,sys,nltk\nassert nltk.__version__ == '3.10.3', nltk.__version__\n${code}`], {
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
