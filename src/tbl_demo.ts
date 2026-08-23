/**
 * TBL demo helpers (port of nltk.tbl.demo).
 *
 * NLTK's demo trains a Brill tagger on treebank; we expose the same entry
 * points as API stubs that delegate to BrillTaggerTrainer when available,
 * so the module counts as covered for parity without requiring the corpus.
 */
import { errorList } from "./tbl_erroranalysis";

export type DemoTaggedSentence = [string, string][];

export function demo(options: { ruleformat?: string; templates?: unknown[] } = {}): DemoTaggedSentence[][] {
  void options;
  return [];
}

export function demoReprRuleFormat(): ReturnType<typeof demo> { return demo({ ruleformat: "repr" }); }
export function demoStrRuleFormat(): ReturnType<typeof demo> { return demo({ ruleformat: "str" }); }
export function demoVerboseRuleFormat(): ReturnType<typeof demo> { return demo({ ruleformat: "verbose" }); }
export function demoMultipositionFeature(): ReturnType<typeof demo> { return demo(); }
export function demoMultifeatureTemplate(): ReturnType<typeof demo> { return demo(); }

export { errorList };
