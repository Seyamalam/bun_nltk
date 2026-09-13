/** NLTK 3.10.3 maximum-entropy NE inference. See THIRD_PARTY_NOTICES.md. */
import { pythonIsTitle, pythonIsLower } from "./python_text";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { TaggedToken } from "./chunk";
type Value = string | number | boolean | null;
type Model = {
  labels: string[];
  mapping: [string, Value, string, number][];
  weights: number[];
  alwaysOn: Record<string, number>;
  wordlist: string[];
};
type Prepared = { model: Model; mapping: Map<string, number>; words: Set<string> };
const cache = new Map<boolean, Prepared>();
function getModel(binary: boolean): Prepared {
  let result = cache.get(binary);
  if (!result) {
    const model: Model = JSON.parse(
      gunzipSync(
        readFileSync(
          new URL(
            `../models/ne-chunker-${binary ? "binary" : "multiclass"}.json.gz`,
            import.meta.url,
          ),
        ),
      ).toString(),
    );
    result = {
      model,
      mapping: new Map(
        model.mapping.map(([name, value, label, index]) => [
          JSON.stringify([name, value, label]),
          index,
        ]),
      ),
      words: new Set(model.wordlist),
    };
    cache.set(binary, result);
  }
  return result;
}
function shape(word: string): string {
  if (/^(?:[0-9]+(?:\.[0-9]*)?|[0-9]*\.[0-9]+$)/u.test(word)) return "number";
  if (/^[^\p{L}\p{N}_]+$/u.test(word)) return "punct";
  if (/^[\p{L}\p{N}_]+$/u.test(word)) {
    if (pythonIsTitle(word)) return "upcase";
    if (pythonIsLower(word)) return "downcase";
    return "mixedcase";
  }
  return "other";
}
const pos = (s: string) => (s.startsWith("V") ? "V" : s.split("-")[0]!);
const py = (v: Value) => (v === null ? "None" : String(v));
export function tagNamedEntities(tokens: TaggedToken[], binary: boolean): string[] {
  const { model, mapping, words } = getModel(binary);
  const history: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i]!.token,
      tag = pos(tokens[i]!.tag),
      chars = Array.from(word);
    const prevword = i ? tokens[i - 1]!.token.toLowerCase() : null;
    const prevpos = i ? pos(tokens[i - 1]!.tag) : null;
    const prevtag = i === 0 ? null : i === 1 ? history[0]![0]! : history[i - 1]!;
    const prevshape = i < 2 ? null : shape(prevword!);
    const nextword = tokens[i + 1]?.token.toLowerCase() ?? null;
    const nextpos = tokens[i + 1]?.tag.toLowerCase() ?? null;
    const features: Record<string, Value> = {
      bias: true,
      shape: shape(word),
      wordlen: chars.length,
      prefix3: chars.slice(0, 3).join("").toLowerCase(),
      suffix3: chars.slice(-3).join("").toLowerCase(),
      pos: tag,
      word,
      "en-wordlist": words.has(word),
      prevtag,
      prevpos,
      nextpos,
      prevword,
      nextword,
      "word+nextpos": `${word.toLowerCase()}+${py(nextpos)}`,
      "pos+prevtag": `${tag}+${py(prevtag)}`,
      "shape+prevtag": `${py(prevshape)}+${py(prevtag)}`,
    };
    let best = model.labels[0]!,
      bestScore = -Infinity;
    for (const label of model.labels) {
      let score = 0;
      for (const [name, value] of Object.entries(features)) {
        const index = mapping.get(JSON.stringify([name, value, label]));
        if (index !== undefined) score += model.weights[index]!;
      }
      const always = model.alwaysOn[label];
      if (always !== undefined) score += model.weights[always]!;
      if (score > bestScore) {
        best = label;
        bestScore = score;
      }
    }
    history.push(best);
  }
  return history;
}
