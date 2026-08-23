/**
 * ARLSTem2 Arabic stemmer (port of nltk.stem.arlstem2).
 *
 * Second-generation ARLSTem: two-round stemming with adjective-infix
 * handling and expanded feminine/plural transforms. Dictionary-free.
 */

const reHamzatedAlif = /[\u0622\u0623\u0625]/g;
const reAlifMaqsura = /[\u0649]/g;
const reDiacritics = /[\u064B-\u065F]/g;

const PR2 = ["\u0627\u0644", "\u0644\u0644", "\u0641\u0644", "\u0641\u0628"];
const PR3 = ["\u0628\u0627\u0644", "\u0643\u0627\u0644", "\u0648\u0627\u0644"];
const PR32 = ["\u0641\u0644\u0644", "\u0648\u0644\u0644"];
const PR4 = ["\u0641\u0628\u0627\u0644", "\u0648\u0628\u0627\u0644", "\u0641\u0643\u0627\u0644"];

const SU2 = ["\u0643\u064a", "\u0643\u0645"];
const SU22 = ["\u0647\u0627", "\u0647\u0645"];
const SU3 = ["\u0643\u0645\u0627", "\u0643\u0646\u0651"];
const SU32 = ["\u0647\u0645\u0627", "\u0647\u0646\u0651"];

const PL_SI2 = ["\u0627\u0646", "\u064a\u0646", "\u0648\u0646"];
const PL_SI3 = ["\u062a\u0627\u0646", "\u062a\u064a\u0646"];

const VERB_SU2 = ["\u0627\u0646", "\u0648\u0646"];
const VERB_PR2 = ["\u0633\u062a", "\u0633\u064a"];
const VERB_PR22 = ["\u0633\u0627", "\u0633\u0646"];
const VERB_PR33 = ["\u0644\u0646", "\u0644\u062a", "\u0644\u064a", "\u0644\u0623"];
const VERB_SUF3 = ["\u062a\u0645\u0627", "\u062a\u0646\u0651"];
const VERB_SUF2 = ["\u0646\u0627", "\u062a\u0645", "\u062a\u0627", "\u0648\u0627"];
const VERB_SUF1 = ["\u062a", "\u0627", "\u0646"];

export class ARLSTem2 {
  private isVerb = false;

  norm(token: string): string {
    token = token.replace(reDiacritics, "");
    token = token.replace(reHamzatedAlif, "\u0627");
    token = token.replace(reAlifMaqsura, "\u064a");
    if (token.startsWith("\u0648") && token.length > 3) token = token.slice(1);
    return token;
  }

  pref(token: string): string | null {
    if (token.length > 5) for (const p of PR3) if (token.startsWith(p)) return token.slice(3);
    if (token.length > 6) for (const p of PR4) if (token.startsWith(p)) return token.slice(4);
    if (token.length > 5) for (const p of PR32) if (token.startsWith(p)) return token.slice(3);
    if (token.length > 4) for (const p of PR2) if (token.startsWith(p)) return token.slice(2);
    return null;
  }

  /** Remove adjective infixes (^Alif, Alif, $Yaa); null when not applicable. */
  adjective(token: string): string | null {
    if (token.length > 5 && token.startsWith("\u0627") && token[token.length - 3] === "\u0627" && token.endsWith("\u064a")) {
      return token.slice(0, -3) + token[token.length - 2];
    }
    return null;
  }

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

  fem2masc(token: string): string | null {
    if (token.length > 6) {
      // ^Taa, Yaa, $Yaa and Taa Marbuta
      if (
        token.startsWith("\u062a") &&
        token[token.length - 4] === "\u064a" &&
        token.endsWith("\u064a\u0629")
      ) {
        return token.slice(1, -4) + token[token.length - 3];
      }
      // ^Alif, Yaa(?), $Yaa and Taa Marbuta
      if (
        token.startsWith("\u0627") &&
        token[token.length - 4] === "\u0627" &&
        token.endsWith("\u064a\u0629")
      ) {
        return token.slice(0, -4) + token[token.length - 3];
      }
    }
    // $Alif, Yaa and Taa Marbuta
    if (token.endsWith("\u0627\u064a\u0629") && token.length > 5) return token.slice(0, -2);
    if (token.length > 4) {
      // Alif at [1], $Taa Marbuta
      if (token[1] === "\u0627" && token.endsWith("\u0629")) return token[0]! + token.slice(2, -1);
      // $Yaa and Taa Marbuta
      if (token.endsWith("\u064a\u0629")) return token.slice(0, -2);
    }
    // $Taa Marbuta
    if (token.endsWith("\u0629") && token.length > 3) return token.slice(0, -1);
    return null;
  }

  plur2sing(token: string): string | null {
    // ^Haa(Miim), $Noon Waaw
    if (token.length > 5 && token.startsWith("\u0645") && token.endsWith("\u0648\u0646")) return token.slice(1, -2);
    if (token.length > 4) for (const p of PL_SI2) if (token.endsWith(p)) return token.slice(0, -2);
    if (token.length > 5) for (const p of PL_SI3) if (token.endsWith(p)) return token.slice(0, -3);
    if (token.length > 4) {
      if (token.endsWith("\u0627\u062a")) return token.slice(0, -2);
      if (token.startsWith("\u0627") && token[2] === "\u0627") return token.slice(0, 2) + token.slice(3);
      if (token.startsWith("\u0627") && token[token.length - 2] === "\u0627") return token.slice(1, -2) + token[token.length - 1];
    }
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
    return null;
  }

  private verbT6(token: string): string | null {
    if (token.length > 4) for (const p of VERB_PR33) if (token.startsWith(p)) return token.slice(2);
    return token;
  }

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
    return this.verbT6(token);
  }

  /** First round of stemming (NLTK stem1). */
  stem1(token: string): string | undefined {
    try {
      if (!token) throw new Error("The word could not be stemmed, because it is empty !");
      this.isVerb = false;
      token = this.norm(token);
      const pre = this.pref(token);
      if (pre !== null) token = pre;
      const fm = this.fem2masc(token);
      if (fm !== null) return fm;
      const adj = this.adjective(token);
      if (adj !== null) return adj;
      token = this.suff(token);
      const ps = this.plur2sing(token);
      if (ps === null) {
        if (pre === null) {
          const verb = this.verb(token);
          if (verb !== null) {
            this.isVerb = true;
            return verb;
          }
        }
      } else {
        return ps;
      }
      return token;
    } catch (e) {
      console.log((e as Error).message);
      return undefined;
    }
  }

  /** Full two-round stem. Returns undefined for empty input (NLTK returns None). */
  stem(token: string): string | undefined {
    try {
      if (!token) throw new Error("The word could not be stemmed, because it is empty !");
      let t = this.stem1(token)!;
      if (t.length > 4) {
        // ^Taa, $Yaa + char
        if (t.startsWith("\u062a") && t[t.length - 2] === "\u064a") {
          t = t.slice(1, -2) + t[t.length - 1];
          return t;
        }
        // ^Miim, $Waaw + char
        if (t.startsWith("\u0645") && t[t.length - 2] === "\u0648") {
          t = t.slice(1, -2) + t[t.length - 1];
          return t;
        }
      }
      if (t.length > 3) {
        // !^Alif, $Yaa
        if (!t.startsWith("\u0627") && t.endsWith("\u064a")) {
          t = t.slice(0, -1);
          return t;
        }
        // $Laam
        if (t.startsWith("\u0644")) return t.slice(1);
      }
      return t;
    } catch (e) {
      console.log((e as Error).message);
      return undefined;
    }
  }
}
