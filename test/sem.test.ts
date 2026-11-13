import { describe, expect, test } from "bun:test";
import {
  read_valuation, is_rel, set2rel, arity, demo_model0, toCnf, LinearLogicParser,
  list2sym, class_abbrev, rtuple, fromstring, skolemize, SemError, Undefined,
  resetUniqueVariableCounter,
  CooperStore, parse_with_bindops, Boxer, BoxerDrs, DrsDrawer, foldemo,
  hole_readings, Constants, read_sents, interpret_sents,
} from "../index";

// Oracle: test/sem_oracle.py on NLTK 3.10.3 / Python 3.14.4
const VAL = "john => b1\nmary => g1\n# c\ngirl => {g1, g2}\nboy => {b1, b2}\nchase => {(b1, g1), (b2, g1), (g2, d2)}\nwalk => True\n";

describe("nltk.sem.evaluate", () => {
  test("read_valuation parses symbols, sets, tuple-sets and NLTK's 'True'-string quirk", () => {
    const v = read_valuation(VAL);
    expect([...v.domain].sort()).toEqual(["True", "b1", "b2", "d2", "g1", "g2"]);
    expect(v.get("john")).toBe("b1");
    expect(v.get("girl")).toEqual([["g1"], ["g2"]]);
    expect(v.get("chase")).toEqual([["b1", "g1"], ["b2", "g1"], ["g2", "d2"]]);
    expect(v.get("walk")).toBe("True");
  });
  test("read_valuation propagates non-ValueError on missing => (NLTK IndexError quirk)", () => {
    expect(() => read_valuation("bad_line_no_arrow")).toThrow();
    try { read_valuation("bad_line_no_arrow"); } catch (e) {
      expect((e as Error).name).not.toBe("ValueError");
    }
  });
  test("is_rel / set2rel / arity", () => {
    expect(is_rel(new Set())).toBe(true);
    expect(is_rel(new Set([["a"], ["b"]]))).toBe(true);
    try { is_rel(new Set([["a"], ["b", "c"]])); expect.unreachable(); } catch (e) {
      expect((e as Error).name).toBe("ValueError");
    }
    expect([...set2rel(new Set(["a", "b"]))].sort()).toEqual([["a"], ["b"]]);
    // NLTK quirk: ints become bare str(elem), not tuples
    expect([...set2rel(new Set([3, 27]))].sort()).toEqual(["27", "3"]);
    expect(arity(new Set())).toBe(0);
    expect(arity(new Set([["b1", "g1"], ["g2", "d2"]]))).toBe(2);
  });
  test("error types exist", () => {
    expect(new SemError("x").name).toBe("SemError");
    expect(new Undefined("x")).toBeInstanceOf(SemError);
  });
});

describe("nltk.sem.util", () => {
  test("demo_model0 builds NLTK's demo model and evaluates oracle queries", () => {
    const { m0, g0 } = demo_model0();
    expect(m0.evaluate("chase(john,mary)", g0)).toBe(true);
    expect(m0.evaluate("chase(mary,john)", g0)).toBe(false);
    expect(m0.evaluate("exists x. girl(x) & walk(x)", g0)).toBe("Undefined");
    expect([...m0.domain].sort()).toEqual(["b1", "b2", "d1", "d2", "g1", "g2", "n"]);
  });
  test("interpret_sents/evaluate_sents compose over parseSents (stub returns no parses)", () => {
    expect(interpret_sents(["hello"], undefined)).toEqual([[]]);
    expect(read_sents).toBeTypeOf("function");
  });
});

describe("nltk.sem.skolemize", () => {
  test("skolemize + to_cnf match oracle", () => {
    resetUniqueVariableCounter();
    expect(String(skolemize(fromstring("exists x. (dog(x) & bark(x))")))).toBe("(dog(z1) & bark(z1))");
    expect(String(toCnf(fromstring("(P | Q)"), fromstring("R")))).toBe("(P | Q | R)");
  });
});

describe("nltk.sem.linearlogic / relextract / hole", () => {
  test("LinearLogicParser parses implications", () => {
    expect(String(new LinearLogicParser().parse("f -o (g -o h)"))).toBe("(f -o (g -o h))");
  });
  test("relextract helpers match oracle", () => {
    expect(class_abbrev("LOCATION")).toBe("LOC");
    expect(list2sym(["New", "York"])).toBe("new_york");
    expect(rtuple({ untagged_filler: "X", subjclass: "PER", subjtext: "John", subjsym: "john", objclass: "LOC", objtext: "York", objsym: "york", filler: "in" })).toBe("[PER: 'John'] 'in' [LOC: 'York']");
  });
  test("hole Constants and hole_readings exported", () => {
    expect(Constants).toBeTruthy();
    expect(typeof hole_readings).toBe("function");
  });
});

describe("honest gaps", () => {
  test("external/toolchain-bound stubs throw clearly", () => {
    expect(() => new (CooperStore as any)()).toThrow();
    expect(() => (parse_with_bindops as any)()).toThrow();
    expect(() => new (Boxer as any)().interpret("s")).toThrow();
    expect(() => new (DrsDrawer as any)()).toThrow();
    expect(() => foldemo()).toThrow();
  });
});
