import { SNOWBALL_LANGUAGES, snowballStem } from "./snowball";
import { SNOWBALL_STOPWORDS } from "./snowball/stopwords";
import { PorterStemmer } from "./porter_stemmer";
import { loadWordNet, type WordNetMorphPos } from "./wordnet";


export class RegexpStemmer {
  private readonly regexp: RegExp;
  private readonly globalRegexp: RegExp;
  private readonly min: number;

  constructor(regexp: RegExp | string, min = 0) {
    this.regexp = typeof regexp === "string" ? new RegExp(regexp) : regexp;
    const flags = this.regexp.flags.includes("g") ? this.regexp.flags : `${this.regexp.flags}g`;
    this.globalRegexp = new RegExp(this.regexp.source, flags);
    this.min = Math.floor(min);
  }

  stem(word: string): string {
    if (word.length < this.min) return word;
    this.globalRegexp.lastIndex = 0;
    return word.replace(this.globalRegexp, "");
  }

  toString(): string {
    return `<RegexpStemmer: '${this.regexp.source}'>`;
  }
}

export class LancasterStemmer {
  static readonly defaultRuleTuple: readonly string[] = [
    "ai*2.", "a*1.", "bb1.", "city3s.", "ci2>", "cn1t>", "dd1.", "dei3y>",
    "deec2ss.", "dee1.", "de2>", "dooh4>", "e1>", "feil1v.", "fi2>",
    "gni3>", "gai3y.", "ga2>", "gg1.", "ht*2.", "hsiug5ct.", "hsi3>",
    "i*1.", "i1y>", "ji1d.", "juf1s.", "ju1d.", "jo1d.", "jeh1r.",
    "jrev1t.", "jsim2t.", "jn1d.", "j1s.", "lbaifi6.", "lbai4y.", "lba3>",
    "lbi3.", "lib2l>", "lc1.", "lufi4y.", "luf3>", "lu2.", "lai3>",
    "lau3>", "la2>", "ll1.", "mui3.", "mu*2.", "msi3>", "mm1.", "nois4j>",
    "noix4ct.", "noi3>", "nai3>", "na2>", "nee0.", "ne2>", "nn1.", "pihs4>",
    "pp1.", "re2>", "rae0.", "ra2.", "ro2>", "ru2>", "rr1.", "rt1>",
    "rei3y>", "sei3y>", "sis2.", "si2>", "ssen4>", "ss0.", "suo3>", "su*2.",
    "s*1>", "s0.", "tacilp4y.", "ta2>", "tnem4>", "tne3>", "tna3>",
    "tpir2b.", "tpro2b.", "tcud1.", "tpmus2.", "tpec2iv.", "tulo2v.",
    "tsis0.", "tsi3>", "tt1.", "uqi3.", "ugo1.", "vis3j>", "vie0.", "vi2>",
    "ylb1>", "yli3y>", "ylp0.", "yl2>", "ygo1.", "yhp1.", "ymo1.", "ypo1.",
    "yti3>", "yte3>", "ytl2.", "yrtsi5.", "yra3>", "yro3>", "yfi3.",
    "ycn2t>", "yca3>", "zi2>", "zy1s.",
  ];

  ruleDictionary: Record<string, string[]> = {};
  readonly stripPrefixFlag: boolean;
  readonly ruleTuple: readonly string[];

  constructor(ruleTuple?: readonly string[] | null, stripPrefixFlag = false) {
    this.stripPrefixFlag = stripPrefixFlag;
    this.ruleTuple = ruleTuple ?? LancasterStemmer.defaultRuleTuple;
  }

  parseRules(ruleTuple?: readonly string[] | null): void {
    const tuple = ruleTuple ?? this.ruleTuple;
    const validRule = /^[a-z]+\*?\d[a-z]*[>.]?$/;
    this.ruleDictionary = {};
    for (const rule of tuple) {
      if (!validRule.test(rule)) throw new Error(`The rule ${rule} is invalid`);
      const firstLetter = rule.slice(0, 1);
      (this.ruleDictionary[firstLetter] ??= []).push(rule);
    }
  }

  stem(word: string): string {
    let stemmed = word.toLowerCase();
    if (this.stripPrefixFlag) stemmed = this.stripPrefix(stemmed);
    const intactWord = stemmed;
    if (Object.keys(this.ruleDictionary).length === 0) this.parseRules();
    return this.doStemming(stemmed, intactWord);
  }

  private doStemming(word: string, intactWord: string): string {
    const validRule = /^([a-z]+)(\*?)(\d)([a-z]*)([>.]?)$/;
    let proceed = true;
    while (proceed) {
      const lastLetterPosition = this.getLastLetter(word);
      if (lastLetterPosition < 0 || !(word[lastLetterPosition]! in this.ruleDictionary)) {
        proceed = false;
        continue;
      }
      let ruleWasApplied = false;
      for (const rule of this.ruleDictionary[word[lastLetterPosition]!]!) {
        const match = validRule.exec(rule);
        if (!match) continue;
        const [, endingString, intactFlag, removeTotalRaw, appendString, contFlag] = match;
        const removeTotal = Number(removeTotalRaw);
        if (!word.endsWith([...endingString!].reverse().join(""))) continue;
        if (intactFlag && word !== intactWord) continue;
        if (!this.isAcceptable(word, removeTotal)) continue;
        word = this.applyRule(word, removeTotal, appendString!);
        ruleWasApplied = true;
        if (contFlag === ".") proceed = false;
        break;
      }
      if (!ruleWasApplied) proceed = false;
    }
    return word;
  }

  private getLastLetter(word: string): number {
    let lastLetter = -1;
    for (let position = 0; position < word.length; position += 1) {
      if (/\p{L}/u.test(word[position]!)) lastLetter = position;
      else break;
    }
    return lastLetter;
  }

  private isAcceptable(word: string, removeTotal: number): boolean {
    if ("aeiouy".includes(word[0]!)) return word.length - removeTotal >= 2;
    if (word.length - removeTotal >= 3) {
      return "aeiouy".includes(word[1]!) || "aeiouy".includes(word[2]!);
    }
    return false;
  }

  private applyRule(word: string, removeTotal: number, appendString: string): string {
    return word.slice(0, word.length - removeTotal) + appendString;
  }

  private stripPrefix(word: string): string {
    for (const prefix of ["kilo", "micro", "milli", "intra", "ultra", "mega", "nano", "pico", "pseudo"]) {
      if (word.startsWith(prefix)) return word.slice(prefix.length);
    }
    return word;
  }

  toString(): string {
    return "<LancasterStemmer>";
  }
}

/**
 * NLTK-compatible Snowball stemmer backed by real Snowball (Porter2-family)
 * implementations in ./snowball. Unsupported languages throw an Error
 * (mirroring NLTK's ValueError), both at construction time and via
 * {@link snowballStem}.
 *
 * `ignoreStopwords` mirrors NLTK's `ignore_stopwords`: the language's NLTK
 * stopwords list is loaded at construction (a language without a list raises
 * the same `'<X>Stemmer> has no list of stopwords' error NLTK raises), and
 * `stem` returns a stopword unchanged (lowercased, except Russian which is
 * checked un-normalized). The `porter` language delegates to the classic
 * {@link PorterStemmer} exactly like NLTK's snowball.PorterStemmer.
 */
export class SnowballStemmer {
  static readonly languages: readonly string[] = [
    ...SNOWBALL_LANGUAGES.slice(0, 10),
    "porter",
    ...SNOWBALL_LANGUAGES.slice(10),
  ];

  readonly language: string;
  readonly stopwords: Set<string>;
  readonly stemmer: { stem(word: string): string };

  constructor(language = "english", ignoreStopwords = false) {
    this.language = language.toLowerCase();
    if (!SnowballStemmer.languages.includes(this.language)) {
      throw new Error(`The language '${language}' is not supported.`);
    }
    this.stopwords = new Set();
    if (ignoreStopwords) {
      const words = SNOWBALL_STOPWORDS[this.language];
      if (!words) {
        const cls = `${this.language[0]!.toUpperCase()}${this.language.slice(1)}Stemmer`;
        throw new Error(`<${cls}> has no list of stopwords. Please set 'ignore_stopwords' to 'False'.`);
      }
      for (const word of words) this.stopwords.add(word);
    }
    this.stemmer =
      this.language === "porter"
        ? new PorterStemmer()
        : { stem: (word: string) => snowballStem(word, this.language, this.stopwords) };
  }

  stem(word: string): string {
    if (this.language === "arabic") {
      // NLTK's ArabicStemmer checks stopwords after pre-normalization
      // (diacritics stripped), inside stem() — never on the raw input.
      return this.stemmer.stem(word);
    }
    const normalized = this.language === "russian" ? word : word.toLowerCase();
    if (this.stopwords.has(normalized)) return normalized;
    return this.stemmer.stem(word);
  }
}

function languageStemmer(language: string) {
  return class extends SnowballStemmer {
    constructor(ignoreStopwords = false) {
      super(language, ignoreStopwords);
    }
  };
}

export const ArabicStemmer = languageStemmer("arabic");
export const DanishStemmer = languageStemmer("danish");
export const DutchStemmer = languageStemmer("dutch");
export const EnglishStemmer = languageStemmer("english");
export const FinnishStemmer = languageStemmer("finnish");
export const FrenchStemmer = languageStemmer("french");
export const GermanStemmer = languageStemmer("german");
export const HungarianStemmer = languageStemmer("hungarian");
export const ItalianStemmer = languageStemmer("italian");
export const NorwegianStemmer = languageStemmer("norwegian");
export const PortugueseStemmer = languageStemmer("portuguese");
export const RomanianStemmer = languageStemmer("romanian");
export const RussianStemmer = languageStemmer("russian");
export const SpanishStemmer = languageStemmer("spanish");
export const SwedishStemmer = languageStemmer("swedish");

function normalizePos(pos?: string): WordNetMorphPos | undefined {
  if (!pos) return undefined;
  const lower = pos.toLowerCase();
  if (lower === "n" || lower === "noun") return "n";
  if (lower === "v" || lower === "verb") return "v";
  if (lower === "a" || lower === "adj" || lower === "adjective") return "a";
  if (lower === "s" || lower === "adj_sat" || lower === "satellite") return "s";
  if (lower === "r" || lower === "adv" || lower === "adverb") return "r";
  return undefined;
}

export class WordNetLemmatizer {
  _morphy(form: string, pos: string = "n", checkExceptions = true): string[] {
    const wnPos = normalizePos(pos);
    if (!wnPos) throw new Error(`'${pos}'`);
    return loadWordNet()._morphy(form, wnPos, checkExceptions);
  }

  morphy(form: string, pos: string | null = null, checkExceptions = true): string | null {
    const wnPos = normalizePos(pos ?? undefined);
    if (pos && !wnPos) throw new Error(`'${pos}'`);
    return loadWordNet().morphy(form, wnPos ?? null, checkExceptions);
  }

  lemmatize(word: string, pos: string = "n"): string {
    const lemmas = this._morphy(word, pos);
    if (lemmas.length === 0) return word;
    return lemmas.reduce((best, lemma) => (lemma.length < best.length ? lemma : best));
  }

  toString(): string {
    return "<WordNetLemmatizer>";
  }
}

