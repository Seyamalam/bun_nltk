// These assignments exercise generated portable declarations, not behavioral parity.
import { ConfusionMatrix, confusionMatrix, precision, ranksFromScores, spearmanCorrelation } from "../dist/portable/index.node.js";
const a = { name: "a" }, b = { name: "b" };
const cm = new ConfusionMatrix([a, b], [b, b]);
const label: { name: string } = cm.labels[0]!;
const score: number | null = precision(new Set([a]), new Set([b]));
const matrixLabel: { name: string } = confusionMatrix([a], [a]).labels[0]!;
const ranks: Array<[{ name: string }, number]> = ranksFromScores([[a, 1], [b, 2]]);
const correlation: number = spearmanCorrelation(new Map([[a, 0], [b, 1]]), new Map([[a, 1], [b, 0]]));
// @ts-expect-error Confusion labels retain their generic identity type.
cm.precision("a");
// @ts-expect-error Precision requires sets rather than arbitrary arrays.
precision([1], [1]);
// @ts-expect-error Ranks must be numeric.
ranksFromScores([["a", "rank"]]);
void [label, score, matrixLabel, ranks, correlation];
