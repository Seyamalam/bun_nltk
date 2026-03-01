import { expect, test } from "bun:test";
import { SentimentIntensityAnalyzer } from "../index";

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

