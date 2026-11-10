import { describe, expect, test } from "bun:test";
import { lexpr } from "../src/sem_logic";
import {
  convertToProver9,
  decode_result,
  ClosedDomainProver,
  ClosedWorldProver,
  SetHolder,
  PredHolder,
  get_domain,
  Prover9Command,
  clausify,
  mostGeneralUnification,
  UnificationException,
  DebugObject,
  resolution_test,
  ResolutionProver,
  tableau_test,
  TableauDebug,
  TheoremToolThread,
  ParallelProverBuilder,
  ParallelProverBuilderCommand,
  PossibleAntecedents,
  AnaphoraBudget,
  MAX_ANAPHORA_OPERATIONS,
  load_fol,
  Variable,
} from "../index";

describe("convert_to_prover9 (pinned vs NLTK 3.10.3)", () => {
  const cases: Array<[string, string]> = [
    ["P(x)", "P(x)"],
    ["-P(x)", "-(P(x))"],
    ["P(x) & Q(x)", "(P(x) & Q(x))"],
    ["P(x) | Q(x)", "(P(x) | Q(x))"],
    ["P(x) -> Q(x)", "(P(x) -> Q(x))"],
    ["P(x) <-> Q(x)", "(P(x) <-> Q(x))"],
    ["exists x.P(x)", "exists x P(x)"],
    ["all x.P(x)", "all x P(x)"],
    ["x = y", "(x = y)"],
    ["walk(john,mary)", "walk(john,mary)"],
  ];
  for (const [input, expected] of cases) {
    test(input, () => {
      expect(convertToProver9(lexpr(input))).toBe(expected);
    });
  }
  test("list input maps over expressions", () => {
    const out = convertToProver9([lexpr("P(x)"), lexpr("-Q(x)")]);
    expect(out).toEqual(["P(x)", "-(Q(x))"]);
  });
});

describe("mace decode_result (pinned vs NLTK 3.10.3)", () => {
  test("true", () => expect(decode_result(true)).toBe("Countermodel found"));
  test("false", () => expect(decode_result(false)).toBe("No countermodel found"));
  test("null", () => expect(decode_result(null)).toBe("None"));
});

describe("nonmonotonic provers (pinned vs NLTK 3.10.3)", () => {
  const mk = () =>
    new Prover9Command(lexpr("walk(Bill)"), [
      lexpr("walk(Socrates)"),
      lexpr("all x.(ostrich(x) -> bird(x))"),
      lexpr("bird(Tweety)"),
    ]);

  test("ClosedDomainProver assumptions replace quantifiers over the domain", () => {
    const out = new ClosedDomainProver(mk()).assumptions().map((a) => a.str());
    expect(out[0]).toBe("walk(Socrates)");
    expect(out[2]).toBe("bird(Tweety)");
    // Domain {Socrates, Tweety, Bill} — conjunction order is set-order dependent.
    expect(out[1]).toMatch(/^\(\(ostrich\((Socrates|Tweety|Bill)\) -> bird\(\1\)\) & \(ostrich\((Socrates|Tweety|Bill)\) -> bird\(\2\)\) & \(ostrich\((Socrates|Tweety|Bill)\) -> bird\(\3\)\)\)$/);
    expect(out[1]).toContain("ostrich(Socrates) -> bird(Socrates)");
    expect(out[1]).toContain("ostrich(Tweety) -> bird(Tweety)");
    expect(out[1]).toContain("ostrich(Bill) -> bird(Bill)");
  });

  test("ClosedDomainProver goal", () => {
    expect(new ClosedDomainProver(mk()).goal()!.str()).toBe("walk(Bill)");
  });

  test("ClosedWorldProver predicate completion (pinned shape)", () => {
    // unique-variable numbering depends on global counter state, so pin the
    // shape with z\d+ placeholders (oracle: all z1.(walk(z1) -> (z1 = Socrates)) etc).
    const out = new ClosedWorldProver(mk()).assumptions().slice(3).map((a) => a.str());
    expect(out).toEqual([
      expect.stringMatching(/^all z\d+\.\(walk\(z\d+\) -> \(z\d+ = Socrates\)\)$/),
      expect.stringMatching(/^all z\d+\.\(bird\(z\d+\) -> \(\(z\d+ = Tweety\) \| ostrich\(z\d+\)\)\)$/),
      expect.stringMatching(/^all z\d+\.-ostrich\(z\d+\)$/),
    ]);
    // the quantified var must be the same fresh var throughout each clause
    for (const s of out) {
      const vars = s.match(/z\d+/g)!;
      expect(new Set(vars).size).toBe(1);
    }
  });

  test("SetHolder get-or-create (Python __getitem__ port)", () => {
    const sh = new SetHolder();
    const v1 = new Variable("a");
    const v2 = new Variable("b");
    sh.get(v1).add(v2);
    expect([...sh.get(v1)].map((v) => v.name).sort()).toEqual(["a", "b"]);
    expect(sh.get(v2)).toBe(sh.get(v1));
    const v3 = new Variable("c");
    expect(sh.get(v3).has(v3)).toBe(true);
  });

  test("PredHolder signature length tracking", () => {
    const ph = new PredHolder();
    ph.append_sig([lexpr("x")]);
    expect(ph.signature_len).toBe(1);
    expect(ph.signatures).toHaveLength(1);
    expect(() => ph.append_sig([lexpr("x"), lexpr("y")])).toThrow(
      "Signature lengths do not match",
    );
  });

  test("get_domain collects constants", () => {
    const names = [...get_domain(lexpr("walk(Bill)"), [lexpr("walk(Socrates)")])]
      .map((v) => v.name)
      .sort();
    expect(names).toEqual(["Bill", "Socrates"]);
  });
});

describe("resolution (pinned vs NLTK 3.10.3)", () => {
  test("clausify structure", () => {
    const c1 = clausify(lexpr("man(x)"));
    expect(c1).toHaveLength(1);
    expect([...c1[0]!]).toHaveLength(1);
    expect(c1[0]!.toString()).toMatch(/^\{man\(z\d+\)\}$/);

    const c2 = clausify(lexpr("(man(x) -> man(x))"));
    expect(c2).toHaveLength(1);
    const lits = c2[0]!.toString();
    expect(lits).toMatch(/^\{-man\(z\d+\), man\(z\d+\)\}$/);
  });

  test("most_general_unification", () => {
    const bd = mostGeneralUnification(lexpr("P(x)"), lexpr("P(john)"));
    expect(bd.toString()).toBe("{x: john}");
  });

  test("UnificationException and DebugObject surfaces", () => {
    expect(new UnificationException(lexpr("x"), lexpr("y"))).toBeInstanceOf(Error);
    const d = new DebugObject(true, 0);
    expect(d.add(1).indent).toBe(1);
    expect(new DebugObject(false, 0).enabled).toBe(false);
  });

  test("ResolutionProver.prove is pure and returns booleans", () => {
    const p1 = lexpr("all x.(man(x) -> mortal(x))");
    const p2 = lexpr("man(Socrates)");
    expect(new ResolutionProver().prove(lexpr("mortal(Socrates)"), [p1, p2])).toBe(true);
    expect(new ResolutionProver().prove(lexpr("mortal(John)"), [p1, p2])).toBe(false);
  });

  test("resolution_test prints Python-style booleans", () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => logs.push(a.join(" "));
    try {
      resolution_test("(man(x) -> man(x))");
    } finally {
      console.log = orig;
    }
    expect(logs[0]).toBe("|- (man(x) -> man(x)): True");
  });
});

describe("tableau (pinned vs NLTK 3.10.3)", () => {
  test("tableau_test prints Python-style booleans", () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => logs.push(a.join(" "));
    try {
      tableau_test("P -> P");
      tableau_test("P & -P");
    } finally {
      console.log = orig;
    }
    expect(logs[0]).toBe(" |- (P -> P): True");
    expect(logs[1]).toBe(" |- (P & -P): False");
  });

  test("TableauDebug indent/add", () => {
    const d = new TableauDebug(true);
    expect(d.indent).toBe(0);
    expect(d.add(2).indent).toBe(2);
    expect(d.verbose).toBe(true);
  });
});

describe("discourse helpers", () => {
  test("load_fol parses fol sentence lines", () => {
    const exprs = load_fol("mortal(Socrates)\nall x.(man(x) -> mortal(x))");
    expect(exprs).toHaveLength(2);
    expect(exprs[0]!.str()).toBe("mortal(Socrates)");
  });

  test("PossibleAntecedents is an Expression list", () => {
    const pa = new PossibleAntecedents();
    expect(Array.isArray(pa)).toBe(true);
  });

  test("AnaphoraBudget tracks operations", () => {
    const b = new AnaphoraBudget(10);
    expect(b.limit).toBe(10);
    expect(MAX_ANAPHORA_OPERATIONS).toBe(1_000_000);
  });
});

describe("api parallel/thread surfaces", () => {
  test("TheoremToolThread runs synchronously and caches result", () => {
    const cmd = { prove: () => true };
    const t = new TheoremToolThread(() => cmd.prove(), false);
    t.start();
    expect(t.result).toBe(true);
  });

  test("ParallelProverBuilder / Command exist", () => {
    expect(typeof ParallelProverBuilder).toBe("function");
    expect(typeof ParallelProverBuilderCommand).toBe("function");
  });
});

describe("external-binary stubs throw", () => {
  test("Prover9 prove requires binary", () => {
    expect(() => lexpr("P(x)")).not.toThrow();
    // Prover9 binary-backed operations throw external errors.
    const pc = new Prover9Command(lexpr("P(x)"), []);
    expect(() => pc.prove()).toThrow();
  });
});
