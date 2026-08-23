/**
 * RSLP stemmer for Portuguese (port of nltk.stem.rslp.RSLPStemmer).
 *
 * Rules are bundled from nltk_data/stemmers/rslp/step*.pt.
 */
import { RSLP_STEPS } from "./stem_rslp_data";

type Rule = [suffix: string, minSize: number, replacement: string, exceptions: string[]];

function parseRules(raw: string): Rule[] {
  const lines = raw.split("\n").map(l=>l.trim()).filter(l=>l && !l.startsWith("#")).map(l=>l.replace(/\t\t/g,"\t"));
  const out: Rule[] = [];
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const suffix = parts[0]!.slice(1,-1);
    const minSize = parseInt(parts[1]!, 10);
    const repl = parts[2]!.slice(1,-1);
    const excRaw = parts[3]!;
    const exc = excRaw === "*" ? [] : excRaw.split(",").map(s=>s.slice(1,-1).trim()).filter(Boolean);
    // NLTK also handles bracketed exception lists like "[...]" — normalize
    out.push([suffix, minSize, repl, exc]);
  }
  return out;
}

export class RSLPStemmer {
  private readonly model: Rule[][];

  constructor() {
    this.model = RSLP_STEPS.map(parseRules);
  }

  private applyRule(word: string, idx: number): string {
    const rules = this.model[idx] ?? [];
    for (const [suffix, minSize, repl, exc] of rules) {
      if (word.endsWith(suffix)) {
        if (word.length >= suffix.length + minSize) {
          if (!exc.includes(word)) {
            return word.slice(0, word.length - suffix.length) + repl;
          }
        }
      }
    }
    return word;
  }

  stem(word: string): string {
    let w = word.toLowerCase();
    if (w.endsWith("s")) w = this.applyRule(w, 0);
    if (w.endsWith("a")) w = this.applyRule(w, 1);
    w = this.applyRule(w, 3);
    w = this.applyRule(w, 2);
    let prev = w;
    w = this.applyRule(w, 4);
    if (w === prev) {
      prev = w;
      w = this.applyRule(w, 5);
      if (w === prev) w = this.applyRule(w, 6);
    }
    return w;
  }
}

export function rslpStem(word: string): string {
  return new RSLPStemmer().stem(word);
}
