// Port of Python's fractions.Fraction used by nltk.translate.bleu_score.
function gcd(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }

export class Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: number | bigint | Fraction | string = 0, denominator?: number | bigint) {
    if (numerator instanceof Fraction) {
      this.numerator = numerator.numerator; this.denominator = numerator.denominator; return;
    }
    let n: bigint, d: bigint;
    if (typeof numerator === "string") {
      const parsed = Fraction._fromString(numerator);
      this.numerator = parsed.numerator; this.denominator = parsed.denominator; return;
    } else if (typeof numerator === "number" && !Number.isInteger(numerator)) {
      const parsed = Fraction._fromFloat(numerator);
      n = parsed.numerator; d = parsed.denominator;
    } else {
      n = BigInt(numerator as number | bigint);
      d = denominator === undefined ? 1n : BigInt(denominator);
    }
    if (d === 0n) throw new Error("Fraction(%s, 0)".replace("%s", String(numerator)));
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.numerator = n / g; this.denominator = d / g;
  }

  private static _fromString(s: string): Fraction {
    const m = s.trim().match(/^([+-]?\d+)(?:\/(\d+))?$/);
    if (!m) throw new Error(`Invalid literal for Fraction: ${s}`);
    return new Fraction(BigInt(m[1]!), m[2] !== undefined ? BigInt(m[2]) : 1n);
  }

  private static _fromFloat(f: number): Fraction {
    if (!Number.isFinite(f)) throw new Error(`cannot convert ${f} to Fraction`);
    const [n, d] = (() => {
      // Exact binary expansion of the double.
      if (f === 0) return [0n, 1n] as const;
      const neg = f < 0; const a = Math.abs(f);
      let e = Math.floor(Math.log2(a)) + 1;
      let mant = a / 2 ** e; // in [1,2)
      let num = 0n, den = 1n;
      for (let i = 0; i < 60 && mant !== 0; i++) {
        mant *= 2; den *= 2n;
        if (mant >= 1) { num = num * 2n + 1n; mant -= 1; } else num *= 2n;
      }
      if (e >= 0) num *= 2n ** BigInt(e); else den *= 2n ** BigInt(-e);
      return [neg ? -num : num, den] as const;
    })();
    return new Fraction(n, d);
  }

  static from_float(f: number): Fraction { return new Fraction(f); }
  static from_decimal(dec: number | bigint): Fraction { return new Fraction(dec); }
  static from_number(num: number | bigint | Fraction): Fraction { return new Fraction(num as number); }

  private _binop(other: Fraction | number | bigint, op: (a: Fraction, b: Fraction) => Fraction): Fraction {
    const b = other instanceof Fraction ? other : new Fraction(other);
    return op(this, b);
  }
  add(other: Fraction | number | bigint): Fraction { return this._binop(other, (a, b) => new Fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator)); }
  sub(other: Fraction | number | bigint): Fraction { return this._binop(other, (a, b) => new Fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator)); }
  mul(other: Fraction | number | bigint): Fraction { return this._binop(other, (a, b) => new Fraction(a.numerator * b.numerator, a.denominator * b.denominator)); }
  truediv(other: Fraction | number | bigint): Fraction { return this._binop(other, (a, b) => new Fraction(a.numerator * b.denominator, a.denominator * b.numerator)); }
  neg(): Fraction { return new Fraction(-this.numerator, this.denominator); }
  abs(): Fraction { return new Fraction(this.numerator < 0n ? -this.numerator : this.numerator, this.denominator); }
  eq(other: Fraction | number | bigint): boolean { const b = other instanceof Fraction ? other : new Fraction(other); return this.numerator === b.numerator && this.denominator === b.denominator; }
  compare(other: Fraction | number | bigint): number { const b = other instanceof Fraction ? other : new Fraction(other); const l = this.numerator * b.denominator, r = b.numerator * this.denominator; return l < r ? -1 : l > r ? 1 : 0; }
  is_integer(): boolean { return this.denominator === 1n; }
  as_integer_ratio(): [bigint, bigint] { return [this.numerator, this.denominator]; }
  conjugate(): Fraction { return new Fraction(this); }

  limit_denominator(maxDenominator: number | bigint = 1000000n): Fraction {
    const maxD = BigInt(maxDenominator);
    if (maxD < 1n) throw new Error("max_denominator should be at least 1");
    if (this.denominator <= maxD) return new Fraction(this);
    // Continued-fraction nearest rational (Python algorithm).
    let [p0, q0, p1, q1] = [0n, 1n, 1n, 0n];
    let [n, d] = [this.numerator, this.denominator];
    while (true) {
      const a = n / d;
      const q2 = q0 + a * q1;
      if (q2 > maxD) break;
      [p0, q0, p1, q1] = [p1, q1, p0 + a * p1, q2];
      [n, d] = [d, n - a * d];
    }
    const k = (maxD - q0) / q1;
    const bound1 = new Fraction(p0 + k * p1, q0 + k * q1);
    const bound2 = new Fraction(p1, q1);
    return bound1.sub(this).abs().compare(bound2.sub(this).abs()) <= 0 ? bound1 : bound2;
  }

  toNumber(): number { return Number(this.numerator) / Number(this.denominator); }
  valueOf(): number { return this.toNumber(); }
  toString(): string { return this.denominator === 1n ? `${this.numerator}` : `${this.numerator}/${this.denominator}`; }
}
