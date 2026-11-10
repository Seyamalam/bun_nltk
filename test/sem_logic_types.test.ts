import { describe, expect, test } from "bun:test";
import { Counter } from "../src/internals";
import { Trie } from "../src/collections";
import {
  ANY_TYPE,
  ENTITY_TYPE,
  EVENT_TYPE,
  TRUTH_TYPE,
  Expression,
  LogicParser,
  Type,
  Variable,
  VariableExpression,
  binding_ops,
  boolean_ops,
  demoException,
  equality_preds,
  printtype,
  read_logic,
  read_type,
  semLogicDemo,
  semLogicDemoErrors,
  skolem_function,
  typecheck,
  unique_variable,
  resetUniqueVariableCounter,
  LogicalExpressionException,
  IllegalTypeException,
  InconsistentTypeHierarchyException,
  TypeException,
} from "../src/sem_logic";

// Pinned against NLTK 3.10.3 (see test/sem_logic_oracle.py).

function capture(fn: () => void): string {
  const orig = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return lines.join("\n") + "\n";
}

const sig = (o: Record<string, Type>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v}`]));

describe("nltk.sem.logic Type hierarchy + read_type", () => {
  test("read_type parses all NLTK forms", () => {
    expect(`${read_type("e")}`).toBe("e");
    expect(read_type("e").str()).toBe("IND");
    expect(`${read_type("t")}`).toBe("t");
    expect(read_type("t").str()).toBe("BOOL");
    expect(`${read_type("?")}`).toBe("?");
    expect(read_type("?").str()).toBe("ANY");
    expect(`${read_type("<e,t>")}`).toBe("<e,t>");
    expect(read_type("<e,t>").str()).toBe("(IND -> BOOL)");
    expect(`${read_type("<e,<t,e>>")}`).toBe("<e,<t,e>>");
    expect(read_type("<e,<t,e>>").str()).toBe("(IND -> (BOOL -> IND))");
    expect(`${read_type("<<e,t>,e>")}`).toBe("<<e,t>,e>");
    expect(read_type("<<e,t>,e>").str()).toBe("((IND -> BOOL) -> IND)");
    expect(`${read_type("<e, t>")}`).toBe("<e,t>");
  });

  test("read_type quirks: only first char decides for atoms", () => {
    expect(`${read_type("e,t")}`).toBe("e");
    expect(`${read_type("<e,t,z>")}`).toBe("<e,t>");
    expect(`${read_type("<ee,t>")}`).toBe("<e,t>");
  });

  test("read_type errors: 'v'/'x' LogicalExpressionException; asserts/IndexError elsewhere", () => {
    expect(() => read_type("v")).toThrow(LogicalExpressionException);
    expect(() => read_type("v")).toThrow("Unexpected character: 'v'.");
    expect(() => read_type("x")).toThrow("Unexpected character: 'x'.");
    for (const s of ["<e,t", "<e>", "<>"]) {
      try {
        read_type(s);
        expect.unreachable();
      } catch (e) {
        expect((e as Error).name).toBe("AssertionError");
      }
    }
    try {
      read_type("");
      expect.unreachable();
    } catch (e) {
      expect((e as Error).name).toBe("IndexError");
      expect((e as Error).message).toBe("string index out of range");
    }
  });

  test("Type equality/matches/resolve pinned", () => {
    const a = read_type("<e,t>");
    const b = read_type("<e,t>");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(read_type("e"))).toBe(false);
    expect(read_type("?").equals(read_type("?"))).toBe(true);
    expect(read_type("e").equals(read_type("?"))).toBe(false);
    expect(read_type("?").equals(read_type("e"))).toBe(false);
    expect(read_type("?").equals(a)).toBe(false);
    expect(a.equals(read_type("?"))).toBe(false);
    expect(a.matches(read_type("?"))).toBe(true);
    expect(read_type("e").matches(read_type("?"))).toBe(true);
    expect(a.matches(read_type("<e,?>"))).toBe(true);
    expect(`${read_type("<e,?>").resolve(a)}`).toBe("<e,t>");
    expect(read_type("e").resolve(read_type("t"))).toBe(null);
    expect(`${read_type("?").resolve(a)}`).toBe("<e,t>");
    expect(`${Type.fromstring("<e,t>")}`).toBe("<e,t>");
  });

  test("singletons: TRUTH/ENTITY/EVENT/ANY str forms", () => {
    expect(`${TRUTH_TYPE}`).toBe("t");
    expect(`${ENTITY_TYPE}`).toBe("e");
    expect(`${EVENT_TYPE}`).toBe("v");
    expect(`${ANY_TYPE}`).toBe("?");
    expect(TRUTH_TYPE.str()).toBe("BOOL");
    expect(ENTITY_TYPE.str()).toBe("IND");
    expect(EVENT_TYPE.str()).toBe("EVENT");
    expect(ANY_TYPE.str()).toBe("ANY");
    // AnyType's first/second are itself (NLTK property quirk)
    expect(ANY_TYPE.first).toBe(ANY_TYPE);
    expect(ANY_TYPE.second).toBe(ANY_TYPE);
  });
});

describe("nltk.sem.logic typecheck", () => {
  test("signatures pinned", () => {
    expect(sig(typecheck([Expression.fromstring("P(x) & Q(y)")]))).toEqual({
      x: "e",
      P: "<e,t>",
      y: "e",
      Q: "<e,t>",
    });
    expect(
      sig(typecheck([Expression.fromstring("walks(x)"), Expression.fromstring("runs(x)")])),
    ).toEqual({ x: "e", walks: "<e,?>", runs: "<e,?>" });
    expect(sig(typecheck([Expression.fromstring("P(x)")], { P: "<e,t>" }))).toEqual({
      P: "<e,t>",
      x: "e",
    });
    expect(sig(typecheck([Expression.fromstring("x = y")]))).toEqual({ x: "e", y: "e" });
    expect(sig(typecheck([Expression.fromstring("P(x) & x=y & P(y)")]))).toEqual({
      x: "e",
      P: "<e,t>",
      y: "e",
    });
  });

  test("signature Type objects accepted as well as strings", () => {
    expect(sig(typecheck([Expression.fromstring("P(x)")], { P: read_type("<e,t>") }))).toEqual({
      P: "<e,t>",
      x: "e",
    });
  });

  test("curried multi-arg predicates grow their type without error", () => {
    expect(() => typecheck([Expression.fromstring("P(x)"), Expression.fromstring("P(x,y)")])).not.toThrow();
  });

  test("entity-typed constants re-type silently (NLTK quirk)", () => {
    expect(() => new LogicParser(true).parse("P(Q)")).not.toThrow();
    expect(() => new LogicParser(true).parse("man(x) & john")).not.toThrow();
  });

  test("errors: bad signature / illegal / inconsistent / truth-func", () => {
    expect(() => typecheck([Expression.fromstring("P(x)")], { x: "<e,t>" })).toThrow(
      IllegalTypeException,
    );
    expect(() => typecheck([Expression.fromstring("P(x)")], { x: "<e,t>" })).toThrow(
      "Cannot set type of IndividualVariableExpression 'x' to '<e,t>'; must match type 'e'.",
    );
    expect(() => new LogicParser(true).parse("x(y)")).toThrow(LogicalExpressionException);
    expect(() => new LogicParser(true).parse("x(y)")).toThrow(
      "'x' is an illegal predicate name.  Individual variables may not be used as predicates.",
    );
    expect(() => new LogicParser(true).parse("(P(x) & Q(x))(y)")).toThrow(
      "The function '(P(x) & Q(x))' is not a Lambda Expression, an Application Expression, or a functional predicate, so it may not take arguments.",
    );
    expect(() =>
      Expression.fromstring("P(x)", true, { P: "<t,e>" }),
    ).toThrow(InconsistentTypeHierarchyException);
    expect(() =>
      Expression.fromstring("P(x)", true, { P: "<t,e>" }),
    ).toThrow("The variable 'P' was found in multiple places with different types.");
    expect(() => new LogicParser(true).parse("P(x) & x = P")).toThrow(
      InconsistentTypeHierarchyException,
    );
    // Applying a lambda to another lambda surfaces the TypeException wrapper
    try {
      typecheck([Expression.fromstring("(\\x.x)(\\z.z)")]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TypeException);
      expect((e as Error).message).toBe(
        "The function '\\x.x' is of type '<e,e>' and cannot be applied to '\\z.z' of type '<e,e>'.  Its argument must match type 'e'.",
      );
    }
  });

  test("LogicParser(type_check=True) result types pinned", () => {
    const tp = new LogicParser(true);
    expect(`${tp.parse("see(john,mary)").type}`).toBe("?");
    expect(`${tp.parse("\\x.P(x)").type}`).toBe("<e,?>");
    expect(`${tp.parse("exists x.man(x)").type}`).toBe("t");
    expect(`${tp.parse("-P(x)").type}`).toBe("t");
    expect(`${tp.parse("(x=y)").type}`).toBe("t");
  });
});

describe("nltk.sem.logic findtype / variables / visit", () => {
  test("findtype pinned", () => {
    const app = Expression.fromstring("P(x)");
    expect(`${app.findtype(new Variable("P"))}`).toBe("?");
    expect(`${app.findtype(new Variable("x"))}`).toBe("e");
    expect(`${app.findtype(new Variable("z"))}`).toBe("?");
    const binder = Expression.fromstring("\\x.P(x)");
    expect(`${binder.findtype(new Variable("x"))}`).toBe("?");
    expect(`${binder.findtype(new Variable("P"))}`).toBe("?");
    const neg = Expression.fromstring("-(P(x) & Q(y))");
    expect(`${neg.findtype(new Variable("P"))}`).toBe("?");
    const both = Expression.fromstring("(P(x) & Q(x))");
    expect(`${both.findtype(new Variable("x"))}`).toBe("e");
    expect(`${Expression.fromstring("\\x.P(x)").type}`).toBe("<e,?>");
  });

  test("variables() includes free vars + ?/@-prefixed predicates/constants", () => {
    const names = (e: Expression) => [...e.variables()].map((v) => v.name).sort();
    expect(names(Expression.fromstring("@P(x)"))).toEqual(["@P", "x"]);
    expect(names(Expression.fromstring("P(x) & exists y.Q(y)"))).toEqual(["P", "Q", "x"]);
  });

  test("visit / visit_structured / leaf visit NotImplementedError", () => {
    const sub = Expression.fromstring("P(x) & Q(y)");
    expect(sub.visit((e) => e.constructor.name, (parts) => parts)).toEqual([
      "ApplicationExpression",
      "ApplicationExpression",
    ]);
    const lam = Expression.fromstring("\\x.P(x)");
    const rebuilt = lam.visitStructured((e) => e.simplify(), (v, t) => {
      const cls = lam.constructor as new (v: Variable, t: Expression) => Expression;
      return new cls(v as Variable, t as Expression);
    });
    expect(`${rebuilt}`).toBe("\\x.P(x)");
    try {
      Expression.fromstring("x").visit((e) => e, (p) => p);
      expect.unreachable();
    } catch (e) {
      expect((e as Error).name).toBe("NotImplementedError");
    }
  });
});

describe("nltk.sem.logic skolem/read_logic/VariableExpression/unique vars", () => {
  test("skolem_function pinned", () => {
    resetUniqueVariableCounter();
    expect(`${skolem_function()}`).toBe("F1");
    expect(`${skolem_function([new Variable("x"), new Variable("y")])}`).toBe("F2(x,y)");
    expect(`${unique_variable()}`).toBe("z3");
  });

  test("read_logic skips comments/blanks; parse failure -> ValueError", () => {
    const stmts = read_logic("# header\nman(x)\n\nwalks(john)\n");
    expect(stmts.map((s) => s.repr())).toEqual([
      "<ApplicationExpression man(x)>",
      "<ApplicationExpression walks(john)>",
    ]);
    try {
      read_logic("man(x\n");
      expect.unreachable();
    } catch (e) {
      expect((e as Error).name).toBe("ValueError");
      expect((e as Error).message).toBe("Unable to parse line 0: man(x");
    }
  });

  test("VariableExpression factory dispatches by variable lexical class", () => {
    expect(VariableExpression(new Variable("x")).constructor.name).toBe(
      "IndividualVariableExpression",
    );
    expect(VariableExpression(new Variable("P")).constructor.name).toBe(
      "FunctionVariableExpression",
    );
    expect(VariableExpression(new Variable("e0")).constructor.name).toBe(
      "EventVariableExpression",
    );
    expect(VariableExpression(new Variable("john")).constructor.name).toBe("ConstantExpression");
  });
});

describe("nltk.sem.logic print functions + error surface", () => {
  test("ops tables pinned verbatim", () => {
    expect(capture(boolean_ops)).toBe(
      "negation       \t-\nconjunction    \t&\ndisjunction    \t|\nimplication    \t->\nequivalence    \t<->\n",
    );
    expect(capture(equality_preds)).toBe("equality       \t=\ninequality     \t!=\n");
    // NLTK quirk: binding_ops zips 3 names with 4 tokens — iota never prints
    expect(capture(binding_ops)).toBe("existential    \texists\nuniversal      \tall\nlambda         \t\\\n");
  });

  test("printtype preserves the NLTK 3.10.3 AttributeError (calls ex.str())", () => {
    expect(() => printtype(Expression.fromstring("P(x)"))).toThrow(
      "AttributeError: 'ApplicationExpression' object has no attribute 'str'",
    );
  });

  test("demoException renders exception class + caret-marked input", () => {
    expect(capture(() => demoException("(P(x) & Q(x)"))).toBe(
      "LogicalExpressionException: End of input found.  Expected token ')'.\n(P(x) & Q(x)\n            ^\n",
    );
    expect(capture(() => demoException("P(x)Q(x)"))).toBe(
      "LogicalExpressionException: Unexpected token: 'Q'.\nP(x)Q(x)\n    ^\n",
    );
  });

  test("parse depth guard + empty-input caret", () => {
    try {
      new LogicParser().parse("(" + "(".repeat(249) + "x" + ")".repeat(250));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain(
        "Expression nesting exceeds the maximum depth (200).",
      );
    }
    try {
      new LogicParser().parse("");
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toBe("End of input found.  Expression expected.\n\n^");
    }
  });

  test("Counter auto-increments on get()", () => {
    const c = new Counter();
    expect([c.get(), c.get(), c.get()]).toEqual([1, 2, 3]);
    const c10 = new Counter(10);
    expect([c10.get(), c10.get()]).toEqual([11, 12]);
  });

  test("Trie matches nltk.collections.Trie semantics", () => {
    const t = new Trie(["apple", "apply", "ape"]);
    // oracle: trie={'a': {'p': {'p': {'l': {'e': {True: None}, 'y': {True: None}}}, 'e': {True: None}}}}
    const a = t.get("a") as Trie;
    const p = a.get("p") as Trie;
    const pp = p.get("p") as Trie;
    expect(pp.has("l")).toBe(true);
    expect((p.get("e") as Trie).has(Trie.LEAF)).toBe(true);
    expect(((pp.get("l") as Trie).get("y") as Trie).get(Trie.LEAF)).toBeNull();

    // oracle: trie-copy-type=dict — copy() returns a plain dict, not a Trie
    const copied = t.copy();
    expect(copied instanceof Map).toBe(true);
    expect(copied instanceof Trie).toBe(false);

    // oracle: trie-fromkeys=({'ab': 0, 'cd': 0}, 'Trie')
    const fk = Trie.fromkeys(["ab", "cd"], 0);
    expect(fk instanceof Trie).toBe(true);
    expect(fk.get("ab")).toBe(0);
    expect(fk.get("cd")).toBe(0);

    // oracle: trie-pop-a={} then trie-popitem=('a', {'b': {True: None}})
    t.pop("a");
    expect(t.size).toBe(0);
    const popped = Trie.prototype.popitem.call(new Trie(["ab"]));
    expect(popped[0]).toBe("a");
    expect((popped[1] as Trie).has("b")).toBe(true);

    // oracle: KeyError surfaces for empty pop/popitem
    expect(() => new Trie().pop("x")).toThrowError(/x/);
    expect(() => new Trie().popitem()).toThrowError(/popitem\(\): dictionary is empty/);
    try {
      new Trie().pop("x");
      expect.unreachable();
    } catch (e) {
      expect((e as Error).name).toBe("KeyError");
    }

    // oracle: trie-insert={'h': {'i': {True: None}}}; trie-leaf=True
    const t4 = new Trie();
    t4.insert("hi");
    expect((t4.get("h") as Trie).has("i")).toBe(true);
    expect(((t4.get("h") as Trie).get("i") as Trie).get(Trie.LEAF)).toBeNull();
    expect(Trie.LEAF).toBe(true);

    // oracle: trie-setdefault=(7, 7); trie-update=9
    const t5 = new Trie(["abc"]);
    expect(t5.setdefault("b", 7)).toBe(7);
    expect(t5.get("b")).toBe(7);
    t5.update({ z: 9 });
    expect(t5.get("z")).toBe(9);
    expect(t5.hasWord("abc")).toBe(true);
    expect(t5.hasWord("ab")).toBe(false);
  });
});

describe("nltk.sem.logic demo outputs pinned verbatim", () => {
  test("demo() output", () => {
    expect(capture(semLogicDemo)).toBe(
      "====================Test reader====================\n" +
        "john\nman(x)\n-man(x)\n(man(x) & tall(x) & walks(x))\nexists x.(man(x) & tall(x) & walks(x))\n" +
        "\\x.man(x)\n\\x.man(x)(john)\n\\x y.sees(x,y)\n((\\x y.sees(x,y))(a))(b)\n(\\x.exists y.walks(x,y))(x)\n" +
        "exists x.(x = y)\nexists x.(x = y)\n(P(x) & (x = y) & P(y))\n\\P Q.exists x.(P(x) & Q(x))\n(man(x) <-> tall(x))\n" +
        "====================Test simplify====================\n" +
        "sees(john,mary)\nsees(john,mary)\nall x.(man(x) & exists y.walks(x,y))\nexists x.(dog(x) & bark(x))\n" +
        "====================Test alpha conversion and binder expression equality====================\n" +
        "exists x.P(x)\nexists z.P(z)\nTrue\n",
    );
  });

  test("demo_errors() output", () => {
    expect(capture(semLogicDemoErrors)).toBe(
      "====================Test reader errors====================\n" +
        "LogicalExpressionException: End of input found.  Expected token ')'.\n(P(x) & Q(x)\n            ^\n" +
        "LogicalExpressionException: Unexpected token: ')'.  Expression expected.\n((P(x) &) & Q(x))\n        ^\n" +
        "LogicalExpressionException: End of input found.  Expression expected.\nP(x) ->\n       ^\n" +
        "LogicalExpressionException: End of input found.  Expected token ')'.\nP(x\n   ^\n" +
        "LogicalExpressionException: End of input found.  Expression expected.\nP(x,\n    ^\n" +
        "LogicalExpressionException: Unexpected token: ')'.  Expression expected.\nP(x,)\n    ^\n" +
        "LogicalExpressionException: End of input found.  Variable and Expression expected following quantifier 'exists'.\nexists\n       ^\n" +
        "LogicalExpressionException: End of input found.  Expression expected.\nexists x.\n         ^\n" +
        "LogicalExpressionException: End of input found.  Variable and Expression expected following lambda operator.\n\\\n  ^\n" +
        "LogicalExpressionException: End of input found.  Expression expected.\n\\ x y.\n      ^\n" +
        "LogicalExpressionException: Unexpected token: 'Q'.\nP(x)Q(x)\n    ^\n" +
        "LogicalExpressionException: Unexpected token: 'Q'.  Expected token ')'.\n(P(x)Q(x)\n     ^\n" +
        "LogicalExpressionException: Unexpected token: '->'.  Expression expected.\nexists x -> y\n         ^\n",
    );
  });
});
