import { chunkIobIdsNative } from "./native";

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

type NativePlan = {
  tagToId: Map<string, number>;
  labelById: string[];
  ruleLabelIds: Uint16Array;
  ruleAtomOffsets: Uint32Array;
  ruleAtomCounts: Uint32Array;
  atomAllowedOffsets: Uint32Array;
  atomAllowedLengths: Uint32Array;
  atomAllowedFlat: Uint16Array;
  atomMins: Uint8Array;
  atomMaxs: Uint8Array;
};

function compileNativePlan(tokens: TaggedToken[], rules: ChunkRule[]): NativePlan | null {
  const tags = [...new Set(tokens.map((row) => row.tag))];
  const tagToId = new Map<string, number>();
  for (const tag of tags) tagToId.set(tag, tagToId.size);

  const labelById: string[] = [];
  const labelToId = new Map<string, number>();
  const ruleLabelIds: number[] = [];
  const ruleAtomOffsets: number[] = [];
  const ruleAtomCounts: number[] = [];

  const atomAllowedOffsets: number[] = [];
  const atomAllowedLengths: number[] = [];
  const atomAllowedFlat: number[] = [];
  const atomMins: number[] = [];
  const atomMaxs: number[] = [];

  for (const rule of rules) {
    const labelId = labelToId.get(rule.label) ?? (() => {
      const id = labelById.length;
      labelById.push(rule.label);
      labelToId.set(rule.label, id);
      return id;
    })();
    ruleLabelIds.push(labelId);
    ruleAtomOffsets.push(atomMins.length);
    ruleAtomCounts.push(rule.pattern.length);

    for (const atom of rule.pattern) {
      const allowed = tags
        .filter((tag) => atom.regex.test(tag))
        .map((tag) => tagToId.get(tag)!)
        .sort((a, b) => a - b);
      if (allowed.length === 0) return null;
      atomAllowedOffsets.push(atomAllowedFlat.length);
      atomAllowedLengths.push(allowed.length);
      atomAllowedFlat.push(...allowed);
      atomMins.push(atom.min);
      atomMaxs.push(atom.max === null ? 255 : Math.min(255, atom.max));
    }
  }

  return {
    tagToId,
    labelById,
    ruleLabelIds: Uint16Array.from(ruleLabelIds),
    ruleAtomOffsets: Uint32Array.from(ruleAtomOffsets),
    ruleAtomCounts: Uint32Array.from(ruleAtomCounts),
    atomAllowedOffsets: Uint32Array.from(atomAllowedOffsets),
    atomAllowedLengths: Uint32Array.from(atomAllowedLengths),
    atomAllowedFlat: Uint16Array.from(atomAllowedFlat),
    atomMins: Uint8Array.from(atomMins),
    atomMaxs: Uint8Array.from(atomMaxs),
  };
}

function parseNative(tokens: TaggedToken[], rules: ChunkRule[]): ChunkElement[] | null {
  if (tokens.length === 0) return [];
  if (rules.length === 0) return tokens.map((row) => ({ token: row.token, tag: row.tag }));
  const plan = compileNativePlan(tokens, rules);
  if (!plan) return null;

  const tokenTagIds = Uint16Array.from(tokens.map((row) => plan.tagToId.get(row.tag)!));
  const nativeOut = chunkIobIdsNative({
    tokenTagIds,
    atomAllowedOffsets: plan.atomAllowedOffsets,
    atomAllowedLengths: plan.atomAllowedLengths,
    atomAllowedFlat: plan.atomAllowedFlat,
    atomMins: plan.atomMins,
    atomMaxs: plan.atomMaxs,
    ruleAtomOffsets: plan.ruleAtomOffsets,
    ruleAtomCounts: plan.ruleAtomCounts,
    ruleLabelIds: plan.ruleLabelIds,
  });

  const out: ChunkElement[] = [];
  let i = 0;
  while (i < tokens.length) {
    const labelId = nativeOut.labelIds[i]!;
    if (labelId === 0xffff) {
      out.push(tokens[i]!);
      i += 1;
      continue;
    }

    const label = plan.labelById[labelId];
    if (!label) return null;
    const chunkTokens: TaggedToken[] = [];
    let j = i;
    while (j < tokens.length) {
      const lid = nativeOut.labelIds[j]!;
      if (lid !== labelId) break;
      if (j > i && nativeOut.begins[j] === 1) break;
      chunkTokens.push(tokens[j]!);
      j += 1;
    }
    if (chunkTokens.length === 0) {
      out.push(tokens[i]!);
      i += 1;
      continue;
    }
    out.push({
      kind: "chunk",
      label,
      tokens: chunkTokens,
    });
    i = j;
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
  const nativeTree = parseNative(tokens, rules);
  if (nativeTree) return nativeTree;
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
