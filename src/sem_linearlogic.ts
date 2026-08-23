/**
 * Linear logic (port of nltk.sem.linearlogic).
 * Glue-semantics linear logic fragment.
 */
export class LinearLogicException extends Error {}

export class Expression {
  toString(): string { return String(this); }
  equals(_other: unknown): boolean { return false; }
}

export class Atom extends Expression {
  constructor(public name: string) { super(); }
  override toString(): string { return this.name; }
  override equals(other: unknown): boolean { return other instanceof Atom && other.name === this.name; }
}

export class ImpExpression extends Expression {
  constructor(public antecedent: Expression, public consequent: Expression) { super(); }
  override toString(): string { return `(${this.antecedent} -o ${this.consequent})`; }
  override equals(other: unknown): boolean { return other instanceof ImpExpression && this.antecedent.equals(other.antecedent) && this.consequent.equals(other.consequent); }
  simplify(): Expression { return this; }
}

export class ParExpression extends Expression {
  constructor(public left: Expression, public right: Expression) { super(); }
  override toString(): string { return `(${this.left} * ${this.right})`; }
  override equals(other: unknown): boolean { return other instanceof ParExpression && this.left.equals(other.left) && this.right.equals(other.right); }
}

export class Tokens {
  static OPEN = "("; static CLOSE = ")"; static IMP = "-o"; static PAR = "*";
}

export class LinearLogicParser {
  parse(s: string): Expression {
    const t = s.trim();
    if (!t.includes("-o") && !t.includes("*")) return new Atom(t);
    if (t.includes("-o")) {
      const idx = t.indexOf("-o");
      return new ImpExpression(new Atom(t.slice(0,idx).trim()), new Atom(t.slice(idx+2).trim()));
    }
    const idx = t.indexOf("*");
    return new ParExpression(new Atom(t.slice(0,idx).trim()), new Atom(t.slice(idx+1).trim()));
  }
}

export class GlueFormula {
  constructor(public meaning: string, public glue: Expression | string) {}
  toString(): string { return `${this.meaning} : ${this.glue}`; }
}
