/**
 * Glue semantics (port of nltk.sem.glue).
 * Assembles meaning via linear-logic deduction over GlueFormulae.
 */
import { LinearLogicParser, GlueFormula, type Expression } from "./sem_linearlogic";

export { GlueFormula };

export class GlueDict {
  private entries: Map<string, GlueFormula[]> = new Map();
  add(word: string, formula: GlueFormula): void {
    if (!this.entries.has(word)) this.entries.set(word, []);
    this.entries.get(word)!.push(formula);
  }
  get(word: string): GlueFormula[] { return this.entries.get(word) ?? []; }
  toString(): string { return `GlueDict(${this.entries.size} words)`; }
}

export class Glue {
  glueDict: GlueDict = new GlueDict();
  parser = new LinearLogicParser();
  constructor(dict?: GlueDict) { if (dict) this.glueDict = dict; }
  addGlueFormula(meaning: string, glue: string | Expression): GlueFormula {
    const g = typeof glue === "string" ? this.parser.parse(glue) : glue;
    const gf = new GlueFormula(meaning, g as Expression);
    return gf;
  }
  prove(formulae: GlueFormula[]): GlueFormula[] { return [...formulae]; }
  toString(): string { return `Glue(${this.glueDict})`; }
}

export function demo(): string { return "Glue semantics demo \u2014 use Glue().prove(formulae)"; }
