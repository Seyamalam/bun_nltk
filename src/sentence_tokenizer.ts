const DEFAULT_ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
  "a.m",
  "p.m",
]);

type NextToken = {
  start: number;
  token: string;
  first: string;
  isUpperStart: boolean;
  isLowerStart: boolean;
};

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

function isSentencePunct(ch: string): boolean {
  return ch === "." || ch === "!" || ch === "?";
}

function isCloser(ch: string): boolean {
  return ch === '"' || ch === "'" || ch === ")" || ch === "]" || ch === "}";
}

function findNextToken(text: string, idx: number): NextToken | null {
  let i = idx;
  while (i < text.length && (isWhitespace(text[i]!) || isCloser(text[i]!))) i += 1;
  if (i >= text.length) return null;

  const start = i;
  while (i < text.length && /[A-Za-z0-9.]/.test(text[i]!)) i += 1;
  const token = text.slice(start, i);
  if (!token) return null;
  const first = token[0]!;
  return {
    start,
    token,
    first,
    isUpperStart: /[A-Z]/.test(first),
    isLowerStart: /[a-z]/.test(first),
  };
}

function findPrevToken(text: string, idx: number): string {
  let end = idx;
  while (end >= 0 && /[\s"'()\[\]{}]/.test(text[end]!)) end -= 1;
  if (end < 0) return "";

  let start = end;
  while (start >= 0 && /[A-Za-z0-9.]/.test(text[start]!)) start -= 1;
  return text.slice(start + 1, end + 1);
}

function isLikelyAbbreviation(token: string, abbrevs: Set<string>): boolean {
  if (!token) return false;
  const normalized = token.replace(/\.+$/, "").toLowerCase();
  if (abbrevs.has(normalized)) return true;

  // Initials like "A." / "J.R."
  if (/^(?:[A-Za-z]\.)+[A-Za-z]?$/.test(token)) return true;
  if (/^[A-Za-z]$/.test(normalized)) return true;

  return false;
}

function learnAbbreviations(text: string, base: Set<string>): Set<string> {
  const scored = new Map<string, { lower: number; upper: number; total: number }>();
  const candidateRe = /\b([A-Za-z][A-Za-z.]{0,10})\.\s+([A-Za-z])/g;
  for (const match of text.matchAll(candidateRe)) {
    const raw = (match[1] ?? "").toLowerCase().replace(/\.+$/, "");
    const next = match[2] ?? "";
    if (!raw) continue;

    const row = scored.get(raw) ?? { lower: 0, upper: 0, total: 0 };
    row.total += 1;
    if (/[a-z]/.test(next)) row.lower += 1;
    if (/[A-Z]/.test(next)) row.upper += 1;
    scored.set(raw, row);
  }

  const out = new Set(base);
  for (const [abbr, row] of scored.entries()) {
    // Punkt-like intuition: abbreviation if often followed by lowercase.
    if (row.total >= 2 && row.lower > row.upper) out.add(abbr);
  }
  return out;
}

function collectLikelyStarters(text: string): Set<string> {
  const starters = new Map<string, number>();
  const roughSentences = text.split(/[.!?]+/g);
  for (const s of roughSentences) {
    const token = s.trim().match(/^[A-Za-z][A-Za-z0-9'-]*/)?.[0];
    if (!token) continue;
    const key = token.toLowerCase();
    starters.set(key, (starters.get(key) ?? 0) + 1);
  }
  const out = new Set<string>();
  for (const [token, count] of starters.entries()) {
    if (count >= 2) out.add(token);
  }
  return out;
}

function shouldSplitAt(
  text: string,
  punctIdx: number,
  abbrevs: Set<string>,
  likelyStarters: Set<string>,
  useOrthographicHeuristics: boolean,
): boolean {
  const punct = text[punctIdx]!;
  const prev = punctIdx > 0 ? text[punctIdx - 1]! : "";
  const next = punctIdx + 1 < text.length ? text[punctIdx + 1]! : "";

  if (punct === "." && /\d/.test(prev) && /\d/.test(next)) {
    return false;
  }

  if (punct === "." && next === ".") {
    return false;
  }

  const prevToken = findPrevToken(text, punctIdx - 1);
  const look = findNextToken(text, punctIdx + 1);
  if (punct === "." && isLikelyAbbreviation(prevToken, abbrevs)) {
    if (!look) return true;

    const isInitial = /^[A-Z]\.?$/.test(look.token);
    if (/^[A-Z]$/.test(prevToken) && isInitial) return false;

    const leftWindow = text.slice(Math.max(0, punctIdx - 24), punctIdx + 1);
    if (/(?:[A-Z]\.\s+){2,}[A-Z]\.$/.test(leftWindow) && /^[A-Z][a-z]/.test(look.token)) {
      return false;
    }

    if (look.isLowerStart) return false;
    if (look.isUpperStart && /^[A-Z][a-z]+$/.test(prevToken.replace(/\.$/, ""))) {
      return false;
    }
  }

  if (!look) return true;

  if (/[0-9]/.test(look.first)) return true;
  if (look.isUpperStart) return true;
  if (look.first === '"' || look.first === "'" || look.first === "(") return true;

  if (useOrthographicHeuristics) {
    if (look.isLowerStart && !likelyStarters.has(look.token.toLowerCase())) return false;
  }

  // For `!` and `?`, split more aggressively than for period.
  if (punct === "!" || punct === "?") return true;
  return false;
}

export type SentenceTokenizerOptions = {
  abbreviations?: Iterable<string>;
  learnAbbreviations?: boolean;
  orthographicHeuristics?: boolean;
};

export function sentenceTokenizeSubset(text: string, options: SentenceTokenizerOptions = {}): string[] {
  const baseAbbrevs = new Set(DEFAULT_ABBREVIATIONS);
  if (options.abbreviations) {
    for (const abbr of options.abbreviations) {
      baseAbbrevs.add(abbr.toLowerCase().replace(/\.+$/, ""));
    }
  }
  const learn = options.learnAbbreviations ?? true;
  const orthographic = options.orthographicHeuristics ?? true;
  const abbrevs = learn ? learnAbbreviations(text, baseAbbrevs) : baseAbbrevs;
  const starters = orthographic ? collectLikelyStarters(text) : new Set<string>();

  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    if (!isSentencePunct(text[i]!)) continue;
    if (!shouldSplitAt(text, i, abbrevs, starters, orthographic)) continue;

    let end = i + 1;
    while (end < text.length && isCloser(text[end]!)) end += 1;
    const sentence = text.slice(start, end).trim();
    if (sentence) out.push(sentence);
    start = end;
  }

  const tail = text.slice(start).trim();
  if (tail) out.push(tail);

  return out;
}
