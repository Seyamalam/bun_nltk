/**
 * Shim for nltk.inference.mace — requires external Mace4 / interpformat binaries.
 */

import { BaseModelBuilderCommand, ModelBuilder } from "./inference_api";
import type { Expression } from "./sem_logic";

function externalError(name: string): never {
  throw new Error(
    `${name} requires the external Mace4 binary (mace4/interpformat) which is not available in the JS runtime. ` +
      `Install Mace4 from https://www.cs.unm.edu/~mccune/mace4/ and use the Python NLTK, or use TableauProver/ResolutionProver for pure-JS reasoning.`,
  );
}

export class MaceCommand extends BaseModelBuilderCommand {
  _interpformatBin: string | null = null;

  constructor(goal: Expression | null = null, assumptions: Expression[] | null = null, maxModels = 500, modelBuilder: ModelBuilder | null = null) {
    const mb = modelBuilder ?? new Mace(maxModels);
    super(mb, goal, assumptions);
  }

  get valuation(): unknown { return externalError("MaceCommand.valuation"); }

  // ModelBuilderCommand surface — all throw
  override buildModel(_verbose = false): boolean { return externalError("MaceCommand.buildModel"); }
  override model(_format: string | null = null): unknown { return externalError("MaceCommand.model"); }

  override printAssumptions(_outputFormat = "nltk"): void { externalError("MaceCommand.printAssumptions"); }
}

export class Mace extends ModelBuilder {
  _mace4Bin: string | null = null;
  _endSize: number;

  constructor(endSize = 500) {
    super();
    this._endSize = endSize;
  }

  override _buildModel(_goal?: Expression | null, _assumptions?: Expression[] | null, _verbose = false): [boolean, string] {
    return externalError("Mace._buildModel");
  }

  // Compatibility helpers mirroring Prover9Parent
  configProver9(_binaryLocation: string | null, _verbose = false): void { externalError("Mace.configProver9"); }
  prover9Input(_goal: Expression | null, _assumptions: Expression[]): string { return externalError("Mace.prover9Input"); }
  binaryLocations(): string[] { return ["/usr/local/bin/prover9","/usr/local/bin/mace4"]; }
}
