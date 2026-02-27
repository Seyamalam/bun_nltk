import { wordTokenizeSubset } from "./tokenizers";

export type CfgProduction = {
  lhs: string;
  rhs: string[];
};

export type CfgGrammar = {
  startSymbol: string;
  productions: CfgProduction[];
};

export type ParseTree = {
  label: string;
  children: Array<ParseTree | string>;
};

type ParsedRule = {
  lhs: string;
  alternatives: string[][];
};

type CnfGrammar = {
  startSymbol: string;
  lexicalByToken: Map<string, string[]>;
  unaryByChild: Map<string, string[]>;
  binaryByChildren: Map<string, string[]>;
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

function parseRuleLine(line: string): ParsedRule | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*->\s*(.+)$/);
  if (!match) return null;
  const lhs = match[1]!;
  const rhs = match[2]!;
  const alternatives = splitAlternatives(rhs).map(tokenizeRuleRhs).filter((row) => row.length > 0);
  if (alternatives.length === 0) return null;
  return { lhs, alternatives };
}

export function parseCfgGrammar(grammarText: string, options?: { startSymbol?: string }): CfgGrammar {
  const productions: CfgProduction[] = [];
  let firstLhs: string | null = null;

  for (const line of grammarText.split(/\r?\n/g)) {
    const parsed = parseRuleLine(line);
    if (!parsed) continue;
    if (!firstLhs) firstLhs = parsed.lhs;
    for (const alt of parsed.alternatives) {
      productions.push({
        lhs: parsed.lhs,
        rhs: alt.map((tok) => (isQuotedTerminal(tok) ? unquoteTerminal(tok) : tok)),
      });
    }
  }

  if (productions.length === 0) {
    throw new Error("CFG grammar contains no productions");
  }

  const startSymbol = options?.startSymbol ?? firstLhs!;
  return { startSymbol, productions };
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
  if (!list.some((tree) => JSON.stringify(tree) === encoded)) {
    list.push(value);
  }
}

function buildCnf(grammar: CfgGrammar): CnfGrammar {
  const nonterminals = new Set(grammar.productions.map((p) => p.lhs));
  const lexicalByToken = new Map<string, string[]>();
  const unaryByChild = new Map<string, string[]>();
  const binaryByChildren = new Map<string, string[]>();
  const terminalToSymbol = new Map<string, string>();
  let helperIndex = 0;

  const registerLexical = (lhs: string, terminal: string) => {
    dedupePush(lexicalByToken, terminal, lhs);
  };

  const registerUnary = (lhs: string, child: string) => {
    dedupePush(unaryByChild, child, lhs);
  };

  const registerBinary = (lhs: string, left: string, right: string) => {
    dedupePush(binaryByChildren, `${left} ${right}`, lhs);
  };

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

  return {
    startSymbol: grammar.startSymbol,
    lexicalByToken,
    unaryByChild,
    binaryByChildren,
  };
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
        dedupePushTree(
          cell,
          parent,
          {
            label: parent,
            children: [tree],
          },
          maxTrees,
        );
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
                  dedupePushTree(
                    cell,
                    parent,
                    {
                      label: parent,
                      children: [lt, rt],
                    },
                    maxTrees,
                  );
                }
              }
            }
          }
        }
      }
      if (cell.size > 0) applyUnaryClosure(cell, cnf.unaryByChild, maxTrees);
    }
  }

  const out = (chart[0]![n]!.get(start) ?? []).slice(0, maxTrees);
  return out.sort((a, b) => treeChildCount(a) - treeChildCount(b));
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
