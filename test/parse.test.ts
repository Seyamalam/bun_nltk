import { describe, expect, test } from "bun:test";
import {
  DependencyGraph, DependencyEvaluator, taggedsent_to_conll, taggedsents_to_conll,
  SteppingRecursiveDescentParser, InsideChartParser,
  Configuration, CoreNLPServer, find_maltparser, conll_demo, FeatureChart,
} from "../index";

// Oracle: test/parse_oracle.py on NLTK 3.10.3 / Python 3.14.4
const CONLL = "1\tThis\t_\tDT\tDT\t_\t2\ta\t_\t_\n2\tis\t_\tVBZ\tVBZ\t_\t0\tROOT\t_\t_\n3\ta\t_\tDT\tDT\t_\t4\ta\t_\t_\n4\tfoobar\t_\tJJ\tJJ\t_\t2\ta\t_\t_\n";

describe("nltk.parse.util", () => {
  test("taggedsent_to_conll emits 10-column lines", () => {
    const out = [...taggedsent_to_conll([["This", "DT"], ["is", "VBZ"]])];
    expect(out).toEqual([
      "1\tThis\t_\tDT\tDT\t_\t0\ta\t_\t_\n",
      "2\tis\t_\tVBZ\tVBZ\t_\t0\ta\t_\t_\n",
    ]);
  });
  test("taggedsents_to_conll emits blank line after each sentence", () => {
    const out = [...taggedsents_to_conll([[["This", "DT"]], [["a", "DT"]]])];
    expect(out).toEqual([
      "1\tThis\t_\tDT\tDT\t_\t0\ta\t_\t_\n",
      "\n\n",
      "1\ta\t_\tDT\tDT\t_\t0\ta\t_\t_\n",
      "\n\n",
    ]);
  });
});

describe("nltk.parse.dependencygraph", () => {
  test("DependencyGraph loads conll and round-trips all 3 styles", () => {
    const dg = new DependencyGraph(CONLL);
    expect(dg.to_conll(10)).toBe(CONLL);
    expect(dg.to_conll(4)).toBe("This\tDT\t2\ta\nis\tVBZ\t0\tROOT\na\tDT\t4\ta\nfoobar\tJJ\t2\ta\n");
    expect(dg.to_conll(3)).toBe("This\tDT\t2\nis\tVBZ\t0\na\tDT\t4\nfoobar\tJJ\t2\n");
  });
  test("triples yields ((word,ctag), rel, [(dep word,ctag)])", () => {
    const dg = new DependencyGraph(CONLL);
    expect([...dg.triples()]).toEqual([
      [["is", "VBZ"], "a", [["This", "DT"]]],
      [["is", "VBZ"], "a", [["foobar", "JJ"]]],
      [["foobar", "JJ"], "a", [["a", "DT"]]],
    ]);
  });
  test("contains_cycle dict-deps quirk: conll-loaded cycles report falsy", () => {
    const dg = new DependencyGraph(CONLL);
    expect(dg.contains_cycle()).toBeFalsy();
    const cyc = new DependencyGraph("1\ta\t_\tX\tX\t_\t2\tx\t_\t_\n2\tb\t_\tX\tX\t_\t1\tx\t_\t_");
    expect(cyc.contains_cycle()).toBeFalsy(); // NLTK 3.10.3 dict-deps iteration quirk
  });
});

describe("nltk.parse.evaluate", () => {
  test("DependencyEvaluator returns (LAS, UAS) matching oracle", () => {
    const dg = new DependencyGraph(CONLL);
    expect(new DependencyEvaluator([dg], [dg]).eval()).toEqual([1, 1]);
    const c2 = new DependencyGraph(CONLL.replace("_\t2\ta", "_\t4\ta"));
    expect(new DependencyEvaluator([c2], [dg]).eval()).toEqual([0.75, 0.75]);
    expect(() => new DependencyEvaluator([dg], [dg, dg]).eval()).toThrow(
      "Number of parsed sentences is different from number of gold sentences.",
    );
  });
});

describe("honest gaps", () => {
  test("unported machinery and external wrappers throw clearly", () => {
    expect(() => new (SteppingRecursiveDescentParser as any)()).toThrow();
    expect(() => new (InsideChartParser as any)()).toThrow();
    expect(() => new (Configuration as any)()).toThrow();
    expect(() => new (CoreNLPServer as any)()).toThrow();
    expect(() => new (FeatureChart as any)()).toThrow();
    expect(find_maltparser).toThrow();
    expect(conll_demo).toThrow();
  });
});
