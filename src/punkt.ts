const DEFAULT_PUNKT_ABBREVIATIONS = [
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
];

const TITLE_ABBREVIATIONS = new Set([
  "dr",
  "prof",
]);

type TokenLook = {
  token: string;
  lower: string;
  start: number;
  isUpperStart: boolean;
  isLowerStart: boolean;
};

export type PunktModelSerialized = {
  version: number;
  abbreviations: string[];
  collocations: Array<[string, string]>;
  sentenceStarters: string[];
};

export type PunktTrainingOptions = {
  minAbbrevCount?: number;
  minCollocationCount?: number;
  minSentenceStarterCount?: number;
};

type PunktPreparedModel = {
  abbreviations: Set<string>;
  collocations: Set<string>;
  sentenceStarters: Set<string>;
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

function findPrevToken(text: string, idx: number): string {
  let end = idx;
  while (end >= 0 && /[\s"'()[\]{}]/.test(text[end]!)) end -= 1;
  if (end < 0) return "";

  let start = end;
  while (start >= 0 && /[A-Za-z0-9.]/.test(text[start]!)) start -= 1;
  return text.slice(start + 1, end + 1);
}

function findNextToken(text: string, idx: number): TokenLook | null {
  let i = idx;
  while (i < text.length && (isWhitespace(text[i]!) || isCloser(text[i]!))) i += 1;
  if (i >= text.length) return null;

  const start = i;
  while (i < text.length && /[A-Za-z0-9.]/.test(text[i]!)) i += 1;
  const token = text.slice(start, i);
  if (!token) return null;
  const first = token[0]!;
  return {
    token,
    lower: token.toLowerCase(),
    start,
    isUpperStart: /[A-Z]/.test(first),
    isLowerStart: /[a-z]/.test(first),
  };
}

function normalizeAbbrev(token: string): string {
  return token.replace(/\.+$/, "").toLowerCase();
}

function preparePunktModel(model: PunktModelSerialized): PunktPreparedModel {
  const abbreviations = new Set<string>();
  const collocations = new Set<string>();
  const sentenceStarters = new Set<string>();

  for (const abbr of model.abbreviations) {
    abbreviations.add(normalizeAbbrev(abbr));
  }
  for (const [left, right] of model.collocations) {
    collocations.add(`${normalizeAbbrev(left)}\u0001${right.toLowerCase()}`);
  }
  for (const starter of model.sentenceStarters) {
    sentenceStarters.add(starter.toLowerCase());
  }

  return {
    abbreviations,
    collocations,
    sentenceStarters,
  };
}

function shouldSplitAt(
  text: string,
  punctIdx: number,
  model: PunktPreparedModel,
): boolean {
  const punct = text[punctIdx]!;
  const prev = punctIdx > 0 ? text[punctIdx - 1]! : "";
  const next = punctIdx + 1 < text.length ? text[punctIdx + 1]! : "";

  if (punct === "." && /\d/.test(prev) && /\d/.test(next)) return false;
  if (punct === "." && next === ".") return false;
  if (punct === "." && /[A-Za-z]/.test(next) && punctIdx + 2 < text.length && text[punctIdx + 2] === ".") {
    return false;
  }

  const prevToken = findPrevToken(text, punctIdx - 1);
  const prevNorm = normalizeAbbrev(prevToken);
  const look = findNextToken(text, punctIdx + 1);
  if (!look) return true;

  if (punct === "." && model.abbreviations.has(prevNorm)) {
    if (TITLE_ABBREVIATIONS.has(prevNorm) && look.isUpperStart) return false;
    if (look.isLowerStart) return false;
    const pairKey = `${prevNorm}\u0001${look.lower}`;
    if (model.collocations.has(pairKey)) return false;
    if (!look.isUpperStart && !model.sentenceStarters.has(look.lower)) return false;
  }

  if (look.isUpperStart) return true;
  if (/[0-9]/.test(look.token[0]!)) return true;
  if (look.token[0] === '"' || look.token[0] === "'" || look.token[0] === "(") return true;
  if (punct === "!" || punct === "?") return true;
  if (look.isLowerStart && !model.sentenceStarters.has(look.lower)) return false;
  return true;
}

function roughSentenceSplits(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (!isSentencePunct(text[i]!)) continue;
    const segment = text.slice(start, i + 1).trim();
    if (segment) out.push(segment);
    start = i + 1;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

export function trainPunktModel(text: string, options: PunktTrainingOptions = {}): PunktModelSerialized {
  const minAbbrevCount = options.minAbbrevCount ?? 2;
  const minCollocationCount = options.minCollocationCount ?? 2;
  const minSentenceStarterCount = options.minSentenceStarterCount ?? 2;

  const abbreviationStats = new Map<string, { total: number; lowerAfter: number; upperAfter: number }>();
  const collocationStats = new Map<string, number>();
  const starterStats = new Map<string, number>();

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== ".") continue;
    const left = normalizeAbbrev(findPrevToken(text, i - 1));
    if (!left || !/^[a-z][a-z.]{0,15}$/.test(left)) continue;
    const look = findNextToken(text, i + 1);
    if (!look) continue;

    const row = abbreviationStats.get(left) ?? { total: 0, lowerAfter: 0, upperAfter: 0 };
    row.total += 1;
    if (look.isLowerStart) row.lowerAfter += 1;
    if (look.isUpperStart) row.upperAfter += 1;
    abbreviationStats.set(left, row);

    if (look.isLowerStart) {
      const key = `${left}\u0001${look.lower}`;
      collocationStats.set(key, (collocationStats.get(key) ?? 0) + 1);
    }
  }

  for (const sentence of roughSentenceSplits(text)) {
    const starter = sentence.trim().match(/^[A-Za-z][A-Za-z0-9'-]*/)?.[0]?.toLowerCase();
    if (!starter) continue;
    starterStats.set(starter, (starterStats.get(starter) ?? 0) + 1);
  }

  const abbreviations = new Set<string>();
  for (const [abbr, stats] of abbreviationStats.entries()) {
    if (stats.total >= minAbbrevCount && (stats.lowerAfter >= stats.upperAfter || (stats.upperAfter > 0 && abbr.length <= 3))) {
      abbreviations.add(abbr);
    }
  }

  const collocations: Array<[string, string]> = [];
  for (const [pair, count] of collocationStats.entries()) {
    if (count < minCollocationCount) continue;
    const [left, right] = pair.split("\u0001");
    if (left && right) collocations.push([left, right]);
  }

  const sentenceStarters: string[] = [];
  for (const [starter, count] of starterStats.entries()) {
    if (count >= minSentenceStarterCount) sentenceStarters.push(starter);
  }

  abbreviations.delete("");
  return {
    version: 1,
    abbreviations: [...abbreviations].sort(),
    collocations: collocations.sort(([a1, b1], [a2, b2]) => {
      if (a1 !== a2) return a1.localeCompare(a2);
      return b1.localeCompare(b2);
    }),
    sentenceStarters: sentenceStarters.sort(),
  };
}

export function sentenceTokenizePunkt(text: string, model?: PunktModelSerialized): string[] {
  const prepared = preparePunktModel(model ?? defaultPunktModel());
  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    if (!isSentencePunct(text[i]!)) continue;
    if (!shouldSplitAt(text, i, prepared)) continue;

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

let cachedDefaultModel: PunktModelSerialized | null = null;

export function defaultPunktModel(): PunktModelSerialized {
  if (cachedDefaultModel) return cachedDefaultModel;
  cachedDefaultModel = {
    version: 1,
    abbreviations: [...DEFAULT_PUNKT_ABBREVIATIONS].sort(),
    collocations: [],
    sentenceStarters: [],
  };
  return cachedDefaultModel;
}

export function serializePunktModel(model: PunktModelSerialized): string {
  return JSON.stringify(model);
}

export function parsePunktModel(payload: string | PunktModelSerialized): PunktModelSerialized {
  const parsed = typeof payload === "string" ? (JSON.parse(payload) as PunktModelSerialized) : payload;
  return {
    version: parsed.version,
    abbreviations: [...parsed.abbreviations],
    collocations: [...parsed.collocations],
    sentenceStarters: [...parsed.sentenceStarters],
  };
}
