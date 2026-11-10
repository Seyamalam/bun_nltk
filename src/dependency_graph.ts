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
  address: number;
  word: string | null;
  lemma: string | null;
  ctag: string | null;
  tag: string | null;
  feats: string | null;
  head: number | null;
  rel: string;
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

export class DependencyGraph {
  nodes: DependencyNode[] = [];
  root: DependencyNode | null = null;
  stream: string[] = [];
  cellSeparator = "\t";
  topRelationLabel = "ROOT";

  constructor(treeStr?: string, options?: {
    cellExtractor?: CellExtractor;
    zeroBased?: boolean;
    cellSeparator?: string;
    topRelationLabel?: string;
  }) {
    this.topRelationLabel = options?.topRelationLabel ?? "ROOT";
    this.cellSeparator = options?.cellSeparator ?? "\t";
    if (treeStr !== undefined) {
      this.load(treeStr, {
        cellExtractor: options?.cellExtractor,
        zeroBased: options?.zeroBased,
      });
    }
  }

  /** Port of DependencyGraph.load. */
  load(data: string | string[], options?: { cellExtractor?: CellExtractor; zeroBased?: boolean }): void {
    const lines = Array.isArray(data) ? data : data.split(/\r?\n/);
    this.nodes = [this.makeRootNode()];
    this.root = this.nodes[0]!;
    for (const line of lines) {
      if (line.startsWith("#")) {
        this.stream.push(line);
        continue;
      }
      const trimmed = line.trim();
      if (trimmed === "") continue;
      const cells = trimmed.split(options?.cellSeparator ?? this.cellSeparator);
      if (cells.length < 4) {
        throw new DependencyGraphError(`Incorrect number of cells in line '${trimmed}'`);
      }
      const extractor = options?.cellExtractor ?? defaultCellExtractor;
      const newNode = extractor(cells);
      if (!Number.isFinite(newNode.number)) {
        throw new DependencyGraphError(`Non-number cell in line '${trimmed}'`);
      }
      const address = options?.zeroBased ? newNode.number + 1 : newNode.number;
      this.nodes[address] = {
        address,
        word: newNode.word ?? null,
        lemma: newNode.lemma ?? null,
        ctag: newNode.ctag ?? null,
        tag: newNode.tag ?? null,
        feats: newNode.feats ?? null,
        head: newNode.head,
        rel: newNode.rel,
        deps: {},
      };
    }
    // Build deps links from head pointers.
    for (let i = 1; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (!node) continue;
      if (node.head === 0 || node.head === null || node.head === undefined) {
        if (node.rel !== this.topRelationLabel && (node.head === 0)) {
          this.root!.deps[node.rel] = this.root!.deps[node.rel] ?? [];
          this.root!.deps[node.rel]!.push(node.address);
          continue;
        }
        if (node.head === 0) {
          this.root!.deps[this.topRelationLabel] = this.root!.deps[this.topRelationLabel] ?? [];
          this.root!.deps[this.topRelationLabel]!.push(node.address);
          continue;
        }
        continue;
      }
      const headNode = this.nodes[node.head];
      if (headNode) {
        headNode.deps[node.rel] = headNode.deps[node.rel] ?? [];
        headNode.deps[node.rel]!.push(node.address);
      }
    }
  }

  private makeRootNode(): DependencyNode {
    return {
      address: 0, word: null, lemma: null, ctag: "TOP", tag: "TOP",
      feats: null, head: null, rel: this.topRelationLabel, deps: {},
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
          `${node.address}\t${node.word}\t${node.lemma ?? "_"}\t${node.ctag ?? "_"}\t${node.tag ?? "_"}\t${node.feats ?? "_"}\t${node.head ?? 0}\t${node.rel}\t${deps}\t${deps}`,
        );
      }
    }
    return lines.join("\n") + (lines.length ? "\n" : "");
  }

  /** Port of DependencyGraph.triples: ((head word, ctag), rel, [(dep word, ctag)]). */
  *triples(node?: DependencyNode | number): Generator<[[string | null, string | null], string, Array<[string | null, string | null]>]> {
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

  /** Port of DependencyGraph.add_arc. */
  add_arc(headAddress: number, modAddress: number): void {
    const head = this.nodes[headAddress];
    const mod = this.nodes[modAddress];
    if (!head || !mod) throw new DependencyGraphError("Node address out of range");
    const rel = mod.rel || this.topRelationLabel;
    head.deps[rel] = head.deps[rel] ?? [];
    head.deps[rel]!.push(modAddress);
    mod.head = headAddress;
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

  /** Port of DependencyGraph.connect_graph (attach cycle roots to node 0). */
  connect_graph(): void {
    for (const node of this.nodelist) {
      if (!node) continue;
      if (node.head === null || node.head === undefined) {
        if (node.address !== 0 && !Object.values(this.nodes[0]!.deps).flat().includes(node.address)) {
          node.head = 0;
          node.rel = this.topRelationLabel;
          this.nodes[0]!.deps[this.topRelationLabel] = this.nodes[0]!.deps[this.topRelationLabel] ?? [];
          this.nodes[0]!.deps[this.topRelationLabel]!.push(node.address);
        }
      }
    }
  }
}

export function raise_unorderable_types(message: string): never {
  throw pyError("TypeError", message);
}
