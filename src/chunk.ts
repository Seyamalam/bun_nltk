export type TaggedToken = {
  token: string;
  tag: string;
};

export type ChunkNode = {
  kind: "chunk";
  label: string;
  tokens: TaggedToken[];
};

export type ChunkElement = TaggedToken | ChunkNode;

type TagPattern = {
  regex: RegExp;
  min: number;
  max: number | null;
};

type ChunkRule = {
  label: string;
  pattern: TagPattern[];
};

function parseQuantifier(raw: string): { min: number; max: number | null } {
  if (raw === "?") return { min: 0, max: 1 };
  if (raw === "*") return { min: 0, max: null };
  if (raw === "+") return { min: 1, max: null };
  return { min: 1, max: 1 };
}

function compilePattern(tagExpr: string, quantifier: string): TagPattern {
  return {
    regex: new RegExp(`^(?:${tagExpr})$`),
    ...parseQuantifier(quantifier),
  };
}

function parseRule(line: string): ChunkRule | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{(.+)\}\s*$/);
  if (!match) return null;

  const label = match[1]!;
  const body = match[2]!;
  const tags = [...body.matchAll(/<([^>]+)>([?*+]*)/g)].map((hit) => compilePattern(hit[1]!, hit[2] ?? ""));
  if (tags.length === 0) return null;

  return { label, pattern: tags };
}

function parseGrammar(grammar: string): ChunkRule[] {
  const out: ChunkRule[] = [];
  for (const line of grammar.split(/\r?\n/g)) {
    const rule = parseRule(line);
    if (rule) out.push(rule);
  }
  return out;
}

function isTaggedToken(node: ChunkElement): node is TaggedToken {
  return (node as ChunkNode).kind !== "chunk";
}

function maxRepeat(nodes: ChunkElement[], start: number, regex: RegExp, hardMax: number | null): number {
  let count = 0;
  let idx = start;
  while (idx < nodes.length) {
    if (hardMax !== null && count >= hardMax) break;
    const node = nodes[idx]!;
    if (!isTaggedToken(node) || !regex.test(node.tag)) break;
    idx += 1;
    count += 1;
  }
  return count;
}

function matchPattern(nodes: ChunkElement[], start: number, pattern: TagPattern[], pIdx = 0): number | null {
  if (pIdx >= pattern.length) return start;
  const part = pattern[pIdx]!;
  const max = maxRepeat(nodes, start, part.regex, part.max);
  for (let used = max; used >= part.min; used -= 1) {
    const end = matchPattern(nodes, start + used, pattern, pIdx + 1);
    if (end !== null) return end;
  }
  return null;
}

function applyRule(nodes: ChunkElement[], rule: ChunkRule): ChunkElement[] {
  const out: ChunkElement[] = [];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i]!;
    if (!isTaggedToken(node)) {
      out.push(node);
      i += 1;
      continue;
    }

    const end = matchPattern(nodes, i, rule.pattern);
    if (end === null || end <= i) {
      out.push(node);
      i += 1;
      continue;
    }

    const span = nodes.slice(i, end);
    if (span.some((item) => !isTaggedToken(item))) {
      out.push(node);
      i += 1;
      continue;
    }

    out.push({
      kind: "chunk",
      label: rule.label,
      tokens: span as TaggedToken[],
    });
    i = end;
  }
  return out;
}

export function regexpChunkParse(tokens: TaggedToken[], grammar: string): ChunkElement[] {
  const rules = parseGrammar(grammar);
  let nodes: ChunkElement[] = tokens.map((item) => ({ token: item.token, tag: item.tag }));
  for (const rule of rules) {
    nodes = applyRule(nodes, rule);
  }
  return nodes;
}

export type IobRow = {
  token: string;
  tag: string;
  iob: string;
};

export function chunkTreeToIob(tree: ChunkElement[]): IobRow[] {
  const out: IobRow[] = [];
  for (const node of tree) {
    if (isTaggedToken(node)) {
      out.push({ token: node.token, tag: node.tag, iob: "O" });
      continue;
    }

    for (let i = 0; i < node.tokens.length; i += 1) {
      const tok = node.tokens[i]!;
      out.push({
        token: tok.token,
        tag: tok.tag,
        iob: i === 0 ? `B-${node.label}` : `I-${node.label}`,
      });
    }
  }
  return out;
}

