import fixture from "../test/fixtures/nltk-model-parity.json";
import { SentimentIntensityAnalyzer } from "../src/sentiment";
import { sentenceTokenizePunkt, trainPunktModel } from "../src/punkt";
import { treebankWordTokenize, wordPunctTokenize } from "../src/tokenizers";
import { neChunkIob } from "../src/named_entity";
const failures: { group: string; index: number; expected: unknown; actual: unknown }[] = [];
const counts: Record<string, number> = {};
function check(group: string, index: number, expected: unknown, actual: unknown) {
  counts[group] = (counts[group] ?? 0) + 1;
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    failures.push({ group, index, expected, actual });
}
const analyzer = new SentimentIntensityAnalyzer();
fixture.sentiment.forEach((row, i) =>
  check("sentiment", i, row.scores, analyzer.polarityScores(row.text)),
);
fixture.tokenizers.forEach((row, i) => {
  check("punkt", i, row.punkt, sentenceTokenizePunkt(row.text));
  check("treebank", i, row.treebank, treebankWordTokenize(row.text));
  check("wordpunct", i, row.wordpunct, wordPunctTokenize(row.text));
});
fixture.training.forEach((row, i) => {
  const model = trainPunktModel(row.text);
  check("training_abbreviations", i, row.abbreviations, model.abbreviations);
  check("training_collocations", i, row.collocations, model.collocations);
  check("training_starters", i, row.sentenceStarters, model.sentenceStarters);
  const sort = (data: Record<string, number | undefined>) =>
    Object.entries(data)
      .filter(([, n]) => n !== 0)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  check("training_orthography", i, sort(row.orthoContext), sort(model.orthoContext ?? {}));
  check("training_sentences", i, row.sentences, sentenceTokenizePunkt(row.text, model));
});
fixture.ner.forEach((row, i) => {
  const tokens = row.tokens.map(([token, tag]) => ({ token: token!, tag: tag! }));
  check("ner_multiclass", i, row.multiclass, neChunkIob(tokens));
  check("ner_binary", i, row.binary, neChunkIob(tokens, { binary: true }));
});
console.log(
  JSON.stringify(
    {
      parity: failures.length === 0,
      oracle: `NLTK ${fixture.nltk}`,
      counts,
      failed: failures.length,
      failures: failures.slice(0, 20),
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
