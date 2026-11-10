import { describe, expect, test } from "bun:test";
import { CFG, DependencyProduction, Nonterminal, ProbabilisticProduction, Production, nonterminals, readGrammar, standardNontermParser } from "../src/grammar";

// NLTK 3.10.3 oracle pins — nltk.grammar CFG/Production/Nonterminal
const GRAMMAR = "S -> NP VP | 'a' \nNP -> 'det' 'n' \nVP -> V \nV -> 'x'";
const LC_GRAMMAR = "S -> NP VP\nNP -> D N\nD -> 'a'\nN -> 'n'\nVP -> V\nV -> 'v'";

describe("nltk.grammar.CFG oracle parity (3.10.3)", () => {
  test("construction, repr, str, start, productions filter", () => {
    const g = CFG.fromstring(GRAMMAR);
    expect(g.repr()).toBe("<Grammar with 5 productions>");
    expect(g.start().symbol()).toBe("S");
    expect(g.productions({ lhs: new Nonterminal("NP") }).map(String)).toEqual(["NP -> 'det' 'n'"]);
    expect(g.productions({ rhs: new Nonterminal("V") }).map(String)).toEqual(["VP -> V"]);
    expect(g.productions()).toHaveLength(5);
    expect(String(g).split("\n").slice(0, 3)).toEqual(["Grammar with 5 productions (start state = S)", "    S -> NP VP", "    S -> 'a'"]);
  });

  test("grammar form predicates match NLTK", () => {
    const g = CFG.fromstring(GRAMMAR);
    expect(g.is_lexical()).toBe(false);
    expect(g.is_nonlexical()).toBe(false);
    expect(g.is_binarised()).toBe(true);
    expect(g.min_len()).toBe(1);
    expect(g.max_len()).toBe(2);
    expect(g.is_nonempty()).toBe(true);
    expect(g.is_chomsky_normal_form()).toBe(false);
    expect(g.is_flexible_chomsky_normal_form()).toBe(false);
    const cnf = CFG.fromstring("S -> NP VP\nNP -> 'n'\nVP -> 'v'");
    expect(cnf.is_chomsky_normal_form()).toBe(true);
  });

  test("chomsky_normal_form produces NLTK production set", () => {
    const cnf = CFG.fromstring("S -> NP VP P | 'x'").chomsky_normal_form();
    expect(cnf.is_chomsky_normal_form()).toBe(true);
    expect(cnf.repr()).toBe("<Grammar with 3 productions>");
    expect(new Set(cnf.productions().map(String))).toEqual(new Set(["S -> NP S@$@NP", "S@$@NP -> VP P", "S -> 'x'"]));
  });

  test("eliminate_start adds S0_SIGMA when start appears on rhs", () => {
    const g = CFG.fromstring("S -> A B\nA -> 'a' S\nB -> 'b'");
    const e = CFG.eliminate_start(g);
    expect(e.start().symbol()).toBe("S0_SIGMA");
    expect(e.productions().map(String)).toContain("S0_SIGMA -> S");
    const same = CFG.eliminate_start(CFG.fromstring("S -> 'a'"));
    expect(same.start().symbol()).toBe("S");
  });

  test("remove_unitary_rules expands A -> B chains and breaks cycles", () => {
    const g = CFG.fromstring("S -> A\nA -> B\nB -> 'b'\nB -> C\nC -> B");
    const out = CFG.remove_unitary_rules(g);
    const strs = out.productions().map(String);
    expect(strs).toContain("S -> 'b'");
    expect(strs.every((s) => !/^S -> [A-Z]$/.test(s))).toBe(true);
  });

  test("remove_mixed_rules splits terminals in multi-symbol rhs", () => {
    const g = CFG.fromstring("S -> NP 'x' VP\nNP -> 'n'\nVP -> 'v'");
    const out = CFG.remove_mixed_rules(g);
    const strs = out.productions().map(String);
    expect(strs).toContain("S -> NP X@$@X VP");
    expect(strs).toContain("X@$@X -> 'x'");
  });

  test("leftcorners/is_leftcorner/leftcorner_parents match NLTK", () => {
    const lc = CFG.fromstring(LC_GRAMMAR);
    expect(lc.leftcorners(new Nonterminal("S")).map((n) => n.symbol()).sort()).toEqual(["D", "NP", "S"]);
    expect(lc.is_leftcorner(new Nonterminal("S"), "a")).toBe(true);
    expect(lc.is_leftcorner(new Nonterminal("VP"), "a")).toBe(false);
    expect(lc.is_leftcorner(new Nonterminal("S"), new Nonterminal("NP"))).toBe(true);
    expect(lc.leftcorner_parents(new Nonterminal("N")).map(String)).toEqual(["N"]);
  });

  test("check_coverage error wording matches NLTK repr quoting", () => {
    const lc = CFG.fromstring(LC_GRAMMAR);
    expect(() => lc.check_coverage(["a", "b"])).toThrow("Grammar does not cover some of the input words: \"'b'\".");
    expect(() => lc.check_coverage(["a", "v"])).not.toThrow();
  });

  test("productions(empty=true) + rhs/empty ValueError", () => {
    const g = CFG.fromstring("S -> \nS -> 'a'");
    expect(g.productions({ empty: true }).map(String)).toEqual(["S -> "]);
    expect(() => g.productions({ rhs: "a", empty: true })).toThrow("You cannot select empty and non-empty productions at the same time.");
  });

  test("read_grammar errors match NLTK", () => {
    expect(() => CFG.fromstring("S -> 'a' [2.0]")).toThrow("Unable to parse line 1: S -> 'a' [2.0]\nExpected a nonterminal, found: [2.0]");
    expect(() => CFG.fromstring("# nothing")).toThrow("No productions found!");
    expect(() => CFG.fromstring("S 'a'")).toThrow("Unable to parse line 1: S 'a'\nExpected an arrow");
    expect(() => CFG.fromstring("S -> 'a")).toThrow("Unterminated string");
  });

  test("grammar constructor validates start like NLTK", () => {
    expect(() => new CFG("S" as unknown as Nonterminal, [])).toThrow(TypeError);
    expect(() => new CFG("S" as unknown as Nonterminal, [])).toThrow("start should be a Nonterminal object, not a str");
  });
});

describe("nltk.grammar.Production/Nonterminal oracle parity", () => {
  test("Production surface", () => {
    const p = new Production(new Nonterminal("S"), [new Nonterminal("NP"), "a"]);
    expect(String(p)).toBe("S -> NP 'a'");
    expect(p.is_lexical()).toBe(true);
    expect(p.is_nonlexical()).toBe(false);
    expect(p.length).toBe(2);
    expect(p.lhs().symbol()).toBe("S");
    expect(() => new Production(new Nonterminal("S"), "NP" as unknown as [])).toThrow("production right hand side should be a list, not a string");
  });

  test("Nonterminal surface + nonterminals", () => {
    const nt = new Nonterminal("S");
    expect(nt.symbol()).toBe("S");
    expect(nt.equals(new Nonterminal("S"))).toBe(true);
    expect(nt.slash(new Nonterminal("NP")).symbol()).toBe("S/NP");
    expect(nonterminals("S, NP, VP").map((n) => n.symbol())).toEqual(["S", "NP", "VP"]);
    expect(nonterminals("S NP VP").map((n) => n.symbol())).toEqual(["S", "NP", "VP"]);
  });

  test("ProbabilisticProduction prob/logprob + format", () => {
    const p = new ProbabilisticProduction(new Nonterminal("S"), ["a"], { prob: 0.5 });
    expect(p.prob()).toBe(0.5);
    expect(p.logprob()).toBe(-1);
    p.set_logprob(-2);
    expect(p.prob()).toBe(0.25);
    expect(String(p)).toBe("S -> 'a' [0.25]");
  });

  test("readGrammar parses probabilistic productions", () => {
    const [start, prods] = readGrammar("S -> 'a' [.4] | 'b' [.6]", standardNontermParser, { probabilistic: true });
    expect(start.symbol()).toBe("S");
    expect((prods as ProbabilisticProduction[]).map((p) => p.prob())).toEqual([0.4, 0.6]);
    expect(() => readGrammar("S -> 'a' [2.0]", standardNontermParser, { probabilistic: true })).toThrow("should not be greater than 1.0");
  });

  test("DependencyProduction str matches NLTK", () => {
    expect(String(new DependencyProduction(new Nonterminal("head"), ["dep"]))).toBe("'head' -> 'dep'");
  });
});
