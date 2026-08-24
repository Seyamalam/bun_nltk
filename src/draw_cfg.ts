// NLTK draw.cfg — shim (requires Tkinter)
// Original: nltk/draw/cfg.py

function unavailable(name: string): never {
  throw new Error(`${name} requires Tkinter — not available in JS (use CFG pretty-printing instead)`);
}

export class ProductionList { constructor(..._a: unknown[]) { unavailable("draw.cfg.ProductionList"); } }
export class CFGEditor { constructor(..._a: unknown[]) { unavailable("draw.cfg.CFGEditor"); } }
export class CFGDemo { constructor(..._a: unknown[]) { unavailable("draw.cfg.CFGDemo"); } }
