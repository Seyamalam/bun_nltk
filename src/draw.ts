// NLTK draw package — shim (requires Tkinter)
// Original: nltk/draw/__init__.py

function unavailable(name: string): never {
  throw new Error(`${name} requires Tkinter — not available in JS (no GUI canvas in bun_nltk)`);
}

export class ProductionList { constructor(..._a: unknown[]) { unavailable("draw.ProductionList"); } }
export class CFGEditor { constructor(..._a: unknown[]) { unavailable("draw.CFGEditor"); } }
export class CFGDemo { constructor(..._a: unknown[]) { unavailable("draw.CFGDemo"); } }
export class TreeSegmentWidget { constructor(..._a: unknown[]) { unavailable("draw.TreeSegmentWidget"); } }
export function treeToTreesegment(..._a: unknown[]): never { return unavailable("draw.tree_to_treesegment"); }
export class TreeWidget { constructor(..._a: unknown[]) { unavailable("draw.TreeWidget"); } }
export class TreeView { constructor(..._a: unknown[]) { unavailable("draw.TreeView"); } }
export function drawTrees(..._a: unknown[]): never { return unavailable("draw.draw_trees (use Tree.prettyPrint() instead)"); }
export class Table { constructor(..._a: unknown[]) { unavailable("draw.Table"); } }
export class MultiListbox { constructor(..._a: unknown[]) { unavailable("draw.MultiListbox"); } }
export function dispersionPlot(..._a: unknown[]): never { return unavailable("draw.dispersion_plot requires matplotlib — not available in JS"); }
