import { describe, expect, test } from "bun:test";
import {
  ChunkRule,
  ChunkScore,
  ExpandLeftRule,
  ExpandRightRule,
  MergeRule,
  RegexpChunkParser,
  RegexpChunkRule,
  RegexpParser,
  SplitRule,
  StripRule,
  UnChunkRule,
  tag_pattern2re_pattern,
  type ChunkTree,
  type TaggedToken,
} from "../src/chunk_nltk";

// NLTK 3.10.3 oracle pins — nltk.chunk RegexpParser/RegexpChunkParser/ChunkScore

const T = (token: string, tag: string): TaggedToken => ({ token, tag });
const SENT: TaggedToken[] = (
  [
    ["the", "DT"], ["little", "JJ"], ["yellow", "JJ"], ["dog", "NN"],
    ["barked", "VBD"], ["at", "IN"], ["the", "DT"], ["cat", "NN"],
  ] as [string, string][]
).map(([t, g]) => T(t, g));

const NP = (tokens: TaggedToken[]) => ({ label: "NP", children: tokens });

describe("RegexpParser", () => {
  test("doctest grammar parses to oracle tree", () => {
    const p = new RegexpParser("NP: {<DT>?<JJ>*<NN>}");
    expect(p.parse(SENT)).toEqual({
      label: "S",
      children: [
        NP(SENT.slice(0, 4)),
        T("barked", "VBD"),
        T("at", "IN"),
        NP(SENT.slice(6)),
      ],
    });
  });

  test("chink grammar }<VBD|IN>+{ produces same chunks", () => {
    const p = new RegexpParser("NP: {<.*>+}\n      }<VBD|IN>+{");
    expect(p.parse(SENT)).toEqual({
      label: "S",
      children: [
        NP(SENT.slice(0, 4)),
        T("barked", "VBD"),
        T("at", "IN"),
        NP(SENT.slice(6)),
      ],
    });
  });

  test("grammar() returns the input grammar", () => {
    const g = "NP: {<DT>?<JJ>*<NN>}";
    expect(new RegexpParser(g).grammar()).toBe(g);
  });

  test("parse_sents maps over sentences", () => {
    const p = new RegexpParser("NP: {<NN>}");
    const out = p.parse_sents([[T("dog", "NN")], [T("cat", "NN")]]);
    expect(out).toEqual([
      { label: "S", children: [NP([T("dog", "NN")])] },
      { label: "S", children: [NP([T("cat", "NN")])] },
    ]);
  });
});

describe("RegexpChunkRule subclasses", () => {
  const parse = (rules: RegexpChunkRule[], sent: TaggedToken[]) =>
    new RegexpChunkParser(rules).parse(sent);

  test("SplitRule splits a chunk on the NN}{VB boundary", () => {
    const out = parse([new ChunkRule("<.*>+", ""), new SplitRule("<NN.*>", "<VB.*>", "")],
      [T("a", "DT"), T("b", "JJ"), T("c", "NN"), T("d", "VB")]);
    expect(out).toEqual({
      label: "S",
      children: [
        NP([T("a", "DT"), T("b", "JJ"), T("c", "NN")]),
        NP([T("d", "VB")]),
      ],
    });
  });

  test("MergeRule merges adjacent chunks", () => {
    const out = parse(
      [new ChunkRule("<JJ.*>", ""), new ChunkRule("<NN.*>", ""), new MergeRule("<JJ.*>", "<NN.*>", "")],
      [T("a", "JJ"), T("b", "NN")]);
    expect(out).toEqual({ label: "S", children: [NP([T("a", "JJ"), T("b", "NN")])] });
  });

  test("ExpandLeftRule pulls the left tag into the chunk", () => {
    const out = parse([new ChunkRule("<NN.*>", ""), new ExpandLeftRule("<DT>", "<NN.*>", "")],
      [T("a", "DT"), T("b", "NN")]);
    expect(out).toEqual({ label: "S", children: [NP([T("a", "DT"), T("b", "NN")])] });
  });

  test("ExpandRightRule pulls the right tag into the chunk", () => {
    const out = parse([new ChunkRule("<JJ.*>", ""), new ExpandRightRule("<JJ.*>", "<NN.*>", "")],
      [T("a", "JJ"), T("b", "NN")]);
    expect(out).toEqual({ label: "S", children: [NP([T("a", "JJ"), T("b", "NN")])] });
  });

  test("UnChunkRule removes braces from a chunk", () => {
    const out = parse([new ChunkRule("<DT>", ""), new ChunkRule("<NN>", ""), new UnChunkRule("<DT>", "")],
      [T("a", "DT"), T("b", "NN")]);
    expect(out).toEqual({ label: "S", children: [T("a", "DT"), NP([T("b", "NN")])] });
  });

  test("fromstring dispatches on pattern shape", () => {
    expect(RegexpChunkRule.fromstring("{<DT>}")).toBeInstanceOf(ChunkRule);
    expect(RegexpChunkRule.fromstring("}<DT>{")).toBeInstanceOf(StripRule);
    expect(RegexpChunkRule.fromstring("<DT>}{<NN>")).toBeInstanceOf(SplitRule);
    expect(RegexpChunkRule.fromstring("<DT>{}<NN>")).toBeInstanceOf(MergeRule);
    expect(() => RegexpChunkRule.fromstring("")).toThrow(/Illegal chunk pattern/);
    expect(() => RegexpChunkRule.fromstring("<DT>")).toThrow(/Illegal chunk pattern/);
  });
});

describe("tag_pattern2re_pattern", () => {
  test("oracle translations", () => {
    expect(tag_pattern2re_pattern("<DT>?<JJ>*<NN>")).toBe("(<(DT)>)?(<(JJ)>)*(<(NN)>)");
    expect(tag_pattern2re_pattern("<DT|JJ>")).toBe("(<(DT|JJ)>)");
    expect(tag_pattern2re_pattern("<DT><JJ>*")).toBe("(<(DT)>)(<(JJ)>)*");
  });

  test("whitespace is ignored; unescaped . is a single-tag-char wildcard", () => {
    expect(tag_pattern2re_pattern("<D T>")).toBe(tag_pattern2re_pattern("<DT>"));
    expect(tag_pattern2re_pattern(".<NN>")).toBe("[^{}<>](<(NN)>)");
  });

  test("malformed patterns raise", () => {
    for (const bad of ["<DT", "DT>", "<DT>>", "<<DT>"]) {
      expect(() => tag_pattern2re_pattern(bad)).toThrow(/Bad tag pattern/);
    }
  });
});

describe("ChunkScore", () => {
  const gold: ChunkTree = {
    label: "S",
    children: [T("the", "DT"), T("little", "JJ"), NP([T("dog", "NN"), T("barked", "VBD")])],
  };
  const guess: ChunkTree = {
    label: "S",
    children: [T("the", "DT"), NP([T("little", "JJ"), T("dog", "NN")]), T("barked", "VBD")],
  };

  test("oracle metrics", () => {
    const score = new ChunkScore();
    score.score(gold, guess);
    expect(score.accuracy()).toBe(0.25);
    expect(score.precision()).toBe(0);
    expect(score.recall()).toBe(0);
    expect(score.f_measure()).toBe(0);
    expect(score.length).toBe(1);
    expect(score.missed()).toHaveLength(1);
    expect(score.incorrect()).toHaveLength(1);
    expect(score.repr()).toBe("<ChunkScoring of 1 chunks>");
    expect(String(score)).toBe(
      "ChunkParse score:\n    IOB Accuracy:  25.0%\n    Precision:      0.0%\n" +
        "    Recall:         0.0%\n    F-Measure:      0.0%",
    );
  });

  test("perfect score via RegexpParser.evaluate", () => {
    const p = new RegexpParser("NP: {<DT>?<JJ>*<NN>}");
    const goldTree = p.parse(SENT);
    const score = p.evaluate([goldTree]);
    expect(score.precision()).toBe(1);
    expect(score.recall()).toBe(1);
    expect(score.f_measure()).toBe(1);
    expect(score.accuracy()).toBe(1);
    expect(score.repr()).toBe("<ChunkScoring of 2 chunks>");
  });
});
