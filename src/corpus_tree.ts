// Synchronous bracketed-tree support for corpus readers.
// Mirrors nltk.tree.Tree.fromstring + the accessors corpus users rely on.
// (src/rust_parse.ts Tree is WASM-runtime-bound and cannot be built sync.)

import { pyError } from "./internals";
import { str2tuple } from "./tag_util";
import { mapTag } from "./tag_mapping";

export type SimpleTreeChild = SimpleTree | string | [string, string | null];

export class SimpleTree {
  label: string;
  children: SimpleTreeChild[];

  constructor(label: string, children: Iterable<SimpleTreeChild> = []) {
    this.label = label;
    this.children = [...children];
  }

  /** nltk.tree.Tree.fromstring — parse a bracketed tree string. */
  static fromstring(s: string, options?: { remove_empty_top_bracketing?: boolean; brackets?: string }): SimpleTree {
    const brackets = options?.brackets ?? "()";
    const openB = brackets[0]!, closeB = brackets[1]!;
    const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenRe = new RegExp(`[${esc(openB)}${esc(closeB)}]|[^\\s${esc(openB)}${esc(closeB)}]+`, "g");
    const tokens = s.match(tokenRe) ?? [];
    for (const [i, tok] of tokens.entries()) {
      if (tok === openB) tokens[i] = openB;
      else if (tok === closeB) tokens[i] = closeB;
      else if (tok.startsWith(openB) || tok.startsWith(closeB) || tok.endsWith(openB) || tok.endsWith(closeB)) {
        throw pyError("ValueError", `Tree.fromstring: malformed bracket token ${JSON.stringify(tok)}`);
      }
    }
    const stack: SimpleTree[] = [];
    for (const [index, tok] of tokens.entries()) {
      if (tok === openB) {
        stack.push(new SimpleTree(""));
      } else if (tok === closeB) {
        if (stack.length === 0) throw pyError("ValueError", `Tree.fromstring: too many close brackets at char ${index}`);
        const finished = stack.pop()!;
        if (finished.children.length === 0) throw pyError("ValueError", `Tree.fromstring: read an empty bracket at char ${index}`);
        if (stack.length === 0) {
          if (typeof finished.children[0] === "string") {
            finished.label = finished.children[0] as string;
            finished.children = finished.children.slice(1);
          }
          if (options?.remove_empty_top_bracketing && finished.label === "" && finished.children.length === 1 && finished.children[0] instanceof SimpleTree) {
            return finished.children[0];
          }
          return finished;
        }
        if (typeof finished.children[0] === "string") {
          finished.label = finished.children[0] as string;
          finished.children = finished.children.slice(1);
        }
        stack[stack.length - 1]!.children.push(finished);
      } else {
        if (stack.length === 0) {
          if (index === 0) continue;
          throw pyError("ValueError", `Tree.fromstring: token ${JSON.stringify(tok)} at char ${index} is not bracketed`);
        }
        stack[stack.length - 1]!.children.push(tok);
      }
    }
    if (stack.length !== 0) throw pyError("ValueError", `Tree.fromstring: read a tree missing a close bracket`);
    throw pyError("ValueError", "Tree.fromstring: no trees found");
  }

  get length(): number { return this.children.length; }
  get(i: number): SimpleTreeChild { return this.children[i]!; }
  [Symbol.iterator](): Iterator<SimpleTreeChild> { return this.children[Symbol.iterator](); }

  leaves(): Array<string | [string, string | null]> {
    const out: Array<string | [string, string | null]> = [];
    for (const c of this.children) {
      if (c instanceof SimpleTree) out.push(...c.leaves());
      else out.push(c);
    }
    return out;
  }

  /** NLTK Tree.pos(): (leaf, preterminal-label) pairs. */
  pos(): Array<[string, string | null]> {
    const out: Array<[string, string | null]> = [];
    const isPreterminal = this.children.every((c) => !(c instanceof SimpleTree));
    if (isPreterminal) {
      for (const c of this.children) {
        if (Array.isArray(c)) out.push(c);
        else out.push([c as string, this.label]);
      }
      return out;
    }
    for (const c of this.children) {
      if (c instanceof SimpleTree) out.push(...c.pos());
      else if (Array.isArray(c)) out.push(c);
      else out.push([c, this.label]);
    }
    return out;
  }

  height(): number {
    let max = 1;
    for (const c of this.children) {
      if (c instanceof SimpleTree) max = Math.max(max, c.height() + 1);
    }
    return max;
  }

  flatten(): SimpleTree {
    const leaves = this.leaves().map((l) => Array.isArray(l) ? tupleStr(l) : l).join(" ");
    return new SimpleTree(this.label, [leaves]);
  }

  repr(): string {
    const childstrs = this.children.map((c) => c instanceof SimpleTree ? c.repr() : Array.isArray(c) ? `('${c[0]}', '${c[1]}')` : c);
    if (this.children.every((c) => !(c instanceof SimpleTree))) {
      return `(${this.label} ${childstrs.join(" ")})`;
    }
    return `(${this.label} ${childstrs.join(" ")})`;
  }

  toString(): string { return this.pformat(); }

  /** nltk.tree.Tree.pformat — one-line flat form, or margin-wrapped layout. */
  pformat(options: { margin?: number; indent?: number; nodesep?: string; parens?: [string, string]; quotes?: [string, string] | true } = {}): string {
    const margin = options.margin ?? 70;
    const indent = options.indent ?? 0;
    const nodesep = options.nodesep ?? "";
    const parens = options.parens ?? ["(", ")"];
    const quotes = options.quotes ?? ["", ""];
    const flat = this._pformatFlat(nodesep, parens, quotes);
    if (flat.length + indent < margin) return flat;
    let s = `${parens[0]}${this.label}${nodesep}`;
    const indentStr = " ".repeat(indent + 2);
    for (const child of this.children) {
      if (child instanceof SimpleTree) {
        s += "\n" + indentStr + child.pformat({ margin, indent: indent + 2, nodesep, parens, quotes });
      } else if (Array.isArray(child)) {
        s += "\n" + indentStr + child.join("/");
      } else if (typeof child === "string" && quotes !== true) {
        s += "\n" + indentStr + quotes[0] + String(child) + quotes[1];
      } else {
        s += "\n" + indentStr + pyRepr(child);
      }
    }
    return s + parens[1];
  }

  private _pformatFlat(nodesep: string, parens: [string, string], quotes: [string, string] | true): string {
    const childstrs = this.children.map((child) => {
      if (child instanceof SimpleTree) return child._pformatFlat(nodesep, parens, quotes);
      if (Array.isArray(child)) return child.join("/");
      if (typeof child === "string" && quotes !== true) return `${quotes[0]}${child}${quotes[1]}`;
      return pyRepr(child);
    });
    return `${parens[0]}${this.label}${nodesep} ${childstrs.join(" ")}${parens[1]}`;
  }
}

function tupleStr(t: [string, string | null]): string {
  return t[1] === null ? t[0] : `${t[0]}/${t[1]}`;
}

function pyRepr(value: unknown): string {
  if (typeof value === "string") return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  return String(value);
}

/** nltk.chunk.tagstr2tree — bracketed tagged text → Tree. */
export function tagstr2tree(s: string, chunkLabel = "NP", rootLabel = "S", sep: string | null = "/", sourceTagset: string | null = null, targetTagset: string | null = null): SimpleTree {
  const stack: SimpleTree[] = [new SimpleTree(rootLabel, [])];
  const re = /\[|\]|[^[\]\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const text = m[0];
    if (text[0] === "[") {
      if (stack.length !== 1) throw pyError("ValueError", `Unexpected [ at char ${m.index}`);
      const chunk = new SimpleTree(chunkLabel, []);
      stack[stack.length - 1]!.children.push(chunk);
      stack.push(chunk);
    } else if (text[0] === "]") {
      if (stack.length !== 2) throw pyError("ValueError", `Unexpected ] at char ${m.index}`);
      stack.pop();
    } else {
      if (sep === null) {
        stack[stack.length - 1]!.children.push(text);
      } else {
        let [word, tag] = str2tuple(text, sep);
        if (sourceTagset && targetTagset && tag !== null) tag = mapTag(sourceTagset, targetTagset, tag);
        stack[stack.length - 1]!.children.push([word, tag]);
      }
    }
  }
  if (stack.length !== 1) throw pyError("ValueError", `Expected ] at char ${s.length}`);
  return stack[0]!;
}
