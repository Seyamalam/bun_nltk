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

export const parse_sents = parseSents;
export const root_semrep = rootSemrep;

export function skolemizeSemrep(tree: FeatureTreeLike, semkey = "SEM"): unknown {
  return rootSemrep(tree, semkey);
}

import { readFileSync } from "node:fs";
import { Assignment, Model, Valuation } from "./sem_logic";

/** Port of nltk.sem.util.read_sents: read non-blank, non-comment lines from a file. */
export function read_sents(filename: string, encoding = "utf8"): string[] {
  const sents = readFileSync(filename, encoding as BufferEncoding)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""));
  return sents.filter((l) => l.length > 0 && l[0] !== "#");
}
export const readSents = read_sents;

/** Port of nltk.sem.util.interpret_sents (partial: depends on the stub parseSents). */
export function interpret_sents(
  inputs: string[],
  grammar: unknown,
  semkey = "SEM",
  trace = 0,
): Array<Array<[FeatureTreeLike, unknown]>> {
  return parseSents(inputs, grammar, trace).map((syntrees) =>
    syntrees.map((syn) => [syn, rootSemrep(syn, semkey)] as [FeatureTreeLike, unknown]));
}
export const interpretSents = interpret_sents;

/** Port of nltk.sem.util.evaluate_sents (partial: depends on the stub parseSents). */
export function evaluate_sents(
  inputs: string[],
  grammar: unknown,
  model: Model,
  assignment: Assignment,
  trace = 0,
): Array<Array<[FeatureTreeLike, unknown, unknown]>> {
  void trace;
  return interpret_sents(inputs, grammar).map((interpretations) =>
    interpretations.map(([syn, sem]) => [syn, sem, model.evaluate(`${sem}`, assignment)] as [FeatureTreeLike, unknown, unknown]));
}
export const evaluateSents = evaluate_sents;

/** Port of nltk.sem.util.demo_model0: build NLTK's demo model + assignment. */
export function demo_model0(): { m0: Model; g0: Assignment } {
  const v: Record<string, string | string[] | string[][]> = {
    john: "b1",
    mary: "g1",
    suzie: "g2",
    fido: "d1",
    tess: "d2",
    noosa: "n",
    girl: ["g1", "g2"],
    boy: ["b1", "b2"],
    dog: ["d1", "d2"],
    bark: ["d1", "d2"],
    walk: ["b1", "g2", "d1"],
    chase: [["b1", "g1"], ["b2", "g1"], ["g1", "d1"], ["g2", "d2"]],
    see: [["b1", "g1"], ["b2", "d2"], ["g1", "b1"], ["d2", "b1"], ["g2", "n"]],
    in: [["b1", "n"], ["b2", "n"], ["d2", "n"]],
    with: [["b1", "g1"], ["g1", "b1"], ["d1", "b1"], ["b1", "d1"]],
  };
  const val = new Valuation(v);
  const dom = val.domain;
  const m0 = new Model(dom, val);
  const g0 = new Assignment(dom);
  return { m0, g0 };
}
export const demoModel0 = demo_model0;

/** Port of nltk.sem.util.demo_legacy_grammar (lowercase 'sem' feature check). */
export function demo_legacy_grammar(): Array<[FeatureTreeLike, unknown]> {
  const out: string[] = [];
  for (const reading of interpret_sents(["hello"], undefined, "sem")) {
    const [syn, sem] = reading[0]!;
    out.push(`sentence: hello\n${sem}`);
    void syn;
  }
  return interpret_sents(["hello"], undefined, "sem")[0] ?? [];
}
export const demoLegacyGrammar = demo_legacy_grammar;
