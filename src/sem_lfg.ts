// sem_lfg.ts — nltk.sem.lfg FStructure: dict-of-lists f-structure built from
// dependency graphs. Original: nltk/sem/lfg.py (NLTK 3.10.3).
// Adapted: JS Map-based container (case-insensitive keys, insertion order).

import { Counter, pyError } from "./internals";
import { DependencyGraph } from "./dependency_graph";
import type { GlueDict } from "./sem_glue_dict";
import type { GlueFormula } from "./sem_glue_formula";

/** (word, tag) leaf tuple as produced by read_depgraph for spec/punct rels. */
export type FStructTuple = [string, string];
export type FStructItem = FStructure | FStructTuple | FStructure[];

const isTuple = (x: FStructItem): x is FStructTuple =>
  Array.isArray(x) && x.length === 2 && typeof x[0] === "string" && typeof x[1] === "string";

/** Oracle `sorted(self[feature])`: tuples compare element-wise; ≥2 unordered
 *  items (FStructs/lists) raise TypeError in Python — preserved here. */
function sortItems(items: FStructItem[]): FStructItem[] {
  if (items.length <= 1) return items;
  if (items.every(isTuple)) {
    return [...items].sort((a, b) => (a[0] + "" + a[1]).localeCompare(b[0] + "" + b[1]));
  }
  throw pyError("TypeError", "'<' not supported between instances of 'FStructure' and 'FStructure'");
}

export class FStructure extends Map<string, FStructItem[]> {
  pred: [string, string] | null = null;
  label: string | undefined;
  parent: FStructure | null = null;

  /** Append `item` to the list at `key`, creating the list if needed. */
  safeappend(key: string, item: FStructItem): void {
    if (!this.has(key)) this.set(key, []);
    this.get(key)!.push(item);
  }

  override set(key: string, value: FStructItem[]): this {
    return super.set(key.toLowerCase(), value);
  }

  override get(key: string): FStructItem[] | undefined {
    return super.get(key.toLowerCase());
  }

  override has(key: string): boolean {
    return super.has(key.toLowerCase());
  }

  toGlueformulaList(glueDict: GlueDict): GlueFormula[] {
    return glueDict.toGlueFormulaList(this.toDepgraph() as never);
  }

  toDepgraph(_rel?: string): DependencyGraph {
    const depgraph = new DependencyGraph();
    const nodes = depgraph.nodes as unknown as Record<number, Record<string, unknown>>;

    this._toDepgraph(nodes, 0, "ROOT");

    // Add all the dependencies for all the nodes
    for (const [address, node] of Object.entries(nodes)) {
      const addr = Number(address);
      for (const n2 of Object.values(nodes)) {
        if (n2["rel"] === "TOP") continue;
        if (n2["head"] === addr) {
          const deps = node["deps"] as Record<string, number[]>;
          (deps[n2["rel"] as string] ??= []).push(n2["address"] as number);
        }
      }
    }

    depgraph.root = nodes[1] as never;
    return depgraph;
  }

  private _toDepgraph(nodes: Record<number, Record<string, unknown>>, head: number, rel: string): void {
    const index = Object.keys(nodes).length;
    nodes[index] = {
      address: index,
      word: this.pred![0],
      tag: this.pred![1],
      head,
      rel,
      deps: {},
      lemma: null, ctag: null, feats: null,
    };

    for (const feature of [...this.keys()].sort()) {
      for (const item of sortItems(this.get(feature)!)) {
        if (item instanceof FStructure) {
          item._toDepgraph(nodes, index, feature);
        } else if (isTuple(item)) {
          const newIndex = Object.keys(nodes).length;
          nodes[newIndex] = {
            address: newIndex,
            word: item[0],
            tag: item[1],
            head: index,
            rel: feature,
            deps: {},
            lemma: null, ctag: null, feats: null,
          };
        } else if (Array.isArray(item)) {
          for (const n of item) n._toDepgraph(nodes, index, feature);
        } else {
          throw pyError("Exception", `feature ${feature} is not an FStruct, a list, or a tuple`);
        }
      }
    }
  }

  static readDepgraph(depgraph: DependencyGraph): FStructItem {
    return FStructure._readDepgraph(depgraph.root as never, depgraph);
  }

  private static _readDepgraph(
    node: Record<string, unknown>, depgraph: DependencyGraph,
    labelCounter?: Counter, parent?: FStructure | null,
  ): FStructItem {
    labelCounter ??= new Counter();
    const rel = String(node["rel"]).toLowerCase();

    if (rel === "spec" || rel === "punct") {
      // the value of a 'spec' entry is a word, not an FStructure
      return [node["word"] as string, node["tag"] as string];
    }

    const fstruct = new FStructure();
    fstruct.pred = null;
    fstruct.label = FStructure._makeLabel(labelCounter.get());
    fstruct.parent = parent ?? null;

    const word = node["word"] as string, tag = node["tag"] as string;
    if (tag.slice(0, 2) === "VB") {
      if (tag.slice(2, 3) === "D") fstruct.safeappend("tense", ["PAST", "tense"]);
      fstruct.pred = [word, tag.slice(0, 2)];
    }
    if (!fstruct.pred) fstruct.pred = [word, tag];

    const children = ([] as number[]).concat(...Object.values(node["deps"] as Record<string, number[]>));
    for (const idx of children) {
      const child = (depgraph.nodes as unknown as Record<number, Record<string, unknown>>)[idx]!;
      fstruct.safeappend(
        child["rel"] as string,
        FStructure._readDepgraph(child, depgraph, labelCounter, fstruct),
      );
    }
    return fstruct;
  }

  /** Pick an alphabetic character as identifier for an entity in the model. */
  static _makeLabel(value: number): string {
    const letter = ["f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","a","b","c","d","e"][value - 1];
    if (letter === undefined) throw pyError("IndexError", "list index out of range");
    const num = Math.trunc(value / 26);
    return num > 0 ? letter + num : letter;
  }

  repr(): string {
    return this.toString().replace(/\n/g, "");
  }

  override toString(): string {
    return this.prettyFormat();
  }

  prettyFormat(indent = 3): string {
    let accum = this.label !== undefined ? `${this.label}:[` : "[";
    if (this.pred != null) accum += `pred '${this.pred[0]}'`;

    for (const feature of [...this.keys()].sort()) {
      for (const item of this.get(feature)!) {
        if (item instanceof FStructure) {
          const nextIndent = indent + feature.length + 3 + String(this.label ?? "").length;
          accum += `\n${" ".repeat(indent)}${feature} ${item.prettyFormat(nextIndent)}`;
        } else if (isTuple(item)) {
          accum += `\n${" ".repeat(indent)}${feature} '${item[0]}'`;
        } else if (Array.isArray(item)) {
          accum += `\n${" ".repeat(indent)}${feature} {${item.map((n) => n.toString()).join(`\n${" ".repeat(indent + feature.length + 2)}`)}}`;
        } else {
          throw pyError("Exception", `feature ${feature} is not an FStruct, a list, or a tuple`);
        }
      }
    }
    return accum + "]";
  }
}
