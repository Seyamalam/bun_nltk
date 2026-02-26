const TOKEN_RE = /[A-Za-z0-9']+/g;

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
