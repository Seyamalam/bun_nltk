/**
 * ParentedTree / ImmutableTree subset (nltk.tree).
 *
 * NLTK's ParentedTree keeps a `_parent` pointer and the node's index within
 * its parent, enabling O(1) `parent()`, `left_sibling()`, `right_sibling()`
 * and `root()` lookups. This port wraps the same {label, children} tree node
 * shape used by ./tree_transforms ({label, children: Array<Tree|string>}).
 *
 * ImmutableTree freezes the structure: any mutation attempt throws.
 */
import type { ParseTree } from "./parse";

export type TreePosition = number[];
export type TreePositionsOrder = "preorder" | "postorder" | "leaves";

export class ParentedTree {
  label: string;
  readonly children: Array<ParentedTree | string>;
  protected _parent: ParentedTree | null;
  protected _index: number;

  constructor(label: string, children: Array<ParentedTree | string> = [], parent: ParentedTree | null = null, index = -1) {
    this.label = label;
    this.children = children;
    this._parent = parent;
    this._index = index;
  }

  /** Build a ParentedTree hierarchy from a plain {label, children} tree. */
  static from(tree: ParseTree, parent: ParentedTree | null = null, index = -1): ParentedTree {
    const children: Array<ParentedTree | string> = [];
    const node = new ParentedTree(tree.label, children, parent, index);
    for (let i = 0; i < tree.children.length; i += 1) {
      const child = tree.children[i]!;
      children.push(typeof child === "string" ? child : ParentedTree.from(child, node, i));
    }
    return node;
  }

  parent(): ParentedTree | null {
    return this._parent;
  }

  /** Index of this node among its parent's children (root is -1). */
  index(): number {
    return this._index;
  }

  root(): ParentedTree {
    let node: ParentedTree = this;
    while (node._parent !== null) node = node._parent;
    return node;
  }

  leftSibling(): ParentedTree | string | null {
    const p = this._parent;
    if (p === null || this._index <= 0) return null;
    return p.children[this._index - 1] ?? null;
  }

  rightSibling(): ParentedTree | string | null {
    const p = this._parent;
    if (p === null || this._index < 0 || this._index + 1 >= p.children.length) return null;
    return p.children[this._index + 1] ?? null;
  }

  /**
   * Positions (index paths from this node) of every subtree, like
   * `Tree.treepositions`. Strings are leaves in our representation and are not
   * subtrees, so they only appear under order="leaves".
   */
  treepositions(order: TreePositionsOrder = "preorder"): TreePosition[] {
    const out: TreePosition[] = [];
    const walk = (node: ParentedTree, prefix: TreePosition): void => {
      for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i]!;
        if (typeof child === "string") {
          if (order === "leaves") out.push([...prefix, i]);
          continue;
        }
        const pos = [...prefix, i];
        if (order === "preorder") out.push(pos);
        walk(child, pos);
        if (order === "postorder") out.push(pos);
      }
    };
    walk(this, []);
    return out;
  }

  /** Convert back to the plain {label, children} shape of ./tree_transforms. */
  toPlain(): ParseTree {
    return {
      label: this.label,
      children: this.children.map((child) => (typeof child === "string" ? child : child.toPlain())),
    };
  }

  // ---- mutation API (ImmutableTree overrides these to throw) ----

  setLabel(label: string): void {
    this.label = label;
  }

  insertChild(index: number, child: ParentedTree | string): void {
    if (index < 0 || index > this.children.length) throw new RangeError(`insert index ${index} out of range`);
    this.children.splice(index, 0, child);
    this._reindex();
  }

  removeChild(index: number): ParentedTree | string {
    if (index < 0 || index >= this.children.length) throw new RangeError(`remove index ${index} out of range`);
    const removed = this.children.splice(index, 1)[0]!;
    if (typeof removed !== "string") {
      removed._parent = null;
      removed._index = -1;
    }
    this._reindex();
    return removed;
  }

  protected _reindex(): void {
    for (let i = 0; i < this.children.length; i += 1) {
      const child = this.children[i]!;
      if (typeof child !== "string") {
        child._parent = this;
        child._index = i;
      }
    }
  }
}

/** A frozen tree: structural mutations throw. */
export class ImmutableTree extends ParentedTree {
  private static assertMutable(): never {
    throw new Error("ImmutableTree does not permit mutation");
  }

  static override from(tree: ParseTree, parent: ParentedTree | null = null, index = -1): ImmutableTree {
    const children: Array<ParentedTree | string> = [];
    const node = new ImmutableTree(tree.label, children, parent, index);
    for (let i = 0; i < tree.children.length; i += 1) {
      const child = tree.children[i]!;
      children.push(typeof child === "string" ? child : ImmutableTree.from(child, node, i));
    }
    Object.freeze(children);
    return node;
  }

  override setLabel(_label: string): never {
    ImmutableTree.assertMutable();
  }

  override insertChild(_index: number, _child: ParentedTree | string): never {
    ImmutableTree.assertMutable();
  }

  override removeChild(_index: number): never {
    ImmutableTree.assertMutable();
  }
}
