import { wordTokenizeSubset } from "./tokenizers";
import type { ParseTree } from "./parse";

export type FeatureMap = Record<string, string>;

export type FeatureSymbol = {
  base: string;
  features: FeatureMap;
  terminal: boolean;
  surface?: string;
};

export type FeatureProduction = {
  lhs: FeatureSymbol;
  rhs: FeatureSymbol[];
};

export type FeatureCfgGrammar = {
  startSymbol: FeatureSymbol;
  productions: FeatureProduction[];
};

type FeatureParseResult = {
  tree: ParseTree;
  next: number;
  features: FeatureMap;
  env: Map<string, string>;
};

function isVariable(value: string): boolean {
  return value.startsWith("?");
}

function cloneEnv(env: Map<string, string>): Map<string, string> {
  return new Map(env);
}

function resolveValue(value: string, env: Map<string, string>): string {
  let current = value;
  let depth = 0;
  while (isVariable(current) && env.has(current) && depth < 32) {
    const next = env.get(current)!;
    if (next === current) break;
    current = next;
    depth += 1;
  }
  return current;
}

function unifyTerms(left: string, right: string, env: Map<string, string>): boolean {
  const l = resolveValue(left, env);
  const r = resolveValue(right, env);
  if (isVariable(l) && isVariable(r)) {
    if (l !== r) env.set(r, l);
    return true;
  }
  if (isVariable(l)) {
    env.set(l, r);
    return true;
  }
  if (isVariable(r)) {
    env.set(r, l);
    return true;
  }
  return l === r;
}

function unifyConstraints(pattern: FeatureMap, constraints: FeatureMap, env: Map<string, string>): boolean {
  for (const [key, expected] of Object.entries(constraints)) {
    const p = pattern[key];
    if (p === undefined) return false;
    if (!unifyTerms(p, expected, env)) return false;
  }
  return true;
}

function resolveFeatureMap(symbol: FeatureSymbol, env: Map<string, string>, constraints?: FeatureMap): FeatureMap {
  const out: FeatureMap = {};
  for (const [key, value] of Object.entries(symbol.features)) {
    out[key] = resolveValue(value, env);
  }
  if (constraints) {
    for (const [key, value] of Object.entries(constraints)) {
      out[key] = resolveValue(value, env);
    }
  }
  return out;
}

function featureLabel(base: string, features: FeatureMap): string {
  const pairs = Object.entries(features).sort((a, b) => a[0].localeCompare(b[0]));
  if (pairs.length === 0) return base;
  return `${base}[${pairs.map(([k, v]) => `${k}=${v}`).join(",")}]`;
}

function splitAlternatives(rhs: string): string[] {
  return rhs
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenizeRuleRhs(rhs: string): string[] {
  const tokens: string[] = [];
  const matches = rhs.matchAll(/'[^']*'|"[^"]*"|[^\s]+/g);
  for (const hit of matches) {
    const token = hit[0]!.trim();
    if (token) tokens.push(token);
  }
  return tokens;
}

function parseFeatureSpec(spec: string): FeatureMap {
  const out: FeatureMap = {};
  const trimmed = spec.trim();
  if (!trimmed) return out;
  for (const rawItem of trimmed.split(",")) {
    const item = rawItem.trim();
    if (!item) continue;
    const match = item.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^\s,\]]+)$/);
    if (match) {
      out[match[1]!] = match[2]!;
    } else {
      out[item] = "true";
    }
  }
  return out;
}

function parseSymbol(raw: string): FeatureSymbol {
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith("\"") && raw.endsWith("\""))) {
    const surface = raw.slice(1, -1);
    return { base: surface, surface, terminal: true, features: {} };
  }
  const match = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\[(.+)\])?$/);
  if (!match) {
    return { base: raw, terminal: false, features: {} };
  }
  const base = match[1]!;
  const features = parseFeatureSpec(match[2] ?? "");
  return { base, terminal: false, features };
}

export function parseFeatureCfgGrammar(grammarText: string, options?: { startSymbol?: string }): FeatureCfgGrammar {
  const productions: FeatureProduction[] = [];
  let firstLhs: FeatureSymbol | null = null;

  for (const line of grammarText.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(.+?)\s*->\s*(.+)$/);
    if (!match) continue;
    const lhs = parseSymbol(match[1]!.trim());
    if (lhs.terminal) throw new Error("feature grammar LHS cannot be terminal");
    if (!firstLhs) firstLhs = lhs;
    const rhsRaw = match[2]!;
    for (const alt of splitAlternatives(rhsRaw)) {
      const rhs = tokenizeRuleRhs(alt).map(parseSymbol);
      if (rhs.length > 0) productions.push({ lhs, rhs });
    }
  }

  if (productions.length === 0 || !firstLhs) throw new Error("feature grammar contains no productions");

  const startSymbol = options?.startSymbol ? parseSymbol(options.startSymbol) : firstLhs;
  return { startSymbol, productions };
}

export function featureChartParse(
  tokens: string[],
  grammar: FeatureCfgGrammar,
  options: { maxTrees?: number; maxDepth?: number; startSymbol?: FeatureSymbol | string } = {},
): ParseTree[] {
  const maxTrees = Math.max(1, options.maxTrees ?? 8);
  const maxDepth = Math.max(1, options.maxDepth ?? Math.max(32, tokens.length * 4));
  const start =
    typeof options.startSymbol === "string"
      ? parseSymbol(options.startSymbol)
      : (options.startSymbol ?? grammar.startSymbol);

  const rulesByBase = new Map<string, FeatureProduction[]>();
  for (const prod of grammar.productions) {
    const rows = rulesByBase.get(prod.lhs.base) ?? [];
    rows.push(prod);
    rulesByBase.set(prod.lhs.base, rows);
  }

  const recursionGuard = new Map<string, number>();

  const parseNonterminal = (
    base: string,
    constraints: FeatureMap,
    index: number,
    env: Map<string, string>,
    depth: number,
  ): FeatureParseResult[] => {
    if (depth > maxDepth) return [];
    const key = `${base}@${index}`;
    const seen = recursionGuard.get(key) ?? 0;
    if (seen > 3) return [];
    recursionGuard.set(key, seen + 1);

    const out: FeatureParseResult[] = [];
    const dedupe = new Set<string>();
    for (const prod of rulesByBase.get(base) ?? []) {
      const env0 = cloneEnv(env);
      if (!unifyConstraints(prod.lhs.features, constraints, env0)) continue;

      type SeqState = { next: number; children: Array<ParseTree | string>; env: Map<string, string> };
      let states: SeqState[] = [{ next: index, children: [], env: env0 }];
      for (const rhsSym of prod.rhs) {
        const nextStates: SeqState[] = [];
        for (const state of states) {
          if (rhsSym.terminal) {
            if (state.next < tokens.length && tokens[state.next] === rhsSym.base) {
              nextStates.push({
                next: state.next + 1,
                children: [...state.children, rhsSym.base],
                env: state.env,
              });
            }
            continue;
          }

          const childResults = parseNonterminal(rhsSym.base, rhsSym.features, state.next, cloneEnv(state.env), depth + 1);
          for (const child of childResults) {
            nextStates.push({
              next: child.next,
              children: [...state.children, child.tree],
              env: child.env,
            });
          }
        }
        if (nextStates.length === 0) {
          states = [];
          break;
        }
        states = nextStates.slice(0, maxTrees * 12);
      }

      for (const state of states) {
        const features = resolveFeatureMap(prod.lhs, state.env, constraints);
        const tree: ParseTree = {
          label: featureLabel(base, features),
          children: state.children,
        };
        const dkey = `${state.next}\u0001${JSON.stringify(tree)}`;
        if (!dedupe.has(dkey)) {
          dedupe.add(dkey);
          out.push({
            tree,
            next: state.next,
            features,
            env: state.env,
          });
        }
      }
    }

    recursionGuard.set(key, seen);
    return out.slice(0, maxTrees * 8);
  };

  const parsed = parseNonterminal(start.base, start.features, 0, new Map<string, string>(), 0)
    .filter((row) => row.next === tokens.length)
    .map((row) => row.tree);
  return parsed.slice(0, maxTrees);
}

export function parseTextWithFeatureCfg(
  text: string,
  grammar: FeatureCfgGrammar | string,
  options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean; maxDepth?: number },
): ParseTree[] {
  const fg = typeof grammar === "string" ? parseFeatureCfgGrammar(grammar, { startSymbol: options?.startSymbol }) : grammar;
  const tokens = wordTokenizeSubset(text).filter((tok) => /[A-Za-z0-9']/.test(tok));
  const normalized = options?.normalizeTokens === false ? tokens : tokens.map((tok) => tok.toLowerCase());
  return featureChartParse(normalized, fg, {
    maxTrees: options?.maxTrees,
    maxDepth: options?.maxDepth,
    startSymbol: options?.startSymbol,
  });
}
