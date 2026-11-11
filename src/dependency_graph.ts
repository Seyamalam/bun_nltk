/**
 * Partial port of nltk.parse.dependencygraph.DependencyGraph.
 * Supports: CONLL-X loading (via fromString / constructor text), nodelist
 * access, to_conll(10|4|3), triples(), add_arc, contains_cycle,
 * get_cycle_path, remove_by_address, connect_graph.
 * nx-graph helpers (nx_graph, left_children, right_children, chain,
 * contains_address, cycle_analysis, tree/triples tree output) are not ported.
 */
import { pyError } from "./internals";

export class DependencyGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DependencyGraphError";
  }
}

export interface DependencyNode {
  /** defaultdict-created placeholder nodes keep address None (null) until update. */
  address: number | null;
  word: string | null;
  lemma: string | null;
  ctag: string | null;
  tag: string | null;
  feats: string | null;
  head: number | null;
  rel: string | null;
  deps: Record<string, number[]>;
}

type CellExtractor = (cells: string[]) => {
  number: number; word: string; lemma?: string; ctag?: string; tag?: string;
  feats?: string; head: number | null; rel: string;
};

function defaultCellExtractor(cells: string[]) {
  return {
    number: parseInt(cells[0]!, 10),
    word: cells[1]!,
    lemma: cells[2],
    ctag: cells[3],
    tag: cells[4],
    feats: cells[5],
    head: cells[6] !== undefined ? parseInt(cells[6]!, 10) : null,
    rel: cells[7]!,
  };
}

// NLTK DependencyGraph._parse extractors, keyed by cell count. `index` is the
// 1-based line ordinal used when the row lacks a numeric id column.
const CELL_EXTRACTORS: Record<number, CellExtractor> = {
  // 3/4-cell extractors return the enumerate index verbatim (oracle never
  // parses an id column for them) — NaN here falls back to the line ordinal.
  3: (cells) => ({ number: Number.NaN, word: cells[0]!, lemma: cells[0]!, ctag: cells[1]!, tag: cells[1]!, feats: "", head: parseInt(cells[2]!, 10), rel: "" }),
  4: (cells) => ({ number: Number.NaN, word: cells[0]!, lemma: cells[0]!, ctag: cells[1]!, tag: cells[1]!, feats: "", head: parseInt(cells[2]!, 10), rel: cells[3]! }),
  7: (cells) => {
    const n = parseInt(cells[0]!, 10);
    return { number: n, word: cells[1]!, lemma: cells[2]!, ctag: cells[3]!, tag: cells[3]!, feats: "", head: parseInt(cells[5]!, 10), rel: cells[6]! };
  },
  10: defaultCellExtractor,
};

export class DependencyGraph {
  nodes: DependencyNode[] = [];
  root: DependencyNode | null = null;
  stream: string[] = [];
  /** null = whitespace split (oracle cell_separator=None). */
  cellSeparator: string | null = null;
  topRelationLabel = "ROOT";

  constructor(treeStr?: string, options?: {
    cellExtractor?: CellExtractor;
    zeroBased?: boolean;
    cellSeparator?: string | null;
    topRelationLabel?: string;
  }) {
    this.topRelationLabel = options?.topRelationLabel ?? "ROOT";
    this.cellSeparator = options?.cellSeparator ?? null;
    // Oracle: nodes is a defaultdict pre-seeded with the TOP node at 0.
    this.nodes = [this.makeRootNode()];
    if (treeStr !== undefined) {
      this.load(treeStr, {
        cellExtractor: options?.cellExtractor,
        cellSeparator: this.cellSeparator,
        zeroBased: options?.zeroBased,
      });
    }
  }

  /** Port of DependencyGraph.load/_parse. */
  load(data: string | string[], options?: { cellExtractor?: CellExtractor; cellSeparator?: string | null; zeroBased?: boolean }): void {
    // Oracle: rstrip each line, drop empties; "#" comment lines are kept in
    // this port's stream[] (an adaptation — oracle _parse has no comment path).
    const rawLines = Array.isArray(data) ? data : data.split(/\r?\n/);
    this.nodes = [this.makeRootNode()];
    this.root = null;
    this.stream = [];
    const sep = options?.cellSeparator === undefined ? null : options.cellSeparator;
    let lineIndex = 0;
    let cellNumber: number | null = null;
    let extractor = options?.cellExtractor;
    for (const raw of rawLines) {
      const line = raw.replace(/\s+$/, "");
      if (line.startsWith("#")) {
        this.stream.push(line);
        continue;
      }
      if (line === "") continue;
      lineIndex += 1;
      const cells = sep === null ? line.trim().split(/\s+/) : line.split(sep);
      if (cellNumber === null) cellNumber = cells.length;
      else if (cells.length !== cellNumber) {
        throw pyError("AssertionError", `cell count ${cells.length} != ${cellNumber}`);
      }
      if (!extractor) {
        extractor = CELL_EXTRACTORS[cellNumber];
        if (!extractor) {
          throw new DependencyGraphError(
            `Number of tab-delimited fields (${cellNumber}) not supported by CoNLL(10) or Malt-Tab(4) format`,
          );
        }
      }
      const newNode = extractor(cells);
      // Oracle checks the raw head cell for "_" before int() — rows marked "_"
      // are unparsed and skipped; other non-numeric heads raise.
      const rawHead = cellNumber === 3 || cellNumber === 4 ? cells[2] : cellNumber === 7 ? cells[5] : cells[6];
      if (rawHead === "_" || (newNode.head as unknown) === "_") continue;
      if (!Number.isFinite(newNode.number)) {
        newNode.number = lineIndex;
      }
      if (newNode.head !== null && !Number.isFinite(newNode.head)) {
        throw new DependencyGraphError(`Non-number cell in line '${line}'`);
      }
      // Oracle zero_based shifts the head, never the address.
      const head = options?.zeroBased && newNode.head !== null ? newNode.head + 1 : newNode.head;
      const address = newNode.number;
      const rel = cellNumber === 3 && head === 0 ? this.topRelationLabel : newNode.rel;
      // Oracle does nodes[index].update({...}) — dep links pushed by earlier
      // rows must survive, so update in place instead of replacing the node.
      const existing = this.nodes[address];
      const target = existing ?? {
        address: null, word: null, lemma: null, ctag: null, tag: null,
        feats: null, head: null, rel: null, deps: {} as Record<string, number[]>,
      };
      target.address = address;
      target.word = newNode.word ?? null;
      target.lemma = newNode.lemma ?? null;
      target.ctag = newNode.ctag ?? null;
      target.tag = newNode.tag ?? null;
      target.feats = newNode.feats ?? null;
      target.head = head;
      target.rel = newNode.rel;
      this.nodes[address] = target;
      // Oracle: self.nodes[head]["deps"][rel].append(index) — defaultdict
      // semantics: touching a not-yet-loaded head address creates its node.
      if (head !== null && head !== undefined) {
        let headNode = this.nodes[head];
        if (!headNode) {
          // defaultdict touch: fields stay None (incl. address) until update.
          headNode = {
            address: null, word: null, lemma: null, ctag: null, tag: null,
            feats: null, head: null, rel: null, deps: {},
          };
          this.nodes[head] = headNode;
        }
        headNode.deps[rel] = headNode.deps[rel] ?? [];
        headNode.deps[rel]!.push(address);
      }
    }
    // Oracle: root = first node linked under TOP's topRelationLabel deps.
    const rootAddress = this.nodes[0]!.deps[this.topRelationLabel]?.[0];
    this.root = rootAddress !== undefined ? this.nodes[rootAddress]! : null;
  }

  private makeRootNode(): DependencyNode {
    return {
      address: 0, word: null, lemma: null, ctag: "TOP", tag: "TOP",
      feats: null, head: null, rel: null, deps: {},
    };
  }

  get nodelist(): DependencyNode[] {
    return this.nodes.slice(1);
  }

  /** Port of DependencyGraph.to_conll: styles 3, 4 and 10. */
  to_conll(style: 3 | 4 | 10 = 10): string {
    const lines: string[] = [];
    for (const node of this.nodelist) {
      if (style === 3) {
        lines.push(`${node.word}\t${node.tag}\t${node.head ?? 0}`);
      } else if (style === 4) {
        lines.push(`${node.word}\t${node.tag}\t${node.head ?? 0}\t${node.rel}`);
      } else {
        const deps = "_";
        lines.push(
          `${node.address}\t${node.word}\t${node.lemma ?? "_"}\t${node.ctag ?? "_"}\t${node.tag ?? "_"}\t${node.feats ?? "_"}\t${node.head ?? 0}\t${node.rel ?? "None"}\t${deps}\t${deps}`,
        );
      }
    }
    return lines.join("\n") + (lines.length ? "\n" : "");
  }

  /** Port of DependencyGraph.triples: ((head word, ctag), rel, [(dep word, ctag)]). */
  *triples(node?: DependencyNode | number): Generator<[[string | null, string | null], string | null, Array<[string | null, string | null]>]> {
    const nodes: DependencyNode[] = node === undefined
      ? this.nodelist.filter(Boolean)
      : [typeof node === "number" ? this.nodes[node]! : node];
    for (const n of nodes) {
      if (!n) continue;
      const addrs = Object.values(n.deps).flat().sort((a, b) => a - b);
      for (const i of addrs) {
        const dep = this.nodes[i];
        if (!dep) continue;
        yield [[n.word, n.ctag], dep.rel, [[dep.word, dep.ctag]]];
      }
    }
  }

  /** Port of DependencyGraph.add_arc: deps[mod.rel].append(mod) only — no head write. */
  add_arc(headAddress: number, modAddress: number): void {
    const head = this.nodes[headAddress];
    const mod = this.nodes[modAddress];
    if (!head || !mod) throw new DependencyGraphError("Node address out of range");
    // Oracle uses nodes[mod]["rel"] verbatim; a null rel keys "None" (Python None).
    const rel = mod.rel ?? "None";
    head.deps[rel] = head.deps[rel] ?? [];
    head.deps[rel]!.push(modAddress);
  }

  /** Port of DependencyGraph.remove_by_address. */
  remove_by_address(address: number): void {
    for (const node of this.nodes) {
      if (!node) continue;
      for (const rel of Object.keys(node.deps)) {
        node.deps[rel] = node.deps[rel]!.filter((a) => a !== address);
        if (node.deps[rel]!.length === 0) delete node.deps[rel];
      }
    }
    if (this.nodes[address]) {
      (this.nodes as unknown as Array<DependencyNode | undefined>)[address] = undefined;
    }
  }

  /**
   * Port of DependencyGraph.contains_cycle. NLTK quirk: for conll-loaded
   * graphs ``deps`` is a rel->addresses mapping, and the DFS iterates the
   * mapping (yielding rel names, not addresses); rel names are filtered by
   * the node-membership guard, so no cycle is ever reported. Only graphs
   * built with list-style deps can yield a cycle path. Returns the path
   * (possibly empty) like NLTK's list/None truthiness contract.
   */
  contains_cycle(): number[] | false {
    return this.getCyclePath();
  }

  /** DFS over deps keys; see contains_cycle note for the dict-iteration quirk. */
  getCyclePath(): number[] | false {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<number, number>();
    const nodeKeys = this.nodes.map((_, i) => i);
    for (const start of nodeKeys) {
      const startNode = this.nodes[start];
      if (!startNode || (color.get(start) ?? WHITE) !== WHITE) continue;
      color.set(start, GRAY);
      const path: number[] = [start];
      const stack: Array<Iterator<unknown>> = [Object.keys(startNode.deps)[Symbol.iterator]()];
      while (stack.length) {
        const it = stack[stack.length - 1]!;
        const next = it.next();
        if (next.done) {
          color.set(path.pop()!, BLACK);
          stack.pop();
          continue;
        }
        // dep is a rel name when deps is a mapping — filtered like NLTK.
        const dep = next.value;
        const depAddr = typeof dep === "number" ? dep : NaN;
        if (!Number.isFinite(depAddr) || !this.nodes[depAddr]) continue;
        if (color.get(depAddr) === GRAY) {
          return [...path.slice(path.indexOf(depAddr)), depAddr];
        }
        if ((color.get(depAddr) ?? WHITE) === WHITE) {
          color.set(depAddr, GRAY);
          path.push(depAddr);
          stack.push(Object.keys(this.nodes[depAddr]!.deps)[Symbol.iterator]());
        }
      }
    }
    return false;
  }

  /** Port of DependencyGraph.connect_graph: fully connect all non-TOP nodes. */
  connect_graph(): void {
    for (const node1 of this.nodes) {
      if (!node1) continue;
      for (const node2 of this.nodes) {
        if (!node2) continue;
        if (node1.address !== node2.address && node2.rel !== "TOP") {
          const relation = node2.rel ?? this.topRelationLabel;
          node1.deps[relation] = node1.deps[relation] ?? [];
          node1.deps[relation]!.push(node2.address as number);
        }
      }
    }
  }

  /** Port of DependencyGraph.get_by_address. */
  get_by_address(nodeAddress: number): DependencyNode | undefined {
    return this.nodes[nodeAddress];
  }

  /** Port of DependencyGraph.contains_address. */
  contains_address(nodeAddress: number): boolean {
    return this.nodes[nodeAddress] !== undefined;
  }

  /**
   * defaultdict-style node creation used by NLTK's parser ports: ``nodes[k]``
   * auto-instantiates ``{address: None, ..., deps: {}}`` on first access.
   */
  ensure_node(address: number): DependencyNode {
    let node = this.nodes[address];
    if (!node) {
      // defaultdict touch: address stays None until an update provides it.
      node = {
        address: null, word: null, lemma: null, ctag: null, tag: null,
        feats: null, head: null, rel: null, deps: {},
      };
      this.nodes[address] = node;
    }
    return node;
  }

  /** dict.update() semantics: merge ``partial`` into the node at ``address``. */
  update_node(address: number, partial: Partial<DependencyNode>): DependencyNode {
    const node = this.ensure_node(address);
    Object.assign(node, partial);
    return node;
  }

  /** Port of DependencyGraph.add_node (update-if-absent, no replace). */
  add_node(node: Partial<DependencyNode> & { address: number }): void {
    if (!this.contains_address(node.address)) {
      this.update_node(node.address, node);
    }
  }

  /**
   * Port of DependencyGraph.redirect_arcs. NLTK quirk: it iterates the deps
   * dict directly, yielding rel names (not addresses); rel names never match
   * the integer ``originals``, so every node's deps is replaced by the flat
   * list of its rel keys. Reproduced faithfully.
   */
  redirect_arcs(originals: number[], redirect: number): void {
    for (const node of this.nodes) {
      if (!node) continue;
      const newDeps: Array<string | number> = [];
      for (const dep of Object.keys(node.deps)) {
        newDeps.push(originals.includes(dep as unknown as number) ? redirect : dep);
      }
      node.deps = newDeps as unknown as Record<string, number[]>;
    }
  }

  /** Port of DependencyGraph.left_children. */
  left_children(nodeIndex: number): number {
    const node = this.nodes[nodeIndex];
    if (!node) return 0;
    const children = Object.values(node.deps).flat();
    return children.filter((c) => c < (node.address as number)).length;
  }

  /** Port of DependencyGraph.right_children. */
  right_children(nodeIndex: number): number {
    const node = this.nodes[nodeIndex];
    if (!node) return 0;
    const children = Object.values(node.deps).flat();
    return children.filter((c) => c > (node.address as number)).length;
  }

  private _tree(i: number): { label: string; children: Array<unknown> } | string {
    const node = this.nodes[i];
    const word = node?.word ?? null;
    const deps = node ? Object.values(node.deps).flat().sort((a, b) => a - b) : [];
    if (deps.length) {
      return { label: word ?? "", children: deps.map((dep) => this._tree(dep)) };
    }
    return word ?? "";
  }

  /** Port of DependencyGraph.tree: dependency tree rooted at ``root`` (word labels only). */
  tree(): { label: string; children: Array<unknown> } {
    const node = this.root;
    if (!node) throw new DependencyGraphError("DependencyGraph has no root node");
    const deps = Object.values(node.deps).flat().sort((a, b) => a - b);
    return { label: node.word ?? "", children: deps.map((dep) => this._tree(dep)) };
  }
}

export function raise_unorderable_types(message: string): never {
  throw pyError("TypeError", message);
}
