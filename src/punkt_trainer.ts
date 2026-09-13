/** Punkt training statistics from NLTK 3.10.3. */
import { firstPass, punktWords } from "./punkt_engine";
import type { PunktModelSerialized, PunktTrainingOptions } from "./punkt";
const increment = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);
function likelihood(a: number, b: number, ab: number, n: number): number {
  const p = b / n,
    p1 = ab / a,
    p2 = n === a ? 1 : (b - ab) / (n - a);
  const sum = (x: number, y: number, q: number) =>
    q <= 0 || q >= 1 ? 0 : x * Math.log(q) + y * Math.log(1 - q);
  return (
    -2 *
    (sum(ab, a - ab, p) +
      sum(b - ab, n - a - b + ab, p) -
      sum(ab, a - ab, p1) -
      sum(b - ab, n - a - b + ab, p2))
  );
}
export function trainPunkt(
  chunks: string[],
  options: PunktTrainingOptions = {},
): PunktModelSerialized {
  const freq = new Map<string, number>(),
    collocs = new Map<string, number>(),
    starts = new Map<string, number>();
  const abbrs = new Set<string>(),
    ortho: Record<string, number> = Object.create(null),
    scores: Record<string, number> = Object.create(null);
  let n = 0,
    periods = 0,
    breaks = 0;
  const count = (key: string) => freq.get(key) ?? 0;
  for (const text of chunks) {
    const tokens = punktWords(text);
    for (const t of tokens) {
      increment(freq, t.type);
      n++;
      if (t.tok.endsWith(".")) periods++;
    }
    for (let type of new Set(tokens.map((t) => t.type))) {
      if (!/[\p{L}\p{N}_]/u.test(type) || type === "##number##") continue;
      const add = type.endsWith(".");
      if (add) {
        if (abbrs.has(type)) continue;
        type = type.slice(0, -1);
      } else if (!abbrs.has(type)) continue;
      const dots = (type.match(/\./g) ?? []).length + 1,
        length = Array.from(type).length - dots + 1;
      const withPeriod = count(type + "."),
        without = count(type),
        p = periods / n;
      const ll =
        -2 *
        (withPeriod * Math.log(p + 1e-8) +
          without * Math.log(1 - p + 1e-8) -
          withPeriod * Math.log(0.99) -
          without * Math.log(0.01));
      const score = ll * Math.exp(-length) * dots * Math.pow(length, -without);
      scores[type] = score;
      if (score >= 0.3 && withPeriod >= (options.minAbbrevCount ?? 1)) {
        if (add) abbrs.add(type);
      } else if (!add) abbrs.delete(type);
    }
    firstPass(tokens, abbrs);
    let context: "initial" | "internal" | "unknown" = "internal";
    for (const t of tokens) {
      if (t.parastart && context !== "unknown") context = "initial";
      if (t.linestart && context === "internal") context = "unknown";
      const flag = t.upper
        ? { initial: 2, internal: 4, unknown: 8 }[context]
        : t.lower
          ? { initial: 16, internal: 32, unknown: 64 }[context]
          : 0;
      if (flag) ortho[t.noSentPeriod] = (ortho[t.noSentPeriod] ?? 0) | flag;
      if (t.sentbreak) {
        breaks++;
        context = t.initial || t.type === "##number##" ? "unknown" : "initial";
      } else context = t.ellipsis || t.abbr ? "unknown" : "internal";
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      const t = tokens[i]!,
        next = tokens[i + 1]!;
      if (!t.tok.endsWith(".")) continue;
      const type = t.noSentPeriod,
        ctx = ortho[next.noSentPeriod] ?? 0;
      if (
        !t.abbr &&
        t.sentbreak &&
        !abbrs.has(type) &&
        count(type) + count(type.slice(0, -1)) < 5 &&
        (",:;".includes(next.tok[0]!) || (next.lower && ctx & 2 && !(ctx & 4)))
      )
        abbrs.add(t.noPeriod);
      if (
        t.sentbreak &&
        !t.initial &&
        t.type !== "##number##" &&
        /^(?!.*\p{Nd})[\p{L}\p{N}_]+$/u.test(next.tok)
      )
        increment(starts, next.type);
      if (
        t.sentbreak &&
        (t.initial || t.type === "##number##") &&
        /[\p{L}\p{N}_]/u.test(t.type) &&
        /[\p{L}\p{N}_]/u.test(next.type)
      )
        increment(collocs, JSON.stringify([t.noPeriod, next.noSentPeriod]));
    }
  }
  const starters = new Set<string>();
  for (const [type, atBreak] of starts) {
    const total = count(type) + count(type + ".");
    if (
      total >= atBreak &&
      atBreak >= (options.minSentenceStarterCount ?? 1) &&
      likelihood(breaks, total, atBreak, n) >= 30 &&
      n / breaks > total / atBreak
    )
      starters.add(type);
  }
  const pairs: [string, string][] = [];
  for (const [key, together] of collocs) {
    const [a, b] = JSON.parse(key) as [string, string],
      ac = count(a) + count(a + "."),
      bc = count(b) + count(b + ".");
    if (
      !starters.has(b) &&
      ac > 1 &&
      bc > 1 &&
      together >= (options.minCollocationCount ?? 2) &&
      together <= Math.min(ac, bc) &&
      likelihood(ac, bc, together, n) >= 7.88 &&
      n / ac > bc / together
    )
      pairs.push([a, b]);
  }
  return {
    version: 2,
    abbreviations: [...abbrs].sort(),
    collocations: pairs.sort(),
    sentenceStarters: [...starters].sort(),
    orthoContext: ortho,
    abbreviationScores: scores,
  };
}
