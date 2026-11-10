/**
 * Shim for nltk.inference.prover9 — requires external Prover9/prooftrans binaries.
 * Preserves full API; all proof attempts throw with a helpful message.
 */

import { BaseProverCommand, Prover } from "./inference_api";
import {
  AllExpression,
  AndExpression,
  EqualityExpression,
  ExistsExpression,
  Expression,
  IffExpression,
  ImpExpression,
  NegatedExpression,
  OrExpression,
} from "./sem_logic";

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

/** Port of nltk.inference.prover9.convert_to_prover9 — pure string
 * transformation (no binary needed). Elements that fail conversion print the
 * diagnostic then re-raise, like NLTK. */
export function convertToProver9(input: Expression | Expression[]): string | string[] {
  if (Array.isArray(input)) {
    const result: string[] = [];
    for (const s of input) {
      try {
        result.push(_convertToProver9(s.simplify()));
      } catch (e) {
        console.log(`input ${input} cannot be converted to Prover9 input syntax`);
        throw e;
      }
    }
    return result;
  }
  try {
    return _convertToProver9(input.simplify());
  } catch (e) {
    console.log(`input ${input} cannot be converted to Prover9 input syntax`);
    throw e;
  }
}
// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function _convertToProver9(expression: Expression): string {
  if (expression instanceof ExistsExpression) {
    return "exists " + String(expression.variable) + " " + _convertToProver9(expression.term);
  } else if (expression instanceof AllExpression) {
    return "all " + String(expression.variable) + " " + _convertToProver9(expression.term);
  } else if (expression instanceof NegatedExpression) {
    return "-(" + _convertToProver9(expression.term) + ")";
  } else if (expression instanceof AndExpression) {
    return "(" + _convertToProver9(expression.first) + " & " + _convertToProver9(expression.second) + ")";
  } else if (expression instanceof OrExpression) {
    return "(" + _convertToProver9(expression.first) + " | " + _convertToProver9(expression.second) + ")";
  } else if (expression instanceof ImpExpression) {
    return "(" + _convertToProver9(expression.first) + " -> " + _convertToProver9(expression.second) + ")";
  } else if (expression instanceof IffExpression) {
    return "(" + _convertToProver9(expression.first) + " <-> " + _convertToProver9(expression.second) + ")";
  } else if (expression instanceof EqualityExpression) {
    return "(" + _convertToProver9(expression.first) + " = " + _convertToProver9(expression.second) + ")";
  }
  return expression.str();
}

/** Port of nltk.inference.prover9.spacer. */
export function spacer(num = 45): void {
  console.log("-".repeat(num));
}

/** Port of nltk.inference.prover9.test_convert_to_prover9 (pure — no binary). */
export function test_convert_to_prover9(expr: string[]): void {
  for (const t of expr) {
    const e = Expression.fromstring(t);
    console.log(convertToProver9(e));
  }
}
export const testConvertToProver9 = test_convert_to_prover9;

/** Port of nltk.inference.prover9.test_config — propagates the
 * external-binary error from prove() like NLTK without the binary. */
export function test_config(): void {
  const a = Expression.fromstring("(walk(j) & sing(j))");
  const g = Expression.fromstring("walk(j)");
  const p = new Prover9Command(g, [a]);
  (p as unknown as { _executablePath: unknown })._executablePath = null;
  (p as unknown as { prover9Search: unknown }).prover9Search = [];
  p.prove();
  console.log(p.prove());
  console.log(p.proof());
}
export const testConfig = test_config;

/** Port of nltk.inference.prover9.test_prove — propagates the
 * external-binary error from prove() like NLTK without the binary. */
export function test_prove(args: Array<[string, string[]]>): void {
  for (const [goal, assumptions] of args) {
    const g = Expression.fromstring(goal);
    const alist = assumptions.map((a) => Expression.fromstring(a));
    const p = new Prover9Command(g, alist).prove();
    for (const a of alist) console.log(`   ${a}`);
    console.log(`|- ${g}: ${p}\n`);
  }
}
export const testProve = test_prove;

/** Module-level demo argument lists (NLTK prover9.py module state).
 * NLTK names the second list ``arguments`` — a reserved word in JS modules,
 * so it is exported as ``arguments_``. */
export const arguments_: Array<[string, string[]]> = [
  ["(man(x) <-> (not (not man(x))))", []],
  ["(not (man(x) & (not man(x))))", []],
  ["(man(x) | (not man(x)))", []],
  ["(man(x) & (not man(x)))", []],
  ["(man(x) -> man(x))", []],
  ["(not (man(x) & (not man(x))))", []],
  ["(man(x) | (not man(x)))", []],
  ["(man(x) -> man(x))", []],
  ["(man(x) <-> man(x))", []],
  ["(not (man(x) <-> (not man(x))))", []],
  ["mortal(Socrates)", ["all x.(man(x) -> mortal(x))", "man(Socrates)"]],
  ["((all x.(man(x) -> walks(x)) & man(Socrates)) -> some y.walks(y))", []],
  ["(all x.man(x) -> all x.man(x))", []],
  ["some x.all y.sees(x,y)", []],
  [
    "some e3.(walk(e3) & subj(e3, mary))",
    ["some e1.(see(e1) & subj(e1, john) & some e2.(pred(e1, e2) & walk(e2) & subj(e2, mary)))"],
  ],
  [
    "some x e1.(see(e1) & subj(e1, x) & some e2.(pred(e1, e2) & walk(e2) & subj(e2, mary)))",
    ["some e1.(see(e1) & subj(e1, john) & some e2.(pred(e1, e2) & walk(e2) & subj(e2, mary)))"],
  ],
];

export const expressions = [
  "some x y.sees(x,y)",
  "some x.(man(x) & walks(x))",
  "\\x.(man(x) & walks(x))",
  "\\x y.sees(x,y)",
  "walks(john)",
  "\\x.big(x, \\y.mouse(y))",
  "(walks(x) & (runs(x) & (threes(x) & fours(x))))",
  "(walks(x) -> runs(x))",
  "some x.(PRO(x) & sees(John, x))",
  "some x.(man(x) & (not walks(x)))",
  "all x.(man(x) -> walks(x))",
];

/** Port of nltk.inference.prover9.demo — prints the section headers then hits
 * the external-binary wall in test_config, as NLTK does without prover9. */
export function demo(): void {
  console.log("Testing configuration");
  spacer();
  test_config();
  console.log();
  console.log("Testing conversion to Prover9 format");
  spacer();
  test_convert_to_prover9(expressions);
  console.log();
  console.log("Testing proofs");
  spacer();
  test_prove(arguments_);
}
export const prover9Demo = demo;
