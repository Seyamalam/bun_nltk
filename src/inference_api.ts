/**
 * Port of nltk.inference.api — Prover / ModelBuilder interfaces and command bases.
 */

import type { Expression } from "./sem_logic";

// ---------------------------------------------------------------------------
// Abstract interfaces
// ---------------------------------------------------------------------------

export abstract class Prover {
  prove(goal: Expression | null = null, assumptions: Expression[] | null = null, verbose = false): boolean {
    return this._prove(goal, assumptions, verbose)[0];
  }
  abstract _prove(
    goal: Expression | null,
    assumptions: Expression[] | null,
    verbose?: boolean,
  ): [boolean, string | unknown];
}

export abstract class ModelBuilder {
  buildModel(goal: Expression | null = null, assumptions: Expression[] | null = null, verbose = false): boolean {
    return this._buildModel(goal, assumptions, verbose)[0];
  }
  abstract _buildModel(
    goal: Expression | null,
    assumptions: Expression[] | null,
    verbose?: boolean,
  ): [boolean, unknown];
}

// ---------------------------------------------------------------------------
// TheoremToolCommand family
// ---------------------------------------------------------------------------

export abstract class TheoremToolCommand {
  abstract addAssumptions(newAssumptions: Expression[]): void;
  abstract retractAssumptions(retracted: Expression[], debug?: boolean): void;
  abstract assumptions(): Expression[];
  abstract goal(): Expression | null;
  abstract printAssumptions(): void;
}

export abstract class ProverCommand extends TheoremToolCommand {
  abstract prove(verbose?: boolean): boolean;
  abstract proof(simplify?: boolean): string;
  abstract getProver(): Prover;
}

export abstract class ModelBuilderCommand extends TheoremToolCommand {
  abstract buildModel(verbose?: boolean): boolean;
  abstract model(format?: string | null): unknown;
  abstract getModelBuilder(): ModelBuilder;
}

// ---------------------------------------------------------------------------
// Base implementations
// ---------------------------------------------------------------------------

export class BaseTheoremToolCommand extends TheoremToolCommand {
  protected _goal: Expression | null;
  protected _assumptions: Expression[];
  protected _result: boolean | null = null;

  constructor(goal: Expression | null = null, assumptions: Expression[] | null = null) {
    super();
    this._goal = goal ?? null;
    this._assumptions = assumptions ? [...assumptions] : [];
  }

  addAssumptions(newAssumptions: Expression[]): void {
    this._assumptions.push(...newAssumptions);
    this._result = null;
  }

  retractAssumptions(retracted: Expression[], debug = false): void {
    const retractedSet = new Set(retracted.map((e) => e.str()));
    const filtered = this._assumptions.filter((a) => !retractedSet.has(a.str()));
    if (debug && filtered.length === this._assumptions.length) {
      console.warn("Assumptions list has not been changed:");
      this.printAssumptions();
    }
    this._assumptions = filtered;
    this._result = null;
  }

  assumptions(): Expression[] {
    return this._assumptions;
  }

  goal(): Expression | null {
    return this._goal;
  }

  printAssumptions(): void {
    for (const a of this.assumptions()) console.log(a.str());
  }
}

export class BaseProverCommand extends BaseTheoremToolCommand implements ProverCommand {
  protected _prover: Prover;
  protected _proof: string | unknown = null;

  constructor(prover: Prover, goal: Expression | null = null, assumptions: Expression[] | null = null) {
    super(goal, assumptions);
    this._prover = prover;
  }

  prove(verbose = false): boolean {
    if (this._result === null) {
      const [result, proof] = this._prover._prove(this.goal(), this.assumptions(), verbose);
      this._result = result;
      this._proof = proof;
    }
    return this._result!;
  }

  proof(_simplify = true): string {
    if (this._result === null) throw new Error("You have to call prove() first to get a proof!");
    return this.decorateProof(this._proof as string, _simplify);
  }

  decorateProof(proofString: string, _simplify = true): string {
    return proofString;
  }

  getProver(): Prover {
    return this._prover;
  }
}

export class BaseModelBuilderCommand extends BaseTheoremToolCommand implements ModelBuilderCommand {
  protected _modelbuilder: ModelBuilder;
  protected _model: unknown = null;

  constructor(modelbuilder: ModelBuilder, goal: Expression | null = null, assumptions: Expression[] | null = null) {
    super(goal, assumptions);
    this._modelbuilder = modelbuilder;
  }

  buildModel(verbose = false): boolean {
    if (this._result === null) {
      const [result, model] = this._modelbuilder._buildModel(this.goal(), this.assumptions(), verbose);
      this._result = result;
      this._model = model;
    }
    return this._result!;
  }

  model(_format: string | null = null): unknown {
    if (this._result === null) throw new Error("You have to call buildModel() first to get a model!");
    return this._decorateModel(this._model as string, _format);
  }

  protected _decorateModel(valuationStr: string, _format: string | null = null): unknown {
    return valuationStr;
  }

  getModelBuilder(): ModelBuilder {
    return this._modelbuilder;
  }
}

// ---------------------------------------------------------------------------
// Decorators
// ---------------------------------------------------------------------------

export class TheoremToolCommandDecorator extends TheoremToolCommand {
  protected _command: TheoremToolCommand;
  protected _result: boolean | null = null;

  constructor(command: TheoremToolCommand) {
    super();
    this._command = command;
  }

  assumptions(): Expression[] {
    return this._command.assumptions();
  }
  goal(): Expression | null {
    return this._command.goal();
  }
  addAssumptions(newAssumptions: Expression[]): void {
    this._command.addAssumptions(newAssumptions);
    this._result = null;
  }
  retractAssumptions(retracted: Expression[], debug = false): void {
    this._command.retractAssumptions(retracted, debug);
    this._result = null;
  }
  printAssumptions(): void {
    this._command.printAssumptions();
  }
}

export class ProverCommandDecorator extends TheoremToolCommandDecorator implements ProverCommand {
  protected _proof: string | unknown = null;

  constructor(proverCommand: ProverCommand) {
    super(proverCommand as unknown as TheoremToolCommand);
  }

  prove(verbose = false): boolean {
    if (this._result === null) {
      const prover = this.getProver();
      const [result, proof] = prover._prove(this.goal(), this.assumptions(), verbose);
      this._result = result;
      this._proof = proof;
    }
    return this._result!;
  }

  proof(simplify = true): string {
    if (this._result === null) throw new Error("You have to call prove() first to get a proof!");
    return this.decorateProof(this._proof as string, simplify);
  }

  decorateProof(proofString: string, simplify = true): string {
    const cmd = this._command as unknown as BaseProverCommand;
    if (typeof (cmd as unknown as { decorateProof?: unknown }).decorateProof === "function") {
      return (cmd as unknown as { decorateProof(s: string, b: boolean): string }).decorateProof(proofString, simplify);
    }
    return proofString;
  }

  getProver(): Prover {
    return (this._command as unknown as ProverCommand).getProver();
  }
}

export class ModelBuilderCommandDecorator extends TheoremToolCommandDecorator implements ModelBuilderCommand {
  protected _model: unknown = null;

  constructor(modelBuilderCommand: ModelBuilderCommand) {
    super(modelBuilderCommand as unknown as TheoremToolCommand);
  }

  buildModel(verbose = false): boolean {
    if (this._result === null) {
      const mb = this.getModelBuilder();
      const [result, model] = mb._buildModel(this.goal(), this.assumptions(), verbose);
      this._result = result;
      this._model = model;
    }
    return this._result!;
  }

  model(format: string | null = null): unknown {
    if (this._result === null) throw new Error("You have to call buildModel() first to get a model!");
    return this._decorateModel(this._model as string, format);
  }

  protected _decorateModel(valuationStr: string, format: string | null = null): unknown {
    const cmd = this._command as unknown as BaseModelBuilderCommand;
    const fn = (cmd as unknown as { _decorateModel?: (s: string, f: string | null) => unknown })._decorateModel;
    if (typeof fn === "function") return fn.call(cmd, valuationStr, format);
    return valuationStr;
  }

  getModelBuilder(): ModelBuilder {
    return (this._command as unknown as ModelBuilderCommand).getModelBuilder();
  }
}

// ---------------------------------------------------------------------------
// Parallel prover/model-builder + thread shim
// ---------------------------------------------------------------------------

/** Port of nltk.inference.api.TheoremToolThread (threading.Thread subclass in
 * NLTK). JavaScript has no preemptive threads, so start() executes run()
 * synchronously; because theorem commands here are synchronous this preserves
 * NLTK's observable semantics: run() stores the command result or, on error,
 * prints the exception and leaves result null ("completed abnormally"). */
export class TheoremToolThread {
  _command: () => boolean;
  _result: boolean | null = null;
  _verbose: boolean;
  _name: string | null;
  _alive = false;
  _daemon = false;

  constructor(command: () => boolean, verbose: boolean, name: string | null = null) {
    this._command = command;
    this._verbose = verbose;
    this._name = name;
  }

  run(): void {
    this._alive = true;
    try {
      this._result = this._command();
      if (this._verbose) {
        console.log(
          `Thread ${this._name} finished with result ${this._result} at ${new Date().toLocaleTimeString()}`,
        );
      }
    } catch (e) {
      console.log(e instanceof Error ? e.message : e);
      console.log(`Thread ${this._name} completed abnormally`);
    } finally {
      this._alive = false;
    }
  }

  start(): void {
    this.run();
  }

  isAlive(): boolean {
    return this._alive;
  }

  is_alive(): boolean {
    return this.isAlive();
  }

  /** threading.Thread shims — no-ops/state in the synchronous JS port. */
  getName(): string | null {
    return this._name;
  }
  setName(name: string): void {
    this._name = name;
  }
  isDaemon(): boolean {
    return this._daemon;
  }
  setDaemon(daemonic: boolean): void {
    this._daemon = daemonic;
  }
  join(_timeout?: number): void {
    // commands already ran synchronously in start(); nothing to wait for.
  }

  get result(): boolean | null {
    return this._result;
  }
}

/** Port of nltk.inference.api.ParallelProverBuilder — runs prover and model
 * builder in parallel; whichever finishes first supplies the result. Here the
 * commands are synchronous so the prover thread always completes first; a
 * throwing prover yields result null and the model builder's (negated) result
 * is used, matching NLTK's thread-caught-exception path. */
export class ParallelProverBuilder extends Prover {
  _prover: Prover;
  _modelbuilder: ModelBuilder;

  constructor(prover: Prover, modelbuilder: ModelBuilder) {
    super();
    this._prover = prover;
    this._modelbuilder = modelbuilder;
  }

  _prove(
    goal: Expression | null = null,
    assumptions: Expression[] | null = null,
    verbose = false,
  ): [boolean, string] {
    return [this._run(goal, assumptions, verbose), ""];
  }

  _buildModel(
    goal: Expression | null = null,
    assumptions: Expression[] | null = null,
    verbose = false,
  ): [boolean, string] {
    return [!this._run(goal, assumptions, verbose), ""];
  }

  // ModelBuilder duck-type surface (Python multiple inheritance flattened)
  buildModel(goal: Expression | null = null, assumptions: Expression[] | null = null, verbose = false): boolean {
    return this._buildModel(goal, assumptions, verbose)[0];
  }

  _run(goal: Expression | null, assumptions: Expression[] | null, verbose: boolean): boolean {
    const tpThread = new TheoremToolThread(
      () => this._prover.prove(goal, assumptions, verbose),
      verbose,
      "TP",
    );
    const mbThread = new TheoremToolThread(
      () => this._modelbuilder.buildModel(goal, assumptions, verbose),
      verbose,
      "MB",
    );

    tpThread.start();
    mbThread.start();

    while (tpThread.isAlive() && mbThread.isAlive()) {
      // wait until either the prover or the model builder is done
    }

    if (tpThread.result !== null) {
      return tpThread.result;
    } else if (mbThread.result !== null) {
      return !mbThread.result;
    } else {
      return null as unknown as boolean;
    }
  }
}

/** Port of nltk.inference.api.ParallelProverBuilderCommand — multiple
 * inheritance (BaseProverCommand, BaseModelBuilderCommand) flattened to a
 * BaseProverCommand subclass holding an extra _modelbuilder. */
export class ParallelProverBuilderCommand extends BaseProverCommand {
  _modelbuilder: ModelBuilder;
  protected _model: unknown = null;

  constructor(
    prover: Prover,
    modelbuilder: ModelBuilder,
    goal: Expression | null = null,
    assumptions: Expression[] | null = null,
  ) {
    super(prover, goal, assumptions);
    this._modelbuilder = modelbuilder;
  }

  override prove(verbose = false): boolean {
    return this._run(verbose);
  }

  buildModel(verbose = false): boolean {
    return !this._run(verbose);
  }

  _run(verbose: boolean): boolean {
    const tpThread = new TheoremToolThread(
      () => super.prove(verbose),
      verbose,
      "TP",
    );
    const mbThread = new TheoremToolThread(
      () => {
        if (this._result === null) {
          const [result, model] = this._modelbuilder._buildModel(this.goal(), this.assumptions(), verbose);
          this._result = result;
          this._model = model;
        }
        return this._result!;
      },
      verbose,
      "MB",
    );

    tpThread.start();
    mbThread.start();

    while (tpThread.isAlive() && mbThread.isAlive()) {
      // wait until either the prover or the model builder is done
    }

    if (tpThread.result !== null) {
      this._result = tpThread.result;
    } else if (mbThread.result !== null) {
      this._result = !mbThread.result;
    }
    return this._result!;
  }

  getModelBuilder(): ModelBuilder {
    return this._modelbuilder;
  }

  /** ``model()`` from NLTK's BaseModelBuilderCommand (PPBC multiply-inherits
   * it there; TS has single inheritance so the method is repeated). */
  model(format: string | null = null): unknown {
    if (this._result === null) throw new Error("You have to call buildModel() first to get a model!");
    return this._decorateModel(this._model as string, format);
  }

  protected _decorateModel(valuationStr: string, _format: string | null = null): unknown {
    if (typeof valuationStr !== "string") return valuationStr;
    throw new Error(
      "Decoding a Mace4 valuation string requires the external interpformat binary, which is not available in the JS runtime.",
    );
  }
}
