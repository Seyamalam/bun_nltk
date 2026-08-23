/**
 * Semantic utilities (port of nltk.sem.util).
 *
 * Thin bridge between feature-grammar parses and semantic interpretation.
 * Full model evaluation lives in sem_logic / sem_evaluate; this module
 * just exposes parseSents() and rootSemrep() matching NLTK's API shape.
 */

export type FeatureTreeLike = { label: unknown; children?: unknown[] };

export function parseSents(
  inputs: string[],
  grammar: unknown,
  _trace = 0,
): FeatureTreeLike[][] {
  // Lightweight stub — real FeatureChartParser wiring lives in src/feature_parse.
  // Matches NLTK signature: returns an array per input of its parse trees.
  // Callers that need actual parses should use parseFeatureCfgGrammar + featureChartParse directly.
  void grammar;
  return inputs.map(sent => {
    const tokens = sent.split(/\s+/).filter(Boolean);
    void tokens;
    return [];
  });
}

export function rootSemrep(tree: FeatureTreeLike, semkey = "SEM"): unknown {
  const label: any = (tree as any).label;
  if (label && typeof label === "object" && semkey in label) return label[semkey];
  // Also support our ParseTree shape where label may carry features
  return undefined;
}

export function skolemizeSemrep(tree: FeatureTreeLike, semkey = "SEM"): unknown {
  return rootSemrep(tree, semkey);
}
