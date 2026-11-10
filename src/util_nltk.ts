// Port of nltk.util (NLTK 3.10.3) — generic helpers, graph traversals, and ngram iterators.
// Adaptations: Python generators map to TS generators; print() maps to console.log returning void
// (functions that NLTK prints also return the formatted string where practical); exceptions map to Error.
import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

type Iter<T> = Iterable<T>;

function* iterate<T>(value: Iter<T>): Generator<T> {
  yield* value;
}

/** nltk.util.usage — print the public methods of an object/class. */
export function usage(obj: unknown): void {
  const ctor = typeof obj === "function" ? obj as { name: string; prototype: object }
    : (obj as object)?.constructor as { name: string; prototype: object };
  console.log(`${ctor?.name ?? "object"} supports the following operations:`);
  const proto = typeof obj === "function" ? (obj as { prototype: object }).prototype : obj;
  const names = new Set<string>();
  let cur: object | null = proto as object;
  while (cur && cur !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(cur)) {
      if (!name.startsWith("_") && name !== "constructor") names.add(name);
    }
    cur = Object.getPrototypeOf(cur);
  }
  for (const name of [...names].sort()) console.log(`  - ${name}()`);
}

/** nltk.util.in_idle — false outside CPython IDLE. */
export function in_idle(): boolean {
  return false;
}

function textwrap(s: string, width: number): string[] {
  const words = s.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line === "") line = word;
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else { lines.push(line); line = word; }
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** nltk.util.pr — pretty print a slice of a data sequence. */
export function pr<T>(data: Iter<T>, start = 0, end?: number): void {
  const arr = [...iterate(data)].slice(start, end);
  console.log(JSON.stringify(arr));
}

/** nltk.util.print_string — print a string wrapped on whitespace. */
export function print_string(s: string, width = 70): void {
  console.log(textwrap(s, width).join("\n"));
}

/** nltk.util.tokenwrap — join tokens and wrap on whitespace. */
export function tokenwrap(tokens: readonly string[], separator = " ", width = 70): string {
  return textwrap(tokens.join(separator), width).join("\n");
}

/** nltk.util.cut_string — width-bounded cut aware of combining marks. */
export function cut_string(s: string, width = 70): string {
  let charsSoFar = 0, widthSoFar = 0, result = "";
  const absWidth = Math.abs(width);
  const chars = [...s];
  while (widthSoFar < absWidth && charsSoFar < chars.length) {
    const char = width < 0 ? chars[chars.length - 1 - charsSoFar]! : chars[charsSoFar]!;
    result = width < 0 ? char + result : result + char;
    charsSoFar += 1;
    if (!/\p{M}/u.test(char)) widthSoFar += 1;
  }
  return result;
}

/** nltk.util.Index — defaultdict(list) built from pairs. */
export class Index<K, V> extends Map<K, V[]> {
  constructor(pairs: Iterable<readonly [K, V]>) {
    super();
    for (const [key, value] of pairs) {
      let list = this.get(key);
      if (!list) this.set(key, list = []);
      list.push(value);
    }
  }
}

/** nltk.util.re_show — print string with matched substrings marked. */
export function re_show(regexp: string, string: string, left = "{", right = "}"): void {
  const re = new RegExp(regexp, "gm");
  console.log(string.replace(/\s+$/, "").replace(re, (m) => left + m + right));
}

/** nltk.util.filestring — read a path or file-like into a string. */
export function filestring(f: string | { read(): string }, allowedDir?: string): string {
  if (typeof f !== "string") return f.read();
  const target = resolvePath(f);
  if (allowedDir !== undefined) {
    const safeRoot = resolvePath(allowedDir);
    if (!(target === safeRoot || target.startsWith(safeRoot + "/"))) {
      throw new Error(`Security Violation: Path ${target} is outside allowed_dir ${safeRoot}`);
    }
  }
  try {
    return readFileSync(target, "utf-8");
  } catch {
    return readFileSync(target, "latin1" as BufferEncoding);
  }
}

function defaultChildren<T>(node: T): Iterable<T> {
  return (node != null && typeof (node as unknown as Iterable<T>)[Symbol.iterator] === "function" && typeof node !== "string")
    ? node as unknown as Iterable<T> : [];
}

/** nltk.util.breadth_first — BFS generator (no cycle check). */
export function* breadth_first<T>(tree: T, children: (node: T) => Iterable<T> = defaultChildren, maxdepth = -1): Generator<T> {
  const queue: [T, number][] = [[tree, 0]];
  let head = 0;
  while (head < queue.length) {
    const [node, depth] = queue[head++]!;
    yield node;
    if (depth !== maxdepth) {
      try {
        for (const c of children(node)) queue.push([c, depth + 1]);
      } catch { /* non-iterable child provider */ }
    }
  }
}

/** nltk.util.edge_closure — BFS edge generator discarding cycles. */
export function* edge_closure<T>(tree: T, children: (node: T) => Iterable<T> = defaultChildren, maxdepth = -1, verbose = false): Generator<readonly [T, T]> {
  const traversed = new Set<T>();
  const edges = new Set<string>();
  const queue: [T, number][] = [[tree, 0]];
  let head = 0;
  while (head < queue.length) {
    const [node, depth] = queue[head++]!;
    traversed.add(node);
    if (depth !== maxdepth) {
      try {
        for (const child of children(node)) {
          if (!traversed.has(child)) queue.push([child, depth + 1]);
          else if (verbose) console.warn(`Discarded redundant search for ${String(child)} at depth ${depth + 1}`);
          const key = JSON.stringify([node, child]);
          if (!edges.has(key)) { edges.add(key); yield [node, child] as const; }
        }
      } catch { /* non-iterable */ }
    }
  }
}

/** nltk.util.edges2dot — render edges in DOT language. */
export function edges2dot<T>(edges: Iterable<readonly [T, T]>, shapes?: Record<string, string>, attr?: Record<string, string>): string {
  let out = "digraph G {\n";
  for (const [k, v] of Object.entries(attr ?? {})) out += `${k} = ${v};\n`;
  for (const edge of edges) {
    for (const [needle, shape] of Object.entries(shapes ?? {})) {
      for (const node of [edge[0], edge[1]]) {
        if (JSON.stringify(node).includes(needle)) out += `"${String(node)}" [shape = ${shape}];\n`;
      }
    }
    out += `"${String(edge[0])}" -> "${String(edge[1])}";\n`;
  }
  return out + "}\n";
}

/** nltk.util.unweighted_minimum_spanning_dict — BFS MST as adjacency map. */
export function unweighted_minimum_spanning_dict<T>(tree: T, children: (node: T) => Iterable<T> = defaultChildren): Map<T, T[]> {
  const traversed = new Set<T>();
  const queue: T[] = [tree];
  const agenda = new Set<T>([tree]);
  const mstdic = new Map<T, T[]>();
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++]!;
    mstdic.set(node, []);
    if (!traversed.has(node)) {
      traversed.add(node);
      for (const child of children(node)) {
        if (!agenda.has(child)) {
          mstdic.get(node)!.push(child);
          queue.push(child);
          agenda.add(child);
        }
      }
    }
  }
  return mstdic;
}

/** nltk.util.unweighted_minimum_spanning_digraph — MST rendered in DOT. */
export function unweighted_minimum_spanning_digraph<T>(tree: T, children: (node: T) => Iterable<T> = defaultChildren, shapes?: Record<string, string>, attr?: Record<string, string>): string {
  const mst = unweighted_minimum_spanning_dict(tree, children);
  return edges2dot(edge_closure(tree, (node) => mst.get(node) ?? []), shapes, attr);
}

/** nltk.util.acyclic_breadth_first — BFS discarding cycles. */
export function* acyclic_breadth_first<T>(tree: T, children: (node: T) => Iterable<T> = defaultChildren, maxdepth = -1, verbose = false): Generator<T> {
  const traversed = new Set<T>();
  const queue: [T, number][] = [[tree, 0]];
  let head = 0;
  while (head < queue.length) {
    const [node, depth] = queue[head++]!;
    if (traversed.has(node)) continue;
    yield node;
    traversed.add(node);
    if (depth !== maxdepth) {
      try {
        for (const child of children(node)) {
          if (!traversed.has(child)) queue.push([child, depth + 1]);
          else if (verbose) console.warn(`Discarded redundant search for ${String(child)} at depth ${depth + 1}`);
        }
      } catch { /* non-iterable */ }
    }
  }
}

type Nested<T> = T | Nested<T>[];

/** nltk.util.acyclic_depth_first — nested-list DFS discarding all cycles. */
export function acyclic_depth_first<T>(tree: T, children: (node: T) => Iterable<T> = defaultChildren, depth = -1, cutMark?: string, traversed?: Set<T>, verbose = false): Nested<T | string>[] {
  if (traversed === undefined) traversed = new Set([tree]);
  const outTree: Nested<T | string>[] = [tree];
  if (depth !== 0) {
    try {
      for (const child of children(tree)) {
        if (!traversed.has(child)) {
          traversed.add(child);
          outTree.push(acyclic_depth_first(child, children, depth - 1, cutMark, traversed, verbose));
        } else {
          if (verbose) console.warn(`Discarded redundant search for ${String(child)} at depth ${depth - 1}`);
          if (cutMark) outTree.push(`Cycle(${String(child)},${depth - 1},${cutMark})`);
        }
      }
    } catch { /* non-iterable */ }
  } else if (cutMark) {
    outTree.push(cutMark);
  }
  return outTree;
}

/** nltk.util.acyclic_branches_depth_first — DFS discarding within-branch cycles only. */
export function acyclic_branches_depth_first<T>(tree: T, children: (node: T) => Iterable<T> = defaultChildren, depth = -1, cutMark?: string, traversed?: Set<T>, verbose = false): Nested<T | string>[] {
  if (traversed === undefined) traversed = new Set([tree]);
  const outTree: Nested<T | string>[] = [tree];
  if (depth !== 0) {
    try {
      for (const child of children(tree)) {
        if (!traversed.has(child)) {
          outTree.push(acyclic_branches_depth_first(child, children, depth - 1, cutMark, new Set([...traversed, child]), verbose));
        } else {
          if (verbose) console.warn(`Discarded redundant search for ${String(child)} at depth ${depth - 1}`);
          if (cutMark) outTree.push(`Cycle(${String(child)},${depth - 1},${cutMark})`);
        }
      }
    } catch { /* non-iterable */ }
  } else if (cutMark) {
    outTree.push(cutMark);
  }
  return outTree;
}

/** nltk.util.acyclic_dic2tree — adjacency dict to nested list tree. */
export function acyclic_dic2tree<T>(node: T, dic: Map<T, T[]> | Record<string, T[]>): Nested<T>[] {
  const kids = dic instanceof Map ? dic.get(node) ?? [] : (dic as Record<string, T[]>)[String(node)] ?? [];
  return [node, ...kids.map((child) => acyclic_dic2tree(child, dic))];
}

/** nltk.util.unweighted_minimum_spanning_tree — BFS MST as nested lists. */
export function unweighted_minimum_spanning_tree<T>(tree: T, children: (node: T) => Iterable<T> = defaultChildren): Nested<T>[] {
  return acyclic_dic2tree(tree, unweighted_minimum_spanning_dict(tree, children));
}

/** nltk.util.guess_encoding — decode bytes trying utf-8 then latin-1. */
export function guess_encoding(data: Uint8Array): [string, string] {
  for (const enc of ["utf-8", "latin1"] as const) {
    try {
      const decoded = new TextDecoder(enc === "utf-8" ? "utf-8" : "latin1", { fatal: enc === "utf-8" }).decode(data);
      return [decoded, enc === "latin1" ? "latin-1" : "utf-8"];
    } catch { /* try next */ }
  }
  throw new Error("Unable to decode input data. Tried the following encodings: 'utf-8', 'latin-1'.");
}

/** nltk.util.unique_list — dedupe preserving order. */
export function unique_list<T>(xs: Iterable<T>): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of xs) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
}

/** nltk.util.invert_dict — invert dict, collecting iterable values into lists. */
export function invert_dict<K, V>(d: Map<K, V | Iterable<V>> | Record<string, V | Iterable<V>>): Map<unknown, unknown> {
  const inverted = new Map<unknown, unknown>();
  const entries = d instanceof Map ? d.entries() : Object.entries(d);
  for (const [key, value] of entries as Iterable<[K, V | Iterable<V>]>) {
    if (value != null && typeof value !== "string" && typeof (value as Iterable<V>)[Symbol.iterator] === "function") {
      for (const term of value as Iterable<V>) {
        let list = inverted.get(term) as K[] | undefined;
        if (!list) inverted.set(term, list = []);
        list.push(key);
      }
    } else {
      inverted.set(value, key);
    }
  }
  return inverted;
}

/** nltk.util.clean_html — raises in NLTK; mirrored. */
export function clean_html(_html: string): never {
  throw new Error("To remove HTML markup, use BeautifulSoup's get_text() function");
}

/** nltk.util.clean_url — raises in NLTK; mirrored. */
export function clean_url(_url: string): never {
  throw new Error("To remove HTML markup, use BeautifulSoup's get_text() function");
}

/** nltk.util.flatten — flatten mixed nested arrays. */
export function flatten<T>(...args: unknown[]): T[] {
  const x: T[] = [];
  for (const item of args) {
    if (!Array.isArray(item)) x.push(item as T);
    else x.push(...flatten<T>(...item) as T[]);
  }
  return x;
}

/** nltk.util.pad_sequence — pad a sequence for ngram extraction. */
export function* pad_sequence<T>(sequence: Iterable<T>, n: number, options: {
  pad_left?: boolean; pad_right?: boolean; left_pad_symbol?: T; right_pad_symbol?: T;
} = {}): Generator<T> {
  const { pad_left = false, pad_right = false, left_pad_symbol, right_pad_symbol } = options;
  if (pad_left) for (let i = 0; i < n - 1; i++) yield left_pad_symbol as T;
  yield* sequence;
  if (pad_right) for (let i = 0; i < n - 1; i++) yield right_pad_symbol as T;
}

/** nltk.util.ngrams — ngram generator with optional padding. */
export function* ngrams<T>(sequence: Iterable<T>, n: number, kwargs: {
  pad_left?: boolean; pad_right?: boolean; left_pad_symbol?: T; right_pad_symbol?: T;
} = {}): Generator<T[]> {
  const it = pad_sequence(sequence, n, kwargs)[Symbol.iterator]();
  const window: T[] = [];
  for (let i = 0; i < n; i++) {
    const next = it.next();
    if (next.done) break;
    window.push(next.value);
  }
  if (window.length === n) yield [...window];
  for (let r = it.next(); !r.done; r = it.next()) {
    window.push(r.value);
    window.shift();
    yield [...window];
  }
}

/** nltk.util.bigrams */
export function* bigrams<T>(sequence: Iterable<T>, kwargs: {
  pad_left?: boolean; pad_right?: boolean; left_pad_symbol?: T; right_pad_symbol?: T;
} = {}): Generator<T[]> {
  yield* ngrams(sequence, 2, kwargs);
}

/** nltk.util.trigrams */
export function* trigrams<T>(sequence: Iterable<T>, kwargs: {
  pad_left?: boolean; pad_right?: boolean; left_pad_symbol?: T; right_pad_symbol?: T;
} = {}): Generator<T[]> {
  yield* ngrams(sequence, 3, kwargs);
}

export const MAX_EVERYGRAMS_DEFAULT_LEN = 256;

/** nltk.util.everygrams — all ngrams from min_len to max_len. */
export function* everygrams<T>(sequence: Iterable<T>, minLen = 1, maxLen = -1, kwargs: {
  pad_left?: boolean; pad_right?: boolean; left_pad_symbol?: T; right_pad_symbol?: T;
} = {}): Generator<T[]> {
  let seq: Iterable<T> = sequence;
  if (maxLen === -1) {
    if (!Array.isArray(seq)) seq = [...seq];
    maxLen = (seq as T[]).length;
    if (maxLen > MAX_EVERYGRAMS_DEFAULT_LEN) {
      throw new Error(
        `everygrams() called with the default max_len on a sequence of ${maxLen} items: ` +
        `enumerating every n-gram of every length up to ${maxLen} yields O(n**2) tuples ` +
        `(O(n**3) elements) and can exhaust memory (CWE-770). Pass an explicit max_len ` +
        `(e.g. max_len=min_len), or raise nltk.util.MAX_EVERYGRAMS_DEFAULT_LEN.`);
    }
  }
  const it = pad_sequence(seq, maxLen, kwargs)[Symbol.iterator]();
  const history: T[] = [];
  for (let i = 0; i < maxLen; i++) {
    const next = it.next();
    if (next.done) break;
    history.push(next.value);
  }
  while (history.length) {
    for (let ngramLen = minLen; ngramLen <= history.length; ngramLen++) {
      yield history.slice(0, ngramLen);
    }
    const next = it.next();
    if (!next.done) history.push(next.value);
    history.shift();
  }
}

function* combinations<T>(arr: readonly T[], r: number, start = 0, chosen: T[] = []): Generator<T[]> {
  if (chosen.length === r) { yield [...chosen]; return; }
  for (let i = start; i <= arr.length - (r - chosen.length); i++) {
    chosen.push(arr[i]!);
    yield* combinations(arr, r, i + 1, chosen);
    chosen.pop();
  }
}

const SKIPGRAM_SENTINEL = Symbol("sentinel");

/** nltk.util.skipgrams — ngrams allowing up to k skipped tokens. */
export function* skipgrams<T>(sequence: Iterable<T>, n: number, k: number, kwargs: {
  pad_left?: boolean; pad_right?: boolean; left_pad_symbol?: T; right_pad_symbol?: T;
} = {}): Generator<(T | typeof SKIPGRAM_SENTINEL)[]> {
  let seq: Iterable<unknown> = sequence;
  if ("pad_left" in kwargs || "pad_right" in kwargs) {
    seq = pad_sequence(sequence, n, kwargs);
  }
  for (const ngram of ngrams(seq as Iterable<T | typeof SKIPGRAM_SENTINEL>, n + k, { pad_right: true, right_pad_symbol: SKIPGRAM_SENTINEL })) {
    const head = ngram.slice(0, 1);
    const tail = ngram.slice(1);
    for (const skipTail of combinations(tail, n - 1)) {
      if (skipTail[skipTail.length - 1] === SKIPGRAM_SENTINEL) continue;
      yield [...head, ...skipTail];
    }
  }
}

/** nltk.util.binary_search_file — find the line whose first word is key in a sorted file. */
export function binary_search_file(path: string, key: string, cache?: Map<number, [number, string]>, cacheDepth = -1): string | null {
  const fd = openSync(path, "r");
  try {
    const size = statSync(path).size;
    key = key + " ";
    const keylen = key.length;
    let start = 0;
    let end = size - 1;
    let currentDepth = 0;
    const cacheMap = cache ?? new Map<number, [number, string]>();

    const readLineFrom = (offset: number): string => {
      const buf = Buffer.alloc(size - offset);
      const len = readSync(fd, buf, 0, buf.length, offset);
      const nl = buf.indexOf(0x0a, 0);
      return buf.slice(0, nl === -1 ? len : nl + 1).toString("utf-8");
    };
    const lineStart = (middle: number): number => {
      if (middle <= 0) return 0;
      const buf = Buffer.alloc(middle);
      readSync(fd, buf, 0, middle, 0);
      const prev = buf.lastIndexOf(0x0a, middle - 1);
      return prev === -1 ? 0 : prev + 1;
    };

    while (start < end) {
      const lastState = `${start},${end}`;
      let middle = Math.floor((start + end) / 2);
      let offset: number, line: string;
      if (cacheMap.has(middle)) {
        [offset, line] = cacheMap.get(middle)!;
      } else {
        while (true) {
          offset = lineStart(Math.max(0, middle));
          line = readLineFrom(offset);
          if (line !== "") break;
          middle = Math.floor((start + middle) / 2);
          if (middle === end - 1) return null;
        }
        if (currentDepth < cacheDepth) cacheMap.set(middle, [offset, line]);
      }
      if (offset > end) {
        end = middle - 1;
      } else if (line.slice(0, keylen) === key) {
        return line;
      } else if (line > key) {
        end = middle - 1;
      } else if (line < key) {
        start = offset + line.length - 1;
      }
      currentDepth += 1;
      if (`${start},${end}` === lastState) return null;
    }
    return null;
  } finally {
    closeSync(fd);
  }
}

/** nltk.util.set_proxy — configures an HTTP proxy for subsequent downloads (no-op stub recording config). */
export const proxyConfig: { proxy: string | null; user: string | null } = { proxy: null, user: null };
export function set_proxy(proxy: string | null, user: string | null = null, _password = ""): void {
  if (proxy === null) {
    const envProxy = process.env.http_proxy ?? process.env.HTTP_PROXY;
    if (!envProxy) throw new Error("Could not detect default proxy settings");
    proxy = envProxy;
  }
  proxyConfig.proxy = proxy;
  proxyConfig.user = user;
}

/** nltk.util.elementtree_indent — indent an {text, tail, children} element tree. */
export function elementtree_indent(elem: { text?: string | null; tail?: string | null; children?: { text?: string | null; tail?: string | null; children?: unknown[] }[] }, level = 0): void {
  const i = "\n" + "  ".repeat(level);
  const kids = elem.children ?? [];
  if (kids.length) {
    if (!elem.text || !elem.text.trim()) elem.text = i + "  ";
    for (const child of kids) elementtree_indent(child as typeof elem, level + 1);
    const lastTail = (kids[kids.length - 1] as { tail?: string | null }).tail;
    if (!lastTail || !lastTail.trim()) (kids[kids.length - 1] as { tail?: string | null }).tail = i;
    if (!elem.tail || !elem.tail.trim()) elem.tail = i;
  } else if (level && (!elem.tail || !elem.tail.trim())) {
    elem.tail = i;
  }
}

/** nltk.util.choose — binomial coefficient nCk. */
export function choose(n: number, k: number): number {
  if (0 <= k && k <= n) {
    let ntok = 1, ktok = 1;
    const bound = Math.min(k, n - k);
    for (let t = 1; t <= bound; t++) {
      ntok *= n; ktok *= t; n -= 1;
    }
    return Math.floor(ntok / ktok);
  }
  return 0;
}

/** nltk.util.pairwise — consecutive pairs. */
export function* pairwise<T>(iterable: Iterable<T>): Generator<[T, T]> {
  const it = iterable[Symbol.iterator]();
  let a = it.next();
  while (!a.done) {
    const b = it.next();
    if (b.done) break;
    yield [a.value, b.value];
    a = b;
  }
}

/** nltk.internals.raise_unorderable_types — ordering guard used by chart rules. */
export function raise_unorderable_types(ordering: string, a: unknown, b: unknown): never {
  const name = (v: unknown) => v == null ? String(v) : (v as object).constructor?.name ?? typeof v;
  throw new TypeError(`unorderable types: ${name(a)}() ${ordering} ${name(b)}()`);
}

/** nltk.util.deprecated — decorator marking a callable deprecated (JS adaptation: wraps with a console.warn). */
export function deprecated<T extends (...args: never[]) => unknown>(message: string, fn: T): T {
  const wrapped = (...args: unknown[]) => {
    console.warn(`Function is deprecated: ${message}`);
    return fn(...(args as never[]));
  };
  return wrapped as unknown as T;
}

/** nltk.util.parallelize_preprocess — sequential fallback when processes <= 1 (JS runs single-process). */
export function* parallelize_preprocess<T, U>(func: (x: T) => U, iterator: Iterable<T>, _processes = 1, _progressBar = false): Generator<U> {
  for (const item of iterator) yield func(item);
}

type SliceLike = { start?: number | null; stop?: number | null; step?: number | null };
type Indexable = { length: number; [index: number]: unknown } | readonly unknown[];

function seqLength(seq: Indexable): number { return seq.length; }
function seqAt(seq: Indexable, i: number): unknown { return (seq as readonly unknown[])[i]; }

/** nltk.internals.slice_bounds — resolve a slice to (start, stop[, step]) bounds. */
export function slice_bounds(sequence: Indexable, sliceObj: SliceLike, allowStep = false): [number, number] | [number, number, number] {
  let start = sliceObj.start ?? null;
  let stop = sliceObj.stop ?? null;
  if (allowStep) {
    const step = sliceObj.step ?? 1;
    if (step < 0) {
      [start, stop] = slice_bounds(sequence, { start: stop, stop: start }) as [number, number];
    } else {
      [start, stop] = slice_bounds(sequence, { start, stop }) as [number, number];
    }
    return [start, stop, step];
  }
  if (sliceObj.step !== null && sliceObj.step !== undefined && sliceObj.step !== 1) {
    throw new Error("slices with steps are not supported");
  }
  const len = seqLength(sequence);
  if (start === null || start === undefined) start = 0;
  if (stop === null || stop === undefined) stop = len;
  if (start < 0) start = Math.max(0, len + start);
  if (stop < 0) stop = Math.max(0, len + stop);
  if (stop > 0) {
    if (seqAt(sequence, stop - 1) === undefined) stop = len;
  }
  start = Math.min(start, stop);
  return [start, stop];
}
