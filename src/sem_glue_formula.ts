/**
 * Port of nltk.sem.glue + nltk.sem.linearlogic — Glue Semantics framework.
 *
 * Main Glue Semantics framework (Dan Garrette). Depends on sem_logic for
 * meaning language (FOL) and sem_linearlogic for the linear-logic fragment.
 * Corpus-dependent parts (GlueDict file loading, dependency parsing) throw
 * helpful errors with a corpus-missing message.
 */

import {
  AbstractVariableExpression,
  Expression as FolExpression,
  LambdaExpression,
  LogicParser,
  Variable,
  makeVariableExpression,
} from "./sem_logic";
import {
  ApplicationExpression as LLApplicationExpression,
  AtomicExpression as LLAtomicExpression,
  BindingDict,
  ConstantExpression as LLConstantExpression,
  Expression as LLExpression,
  type GlueFormulaLike,
  ImpExpression as LLImpExpression,
  LinearLogicApplicationException,
  LinearLogicParser,
  VariableExpression as LLVariableExpression,
} from "./sem_linearlogic";

// ---------------------------------------------------------------------------
// Re-exports for callers that previously imported from sem.linearlogic
// ---------------------------------------------------------------------------
export {
  BindingDict,
  LinearLogicApplicationException,
  LinearLogicParser,
  LLApplicationExpression as LinearApplicationExpression,
  LLAtomicExpression as LinearAtomicExpression,
  LLConstantExpression as LinearConstantExpression,
  LLExpression as LinearExpression,
  LLImpExpression as LinearImpExpression,
  LLVariableExpression as LinearVariableExpression,
};
export { UnificationException, VariableBindingException } from "./sem_linearlogic";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const SPEC_SEMTYPES: Record<string, string> = {
  a: "ex_quant",
  an: "ex_quant",
  every: "univ_quant",
  the: "def_art",
  no: "no_quant",
  default: "ex_quant",
};
export const OPTIONAL_RELATIONSHIPS: string[] = ["nmod", "vmod", "punct"];

// ---------------------------------------------------------------------------
// Counter helper (mirrors nltk.internals.Counter)
// ---------------------------------------------------------------------------
export class Counter {
  private n = 0;
  get(): number { return ++this.n; }
  peek(): number { return this.n; }
}

// ---------------------------------------------------------------------------
// GlueFormula
// ---------------------------------------------------------------------------
export type GlueFormulaFactory = (meaning: string, glue: LLExpression, indices: Set<number>) => GlueFormula;

export class GlueFormula {
  meaning: FolExpression;
  glue: LLExpression;
  indices: Set<number>;
  /** optional word label set by GlueDict */
  word?: string;

  constructor(meaning: string | FolExpression, glue: string | LLExpression, indices?: Set<number>) {
    this.indices = indices ? new Set(indices) : new Set();
    if (typeof meaning === "string") {
      this.meaning = new LogicParser().parse(meaning);
    } else {
      this.meaning = meaning;
    }
    if (typeof glue === "string") {
      this.glue = new LinearLogicParser().parse(glue);
    } else {
      this.glue = glue;
    }
  }

  static fromExpressions(meaning: FolExpression, glue: LLExpression, indices?: Set<number>): GlueFormula {
    const gf = Object.create(GlueFormula.prototype) as GlueFormula;
    gf.meaning = meaning;
    gf.glue = glue;
    gf.indices = indices ? new Set(indices) : new Set();
    return gf;
  }

  applyto(arg: GlueFormula): GlueFormula {
    for (const i of arg.indices) {
      if (this.indices.has(i)) {
        throw new LinearLogicApplicationException(`'${this}' applied to '${arg}'.  Indices are not disjoint.`);
      }
    }
    const returnIndices = new Set([...this.indices, ...arg.indices]);
    let returnGlue: LLExpression;
    try {
      returnGlue = new LLApplicationExpression(this.glue, arg.glue, arg.indices);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new LinearLogicApplicationException(`'${this.simplify()}' applied to '${arg.simplify()}' — ${msg}`);
    }
    let argMeaning: FolExpression = arg.meaning;
    if (returnIndices.size > 0) {
      const simp = this.glue.simplify() as LLImpExpression;
      const deps: number[] = (simp.antecedent as LLAtomicExpression).dependencies ?? [];
      for (let k = deps.length - 1; k >= 0; k--) {
        argMeaning = new LambdaExpression(new Variable(`v${deps[k]}`), argMeaning) as unknown as FolExpression;
      }
    }
    const func = this.meaning as unknown as { applyto(e: FolExpression): FolExpression };
    const returnMeaning = func.applyto(argMeaning);
    return GlueFormula.fromExpressions(returnMeaning, returnGlue, returnIndices);
  }

  makeVariableExpression(name: string): AbstractVariableExpression {
    return makeVariableExpression(name) as unknown as AbstractVariableExpression;
  }

  makeLambdaExpression(variable: Variable, term: FolExpression): FolExpression {
    return new LambdaExpression(variable, term) as unknown as FolExpression;
  }

  lambdaAbstract(other: GlueFormula): GlueFormula {
    const ov = other.meaning as unknown as AbstractVariableExpression;
    if (!ov || !ov.variable) throw new Error("lambdaAbstract requires AbstractVariableExpression meaning");
    const lam = this.makeLambdaExpression(ov.variable, this.meaning);
    return GlueFormula.fromExpressions(lam, new LLImpExpression(other.glue, this.glue));
  }

  compile(counter?: Counter): GlueFormula[] {
    const c = counter ?? new Counter();
    const [compiledGlue, rawForms] = (this.glue.simplify() as LLExpression & { compilePos(c: Counter, f: GlueFormulaFactory): [LLExpression, GlueFormulaLike[]] }).compilePos(c, (m, g, idx) => new GlueFormula(m, g, idx) as unknown as GlueFormulaLike);
    const newForms = rawForms as unknown as GlueFormula[];
    const fresh = c.get();
    return [...newForms, GlueFormula.fromExpressions(this.meaning, compiledGlue, new Set([fresh]))];
  }

  simplify(): GlueFormula {
    const m = (this.meaning as unknown as { simplify(): FolExpression }).simplify();
    const g = this.glue.simplify();
    return GlueFormula.fromExpressions(m, g, this.indices);
  }

  equals(other: GlueFormula): boolean {
    return other instanceof GlueFormula
      && (this.meaning as unknown as { equals(e: unknown): boolean }).equals(other.meaning)
      && this.glue.equals(other.glue);
  }

  toString(): string {
    let s = `${this.meaning} : ${this.glue}`;
    if (this.indices.size) s += ` : {${Array.from(this.indices).sort((a, b) => a - b).join(", ")}}`;
    return s;
  }
}

// ---------------------------------------------------------------------------
