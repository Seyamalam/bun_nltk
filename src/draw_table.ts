// NLTK draw.table — shim (requires Tkinter)
// Original: nltk/draw/table.py

function unavailable(name: string): never {
  throw new Error(`${name} requires Tkinter — not available in JS`);
}

export class Table { constructor(..._a: unknown[]) { unavailable("draw.table.Table"); } }
export class MultiListbox { constructor(..._a: unknown[]) { unavailable("draw.table.MultiListbox"); } }
