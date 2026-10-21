import { textClassifier } from "./text_classifier_transport.ts";

/** Text feature contract shared with the NLTK classifier baselines. */
export function textCountFeatures(text: string): Map<string, number> {
  return new Map(textClassifier({ action: "sgdVocabulary", texts: [text] }));
}
/** DictionaryProbDist.max breaks equal-probability ties by greatest label. */
export const descendingLabel = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
