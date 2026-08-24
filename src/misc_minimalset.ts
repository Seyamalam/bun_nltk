/**
 * Port of nltk.misc.minimalset — MinimalSet for finding minimal pairs / contrastive contexts.
 */

export class MinimalSet {
  private _targets: Set<string>;
  private _contexts: Set<string>;
  private _seen: Map<string, Set<string>>;
  private _displays: Map<string, string>;

  constructor(parameters?: Array<[string, string, string]>) {
    this._targets = new Set();
    this._contexts = new Set();
    this._seen = new Map();
    this._displays = new Map();
    if (parameters) {
      for (const [ctx, tgt, disp] of parameters) this.add(ctx, tgt, disp);
    }
  }

  private key(ctx: string, tgt: string): string {
    return `${ctx}\x1f${tgt}`;
  }

  add(context: string, target: string, display: string): void {
    if (!this._seen.has(context)) this._seen.set(context, new Set());
    this._seen.get(context)!.add(target);
    this._contexts.add(context);
    this._targets.add(target);
    this._displays.set(this.key(context, target), display);
  }

  contexts(minimum = 2): string[] {
    const out: string[] = [];
    for (const c of this._contexts) {
      const s = this._seen.get(c);
      if (s && s.size >= minimum) out.push(c);
    }
    return out;
  }

  display(context: string, target: string, dflt = ""): string {
    const k = this.key(context, target);
    return this._displays.has(k) ? this._displays.get(k)! : dflt;
  }

  displayAll(context: string): string[] {
    const result: string[] = [];
    for (const tgt of this._targets) {
      const x = this.display(context, tgt);
      if (x) result.push(x);
    }
    return result;
  }

  /** Alias matching Python display_all */
  display_all(context: string): string[] {
    return this.displayAll(context);
  }

  targets(): Set<string> {
    return new Set(this._targets);
  }
}
