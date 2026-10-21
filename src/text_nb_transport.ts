import { syncWasm } from "./sync_wasm.ts";
import type { CategoricalNBSerialized } from "./categorical_nb.ts";
import type { NaiveBayesSerialized, NaiveBayesExample, NaiveBayesPrediction } from "./multinomial_nb.ts";
import type { PositiveNaiveBayesSerialized } from "./positive_naive_bayes.ts";

export type PositivePrediction = { label: string; probability: number; logProb: number };
type Request =
  | { action: "trainCategorical"; model: CategoricalNBSerialized; examples: NaiveBayesExample[] }
  | { action: "loadCategorical"; model: CategoricalNBSerialized }
  | { action: "predictCategorical"; model: CategoricalNBSerialized; text: string }
  | { action: "trainMultinomial"; model: NaiveBayesSerialized; examples: NaiveBayesExample[] }
  | { action: "loadMultinomial"; model: NaiveBayesSerialized }
  | { action: "predictMultinomial"; model: NaiveBayesSerialized; text: string }
  | { action: "trainPositive"; model: PositiveNaiveBayesSerialized; positive: string[]; unlabeled: string[]; prior?: number }
  | { action: "loadPositive"; model: PositiveNaiveBayesSerialized }
  | { action: "predictPositive"; model: PositiveNaiveBayesSerialized; text: string };

export function textNB(request: Extract<Request, { action: "trainCategorical" | "loadCategorical" }>): CategoricalNBSerialized;
export function textNB(request: Extract<Request, { action: "trainMultinomial" | "loadMultinomial" }>): NaiveBayesSerialized;
export function textNB(request: Extract<Request, { action: "trainPositive" | "loadPositive" }>): PositiveNaiveBayesSerialized;
export function textNB(request: Extract<Request, { action: "predictCategorical" | "predictMultinomial" }>): NaiveBayesPrediction[];
export function textNB(request: Extract<Request, { action: "predictPositive" }>): PositivePrediction[];
export function textNB(request: Request): CategoricalNBSerialized | NaiveBayesSerialized | PositiveNaiveBayesSerialized | NaiveBayesPrediction[] | PositivePrediction[] {
  const result: CategoricalNBSerialized | NaiveBayesSerialized | PositiveNaiveBayesSerialized | NaiveBayesPrediction[] | PositivePrediction[] | { error: string } =
    JSON.parse(syncWasm().textNaiveBayes(JSON.stringify(request)));
  if ("error" in result) throw new Error(result.error);
  return result;
}
