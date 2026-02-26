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
