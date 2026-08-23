/**
 * ARLSTem — light Arabic stemmer (port of nltk.stem.arlstem).
 *
 * Abainia, Ouamour & Sayoud (2017), "A Novel Robust Arabic Light Stemmer",
 * JETAI 29(3), 557-573. Dictionary-free prefix/suffix/infix stripping.
 */

const reHamzatedAlif = /[\u0622\u0623\u0625]/g;
const reAlifMaqsura = /[\u0649]/g;
const reDiacritics = /[\u064B-\u065F]/g;

// Alif Laam, Laam Laam, Fa Laam, Fa Ba
const PR2 = ["\u0627\u0644", "\u0644\u0644", "\u0641\u0644", "\u0641\u0628"];
// Ba Alif Laam, Kaaf Alif Laam, Waaw Alif Laam
const PR3 = ["\u0628\u0627\u0644", "\u0643\u0627\u0644", "\u0648\u0627\u0644"];
// Fa Laam Laam, Waaw Laam Laam
const PR32 = ["\u0641\u0644\u0644", "\u0648\u0644\u0644"];
// Fa Ba Alif Laam, Waaw Ba Alif Laam, Fa Kaaf Alif Laam
const PR4 = ["\u0641\u0628\u0627\u0644", "\u0648\u0628\u0627\u0644", "\u0641\u0643\u0627\u0644"];

// Kaf Yaa, Kaf Miim
const SU2 = ["\u0643\u064a", "\u0643\u0645"];
// Ha Alif, Ha Miim
const SU22 = ["\u0647\u0627", "\u0647\u0645"];
// Kaf Miim Alif, Kaf Noon Shadda
const SU3 = ["\u0643\u0645\u0627", "\u0643\u0646\u0651"];
// Ha Miim Alif, Ha Noon Shadda
const SU32 = ["\u0647\u0645\u0627", "\u0647\u0646\u0651"];

// Alif Noon, Ya Noon, Waaw Noon
const PL_SI2 = ["\u0627\u0646", "\u064a\u0646", "\u0648\u0646"];
// Taa Alif Noon, Taa Ya Noon
const PL_SI3 = ["\u062a\u0627\u0646", "\u062a\u064a\u0646"];

// Alif Noon, Waaw Noon
const VERB_SU2 = ["\u0627\u0646", "\u0648\u0646"];
// Siin Taa, Siin Yaa
const VERB_PR2 = ["\u0633\u062a", "\u0633\u064a"];
// Siin Alif, Siin Noon
const VERB_PR22 = ["\u0633\u0627", "\u0633\u0646"];
// Lam Noon, Lam Taa, Lam Yaa, Lam Hamza
const VERB_PR33 = ["\u0644\u0646", "\u0644\u062a", "\u0644\u064a", "\u0644\u0623"];
// Taa Miim Alif, Taa Noon Shadda
const VERB_SUF3 = ["\u062a\u0645\u0627", "\u062a\u0646\u0651"];
// Noon Alif, Taa Miim, Taa Alif, Waaw Alif
const VERB_SUF2 = ["\u0646\u0627", "\u062a\u0645", "\u062a\u0627", "\u0648\u0627"];
// Taa, Alif, Noon
const VERB_SUF1 = ["\u062a", "\u0627", "\u0646"];

export class ARLSTem {
  /** Normalize: strip diacritics, unify alif forms, alif maqsura -> yaa. */
  norm(token: string): string {
    token = token.replace(reDiacritics, "");
    token = token.replace(reHamzatedAlif, "\u0627");
    token = token.replace(reAlifMaqsura, "\u064a");
    if (token.startsWith("\u0648") && token.length > 3) token = token.slice(1);
    return token;
  }

  /** Strip common noun prefixes; null when none matched. */
  pref(token: string): string | null {
    if (token.length > 5) for (const p of PR3) if (token.startsWith(p)) return token.slice(3);
    if (token.length > 6) for (const p of PR4) if (token.startsWith(p)) return token.slice(4);
    if (token.length > 5) for (const p of PR32) if (token.startsWith(p)) return token.slice(3);
    if (token.length > 4) for (const p of PR2) if (token.startsWith(p)) return token.slice(2);
    return null;
  }

  /** Strip suffixes common to nouns and verbs. */
  suff(token: string): string {
    if (token.endsWith("\u0643") && token.length > 3) return token.slice(0, -1);
    if (token.length > 4) for (const s of SU2) if (token.endsWith(s)) return token.slice(0, -2);
    if (token.length > 5) for (const s of SU3) if (token.endsWith(s)) return token.slice(0, -3);
    if (token.endsWith("\u0647") && token.length > 3) return token.slice(0, -1);
    if (token.length > 4) for (const s of SU22) if (token.endsWith(s)) return token.slice(0, -2);
    if (token.length > 5) for (const s of SU32) if (token.endsWith(s)) return token.slice(0, -3);
    if (token.endsWith("\u0646\u0627") && token.length > 4) return token.slice(0, -2);
    return token;
  }

  /** Feminine -> masculine; null when not applicable. */
  fem2masc(token: string): string | null {
    if (token.endsWith("\u0629") && token.length > 3) return token.slice(0, -1);
    return null;
  }

  /** Plural -> singular; null when not applicable. */
  plur2sing(token: string): string | null {
    if (token.length > 4) for (const p of PL_SI2) if (token.endsWith(p)) return token.slice(0, -2);
    if (token.length > 5) for (const p of PL_SI3) if (token.endsWith(p)) return token.slice(0, -3);
    if (token.length > 3 && token.endsWith("\u0627\u062a")) return token.slice(0, -2);
    if (token.length > 3 && token.startsWith("\u0627") && token[2] === "\u0627")
      return token.slice(0, 2) + token.slice(3);
    if (token.length > 4 && token.startsWith("\u0627") && token[token.length - 2] === "\u0627")
      return token.slice(1, -2) + token[token.length - 1];
    return null;
  }

  private verbT1(token: string): string | null {
    if (token.length > 5 && token.startsWith("\u062a")) {
      for (const s of PL_SI2) if (token.endsWith(s)) return token.slice(1, -2);
    }
    if (token.length > 5 && token.startsWith("\u064a")) {
      for (const s of VERB_SU2) if (token.endsWith(s)) return token.slice(1, -2);
    }
    if (token.length > 4 && token.startsWith("\u0627")) {
      if (token.length > 5 && token.endsWith("\u0648\u0627")) return token.slice(1, -2);
      if (token.endsWith("\u064a")) return token.slice(1, -1);
      if (token.endsWith("\u0627")) return token.slice(1, -1);
      if (token.endsWith("\u0646")) return token.slice(1, -1);
    }
    if (token.length > 4 && token.startsWith("\u064a") && token.endsWith("\u0646")) return token.slice(1, -1);
    if (token.length > 4 && token.startsWith("\u062a") && token.endsWith("\u0646")) return token.slice(1, -1);
    return null;
  }

  private verbT2(token: string): string | null {
    if (token.length > 6) {
      for (const s of PL_SI2) {
        if (token.startsWith(VERB_PR2[0]!) && token.endsWith(s)) return token.slice(2, -2);
      }
      if (token.startsWith(VERB_PR2[1]!) && token.endsWith(PL_SI2[0]!)) return token.slice(2, -2);
      if (token.startsWith(VERB_PR2[1]!) && token.endsWith(PL_SI2[2]!)) return token.slice(2, -2);
    }
    if (token.length > 5 && token.startsWith(VERB_PR2[0]!) && token.endsWith("\u0646")) return token.slice(2, -1);
    if (token.length > 5 && token.startsWith(VERB_PR2[1]!) && token.endsWith("\u0646")) return token.slice(2, -1);
    return null;
  }

  private verbT3(token: string): string | null {
    if (token.length > 5) for (const s of VERB_SUF3) if (token.endsWith(s)) return token.slice(0, -3);
    if (token.length > 4) for (const s of VERB_SUF2) if (token.endsWith(s)) return token.slice(0, -2);
    if (token.length > 3) for (const s of VERB_SUF1) if (token.endsWith(s)) return token.slice(0, -1);
    return null;
  }

  private verbT4(token: string): string | null {
    if (token.length > 3) {
      for (const p of VERB_SUF1) if (token.startsWith(p)) return token.slice(1);
      if (token.startsWith("\u064a")) return token.slice(1);
    }
    return null;
  }

  private verbT5(token: string): string | null {
    if (token.length > 4) {
      for (const p of VERB_PR22) if (token.startsWith(p)) return token.slice(2);
      for (const p of VERB_PR2) if (token.startsWith(p)) return token.slice(2);
    }
    return token;
  }

  private verbT6(token: string): string | null {
    if (token.length > 4) for (const p of VERB_PR33) if (token.startsWith(p)) return token.slice(2);
    return token;
  }

  /** Stem verb prefixes/suffixes via the six transformation tables. */
  verb(token: string): string | null {
    const t1 = this.verbT1(token);
    if (t1 !== null) return t1;
    const t2 = this.verbT2(token);
    if (t2 !== null) return t2;
    const t3 = this.verbT3(token);
    if (t3 !== null) return t3;
    const t4 = this.verbT4(token);
    if (t4 !== null) return t4;
    const t5 = this.verbT5(token);
    if (t5 !== null) return t5;
    return this.verbT6(token) ?? token;
  }

  /** Stem `token` per ARLSTem. Returns undefined for empty input (NLTK prints + returns None). */
  stem(token: string): string | undefined {
    try {
      if (!token) throw new Error("The word could not be stemmed, because it is empty !");
      token = this.norm(token);
      const pre = this.pref(token);
      if (pre !== null) token = pre;
      token = this.suff(token);
      const ps = this.plur2sing(token);
      if (ps === null) {
        const fm = this.fem2masc(token);
        if (fm !== null) return fm;
        if (pre === null) return this.verb(token) ?? token;
      } else {
        return ps;
      }
      return token;
    } catch (e) {
      console.log((e as Error).message);
      return undefined;
    }
  }
}
