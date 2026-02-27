import { expect, test } from "bun:test";
import { loadDecisionTreeTextClassifier, trainDecisionTreeTextClassifier, type DecisionTreeExample } from "../index";

const trainRows: DecisionTreeExample[] = [
  { label: "tech", text: "kernel memory cpu scheduler cache" },
  { label: "tech", text: "server database api latency throughput" },
  { label: "finance", text: "equity bond yield earnings guidance" },
  { label: "finance", text: "inflation rates central bank liquidity" },
];

const testRows: DecisionTreeExample[] = [
  { label: "tech", text: "api server cache throughput" },
  { label: "finance", text: "bond yield rates inflation" },
  { label: "tech", text: "cpu kernel memory" },
  { label: "finance", text: "earnings bank guidance" },
];

test("decision tree classifier trains and predicts", () => {
  const clf = trainDecisionTreeTextClassifier(trainRows, {
    maxDepth: 6,
    minSamples: 1,
    maxCandidateFeatures: 128,
  });
  const evalOut = clf.evaluate(testRows);
  expect(evalOut.accuracy).toBeGreaterThanOrEqual(0.75);
});

test("decision tree classifier serializes and reloads", () => {
  const clf = trainDecisionTreeTextClassifier(trainRows, { maxDepth: 6, minSamples: 1 });
  const loaded = loadDecisionTreeTextClassifier(clf.toJSON());
  const a = clf.classify("cpu cache scheduler");
  const b = loaded.classify("cpu cache scheduler");
  expect(a).toBe(b);
});
