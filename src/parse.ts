import { cykRecognizeIdsNative } from "./native";
import { wordTokenizeSubset } from "./tokenizers";

export type CfgProduction = {
  lhs: string;
  rhs: string[];
};

export type CfgGrammar = {
  startSymbol: string;
  productions: CfgProduction[];
};

export type PcfgProduction = {
  lhs: string;
  rhs: string[];
  prob: number;
};

export type PcfgGrammar = {
  startSymbol: string;
  productions: PcfgProduction[];
};

export type ParseTree = {
  label: string;
  children: Array<ParseTree | string>;
};

export type ProbabilisticParse = {
  tree: ParseTree;
  logProb: number;
  prob: number;
};

type CnfGrammar = {
  lexicalByToken: Map<string, string[]>;
  unaryByChild: Map<string, string[]>;
  binaryByChildren: Map<string, string[]>;
};

type WeightedRule = {
  lhs: string;
  logProb: number;
};

type CnfPcfgGrammar = {
  lexicalByToken: Map<string, WeightedRule[]>;
  unaryByChild: Map<string, WeightedRule[]>;
  binaryByChildren: Map<string, WeightedRule[]>;
};

type CykPlan = {
  startSymbolId: number;
  symbolToId: Map<string, number>;
  lexicalByTokenBits: Map<string, bigint>;
  unaryChild: Uint16Array;
  unaryParent: Uint16Array;
  binaryLeft: Uint16Array;
  binaryRight: Uint16Array;
  binaryParent: Uint16Array;
};

type ParsedAlternative = {
  rhs: string[];
  prob?: number;
};

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

function unquoteTerminal(token: string): string {
  if (token.length >= 2 && ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith("\"") && token.endsWith("\"")))) {
    return token.slice(1, -1);
  }
  return token;
}

function isQuotedTerminal(token: string): boolean {
  return (token.startsWith("'") && token.endsWith("'")) || (token.startsWith("\"") && token.endsWith("\""));
}

function parseAltWithOptionalProbability(raw: string): ParsedAlternative | null {
  const tokens = tokenizeRuleRhs(raw);
  if (tokens.length === 0) return null;
  let prob: number | undefined;
  let rhsTokens = tokens;
  const last = tokens[tokens.length - 1]!;
  const probMatch = last.match(/^\[([0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\]$/);
  if (probMatch) {
    rhsTokens = tokens.slice(0, -1);
    prob = Number(probMatch[1]);
    if (!Number.isFinite(prob) || prob < 0) prob = undefined;
  }
  if (rhsTokens.length === 0) return null;
  return {
    rhs: rhsTokens.map((tok) => (isQuotedTerminal(tok) ? unquoteTerminal(tok) : tok)),
    prob,
  };
}

function normalizeProbabilities(rows: ParsedAlternative[]): PcfgProduction[] {
  const provided = rows.filter((r) => r.prob !== undefined) as Array<Required<Pick<ParsedAlternative, "prob">> & ParsedAlternative>;
  const missing = rows.filter((r) => r.prob === undefined);
  const providedSum = provided.reduce((acc, row) => acc + row.prob, 0);

  if (rows.length === 0) return [];
  if (provided.length === 0) {
    const p = 1 / rows.length;
    return rows.map((row) => ({ lhs: "", rhs: row.rhs, prob: p }));
  }

  const filled: number[] = [];
  if (missing.length > 0 && providedSum < 1) {
    const p = (1 - providedSum) / missing.length;
    for (const row of rows) filled.push(row.prob ?? p);
  } else {
    for (const row of rows) filled.push(row.prob ?? 0);
  }

  const total = filled.reduce((acc, v) => acc + v, 0);
  if (!Number.isFinite(total) || total <= 0) {
    const p = 1 / rows.length;
    return rows.map((row) => ({ lhs: "", rhs: row.rhs, prob: p }));
  }
  return rows.map((row, idx) => ({ lhs: "", rhs: row.rhs, prob: Math.max(1e-12, filled[idx]! / total) }));
}

function dedupePush(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (!list) {
    map.set(key, [value]);
    return;
  }
  if (!list.includes(value)) list.push(value);
}

function dedupePushTree(map: Map<string, ParseTree[]>, key: string, value: ParseTree, maxTrees: number): void {
  const list = map.get(key);
  const encoded = JSON.stringify(value);
  if (!list) {
    map.set(key, [value]);
    return;
  }
  if (list.length >= maxTrees) return;
  if (!list.some((tree) => JSON.stringify(tree) === encoded)) list.push(value);
}

function parseCfgLine(line: string): { lhs: string; alternatives: string[][] } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*->\s*(.+)$/);
  if (!match) return null;
  const lhs = match[1]!;
  const rhs = match[2]!;
  const alternatives = splitAlternatives(rhs)
    .map(tokenizeRuleRhs)
    .filter((row) => row.length > 0)
    .map((row) => row.map((tok) => (isQuotedTerminal(tok) ? unquoteTerminal(tok) : tok)));
  if (alternatives.length === 0) return null;
  return { lhs, alternatives };
}

export function parseCfgGrammar(grammarText: string, options?: { startSymbol?: string }): CfgGrammar {
  const productions: CfgProduction[] = [];
  let firstLhs: string | null = null;
  for (const line of grammarText.split(/\r?\n/g)) {
    const parsed = parseCfgLine(line);
    if (!parsed) continue;
    if (!firstLhs) firstLhs = parsed.lhs;
    for (const rhs of parsed.alternatives) productions.push({ lhs: parsed.lhs, rhs });
  }
  if (productions.length === 0) throw new Error("CFG grammar contains no productions");
  return {
    startSymbol: options?.startSymbol ?? firstLhs!,
    productions,
  };
}

export function parsePcfgGrammar(grammarText: string, options?: { startSymbol?: string }): PcfgGrammar {
  const grouped = new Map<string, ParsedAlternative[]>();
  let firstLhs: string | null = null;

  for (const line of grammarText.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*->\s*(.+)$/);
    if (!match) continue;
    const lhs = match[1]!;
    const rhsRaw = match[2]!;
    if (!firstLhs) firstLhs = lhs;
    const existing = grouped.get(lhs) ?? [];
    for (const alt of splitAlternatives(rhsRaw)) {
      const parsed = parseAltWithOptionalProbability(alt);
      if (parsed) existing.push(parsed);
    }
    grouped.set(lhs, existing);
  }

  const productions: PcfgProduction[] = [];
  for (const [lhs, rows] of grouped) {
    const normalized = normalizeProbabilities(rows);
    for (const row of normalized) {
      productions.push({
        lhs,
        rhs: row.rhs,
        prob: row.prob,
      });
    }
  }
  if (productions.length === 0) throw new Error("PCFG grammar contains no productions");

  return {
    startSymbol: options?.startSymbol ?? firstLhs!,
    productions,
  };
}

function buildCnf(grammar: CfgGrammar): CnfGrammar {
  const nonterminals = new Set(grammar.productions.map((p) => p.lhs));
  const lexicalByToken = new Map<string, string[]>();
  const unaryByChild = new Map<string, string[]>();
  const binaryByChildren = new Map<string, string[]>();
  const terminalToSymbol = new Map<string, string>();
  let helperIndex = 0;

  const registerLexical = (lhs: string, terminal: string) => dedupePush(lexicalByToken, terminal, lhs);
  const registerUnary = (lhs: string, child: string) => dedupePush(unaryByChild, child, lhs);
  const registerBinary = (lhs: string, left: string, right: string) => dedupePush(binaryByChildren, `${left} ${right}`, lhs);

  const terminalSymbol = (terminal: string): string => {
    const cached = terminalToSymbol.get(terminal);
    if (cached) return cached;
    const sym = `__TERM_${helperIndex++}`;
    terminalToSymbol.set(terminal, sym);
    registerLexical(sym, terminal);
    return sym;
  };

  for (const prod of grammar.productions) {
    if (prod.rhs.length === 0) continue;
    if (prod.rhs.length === 1) {
      const only = prod.rhs[0]!;
      if (nonterminals.has(only)) registerUnary(prod.lhs, only);
      else registerLexical(prod.lhs, only);
      continue;
    }
    const rhsSymbols = prod.rhs.map((item) => (nonterminals.has(item) ? item : terminalSymbol(item)));
    if (rhsSymbols.length === 2) {
      registerBinary(prod.lhs, rhsSymbols[0]!, rhsSymbols[1]!);
      continue;
    }
    let currentLhs = prod.lhs;
    for (let i = 0; i < rhsSymbols.length - 2; i += 1) {
      const left = rhsSymbols[i]!;
      const helper = `__BIN_${helperIndex++}`;
      registerBinary(currentLhs, left, helper);
      currentLhs = helper;
    }
    registerBinary(currentLhs, rhsSymbols[rhsSymbols.length - 2]!, rhsSymbols[rhsSymbols.length - 1]!);
  }
  return { lexicalByToken, unaryByChild, binaryByChildren };
}

function setMax(map: Map<string, number>, key: string, value: number): void {
  const prev = map.get(key);
  if (prev === undefined || value > prev) map.set(key, value);
}

function buildCnfPcfg(grammar: PcfgGrammar): CnfPcfgGrammar {
  const nonterminals = new Set(grammar.productions.map((p) => p.lhs));
  const lexical = new Map<string, Map<string, number>>();
  const unary = new Map<string, Map<string, number>>();
  const binary = new Map<string, Map<string, number>>();
  const terminalToSymbol = new Map<string, string>();
  let helperIndex = 0;

  const registerLexical = (lhs: string, terminal: string, logProb: number) => {
    const map = lexical.get(terminal) ?? new Map<string, number>();
    setMax(map, lhs, logProb);
    lexical.set(terminal, map);
  };
  const registerUnary = (lhs: string, child: string, logProb: number) => {
    const map = unary.get(child) ?? new Map<string, number>();
    setMax(map, lhs, logProb);
    unary.set(child, map);
  };
  const registerBinary = (lhs: string, left: string, right: string, logProb: number) => {
    const key = `${left} ${right}`;
    const map = binary.get(key) ?? new Map<string, number>();
    setMax(map, lhs, logProb);
    binary.set(key, map);
  };

  const terminalSymbol = (terminal: string): string => {
    const cached = terminalToSymbol.get(terminal);
    if (cached) return cached;
    const sym = `__PTERM_${helperIndex++}`;
    terminalToSymbol.set(terminal, sym);
    registerLexical(sym, terminal, 0);
    return sym;
  };

  for (const prod of grammar.productions) {
    if (prod.rhs.length === 0) continue;
    const logProb = Math.log(Math.max(1e-12, prod.prob));

    if (prod.rhs.length === 1) {
      const only = prod.rhs[0]!;
      if (nonterminals.has(only)) registerUnary(prod.lhs, only, logProb);
      else registerLexical(prod.lhs, only, logProb);
      continue;
    }

    const rhsSymbols = prod.rhs.map((item) => (nonterminals.has(item) ? item : terminalSymbol(item)));
    if (rhsSymbols.length === 2) {
      registerBinary(prod.lhs, rhsSymbols[0]!, rhsSymbols[1]!, logProb);
      continue;
    }

    let currentLhs = prod.lhs;
    for (let i = 0; i < rhsSymbols.length - 2; i += 1) {
      const left = rhsSymbols[i]!;
      const helper = `__PBIN_${helperIndex++}`;
      registerBinary(currentLhs, left, helper, i === 0 ? logProb : 0);
      currentLhs = helper;
    }
    registerBinary(currentLhs, rhsSymbols[rhsSymbols.length - 2]!, rhsSymbols[rhsSymbols.length - 1]!, 0);
  }

  const lexicalByToken = new Map<string, WeightedRule[]>();
  const unaryByChild = new Map<string, WeightedRule[]>();
  const binaryByChildren = new Map<string, WeightedRule[]>();
  for (const [token, m] of lexical) {
    lexicalByToken.set(
      token,
      [...m.entries()].map(([lhs, lp]) => ({ lhs, logProb: lp })),
    );
  }
  for (const [child, m] of unary) {
    unaryByChild.set(
      child,
      [...m.entries()].map(([lhs, lp]) => ({ lhs, logProb: lp })),
    );
  }
  for (const [key, m] of binary) {
    binaryByChildren.set(
      key,
      [...m.entries()].map(([lhs, lp]) => ({ lhs, logProb: lp })),
    );
  }
  return { lexicalByToken, unaryByChild, binaryByChildren };
}

function collectSymbols(cnf: CnfGrammar | CnfPcfgGrammar, startSymbol: string): string[] {
  const set = new Set<string>([startSymbol]);
  for (const values of cnf.lexicalByToken.values()) {
    for (const row of values) {
      if (typeof row === "string") set.add(row);
      else set.add(row.lhs);
    }
  }
  for (const [child, parents] of cnf.unaryByChild) {
    set.add(child);
    for (const row of parents) {
      if (typeof row === "string") set.add(row);
      else set.add(row.lhs);
    }
  }
  for (const [pair, parents] of cnf.binaryByChildren) {
    const [left, right] = pair.split(" ");
    if (left) set.add(left);
    if (right) set.add(right);
    for (const row of parents) {
      if (typeof row === "string") set.add(row);
      else set.add(row.lhs);
    }
  }
  return [...set];
}

function buildCykPlan(cnf: CfgGrammar | CnfGrammar | CnfPcfgGrammar, startSymbol: string): CykPlan | null {
  const cnfCore = "productions" in cnf ? buildCnf(cnf as CfgGrammar) : cnf;
  const symbols = collectSymbols(cnfCore, startSymbol);
  if (symbols.length === 0 || symbols.length > 63) return null;
  const symbolToId = new Map<string, number>();
  for (const sym of symbols) symbolToId.set(sym, symbolToId.size);
  const startSymbolId = symbolToId.get(startSymbol);
  if (startSymbolId === undefined) return null;

  const lexicalByTokenBits = new Map<string, bigint>();
  for (const [token, rows] of cnfCore.lexicalByToken) {
    let bits = 0n;
    for (const row of rows) {
      const lhs = typeof row === "string" ? row : row.lhs;
      const id = symbolToId.get(lhs);
      if (id !== undefined) bits |= 1n << BigInt(id);
    }
    lexicalByTokenBits.set(token, bits);
  }

  const unaryChild: number[] = [];
  const unaryParent: number[] = [];
  for (const [child, rows] of cnfCore.unaryByChild) {
    const childId = symbolToId.get(child);
    if (childId === undefined) continue;
    for (const row of rows) {
      const lhs = typeof row === "string" ? row : row.lhs;
      const parentId = symbolToId.get(lhs);
      if (parentId === undefined) continue;
      unaryChild.push(childId);
      unaryParent.push(parentId);
    }
  }

  const binaryLeft: number[] = [];
  const binaryRight: number[] = [];
  const binaryParent: number[] = [];
  for (const [pair, rows] of cnfCore.binaryByChildren) {
    const [left, right] = pair.split(" ");
    const leftId = symbolToId.get(left);
    const rightId = symbolToId.get(right);
    if (leftId === undefined || rightId === undefined) continue;
    for (const row of rows) {
      const lhs = typeof row === "string" ? row : row.lhs;
      const parentId = symbolToId.get(lhs);
      if (parentId === undefined) continue;
      binaryLeft.push(leftId);
      binaryRight.push(rightId);
      binaryParent.push(parentId);
    }
  }

  return {
    startSymbolId,
    symbolToId,
    lexicalByTokenBits,
    unaryChild: Uint16Array.from(unaryChild),
    unaryParent: Uint16Array.from(unaryParent),
    binaryLeft: Uint16Array.from(binaryLeft),
    binaryRight: Uint16Array.from(binaryRight),
    binaryParent: Uint16Array.from(binaryParent),
  };
}

function maybeNativeRecognize(tokens: string[], plan: CykPlan | null): boolean {
  if (tokens.length === 0) return false;
  if (!plan) return true;
  const tokenBits = new BigUint64Array(tokens.length);
  for (let i = 0; i < tokens.length; i += 1) {
    const bits = plan.lexicalByTokenBits.get(tokens[i]!) ?? 0n;
    if (bits === 0n) return false;
    tokenBits[i] = bits;
  }
  try {
    return cykRecognizeIdsNative({
      tokenBits,
      binaryLeft: plan.binaryLeft,
      binaryRight: plan.binaryRight,
      binaryParent: plan.binaryParent,
      unaryChild: plan.unaryChild,
      unaryParent: plan.unaryParent,
      startSymbol: plan.startSymbolId,
    });
  } catch {
    return true;
  }
}

function applyUnaryClosure(cell: Map<string, ParseTree[]>, unaryByChild: Map<string, string[]>, maxTrees: number): void {
  const queue = [...cell.keys()];
  let idx = 0;
  while (idx < queue.length) {
    const child = queue[idx++]!;
    const parents = unaryByChild.get(child) ?? [];
    const childTrees = cell.get(child) ?? [];
    for (const parent of parents) {
      const before = cell.get(parent)?.length ?? 0;
      for (const tree of childTrees) {
        dedupePushTree(cell, parent, { label: parent, children: [tree] }, maxTrees);
      }
      const after = cell.get(parent)?.length ?? 0;
      if (after > before) queue.push(parent);
    }
  }
}

function treeChildCount(tree: ParseTree): number {
  if (tree.children.length === 0) return 1;
  let count = 1;
  for (const child of tree.children) {
    if (typeof child === "string") count += 1;
    else count += treeChildCount(child);
  }
  return count;
}

export function chartParse(tokens: string[], grammar: CfgGrammar, options?: { maxTrees?: number; startSymbol?: string }): ParseTree[] {
  const maxTrees = Math.max(1, options?.maxTrees ?? 8);
  const cnf = buildCnf(grammar);
  const start = options?.startSymbol ?? grammar.startSymbol;
  if (!maybeNativeRecognize(tokens, buildCykPlan(cnf, start))) return [];

  const n = tokens.length;
  const chart: Array<Array<Map<string, ParseTree[]>>> = [];
  for (let i = 0; i <= n; i += 1) {
    const row: Array<Map<string, ParseTree[]>> = [];
    for (let j = 0; j <= n; j += 1) row.push(new Map<string, ParseTree[]>());
    chart.push(row);
  }

  for (let i = 0; i < n; i += 1) {
    const token = tokens[i]!;
    const cell = chart[i]![i + 1]!;
    for (const lhs of cnf.lexicalByToken.get(token) ?? []) {
      dedupePushTree(cell, lhs, { label: lhs, children: [token] }, maxTrees);
    }
    applyUnaryClosure(cell, cnf.unaryByChild, maxTrees);
  }

  for (let span = 2; span <= n; span += 1) {
    for (let i = 0; i + span <= n; i += 1) {
      const j = i + span;
      const cell = chart[i]![j]!;
      for (let k = i + 1; k < j; k += 1) {
        const left = chart[i]![k]!;
        const right = chart[k]![j]!;
        if (left.size === 0 || right.size === 0) continue;

        for (const [leftSym, leftTrees] of left) {
          for (const [rightSym, rightTrees] of right) {
            const parents = cnf.binaryByChildren.get(`${leftSym} ${rightSym}`) ?? [];
            if (parents.length === 0) continue;
            for (const parent of parents) {
              for (const lt of leftTrees) {
                for (const rt of rightTrees) {
                  dedupePushTree(cell, parent, { label: parent, children: [lt, rt] }, maxTrees);
                }
              }
            }
          }
        }
      }
      if (cell.size > 0) applyUnaryClosure(cell, cnf.unaryByChild, maxTrees);
    }
  }

  return (chart[0]![n]!.get(start) ?? []).slice(0, maxTrees).sort((a, b) => treeChildCount(a) - treeChildCount(b));
}

type RecursiveParseResult = {
  tree: ParseTree;
  next: number;
};

export function recursiveDescentParse(
  tokens: string[],
  grammar: CfgGrammar,
  options?: { maxTrees?: number; startSymbol?: string; maxDepth?: number },
): ParseTree[] {
  const maxTrees = Math.max(1, options?.maxTrees ?? 8);
  const maxDepth = Math.max(1, options?.maxDepth ?? Math.max(32, tokens.length * 4));
  const start = options?.startSymbol ?? grammar.startSymbol;

  const rulesByLhs = new Map<string, string[][]>();
  const nonterminals = new Set<string>();
  for (const prod of grammar.productions) {
    nonterminals.add(prod.lhs);
    const rows = rulesByLhs.get(prod.lhs) ?? [];
    rows.push(prod.rhs);
    rulesByLhs.set(prod.lhs, rows);
  }

  const memo = new Map<string, RecursiveParseResult[]>();
  const inProgress = new Set<string>();
  const keyOf = (lhs: string, index: number): string => `${lhs}@${index}`;

  const parseSymbol = (lhs: string, index: number, depth: number): RecursiveParseResult[] => {
    if (depth > maxDepth) return [];
    const key = keyOf(lhs, index);
    const cached = memo.get(key);
    if (cached) return cached;
    if (inProgress.has(key)) return [];
    inProgress.add(key);

    const out: RecursiveParseResult[] = [];
    const dedupe = new Set<string>();
    const alternatives = rulesByLhs.get(lhs) ?? [];
    for (const rhs of alternatives) {
      if (rhs.length === 0) {
        const tree: ParseTree = { label: lhs, children: [] };
        const dkey = `${index}\u0001${JSON.stringify(tree)}`;
        if (!dedupe.has(dkey)) {
          dedupe.add(dkey);
          out.push({ tree, next: index });
        }
        continue;
      }

      let partials: Array<{ children: Array<ParseTree | string>; next: number }> = [{ children: [], next: index }];
      for (const symbol of rhs) {
        const nextPartials: Array<{ children: Array<ParseTree | string>; next: number }> = [];
        for (const partial of partials) {
          if (nonterminals.has(symbol)) {
            const childParses = parseSymbol(symbol, partial.next, depth + 1);
            for (const child of childParses) {
              nextPartials.push({
                children: [...partial.children, child.tree],
                next: child.next,
              });
            }
          } else if (partial.next < tokens.length && tokens[partial.next] === symbol) {
            nextPartials.push({
              children: [...partial.children, symbol],
              next: partial.next + 1,
            });
          }
        }
        if (nextPartials.length === 0) {
          partials = [];
          break;
        }
        partials = nextPartials.slice(0, maxTrees * 8);
      }

      for (const partial of partials) {
        const tree: ParseTree = {
          label: lhs,
          children: partial.children,
        };
        const dkey = `${partial.next}\u0001${JSON.stringify(tree)}`;
        if (!dedupe.has(dkey)) {
          dedupe.add(dkey);
          out.push({ tree, next: partial.next });
        }
      }
    }

    inProgress.delete(key);
    memo.set(key, out);
    return out;
  };

  const parsed = parseSymbol(start, 0, 0)
    .filter((row) => row.next === tokens.length)
    .map((row) => row.tree);
  return parsed.slice(0, maxTrees).sort((a, b) => treeChildCount(a) - treeChildCount(b));
}

type EarleyState = {
  lhs: string;
  rhs: string[];
  dot: number;
  start: number;
  end: number;
};

function earleyStateKey(state: EarleyState): string {
  return `${state.lhs}->${state.rhs.join(" ")}@${state.dot}:${state.start}:${state.end}`;
}

function earleyAddState(target: Map<string, EarleyState>, queue: EarleyState[], state: EarleyState): void {
  const key = earleyStateKey(state);
  if (!target.has(key)) {
    target.set(key, state);
    queue.push(state);
  }
}

export function earleyRecognize(tokens: string[], grammar: CfgGrammar, options?: { startSymbol?: string }): boolean {
  const start = options?.startSymbol ?? grammar.startSymbol;
  const n = tokens.length;
  const chart: Array<Map<string, EarleyState>> = [];
  for (let i = 0; i <= n; i += 1) chart.push(new Map());

  const rulesByLhs = new Map<string, string[][]>();
  const nonterminals = new Set<string>();
  for (const prod of grammar.productions) {
    nonterminals.add(prod.lhs);
    const rows = rulesByLhs.get(prod.lhs) ?? [];
    rows.push(prod.rhs);
    rulesByLhs.set(prod.lhs, rows);
  }

  const seed: EarleyState = {
    lhs: "__GAMMA__",
    rhs: [start],
    dot: 0,
    start: 0,
    end: 0,
  };
  chart[0]!.set(earleyStateKey(seed), seed);

  for (let i = 0; i <= n; i += 1) {
    const cell = chart[i]!;
    const queue = [...cell.values()];
    let head = 0;
    while (head < queue.length) {
      const state = queue[head++]!;
      if (state.dot < state.rhs.length) {
        const next = state.rhs[state.dot]!;
        if (nonterminals.has(next)) {
          for (const rhs of rulesByLhs.get(next) ?? []) {
            earleyAddState(cell, queue, {
              lhs: next,
              rhs,
              dot: 0,
              start: i,
              end: i,
            });
          }
        } else if (i < n && tokens[i] === next) {
          const advanced: EarleyState = {
            lhs: state.lhs,
            rhs: state.rhs,
            dot: state.dot + 1,
            start: state.start,
            end: i + 1,
          };
          const nextCell = chart[i + 1]!;
          const key = earleyStateKey(advanced);
          if (!nextCell.has(key)) nextCell.set(key, advanced);
        }
      } else {
        const origin = chart[state.start]!;
        for (const prev of origin.values()) {
          if (prev.dot >= prev.rhs.length) continue;
          if (prev.rhs[prev.dot] !== state.lhs) continue;
          earleyAddState(cell, queue, {
            lhs: prev.lhs,
            rhs: prev.rhs,
            dot: prev.dot + 1,
            start: prev.start,
            end: i,
          });
        }
      }
    }
  }

  const acceptKey = earleyStateKey({
    lhs: "__GAMMA__",
    rhs: [start],
    dot: 1,
    start: 0,
    end: n,
  });
  return chart[n]!.has(acceptKey);
}

export function earleyParse(tokens: string[], grammar: CfgGrammar, options?: { maxTrees?: number; startSymbol?: string }): ParseTree[] {
  if (!earleyRecognize(tokens, grammar, options)) return [];
  return chartParse(tokens, grammar, options);
}

type WeightedCellEntry = {
  logProb: number;
  tree: ParseTree;
};

function setBest(cell: Map<string, WeightedCellEntry>, key: string, candidate: WeightedCellEntry): boolean {
  const prev = cell.get(key);
  if (!prev || candidate.logProb > prev.logProb + 1e-12) {
    cell.set(key, candidate);
    return true;
  }
  return false;
}

function applyUnaryClosureWeighted(cell: Map<string, WeightedCellEntry>, unaryByChild: Map<string, WeightedRule[]>): void {
  const queue = [...cell.keys()];
  let idx = 0;
  while (idx < queue.length) {
    const child = queue[idx++]!;
    const childEntry = cell.get(child);
    if (!childEntry) continue;
    for (const rule of unaryByChild.get(child) ?? []) {
      const changed = setBest(cell, rule.lhs, {
        logProb: childEntry.logProb + rule.logProb,
        tree: { label: rule.lhs, children: [childEntry.tree] },
      });
      if (changed) queue.push(rule.lhs);
    }
  }
}

export function probabilisticChartParse(
  tokens: string[],
  grammar: PcfgGrammar,
  options?: { startSymbol?: string },
): ProbabilisticParse | null {
  const cnf = buildCnfPcfg(grammar);
  const start = options?.startSymbol ?? grammar.startSymbol;
  if (!maybeNativeRecognize(tokens, buildCykPlan(cnf, start))) return null;
  const n = tokens.length;
  if (n === 0) return null;

  const chart: Array<Array<Map<string, WeightedCellEntry>>> = [];
  for (let i = 0; i <= n; i += 1) {
    const row: Array<Map<string, WeightedCellEntry>> = [];
    for (let j = 0; j <= n; j += 1) row.push(new Map<string, WeightedCellEntry>());
    chart.push(row);
  }

  for (let i = 0; i < n; i += 1) {
    const token = tokens[i]!;
    const cell = chart[i]![i + 1]!;
    for (const rule of cnf.lexicalByToken.get(token) ?? []) {
      setBest(cell, rule.lhs, {
        logProb: rule.logProb,
        tree: { label: rule.lhs, children: [token] },
      });
    }
    applyUnaryClosureWeighted(cell, cnf.unaryByChild);
  }

  for (let span = 2; span <= n; span += 1) {
    for (let i = 0; i + span <= n; i += 1) {
      const j = i + span;
      const cell = chart[i]![j]!;
      for (let k = i + 1; k < j; k += 1) {
        const left = chart[i]![k]!;
        const right = chart[k]![j]!;
        if (left.size === 0 || right.size === 0) continue;
        for (const [leftSym, leftEntry] of left) {
          for (const [rightSym, rightEntry] of right) {
            for (const rule of cnf.binaryByChildren.get(`${leftSym} ${rightSym}`) ?? []) {
              setBest(cell, rule.lhs, {
                logProb: leftEntry.logProb + rightEntry.logProb + rule.logProb,
                tree: {
                  label: rule.lhs,
                  children: [leftEntry.tree, rightEntry.tree],
                },
              });
            }
          }
        }
      }
      if (cell.size > 0) applyUnaryClosureWeighted(cell, cnf.unaryByChild);
    }
  }

  const best = chart[0]![n]!.get(start);
  if (!best) return null;
  return {
    tree: best.tree,
    logProb: best.logProb,
    prob: Math.exp(best.logProb),
  };
}

export function parseTextWithCfg(
  text: string,
  grammar: CfgGrammar | string,
  options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean },
): ParseTree[] {
  const cfg = typeof grammar === "string" ? parseCfgGrammar(grammar, { startSymbol: options?.startSymbol }) : grammar;
  const tokens = wordTokenizeSubset(text).filter((tok) => /[A-Za-z0-9']/.test(tok));
  const normalized = options?.normalizeTokens === false ? tokens : tokens.map((tok) => tok.toLowerCase());
  return chartParse(normalized, cfg, options);
}

export function parseTextWithEarley(
  text: string,
  grammar: CfgGrammar | string,
  options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean },
): ParseTree[] {
  const cfg = typeof grammar === "string" ? parseCfgGrammar(grammar, { startSymbol: options?.startSymbol }) : grammar;
  const tokens = wordTokenizeSubset(text).filter((tok) => /[A-Za-z0-9']/.test(tok));
  const normalized = options?.normalizeTokens === false ? tokens : tokens.map((tok) => tok.toLowerCase());
  return earleyParse(normalized, cfg, options);
}

export function parseTextWithPcfg(
  text: string,
  grammar: PcfgGrammar | string,
  options?: { startSymbol?: string; normalizeTokens?: boolean },
): ProbabilisticParse | null {
  const pcfg = typeof grammar === "string" ? parsePcfgGrammar(grammar, { startSymbol: options?.startSymbol }) : grammar;
  const tokens = wordTokenizeSubset(text).filter((tok) => /[A-Za-z0-9']/.test(tok));
  const normalized = options?.normalizeTokens === false ? tokens : tokens.map((tok) => tok.toLowerCase());
  return probabilisticChartParse(normalized, pcfg, options);
}

export function parseTextWithRecursiveDescent(
  text: string,
  grammar: CfgGrammar | string,
  options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean; maxDepth?: number },
): ParseTree[] {
  const cfg = typeof grammar === "string" ? parseCfgGrammar(grammar, { startSymbol: options?.startSymbol }) : grammar;
  const tokens = wordTokenizeSubset(text).filter((tok) => /[A-Za-z0-9']/.test(tok));
  const normalized = options?.normalizeTokens === false ? tokens : tokens.map((tok) => tok.toLowerCase());
  return recursiveDescentParse(normalized, cfg, options);
}
