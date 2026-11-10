import { expect, test } from "bun:test";
import { SentimentIntensityAnalyzer, SentiText, VaderConstants } from "../index";

test("SentimentIntensityAnalyzer returns positive compound for positive text", () => {
  const vader = new SentimentIntensityAnalyzer();
  const score = vader.polarityScores("This product is absolutely amazing and wonderful!");
  expect(score.compound).toBeGreaterThan(0.4);
  expect(score.pos).toBeGreaterThan(score.neg);
});

test("SentimentIntensityAnalyzer captures negation", () => {
  const vader = new SentimentIntensityAnalyzer();
  const positive = vader.polarityScores("This is good");
  const negated = vader.polarityScores("This is not good");
  expect(positive.compound).toBeGreaterThan(negated.compound);
});


// NLTK 3.10.3 oracle pins — full SentimentIntensityAnalyzer member surface.
test("SIA: NLTK polarity_scores doctest pins", () => {
  const sia = new SentimentIntensityAnalyzer();
  expect(sia.polarity_scores("VADER is smart, handsome, and funny."))
    .toEqual({ neg: 0, neu: 0.254, pos: 0.746, compound: 0.8316 });
  expect(sia.polarity_scores("VADER is VERY SMART, handsome, and FUNNY."))
    .toEqual({ neg: 0, neu: 0.246, pos: 0.754, compound: 0.9227 });
  expect(sia.polarity_scores("The book was good."))
    .toEqual({ neg: 0, neu: 0.508, pos: 0.492, compound: 0.4404 });
  expect(sia.polarity_scores("At least it isnt a horrible place."))
    .toEqual({ neg: 0, neu: 0.637, pos: 0.363, compound: 0.431 });
  expect(sia.polarity_scores("Make sure you :) or D today"))
    .toEqual({ neg: 0, neu: 0.43, pos: 0.57, compound: 0.6486 });
});

test("SIA: SentiText/VaderConstants/sentiment_valence/score_valence/make_lex_dict", () => {
  const sia = new SentimentIntensityAnalyzer();
  const st = new SentiText("VADER is smart, handsome, and funny.");
  expect(st.words_and_emoticons).toEqual(["VADER", "is", "smart", "handsome", "and", "funny"]);
  expect(st.is_cap_diff).toBe(true);
  const vc = new VaderConstants();
  expect(["not good", "the least bad", "at least ok", "isnt fine"].map((w) => vc.negated(w.split(" "))))
    .toEqual([true, true, false, true]);
  expect(vc.normalize(3.5)).toBeCloseTo(0.670478, 6);
  expect(vc.scalar_inc_dec("very", 1.0, true)).toBeCloseTo(0.293, 10);
  expect(sia.score_valence([0.5, -1.2, 0, 0.9], "x y z"))
    .toEqual({ neg: 0.333, neu: 0.152, pos: 0.515, compound: 0.0516 });
  expect(sia.score_valence([], "")).toEqual({ neg: 0, neu: 0, pos: 0, compound: 0 });
  const sv: number[] = [];
  sia.sentiment_valence(0, st, "smart", 2, sv);
  expect(sv).toEqual([1.7]);
  expect(Object.keys(sia.lexicon)).toHaveLength(7502);
  expect((sia.lexicon as Record<string, number>)["good"]).toBe(1.9);
  // lexicon_file content loads via make_lex_dict
  const custom = new SentimentIntensityAnalyzer("good\t2.5\nbad\t-3.0\n");
  expect(custom.make_lex_dict()).toEqual({ good: 2.5, bad: -3 });
});
