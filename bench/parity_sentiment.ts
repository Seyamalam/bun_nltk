import { SentimentIntensityAnalyzer } from "../index";

function main() {
  const analyzer = new SentimentIntensityAnalyzer();
  const positive = analyzer.polarityScores("This product is absolutely amazing and wonderful!");
  const negative = analyzer.polarityScores("This product is terrible, awful, and broken.");
  const negated = analyzer.polarityScores("This product is not good.");

  const parity =
    positive.compound > 0.2 &&
    negative.compound < -0.2 &&
    negated.compound < positive.compound &&
    positive.pos > positive.neg &&
    negative.neg > negative.pos;

  if (!parity) {
    throw new Error(
      `sentiment compatibility check failed: ${JSON.stringify({ positive, negative, negated })}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        parity,
        positive_compound: positive.compound,
        negative_compound: negative.compound,
        negated_compound: negated.compound,
      },
      null,
      2,
    ),
  );
}

main();

