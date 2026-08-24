import {
  BindingDict,
  ApplicationExpression as LLApplicationExpression,
  AtomicExpression as LLAtomicExpression,
  ImpExpression as LLImpExpression,
} from "./sem_linearlogic";
import { Counter, GlueFormula, type GlueFormulaFactory } from "./sem_glue_formula";
import type { Expression as LLExpression } from "./sem_linearlogic";
import { Variable, type Expression as FolExpression, type AbstractVariableExpression } from "./sem_logic";
import { GlueDict } from "./sem_glue_dict";
import type { DepGraphLike } from "./sem_glue_dict";
// Glue — main engine
// ---------------------------------------------------------------------------
export class Glue {
  verbose: boolean;
  removeDuplicates: boolean;
  depparser: unknown;
  semtypeFile: string;

  constructor(opts: { semtypeFile?: string; removeDuplicates?: boolean; depparser?: unknown; verbose?: boolean } = {}) {
    this.verbose = opts.verbose ?? false;
    this.removeDuplicates = opts.removeDuplicates ?? false;
    this.depparser = opts.depparser ?? null;
    this.semtypeFile = opts.semtypeFile ?? "grammars/sample_grammars/glue.semtype";
  }

  trainDepparser(depgraphs?: unknown): void {
    if (depgraphs) {
      const dp = this.depparser as { train(g: unknown): void };
      if (dp?.train) { dp.train(depgraphs); return; }
      throw new Error("Glue.trainDepparser: depparser missing train()");
    }
    throw new Error(
      "Glue.trainDepparser: corpus not available — requires NLTK data 'grammars/sample_grammars/glue_train.conll'. "
      + "Provide depgraphs programmatically or supply a pre-trained depparser."
    );
  }

  parseToMeaning(sentence: string[]): FolExpression[] {
    const readings: FolExpression[] = [];
    for (const agenda of this.parseToCompiled(sentence)) readings.push(...this.getReadings(agenda));
    return readings;
  }

  getReadings(agenda: GlueFormula[]): FolExpression[] {
    const readings: FolExpression[] = [];
    const agendaLen = agenda.length;
    const atomics = new Map<string, GlueFormula[]>();
    const nonatomics = new Map<string, GlueFormula[]>();
    const queue: GlueFormula[] = [...agenda];
    while (queue.length) {
      const cur = queue.pop()!;
      const glueSimp = cur.glue.simplify();
      const isImp = glueSimp instanceof LLImpExpression;
      if (isImp) {
        for (const [, list] of atomics) {
          for (const atomic of list) {
            try {
              const imp = glueSimp as LLImpExpression;
              let b = new BindingDict();
              if (cur.glue instanceof LLApplicationExpression) b = b.add((cur.glue as LLApplicationExpression).bindings);
              const atomicSimp = atomic.glue.simplify();
              const ant = imp.antecedent;
              if (ant instanceof LLAtomicExpression && atomicSimp instanceof LLAtomicExpression) {
                b = (ant as unknown as { unify(e: LLExpression, b: BindingDict): BindingDict }).unify(atomicSimp, b);
              } else if (ant instanceof LLImpExpression && atomicSimp instanceof LLImpExpression) {
                b = (ant as LLImpExpression).unify(atomicSimp, b);
              } else continue;
              void b;
              let disjoint = true;
              for (const idx of atomic.indices) if (cur.indices.has(idx)) { disjoint = false; break; }
              if (!disjoint) continue;
              try { queue.push(cur.applyto(atomic)); } catch { /* skip */ }
            } catch { /* unify failed */ }
          }
        }
        const key = (glueSimp as LLImpExpression).antecedent.toString();
        if (!nonatomics.has(key)) nonatomics.set(key, []);
        nonatomics.get(key)!.push(cur);
      } else {
        for (const [, list] of nonatomics) {
          for (const nonatomic of list) {
            try {
              const nonSimp = nonatomic.glue.simplify() as LLImpExpression;
              let b = new BindingDict();
              if (nonatomic.glue instanceof LLApplicationExpression) b = b.add((nonatomic.glue as LLApplicationExpression).bindings);
              const curSimp = glueSimp;
              if (curSimp instanceof LLAtomicExpression && nonSimp.antecedent instanceof LLAtomicExpression) {
                b = (curSimp as unknown as { unify(e: LLExpression, b: BindingDict): BindingDict }).unify(nonSimp.antecedent, b);
              } else if (curSimp instanceof LLImpExpression && nonSimp.antecedent instanceof LLImpExpression) {
                b = (curSimp as LLImpExpression).unify(nonSimp.antecedent, b);
              } else continue;
              void b;
              let disjoint = true;
              for (const idx of cur.indices) if (nonatomic.indices.has(idx)) { disjoint = false; break; }
              if (!disjoint) continue;
              try { queue.push(nonatomic.applyto(cur)); } catch { /* skip */ }
            } catch { /* unify failed */ }
          }
        }
        const key = glueSimp.toString();
        if (!atomics.has(key)) atomics.set(key, []);
        atomics.get(key)!.push(cur);
      }
    }
    for (const [, list] of atomics) for (const gf of list) if (gf.indices.size === agendaLen) readings.push(gf.meaning);
    for (const [, list] of nonatomics) for (const gf of list) if (gf.indices.size === agendaLen) readings.push(gf.meaning);
    return readings;
  }

  parseToCompiled(sentence: string[]): GlueFormula[][] {
    const gfls = this.depParse(sentence).map(dg => this.depgraphToGlue(dg));
    return gfls.map(gfl => this.gflToCompiled(gfl));
  }

  depParse(sentence: string[]): DepGraphLike[] {
    const dp = this.depparser as { parse(s: string[]): DepGraphLike[] } | null;
    if (dp && typeof dp.parse === "function") return dp.parse(sentence);
    throw new Error(
      "Glue.depParse: dependency parser not available. "
      + "Provide a depparser via new Glue({ depparser }) or override depParse(). "
      + "In NLTK this defaults to MaltParser which requires Java and NLTK data."
    );
  }

  depgraphToGlue(depgraph: DepGraphLike): GlueFormula[] {
    return this.getGlueDict().toGlueFormulaList(depgraph);
  }

  getGlueDict(): GlueDict { return new GlueDict(this.semtypeFile); }

  gflToCompiled(gfl: GlueFormula[]): GlueFormula[] {
    const counter = new Counter();
    const out: GlueFormula[] = [];
    for (const gf of gfl) out.push(...gf.compile(counter));
    if (this.verbose) {
      console.log("Compiled Glue Premises:");
      for (const c of out) console.log(String(c));
    }
    return out;
  }

  getPosTagger(): unknown {
    throw new Error(
      "Glue.getPosTagger: corpus not available — requires NLTK corpus 'brown'. "
      + "Provide a custom POS tagger or supply a pre-parsed dependency graph."
    );
  }
}

// ---------------------------------------------------------------------------
// DRT variants
// ---------------------------------------------------------------------------
export class DrtGlueFormula extends GlueFormula {
  constructor(meaning: string | FolExpression, glue: string | LLExpression, indices?: Set<number>) {
    if (typeof meaning === "string") {
      try {
        // dynamic to avoid circular import at top-level: drt may import sem_logic
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const drtMod = require("./drt") as { DrtParser: new () => { parse(s: string): FolExpression } };
        const parsed = new drtMod.DrtParser().parse(meaning);
        super(parsed as unknown as FolExpression, glue, indices);
        return;
      } catch { /* fall through to FOL */ }
    }
    super(meaning, glue, indices);
  }

  override makeVariableExpression(name: string): AbstractVariableExpression {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const drtMod = require("./drt") as { DrtVariableExpression(v: Variable): AbstractVariableExpression };
      return drtMod.DrtVariableExpression(new Variable(name)) as unknown as AbstractVariableExpression;
    } catch { return super.makeVariableExpression(name); }
  }

  override makeLambdaExpression(variable: Variable, term: FolExpression): FolExpression {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const drtMod = require("./drt") as { DrtLambdaExpression: new (v: Variable, t: FolExpression) => FolExpression };
      return new drtMod.DrtLambdaExpression(variable, term) as unknown as FolExpression;
    } catch { return super.makeLambdaExpression(variable, term); }
  }
}

export class DrtGlueDict extends GlueDict {
  override getGlueFormulaFactory(): GlueFormulaFactory {
    return (m, g, idx) => new DrtGlueFormula(m, g, idx);
  }
}

export class DrtGlue extends Glue {
  constructor(opts: { semtypeFile?: string; removeDuplicates?: boolean; depparser?: unknown; verbose?: boolean } = {}) {
    super({ semtypeFile: opts.semtypeFile ?? "grammars/sample_grammars/drt_glue.semtype", removeDuplicates: opts.removeDuplicates, depparser: opts.depparser, verbose: opts.verbose });
  }
  override getGlueDict(): GlueDict { return new DrtGlueDict(this.semtypeFile); }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------
export function demo(showExample = -1): void {
  console.log("============== DEMO ==============");
  console.log("Glue demo requires a dependency parser (MaltParser) and NLTK corpora — not available in bun_nltk.");
  console.log("Programmatic GlueFormula example:");
  try {
    const gf1 = new GlueFormula("\\x.(walk x)", "subj -o f");
    const gf2 = new GlueFormula("john", "subj");
    console.log(`  gf1: ${gf1}`);
    console.log(`  gf2: ${gf2}`);
    const applied = gf1.applyto(gf2);
    console.log(`  applied: ${applied}`);
    console.log(`  simplified meaning: ${(applied.meaning as unknown as { simplify(): FolExpression }).simplify()}`);
  } catch (e) { console.log("  demo error:", e); }
  void showExample;
}
