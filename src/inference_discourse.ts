/**
 * Port of nltk.inference.discourse — discourse processing / consistency checking.
 * This module delegates to Mace/Prover9 for consistency/informativeness; since those
 * require external binaries, the reasoning methods are shimmed. The structural API
 * (ReadingCommand, CfgReadingCommand, DrtGlueReadingCommand, DiscourseTester) is preserved.
 */

import {
  AbstractVariableExpression,
  ApplicationExpression,
  BinaryExpression,
  EqualityExpression,
  Expression,
  LambdaExpression,
  NegatedExpression,
  Variable,
} from "./sem_logic";
import {
  DRS,
  DrtApplicationExpression,
  DrtAbstractVariableExpression,
  DrtConcatenation,
  DrtEqualityExpression,
  DrtExpression,
  DrtIndividualVariableExpression,
  DrtLambdaExpression,
  DrtNegatedExpression,
  DrtTokens,
  DrtVariableExpression,
} from "./drt";

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

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/** Port of nltk.inference.discourse.spacer. */
export function spacer(num = 30): void {
  console.log("-".repeat(num));
}

/** Port of nltk.inference.discourse.load_fol (duplicated from nltk.sem.util):
 * convert a file of first-order formulas into a list of Expression objects.
 * Blank lines and '#'-prefixed comments are skipped; a bad line raises a
 * ValueError-shaped error naming the line number. */
export function load_fol(s: string): Expression[] {
  const statements: Expression[] = [];
  const lines = s.split("\n");
  for (let linenum = 0; linenum < lines.length; linenum++) {
    const line = lines[linenum]!.trim();
    if (line.startsWith("#") || line === "") continue;
    try {
      statements.push(Expression.fromstring(line));
    } catch (e) {
      const err = new Error(`Unable to parse line ${linenum}: ${line}`);
      err.name = "ValueError";
      err.cause = e;
      throw err;
    }
  }
  return statements;
}
export const loadFol = load_fol;

/** Grammar loading requires nltk.data.load + corpus resources — unsupported. */
export function load_parser(_grammarUrl: string, _trace = 0, _parser?: unknown, _chartClass?: unknown, _beamSize = 0, _loadArgs?: unknown): never {
  return externalError("load_parser");
}
export const loadParser = load_parser;

/** Resource dumping requires nltk.data.load — unsupported. */
export function show_cfg(_resourceUrl: string, _escape = "##"): never {
  return externalError("show_cfg");
}
export const showCfg = show_cfg;

// ---------------------------------------------------------------------------
// Anaphora resolution (nltk.sem.drt, re-exported through nltk.inference.discourse)
// ---------------------------------------------------------------------------

export class AnaphoraResolutionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnaphoraResolutionException";
  }
}

/** Port of nltk.sem.drt.PossibleAntecedents — a list that is also a
 * DrtExpression/Expression so it can sit on either side of an equality. */
export class PossibleAntecedents extends Array<Expression> {
  free(): Set<Variable> {
    return new Set(this.map((e) => (e as AbstractVariableExpression).variable));
  }
  replace(variable: Variable, expression: Expression, _replaceBound = false, _alphaConvert = true): PossibleAntecedents {
    const result = new PossibleAntecedents();
    for (const item of this) {
      // NLTK appends to self by quirk; result carries the same elements
      if ((item as AbstractVariableExpression).variable?.equals?.(variable)) {
        this.push(expression);
        result.push(expression);
      } else {
        result.push(item);
      }
    }
    return result;
  }
  override toString(): string {
    return "[" + this.map((it) => it.str()).join(",") + "]";
  }
  str(): string {
    return this.toString();
  }
}

export const MAX_ANAPHORA_OPERATIONS = 1_000_000;

export class AnaphoraBudget {
  remaining: number;
  limit: number;
  constructor(limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      const e = new Error(`MAX_ANAPHORA_OPERATIONS must be a positive int, got ${String(limit)}`);
      e.name = "ValueError";
      throw e;
    }
    this.remaining = limit;
    this.limit = limit;
  }
  spend(): void {
    this.remaining -= 1;
    if (this.remaining < 0) {
      throw new AnaphoraResolutionException(
        "Refusing to resolve anaphora: examining candidate antecedents " +
          `exceeded the limit of ${this.limit} (pronoun, referent) steps, which a DRS ` +
          "with many referents and pronouns reaches at O(n**2) time and " +
          "memory (CWE-770). Resolve a smaller discourse, or raise " +
          "nltk.sem.drt.MAX_ANAPHORA_OPERATIONS.",
      );
    }
  }
}

function isPronounFunction(expression: Expression): boolean {
  return (
    expression instanceof DrtApplicationExpression &&
    expression.function instanceof DrtAbstractVariableExpression &&
    (expression.function as DrtAbstractVariableExpression).variable.name === DrtTokens.PRONOUN &&
    expression.argument instanceof DrtIndividualVariableExpression
  );
}

function reconstruct(expression: Expression, ...args: Expression[]): Expression {
  const Ctor = expression.constructor as new (...a: Expression[]) => Expression;
  return new Ctor(...args);
}

function isBinaryish(expression: Expression): expression is BinaryExpression {
  return expression instanceof BinaryExpression ||
    expression instanceof DrtEqualityExpression ||
    expression instanceof DrtConcatenation ||
    (expression as unknown as { first?: unknown; second?: unknown }).first !== undefined &&
    (expression as unknown as { second?: unknown }).second !== undefined &&
    expression instanceof DrtExpression;
}

/** Port of nltk.sem.drt.resolve_anaphora (re-exported via
 * nltk.inference.discourse.resolve_anaphora). The class checks cover both the
 * FOL hierarchy and our flattened DRT hierarchy (Python multiple inheritance
 * collapses to separate Drt* classes here). */
export function resolve_anaphora(expression: Expression, trail: Expression[] = [], budget?: AnaphoraBudget): Expression | undefined {
  if (budget === undefined) budget = new AnaphoraBudget(MAX_ANAPHORA_OPERATIONS);
  if (expression instanceof ApplicationExpression || expression instanceof DrtApplicationExpression) {
    if (isPronounFunction(expression)) {
      const possibleAntecedents = new PossibleAntecedents();
      for (const ancestor of trail) {
        const refs = (ancestor as unknown as DrtExpression).getRefs ? (ancestor as unknown as DrtExpression).getRefs() : [];
        for (const ref of refs) {
          budget.spend();
          const refex = DrtVariableExpression(ref);
          // Don't allow resolution to itself or other types
          if (
            refex.constructor === expression.argument.constructor &&
            !refex.equals(expression.argument)
          ) {
            possibleAntecedents.push(refex);
          }
        }
      }
      const resolution: Expression | PossibleAntecedents =
        possibleAntecedents.length === 1 ? possibleAntecedents[0]! : possibleAntecedents;
      return new DrtEqualityExpression(expression.argument, resolution as unknown as Expression);
    }
    const appExpr = expression as ApplicationExpression;
    const rFunction = resolve_anaphora(appExpr.function, [...trail, expression], budget)!;
    const rArgument = resolve_anaphora(appExpr.argument, [...trail, expression], budget)!;
    return reconstruct(expression, rFunction, rArgument);
  }

  if (expression instanceof DRS) {
    const rConds: Expression[] = [];
    for (const cond of expression.conds) {
      const rCond = resolve_anaphora(cond, [...trail, expression], budget)!;
      // if the condition is of the form '(x = [])' then raise exception
      if (rCond instanceof EqualityExpression || rCond instanceof DrtEqualityExpression) {
        const eq = rCond as EqualityExpression;
        if (eq.first instanceof PossibleAntecedents) {
          // Reverse the order so that the variable is on the left
          const temp = eq.first;
          eq.first = eq.second;
          eq.second = temp;
        }
        if (eq.second instanceof PossibleAntecedents && eq.second.length === 0) {
          throw new AnaphoraResolutionException(
            `Variable '${eq.first}' does not resolve to anything.`,
          );
        }
      }
      rConds.push(rCond);
    }
    const consequent = expression.consequent
      ? resolve_anaphora(expression.consequent, [...trail, expression], budget)!
      : null;
    return new DRS(expression.refs, rConds, consequent);
  }

  if (expression instanceof AbstractVariableExpression) {
    return expression;
  }

  if (expression instanceof NegatedExpression || expression instanceof DrtNegatedExpression) {
    return reconstruct(
      expression,
      resolve_anaphora((expression as NegatedExpression).term, [...trail, expression], budget)!,
    );
  }

  if (expression instanceof DrtConcatenation) {
    const consequent = expression.consequent
      ? resolve_anaphora(expression.consequent, [...trail, expression], budget)!
      : null;
    return new DrtConcatenation(
      resolve_anaphora(expression.first, [...trail, expression], budget)!,
      resolve_anaphora(expression.second, [...trail, expression], budget)!,
      consequent,
    );
  }

  if (isBinaryish(expression)) {
    const bin = expression as unknown as { first: Expression; second: Expression };
    return reconstruct(
      expression,
      resolve_anaphora(bin.first, [...trail, expression], budget)!,
      resolve_anaphora(bin.second, [...trail, expression], budget)!,
    );
  }

  if (expression instanceof LambdaExpression || expression instanceof DrtLambdaExpression) {
    const lam = expression as LambdaExpression;
    return reconstruct(
      expression,
      lam.variable as unknown as Expression,
      resolve_anaphora(lam.term, [...trail, expression], budget)!,
    );
  }

  // NLTK falls off the end (returns None) for unhandled expression kinds.
  return undefined;
}
export const resolveAnaphora = resolve_anaphora;

// ---------------------------------------------------------------------------
// Demo drivers — faithful ports. Each hits the external wall (grammar-resource
// loading for readings, Mace4/Prover9 for models) at the same call where NLTK
// without those resources raises.
// ---------------------------------------------------------------------------

/** Port of nltk.inference.discourse.discourse_demo. */
export function discourse_demo(readingCommand?: ReadingCommand): void {
  let dt = new DiscourseTester(["A boxer walks", "Every boxer chases a girl"], readingCommand);
  dt.models();
  console.log();
  // dt.grammar()
  console.log();
  dt.sentences();
  console.log();
  dt.readings();
  console.log();
  dt.readings(undefined, true);
  console.log();
  dt.models("d1");
  dt.addSentence("John is a boxer");
  console.log();
  dt.sentences();
  console.log();
  dt.readings(undefined, true);
  console.log();
  dt = new DiscourseTester(
    ["A student dances", "Every student is a person"],
    readingCommand,
  );
  console.log();
  dt.addSentence("No person dances", false, true);
  console.log();
  dt.readings();
  console.log();
  dt.retractSentence("No person dances", true);
  console.log();
  dt.models();
  console.log();
  dt.readings("A person dances");
  console.log();
  dt.addSentence("A person dances", true);
  dt = new DiscourseTester(
    ["Vincent is a boxer", "Fido is a boxer", "Vincent is married", "Fido barks"],
    readingCommand,
  );
  dt.readings(undefined, false, true, true);
  // nltk.data.load("grammars/book_grammars/background.fol") — resource-bound
  const background = load_fol("");
  console.log();
  dt.addBackground(background, false);
  dt.background();
  console.log();
  dt.readings(undefined, false, true, true);
  console.log();
  dt.models();
}
export const discourseDemo = discourse_demo;

/** Port of nltk.inference.discourse.drt_discourse_demo. */
export function drt_discourse_demo(readingCommand?: ReadingCommand): void {
  const dt = new DiscourseTester(["every dog chases a boy", "he runs"], readingCommand);
  dt.models();
  console.log();
  dt.sentences();
  console.log();
  dt.readings();
  console.log();
  dt.readings(undefined, false, true, false, true);
  console.log();
  dt.readings(undefined, false, true, true, true);
}
export const drtDiscourseDemo = drt_discourse_demo;

/** Port of nltk.inference.discourse.demo. */
export function demo(): void {
  discourse_demo();
  // NLTK continues with a RegexpTagger + CfgReadingCommand demo block that
  // requires grammar resources; unreachable past the external wall above.
}
