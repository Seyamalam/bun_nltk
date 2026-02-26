const TOKEN_RE = /[A-Za-z0-9']+/g;
const FNV_OFFSET_BASIS = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const MASK_64 = 0xffffffffffffffffn;

export function tokenizeAscii(text: string): string[] {
  const matches = text.match(TOKEN_RE);
  if (!matches) return [];
  return matches.map((token) => token.toLowerCase());
}

export function countTokensAscii(text: string): number {
  return tokenizeAscii(text).length;
}

export function countUniqueTokensAscii(text: string): number {
  const set = new Set(tokenizeAscii(text));
  return set.size;
}

export function countNgramsAscii(text: string, n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n must be a positive integer");
  const tokens = tokenizeAscii(text);
  if (tokens.length < n) return 0;
  return tokens.length - n + 1;
}

export function countUniqueNgramsAscii(text: string, n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n must be a positive integer");
  const tokens = tokenizeAscii(text);
  if (tokens.length < n) return 0;

  const ngrams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i += 1) {
    ngrams.add(tokens.slice(i, i + n).join("\u0001"));
  }
  return ngrams.size;
}

export type AsciiMetrics = {
  tokens: number;
  uniqueTokens: number;
  ngrams: number;
  uniqueNgrams: number;
};

export function computeAsciiMetrics(text: string, n: number): AsciiMetrics {
  return {
    tokens: countTokensAscii(text),
    uniqueTokens: countUniqueTokensAscii(text),
    ngrams: countNgramsAscii(text, n),
    uniqueNgrams: countUniqueNgramsAscii(text, n),
  };
}

export function ngramsAscii(text: string, n: number): string[][] {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n must be a positive integer");
  const tokens = tokenizeAscii(text);
  if (tokens.length < n) return [];

  const out: string[][] = [];
  for (let i = 0; i <= tokens.length - n; i += 1) {
    out.push(tokens.slice(i, i + n));
  }
  return out;
}

export function everygramsAscii(text: string, minLen = 1, maxLen = Number.MAX_SAFE_INTEGER): string[][] {
  if (!Number.isInteger(minLen) || minLen <= 0) throw new Error("minLen must be a positive integer");
  if (!Number.isInteger(maxLen) || maxLen <= 0) throw new Error("maxLen must be a positive integer");
  const tokens = tokenizeAscii(text);
  if (tokens.length === 0) return [];

  const realMax = Math.min(maxLen, tokens.length);
  const out: string[][] = [];
  for (let start = 0; start < tokens.length; start += 1) {
    const upper = Math.min(realMax, tokens.length - start);
    if (upper < minLen) continue;
    for (let len = minLen; len <= upper; len += 1) {
      out.push(tokens.slice(start, start + len));
    }
  }
  return out;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];

  const rec = (start: number, need: number) => {
    if (need === 0) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i <= arr.length - need; i += 1) {
      cur.push(arr[i]!);
      rec(i + 1, need - 1);
      cur.pop();
    }
  };

  rec(0, k);
  return out;
}

export function skipgramsAscii(text: string, n: number, k: number): string[][] {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n must be a positive integer");
  if (!Number.isInteger(k) || k < 0) throw new Error("k must be an integer >= 0");
  const tokens = tokenizeAscii(text);
  if (tokens.length === 0) return [];

  if (n === 1) return tokens.map((t) => [t]);

  const out: string[][] = [];
  const tailSlots = n + k - 1;

  for (let i = 0; i < tokens.length; i += 1) {
    const slots = Array.from({ length: tailSlots }, (_, s) => s);
    for (const combo of combinations(slots, n - 1)) {
      const gram = [tokens[i]!];
      let valid = true;
      for (const slot of combo) {
        const idx = i + 1 + slot;
        if (idx >= tokens.length) {
          valid = false;
          break;
        }
        gram.push(tokens[idx]!);
      }
      if (valid) out.push(gram);
    }
  }

  return out;
}

export function hashTokenAscii(token: string): bigint {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= BigInt(token.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

export function hashNgram(tokenHashes: bigint[], n: number): bigint {
  let hash = FNV_OFFSET_BASIS;
  hash ^= BigInt(n);
  hash = (hash * FNV_PRIME) & MASK_64;

  for (const tokenHash of tokenHashes) {
    hash ^= tokenHash;
    hash = (hash * FNV_PRIME) & MASK_64;
  }

  return hash;
}

export function tokenFreqDistHashAscii(text: string): Map<bigint, number> {
  const tokens = tokenizeAscii(text);
  const out = new Map<bigint, number>();

  for (const token of tokens) {
    const key = hashTokenAscii(token);
    out.set(key, (out.get(key) ?? 0) + 1);
  }

  return out;
}

export function ngramFreqDistHashAscii(text: string, n: number): Map<bigint, number> {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n must be a positive integer");
  const tokens = tokenizeAscii(text);
  const tokenHashes = tokens.map(hashTokenAscii);
  const out = new Map<bigint, number>();

  for (let i = 0; i <= tokenHashes.length - n; i += 1) {
    const key = hashNgram(tokenHashes.slice(i, i + n), n);
    out.set(key, (out.get(key) ?? 0) + 1);
  }

  return out;
}

export type PmiBigram = {
  leftHash: bigint;
  rightHash: bigint;
  score: number;
};

export type TokenFreqDistIds = {
  tokens: string[];
  counts: number[];
  tokenToId: Map<string, number>;
  totalTokens: number;
};

export type BigramWindowStatId = {
  leftId: number;
  rightId: number;
  count: number;
  pmi: number;
};

export type BigramWindowStatToken = {
  left: string;
  right: string;
  leftId: number;
  rightId: number;
  count: number;
  pmi: number;
};

export function tokenFreqDistIdsAscii(text: string): TokenFreqDistIds {
  const tokens = tokenizeAscii(text);
  const vocab: string[] = [];
  const counts: number[] = [];
  const tokenToId = new Map<string, number>();

  for (const token of tokens) {
    const existing = tokenToId.get(token);
    if (existing !== undefined) {
      counts[existing]! += 1;
      continue;
    }

    const id = vocab.length;
    tokenToId.set(token, id);
    vocab.push(token);
    counts.push(1);
  }

  return {
    tokens: vocab,
    counts,
    tokenToId,
    totalTokens: tokens.length,
  };
}

export function bigramWindowStatsAsciiIds(text: string, windowSize = 2): BigramWindowStatId[] {
  if (!Number.isInteger(windowSize) || windowSize < 2) throw new Error("windowSize must be an integer >= 2");
  const tokenList = tokenizeAscii(text);
  if (tokenList.length < 2) return [];

  const vocab = tokenFreqDistIdsAscii(text);
  const idSeq = tokenList.map((token) => vocab.tokenToId.get(token)!);
  const countsMap = new Map<string, number>();

  for (let i = 0; i < idSeq.length; i += 1) {
    const end = Math.min(idSeq.length, i + windowSize);
    for (let j = i + 1; j < end; j += 1) {
      const leftId = idSeq[i]!;
      const rightId = idSeq[j]!;
      const key = `${leftId}:${rightId}`;
      countsMap.set(key, (countsMap.get(key) ?? 0) + 1);
    }
  }

  const rows: BigramWindowStatId[] = [];
  for (const [key, count] of countsMap.entries()) {
    const [leftRaw, rightRaw] = key.split(":");
    const leftId = Number(leftRaw);
    const rightId = Number(rightRaw);
    const leftCount = vocab.counts[leftId]!;
    const rightCount = vocab.counts[rightId]!;
    const pmi = Math.log2((count * vocab.totalTokens) / (leftCount * rightCount * (windowSize - 1)));
    rows.push({ leftId, rightId, count, pmi });
  }

  rows.sort((a, b) => {
    if (a.leftId !== b.leftId) return a.leftId - b.leftId;
    return a.rightId - b.rightId;
  });
  return rows;
}

export function bigramWindowStatsAscii(text: string, windowSize = 2): BigramWindowStatToken[] {
  const vocab = tokenFreqDistIdsAscii(text);
  const rows = bigramWindowStatsAsciiIds(text, windowSize);
  return rows.map((row) => ({
    left: vocab.tokens[row.leftId]!,
    right: vocab.tokens[row.rightId]!,
    leftId: row.leftId,
    rightId: row.rightId,
    count: row.count,
    pmi: row.pmi,
  }));
}

export function topPmiBigramsAscii(text: string, topK: number, windowSize = 2): PmiBigram[] {
  if (!Number.isInteger(topK) || topK <= 0) throw new Error("topK must be a positive integer");
  if (!Number.isInteger(windowSize) || windowSize < 2) throw new Error("windowSize must be an integer >= 2");
  const tokens = tokenizeAscii(text);
  if (tokens.length < 2) return [];

  const tokenTotal = tokens.length;
  const wordCounts = new Map<bigint, number>();
  const bigramCounts = new Map<bigint, number>();

  const tokenHashes = tokens.map(hashTokenAscii);
  for (let i = 0; i < tokenHashes.length; i += 1) {
    const tokenHash = tokenHashes[i]!;
    wordCounts.set(tokenHash, (wordCounts.get(tokenHash) ?? 0) + 1);
    const end = Math.min(tokenHashes.length, i + windowSize);
    for (let j = i + 1; j < end; j += 1) {
      const left = tokenHash;
      const right = tokenHashes[j]!;
      const key = (left << 64n) | right;
      bigramCounts.set(key, (bigramCounts.get(key) ?? 0) + 1);
    }
  }

  const out: PmiBigram[] = [];
  for (const [key, count] of bigramCounts.entries()) {
    const left = key >> 64n;
    const right = key & MASK_64;
    const leftCount = wordCounts.get(left);
    const rightCount = wordCounts.get(right);
    if (!leftCount || !rightCount) continue;

    const score = Math.log2((count * tokenTotal) / (leftCount * rightCount * (windowSize - 1)));
    out.push({ leftHash: left, rightHash: right, score });
  }

  out.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.leftHash !== b.leftHash) return a.leftHash < b.leftHash ? -1 : 1;
    if (a.rightHash !== b.rightHash) return a.rightHash < b.rightHash ? -1 : 1;
    return 0;
  });

  return out.slice(0, topK);
}
