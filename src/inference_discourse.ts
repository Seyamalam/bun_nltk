/**
 * Port of nltk.inference.discourse — discourse processing / consistency checking.
 * This module delegates to Mace/Prover9 for consistency/informativeness; since those
 * require external binaries, the reasoning methods are shimmed. The structural API
 * (ReadingCommand, CfgReadingCommand, DrtGlueReadingCommand, DiscourseTester) is preserved.
 */

import type { Expression } from "./sem_logic";

function externalError(name: string): never {
  throw new Error(
    `${name} requires external binaries (Mace4/Prover9) or a feature grammar not available in the JS runtime. ` +
      `See NLTK discourse docs; for pure-JS use, provide a custom ReadingCommand and use ResolutionProver/TableauProver directly.`,
  );
}

// ---------------------------------------------------------------------------
// ReadingCommand hierarchy
// ---------------------------------------------------------------------------

export abstract class ReadingCommand {
  abstract parseToReadings(sentence: string): Expression[];
  processThread(sentenceReadings: Expression[]): Expression[] { return sentenceReadings; }
  abstract combineReadings(readings: Expression[]): Expression;
  abstract toFol(expression: Expression): Expression;
}

export class CfgReadingCommand extends ReadingCommand {
  _gramfile: string;
  constructor(gramfile?: string) {
    super();
    this._gramfile = gramfile ?? "grammars/book_grammars/discourse.fcfg";
  }
  parseToReadings(_sentence: string): Expression[] { return externalError("CfgReadingCommand.parseToReadings"); }
  combineReadings(readings: Expression[]): Expression {
    void readings;
    return externalError("CfgReadingCommand.combineReadings");
  }
  toFol(expression: Expression): Expression { void expression; return externalError("CfgReadingCommand.toFol"); }
}

export class DrtGlueReadingCommand extends ReadingCommand {
  _semtypeFile: string;
  constructor(semtypeFile?: string, _removeDuplicates = false, _depparser?: unknown) {
    super();
    this._semtypeFile = semtypeFile ?? "grammars/sample_grammars/drt_glue.semtype";
  }
  parseToReadings(_sentence: string): Expression[] { return externalError("DrtGlueReadingCommand.parseToReadings"); }
  override processThread(_sentenceReadings: Expression[]): Expression[] { return externalError("DrtGlueReadingCommand.processThread"); }
  combineReadings(_readings: Expression[]): Expression { return externalError("DrtGlueReadingCommand.combineReadings"); }
  toFol(_expression: Expression): Expression { return externalError("DrtGlueReadingCommand.toFol"); }
}

// ---------------------------------------------------------------------------
// DiscourseTester
// ---------------------------------------------------------------------------

export interface DiscourseTesterOptions {
  readingCommand?: ReadingCommand;
  background?: Expression[];
}

export class DiscourseTester {
  _input: string[];
  _sentences: Record<string, string>;
  _readings: Record<string, Record<string, Expression>> = {};
  _threads: Record<string, string[]> = {};
  _filteredThreads: Record<string, string[]> = {};
  _readingCommand: ReadingCommand;
  _background: Expression[];
  _models: unknown = null;

  constructor(input: string[], readingCommand?: ReadingCommand, background?: Expression[]) {
    this._input = [...input];
    this._sentences = Object.fromEntries(input.map((s, i) => [`s${i}`, s]));
    this._readingCommand = readingCommand ?? new CfgReadingCommand();
    this._background = background ? [...background] : [];
  }

  sentences(): void {
    for (const id of Object.keys(this._sentences).sort()) console.log(`${id}: ${this._sentences[id]}`);
  }

  addSentence(sentence: string, _informchk = false, _consistchk = false): void {
    this._input.push(sentence);
    this._sentences = Object.fromEntries(this._input.map((s, i) => [`s${i}`, s]));
    // informchk / consistchk would call Mace/Prover9 — shimmed
    if (_informchk || _consistchk) externalError("DiscourseTester.addSentence([informchk|consistchk]=true)");
  }

  retractSentence(sentence: string, verbose = true): void {
    const idx = this._input.indexOf(sentence);
    if (idx === -1) {
      console.log(`Retraction failed. The sentence '${sentence}' is not part of the current discourse:`);
      this.sentences();
      return;
    }
    this._input.splice(idx, 1);
    this._sentences = Object.fromEntries(this._input.map((s, i) => [`s${i}`, s]));
    if (verbose) { console.log("Current sentences are "); this.sentences(); }
  }

  grammar(): void { externalError("DiscourseTester.grammar"); }

  // readings / threads — structural methods remain but delegate to ReadingCommand which shims
  readings(_sentence?: string, _threaded = false, _verbose = true, _filter = false, _showThreadReadings = false): void {
    externalError("DiscourseTester.readings");
  }

  expandThreads(threadId: string, threads?: Record<string, string[]>): Array<[string, Expression]> {
    const src = threads ?? this._threads;
    const tids = src[threadId];
    if (!tids) return [];
    const out: Array<[string, Expression]> = [];
    for (const rid of tids) {
      const sid = rid.split("-")[0]!;
      const reading = this._readings[sid]?.[rid];
      if (reading) out.push([rid, reading]);
    }
    return out;
  }

  models(_threadId?: string, _show = true, _verbose = false): void { externalError("DiscourseTester.models"); }

  addBackground(background: Expression[], _verbose = false): void {
    for (const e of background) {
      if (!e || typeof (e as Expression).str !== "function") throw new Error("background must be Expression[]");
    }
    this._background.push(...background);
  }

  background(): void {
    for (const e of this._background) console.log(String((e as Expression).str()));
  }

  // internal helpers preserved for parity
  multiply(threadList: string[][], readings: string[]): string[][] {
    const out: string[][] = [];
    for (const t of threadList) for (const r of readings) out.push([...t, r]);
    return out;
  }
}
