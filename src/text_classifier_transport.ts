import { syncWasm } from "./sync_wasm.ts";
import type { VectorizerSerialized } from "./features.ts";
import type { DecisionTreeExample, DecisionTreeSerialized } from "./decision_tree.ts";
import type { MaxEntSerialized, MaxEntExample, MaxEntPrediction } from "./maxent_sgd.ts";
import type { IisSerialized } from "./maxent_iis.ts";

type SparsePayload = { indices: number[]; values: number[] };
type Request =
  | { action: "fitVectorizer"; model: VectorizerSerialized; texts: string[] }
  | { action: "loadVectorizer"; model: VectorizerSerialized }
  | { action: "transformVectorizer"; model: VectorizerSerialized; texts: string[] }
  | { action: "trainTree"; labels: string[]; options: DecisionTreeSerialized["options"]; vectorizer: VectorizerSerialized; examples: DecisionTreeExample[] }
  | { action: "loadTree"; model: DecisionTreeSerialized }
  | { action: "predictTree"; model: DecisionTreeSerialized; text: string }
  | { action: "sgdVocabulary"; texts: string[] }
  | { action: "trainSgd"; model: MaxEntSerialized; examples: MaxEntExample[] }
  | { action: "loadSgd"; model: MaxEntSerialized }
  | { action: "predictSgd"; model: MaxEntSerialized; text: string }
  | { action: "trainIis"; model: IisSerialized; examples: MaxEntExample[] }
  | { action: "loadIis"; model: IisSerialized }
  | { action: "predictIis"; model: IisSerialized; text: string };
type Response = VectorizerSerialized | SparsePayload[] | DecisionTreeSerialized | string | [string, number][] | MaxEntSerialized | IisSerialized | MaxEntPrediction[];

export function textClassifier(request: Extract<Request, { action: "fitVectorizer" | "loadVectorizer" }>): VectorizerSerialized;
export function textClassifier(request: Extract<Request, { action: "transformVectorizer" }>): SparsePayload[];
export function textClassifier(request: Extract<Request, { action: "trainTree" | "loadTree" }>): DecisionTreeSerialized;
export function textClassifier(request: Extract<Request, { action: "predictTree" }>): string;
export function textClassifier(request: Extract<Request, { action: "sgdVocabulary" }>): [string, number][];
export function textClassifier(request: Extract<Request, { action: "trainSgd" | "loadSgd" }>): MaxEntSerialized;
export function textClassifier(request: Extract<Request, { action: "trainIis" | "loadIis" }>): IisSerialized;
export function textClassifier(request: Extract<Request, { action: "predictSgd" | "predictIis" }>): MaxEntPrediction[];
export function textClassifier(request: Request): Response {
  const result: Response | { error: string } = JSON.parse(syncWasm().textClassifiers(JSON.stringify(request)));
  if (typeof result === "object" && result !== null && "error" in result) throw new Error(result.error);
  return result;
}
