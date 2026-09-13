/** Punkt inference ported from NLTK 3.10.3 (Apache-2.0). */
import {
  PYTHON_SPACE as space,
  PYTHON_NONSPACE as nonspace,
  trimPythonEnd,
  pythonIsUpper,
  pythonIsLower,
} from "./python_text";
import type { PunktModelSerialized } from "./punkt";
const nonword = String.raw`[)";}\]*:@'({\[‘’“”«»?!]`;
const multi = String.raw`(?:-{2,}|\.{2,}|(?:\.${space}){2,}\.)`;
const wordstart = String.raw`[^\("\x60{\[:;&#*@)}\]\-,]`;
const wordPattern = new RegExp(
  `${multi}|(?=${wordstart})${nonspace}+?(?=${space}|$|${nonword}|${multi}|,(?=$|${space}|${nonword}|${multi}))|${nonspace}`,
  "gu",
);
export class PunktToken {
  type: string;
  sentbreak = false;
  abbr = false;
  ellipsis = false;
  constructor(
    public tok: string,
    public parastart = false,
    public linestart = false,
  ) {
    this.type = /^-?[.,]?\p{Nd}[\p{Nd},.\-]*\.?$/u.test(tok) ? "##number##" : tok.toLowerCase();
  }
  get noPeriod() {
    return this.type.length > 1 && this.type.endsWith(".") ? this.type.slice(0, -1) : this.type;
  }
  get noSentPeriod() {
    return this.sentbreak ? this.noPeriod : this.type;
  }
  get upper() {
    return pythonIsUpper(Array.from(this.tok)[0]!);
  }
  get lower() {
    return pythonIsLower(Array.from(this.tok)[0]!);
  }
  get initial() {
    return /^(?!\p{Nd})[\p{L}\p{N}_]\.$/u.test(this.tok);
  }
}
export function punktWords(text: string): PunktToken[] {
  const tokens: PunktToken[] = [];
  let para = false;
  for (const line of text.split("\n")) {
    if (!trimPythonEnd(line)) {
      para = true;
      continue;
    }
    const words = line.match(wordPattern) ?? [];
    words.forEach((word, i) => tokens.push(new PunktToken(word, i === 0 && para, i === 0)));
    if (words.length) para = false;
  }
  return tokens;
}
export function firstPass(tokens: PunktToken[], abbreviations: Set<string>) {
  for (const t of tokens) {
    if ([".", "?", "!"].includes(t.tok)) t.sentbreak = true;
    else if (/^\.{2,}$/.test(t.tok)) t.ellipsis = true;
    else if (t.tok.endsWith(".") && !t.tok.endsWith("..")) {
      const base = t.tok.slice(0, -1).toLowerCase();
      if (abbreviations.has(base) || abbreviations.has(base.split("-").at(-1)!)) t.abbr = true;
      else t.sentbreak = true;
    }
  }
}
export function punktSentences(text: string, model: PunktModelSerialized): string[] {
  const abbreviations = new Set(model.abbreviations),
    starters = new Set(model.sentenceStarters);
  const pairs = new Set(model.collocations.map((pair) => JSON.stringify(pair))),
    ortho = model.orthoContext ?? {};
  function heuristic(t: PunktToken): boolean | null {
    if ([";", ":", ",", ".", "!", "?"].includes(t.tok)) return false;
    const context = ortho[t.noSentPeriod] ?? 0;
    if (t.upper && context & 112 && !(context & 4)) return true;
    if (t.lower && (context & 14 || !(context & 16))) return false;
    return null;
  }
  function containsBreak(context: string): boolean {
    const tokens = punktWords(context);
    firstPass(tokens, abbreviations);
    for (let i = 0; i < tokens.length - 1; i++) {
      const t = tokens[i]!,
        next = tokens[i + 1]!;
      if (t.tok.endsWith(".")) {
        if (pairs.has(JSON.stringify([t.noPeriod, next.noSentPeriod]))) {
          t.sentbreak = false;
          t.abbr = true;
        } else {
          const h = heuristic(next);
          if (
            (t.abbr || t.ellipsis) &&
            !t.initial &&
            (h === true || (next.upper && starters.has(next.noSentPeriod)))
          )
            t.sentbreak = true;
          if (
            (t.initial || t.noPeriod === "##number##") &&
            (h === false ||
              (h === null && t.initial && next.upper && !((ortho[next.noSentPeriod] ?? 0) & 112)))
          ) {
            t.sentbreak = false;
            t.abbr = true;
          }
        }
      }
      if (t.sentbreak) return true;
    }
    return false;
  }
  const contexts: { index: number; after: string; next?: string; start: number }[] = [];
  const pattern = new RegExp(`[.?!](?=(${nonword}|${space}+(${nonspace}+)))`, "gu");
  let previous: (typeof contexts)[number] | undefined;
  let sliceStart = 0,
    sliceEnd = 0;
  for (const m of text.matchAll(pattern)) {
    const before = text.slice(sliceEnd, m.index);
    let whitespace = 0;
    for (let i = before.length - 1; i >= 0; i--)
      if (" \t\n\r\v\f".includes(before[i]!)) {
        whitespace = i;
        break;
      }
    const start = whitespace ? sliceEnd + whitespace + 1 : sliceStart;
    if (previous && sliceEnd <= start) contexts.push(previous);
    previous = { index: m.index, after: m[1]!, next: m[2], start };
    sliceStart = start;
    sliceEnd = m.index;
  }
  if (previous) contexts.push(previous);
  const slices: [number, number][] = [];
  let last = 0;
  for (const m of contexts)
    if (containsBreak(text.slice(m.start, m.index + 1) + m.after)) {
      slices.push([last, m.index + 1]);
      last = m.next ? m.index + 1 + m.after.length - m.next.length : m.index + 1;
    }
  slices.push([last, trimPythonEnd(text).length]);
  const result: string[] = [];
  let realign = 0;
  for (let i = 0; i < slices.length; i++) {
    const [start, end] = slices[i]!,
      next = slices[i + 1];
    let stop = end;
    const alignedStart = start + realign;
    realign = 0;
    if (next) {
      const m = new RegExp(String.raw`^["')\]}‘’“”«»]+?(?:${space}+|(?=--)|$)`, "u").exec(
        text.slice(next[0], next[1]),
      );
      if (m) {
        stop = next[0] + trimPythonEnd(m[0]).length;
        realign = m[0].length;
      }
    }
    if (stop > alignedStart) result.push(text.slice(alignedStart, stop));
  }
  return result;
}
