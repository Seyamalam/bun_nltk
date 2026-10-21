import { trainPunkt } from "./punkt_trainer";
import englishModel from "./data/punkt-english.json";
import { punktSentences, punktSpans } from "./punkt_engine";
import { encodePunktModel, type PunktSpan } from "./punkt_wasm";
import { syncWasm } from "./sync_wasm";

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

export type PunktDebugDecision = {
  /** JavaScript UTF-16 index, unlike Python's code-point index. */
  period_index: number;
  text: string;
  type1: string;
  type2: string;
  type1_in_abbrs: boolean;
  type1_is_initial: boolean;
  type2_is_sent_starter: boolean;
  type2_ortho_heuristic: boolean | "unknown";
  type2_ortho_contexts: string[];
  collocation: boolean;
  reason: string;
  break_decision: boolean | null;
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
  get_params(): PunktModelSerialized { return this.getParams(); }
}

export class PunktTrainer extends PunktTrainerSubset {
  loadTrainText(text: string): this {
    return this.train(text);
  }
  load_train_text(text: string): this { return this.loadTrainText(text); }
}

export class PunktSentenceTokenizerSubset {
  protected model: PunktModelSerialized;

  constructor(model?: PunktModelSerialized) {
    this.model = model ? parsePunktModel(model) : defaultPunktModel();
  }

  tokenize(text: string, realignBoundaries = true): string[] {
    return sentenceTokenizePunkt(text, this.model, realignBoundaries);
  }

  /** UTF-16 offsets for the Rust NLTK inference model (version 2). */
  spanTokenize(text: string, realignBoundaries = true): PunktSpan[] {
    if (this.model.version < 2) throw new RangeError("spanTokenize requires a version 2 Punkt model");
    return punktSpans(text, this.model, realignBoundaries);
  }
  span_tokenize(text: string, realignBoundaries = true): PunktSpan[] { return this.spanTokenize(text, realignBoundaries); }

  debugDecisions(text: string): PunktDebugDecision[] {
    if (this.model.version < 2) throw new RangeError("debugDecisions requires a version 2 Punkt model");
    return syncWasm().punktRequest({ op: "debug", text, model: Array.from(encodePunktModel(this.model)) }) as PunktDebugDecision[];
  }
  debug_decisions(text: string): PunktDebugDecision[] { return this.debugDecisions(text); }

  train(text: string, options: PunktTrainingOptions = {}): this {
    const trainer = new PunktTrainerSubset();
    trainer.train(text, options);
    this.model = trainer.getParams();
    return this;
  }

  getParams(): PunktModelSerialized {
    return parsePunktModel(this.model);
  }
  get_params(): PunktModelSerialized { return this.getParams(); }
}

export class PunktSentenceTokenizer extends PunktSentenceTokenizerSubset {
  setParams(model: PunktModelSerialized): this {
    this.model = parsePunktModel(model);
    return this;
  }
  set_params(model: PunktModelSerialized): this { return this.setParams(model); }
}

export function trainPunktModel(
  text: string,
  options: PunktTrainingOptions = {},
): PunktModelSerialized {
  return trainPunkt([text], options);
}

export function sentenceTokenizePunkt(text: string, model?: PunktModelSerialized, realignBoundaries = true): string[] {
  if (!model || model.version >= 2) return punktSentences(text, model ?? defaultPunktModel(), realignBoundaries);
  if (!realignBoundaries) throw new RangeError("raw Punkt boundaries require a version 2 model");
  const units = Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
  const spans = syncWasm().punktRequest({ op: "legacy", units, model: {
    ...model,
    abbreviationScores: Object.entries(model.abbreviationScores ?? {}),
    orthographicContext: Object.entries(model.orthographicContext ?? {}),
  } }) as PunktSpan[];
  return spans.map(([start, end]) => text.slice(start, end));
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
