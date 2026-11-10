import { describe, expect, test } from "bun:test";
import {
  Pos,
  Word,
  Template,
  TblRule as Rule,
  TagRule,
  clearTemplateRegistry,
} from "../src/brill_tagger";
import { errorList } from "../src/tbl_erroranalysis";
import { corpusSize, postag } from "../src/tbl_demo";

// Pinned against NLTK 3.10.3 (see test/tbl_oracle.py).

describe("tbl Feature (nltk.tbl.feature.Feature)", () => {
  test("positions sorted/deduped; two-arg interval form", () => {
    expect([...new Word([2, -1, -1]).positions]).toEqual([-1, 2]);
    expect([...new Pos(-3, -1).positions]).toEqual([-3, -2, -1]);
    expect(() => new Pos(2, 1)).toThrow("illegal interval specification: (start=2, end=1)");
  });

  test("expand windows + excludezero + winlen error", () => {
    expect(Word.expand([-3, -2, -1], [1, 2]).map((f) => f.repr())).toEqual([
      "Word([-3])", "Word([-2])", "Word([-1])", "Word([-3, -2])", "Word([-2, -1])",
    ]);
    expect(Word.expand([-2, -1, 0], [1, 2], true).map((f) => f.repr())).toEqual([
      "Word([-2])", "Word([-1])", "Word([-2, -1])",
    ]);
    expect(() => Word.expand([-2, -1], [0])).toThrow("non-positive window length in [0]");
  });

  test("issuperset/intersects require the same subclass", () => {
    expect(new Word([-3, -2, -1]).issuperset(new Word([-3, -2]))).toBe(true);
    expect(new Word([-3, -2, -1]).issuperset(new Word([-3, -2, 0]))).toBe(false);
    expect(new Word([-3, -2, -1]).issuperset(new Pos([-3, -2]))).toBe(false);
    expect(new Word([-3, -2, -1]).intersects(new Word([-3, -2]))).toBe(true);
    expect(new Word([-3, -2, -1]).intersects(new Word([0]))).toBe(false);
    expect(new Word([-3, -2, -1]).intersects(new Pos([-3, -2]))).toBe(false);
  });

  test("nltk __lt__ quirk: name-a < name-b OR positions-a < positions-b", () => {
    expect(new Word([0]).lt(new Pos([5]))).toBe(true);
    expect(new Pos([0]).lt(new Word([5]))).toBe(true);
    expect(new Word([5]).lt(new Pos([0]))).toBe(false);
    expect(new Pos([5]).lt(new Word([0]))).toBe(true);
  });

  test("json encode/decode roundtrip", () => {
    expect(new Word([-2, -1]).encodeJsonObj()).toEqual([-2, -1]);
    expect(Word.decodeJsonObj([-2, -1]).repr()).toBe("Word([-2, -1])");
  });
});

describe("tbl Rule (nltk.tbl.rule.Rule)", () => {
  const rule = new Rule("023", "VB", "NN", [[new Pos([-2, -1]), "DT"]]);
  const toks: Array<[string, string]> = [["the", "DT"], ["dog", "NN"], ["sat", "VB"]];

  test("repr/str/verbose formats pinned", () => {
    expect(rule.repr()).toBe("Rule('023', 'VB', 'NN', [(Pos([-2, -1]),'DT')])");
    expect(rule.format("str")).toBe("VB->NN if Pos:DT@[-2,-1]");
    expect(rule.format("repr")).toBe("Rule('023', 'VB', 'NN', [(Pos([-2, -1]),'DT')])");
    expect(rule.format("verbose")).toBe('VB -> NN if the Pos of words i-2...i-1 is "DT"');
    expect(() => rule.format("bogus")).toThrow("unknown rule format spec: bogus");
  });

  test("empty-conditions str quirk keeps trailing 'if '", () => {
    const r = new Rule("001", "NN", "VB", []);
    expect(r.format("str")).toBe("NN->VB if ");
    expect(r.repr()).toBe("Rule('001', 'NN', 'VB', [])");
    expect(r.format("verbose")).toBe("NN -> VB");
  });

  test("applies (AND over conditions, OR over positions) and apply mutates in a second pass", () => {
    expect([0, 1, 2].map((i) => rule.applies(toks, i))).toEqual([false, false, true]);
    const sent: Array<[string, string]> = toks.map((t) => [...t] as [string, string]);
    expect(rule.apply(sent)).toEqual([2]);
    expect(sent).toEqual([["the", "DT"], ["dog", "NN"], ["sat", "NN"]]);
  });

  test("json encode/decode", () => {
    expect(rule.encodeJsonObj()).toEqual({
      templateid: "023", original: "VB", replacement: "NN",
      conditions: [[new Pos([-2, -1]), "DT"]],
    });
    expect(Rule.decodeJsonObj(rule.encodeJsonObj()).repr()).toBe(rule.repr());
  });

  test("TagRule base throws TypeError on comparison like nltk", () => {
    const r1 = new Rule("1", "A", "B", []);
    const r2 = new Rule("1", "A", "B", []);
    expect(r1.equals(r2)).toBe(true);
    expect(() => TagRule.prototype.equals.call(r1, r2)).toThrow("Rules must implement __eq__()");
    expect(() => TagRule.prototype.nequals.call(r1, r2)).toThrow("Rules must implement __ne__()");
    expect(() => TagRule.prototype.hash.call(r1)).toThrow("Rules must implement __hash__()");
  });
});

describe("tbl Template (nltk.tbl.template.Template)", () => {
  const toks: Array<[string, string]> = [["the", "DT"], ["dog", "NN"], ["sat", "VB"]];

  test("registry ids, repr, neighborhood, applicable_rules", () => {
    clearTemplateRegistry();
    const t = new Template(new Pos([-1]), new Pos([1]));
    expect(t.repr()).toBe("Template(Pos([-1]),Pos([1]))");
    expect(t.id).toBe("000");
    expect(t.getNeighborhood(toks, 1)).toEqual([0, 1, 2]);
    expect(t.applicableRules(toks, 1, "JJ").map((r) => r.repr())).toEqual([
      "Rule('000', 'NN', 'JJ', [(Pos([-1]),'DT'), (Pos([1]),'VB')])",
    ]);
    expect(t.applicableRules(toks, 1, "NN")).toEqual([]);
  });

  test("expand docstring pins", () => {
    clearTemplateRegistry();
    expect(
      Template.expand([[new Word([0])], [new Pos([-2])]]).map((t) => t.repr()),
    ).toEqual(["Template(Word([0]))", "Template(Pos([-2]))", "Template(Pos([-2]),Word([0]))"]);
    clearTemplateRegistry();
    expect(
      Template.expand([[new Word([0]), new Word([0, 1])], [new Pos([-2])]]).map((t) => t.repr()),
    ).toEqual([
      "Template(Word([0]))", "Template(Word([0, 1]))", "Template(Pos([-2]))",
      "Template(Pos([-2]),Word([0]))", "Template(Pos([-2]),Word([0, 1]))",
    ]);
  });

  test("deprecated Feature-class ctor form + TypeError", () => {
    clearTemplateRegistry();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = new (Template as any)(Word, [-2, -1], [0, 0]);
    expect(t.repr()).toBe("Template(Word([-2, -1]),Word([0]))");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => new (Template as any)(Word, [-2, -1], Pos, [0, 0])).toThrow(
      "expected either Feature1(args), Feature2(args), ... or Feature, (start1, end1), (start2, end2), ...",
    );
  });
});

describe("tbl demo helpers (nltk.tbl.demo/erroranalysis)", () => {
  test("corpus_size", () => {
    expect(corpusSize([[1, 2, 3], [4, 5]])).toEqual([2, 5]);
    expect(corpusSize([])).toEqual([0, 0]);
  });

  test("error_list pinned layout", () => {
    const gold: [string, string][][] = [
      [["a", "X"], ["b", "Y"]],
      [["c", "Z"]],
    ];
    const testS: [string, string][][] = [
      [["a", "X"], ["b", "Q"]],
      [["c", "R"]],
    ];
    expect(errorList(gold, testS)).toEqual([
      "             left context |    word/test->gold     | right context\n--------------------------+------------------------+--------------------------",
      "                      a/X |         b/Q->Y         | ",
      "                          |         c/R->Z         | ",
    ]);
  });

  test("postag end-to-end pins (baseline acc, learned rules, brill acc)", () => {
    const trainData: [string, string][][] = [
      [["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"], [".", "."]],
      [["a", "DT"], ["dog", "NN"], ["barks", "VBZ"], [".", "."]],
      [["the", "DT"], ["dog", "NN"], ["runs", "VBZ"], ["fast", "RB"], [".", "."]],
      [["she", "PRP"], ["reads", "VBZ"], ["a", "DT"], ["book", "NN"], [".", "."]],
      [["they", "PRP"], ["book", "VB"], ["a", "DT"], ["table", "NN"], [".", "."]],
      [["he", "PRP"], ["will", "MD"], ["book", "VB"], ["flights", "NNS"], [".", "."]],
      [["i", "PRP"], ["read", "VBP"], ["the", "DT"], ["book", "NN"], [".", "."]],
      [["we", "PRP"], ["dance", "VBP"], ["every", "DT"], ["night", "NN"], [".", "."]],
      [["music", "NN"], ["makes", "VBZ"], ["people", "NNS"], ["dance", "VB"], [".", "."]],
    ];
    const templates = [
      new Template(new Pos([-1])), new Template(new Pos([1])),
      new Template(new Pos([-2, -1])), new Template(new Pos([1, 2])),
    ];
    const out = postag({
      templates, taggedData: trainData, numSents: 9, train: 0.8,
      maxRules: 10, minScore: 2, trace: 0,
    });
    expect(out.baselineAccuracy).toBeCloseTo(0.4);
    expect(out.brillAccuracy).toBeCloseTo(0.4);
    // nltk learned 'NN->VB if Pos:PRP@[-2,-1]' (templateid differs by registry).
    expect(out.tagger.rules().map((r) => `${r.originalTag}->${r.replacementTag} if ${r.conditions.map(([f, v]) => `${f.propertyName()}:${v}@[${f.positions.join(",")}]`).join(" & ")}`))
      .toEqual(["NN->VB if Pos:PRP@[-2,-1]"]);
  });

  test("postag unsupported paths throw", () => {
    expect(() => postag()).toThrow("treebank");
    expect(() => postag({ taggedData: [], serializeOutput: "x" })).toThrow("pickle");
    expect(() => postag({ taggedData: [], learningCurveOutput: "x" })).toThrow("matplotlib");
    expect(() => postag({ taggedData: [], incrementalStats: true })).toThrow("batch_tag_incremental");
  });
});
