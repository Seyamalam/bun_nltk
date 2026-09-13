import { trainPunkt } from "./punkt_trainer";
import englishModel from "./data/punkt-english.json";
import { punktSentences } from "./punkt_engine";

const TITLE_ABBREVIATIONS = new Set(["dr", "prof"]);

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
  orthoContext?: Record<string, number>;
  abbreviationScores?: Record<string, number>;
  orthographicContext?: Record<string, { lower: number; upper: number }>;
};

export type PunktTrainingOptions = {
  minAbbrevCount?: number;
  minCollocationCount?: number;
  minSentenceStarterCount?: number;
};

export class PunktTrainerSubset {
  private readonly chunks: string[] = [];
  private options: PunktTrainingOptions = {};
  private cached: PunktModelSerialized | null = null;

  train(text: string, options: PunktTrainingOptions = {}): this {
    if (text.trim()) this.chunks.push(text);
    this.options = {
      minAbbrevCount: options.minAbbrevCount ?? this.options.minAbbrevCount,
      minCollocationCount: options.minCollocationCount ?? this.options.minCollocationCount,
      minSentenceStarterCount:
        options.minSentenceStarterCount ?? this.options.minSentenceStarterCount,
    };
    this.cached = null;
    return this;
  }

  finalize(): PunktModelSerialized {
    if (!this.cached) {
      this.cached = trainPunkt(this.chunks, this.options);
    }
    return parsePunktModel(this.cached);
  }

  getParams(): PunktModelSerialized {
    return this.finalize();
  }
}

export class PunktTrainer extends PunktTrainerSubset {
  loadTrainText(text: string): this {
    return this.train(text);
  }
}

export class PunktSentenceTokenizerSubset {
  protected model: PunktModelSerialized;

  constructor(model?: PunktModelSerialized) {
    this.model = model ? parsePunktModel(model) : defaultPunktModel();
  }

  tokenize(text: string): string[] {
    return sentenceTokenizePunkt(text, this.model);
  }

  train(text: string, options: PunktTrainingOptions = {}): this {
    const trainer = new PunktTrainerSubset();
    trainer.train(text, options);
    this.model = trainer.getParams();
    return this;
  }

  getParams(): PunktModelSerialized {
    return parsePunktModel(this.model);
  }
}

export class PunktSentenceTokenizer extends PunktSentenceTokenizerSubset {
  setParams(model: PunktModelSerialized): this {
    this.model = parsePunktModel(model);
    return this;
  }
}

type PunktPreparedModel = {
  abbreviations: Set<string>;
  collocations: Set<string>;
  sentenceStarters: Set<string>;
  abbreviationScores: Map<string, number>;
  orthographicContext: Map<string, { lower: number; upper: number }>;
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
  const abbreviationScores = new Map<string, number>();
  const orthographicContext = new Map<string, { lower: number; upper: number }>();

  for (const abbr of model.abbreviations) {
    abbreviations.add(normalizeAbbrev(abbr));
  }
  for (const [left, right] of model.collocations) {
    collocations.add(`${normalizeAbbrev(left)}\u0001${right.toLowerCase()}`);
  }
  for (const starter of model.sentenceStarters) {
    sentenceStarters.add(starter.toLowerCase());
  }
  for (const [abbr, score] of Object.entries(model.abbreviationScores ?? {})) {
    abbreviationScores.set(normalizeAbbrev(abbr), score);
  }
  for (const [token, ctx] of Object.entries(model.orthographicContext ?? {})) {
    orthographicContext.set(token.toLowerCase(), {
      lower: Math.max(0, ctx.lower ?? 0),
      upper: Math.max(0, ctx.upper ?? 0),
    });
  }

  return {
    abbreviations,
    collocations,
    sentenceStarters,
    abbreviationScores,
    orthographicContext,
  };
}

function shouldSplitAt(text: string, punctIdx: number, model: PunktPreparedModel): boolean {
  const punct = text[punctIdx]!;
  const prev = punctIdx > 0 ? text[punctIdx - 1]! : "";
  const next = punctIdx + 1 < text.length ? text[punctIdx + 1]! : "";

  if (punct === "." && /\d/.test(prev) && /\d/.test(next)) return false;
  if (punct === "." && next === ".") return false;
  if (
    punct === "." &&
    /[A-Za-z]/.test(next) &&
    punctIdx + 2 < text.length &&
    text[punctIdx + 2] === "."
  ) {
    return false;
  }

  const prevToken = findPrevToken(text, punctIdx - 1);
  const prevNorm = normalizeAbbrev(prevToken);
  const look = findNextToken(text, punctIdx + 1);
  if (!look) return true;

  if (punct === "." && /^[A-Za-z]$/.test(prevNorm) && look.isUpperStart) {
    return false;
  }
  if (punct === "." && (prevNorm === "a.m" || prevNorm === "p.m")) {
    return false;
  }

  if (punct === "." && model.abbreviations.has(prevNorm)) {
    const abbrScore = model.abbreviationScores.get(prevNorm) ?? 0;
    const lookCtx = model.orthographicContext.get(look.lower);
    if (TITLE_ABBREVIATIONS.has(prevNorm) && look.isUpperStart) return false;
    if (look.isLowerStart) return false;
    if (lookCtx && lookCtx.lower > lookCtx.upper * 1.5) return false;
    const pairKey = `${prevNorm}\u0001${look.lower}`;
    if (model.collocations.has(pairKey)) return false;
    if (abbrScore >= 0.75 && !model.sentenceStarters.has(look.lower)) return false;
    if (!look.isUpperStart && !model.sentenceStarters.has(look.lower)) return false;
  }

  if (look.isUpperStart) return true;
  if (/[0-9]/.test(look.token[0]!)) return true;
  if (look.token[0] === '"' || look.token[0] === "'" || look.token[0] === "(") return true;
  if (punct === "!" || punct === "?") return true;
  if (look.isLowerStart && !model.sentenceStarters.has(look.lower)) return false;
  return true;
}

export function trainPunktModel(
  text: string,
  options: PunktTrainingOptions = {},
): PunktModelSerialized {
  return trainPunkt([text], options);
}

export function sentenceTokenizePunkt(text: string, model?: PunktModelSerialized): string[] {
  if (!model || model.version >= 2) return punktSentences(text, model ?? defaultPunktModel());
  const prepared = preparePunktModel(model);
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

export function sentenceTokenizePunktCompat(text: string, model?: PunktModelSerialized): string[] {
  return sentenceTokenizePunkt(text, model);
}

let cachedDefaultModel: PunktModelSerialized | null = null;

export function defaultPunktModel(): PunktModelSerialized {
  if (cachedDefaultModel) return cachedDefaultModel;
  cachedDefaultModel = {
    ...englishModel,
    collocations: englishModel.collocations.map((pair) => [pair[0]!, pair[1]!]),
  };
  return cachedDefaultModel;
}

export function serializePunktModel(model: PunktModelSerialized): string {
  return JSON.stringify(model);
}

export function parsePunktModel(payload: string | PunktModelSerialized): PunktModelSerialized {
  const parsed =
    typeof payload === "string" ? (JSON.parse(payload) as PunktModelSerialized) : payload;
  const abbreviations = Array.isArray(parsed.abbreviations) ? parsed.abbreviations : [];
  const collocations = Array.isArray(parsed.collocations) ? parsed.collocations : [];
  const sentenceStarters = Array.isArray(parsed.sentenceStarters) ? parsed.sentenceStarters : [];
  const abbreviationScores =
    parsed.abbreviationScores && typeof parsed.abbreviationScores === "object"
      ? parsed.abbreviationScores
      : {};
  const orthographicContext =
    parsed.orthographicContext && typeof parsed.orthographicContext === "object"
      ? parsed.orthographicContext
      : {};
  return {
    version: Number.isFinite(parsed.version) ? parsed.version : 1,
    orthoContext: { ...parsed.orthoContext },
    abbreviations: [...abbreviations],
    collocations: [...collocations],
    sentenceStarters: [...sentenceStarters],
    abbreviationScores: { ...abbreviationScores },
    orthographicContext: { ...orthographicContext },
  };
}
