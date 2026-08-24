/**
 * Shim for nltk.inference.prover9 — requires external Prover9/prooftrans binaries.
 * Preserves full API; all proof attempts throw with a helpful message.
 */

import { BaseProverCommand, Prover } from "./inference_api";
import type { Expression } from "./sem_logic";

function externalError(name: string): never {
  throw new Error(
    `${name} requires the external Prover9 binary (prover9/prooftrans) which is not available in the JS runtime. ` +
      `Install Prover9 from https://www.cs.unm.edu/~mccune/prover9/ and use the Python NLTK, or use ResolutionProver/TableauProver for pure-JS proving.`,
  );
}

export const p9ReturnCodes: Record<number, string> = {
  0: "SUCCESS",
  1: "(FATAL)",
  2: "(SOS_EMPTY)",
  3: "(MAX_MEGS)",
  4: "(MAX_SECONDS)",
  5: "(MAX_GIVEN)",
  6: "(MAX_KEPT)",
  7: "(ACTION)",
  101: "(SIGSEGV)",
};

export class Prover9Exception extends Error {
  constructor(returncode: number, message?: string) {
    const msg = p9ReturnCodes[returncode] ?? String(returncode);
    super(message ? `${msg}\n${message}` : msg);
    this.name = "Prover9Exception";
  }
}
export class Prover9FatalException extends Prover9Exception {
  constructor(rc: number, msg?: string) { super(rc, msg); this.name = "Prover9FatalException"; }
}
export class Prover9LimitExceededException extends Prover9Exception {
  constructor(rc: number, msg?: string) { super(rc, msg); this.name = "Prover9LimitExceededException"; }
}

export class Prover9Parent {
  _binaryLocation: string | null = null;
  _prover9Bin: string | null = null;

  configProver9(_binaryLocation: string | null, _verbose = false): void {
    externalError("Prover9Parent.configProver9");
  }
  prover9Input(_goal: Expression | null, _assumptions: Expression[]): string {
    return externalError("Prover9Parent.prover9Input");
  }
  binaryLocations(): string[] {
    return ["/usr/local/bin/prover9", "/usr/local/bin/prover9/bin", "/usr/local/bin", "/usr/bin", "/usr/local/prover9", "/usr/local/share/prover9"];
  }
}

export class Prover9CommandParent extends Prover9Parent {
  printAssumptions(_outputFormat = "nltk"): void { externalError("Prover9CommandParent.printAssumptions"); }
}

export class Prover9 extends Prover9Parent implements Prover {
  _timeout: number;
  override _prover9Bin: string | null = null;
  _prooftransBin: string | null = null;

  constructor(timeout = 60) {
    super();
    this._timeout = timeout;
  }

  prove(_goal?: Expression | null, _assumptions?: Expression[] | null, _verbose = false): boolean {
    return externalError("Prover9.prove");
  }
  _prove(_goal?: Expression | null, _assumptions?: Expression[] | null, _verbose = false): [boolean, string] {
    return externalError("Prover9._prove");
  }
  override prover9Input(_goal: Expression | null, _assumptions: Expression[]): string {
    return externalError("Prover9.prover9Input");
  }
}

export class Prover9Command extends Prover9CommandParent {
  private _inner: BaseProverCommand;

  constructor(goal: Expression | null = null, assumptions: Expression[] | null = null, timeout = 60, prover: Prover | null = null) {
    super();
    const p = prover ?? new Prover9(timeout);
    // delegate to BaseProverCommand internally but all prove() will delegate to Prover9 which throws
    this._inner = new (class extends BaseProverCommand {
      constructor() { super(p, goal, assumptions); }
    })();
    // expose required fields for duck-typing
    (this as unknown as { _goal: unknown })._goal = goal;
    (this as unknown as { _assumptions: unknown })._assumptions = assumptions ?? [];
  }

  // TheoremToolCommand surface
  addAssumptions(newAssumptions: Expression[]): void { this._inner.addAssumptions(newAssumptions); }
  retractAssumptions(retracted: Expression[], debug = false): void { this._inner.retractAssumptions(retracted, debug); }
  assumptions(): Expression[] { return this._inner.assumptions(); }
  goal(): Expression | null { return this._inner.goal(); }
  override printAssumptions(outputFormat = "nltk"): void { void outputFormat; externalError("Prover9Command.printAssumptions"); }
  getProver(): Prover { return this._inner.getProver(); }
  prove(_verbose = false): boolean { return externalError("Prover9Command.prove"); }
  proof(_simplify = true): string { void _simplify; return externalError("Prover9Command.proof"); }
  decorateProof(_proofString: string, _simplify = true): string { return externalError("Prover9Command.decorateProof"); }
}

export function convertToProver9(input: Expression | Expression[]): string | string[] {
  void input;
  return externalError("convertToProver9");
}
