import { findBinary } from "./internals";

/** `nltk.translate.api.Alignment` — a set of (i, j, ...) alignment tuples. */
export class Alignment implements Iterable<number[]> {
  private readonly pairs: Map<string, number[]> = new Map();
  private _index: Map<number, number[][]> | null = null;
  private readonly _len: number;

  constructor(pairs: Iterable<readonly number[]>) {
    let max = 0;
    for (const p of pairs) {
      const pair = [...p];
      this.pairs.set(pair.join("-"), pair);
      if (pair[0]! > max) max = pair[0]!;
    }
    this._len = this.pairs.size === 0 ? 0 : max;
  }

  static fromstring(s: string): Alignment {
    return new Alignment(
      s.split(" ").filter(Boolean).map((a) => {
        const [i, j] = a.split("-").map(Number);
        return [i!, j!];
      }),
    );
  }

  /** `a[key]` — alignments originating from left index `key`. */
  get(key: number): number[][] {
    if (!Number.isInteger(key)) {
      throw new TypeError(`Alignment indices must be integers, not ${typeof key}`);
    }
    if (this._index === null) this.buildIndex();
    return this._index!.get(key) ?? [];
  }

  invert(): Alignment {
    return new Alignment([...this.pairs.values()].map((p) => [p[1]!, p[0]!, ...p.slice(2)]));
  }

  range(positions?: Iterable<number>): number[] {
    const image = new Set<number>();
    if (this._index === null) this.buildIndex();
    for (const p of positions ?? this._index!.keys()) {
      for (const pair of this._index!.get(p) ?? []) image.add(pair[1]!);
    }
    return [...image].sort((a, b) => a - b);
  }

  get size(): number {
    return this.pairs.size;
  }

  issubset(other: Alignment): boolean {
    return [...this.pairs.keys()].every((k) => other.pairs.has(k));
  }

  intersection(other: Alignment): Alignment {
    return new Alignment([...this.pairs.values()].filter((p) => other.pairs.has(p.join("-"))));
  }

  *[Symbol.iterator](): Iterator<number[]> {
    for (const p of [...this.pairs.values()].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)) yield p;
  }

  repr(): string {
    return `Alignment([${[...this].map((p) => `(${p.join(", ")})`).join(", ")}])`;
  }

  toString(): string {
    return [...this].map((p) => `${p[0]}-${p[1]}`).join(" ");
  }

  private buildIndex(): void {
    this._index = new Map();
    for (const p of this.pairs.values()) {
      const row = this._index.get(p[0]!);
      if (row) row.push(p);
      else this._index.set(p[0]!, [p]);
    }
  }
}

/** `nltk.translate.api.AlignedSent` — two sentences plus their `Alignment`. */
export class AlignedSent {
  readonly alignment: Alignment;

  constructor(
    private readonly _words: readonly string[],
    private readonly _mots: readonly string[],
    alignment?: Alignment,
  ) {
    this.alignment = alignment ?? new Alignment([]);
  }

  words(): readonly string[] {
    return this._words;
  }

  mots(): readonly string[] {
    return this._mots;
  }

  invert(): AlignedSent {
    return new AlignedSent(this._mots, this._words, this.alignment.invert());
  }

  repr(): string {
    return `<AlignedSent: '${this._words.join(" ").slice(0, 20)}...' -> '${this._mots.join(" ").slice(0, 20)}...'>`;
  }

  toString(): string {
    return this.repr();
  }

  /** Graphviz dot output; the SVG path requires the external `dot` binary. */
  toDot(): string {
    let s = "graph aligned_sent {\n  rankdir=LR;\n";
    for (const [i, j] of this.alignment) {
      s += `"${this._mots[j!]}_target" -- "${this._words[i!]}_source";\n`;
    }
    s += "  node [shape=plaintext];\n";
    for (let i = 0; i < this._words.length - 1; i++) {
      s += `"${this._words[i]}_source" -- "${this._words[i + 1]}_source" [style=invis]\n`;
    }
    for (let i = 0; i < this._mots.length - 1; i++) {
      s += `"${this._mots[i]}_target" -- "${this._mots[i + 1]}_target" [style=invis]\n`;
    }
    s += `{rank = same; ${this._words.map((w) => `"${w}_source"`).join(" ")}}\n`;
    s += `{rank = same; ${this._mots.map((w) => `"${w}_target"`).join(" ")}}\n}`;
    return s;
  }

  reprSvg(): string {
    throw new Error(`_repr_svg_ requires the external Graphviz dot binary (${findBinary.name} refused)`);
  }
}
