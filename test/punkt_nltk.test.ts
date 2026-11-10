import { describe, expect, test } from "bun:test";
import {
  format_debug_decision,
  PunktLanguageVars,
  PunktParameters,
  PunktSentenceTokenizer,
  PunktToken,
  PunktTokenizer,
  PunktTrainer,
} from "../index";

// punkt-differential: values pinned against Python NLTK 3.10.3 (test/punkt_nltk_oracle.py).

describe("PunktLanguageVars", () => {
  test("word_tokenize matches NLTK", () => {
    const lv = new PunktLanguageVars();
    expect(lv.word_tokenize("Good muffins cost $3.88 in N.Y.")).toEqual([
      "Good", "muffins", "cost", "$3.88", "in", "N.Y.",
    ]);
  });
});

describe("PunktToken", () => {
  test("derived properties match NLTK", () => {
    const t = new PunktToken("Mr.");
    expect(t.type).toBe("mr.");
    expect(t.period_final).toBe(true);
    expect(t.is_initial).toBe(false); // re.match anchors at start: 'Mr.' is not initial
    expect(new PunktToken("J.").is_initial).toBe(true);
    expect(new PunktToken("3.14").type).toBe("##number##");
    expect(new PunktToken("a..").is_ellipsis).toBe(false); // anchored match
    expect(new PunktToken("..").is_ellipsis).toBe(true);
    expect(String(new PunktToken("x.", { abbr: true, sentbreak: true }))).toBe("x.<A><S>");
  });
});

describe("PunktSentenceTokenizer", () => {
  test("untrained tokenize matches NLTK", () => {
    const pst = new PunktSentenceTokenizer();
    expect(pst.tokenize("See example 1. It is a test.")).toEqual([
      "See example 1.", "It is a test.",
    ]);
  });

  test("trained params split like NLTK", () => {
    const trainer = new PunktTrainer();
    trainer.INCLUDE_ALL_COLLOCS = true;
    trainer.train("Mr. Smith bought several books. Mrs. Jones went home. He ran.");
    const params = trainer.get_params();
    expect([...params.abbrev_types].sort()).toEqual([]);
    const pst = new PunktSentenceTokenizer(params);
    expect(pst.tokenize("Mr. Smith went. He left.")).toEqual([
      "Mr.", "Smith went.", "He left.",
    ]);
    expect(params.ortho_context.get("smith")).toBe(2);
    expect(params.ortho_context.get("mr")).toBe(8);
  });

  test("Mr. is not treated as an initial (re.match anchor semantics)", () => {
    const pst = new PunktSentenceTokenizer();
    expect(pst.text_contains_sentbreak("Mr. Smith")).toBe(true);
  });
});

describe("PunktTokenizer (pretrained)", () => {
  const hasPunkt = (() => {
    try {
      require("node:fs").accessSync(`${process.env.NLTK_DATA ?? ".cache/nltk-data"}/tokenizers/punkt_tab/english/abbrev_types.txt`);
      return true;
    } catch {
      return false;
    }
  })();

  test.skipIf(!hasPunkt)("english model tokenize/spans/debug match NLTK", () => {
    const pt = new PunktTokenizer("english");
    expect(pt.tokenize("See example 1. It is a test. Mr. Smith went home.")).toEqual([
      "See example 1.", "It is a test.", "Mr. Smith went home.",
    ]);
    expect(pt.spanTokenize("See example 1. It is a test.")).toEqual([[0, 14], [15, 28]]);
    const d = [...pt.debug_decisions("See example 1. It went.")][0]!;
    expect(d["type1"]).toBe("##number##");
    expect(d["type2"]).toBe("it");
    expect(d["break_decision"]).toBe(true);
    expect(d["reason"]).toBe("default decision");
    const fmt = format_debug_decision(d);
    expect(fmt).toContain("Text: '1. It' (at offset 13)");
    expect(fmt).toContain("Sentence break? True (default decision)");
    expect(fmt).toContain("orthographic heuristic suggests is a sentence starter? unknown");
  });
});

describe("PunktParameters", () => {
  test("clear/add ortho context helpers", () => {
    const p = new PunktParameters();
    p.add_ortho_context("x", 2);
    p.add_ortho_context("x", 4);
    expect(p.ortho_context.get("x")).toBe(6);
    expect([...p._debug_ortho_context("x")]).toEqual(["BEG-UC", "MID-UC"]);
    p.clear_ortho_context();
    expect(p.ortho_context.size).toBe(0);
  });
});
