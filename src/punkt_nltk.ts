// Faithful port of nltk.tokenize.punkt (NLTK 3.10.3): the mutable object
// model — PunktLanguageVars, PunktToken, PunktParameters, PunktBaseClass,
// PunktTrainer, PunktSentenceTokenizer, PunktTokenizer — plus the tab-file
// loaders and format_debug_decision. The Rust/WASM engine in punkt.ts
// remains the fast path for sent_tokenize(); this module provides the
// NLTK API surface and incremental-trainer semantics.
import { FreqDist } from "./freqdist";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// { Orthographic Context Constants
export const _ORTHO_BEG_UC = 1 << 1;
export const _ORTHO_MID_UC = 1 << 2;
export const _ORTHO_UNK_UC = 1 << 3;
export const _ORTHO_BEG_LC = 1 << 4;
export const _ORTHO_MID_LC = 1 << 5;
export const _ORTHO_UNK_LC = 1 << 6;
export const _ORTHO_UC = _ORTHO_BEG_UC + _ORTHO_MID_UC + _ORTHO_UNK_UC;
export const _ORTHO_LC = _ORTHO_BEG_LC + _ORTHO_MID_LC + _ORTHO_UNK_LC;

const _ORTHO_MAP = new Map<string, number>([
  ["initial,upper", _ORTHO_BEG_UC], ["internal,upper", _ORTHO_MID_UC],
  ["unknown,upper", _ORTHO_UNK_UC], ["initial,lower", _ORTHO_BEG_LC],
  ["internal,lower", _ORTHO_MID_LC], ["unknown,lower", _ORTHO_UNK_LC],
]);

// { Decision reasons for debugging
export const REASON_DEFAULT_DECISION = "default decision";
export const REASON_KNOWN_COLLOCATION = "known collocation (both words)";
export const REASON_ABBR_WITH_ORTHOGRAPHIC_HEURISTIC = "abbreviation + orthographic heuristic";
export const REASON_ABBR_WITH_SENTENCE_STARTER = "abbreviation + frequent sentence starter";
export const REASON_INITIAL_WITH_ORTHOGRAPHIC_HEURISTIC = "initial + orthographic heuristic";
export const REASON_NUMBER_WITH_ORTHOGRAPHIC_HEURISTIC = "initial + orthographic heuristic";
export const REASON_INITIAL_WITH_SPECIAL_ORTHOGRAPHIC_HEURISTIC = "initial + special orthographic heuristic";

function pyEscapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class PunktLanguageVars {
  sent_end_chars: string[] = [".", "?", "!"];
  internal_punctuation = ",:;";
  re_boundary_realignment = /["')\]}‘’“«»]+?(?:\s+|(?=--)|$)/my;

  get _re_sent_end_chars(): string {
    return `[${pyEscapeRe(this.sent_end_chars.join(""))}]`;
  }

  _re_word_start = "[^()\"`{[:;&#*@)\\],-]";

  get _re_non_word_chars(): string {
    const rest = this.sent_end_chars.filter((c) => c !== ".").join("");
    return `(?:[)";}\\]\\*:@'({\\[‘’“«»${pyEscapeRe(rest)}])`;
  }

  _re_multi_char_punct = "(?:-{2,}|\\.{2,}|(?:\\.\\s){2,}\\.)";

  private _re_word_tokenizer?: RegExp;

  _word_tokenizer_re(): RegExp {
    if (this._re_word_tokenizer) return this._re_word_tokenizer;
    const nonWord = this._re_non_word_chars;
    const multiChar = this._re_multi_char_punct;
    const wordStart = this._re_word_start;
    const fmt = `(${multiChar}|(?=${wordStart})\\S+?(?=\\s|$|${nonWord}|${multiChar}|,(?=$|\\s|${nonWord}|${multiChar}))|\\S)`;
    this._re_word_tokenizer = new RegExp(fmt, "gu");
    return this._re_word_tokenizer;
  }

  word_tokenize(s: string): string[] {
    return [...s.matchAll(this._word_tokenizer_re())].map((m) => m[1]!);
  }

  private _re_period_context?: RegExp;

  period_context_re(): RegExp {
    if (this._re_period_context) return this._re_period_context;
    const nonWord = this._re_non_word_chars;
    const sentEnd = this._re_sent_end_chars;
    const fmt = `${sentEnd}(?=(?<after_tok>${nonWord}|\\s+(?<next_tok>\\S+)))`;
    this._re_period_context = new RegExp(fmt, "gu");
    return this._re_period_context;
  }
}

const _re_non_punct = /[^\W\d]/u;

// { Helper Functions

function* _pair_iter<T>(iterator: Iterable<T>): Generator<[T, T | null]> {
  const it = iterator[Symbol.iterator]();
  let r = it.next();
  if (r.done) return;
  let prev = r.value;
  for (r = it.next(); !r.done; r = it.next()) {
    yield [prev, r.value];
    prev = r.value;
  }
  yield [prev, null];
}

// { Punkt Parameters

export class PunktParameters {
  abbrev_types = new Set<string>();
  collocations = new Set<string>();
  sent_starters = new Set<string>();
  ortho_context = new Map<string, number>();

  clear_abbrevs(): void {
    this.abbrev_types = new Set();
  }
  clear_collocations(): void {
    this.collocations = new Set();
  }
  clear_sent_starters(): void {
    this.sent_starters = new Set();
  }
  clear_ortho_context(): void {
    this.ortho_context = new Map();
  }
  add_ortho_context(typ: string, flag: number): void {
    this.ortho_context.set(typ, (this.ortho_context.get(typ) ?? 0) | flag);
  }
  *_debug_ortho_context(typ: string): Generator<string> {
    const context = this.ortho_context.get(typ) ?? 0;
    if (context & _ORTHO_BEG_UC) yield "BEG-UC";
    if (context & _ORTHO_MID_UC) yield "MID-UC";
    if (context & _ORTHO_UNK_UC) yield "UNK-UC";
    if (context & _ORTHO_BEG_LC) yield "BEG-LC";
    if (context & _ORTHO_MID_LC) yield "MID-LC";
    if (context & _ORTHO_UNK_LC) yield "UNK-LC";
  }
}

// Collocations are stored as "\x00"-joined pairs (types never contain NUL).
const collocKey = (a: string, b: string) => `${a}\x00${b}`;

// { PunktToken

const _RE_ELLIPSIS = /^\.\.+$/;
const _RE_NUMERIC = /^-?[.,]?\d[\d,.-]*\.?$/;
const _RE_INITIAL = /^[^\W\d]\.$/u;
const _RE_ALPHA = /^[^\W\d]+$/u;

export class PunktToken {
  static readonly _properties = ["parastart", "linestart", "sentbreak", "abbr", "ellipsis"] as const;

  tok: string;
  type: string;
  period_final: boolean;
  parastart: boolean | null = null;
  linestart: boolean | null = null;
  sentbreak: boolean | null = null;
  abbr: boolean | null = null;
  ellipsis: boolean | null = null;

  constructor(tok: string, params: Record<string, boolean> = {}) {
    this.tok = tok;
    this.type = tok.toLowerCase().replace(_RE_NUMERIC, "##number##");
    this.period_final = tok.endsWith(".");
    Object.assign(this, params);
  }

  get type_no_period(): string {
    if (this.type.length > 1 && this.type.endsWith(".")) return this.type.slice(0, -1);
    return this.type;
  }

  get type_no_sentperiod(): string {
    if (this.sentbreak) return this.type_no_period;
    return this.type;
  }

  get first_upper(): boolean {
    const c = this.tok[0]!;
    return c !== c.toLowerCase();
  }

  get first_lower(): boolean {
    const c = this.tok[0]!;
    return c !== c.toUpperCase();
  }

  get first_case(): string {
    if (this.first_lower) return "lower";
    if (this.first_upper) return "upper";
    return "none";
  }

  get is_ellipsis(): boolean {
    return _RE_ELLIPSIS.test(this.tok);
  }

  get is_number(): boolean {
    return this.type.startsWith("##number##");
  }

  get is_initial(): boolean {
    return _RE_INITIAL.test(this.tok);
  }

  get is_alpha(): boolean {
    return _RE_ALPHA.test(this.tok);
  }

  get is_non_punct(): boolean {
    return _re_non_punct.test(this.type);
  }

  repr(): string {
    const typestr = this.type !== this.tok ? ` type=${pyStrRepr(this.type)},` : "";
    const propvals = PunktToken._properties
      .filter((p) => (this as Record<string, unknown>)[p])
      .map((p) => `${p}=${pyStrRepr((this as Record<string, unknown>)[p])}`)
      .join(", ");
    return `PunktToken(${pyStrRepr(this.tok)},${typestr} ${propvals})`;
  }

  toString(): string {
    let res = this.tok;
    if (this.abbr) res += "<A>";
    if (this.ellipsis) res += "<E>";
    if (this.sentbreak) res += "<S>";
    return res;
  }
}

function pyStrRepr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  const s = String(v);
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"')) return `"${s}"`;
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// { Punkt base class

export class PunktBaseClass {
  protected _params: PunktParameters;
  protected _lang_vars: PunktLanguageVars;
  protected _Token: typeof PunktToken;

  constructor(lang_vars?: PunktLanguageVars, token_cls?: typeof PunktToken, params?: PunktParameters) {
    this._lang_vars = lang_vars ?? new PunktLanguageVars();
    this._Token = token_cls ?? PunktToken;
    this._params = params ?? new PunktParameters();
  }

  *_tokenize_words(plaintext: string): Generator<PunktToken> {
    let parastart = false;
    for (const line of plaintext.split("\n")) {
      if (line.trim()) {
        const lineToks = this._lang_vars.word_tokenize(line);
        if (lineToks.length === 0) continue;
        let first = true;
        for (const tok of lineToks) {
          if (first) {
            yield new this._Token(tok, { parastart, linestart: true });
            parastart = false;
            first = false;
          } else {
            yield new this._Token(tok);
          }
        }
      } else {
        parastart = true;
      }
    }
  }

  *_annotate_first_pass(tokens: Iterable<PunktToken>): Generator<PunktToken> {
    for (const aug_tok of tokens) {
      this._first_pass_annotation(aug_tok);
      yield aug_tok;
    }
  }

  _first_pass_annotation(aug_tok: PunktToken): void {
    const tok = aug_tok.tok;
    if (this._lang_vars.sent_end_chars.includes(tok)) {
      aug_tok.sentbreak = true;
    } else if (aug_tok.is_ellipsis) {
      aug_tok.ellipsis = true;
    } else if (aug_tok.period_final && !tok.endsWith("..")) {
      const lower = tok.slice(0, -1).toLowerCase();
      if (this._params.abbrev_types.has(lower) || this._params.abbrev_types.has(lower.split("-").pop()!)) {
        aug_tok.abbr = true;
      } else {
        aug_tok.sentbreak = true;
      }
    }
  }
}

// { Punkt Trainer

export class PunktTrainer extends PunktBaseClass {
  protected _type_fdist = new FreqDist<string | null>();
  protected _num_period_toks = 0;
  protected _collocation_fdist = new FreqDist<string | null>();
  protected _sent_starter_fdist = new FreqDist<string | null>();
  protected _sentbreak_count = 0;
  protected _finalized = true;

  ABBREV = 0.3;
  IGNORE_ABBREV_PENALTY = false;
  ABBREV_BACKOFF = 5;
  COLLOCATION = 7.88;
  SENT_STARTER = 30;
  INCLUDE_ALL_COLLOCS = false;
  INCLUDE_ABBREV_COLLOCS = false;
  MIN_COLLOC_FREQ = 1;

  constructor(
    train_text?: string,
    verbose = false,
    lang_vars?: PunktLanguageVars,
    token_cls?: typeof PunktToken,
  ) {
    super(lang_vars, token_cls);
    if (train_text) this.train(train_text, verbose, true);
  }

  get_params(): PunktParameters {
    if (!this._finalized) this.finalize_training();
    return this._params;
  }

  getParams(): PunktParameters {
    return this.get_params();
  }

  train(text: string, verbose = false, finalize = true): void {
    this._train_tokens([...this._tokenize_words(text)], verbose);
    if (finalize) this.finalize_training(verbose);
  }

  train_tokens(tokens: Iterable<string>, verbose = false, finalize = true): void {
    const toks = [...tokens].map((t) => new this._Token(t));
    this._train_tokens(toks, verbose);
    if (finalize) this.finalize_training(verbose);
  }

  trainTokens(tokens: Iterable<string>, verbose = false, finalize = true): void {
    this.train_tokens(tokens, verbose, finalize);
  }

  _train_tokens(tokens: PunktToken[], verbose: boolean): void {
    this._finalized = false;

    for (const aug_tok of tokens) {
      this._type_fdist.inc(aug_tok.type);
      if (aug_tok.period_final) this._num_period_toks += 1;
    }

    const unique_types = this._unique_types(tokens);
    for (const [abbr, score, is_add] of this._reclassify_abbrev_types(unique_types)) {
      if (score >= this.ABBREV) {
        if (is_add) {
          this._params.abbrev_types.add(abbr);
          if (verbose) console.log(`  Abbreviation: [${score.toFixed(4).padStart(6)}] ${abbr}`);
        }
      } else {
        if (!is_add) {
          this._params.abbrev_types.delete(abbr);
          if (verbose) console.log(`  Removed abbreviation: [${score.toFixed(4).padStart(6)}] ${abbr}`);
        }
      }
    }

    tokens = [...this._annotate_first_pass(tokens)];

    this._get_orthography_data(tokens);

    this._sentbreak_count += this._get_sentbreak_count(tokens);

    for (const [aug_tok1, aug_tok2] of _pair_iter(tokens)) {
      if (!aug_tok1.period_final || !aug_tok2) continue;

      if (this._is_rare_abbrev_type(aug_tok1, aug_tok2)) {
        this._params.abbrev_types.add(aug_tok1.type_no_period);
        if (verbose) console.log(`  Rare Abbrev: ${aug_tok1.type}`);
      }

      if (this._is_potential_sent_starter(aug_tok2, aug_tok1)) {
        this._sent_starter_fdist.inc(aug_tok2.type);
      }

      if (this._is_potential_collocation(aug_tok1, aug_tok2)) {
        this._collocation_fdist.inc(collocKey(aug_tok1.type_no_period, aug_tok2.type_no_sentperiod));
      }
    }
  }

  _unique_types(tokens: PunktToken[]): Set<string> {
    return new Set(tokens.map((t) => t.type));
  }

  finalize_training(verbose = false): void {
    this._params.clear_sent_starters();
    for (const [typ, log_likelihood] of this._find_sent_starters()) {
      this._params.sent_starters.add(typ);
      if (verbose) console.log(`  Sent Starter: [${log_likelihood.toFixed(4).padStart(6)}] ${pyStrRepr(typ)}`);
    }

    this._params.clear_collocations();
    for (const [pair, log_likelihood] of this._find_collocations()) {
      this._params.collocations.add(pair);
      if (verbose) {
        const [t1, t2] = pair.split("\x00");
        console.log(`  Collocation: [${log_likelihood.toFixed(4).padStart(6)}] ${pyStrRepr(t1)}+${pyStrRepr(t2)}`);
      }
    }

    this._finalized = true;
  }

  finalizeTraining(verbose = false): void {
    this.finalize_training(verbose);
  }

  freq_threshold(ortho_thresh = 2, type_thresh = 2, colloc_thres = 2, sentstart_thresh = 2): void {
    const old_oc = this._params.ortho_context;
    this._params.clear_ortho_context();
    for (const tok of this._type_fdist.samples()) {
      if (tok === null) continue;
      const count = this._type_fdist.get(tok);
      if (count >= ortho_thresh) {
        this._params.ortho_context.set(tok, old_oc.get(tok) ?? 0);
      }
    }

    this._type_fdist = this._freq_threshold(this._type_fdist, type_thresh);
    this._collocation_fdist = this._freq_threshold(this._collocation_fdist, colloc_thres);
    this._sent_starter_fdist = this._freq_threshold(this._sent_starter_fdist, sentstart_thresh);
  }

  freqThreshold(ortho_thresh = 2, type_thresh = 2, colloc_thres = 2, sentstart_thresh = 2): void {
    this.freq_threshold(ortho_thresh, type_thresh, colloc_thres, sentstart_thresh);
  }

  _freq_threshold(fdist: FreqDist<string | null>, threshold: number): FreqDist<string | null> {
    const res = new FreqDist<string | null>();
    let num_removed = 0;
    for (const tok of fdist.samples()) {
      const count = fdist.get(tok);
      if (count < threshold) num_removed += 1;
      else res.inc(tok, count);
    }
    res.inc(null, num_removed);
    return res;
  }

  // { Orthographic data

  _get_orthography_data(tokens: PunktToken[]): void {
    let context = "internal";
    tokens = [...tokens];

    for (const aug_tok of tokens) {
      if (aug_tok.parastart && context !== "unknown") context = "initial";
      if (aug_tok.linestart && context === "internal") context = "unknown";

      const typ = aug_tok.type_no_sentperiod;
      const flag = _ORTHO_MAP.get(`${context},${aug_tok.first_case}`) ?? 0;
      if (flag) this._params.add_ortho_context(typ, flag);

      if (aug_tok.sentbreak) {
        context = aug_tok.is_number || aug_tok.is_initial ? "unknown" : "initial";
      } else if (aug_tok.ellipsis || aug_tok.abbr) {
        context = "unknown";
      } else {
        context = "internal";
      }
    }
  }

  // { Abbreviations

  *_reclassify_abbrev_types(types: Iterable<string>): Generator<[string, number, boolean]> {
    for (let typ of types) {
      if (!_re_non_punct.test(typ) || typ === "##number##") continue;

      let is_add: boolean;
      if (typ.endsWith(".")) {
        if (this._params.abbrev_types.has(typ)) continue;
        typ = typ.slice(0, -1);
        is_add = true;
      } else {
        if (!this._params.abbrev_types.has(typ)) continue;
        is_add = false;
      }

      const num_periods = (typ.match(/\./g) ?? []).length + 1;
      const num_nonperiods = typ.length - num_periods + 1;

      const count_with_period = this._type_fdist.get(typ + ".");
      const count_without_period = this._type_fdist.get(typ);
      const log_likelihood = PunktTrainer._dunning_log_likelihood(
        count_with_period + count_without_period,
        this._num_period_toks,
        count_with_period,
        this._type_fdist.N(),
      );

      const f_length = Math.exp(-num_nonperiods);
      const f_periods = num_periods;
      const f_penalty = this.IGNORE_ABBREV_PENALTY ? 1 : Math.pow(num_nonperiods, -count_without_period);
      const score = log_likelihood * f_length * f_periods * f_penalty;

      yield [typ, score, is_add];
    }
  }

  find_abbrev_types(): void {
    this._params.clear_abbrevs();
    const types = this._type_fdist.samples().filter((t): t is string => !!t && t.endsWith("."));
    for (const [abbr, score] of this._reclassify_abbrev_types(types)) {
      if (score >= this.ABBREV) this._params.abbrev_types.add(abbr);
    }
  }

  findAbbrevTypes(): void {
    this.find_abbrev_types();
  }

  _is_rare_abbrev_type(cur_tok: PunktToken, next_tok: PunktToken): boolean {
    if (cur_tok.abbr || !cur_tok.sentbreak) return false;

    const typ = cur_tok.type_no_sentperiod;
    const count = this._type_fdist.get(typ) + this._type_fdist.get(typ.slice(0, -1));
    if (this._params.abbrev_types.has(typ) || count >= this.ABBREV_BACKOFF) return false;

    if (this._lang_vars.internal_punctuation.includes(next_tok.tok[0] ?? "")) return true;

    if (next_tok.first_lower) {
      const typ2 = next_tok.type_no_sentperiod;
      const typ2ortho_context = this._params.ortho_context.get(typ2) ?? 0;
      if ((typ2ortho_context & _ORTHO_BEG_UC) && !(typ2ortho_context & _ORTHO_MID_UC)) {
        return true;
      }
    }
    return false;
  }

  // { Log Likelihoods

  static _dunning_log_likelihood(count_a: number, count_b: number, count_ab: number, N: number): number {
    const p1 = count_b / N;
    const p2 = 0.99;

    const null_hypo = count_ab * Math.log(p1 + 1e-8) + (count_a - count_ab) * Math.log(1.0 - p1 + 1e-8);
    const alt_hypo = count_ab * Math.log(p2) + (count_a - count_ab) * Math.log(1.0 - p2);

    return -2.0 * (null_hypo - alt_hypo);
  }

  static _col_log_likelihood(count_a: number, count_b: number, count_ab: number, N: number): number {
    const p = count_b / N;
    const p1 = count_ab / count_a;
    let p2: number;
    try {
      p2 = (count_b - count_ab) / (N - count_a);
      if (!Number.isFinite(p2)) throw new Error("div");
    } catch {
      p2 = 1;
    }

    let summand1 = 0, summand2 = 0, summand3 = 0, summand4 = 0;
    try {
      summand1 = count_ab * Math.log(p) + (count_a - count_ab) * Math.log(1.0 - p);
      if (!Number.isFinite(summand1)) summand1 = 0;
    } catch { summand1 = 0; }

    try {
      summand2 = (count_b - count_ab) * Math.log(p) + (N - count_a - count_b + count_ab) * Math.log(1.0 - p);
      if (!Number.isFinite(summand2)) summand2 = 0;
    } catch { summand2 = 0; }

    if (!(count_a === count_ab || p1 <= 0 || p1 >= 1)) {
      summand3 = count_ab * Math.log(p1) + (count_a - count_ab) * Math.log(1.0 - p1);
    }

    if (!(count_b === count_ab || p2 <= 0 || p2 >= 1)) {
      summand4 = (count_b - count_ab) * Math.log(p2) + (N - count_a - count_b + count_ab) * Math.log(1.0 - p2);
    }

    return -2.0 * (summand1 + summand2 - summand3 - summand4);
  }

  // { Collocation Finder

  _is_potential_collocation(aug_tok1: PunktToken, aug_tok2: PunktToken): boolean {
    return (
      (this.INCLUDE_ALL_COLLOCS ||
        (this.INCLUDE_ABBREV_COLLOCS && !!aug_tok1.abbr) ||
        (!!aug_tok1.sentbreak && (aug_tok1.is_number || aug_tok1.is_initial))) &&
      aug_tok1.is_non_punct &&
      aug_tok2.is_non_punct
    );
  }

  *_find_collocations(): Generator<[string, number]> {
    for (const types of this._collocation_fdist.samples()) {
      if (types === null) continue;
      const [typ1, typ2] = types.split("\x00") as [string, string];
      if (typ2 === undefined) continue;
      if (this._params.sent_starters.has(typ2)) continue;

      const col_count = this._collocation_fdist.get(types);
      const typ1_count = this._type_fdist.get(typ1) + this._type_fdist.get(typ1 + ".");
      const typ2_count = this._type_fdist.get(typ2) + this._type_fdist.get(typ2 + ".");
      if (typ1_count > 1 && typ2_count > 1 && this.MIN_COLLOC_FREQ < col_count && col_count <= Math.min(typ1_count, typ2_count)) {
        const log_likelihood = PunktTrainer._col_log_likelihood(typ1_count, typ2_count, col_count, this._type_fdist.N());
        if (log_likelihood >= this.COLLOCATION && this._type_fdist.N() / typ1_count > typ2_count / col_count) {
          yield [types, log_likelihood];
        }
      }
    }
  }

  // { Sentence-Starter Finder

  _is_potential_sent_starter(cur_tok: PunktToken, prev_tok: PunktToken): boolean {
    return !!prev_tok.sentbreak && !(prev_tok.is_number || prev_tok.is_initial) && cur_tok.is_alpha;
  }

  *_find_sent_starters(): Generator<[string, number]> {
    for (const typ of this._sent_starter_fdist.samples()) {
      if (!typ) continue;

      const typ_at_break_count = this._sent_starter_fdist.get(typ);
      const typ_count = this._type_fdist.get(typ) + this._type_fdist.get(typ + ".");
      if (typ_count < typ_at_break_count) continue;

      const log_likelihood = PunktTrainer._col_log_likelihood(
        this._sentbreak_count,
        typ_count,
        typ_at_break_count,
        this._type_fdist.N(),
      );

      if (log_likelihood >= this.SENT_STARTER && this._type_fdist.N() / this._sentbreak_count > typ_count / typ_at_break_count) {
        yield [typ, log_likelihood];
      }
    }
  }

  _get_sentbreak_count(tokens: Iterable<PunktToken>): number {
    let n = 0;
    for (const t of tokens) if (t.sentbreak) n += 1;
    return n;
  }
}

// { Punkt Sentence Tokenizer

type Span = [number, number];

type EndContextMatch = {
  start: number;
  end: number;
  text: string;
  after_tok: string;
  next_tok_start: number;
};

export class PunktSentenceTokenizer extends PunktBaseClass {
  constructor(train_text?: string | PunktParameters, verbose = false, lang_vars?: PunktLanguageVars, token_cls?: typeof PunktToken) {
    super(lang_vars, token_cls);
    if (train_text) this._params = this.train(train_text, verbose);
  }

  train(train_text: string | PunktParameters, verbose = false): PunktParameters {
    if (typeof train_text !== "string") return train_text;
    return new PunktTrainer(train_text, verbose, this._lang_vars, this._Token).get_params();
  }

  get _params_accessor(): PunktParameters {
    return this._params;
  }

  get params(): PunktParameters {
    return this._params;
  }

  tokenize(text: string, realign_boundaries = true): string[] {
    return this.sentences_from_text(text, realign_boundaries);
  }

  *debug_decisions(text: string): Generator<Record<string, unknown>> {
    for (const [match, decision_text] of this._match_potential_end_contexts(text)) {
      let tokens = [...this._annotate_first_pass(this._tokenize_words(decision_text))];
      while (tokens.length && !this._lang_vars.sent_end_chars.some((c) => tokens[0]!.tok.endsWith(c))) {
        tokens = tokens.slice(1);
      }
      yield {
        period_index: match.end - 1,
        text: decision_text,
        type1: tokens[0]!.type,
        type2: tokens[1]!.type,
        type1_in_abbrs: !!tokens[0]!.abbr,
        type1_is_initial: tokens[0]!.is_initial,
        type2_is_sent_starter: this._params.sent_starters.has(tokens[1]!.type_no_sentperiod),
        type2_ortho_heuristic: this._ortho_heuristic(tokens[1]!),
        type2_ortho_contexts: new Set(this._params._debug_ortho_context(tokens[1]!.type_no_sentperiod)),
        collocation: this._params.collocations.has(collocKey(tokens[0]!.type_no_sentperiod, tokens[1]!.type_no_sentperiod)),
        reason: this._second_pass_annotation(tokens[0]!, tokens[1]!) ?? REASON_DEFAULT_DECISION,
        break_decision: tokens[0]!.sentbreak,
      };
    }
  }

  *span_tokenize(text: string, realign_boundaries = true): Generator<Span> {
    let slices = this._slices_from_text(text);
    if (realign_boundaries) slices = this._realign_boundaries(text, slices);
    yield* slices;
  }

  spanTokenize(text: string, realign_boundaries = true): Span[] {
    return [...this.span_tokenize(text, realign_boundaries)];
  }

  sentences_from_text(text: string, realign_boundaries = true): string[] {
    return [...this.span_tokenize(text, realign_boundaries)].map(([s, e]) => text.slice(s, e));
  }

  sentencesFromText(text: string, realign_boundaries = true): string[] {
    return this.sentences_from_text(text, realign_boundaries);
  }

  _get_last_whitespace_index(text: string): number {
    for (let i = text.length - 1; i >= 0; i--) {
      if (/\s/.test(text[i]!)) return i;
    }
    return 0;
  }

  *_match_potential_end_contexts(text: string): Generator<[EndContextMatch, string]> {
    const re = this._lang_vars.period_context_re();
    let previous_slice: Span = [0, 0];
    let previous_match: EndContextMatch | null = null;
    for (const match of text.matchAll(re)) {
      const mStart = match.index!;
      const mEnd = mStart + match[0].length;
      const afterTok = match.groups?.["after_tok"] ?? "";
      const nextTok = match.groups?.["next_tok"];
      const next_tok_start = nextTok ? mEnd + afterTok.length - nextTok.length : -1;

      const before_text = text.slice(previous_slice[1], mStart);
      let index_after_last_space = this._get_last_whitespace_index(before_text);
      if (index_after_last_space) {
        index_after_last_space += previous_slice[1] + 1;
      } else {
        index_after_last_space = previous_slice[0];
      }
      const prev_word_slice: Span = [index_after_last_space, mStart];

      if (previous_match && previous_slice[1] <= prev_word_slice[0]) {
        yield [previous_match, text.slice(previous_slice[0], previous_slice[1]) + previous_match.text + previous_match.after_tok];
      }
      previous_match = { start: mStart, end: mEnd, text: match[0], after_tok: afterTok, next_tok_start };
      previous_slice = prev_word_slice;
    }

    if (previous_match) {
      yield [previous_match, text.slice(previous_slice[0], previous_slice[1]) + previous_match.text + previous_match.after_tok];
    }
  }

  *_slices_from_text(text: string): Generator<Span> {
    let last_break = 0;
    for (const [match, context] of this._match_potential_end_contexts(text)) {
      if (this.text_contains_sentbreak(context)) {
        yield [last_break, match.end];
        last_break = match.next_tok_start >= 0 ? match.next_tok_start : match.end;
      }
    }
    yield [last_break, text.trimEnd().length];
  }

  *_realign_boundaries(text: string, slices: Iterable<Span>): Generator<Span> {
    let realign = 0;
    for (const [sentence1_raw, sentence2] of _pair_iter(slices)) {
      const sentence1: Span = [sentence1_raw[0] + realign, sentence1_raw[1]];
      if (!sentence2) {
        if (text.slice(sentence1[0], sentence1[1])) yield sentence1;
        continue;
      }

      this._lang_vars.re_boundary_realignment.lastIndex = 0;
      const m = this._lang_vars.re_boundary_realignment.exec(text.slice(sentence2[0], sentence2[1]));
      if (m) {
        yield [sentence1[0], sentence2[0] + m[0].trimEnd().length];
        realign = m[0].length;
      } else {
        realign = 0;
        if (text.slice(sentence1[0], sentence1[1])) yield sentence1;
      }
    }
  }

  text_contains_sentbreak(text: string): boolean {
    let found = false;
    for (const tok of this._annotate_tokens(this._tokenize_words(text))) {
      if (found) return true;
      if (tok.sentbreak) found = true;
    }
    return false;
  }

  textContainsSentbreak(text: string): boolean {
    return this.text_contains_sentbreak(text);
  }

  *sentences_from_text_legacy(text: string): Generator<string> {
    const tokens = this._annotate_tokens(this._tokenize_words(text));
    yield* this._build_sentence_list(text, tokens);
  }

  *sentences_from_tokens(tokens: Iterable<string>): Generator<string[]> {
    const toks = this._annotate_tokens([...tokens].map((t) => new this._Token(t)));
    let sentence: string[] = [];
    for (const aug_tok of toks) {
      sentence.push(aug_tok.tok);
      if (aug_tok.sentbreak) {
        yield sentence;
        sentence = [];
      }
    }
    if (sentence.length) yield sentence;
  }

  *_annotate_tokens(tokens: Iterable<PunktToken>): Generator<PunktToken> {
    const first = this._annotate_first_pass(tokens);
    yield* this._annotate_second_pass(first);
  }

  *_build_sentence_list(text: string, tokens: Iterable<PunktToken>): Generator<string> {
    let pos = 0;
    const white_space_regexp = /\s*/y;
    let sentence = "";
    for (const aug_tok of tokens) {
      let tok = aug_tok.tok;

      white_space_regexp.lastIndex = pos;
      const white_space = white_space_regexp.exec(text)![0];
      pos += white_space.length;

      if (text.slice(pos, pos + tok.length) !== tok) {
        const pat = [...tok].map((c) => pyEscapeRe(c)).join("\\s*");
        const m = new RegExp(pat, "y");
        m.lastIndex = pos;
        const mm = m.exec(text);
        if (mm) tok = mm[0];
      }

      pos += tok.length;

      if (sentence) sentence += white_space;
      sentence += tok;

      if (aug_tok.sentbreak) {
        yield sentence;
        sentence = "";
      }
    }
    if (sentence) yield sentence;
  }

  dump(tokens: Iterable<PunktToken>): void {
    let out = "";
    for (const aug_tok of tokens) {
      if (aug_tok.parastart) out += "\n\n";
      else if (aug_tok.linestart) out += "\n";
      else out += " ";
      out += String(aug_tok);
    }
    console.log(out);
  }

  // { Customization Variables
  PUNCTUATION = [";", ":", ",", ".", "!", "?"];

  // { Annotation Procedures

  *_annotate_second_pass(tokens: Iterable<PunktToken>): Generator<PunktToken> {
    for (const [token1, token2] of _pair_iter(tokens)) {
      this._second_pass_annotation(token1, token2);
      yield token1;
    }
  }

  _second_pass_annotation(aug_tok1: PunktToken, aug_tok2: PunktToken | null): string | undefined {
    if (!aug_tok2) return undefined;
    if (!aug_tok1.period_final) return undefined;

    const typ = aug_tok1.type_no_period;
    const next_typ = aug_tok2.type_no_sentperiod;
    const tok_is_initial = aug_tok1.is_initial;

    if (this._params.collocations.has(collocKey(typ, next_typ))) {
      aug_tok1.sentbreak = false;
      aug_tok1.abbr = true;
      return REASON_KNOWN_COLLOCATION;
    }

    if ((aug_tok1.abbr || aug_tok1.ellipsis) && !tok_is_initial) {
      const is_sent_starter = this._ortho_heuristic(aug_tok2);
      if (is_sent_starter === true) {
        aug_tok1.sentbreak = true;
        return REASON_ABBR_WITH_ORTHOGRAPHIC_HEURISTIC;
      }
      if (aug_tok2.first_upper && this._params.sent_starters.has(next_typ)) {
        aug_tok1.sentbreak = true;
        return REASON_ABBR_WITH_SENTENCE_STARTER;
      }
    }

    if (tok_is_initial || typ === "##number##") {
      const is_sent_starter = this._ortho_heuristic(aug_tok2);
      if (is_sent_starter === false) {
        aug_tok1.sentbreak = false;
        aug_tok1.abbr = true;
        if (tok_is_initial) return REASON_INITIAL_WITH_ORTHOGRAPHIC_HEURISTIC;
        return REASON_NUMBER_WITH_ORTHOGRAPHIC_HEURISTIC;
      }
      if (
        is_sent_starter === "unknown" &&
        tok_is_initial &&
        aug_tok2.first_upper &&
        !((this._params.ortho_context.get(next_typ) ?? 0) & _ORTHO_LC)
      ) {
        aug_tok1.sentbreak = false;
        aug_tok1.abbr = true;
        return REASON_INITIAL_WITH_SPECIAL_ORTHOGRAPHIC_HEURISTIC;
      }
    }
    return undefined;
  }

  _ortho_heuristic(aug_tok: PunktToken): boolean | "unknown" {
    if (this.PUNCTUATION.includes(aug_tok.tok)) return false;

    const ortho_context = this._params.ortho_context.get(aug_tok.type_no_sentperiod) ?? 0;

    if (aug_tok.first_upper && (ortho_context & _ORTHO_LC) && !(ortho_context & _ORTHO_MID_UC)) {
      return true;
    }

    if (aug_tok.first_lower && (ortho_context & _ORTHO_UC || !(ortho_context & _ORTHO_BEG_LC))) {
      return false;
    }

    return "unknown";
  }

  tokenize_sents(strings: readonly string[]): string[][] {
    return strings.map((s) => this.tokenize(s));
  }

  *span_tokenize_sents(strings: readonly string[]): Generator<Span[]> {
    for (const s of strings) yield [...this.span_tokenize(s)];
  }
}

export class PunktTokenizer extends PunktSentenceTokenizer {
  private _lang = "english";

  constructor(lang = "english") {
    super();
    this.load_lang(lang);
  }

  load_lang(lang = "english"): void {
    const lang_dir = `tokenizers/punkt_tab/${lang}/`;
    this._params = load_punkt_params(resolveDataDir(lang_dir));
    this._lang = lang;
  }

  loadLang(lang = "english"): void {
    this.load_lang(lang);
  }

  save_params(): void {
    save_punkt_params(this._params, `/tmp/${this._lang}`);
  }

  saveParams(): void {
    this.save_params();
  }
}

function resolveDataDir(rel: string): string {
  const roots = (process.env["NLTK_DATA"] ? [process.env["NLTK_DATA"]] : [])
    .concat(["./nltk_data", "./.cache/nltk-data"]);
  for (const root of roots) {
    const p = join(root, rel);
    if (existsSync(p)) return p;
  }
  return rel;
}

// PunktDecoder equivalents: .tab → pairs, .txt → set of lines.
function tab2tups(text: string): Array<[string, string]> {
  return text.split("\n").filter((l) => l.includes("\t")).map((l) => {
    const i = l.indexOf("\t");
    return [l.slice(0, i), l.slice(i + 1).replace(/\r?\n$/, "")];
  });
}

function txt2set(text: string): Set<string> {
  return new Set(text.split("\n").map((l) => l.replace(/\r?\n$/, "")).filter((l) => l.length > 0));
}

function tab2intdict(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of text.split("\n")) {
    const i = line.indexOf("\t");
    if (i < 0) continue;
    m.set(line.slice(0, i), parseInt(line.slice(i + 1), 10));
  }
  return m;
}

export function load_punkt_params(lang_dir: string): PunktParameters {
  const params = new PunktParameters();
  const read = (name: string) => readFileSync(join(lang_dir, name), "utf8");
  params.collocations = new Set(tab2tups(read("collocations.tab")).map(([a, b]) => collocKey(a, b)));
  params.sent_starters = txt2set(read("sent_starters.txt"));
  params.abbrev_types = txt2set(read("abbrev_types.txt"));
  params.ortho_context = tab2intdict(read("ortho_context.tab"));
  return params;
}

export function loadPunktParams(lang_dir: string): PunktParameters {
  return load_punkt_params(lang_dir);
}

export function save_punkt_params(params: PunktParameters, dir = "/tmp/punkt_tab"): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tups = [...params.collocations].map((k) => {
    const [a, b] = k.split("\x00");
    return `${a}\t${b}`;
  }).sort().join("\n");
  writeFileSync(join(dir, "collocations.tab"), tups + (tups ? "\n" : ""));
  writeFileSync(join(dir, "sent_starters.txt"), [...params.sent_starters].sort().join("\n") + "\n");
  writeFileSync(join(dir, "abbrev_types.txt"), [...params.abbrev_types].sort().join("\n") + "\n");
  writeFileSync(
    join(dir, "ortho_context.tab"),
    [...params.ortho_context].map(([t, n]) => `${t}\t${n}`).sort().join("\n") + "\n",
  );
}

export function savePunktParams(params: PunktParameters, dir = "/tmp/punkt_tab"): void {
  save_punkt_params(params, dir);
}

const DEBUG_DECISION_FMT = `Text: {text} (at offset {period_index})
Sentence break? {break_decision} ({reason})
Collocation? {collocation}
{type1}:
    known abbreviation: {type1_in_abbrs}
    is initial: {type1_is_initial}
{type2}:
    known sentence starter: {type2_is_sent_starter}
    orthographic heuristic suggests is a sentence starter? {type2_ortho_heuristic}
    orthographic contexts in training: {type2_ortho_contexts}
`;

const _REPR_FIELDS = new Set(["text", "type1", "type2"]);

export function format_debug_decision(d: Record<string, unknown>): string {
  const fill = (k: string) => {
    const v = d[k];
    if (v instanceof Set) {
      if (v.size === 0) return "set()";
      return `{${[...v].map(pyStrRepr).join(", ")}}`;
    }
    if (_REPR_FIELDS.has(k)) return pyStrRepr(v);
    // {name} (str) formatting: True/False/None, bare "unknown", numbers.
    if (v === null || v === undefined) return "None";
    if (typeof v === "boolean") return v ? "True" : "False";
    return String(v);
  };
  return DEBUG_DECISION_FMT.replace(/\{(\w+)\}/g, (_, k: string) => fill(k));
}
