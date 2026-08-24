// NLTK draw.tree — shim (requires Tkinter)
// Original: nltk/draw/tree.py — use Tree.prettyPrint() instead

function unavailable(name: string): never {
  throw new Error(`${name} requires Tkinter — not available in JS (use Tree.prettyPrint() / Tree.pformat())`);
}

export class TreeSegmentWidget { constructor(..._a: unknown[]) { unavailable("draw.tree.TreeSegmentWidget"); } }
export function treeToTreesegment(..._a: unknown[]): never { return unavailable("draw.tree.tree_to_treesegment"); }
export const tree_to_treesegment = treeToTreesegment;
export class TreeWidget { constructor(..._a: unknown[]) { unavailable("draw.tree.TreeWidget"); } }
export class TreeView { constructor(..._a: unknown[]) { unavailable("draw.tree.TreeView"); } }
export function drawTrees(..._a: unknown[]): never { return unavailable("draw.tree.draw_trees"); }
export const draw_trees = drawTrees;
