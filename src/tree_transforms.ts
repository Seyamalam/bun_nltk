import type { ParseTree } from "./parse";

function tokenizeBracket(input: string): string[] {
  const out: string[] = [];
  const re = /\(|\)|[^\s()]+/g;
  for (const m of input.matchAll(re)) out.push(m[0]!);
  return out;
}

export function treeLeaves(tree: ParseTree): string[] {
  const out: string[] = [];
  for (const child of tree.children) {
    if (typeof child === "string") out.push(child);
    else out.push(...treeLeaves(child));
  }
  return out;
}

export function treeDepth(tree: ParseTree): number {
  let depth = 1;
  for (const child of tree.children) {
    if (typeof child === "string") continue;
    depth = Math.max(depth, 1 + treeDepth(child));
  }
  return depth;
}

export function treeToBracket(tree: ParseTree): string {
  const children = tree.children
    .map((child) => (typeof child === "string" ? child : treeToBracket(child)))
    .join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

export function bracketToTree(text: string): ParseTree {
  const tokens = tokenizeBracket(text);
  let cursor = 0;

  function readNode(): ParseTree {
    if (tokens[cursor] !== "(") throw new Error(`expected '(' at token ${cursor}`);
    cursor += 1;
    const label = tokens[cursor];
    if (!label || label === ")" || label === "(") throw new Error(`invalid label at token ${cursor}`);
    cursor += 1;

    const children: Array<ParseTree | string> = [];
    while (cursor < tokens.length && tokens[cursor] !== ")") {
      if (tokens[cursor] === "(") children.push(readNode());
      else {
        children.push(tokens[cursor]!);
        cursor += 1;
      }
    }

    if (tokens[cursor] !== ")") throw new Error("unterminated bracket tree");
    cursor += 1;
    return { label, children };
  }

  const tree = readNode();
  if (cursor !== tokens.length) throw new Error(`unexpected trailing tokens at ${cursor}`);
  return tree;
}

export function mapTreeLabels(tree: ParseTree, fn: (label: string) => string): ParseTree {
  return {
    label: fn(tree.label),
    children: tree.children.map((child) => (typeof child === "string" ? child : mapTreeLabels(child, fn))),
  };
}

export function collapseUnaryChains(tree: ParseTree): ParseTree {
  const collapsedChildren = tree.children.map((child) => (typeof child === "string" ? child : collapseUnaryChains(child)));
  if (collapsedChildren.length === 1) {
    const only = collapsedChildren[0]!;
    if (typeof only !== "string") {
      return {
        label: `${tree.label}+${only.label}`,
        children: only.children,
      };
    }
  }
  return { label: tree.label, children: collapsedChildren };
}
