/**
 * CCG API — port of nltk/ccg/api.py
 * Interfaces for categories in combinatory grammars.
 */

export type DirectionChar = "/" | "\\";
export type Restriction = "." | "," | "_" | "";

// ---------------------------------------------------------------------------
// AbstractCCGCategory
// ---------------------------------------------------------------------------

export interface AbstractCCGCategory {
  isPrimitive(): boolean;
  isFunction(): boolean;
  isVar(): boolean;
  substitute(subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory;
  /** null = cannot unify, [] = no subs needed */
  canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null;
  toString(): string;
  equals(other: unknown): boolean;
  comparisonKey(): unknown;
}

// ---------------------------------------------------------------------------
// CCGVar
// ---------------------------------------------------------------------------

export class CCGVar implements AbstractCCGCategory {
  private static _maxID = 0;
  readonly id: number;
  private readonly _primOnly: boolean;

  constructor(primOnly = false) {
    this.id = CCGVar.newId();
    this._primOnly = primOnly;
  }

  static newId(): number {
    return this._maxID++;
  }
  static resetId(): void {
    this._maxID = 0;
  }

  isPrimitive(): boolean { return false; }
  isFunction(): boolean { return false; }
  isVar(): boolean { return true; }

  substitute(subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory {
    for (const [v, cat] of subs) if (v.equals(this)) return cat;
    return this;
  }

  canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null {
    if (other.isPrimitive() || !this._primOnly) return [[this, other]];
    return null;
  }

  comparisonKey(): number { return this.id; }
  equals(other: unknown): boolean { return other instanceof CCGVar && other.id === this.id; }
  toString(): string { return `_var${this.id}`; }
}

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

export class Direction {
  readonly dir: DirectionChar;
  readonly restrs: string;

  constructor(dir: DirectionChar, restrictions: string | string[]) {
    this.dir = dir;
    if (Array.isArray(restrictions)) restrictions = restrictions.filter(Boolean).join("");
    this.restrs = restrictions as string;
  }

  isForward(): boolean { return this.dir === "/"; }
  isBackward(): boolean { return this.dir === "\\"; }
  isVariable(): boolean { return this.restrs === "_"; }

  canUnify(other: Direction): Array<[string, string]> | null {
    if (other.isVariable()) return [["_", this.restrs]];
    if (this.isVariable()) return [["_", other.restrs]];
    if (this.restrs === other.restrs) return [];
    return null;
  }

  substitute(subs: Array<[string, string]>): Direction {
    if (!this.isVariable()) return this;
    for (const [v, r] of subs) if (v === "_") return new Direction(this.dir, r);
    return this;
  }

  canCompose(): boolean { return !this.restrs.includes(","); }
  canCross(): boolean { return !this.restrs.includes("."); }

  neg(): Direction {
    return new Direction(this.dir === "/" ? "\\" : "/", this.restrs);
  }

  equals(other: unknown): boolean {
    return other instanceof Direction && other.dir === this.dir && other.restrs === this.restrs;
  }
  toString(): string { return `${this.dir}${this.restrs}`; }
}

// ---------------------------------------------------------------------------
// PrimitiveCategory
// ---------------------------------------------------------------------------

export class PrimitiveCategory implements AbstractCCGCategory {
  readonly categ: string;
  readonly restrs: string[];

  constructor(categ: string, restrictions: string[] = []) {
    this.categ = categ;
    this.restrs = restrictions;
  }

  isPrimitive(): boolean { return true; }
  isFunction(): boolean { return false; }
  isVar(): boolean { return false; }

  substitute(_subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory { return this; }

  canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null {
    if (!other.isPrimitive()) {
      if (other.isVar()) return [[other, this]];
      return null;
    }
    if (other.isVar()) return [[other, this]];
    const o = other as PrimitiveCategory;
    if (o.categ !== this.categ) return null;
    for (const r of this.restrs) if (!o.restrs.includes(r)) return null;
    return [];
  }

  comparisonKey(): unknown { return [this.categ, this.restrs.join(",")]; }
  equals(other: unknown): boolean {
    return other instanceof PrimitiveCategory && other.categ === this.categ &&
      other.restrs.length === this.restrs.length && other.restrs.every((v, i) => v === this.restrs[i]);
  }
  toString(): string {
    if (this.restrs.length === 0) return this.categ;
    return `${this.categ}[${this.restrs.join(",")}]`;
  }
}

// ---------------------------------------------------------------------------
// FunctionalCategory
// ---------------------------------------------------------------------------

export class FunctionalCategory implements AbstractCCGCategory {
  readonly res: AbstractCCGCategory;
  readonly arg: AbstractCCGCategory;
  readonly dir: Direction;

  constructor(res: AbstractCCGCategory, arg: AbstractCCGCategory, dir: Direction) {
    this.res = res;
    this.arg = arg;
    this.dir = dir;
  }

  isPrimitive(): boolean { return false; }
  isFunction(): boolean { return true; }
  isVar(): boolean { return false; }

  substitute(subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory {
    // direction subs use string key "_"; handle separately
    const dirSubs = subs.filter(([k]) => typeof k === "string") as unknown as Array<[string, string]>;
    const catSubs = subs.filter(([k]) => typeof k !== "string") as Array<[AbstractCCGCategory, AbstractCCGCategory]>;
    return new FunctionalCategory(
      this.res.substitute(catSubs),
      this.arg.substitute(catSubs),
      this.dir.substitute(dirSubs),
    );
  }

  canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null {
    if (other.isVar()) return [[other, this]];
    if (!other.isFunction()) return null;
    const o = other as FunctionalCategory;
    const sa = this.res.canUnify(o.res);
    const sd = this.dir.canUnify(o.dir);
    if (sa === null || sd === null) return null;
    const base: Array<[AbstractCCGCategory, AbstractCCGCategory]> = [...sa] as Array<[AbstractCCGCategory, AbstractCCGCategory]>;
    // directions subs are string-keyed; convert to var-subs is not needed for arg unification beyond string restrs
    // For arg, apply base subs
    const dirSubsForArg = sd as unknown as Array<[AbstractCCGCategory, AbstractCCGCategory]>;
    const combined = [...base, ...dirSubsForArg];
    const sb = this.arg.substitute(combined).canUnify(o.arg.substitute(combined));
    if (sb === null) return null;
    return [...combined, ...sb] as Array<[AbstractCCGCategory, AbstractCCGCategory]>;
  }

  comparisonKey(): unknown { return [this.arg.toString(), this.dir.toString(), this.res.toString()]; }
  equals(other: unknown): boolean {
    return other instanceof FunctionalCategory && this.res.equals(other.res) && this.arg.equals(other.arg) && this.dir.equals(other.dir);
  }
  toString(): string { return `(${this.res}${this.dir}${this.arg})`; }
}

export type CCGCategory = PrimitiveCategory | FunctionalCategory | CCGVar;
