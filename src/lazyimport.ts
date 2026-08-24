// NLTK lazyimport — lightweight JS port
// Original: nltk/lazyimport.py

export class LazyModule {
  private _loaded = false;
  private _mod: Record<string, unknown> | null = null;
  constructor(
    private name: string,
    private loader: ()=> Record<string, unknown>,
  ) {}
  private ensureLoaded(): Record<string, unknown> {
    if (!this._loaded) { this._mod = this.loader(); this._loaded = true; }
    return this._mod as Record<string, unknown>;
  }
  get(attr: string): unknown { return this.ensureLoaded()[attr]; }
  has(attr: string): boolean { return attr in this.ensureLoaded(); }
}
