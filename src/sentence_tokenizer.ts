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

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

function isSentencePunct(ch: string): boolean {
  return ch === "." || ch === "!" || ch === "?";
}

function isCloser(ch: string): boolean {
  return ch === '"' || ch === "'" || ch === ")" || ch === "]" || ch === "}";
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

function shouldSplitAt(text: string, punctIdx: number, abbrevs: Set<string>): boolean {
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
  if (punct === "." && isLikelyAbbreviation(prevToken, abbrevs)) {
    let look = punctIdx + 1;
    while (look < text.length && isCloser(text[look]!)) look += 1;
    while (look < text.length && isWhitespace(text[look]!)) look += 1;
    if (look >= text.length) return true;
    const lookCh = text[look]!;
    if (/[a-z]/.test(lookCh)) return false;
    if (/[A-Z]/.test(lookCh) && /^[A-Z][a-z]+$/.test(prevToken.replace(/\.$/, ""))) {
      return false;
    }
  }

  let look = punctIdx + 1;
  while (look < text.length && isCloser(text[look]!)) look += 1;
  while (look < text.length && isWhitespace(text[look]!)) look += 1;
  if (look >= text.length) return true;

  const lookCh = text[look]!;
  if (/[A-Z0-9]/.test(lookCh)) return true;
  if (lookCh === '"' || lookCh === "'" || lookCh === "(") return true;

  // For `!` and `?`, split more aggressively than for period.
  if (punct === "!" || punct === "?") return true;
  return false;
}

export type SentenceTokenizerOptions = {
  abbreviations?: Iterable<string>;
};

export function sentenceTokenizeSubset(text: string, options: SentenceTokenizerOptions = {}): string[] {
  const abbrevs = new Set(DEFAULT_ABBREVIATIONS);
  if (options.abbreviations) {
    for (const abbr of options.abbreviations) {
      abbrevs.add(abbr.toLowerCase().replace(/\.+$/, ""));
    }
  }

  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    if (!isSentencePunct(text[i]!)) continue;
    if (!shouldSplitAt(text, i, abbrevs)) continue;

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
