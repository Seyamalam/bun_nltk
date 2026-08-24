import {
  BindingDict,
  LinearLogicParser,
} from "./sem_linearlogic";
import { Counter, GlueFormula, SPEC_SEMTYPES, OPTIONAL_RELATIONSHIPS, type GlueFormulaFactory } from "./sem_glue_formula";
import type { Expression as LLExpression } from "./sem_linearlogic";
import {
  AtomicExpression as LLAtomicExpression,
  ConstantExpression as LLConstantExpression,
  ImpExpression as LLImpExpression,
  VariableExpression as LLVariableExpression,
} from "./sem_linearlogic";
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
