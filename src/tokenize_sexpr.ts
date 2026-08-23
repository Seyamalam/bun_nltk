/**
 * S-Expression tokenizer (port of nltk.tokenize.sexpr / SExprTokenizer).
 *
 * Splits a string into parenthesized s-expressions (including nesting)
 * and whitespace-separated tokens, matching NLTK's strict/non-strict modes.
 */

export class SExprTokenizer {
  private readonly open: string;
  private readonly close: string;
  private readonly strict: boolean;
  private readonly parenRe: RegExp;

  constructor(parens = "()", strict = true) {
    if (parens.length !== 2) throw new Error("parens must contain exactly two strings");
    this.open = parens[0]!;
    this.close = parens[1]!;
    this.strict = strict;
    const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    this.parenRe = new RegExp(`${esc(this.open)}|${esc(this.close)}`, "g");
  }

  tokenize(text: string): string[] {
    const result: string[] = [];
    let pos = 0;
    let depth = 0;
    let m: RegExpExecArray | null;
    this.parenRe.lastIndex = 0;
    while ((m = this.parenRe.exec(text)) !== null) {
      // Guard against zero-length matches (shouldn't happen after fix, but safety)
      if (m[0].length === 0) {
        this.parenRe.lastIndex++;
        continue;
      }
      const paren = m[0]!;
      const idx = m.index;
      if (depth === 0) {
        const chunk = text.slice(pos, idx).trim();
        if (chunk) result.push(...chunk.split(/\s+/));
        pos = idx;
      }
      if (paren === this.open) depth++;
      if (paren === this.close) {
        if (this.strict && depth === 0) throw new Error(`Un-matched close paren at char ${idx}`);
        depth = Math.max(0, depth - 1);
        if (depth === 0) {
          result.push(text.slice(pos, this.parenRe.lastIndex));
          pos = this.parenRe.lastIndex;
        }
      }
    }
    if (this.strict && depth > 0) throw new Error(`Un-matched open paren at char ${pos}`);
    if (pos < text.length) {
      const tail = text.slice(pos).trim();
      if (tail) {
        if (depth > 0) result.push(text.slice(pos));
        else result.push(...tail.split(/\s+/));
      }
    }
    return result;
  }
}

export function sexprTokenize(text: string, parens = "()", strict = true): string[] {
  return new SExprTokenizer(parens, strict).tokenize(text);
}
