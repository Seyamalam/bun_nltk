/**
 * Shim for nltk.inference.mace — requires external Mace4 / interpformat binaries.
 */

import { BaseModelBuilderCommand, ModelBuilder } from "./inference_api";
import { Expression } from "./sem_logic";

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

  /** Port of MaceCommand._make_relation_set — convert a Mace4-style relation
   * table into a set of tuples. */
  static _makeRelationSet(numEntities: number, values: number[]): Set<string[]> {
    const r = new Set<string[]>();
    for (let position = 0; position < values.length; position++) {
      if (values[position] === 1) {
        r.add(MaceCommand._makeRelationTuple(position, values, numEntities));
      }
    }
    return r;
  }
  static _make_relation_set(numEntities: number, values: number[]): Set<string[]> {
    return MaceCommand._makeRelationSet(numEntities, values);
  }

  static _makeRelationTuple(position: number, values: number[], numEntities: number): string[] {
    if (values.length === 1) {
      return [];
    }
    const sublistSize = Math.floor(values.length / numEntities);
    const sublistStart = Math.floor(position / sublistSize);
    const sublistPosition = position % sublistSize;
    const sublist = values.slice(sublistStart * sublistSize, (sublistStart + 1) * sublistSize);
    return [
      MaceCommand._makeModelVar(sublistStart),
      ...MaceCommand._makeRelationTuple(sublistPosition, sublist, numEntities),
    ];
  }

  static _makeModelVar(value: number): string {
    // NLTK quirk: indexes the 26-letter list first, so value >= 26 raises
    // IndexError before the dead num-suffix branch can run.
    const letter = "abcdefghijklmnopqrstuvwxyz"[value];
    if (letter === undefined) throw pyError("IndexError", "list index out of range");
    const num = Math.floor(value / 26);
    return num > 0 ? letter + num : letter;
  }
  static _make_model_var(value: number): string {
    return MaceCommand._makeModelVar(value);
  }

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

import { pyError } from "./internals";

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/** Port of nltk.inference.mace.decode_result. */
export function decode_result(found: boolean | null): string {
  const table = new Map<unknown, string>([
    [true, "Countermodel found"],
    [false, "No countermodel found"],
    [null, "None"],
  ]);
  return table.get(found)!;
}
export const decodeResult = decode_result;

/** Port of nltk.inference.mace.spacer. */
export function spacer(num = 45): void {
  console.log("-".repeat(num));
}

function pyBool(b: boolean): string {
  return b ? "True" : "False";
}

function tupleSetEquals(set: Set<string[]>, expected: string[][]): boolean {
  if (set.size !== expected.length) return false;
  const keys = new Set([...set].map((t) => t.join("")));
  return expected.every((t) => keys.has(t.join("")));
}

/** Port of nltk.inference.mace.test_make_relation_set (pure — no binary). */
export function test_make_relation_set(): void {
  console.log(
    pyBool(
      tupleSetEquals(
        MaceCommand._makeRelationSet(3, [1, 0, 1]),
        [["c"], ["a"]],
      ),
    ),
  );
  console.log(
    pyBool(
      tupleSetEquals(
        MaceCommand._makeRelationSet(3, [0, 0, 0, 0, 0, 0, 1, 0, 0]),
        [["c", "a"]],
      ),
    ),
  );
  console.log(
    pyBool(
      tupleSetEquals(
        MaceCommand._makeRelationSet(2, [0, 0, 1, 0, 0, 0, 1, 0]),
        [
          ["a", "b", "a"],
          ["b", "b", "a"],
        ],
      ),
    ),
  );
}
export const testMakeRelationSet = test_make_relation_set;

/** Port of nltk.inference.mace.test_build_model — constructs a MaceCommand
 * and calls build_model(); without the Mace4 binary the build_model call
 * propagates the external-binary error, as NLTK does without the binary. */
export function test_build_model(_arguments?: unknown): void {
  const g = Expression.fromstring("all x.man(x)");
  const alist = [
    "man(John)",
    "man(Socrates)",
    "man(Bill)",
    "some x.(-(x = John) & man(x) & sees(John,x))",
    "some x.(-(x = Bill) & man(x))",
    "all x.some y.(man(x) -> gives(Socrates,x,y))",
  ].map((a) => Expression.fromstring(a));

  const m = new MaceCommand(g, alist);
  m.buildModel();
  spacer();
  console.log("Assumptions and Goal");
  spacer();
  for (const a of alist) console.log(`   ${a}`);
  console.log(`|- ${g}: ${decode_result(m.buildModel())}\n`);
  spacer();
  console.log("Valuation");
  spacer();
  console.log(m.valuation, "\n");
}
export const testBuildModel = test_build_model;

/** Port of nltk.inference.mace.test_model_found — propagates the
 * external-binary error from build_model like NLTK does without Mace4. */
export function test_model_found(args: Array<[string, string[]]>): void {
  for (const [goal, assumptions] of args) {
    const g = Expression.fromstring(goal);
    const alist = assumptions.map((a) => Expression.fromstring(a));
    const m = new MaceCommand(g, alist, 50);
    const found = m.buildModel();
    for (const a of alist) console.log(`   ${a}`);
    console.log(`|- ${g}: ${decode_result(found)}\n`);
  }
}
export const testModelFound = test_model_found;

/** Port of nltk.inference.mace.test_transform_output — propagates the
 * external-binary error from build_model/model like NLTK without Mace4. */
export function test_transform_output(argumentPair: [string, string[]]): void {
  const g = Expression.fromstring(argumentPair[0]);
  const alist = argumentPair[1].map((a) => Expression.fromstring(a));
  const m = new MaceCommand(g, alist);
  m.buildModel();
  for (const a of alist) console.log(`   ${a}`);
  console.log(`|- ${g}: ${m.buildModel()}\n`);
  for (const format of ["standard", "portable", "xml", "cooked"]) {
    spacer();
    console.log(`Using '${format}' format`);
    spacer();
    console.log(m.model(format));
  }
}
export const testTransformOutput = test_transform_output;

/** NLTK demo driver — binary-bound end to end; kept as a real function that
 * propagates the external-binary error at its first model build. */
export function demo(): void {
  const maceArgs: Array<[string, string[]]> = [
    ["mortal(Socrates)", ["all x.(man(x) -> mortal(x))", "man(Socrates)"]],
    ["(not mortal(Socrates))", ["all x.(man(x) -> mortal(x))", "man(Socrates)"]],
  ];
  test_model_found(maceArgs);
  test_build_model(maceArgs);
  test_transform_output(maceArgs[1]!);
}
