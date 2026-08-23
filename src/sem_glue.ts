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
class Counter {
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
// DepGraph types
// ---------------------------------------------------------------------------
export interface DepNode {
  address: number;
  word: string;
  tag: string;
  rel: string;
  head: number;
  deps: Record<string, number[]>;
  [k: string]: unknown;
}
export interface DepGraphLike {
  nodes: Record<number, DepNode>;
}

// ---------------------------------------------------------------------------
// GlueDict
// ---------------------------------------------------------------------------
export class GlueDict {
  filename: string;
  fileEncoding: string | null;
  private data: Map<string, Map<string, string[][]>> = new Map();

  constructor(filename: string, encoding: string | null = null) {
    this.filename = filename;
    this.fileEncoding = encoding;
    this.readFile();
  }

  readFile(emptyFirst = true): void {
    if (emptyFirst) this.data.clear();
    throw new Error(
      `GlueDict: corpus file not available: '${this.filename}'. `
      + `This requires NLTK data 'grammars/sample_grammars/glue.semtype' `
      + `or a custom semtype file. In bun_nltk, provide entries via `
      + `GlueDict.loadFromString(content) or construct GlueFormulas directly. `
      + `Original NLTK error: LookupError for '${this.filename}'.`
    );
  }

  /** Load semtype entries from a string in NLTK glue.semtype format. */
  loadFromString(contents: string): void {
    for (let line of contents.split("\n")) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      const parts = line.split(" : ", 3);
      const glueFormulas: string[][] = [];
      let parenCount = 0, tupleStart = 0, tupleComma = 0;
      if (parts.length > 1) {
        const rhs = parts[1]!;
        for (let i = 0; i < rhs.length; i++) {
          const c = rhs[i]!;
          if (c === "(") { if (parenCount === 0) tupleStart = i + 1; parenCount++; }
          else if (c === ")") {
            parenCount--;
            if (parenCount === 0) {
              glueFormulas.push([rhs.slice(tupleStart, tupleComma), rhs.slice(tupleComma + 1, i)]);
            }
          } else if (c === ",") { if (parenCount === 1) tupleComma = i; }
          else if (c === "#") {
            if (parenCount !== 0) throw new Error(`Formula syntax is incorrect for entry ${line}`);
            break;
          }
        }
      }
      let relationships: string | null = null;
      if (parts.length > 2) {
        const p2 = parts[2]!;
        const s = p2.indexOf("[") + 1, e = p2.indexOf("]");
        if (s > 0 && e > s) {
          const inner = p2.slice(s, e).trim();
          relationships = inner ? inner.split(",").map(x => x.trim()).filter(Boolean).sort().join(",") : "__empty__";
        }
      }
      let sem: string; let supertype: string | null = null;
      const s0 = parts[0]!;
      const si = s0.indexOf("("), ei = s0.indexOf(")");
      if (si !== -1 && ei !== -1) { sem = s0.slice(0, si).trim(); supertype = s0.slice(si + 1, ei); }
      else sem = s0.trim();

      if (!this.data.has(sem)) this.data.set(sem, new Map());
      const semMap = this.data.get(sem)!;
      const relKey = relationships as string | null;

      if (relKey === null) {
        if (supertype) {
          const superMap = this.data.get(supertype);
          if (superMap) {
            for (const [rels, gfs] of superMap) {
              if (!semMap.has(rels)) semMap.set(rels, []);
              semMap.get(rels)!.push(...gfs, ...glueFormulas);
            }
          } else {
            const k = "__none__";
            if (!semMap.has(k)) semMap.set(k, []);
            semMap.get(k)!.push(...glueFormulas);
          }
        } else {
          const k = "__none__";
          if (!semMap.has(k)) semMap.set(k, []);
          semMap.get(k)!.push(...glueFormulas);
        }
      } else {
        const k = relKey;
        if (!semMap.has(k)) semMap.set(k, []);
        if (supertype) {
          const superMap = this.data.get(supertype);
          if (superMap?.has(k)) semMap.get(k)!.push(...superMap.get(k)!);
        }
        semMap.get(k)!.push(...glueFormulas);
      }
    }
  }

  hasSemtype(sem: string): boolean { return this.data.has(sem); }
  getSemtype(sem: string): Map<string, string[][]> | undefined { return this.data.get(sem); }

  toGlueFormulaList(depgraph: DepGraphLike, node?: DepNode | null, counter?: Counter | null, _verbose = false): GlueFormula[] {
    if (!node) {
      const top = depgraph.nodes[0];
      if (!top) return [];
      const depList: number[] = ([] as number[]).concat(...Object.values(top.deps ?? {}));
      if (!depList.length) return [];
      const root = depgraph.nodes[depList[0]!]!;
      if (!root) return [];
      return this.toGlueFormulaList(depgraph, root, new Counter(), _verbose);
    }
    const c = counter ?? new Counter();
    const gfs = this.lookup(node, depgraph, c);
    for (const depIdx of ([] as number[]).concat(...Object.values(node.deps ?? {}))) {
      const dep = depgraph.nodes[depIdx];
      if (dep) gfs.push(...this.toGlueFormulaList(depgraph, dep, c, _verbose));
    }
    return gfs;
  }

  lookup(node: DepNode, depgraph: DepGraphLike, counter: Counter): GlueFormula[] {
    const names = this.getSemtypes(node);
    let semtype: Map<string, string[][]> | undefined;
    for (const n of names) if (this.data.has(n)) { semtype = this.data.get(n); break; }
    if (!semtype) return [];
    this.addMissingDependencies(node, depgraph);
    const lookup = this.lookupSemtypeOption(semtype, node, depgraph);
    if (!lookup || !lookup.length) throw new Error(`There is no GlueDict entry for sem type of '${node.word}' with tag '${node.tag}', and rel '${node.rel}'`);
    return this.getGlueFormulasFromSemtypeEntry(lookup, node.word, node, depgraph, counter);
  }

  addMissingDependencies(node: DepNode, depgraph: DepGraphLike): void {
    if ((node.rel ?? "").toLowerCase() !== "main") return;
    const head = depgraph.nodes[node.head];
    if (!head) return;
    const subj = this.lookupUnique("subj", head, depgraph);
    const relation = subj.rel;
    if (!node.deps) node.deps = {};
    if (!node.deps[relation]) node.deps[relation] = [];
    node.deps[relation].push(subj.address);
  }

  private lookupSemtypeOption(semtype: Map<string, string[][]>, node: DepNode, depgraph: DepGraphLike): string[][] | null {
    const relationships = new Set<string>();
    for (const idx of ([] as number[]).concat(...Object.values(node.deps ?? {}))) {
      const dep = depgraph.nodes[idx];
      if (!dep) continue;
      const r = (dep.rel ?? "").toLowerCase();
      if (!OPTIONAL_RELATIONSHIPS.includes(r)) relationships.add(r);
    }
    const noneKey = "__none__";
    const relKey = Array.from(relationships).sort().join(",");
    if (relKey && semtype.has(relKey)) return semtype.get(relKey)!;
    if (!relationships.size && semtype.has(noneKey)) return semtype.get(noneKey)!;
    if (semtype.has(relKey)) return semtype.get(relKey)!;
    let best = ""; let bestLen = -1;
    for (const k of semtype.keys()) {
      if (k === noneKey) continue;
      const opts = new Set(k ? k.split(",").filter(Boolean) : []);
      if (opts.size > bestLen) {
        let isSubset = true;
        for (const o of opts) if (!relationships.has(o)) { isSubset = false; break; }
        if (isSubset) { best = k; bestLen = opts.size; }
      }
    }
    if (best) return semtype.get(best)!;
    if (semtype.has(noneKey)) return semtype.get(noneKey)!;
    return null;
  }

  getSemtypes(node: DepNode): string[] {
    const rel = (node.rel ?? "").toLowerCase();
    const word = (node.word ?? "").toLowerCase();
    if (rel === "spec") {
      if (word in SPEC_SEMTYPES) return [SPEC_SEMTYPES[word]!];
      return [SPEC_SEMTYPES["default"]!];
    }
    if (rel === "nmod" || rel === "vmod") return [node.tag, rel];
    return [node.tag];
  }

  getGlueFormulasFromSemtypeEntry(lookup: string[][], word: string, node: DepNode, depgraph: DepGraphLike, counter: Counter): GlueFormula[] {
    const out: GlueFormula[] = [];
    for (let i = 0; i < lookup.length; i++) {
      const [meaningGeneric, glueGeneric] = lookup[i]!;
      const meaningStr = this.getMeaningFormula(meaningGeneric!, word);
      const gf = new GlueFormula(meaningStr, glueGeneric!);
      (gf as unknown as Record<string, unknown>)["word"] = i === 0 ? word : `${word}${i + 1}`;
      gf.glue = this.initializeLabels(gf.glue, node, depgraph, counter.get());
      out.push(gf);
    }
    return out;
  }

  getMeaningFormula(generic: string, word: string): string {
    return generic.replace(/<word>/g, word.replace(/\./g, ""));
  }

  initializeLabels(expr: LLExpression, node: DepNode, depgraph: DepGraphLike, uniqueIndex: number): LLExpression {
    if (expr instanceof LLAtomicExpression) {
      const name = this.findLabelName(expr.name.toLowerCase(), node, depgraph, uniqueIndex);
      const isVar = name.length > 0 && name[0] === name[0]!.toUpperCase() && /[A-Z]/.test(name[0]!);
      return isVar ? new LLVariableExpression(name) : new LLConstantExpression(name);
    }
    if (expr instanceof LLImpExpression) {
      return new LLImpExpression(
        this.initializeLabels(expr.antecedent, node, depgraph, uniqueIndex),
        this.initializeLabels(expr.consequent, node, depgraph, uniqueIndex),
      );
    }
    return expr;
  }

  findLabelName(name: string, node: DepNode, depgraph: DepGraphLike, uniqueIndex: number): string {
    const dot = name.indexOf(".");
    if (dot !== -1) {
      const before = name.slice(0, dot), after = name.slice(dot + 1);
      if (before === "super") return this.findLabelName(after, depgraph.nodes[node.head]!, depgraph, uniqueIndex);
      return this.findLabelName(after, this.lookupUnique(before, node, depgraph), depgraph, uniqueIndex);
    }
    const lbl = this.getLabel(node);
    if (name === "f") return lbl;
    if (name === "v") return `${lbl}v`;
    if (name === "r") return `${lbl}r`;
    if (name === "super") return this.getLabel(depgraph.nodes[node.head]!);
    if (name === "var") return `${lbl.toUpperCase()}${uniqueIndex}`;
    if (name === "a") return this.getLabel(this.lookupUnique("conja", node, depgraph));
    if (name === "b") return this.getLabel(this.lookupUnique("conjb", node, depgraph));
    return this.getLabel(this.lookupUnique(name, node, depgraph));
  }

  getLabel(node: DepNode): string {
    const letters = ["f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","a","b","c","d","e"];
    const letter = letters[(node.address - 1) % letters.length] ?? "f";
    const num = Math.floor(Number(node.address) / 26);
    return num > 0 ? letter + String(num) : letter;
  }

  lookupUnique(rel: string, node: DepNode, depgraph: DepGraphLike): DepNode {
    const deps: DepNode[] = [];
    for (const idx of ([] as number[]).concat(...Object.values(node.deps ?? {}))) {
      const dep = depgraph.nodes[idx];
      if (dep && (dep.rel ?? "").toLowerCase() === rel.toLowerCase()) deps.push(dep);
    }
    if (!deps.length) throw new Error(`'${node.word}' doesn't contain a feature '${rel}'`);
    if (deps.length > 1) throw new Error(`'${node.word}' should only have one feature '${rel}'`);
    return deps[0]!;
  }

  getGlueFormulaFactory(): GlueFormulaFactory {
    return (m, g, idx) => new GlueFormula(m, g, idx);
  }

  toString(): string {
    let s = "";
    for (const [pos, relMap] of this.data) {
      for (const [relset, gfs] of relMap) {
        let i = 1;
        for (const gf of gfs) {
          if (i === 1) s += pos + ": ";
          else s += " ".repeat(pos.length + 2);
          s += `${gf[0]},${gf[1]}`;
          if (relset && relset !== "__none__" && i === gfs.length) s += ` : ${relset}`;
          s += "\n"; i++;
        }
      }
    }
    return s;
  }
}

// ---------------------------------------------------------------------------
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
