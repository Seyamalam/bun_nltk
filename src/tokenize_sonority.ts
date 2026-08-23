/**
 * Sonority-sequencing syllabifier (port of nltk.tokenize.sonority_sequencing.SyllableTokenizer).
 *
 * Splits a word into syllables via the Sonority Sequencing Principle.
 */

const PUNCTUATION = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'.split(""));

export class SyllableTokenizer {
  static readonly MAX_TOKEN_LEN = 4096;
  private readonly vowels: string;
  private readonly phonemeMap: Map<string, number>;
  private vowelSet: Set<string>;

  constructor(lang = "en", sonorityHierarchy?: string[]) {
    let hier: string[];
    if (sonorityHierarchy && sonorityHierarchy.length) hier = sonorityHierarchy;
    else if (lang === "en") hier = ["aeiouy", "lmnrw", "zvsf", "bcdgtkpqxhj"];
    else hier = ["aeiouy", "lmnrw", "zvsf", "bcdgtkpqxhj"];
    this.vowels = hier[0]!;
    this.vowelSet = new Set(this.vowels.split(""));
    // also add upper
    for (const ch of this.vowels.toUpperCase().split("")) this.vowelSet.add(ch);
    this.phonemeMap = new Map();
    for (let i = 0; i < hier.length; i++) {
      const level = hier[i]!;
      const sonority = hier.length - i;
      for (const ch of level) {
        this.phonemeMap.set(ch, sonority);
        this.phonemeMap.set(ch.toUpperCase(), sonority);
      }
    }
  }

  private assignValues(token: string): Array<[string, number]> {
    const out: Array<[string, number]> = [];
    const maxSonority = Math.max(...this.phonemeMap.values());
    for (const ch of token) {
      const v = this.phonemeMap.get(ch);
      if (v !== undefined) out.push([ch, v]);
      else if (!"0123456789".includes(ch) && !PUNCTUATION.has(ch)) {
        out.push([ch, maxSonority]);
        if (!this.vowelSet.has(ch)) this.vowelSet.add(ch);
      } else {
        out.push([ch, -1]);
      }
    }
    return out;
  }

  private validateSyllables(list: string[]): string[] {
    const valid: string[] = [];
    let front = "";
    const vowelRe = new RegExp("[" + [...this.vowelSet].map(c => c.replace(/[\]\\^-]/g, "\\$&")).join("") + "]");
    for (const syl of list) {
      if (PUNCTUATION.has(syl) || (syl.length === 1 && PUNCTUATION.has(syl))) {
        valid.push(syl);
        continue;
      }
      if (!vowelRe.test(syl)) {
        if (valid.length === 0) front += syl;
        else valid[valid.length - 1] = valid[valid.length - 1]! + syl;
      } else {
        if (valid.length === 0) valid.push(front + syl);
        else valid.push(syl);
      }
    }
    return valid;
  }

  tokenize(token: string): string[] {
    let vowelCount = 0;
    for (const v of this.vowelSet) {
      let idx = 0;
      while ((idx = token.indexOf(v, idx)) !== -1) { vowelCount++; idx++; }
      // also count upper? already in set, but token may have upper — we counted via set that includes upper
    }
    // Simpler: count occurrences of any vowel char in token
    // Use the python logic: sum(token.count(x) for x in self.vowels) — note self.vowels is lower only in NLTK, so upper not counted
    // Do same for compat: only lower vowels
    let lowerCount = 0;
    for (const ch of this.vowels) {
      let p = 0;
      while ((p = token.indexOf(ch, p)) !== -1) { lowerCount++; p++; }
    }
    if (lowerCount <= 1) return [token];
    if (token.length > SyllableTokenizer.MAX_TOKEN_LEN) throw new Error(`token exceeds MAX_TOKEN_LEN ${SyllableTokenizer.MAX_TOKEN_LEN}`);
    const vals = this.assignValues(token);
    const syllables: string[] = [];
    let syllable = vals[0]![0];
    for (let i = 0; i + 3 <= vals.length; i++) {
      const [p0, v0] = vals[i]!;
      const [p1, v1] = vals[i+1]!;
      const [p2, v2] = vals[i+2]!;
      void p0; void p2;
      const focalPhoneme = p1;
      const prevVal = v0, focalVal = v1, nextVal = v2;
      if (focalVal === -1) {
        syllables.push(syllable);
        syllables.push(focalPhoneme);
        syllable = "";
      } else if (prevVal >= focalVal && focalVal === nextVal) {
        syllable += focalPhoneme;
        syllables.push(syllable);
        syllable = "";
      } else if (prevVal > focalVal && focalVal < nextVal) {
        syllables.push(syllable);
        syllable = focalPhoneme;
      } else {
        syllable += focalPhoneme;
      }
    }
    syllable += vals[vals.length - 1]![0];
    syllables.push(syllable);
    return this.validateSyllables(syllables);
  }
}

export function sonorityTokenize(token: string, lang = "en"): string[] {
  return new SyllableTokenizer(lang).tokenize(token);
}
