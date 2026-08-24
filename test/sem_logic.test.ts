import { beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  AllExpression,
  AndExpression,
  Assignment,
  ConstantExpression,
  EqualityExpression,
  Expression,
  ImpExpression,
  IndividualVariableExpression,
  LogicalExpressionException,
  LogicParser,
  Model,
  NegatedExpression,
  OrExpression,
  Valuation,
  Variable,
  is_eventvar,
  is_funcvar,
  is_indvar,
  makeVariableExpression,
  resetUniqueVariableCounter,
} from "../src/sem_logic";
import { SEM_CASES, runJsCases } from "../bench/parity_sem";

const lp = new LogicParser();
const parse = (s: string): Expression => new LogicParser().parse(s);
const resetCounter = resetUniqueVariableCounter;

describe("LogicParser: str() formatting and precedence", () => {
  const cases: [string, string][] = [
    ["john", "john"],
    ["man(x)", "man(x)"],
    ["P(x,y,z)", "P(x,y,z)"],
    ["-man(x)", "-man(x)"],
    ["not man(x)", "-man(x)"],
    ["--P", "--P"],
    ["-(man(x) & tall(x))", "-(man(x) & tall(x))"],
    ["man(x) & tall(x) & walks(x)", "(man(x) & tall(x) & walks(x))"],
    ["man(x) & tall(x) | walks(x)", "((man(x) & tall(x)) | walks(x))"],
    ["a | b & c", "(a | (b & c))"],
    ["a & b -> c", "((a & b) -> c)"],
    ["a -> b & c", "(a -> (b & c))"],
    ["a -> b -> c", "((a -> b) -> c)"],
    ["a <-> b -> c", "(a <-> (b -> c))"],
    ["a -> b <-> c", "((a -> b) <-> c)"],
    ["(a | b) & c", "((a | b) & c)"],
    ["x = y", "(x = y)"],
    ["x != y", "-(x = y)"],
    ["!(x = y)", "-(x = y)"],
    ["-x = y", "(-x = y)"],
    ["x = y & P(x)", "((x = y) & P(x))"],
    ["x = y = z", "((x = y) = z)"],
    ["all x.man(x)", "all x.man(x)"],
    ["all x.man(x) & tall(x)", "(all x.man(x) & tall(x))"],
    ["exists x.(man(x) & tall(x))", "exists x.(man(x) & tall(x))"],
    ["some x.exist y.walks(x,y)", "exists x y.walks(x,y)"],
    ["all x y.(see(x,y) -> love(x,y))", "all x y.(see(x,y) -> love(x,y))"],
    ["exists x.x = y", "exists x.(x = y)"],
    ["iota x.man(x)", "iota x.man(x)"],
    ["\\x.man(x)", "\\x.man(x)"],
    ["\\x y.sees(x,y)", "\\x y.sees(x,y)"],
    ["\\x y.sees(x,y)(a,b)", "((\\x y.sees(x,y))(a))(b)"],
    ["\\x y.sees(x,y)(john,mary)", "((\\x y.sees(x,y))(john))(mary)"],
    ["\\x.man(x)(john)", "\\x.man(x)(john)"],
    ["\\P Q.exists x.(P(x) & Q(x))", "\\P Q.exists x.(P(x) & Q(x))"],
    ["man(x) <-> tall(x)", "(man(x) <-> tall(x))"],
    ["F1(a2)", "F1(a2)"],
    ["e1 sees nothing here", undefined as unknown as string],
  ];

  for (const [input, expected] of cases) {
    if (expected === (undefined as unknown as string)) continue;
    test(`str(parse(${JSON.stringify(input)})) == ${JSON.stringify(expected)}`, () => {
      expect(lp.parse(input).str()).toBe(expected);
    });
  }

  test("round-trip stability", () => {
    const exprs = [
      "man(x) & tall(x) | walks(x)",
      "a -> b <-> c",
      "all x y.(see(x,y) -> love(x,y))",
      "(\\x.exists y.walks(x,y))(z1)",
      "-(x = y)",
    ];
    for (const s of exprs) {
      const once = parse(s).str();
      expect(parse(once).str()).toBe(once);
    }
  });
});

describe("LogicParser: errors", () => {
  // NLTK's parse() wraps every parser error in a fresh LogicalExpressionException
  test("missing close paren", () => {
    expect(() => parse("(P(x) & Q(x)")).toThrow(LogicalExpressionException);
  });
  test("bare quantifier", () => {
    expect(() => parse("exists")).toThrow(LogicalExpressionException);
  });
  test("adjacent expressions", () => {
    expect(() => parse("P(x)Q(x)")).toThrow(LogicalExpressionException);
  });
  test("individual variable as predicate", () => {
    expect(() => parse("x(y)")).toThrow();
  });
});

describe("expression classes and predicates", () => {
  test("variable classification", () => {
    expect(is_indvar("x")).toBe(true);
    expect(is_indvar("z12")).toBe(true);
    expect(is_indvar("e")).toBe(false);
    expect(is_eventvar("e1")).toBe(true);
    expect(is_funcvar("F3")).toBe(true);
    const e = parse("dog(e1)");
    expect(e).toBeInstanceOf(Expression);
    expect(parse("john")).toBeInstanceOf(ConstantExpression);
    expect(makeVariableExpression("x")).toBeInstanceOf(IndividualVariableExpression);
  });

  test("free/variables/constants/predicates", () => {
    const names = (set: Set<Variable>) => Array.from(set).map((v) => v.name).sort();
    expect(names(parse("\\x.sees(x,y)(john)").free())).toEqual(["y"]);
    // free() excludes constants (adam) per NLTK semantics
    expect(names(parse("exists x.(dog(x) & -(x = adam))").free())).toEqual([]);
    // constants() only counts ConstantExpression atoms, not individual variables
    expect(names(parse("P(x) & x=y & P(y)").constants())).toEqual([]);
    expect(names(parse("loves(x, john)").constants())).toEqual(["john"]);
    expect(names(parse("P(x) & x=y & P(y)").predicates())).toEqual([]);
    expect(names(parse("all x y.see(x,y)").free())).toEqual([]);
    expect(names(parse("F1(x)").free())).toEqual(["F1", "x"]);
    expect(names(parse("\\x.P(x)").variables())).toEqual(["P"]);
  });

  test("structural equality", () => {
    expect(parse("man(x)").equals(parse("man(x)"))).toBe(true);
    expect(parse("man(x)").equals(parse("man(y)"))).toBe(false);
    expect(parse("a & b").equals(new AndExpression(parse("a"), parse("b")))).toBe(true);
    expect(parse("a -> b").equals(new ImpExpression(parse("a"), parse("b")))).toBe(true);
    expect(parse("a -> b").equals(new OrExpression(parse("a"), parse("b")))).toBe(false);
    expect(parse("(x = y)").equals(new EqualityExpression(parse("x"), parse("y")))).toBe(true);
    expect(parse("-(x = y)").equals(
      new NegatedExpression(new EqualityExpression(parse("x"), parse("y"))),
    )).toBe(true);
    expect(parse("a & b | c").equals(
      new OrExpression(new AndExpression(parse("a"), parse("b")), parse("c")),
    )).toBe(true);
    expect(parse("a & b | c").equals(
      new OrExpression(new ImpExpression(parse("a"), parse("b")), parse("c")),
    )).toBe(false);
  });

  test("equality modulo alphabetic variance", () => {
    expect(parse("exists x.P(x)").equals(parse("exists y.P(y)"))).toBe(true);
    expect(parse("\\x.P(x)").equals(parse("\\y.P(y)"))).toBe(true);
    expect(parse("all x.P(x)").equals(parse("all y.P(y)"))).toBe(true);
    expect(parse("exists x.P(x)").equals(parse("all y.P(y)"))).toBe(false);
    expect(parse("exists x.P(x)").equals(parse("exists y.Q(y)"))).toBe(false);
    // binder classes must match exactly
    expect(new AllExpression(new Variable("x"), parse("P(x)")).equals(
      new AllExpression(new Variable("x"), parse("P(x)")),
    )).toBe(true);
    expect(parse("\\x.P(x)").equals(parse("exists x.P(x)"))).toBe(false);
  });
});

describe("simplify (beta-reduction)", () => {
  beforeEach(() => {
    // deterministic unique-variable names regardless of test order
    resetCounter();
  });

  test("identity on non-lambda applications", () => {
    expect(parse("sees(john,mary)").simplify().str()).toBe("sees(john,mary)");
    expect(parse("\\x.P(x)").simplify().str()).toBe("\\x.P(x)");
  });

  test("curried beta reduction", () => {
    expect(parse("\\x.\\y.sees(x,y)(john)(mary)").simplify().str()).toBe("sees(john,mary)");
  });

  test("multi-var lambda sugar", () => {
    expect(parse("\\x y.sees(x,y)(john,mary)").simplify().str()).toBe("sees(john,mary)");
  });

  test("higher-order beta reduction", () => {
    expect(
      parse("(\\P.\\Q.exists x.(P(x) & Q(x)))(\\x.dog(x))(\\x.bark(x))").simplify().str(),
    ).toBe("exists x.(dog(x) & bark(x))");
  });

  test("capture-avoiding substitution renames bound variable", () => {
    expect(parse("(\\x.exists y.walks(x,y))(y)").simplify().str()).toBe("exists z1.walks(y,z1)");
  });

  test("beta reduction under quantifier", () => {
    expect(
      parse("all x.(man(x) & (\\x.exists y.walks(x,y))(x))").simplify().str(),
    ).toBe("all x.(man(x) & exists y.walks(x,y))");
  });
});

describe("normalize (alphabetical variant)", () => {
  beforeEach(() => resetCounter());

  test("renames individual variables to z1..zn in sorted order", () => {
    expect(parse("exists x.P(x)").normalize().str()).toBe("exists z1.P(z1)");
    expect(parse("exists x.all y.sees(x,y)").normalize().str()).toBe("exists z1.all z2.sees(z1,z2)");
    expect(parse("\\x.(P(x,y) & Q(y))").normalize().str()).toBe("\\z1.(P(z1,z2) & Q(z2))");
    expect(parse("\\x.sees(x,y)(john)").normalize().str()).toBe("(\\z1.sees(z1,z2))(john)");
  });

  test("event variables normalize to e0n", () => {
    expect(parse("exists e1.(see(e1,x) & bark(e1))").normalize().str()).toBe(
      "exists e01.(see(e01,z2) & bark(e01))",
    );
  });

  test("no individual variables leaves expression unchanged", () => {
    expect(parse("run(john)").normalize().str()).toBe("run(john)");
  });

  test("normalized forms are alpha-equivalent to originals", () => {
    for (const s of ["exists x.all y.see(x,y)", "\\x.(P(x) & exists y.Q(y))"]) {
      expect(parse(s).normalize().equals(parse(s))).toBe(true);
    }
  });
});

describe("substituteBindings", () => {
  test("replaces free variables then simplifies", () => {
    const bindings = new Map<string, Expression>([
      ["x", parse("john")],
      ["P", parse("\\y.run(y)")],
    ]);
    expect(parse("P(x)").substituteBindings(bindings).str()).toBe("run(john)");
    expect(parse("loves(x, mary)").substituteBindings(bindings).str()).toBe("loves(john,mary)");
  });

  test("does not substitute bound variables", () => {
    const bindings = new Map<string, Expression>([["x", parse("john")]]);
    expect(parse("exists x.dog(x)").substituteBindings(bindings).str()).toBe("exists x.dog(x)");
  });
});

describe("evaluation: Valuation / Model / Assignment", () => {
  const dom = ["b1", "b2", "g1", "g2", "d1"];
  const valuation = new Valuation({
    adam: "b1",
    betty: "g1",
    fido: "d1",
    girl: ["g1", "g2"],
    boy: ["b1", "b2"],
    dog: ["d1"],
    love: [["b1", "g1"], ["b2", "g2"], ["g1", "b1"], ["g2", "b1"]],
  });
  const model = new Model(dom, valuation);

  test("valuation domain and symbols", () => {
    expect(Array.from(valuation.domain).sort()).toEqual(["b1", "b2", "d1", "g1", "g2"]);
    expect(valuation.symbols).toEqual(["adam", "betty", "boy", "dog", "fido", "girl", "love"]);
  });

  test("assignment add/copy/purge", () => {
    const g = new Assignment(dom, { x: "b1" });
    expect(g.get("x")).toBe("b1");
    const g2 = g.copy().add("y", "g2");
    expect(g2.get("y")).toBe("g2");
    g2.purge("y");
    expect(g2.has("y")).toBe(false);
    expect(() => g.add("q1", "nowhere")).toThrow();
    expect(() => new Assignment(dom, { john: "b1" })).toThrow(); // not an indvar name
    expect(() => g.get("w")).toThrow();
  });

  test("atomic evaluation", () => {
    expect(model.evaluate("adam", new Assignment(dom)) as unknown).toBe("b1");
    expect(model.evaluate("girl", new Assignment(dom)) as unknown).toEqual([["g1"], ["g2"]]);
  });

  test("closed formulas", () => {
    const g = new Assignment(dom, { x: "b1", y: "g2" });
    expect(model.evaluate("love(adam, betty)", g)).toBe(true);
    expect(model.evaluate("love(adam, y)", g)).toBe(false);
    expect(model.evaluate("boy(x)", g)).toBe(true);
    expect(model.evaluate("-boy(x)", g)).toBe(false);
    expect(model.evaluate("x = adam", g)).toBe(true);
    expect(model.evaluate("x != adam", g)).toBe(false);
    expect(model.evaluate("boy(x) & girl(y)", g)).toBe(true);
    expect(model.evaluate("boy(x) | girl(y)", g)).toBe(true);
    expect(model.evaluate("girl(x) -> dog(x)", g)).toBe(true);
    expect(model.evaluate("dog(fido) <-> boy(x)", g)).toBe(true);
  });

  test("quantifiers", () => {
    const g = new Assignment(dom);
    expect(model.evaluate("exists x.girl(x)", g)).toBe(true);
    // unknown predicate propagates as Undefined through the quantifier
    expect(model.evaluate("exists x.octopus(x)", g)).toBe("Undefined");
    expect(model.evaluate("all x.(girl(x) | boy(x) | dog(x))", g)).toBe(true);
    expect(model.evaluate("all x.girl(x)", g)).toBe(false);
    expect(model.evaluate("exists x.(boy(x) & all y.love(y,x))", g)).toBe(false);
    expect(model.evaluate("all x.(girl(x) -> exists y.(boy(y) & love(x,y)))", g)).toBe(true);
    // NB: without parens, "&" does not bind inside the quantifier scope (NLTK
    // precedence), leaving y free -> Undefined. Faithfully reproduced:
    expect(model.evaluate("all x.(girl(x) -> exists y.boy(y) & love(x,y))", g)).toBe("Undefined");
    expect(model.evaluate("exists x.(boy(x) & all y.(girl(y) -> love(x,y)))", g)).toBe(false);
  });

  test("undefined values", () => {
    const g = new Assignment(dom, { x: "b1" });
    expect(model.evaluate("walks(x)", g)).toBe("Undefined");
    expect(model.evaluate("z", g)).toBe("Undefined");
    expect(model.evaluate("exists x.walks(x)", g)).toBe("Undefined");
  });

  test("lambda evaluation", () => {
    const g = new Assignment(dom);
    expect(model.evaluate("\\x.boy(x)(adam)", g)).toBe(true);
    expect(model.evaluate("\\x.boy(x)(betty)", g)).toBe(false);
    expect(model.evaluate("\\x y.love(x,y)(adam)(betty)", g)).toBe(true);
  });

  test("satisfiers", () => {
    const g = new Assignment(dom);
    const sorted = (s: Set<string>) => Array.from(s).sort();
    expect(sorted(model.satisfiers(parse("boy(x)"), "x", g))).toEqual(["b1", "b2"]);
    expect(sorted(model.satisfiers(parse("girl(x)"), "x", g))).toEqual(["g1", "g2"]);
    expect(sorted(model.satisfiers(parse("love(adam,x)"), "x", g))).toEqual(["g1"]);
    expect(sorted(model.satisfiers(parse("-(x = adam)"), "x", g))).toEqual([
      "b2",
      "d1",
      "g1",
      "g2",
    ]);
    expect(sorted(model.satisfiers(parse("exists y.love(y,x)"), "x", g))).toEqual([
      "b1",
      "g1",
      "g2",
    ]);
    // b1 is loved by both girls (g1, g2)
    expect(sorted(model.satisfiers(parse("all y.(girl(y) -> love(y,x))"), "x", g))).toEqual([
      "b1",
    ]);
    expect(() => model.satisfiers(parse("all x.girl(x)"), "x", g)).toThrow();
  });

  test("model rejects valuations outside its domain", () => {
    expect(() => new Model(["b1"], valuation)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Python NLTK parity (real nltk.sem.logic via bench/python_sem_baseline.py)
// ---------------------------------------------------------------------------

test("full parity suite against python nltk baseline", () => {
  const payload = JSON.stringify({ cases: SEM_CASES });
  const proc = Bun.spawnSync(
    ["python3", "bench/python_sem_baseline.py", "--payload", payload],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim());
  const js = runJsCases(SEM_CASES);
  const mismatches: string[] = [];
  for (let i = 0; i < Math.max(js.length, py.length); i++) {
    if (JSON.stringify(js[i]) !== JSON.stringify(py[i])) {
      mismatches.push(`${SEM_CASES[i]!.expression}: js=${JSON.stringify(js[i])} py=${JSON.stringify(py[i])}`);
    }
  }
  expect(mismatches).toEqual([]);
});
