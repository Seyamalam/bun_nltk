import { describe, expect, it, spyOn } from "bun:test";
import {
  CCGVar, Direction, PrimitiveCategory, FunctionalCategory,
} from "../src/ccg_api.ts";
import {
  ForwardApplication, BackwardApplication, ForwardComposition, BackwardComposition,
  ForwardSubstitution, ForwardT, BackwardT,
  forwardOnly, backwardOnly, bothForward, bothBackward, crossedDirs,
  backwardBxConstraint, forwardSConstraint, backwardSxConstraint,
  forwardTConstraint, backwardTConstraint, innermostFunction,
  UndirectedTypeRaise,
} from "../src/ccg_combinator.ts";
import {
  augParseCategory, matchBrackets, nextCategory, parseApplication,
  parsePrimitiveCategory, parseSubscripts,
} from "../src/ccg_ccgcat.ts";
import { fromString, parseLexicon, Token } from "../src/ccg_lexicon.ts";
import {
  CCGChart, CCGChartParser, CCGEdge, CCGLeafEdge, CCGTree,
  ApplicationRuleSet, DefaultRuleSet, computeSemantics, demo, lex,
  printCCGDerivation,
} from "../src/ccg_chart.ts";

// Oracle: test/ccg_oracle.py (NLTK 3.10.3, Python 3.14.4)

const DEMO_LEX = `
:- S,NP,N
I => NP {I}
you => NP {you}
cook => S\\NP {\\x.cook(x)}
eat => (S\\NP)/NP {\\x y.eat(x,y)}
mushrooms => NP {mushrooms}
`;

const NP = new PrimitiveCategory("NP");
const S = new PrimitiveCategory("S");
const N = new PrimitiveCategory("N");
const snp = new FunctionalCategory(S, NP, new Direction("\\", "_"));
const vpn = new FunctionalCategory(snp, NP, new Direction("/", "_"));
const nn = new FunctionalCategory(N, N, new Direction("\\", "_"));

function try_(fn: (...a: never[]) => unknown, ...a: never[]): string {
  try {
    return `${fn(...a)}`;
  } catch (e) {
    return `${(e as Error).name}: ${(e as Error).message}`;
  }
}

describe("ccg lexicon", () => {
  it("parses categories with semantics (oracle)", () => {
    const l = fromString(DEMO_LEX, true);
    expect([...l.categories("I")].map((t) => `${t}`)).toEqual(["NP {I}"]);
    expect([...l.categories("cook")].map((t) => `${t}`)).toEqual(["(S\\NP) {\\x.cook(x)}"]);
    expect([...l.categories("eat")].map((t) => `${t}`)).toEqual(["((S\\NP)/NP) {\\x y.eat(x,y)}"]);
    const tok = l.categories("I")[0]!;
    expect(`${tok.categ}`).toBe("NP");
    expect(`${tok.semantics}`).toBe("I");
  });

  it("deprecated parseLexicon warns then delegates (oracle)", () => {
    const warns: string[] = [];
    const spy = spyOn(console, "warn").mockImplementation((m: unknown) => warns.push(`${m}`));
    const l = parseLexicon(":- S\na => S");
    spy.mockRestore();
    expect([...l.categories("a")].map((t) => `${t}`)).toEqual(["S"]);
    expect(warns[0]).toBe("\n  Function parseLexicon() has been deprecated.  Use fromstring()\n  instead.");
  });

  it("error names match NLTK (oracle)", () => {
    // unknown primitive -> AssertionError inside augParseCategory first
    expect(try_(fromString as never, "a => S" as never)).toBe("AssertionError: String 'S' is neither a family nor primitive category.");
    // completely empty lexicon -> primitives[0] IndexError
    expect(try_(fromString as never, "" as never)).toBe("IndexError: list index out of range");
    // unparseable category -> AssertionError
    expect(try_(augParseCategory as never, "X" as never, new Set(["S"]) as never, new Map() as never))
      .toBe("AssertionError: String 'X' is neither a family nor primitive category.");
    // regex non-matches -> AttributeError 'NoneType'.groups
    expect(try_(nextCategory as never, "!!!" as never)).toBe("AttributeError: 'NoneType' object has no attribute 'groups'");
    expect(try_(matchBrackets as never, "(unclosed" as never)).toBe("AssertionError: Unmatched bracket in string '(unclosed'");
    // missing semantics with include_semantics
    expect(try_(fromString as never, ":- S\na => S" as never, true as never))
      .toBe("AssertionError: a => S must contain semantics because include_semantics is set to True");
  });
});

describe("ccg lexicon helpers", () => {
  it("matchBrackets/nextCategory/parseSubscripts/parseApplication (oracle)", () => {
    expect(matchBrackets("(a(b)c)rest")).toEqual(["(a(b)c)", "rest"]);
    expect(nextCategory("NP[sg]/x")).toEqual(["NP[sg]", "/x"]);
    expect(nextCategory("(S\\NP)/NP rest")).toEqual(["(S\\NP)", "/NP rest"]);
    expect(parseSubscripts("[sg,pl]")).toEqual(["sg", "pl"]);
    expect(`${parseApplication(["\\", ".", ","])}`).toBe("\\.,");
  });

  it("augParseCategory parses families+vars (oracle)", () => {
    const [cat, v] = augParseCategory("(S\\NP)/NP", new Set(["S", "NP", "N"]), new Map());
    expect(`${cat}`).toBe("((S\\NP)/NP)");
    expect(v).toBeNull();
    const [cat2, v2] = augParseCategory("var\\.,var/.,var", new Set(["S"]), new Map());
    expect(`${cat2}`).toBe("((_var0\\.,_var0)/.,_var0)");
    expect(`${v2}`).toBe("_var0");
    const prim = parsePrimitiveCategory(["NP", "[sg]"], new Set(["NP"]), new Map(), null);
    expect(`${prim[0]}`).toBe("NP['sg']");
  });
});

describe("ccg api", () => {
  it("reprs + member surface (oracle)", () => {
    expect(`${new PrimitiveCategory("NP", ["sg"])}`).toBe("NP['sg']");
    expect(`${new Direction("/", "_")}`).toBe("/_");
    expect(`${new Direction("\\", ".,")}`).toBe("\\.,");
    CCGVar.resetId();
    const v = new CCGVar();
    expect(`${v}`).toBe("_var0");
    expect(v.isVar()).toBe(true);
    expect(v.isPrimitive()).toBe(false);
    expect(v.isFunction()).toBe(false);
    expect(NP.canUnify(new PrimitiveCategory("NP"))).toEqual([]);
    expect(NP.canUnify(N)).toBeNull();
  });
});

describe("ccg combinators", () => {
  it("application/composition/substitution/typeraise results (oracle)", () => {
    expect([...ForwardApplication.combine(vpn, NP)].map(String)).toEqual(["(S\\_NP)"]);
    expect(ForwardApplication.canCombine(vpn, NP)).toBe(true);
    expect(ForwardApplication.canCombine(NP, vpn)).toBe(false);
    expect([...BackwardApplication.combine(NP, snp)].map(String)).toEqual(["S"]);
    expect([...ForwardComposition.combine(vpn, nn)].map(String)).toEqual([]);
    expect([...BackwardComposition.combine(nn, snp)].map(String)).toEqual([]);
    expect([...ForwardSubstitution.combine(vpn, new FunctionalCategory(NP, N, new Direction("/", "_")))].map(String)).toEqual([]);
    expect([...ForwardT.combine(NP, snp)].map(String)).toEqual([]);
    expect([...BackwardT.combine(NP, snp)].map(String)).toEqual([]);
  });

  it("constraint truth table incl. AttributeError quirks (oracle)", () => {
    expect(try_(forwardOnly as never, vpn as never, NP as never)).toBe("true");
    expect(try_(forwardOnly as never, snp as never, NP as never)).toBe("false");
    expect(try_(backwardOnly as never, vpn as never, NP as never))
      .toBe("AttributeError: 'PrimitiveCategory' object has no attribute 'dir'");
    expect(try_(bothForward as never, vpn as never, vpn as never)).toBe("true");
    expect(try_(bothForward as never, vpn as never, snp as never)).toBe("false");
    expect(try_(bothForward as never, NP as never, vpn as never))
      .toBe("AttributeError: 'PrimitiveCategory' object has no attribute 'dir'");
    expect(try_(bothBackward as never, snp as never, snp as never)).toBe("true");
    expect(try_(bothBackward as never, snp as never, vpn as never)).toBe("false");
    expect(try_(crossedDirs as never, vpn as never, snp as never)).toBe("true");
    expect(try_(crossedDirs as never, vpn as never, vpn as never)).toBe("false");
    expect(try_(backwardBxConstraint as never, snp as never, nn as never)).toBe("false");
    expect(try_(forwardSConstraint as never, vpn as never, NP as never))
      .toBe("AttributeError: 'PrimitiveCategory' object has no attribute 'dir'");
    expect(try_(forwardSConstraint as never, vpn as never, vpn as never)).toBe("false");
    expect(try_(backwardSxConstraint as never, snp as never, NP as never)).toBe("false");
    expect(try_(forwardTConstraint as never, vpn as never, NP as never))
      .toBe("AttributeError: 'PrimitiveCategory' object has no attribute 'res'");
    expect(try_(backwardTConstraint as never, snp as never, NP as never)).toBe("false");
    expect(`${innermostFunction(vpn)}`).toBe("(S\\_NP)");
    expect(try_(innermostFunction as never, NP as never))
      .toBe("AttributeError: 'PrimitiveCategory' object has no attribute 'res'");
  });

  it("UndirectedTypeRaise.canCombine hits NLTK's NameError bug", () => {
    // NLTK references undefined `left`/`arg_categ` once the guards pass.
    const utr = new UndirectedTypeRaise();
    expect(utr.canCombine(NP, snp)).toBe(false);
    const nested = new FunctionalCategory(new FunctionalCategory(S, N, new Direction("/", "_")), snp, new Direction("\\", "_"));
    expect(try_(utr.canCombine.bind(utr) as never, NP as never, nested as never))
      .toBe("NameError: name 'left' is not defined");
  });
});

describe("ccg chart", () => {
  it("produces byte-identical derivations incl. semantics (oracle)", () => {
    const l = fromString(DEMO_LEX, true);
    const p = new CCGChartParser(l, ApplicationRuleSet);
    const logs: string[] = [];
    const spy = spyOn(console, "log").mockImplementation((m: unknown) => logs.push(`${m}`));
    for (const t of p.parse("I cook".split(" "))) printCCGDerivation(t);
    for (const t of p.parse("I eat mushrooms".split(" "))) printCCGDerivation(t);
    spy.mockRestore();
    expect(logs).toEqual([
      "   I            cook",
      " NP {I}  (S\\NP) {\\x.cook(x)}",
      "-----------------------------<",
      "         S {cook(I)}",
      "   I                 eat                mushrooms",
      " NP {I}  ((S\\NP)/NP) {\\x y.eat(x,y)}  NP {mushrooms}",
      "        --------------------------------------------->",
      "                (S\\NP) {\\x.eat(mushrooms,x)}",
      "-----------------------------------------------------<",
      "                S {eat(mushrooms,I)}",
    ]);
  });

  it("demo output is byte-identical to NLTK (398 lines, oracle)", () => {
    const logs: string[] = [];
    const spy = spyOn(console, "log").mockImplementation((m: unknown) => logs.push(`${m}`));
    demo();
    spy.mockRestore();
    expect(logs.length).toBe(398);
    expect(logs[0]).toBe(" I      might      cook               and               eat     the    bacon");
    expect(logs[1]).toBe(" NP  ((S\\NP)/VP)  (VP/NP)  ((_var0\\.,_var0)/.,_var0)  (VP/NP)  (NP/N)    N");
    expect(logs[13]).toBe("                                      S");
    expect(logs[397]).toBe("                                      S");
  });

  it("chart member surface: edges/insert/select/cpls/parses", () => {
    const chart = new CCGChart(["I", "cook"]);
    expect(chart.num_leaves()).toBe(2);
    expect(chart.edges()).toEqual([]);
    const toks = lex.categories("I");
    const leaf = new CCGLeafEdge(0, toks[0]!, "I");
    expect(chart.insert(leaf, [])).toBe(true);
    expect(chart.insert(leaf, [])).toBe(false);
    expect(chart.num_edges()).toBe(1);
    expect([...chart.select([0, 1])]).toEqual([leaf]);
    expect(chart.child_pointer_lists(leaf)).toEqual([[]]);
    const e = new CCGEdge([0, 2], S, ">x");
    expect(chart.insert(e, [leaf, leaf])).toBe(true);
    expect(chart.insert(e, [leaf, leaf])).toBe(false);
    // distinct cpl registers without yielding a new edge
    expect(chart.num_edges()).toBe(2);
    expect(chart.insert_with_backpointer(new CCGEdge([0, 2], S, ">x"), leaf, [leaf])).toBe(true);
    expect(chart.child_pointer_lists(e).length).toBe(2);
    expect(leaf.dot()).toBe(0);
    expect(leaf.is_complete()).toBe(true);
    expect(leaf.is_incomplete()).toBe(false);
    expect(leaf.nextsym()).toBeNull();
    expect(leaf.rhs()).toBe("I");
    expect(e.length()).toBe(2);
    expect(e.rhs()).toEqual([]);
    expect([...chart.iteredges()]).toEqual([leaf, e]);
  });

  it("parse_one/parse_all/parse_sents + ParserI surface", () => {
    const p = new CCGChartParser(lex, DefaultRuleSet);
    expect(p.lexicon()).toBe(lex);
    const l = fromString(DEMO_LEX, true);
    const sp = new CCGChartParser(l, ApplicationRuleSet);
    const one = sp.parse_one("I cook".split(" "));
    expect(one).not.toBeNull();
    expect(one!.leaves()).toEqual(["I", "cook"]);
    expect(sp.parse_all("I cook".split(" ")).length).toBeGreaterThan(0);
    expect([...sp.parse_sents([["I", "cook"], ["I", "sleep"]])].map((ts) => ts.length)).toEqual([1, 0]);
    // CCGChartParser has no _grammar in NLTK -> AttributeError
    expect(try_(p.grammar.bind(p) as never)).toBe("AttributeError: 'CCGChartParser' object has no attribute '_grammar'");
  });

  it("computeSemantics matches NLTK signatures incl. AssertionError", () => {
    const l = fromString(DEMO_LEX, true);
    const p = new CCGChartParser(l, ApplicationRuleSet);
    const tree = [...p.parse("I cook".split(" "))][0]!;
    const [tok, op] = tree.label as [Token, string];
    expect(`${tok.semantics}`).toBe("cook(I)");
    expect(op).toBe("<");
    // unsupported combinator -> AssertionError (no reachable rule produces it;
    // simulate by calling computeSemantics with a string rule)
    const leaf1 = new CCGTree([tok, "Leaf"], [new CCGTree(tok, ["I"])]);
    const leaf2 = new CCGTree([tok, "Leaf"], [new CCGTree(tok, ["cook"])]);
    const bogus = new (Object.getPrototypeOf(ForwardApplication).constructor)(
      new UndirectedTypeRaise(), () => true,
    );
    expect(try_(computeSemantics as never, [leaf1, leaf2] as never, new CCGEdge([0, 2], S, bogus) as never))
      .toBe("AssertionError: Unsupported combinator 'T'");
  });
});
