/**
 * Real Snowball (Porter2-family) stemmers, ported line-for-line from
 * NLTK's nltk/stem/snowball.py (see nltk.md in this repo), which itself is a
 * Python translation of the Snowball spec at http://snowball.tartarus.org/.
 *
 * Supported languages: danish, dutch, english, french, german, italian,
 * norwegian, portuguese, romanian, russian, spanish, swedish.
 *
 * Behavior notes:
 * - Each language stemmer lowercases its input first (exactly like NLTK;
 *   the Russian stemmer does NOT lowercase, matching NLTK).
 * - Unsupported languages throw an Error mirroring NLTK's ValueError:
 *   "The language '<language>' is not supported."
 */

function suffixReplace(original: string, old: string, neu: string): string {
  return original.slice(0, original.length - old.length) + neu;
}

/** Python-style single-character index; returns "" when out of range. */
function at(s: string, i: number): string {
  const idx = i < 0 ? i + s.length : i;
  return idx >= 0 && idx < s.length ? s[idx]! : "";
}

function endsWithAny(s: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => s.endsWith(suffix));
}

type Regions = { r1: string; r2: string };

function r1r2Standard(word: string, vowels: string): Regions {
  let r1 = "";
  let r2 = "";
  for (let i = 1; i < word.length; i++) {
    if (!vowels.includes(word[i]!) && vowels.includes(word[i - 1]!)) {
      r1 = word.slice(i + 1);
      break;
    }
  }
  for (let i = 1; i < r1.length; i++) {
    if (!vowels.includes(r1[i]!) && vowels.includes(r1[i - 1]!)) {
      r2 = r1.slice(i + 1);
      break;
    }
  }
  return { r1, r2 };
}

function rvStandard(word: string, vowels: string): string {
  let rv = "";
  if (word.length >= 2) {
    if (!vowels.includes(word[1]!)) {
      for (let i = 2; i < word.length; i++) {
        if (vowels.includes(word[i]!)) {
          rv = word.slice(i + 1);
          break;
        }
      }
    } else if (vowels.includes(word[0]!) && vowels.includes(word[1]!)) {
      for (let i = 2; i < word.length; i++) {
        if (!vowels.includes(word[i]!)) {
          rv = word.slice(i + 1);
          break;
        }
      }
    } else {
      rv = word.slice(3);
    }
  }
  return rv;
}

function r1Scandinavian(word: string, vowels: string): string {
  let r1 = "";
  for (let i = 1; i < word.length; i++) {
    if (!vowels.includes(word[i]!) && vowels.includes(word[i - 1]!)) {
      const prefixLen = i + 1;
      if (prefixLen > 0 && prefixLen < 3) {
        r1 = word.slice(3);
      } else if (prefixLen >= 3) {
        r1 = word.slice(i + 1);
      } else {
        return word;
      }
      break;
    }
  }
  return r1;
}

// ---------------------------------------------------------------------------
// Danish
// ---------------------------------------------------------------------------

const DANISH_VOWELS = "aeiouyæåø";
const DANISH_S_ENDING = "abcdfghjklmnoprtvyzå";
const DANISH_DOUBLE_CONSONANTS = [
  "bb", "cc", "dd", "ff", "gg", "hh", "jj", "kk", "ll", "mm", "nn",
  "pp", "qq", "rr", "ss", "tt", "vv", "ww", "xx", "zz",
];
const DANISH_STEP1_SUFFIXES = [
  "erendes", "erende", "hedens", "ethed", "erede", "heden", "heder", "endes",
  "ernes", "erens", "erets", "ered", "ende", "erne", "eren", "erer", "heds",
  "enes", "eres", "eret", "hed", "ene", "ere", "ens", "ers", "ets", "en",
  "er", "es", "et", "e", "s",
];
const DANISH_STEP2_SUFFIXES = ["gd", "dt", "gt", "kt"];
const DANISH_STEP3_SUFFIXES = ["elig", "løst", "lig", "els", "ig"];

export function stemDanish(input: string): string {
  let word = input.toLowerCase();
  let r1 = r1Scandinavian(word, DANISH_VOWELS);

  // STEP 1
  for (const suffix of DANISH_STEP1_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "s") {
        if (DANISH_S_ENDING.includes(at(word, -2))) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
        }
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 2
  for (const suffix of DANISH_STEP2_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      word = word.slice(0, -1);
      r1 = r1.slice(0, -1);
      break;
    }
  }

  // STEP 3
  if (r1.endsWith("igst")) {
    word = word.slice(0, -2);
    r1 = r1.slice(0, -2);
  }

  for (const suffix of DANISH_STEP3_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "løst") {
        word = word.slice(0, -1);
        r1 = r1.slice(0, -1);
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        if (endsWithAny(r1, DANISH_STEP2_SUFFIXES)) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
        }
      }
      break;
    }
  }

  // STEP 4: Undouble
  for (const doubleCons of DANISH_DOUBLE_CONSONANTS) {
    if (word.endsWith(doubleCons) && word.length > 3) {
      word = word.slice(0, -1);
      break;
    }
  }

  return word;
}

// ---------------------------------------------------------------------------
// Dutch
// ---------------------------------------------------------------------------

const DUTCH_VOWELS = "aeiouyè";
const DUTCH_STEP1_SUFFIXES = ["heden", "ene", "en", "se", "s"];
const DUTCH_STEP3B_SUFFIXES = ["baar", "lijk", "bar", "end", "ing", "ig"];

export function stemDutch(input: string): string {
  let word = input.toLowerCase();
  let step2Success = false;

  // Vowel accents are removed.
  word = word
    .replace(/ä/g, "a")
    .replace(/á/g, "a")
    .replace(/ë/g, "e")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ï/g, "i")
    .replace(/ö/g, "o")
    .replace(/ó/g, "o")
    .replace(/ü/g, "u")
    .replace(/ú/g, "u");

  // An initial 'y', a 'y' after a vowel, and an 'i' between vowels are put
  // into upper case. From now on these are treated as consonants.
  if (word.startsWith("y")) {
    word = "Y" + word.slice(1);
  }
  for (let i = 1; i < word.length; i++) {
    if (DUTCH_VOWELS.includes(word[i - 1]!) && word[i] === "y") {
      word = word.slice(0, i) + "Y" + word.slice(i + 1);
    }
  }
  for (let i = 1; i < word.length - 1; i++) {
    if (
      DUTCH_VOWELS.includes(word[i - 1]!) &&
      word[i] === "i" &&
      DUTCH_VOWELS.includes(word[i + 1]!)
    ) {
      word = word.slice(0, i) + "I" + word.slice(i + 1);
    }
  }

  let { r1, r2 } = r1r2Standard(word, DUTCH_VOWELS);

  // R1 is adjusted so that the region before it contains at least 3 letters.
  for (let i = 1; i < word.length; i++) {
    if (!DUTCH_VOWELS.includes(word[i]!) && DUTCH_VOWELS.includes(word[i - 1]!)) {
      const prefixLen = i + 1;
      if (prefixLen > 0 && prefixLen < 3) {
        r1 = word.slice(3);
      } else if (prefixLen === 0) {
        return word;
      }
      break;
    }
  }

  // STEP 1
  for (const suffix of DUTCH_STEP1_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "heden") {
        word = suffixReplace(word, suffix, "heid");
        r1 = suffixReplace(r1, suffix, "heid");
        if (r2.endsWith("heden")) {
          r2 = suffixReplace(r2, "heden", "heid");
        }
      } else if (
        (suffix === "ene" || suffix === "en") &&
        !word.endsWith("heden") &&
        !DUTCH_VOWELS.includes(at(word, -suffix.length - 1)) &&
        word.slice(-(suffix.length + 3), -suffix.length) !== "gem"
      ) {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        if (word.endsWith("kk") || word.endsWith("dd") || word.endsWith("tt")) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
        }
      } else if (
        (suffix === "se" || suffix === "s") &&
        !DUTCH_VOWELS.includes(at(word, -suffix.length - 1)) &&
        at(word, -suffix.length - 1) !== "j"
      ) {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 2
  if (r1.endsWith("e") && !DUTCH_VOWELS.includes(at(word, -2))) {
    step2Success = true;
    word = word.slice(0, -1);
    r1 = r1.slice(0, -1);
    r2 = r2.slice(0, -1);
    if (word.endsWith("kk") || word.endsWith("dd") || word.endsWith("tt")) {
      word = word.slice(0, -1);
      r1 = r1.slice(0, -1);
      r2 = r2.slice(0, -1);
    }
  }

  // STEP 3a
  if (r2.endsWith("heid") && at(word, -5) !== "c") {
    word = word.slice(0, -4);
    r1 = r1.slice(0, -4);
    r2 = r2.slice(0, -4);
    if (
      r1.endsWith("en") &&
      !DUTCH_VOWELS.includes(at(word, -3)) &&
      word.slice(-5, -2) !== "gem"
    ) {
      word = word.slice(0, -2);
      r1 = r1.slice(0, -2);
      r2 = r2.slice(0, -2);
      if (word.endsWith("kk") || word.endsWith("dd") || word.endsWith("tt")) {
        word = word.slice(0, -1);
        r1 = r1.slice(0, -1);
        r2 = r2.slice(0, -1);
      }
    }
  }

  // STEP 3b: Derivational suffixes
  for (const suffix of DUTCH_STEP3B_SUFFIXES) {
    if (r2.endsWith(suffix)) {
      if (suffix === "end" || suffix === "ing") {
        word = word.slice(0, -3);
        r2 = r2.slice(0, -3);
        if (r2.endsWith("ig") && at(word, -3) !== "e") {
          word = word.slice(0, -2);
        } else {
          if (word.endsWith("kk") || word.endsWith("dd") || word.endsWith("tt")) {
            word = word.slice(0, -1);
          }
        }
      } else if (suffix === "ig" && at(word, -3) !== "e") {
        word = word.slice(0, -2);
      } else if (suffix === "lijk") {
        word = word.slice(0, -4);
        r1 = r1.slice(0, -4);
        if (r1.endsWith("e") && !DUTCH_VOWELS.includes(at(word, -2))) {
          word = word.slice(0, -1);
          if (word.endsWith("kk") || word.endsWith("dd") || word.endsWith("tt")) {
            word = word.slice(0, -1);
          }
        }
      } else if (suffix === "baar") {
        word = word.slice(0, -4);
      } else if (suffix === "bar" && step2Success) {
        word = word.slice(0, -3);
      }
      break;
    }
  }

  // STEP 4: Undouble vowel
  if (word.length >= 4) {
    const last = word[word.length - 1]!;
    if (!DUTCH_VOWELS.includes(last) && last !== "I") {
      if (["aa", "ee", "oo", "uu"].includes(word.slice(-3, -1))) {
        if (!DUTCH_VOWELS.includes(at(word, -4))) {
          word = word.slice(0, -3) + word.slice(-3, -2) + word.slice(-1);
        }
      }
    }
  }

  // All occurrences of 'I' and 'Y' are put back into lower case.
  word = word.replace(/I/g, "i").replace(/Y/g, "y");

  return word;
}

// ---------------------------------------------------------------------------
// English (Porter2)
// ---------------------------------------------------------------------------

const ENGLISH_VOWELS = "aeiouy";
const ENGLISH_DOUBLE_CONSONANTS = ["bb", "dd", "ff", "gg", "mm", "nn", "pp", "rr", "tt"];
const ENGLISH_LI_ENDING = "cdeghkmnrt";
const ENGLISH_STEP0_SUFFIXES = ["'s'", "'s", "'"];
const ENGLISH_STEP1A_SUFFIXES = ["sses", "ied", "ies", "us", "ss", "s"];
const ENGLISH_STEP1B_SUFFIXES = ["eedly", "ingly", "edly", "eed", "ing", "ed"];
const ENGLISH_STEP2_SUFFIXES = [
  "ization", "ational", "fulness", "ousness", "iveness", "tional", "biliti",
  "lessli", "entli", "ation", "alism", "aliti", "ousli", "iviti", "fulli",
  "enci", "anci", "abli", "izer", "ator", "alli", "bli", "ogi", "li",
];
const ENGLISH_STEP3_SUFFIXES = [
  "ational", "tional", "alize", "icate", "iciti", "ative", "ical", "ness", "ful",
];
const ENGLISH_STEP4_SUFFIXES = [
  "ement", "ance", "ence", "able", "ible", "ment", "ant", "ent", "ism", "ate",
  "iti", "ous", "ive", "ize", "ion", "al", "er", "ic",
];
const ENGLISH_SPECIAL_WORDS: Record<string, string> = {
  skis: "ski",
  skies: "sky",
  dying: "die",
  lying: "lie",
  tying: "tie",
  idly: "idl",
  gently: "gentl",
  ugly: "ugli",
  early: "earli",
  only: "onli",
  singly: "singl",
  sky: "sky",
  news: "news",
  howe: "howe",
  atlas: "atlas",
  cosmos: "cosmos",
  bias: "bias",
  andes: "andes",
  inning: "inning",
  innings: "inning",
  outing: "outing",
  outings: "outing",
  canning: "canning",
  cannings: "canning",
  herring: "herring",
  herrings: "herring",
  earring: "earring",
  earrings: "earring",
  proceed: "proceed",
  proceeds: "proceed",
  proceeded: "proceed",
  proceeding: "proceed",
  exceed: "exceed",
  exceeds: "exceed",
  exceeded: "exceed",
  exceeding: "exceed",
  succeed: "succeed",
  succeeds: "succeed",
  succeeded: "succeed",
  succeeding: "succeed",
};

export function stemEnglish(input: string): string {
  let word = input.toLowerCase();

  if (word.length <= 2) {
    return word;
  }

  if (Object.prototype.hasOwnProperty.call(ENGLISH_SPECIAL_WORDS, word)) {
    return ENGLISH_SPECIAL_WORDS[word]!;
  }

  // Map the different apostrophe characters to a single consistent one.
  word = word.replace(/\u2019/g, "'").replace(/\u2018/g, "'").replace(/\u201b/g, "'");
  if (word.startsWith("'")) {
    word = word.slice(1);
  }

  if (word.startsWith("y")) {
    word = "Y" + word.slice(1);
  }
  for (let i = 1; i < word.length; i++) {
    if (ENGLISH_VOWELS.includes(word[i - 1]!) && word[i] === "y") {
      word = word.slice(0, i) + "Y" + word.slice(i + 1);
    }
  }

  let r1 = "";
  let r2 = "";

  if (word.startsWith("gener") || word.startsWith("commun") || word.startsWith("arsen")) {
    r1 = word.startsWith("gener") || word.startsWith("arsen") ? word.slice(5) : word.slice(6);
    for (let i = 1; i < r1.length; i++) {
      if (!ENGLISH_VOWELS.includes(r1[i]!) && ENGLISH_VOWELS.includes(r1[i - 1]!)) {
        r2 = r1.slice(i + 1);
        break;
      }
    }
  } else {
    ({ r1, r2 } = r1r2Standard(word, ENGLISH_VOWELS));
  }

  // STEP 0
  for (const suffix of ENGLISH_STEP0_SUFFIXES) {
    if (word.endsWith(suffix)) {
      word = word.slice(0, -suffix.length);
      r1 = r1.slice(0, -suffix.length);
      r2 = r2.slice(0, -suffix.length);
      break;
    }
  }

  // STEP 1a
  for (const suffix of ENGLISH_STEP1A_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (suffix === "sses") {
        word = word.slice(0, -2);
        r1 = r1.slice(0, -2);
        r2 = r2.slice(0, -2);
      } else if (suffix === "ied" || suffix === "ies") {
        if (word.slice(0, -suffix.length).length > 1) {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        } else {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
        }
      } else if (suffix === "s") {
        let step1aVowelFound = false;
        for (const letter of word.slice(0, -2)) {
          if (ENGLISH_VOWELS.includes(letter)) {
            step1aVowelFound = true;
            break;
          }
        }
        if (step1aVowelFound) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
        }
      }
      break;
    }
  }

  // STEP 1b
  for (const suffix of ENGLISH_STEP1B_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (suffix === "eed" || suffix === "eedly") {
        if (r1.endsWith(suffix)) {
          word = suffixReplace(word, suffix, "ee");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ee") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ee") : "";
        }
      } else {
        let step1bVowelFound = false;
        for (const letter of word.slice(0, -suffix.length)) {
          if (ENGLISH_VOWELS.includes(letter)) {
            step1bVowelFound = true;
            break;
          }
        }
        if (step1bVowelFound) {
          word = word.slice(0, -suffix.length);
          r1 = r1.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);

          if (word.endsWith("at") || word.endsWith("bl") || word.endsWith("iz")) {
            word = word + "e";
            r1 = r1 + "e";
            if (word.length > 5 || r1.length >= 3) {
              r2 = r2 + "e";
            }
          } else if (endsWithAny(word, ENGLISH_DOUBLE_CONSONANTS)) {
            word = word.slice(0, -1);
            r1 = r1.slice(0, -1);
            r2 = r2.slice(0, -1);
          } else if (
            (r1 === "" &&
              word.length >= 3 &&
              !ENGLISH_VOWELS.includes(word[word.length - 1]!) &&
              !"wxY".includes(word[word.length - 1]!) &&
              ENGLISH_VOWELS.includes(word[word.length - 2]!) &&
              !ENGLISH_VOWELS.includes(word[word.length - 3]!)) ||
            (r1 === "" &&
              word.length === 2 &&
              ENGLISH_VOWELS.includes(word[0]!) &&
              !ENGLISH_VOWELS.includes(word[1]!))
          ) {
            word = word + "e";
            if (r1.length > 0) {
              r1 = r1 + "e";
            }
            if (r2.length > 0) {
              r2 = r2 + "e";
            }
          }
        }
      }
      break;
    }
  }

  // STEP 1c
  if (
    word.length > 2 &&
    (word.endsWith("y") || word.endsWith("Y")) &&
    !ENGLISH_VOWELS.includes(at(word, -2))
  ) {
    word = word.slice(0, -1) + "i";
    r1 = r1.length >= 1 ? r1.slice(0, -1) + "i" : "";
    r2 = r2.length >= 1 ? r2.slice(0, -1) + "i" : "";
  }

  // STEP 2
  for (const suffix of ENGLISH_STEP2_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.endsWith(suffix)) {
        if (suffix === "tional") {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        } else if (suffix === "enci" || suffix === "anci" || suffix === "abli") {
          word = word.slice(0, -1) + "e";
          r1 = r1.length >= 1 ? r1.slice(0, -1) + "e" : "";
          r2 = r2.length >= 1 ? r2.slice(0, -1) + "e" : "";
        } else if (suffix === "entli") {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        } else if (suffix === "izer" || suffix === "ization") {
          word = suffixReplace(word, suffix, "ize");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ize") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ize") : "";
        } else if (
          suffix === "ational" || suffix === "ation" || suffix === "ator"
        ) {
          word = suffixReplace(word, suffix, "ate");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ate") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ate") : "e";
        } else if (suffix === "alism" || suffix === "aliti" || suffix === "alli") {
          word = suffixReplace(word, suffix, "al");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "al") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "al") : "";
        } else if (suffix === "fulness") {
          word = word.slice(0, -4);
          r1 = r1.slice(0, -4);
          r2 = r2.slice(0, -4);
        } else if (suffix === "ousli" || suffix === "ousness") {
          word = suffixReplace(word, suffix, "ous");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ous") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ous") : "";
        } else if (suffix === "iveness" || suffix === "iviti") {
          word = suffixReplace(word, suffix, "ive");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ive") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ive") : "e";
        } else if (suffix === "biliti" || suffix === "bli") {
          word = suffixReplace(word, suffix, "ble");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ble") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ble") : "";
        } else if (suffix === "ogi" && at(word, -4) === "l") {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
        } else if (suffix === "fulli" || suffix === "lessli") {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        } else if (suffix === "li" && ENGLISH_LI_ENDING.includes(at(word, -3))) {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        }
      }
      break;
    }
  }

  // STEP 3
  for (const suffix of ENGLISH_STEP3_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.endsWith(suffix)) {
        if (suffix === "tional") {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        } else if (suffix === "ational") {
          word = suffixReplace(word, suffix, "ate");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ate") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ate") : "";
        } else if (suffix === "alize") {
          word = word.slice(0, -3);
          r1 = r1.slice(0, -3);
          r2 = r2.slice(0, -3);
        } else if (suffix === "icate" || suffix === "iciti" || suffix === "ical") {
          word = suffixReplace(word, suffix, "ic");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ic") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ic") : "";
        } else if (suffix === "ful" || suffix === "ness") {
          word = word.slice(0, -suffix.length);
          r1 = r1.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
        } else if (suffix === "ative" && r2.endsWith(suffix)) {
          word = word.slice(0, -5);
          r1 = r1.slice(0, -5);
          r2 = r2.slice(0, -5);
        }
      }
      break;
    }
  }

  // STEP 4
  for (const suffix of ENGLISH_STEP4_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r2.endsWith(suffix)) {
        if (suffix === "ion") {
          if ("st".includes(at(word, -4))) {
            word = word.slice(0, -3);
            r1 = r1.slice(0, -3);
            r2 = r2.slice(0, -3);
          }
        } else {
          word = word.slice(0, -suffix.length);
          r1 = r1.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  // STEP 5
  if (r2.endsWith("l") && at(word, -2) === "l") {
    word = word.slice(0, -1);
  } else if (r2.endsWith("e")) {
    word = word.slice(0, -1);
  } else if (r1.endsWith("e")) {
    if (
      word.length >= 4 &&
      (ENGLISH_VOWELS.includes(at(word, -2)) ||
        "wxY".includes(at(word, -2)) ||
        !ENGLISH_VOWELS.includes(at(word, -3)) ||
        ENGLISH_VOWELS.includes(at(word, -4)))
    ) {
      word = word.slice(0, -1);
    }
  }

  word = word.replace(/Y/g, "y");

  return word;
}

// ---------------------------------------------------------------------------
// French
// ---------------------------------------------------------------------------

const FRENCH_VOWELS = "aeiouyâàëéêèïîôûù";
const FRENCH_STEP1_SUFFIXES = [
  "issements", "issement", "atrices", "atrice", "ateurs", "ations", "logies",
  "usions", "utions", "ements", "amment", "emment", "ances", "iqUes", "ismes",
  "ables", "istes", "ateur", "ation", "logie", "usion", "ution", "ences",
  "ement", "euses", "ments", "ance", "iqUe", "isme", "able", "iste", "ence",
  "ités", "ives", "eaux", "euse", "ment", "eux", "ité", "ive", "ifs", "aux",
  "if",
];
const FRENCH_STEP2A_SUFFIXES = [
  "issaIent", "issantes", "iraIent", "issante", "issants", "issions", "irions",
  "issais", "issait", "issant", "issent", "issiez", "issons", "irais", "irait",
  "irent", "iriez", "irons", "iront", "isses", "issez", "êmes", "êtes", "irai",
  "iras", "irez", "isse", "ies", "ira", "êt", "ie", "ir", "is", "it", "i",
];
const FRENCH_STEP2B_SUFFIXES = [
  "eraIent", "assions", "erions", "assent", "assiez", "èrent", "erais",
  "erait", "eriez", "erons", "eront", "aIent", "antes", "asses", "ions",
  "erai", "eras", "erez", "âmes", "âtes", "ante", "ants", "asse", "ées",
  "era", "iez", "ais", "ait", "ant", "ée", "és", "er", "ez", "ât", "ai",
  "as", "é", "a",
];
const FRENCH_STEP4_SUFFIXES = ["ière", "Ière", "ion", "ier", "Ier", "e", "ë"];

function rvFrench(word: string, vowels: string): string {
  let rv = "";
  if (word.length >= 2) {
    if (
      word.startsWith("par") ||
      word.startsWith("col") ||
      word.startsWith("tap") ||
      (vowels.includes(word[0]!) && vowels.includes(word[1]!))
    ) {
      rv = word.slice(3);
    } else {
      for (let i = 1; i < word.length; i++) {
        if (vowels.includes(word[i]!)) {
          rv = word.slice(i + 1);
          break;
        }
      }
    }
  }
  return rv;
}

export function stemFrench(input: string): string {
  let word = input.toLowerCase();
  let step1Success = false;
  let rvEndingFound = false;
  let step2aSuccess = false;
  let step2bSuccess = false;

  // Every occurrence of 'u' after 'q' is put into upper case.
  for (let i = 1; i < word.length; i++) {
    if (word[i - 1] === "q" && word[i] === "u") {
      word = word.slice(0, i) + "U" + word.slice(i + 1);
    }
  }

  // Every occurrence of 'u' and 'i' between vowels is put into upper case.
  // Every occurrence of 'y' preceded or followed by a vowel is also put
  // into upper case.
  for (let i = 1; i < word.length - 1; i++) {
    if (FRENCH_VOWELS.includes(word[i - 1]!) && FRENCH_VOWELS.includes(word[i + 1]!)) {
      if (word[i] === "u") {
        word = word.slice(0, i) + "U" + word.slice(i + 1);
      } else if (word[i] === "i") {
        word = word.slice(0, i) + "I" + word.slice(i + 1);
      }
    }
    if (FRENCH_VOWELS.includes(word[i - 1]!) || FRENCH_VOWELS.includes(word[i + 1]!)) {
      if (word[i] === "y") {
        word = word.slice(0, i) + "Y" + word.slice(i + 1);
      }
    }
  }

  const std = r1r2Standard(word, FRENCH_VOWELS);
  const r1 = std.r1;
  const r2 = std.r2;
  let rv = rvFrench(word, FRENCH_VOWELS);

  // STEP 1: Standard suffix removal
  for (const suffix of FRENCH_STEP1_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (suffix === "eaux") {
        word = word.slice(0, -1);
        step1Success = true;
      } else if (suffix === "euse" || suffix === "euses") {
        if (r2.includes(suffix)) {
          word = word.slice(0, -suffix.length);
          step1Success = true;
        } else if (r1.includes(suffix)) {
          word = suffixReplace(word, suffix, "eux");
          step1Success = true;
        }
      } else if ((suffix === "ement" || suffix === "ements") && rv.includes(suffix)) {
        word = word.slice(0, -suffix.length);
        step1Success = true;

        if (word.slice(-2) === "iv" && r2.includes("iv")) {
          word = word.slice(0, -2);
          if (word.slice(-2) === "at" && r2.includes("at")) {
            word = word.slice(0, -2);
          }
        } else if (word.slice(-3) === "eus") {
          if (r2.includes("eus")) {
            word = word.slice(0, -3);
          } else if (r1.includes("eus")) {
            word = word.slice(0, -1) + "x";
          }
        } else if (word.slice(-3) === "abl" || word.slice(-3) === "iqU") {
          if (r2.includes("abl") || r2.includes("iqU")) {
            word = word.slice(0, -3);
          }
        } else if (word.slice(-3) === "ièr" || word.slice(-3) === "Ièr") {
          if (rv.includes("ièr") || rv.includes("Ièr")) {
            word = word.slice(0, -3) + "i";
          }
        }
      } else if (suffix === "amment" && rv.includes(suffix)) {
        word = suffixReplace(word, "amment", "ant");
        rv = suffixReplace(rv, "amment", "ant");
        rvEndingFound = true;
      } else if (suffix === "emment" && rv.includes(suffix)) {
        word = suffixReplace(word, "emment", "ent");
        rvEndingFound = true;
      } else if (
        (suffix === "ment" || suffix === "ments") &&
        rv.includes(suffix) &&
        !rv.startsWith(suffix) &&
        FRENCH_VOWELS.includes(rv[rv.lastIndexOf(suffix) - 1]!)
      ) {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        rvEndingFound = true;
      } else if (suffix === "aux" && r1.includes(suffix)) {
        word = word.slice(0, -2) + "l";
        step1Success = true;
      } else if (
        (suffix === "issement" || suffix === "issements") &&
        r1.includes(suffix) &&
        !FRENCH_VOWELS.includes(at(word, -suffix.length - 1))
      ) {
        word = word.slice(0, -suffix.length);
        step1Success = true;
      } else if (
        [
          "ance", "iqUe", "isme", "able", "iste", "eux", "ances", "iqUes",
          "ismes", "ables", "istes",
        ].includes(suffix) &&
        r2.includes(suffix)
      ) {
        word = word.slice(0, -suffix.length);
        step1Success = true;
      } else if (
        ["atrice", "ateur", "ation", "atrices", "ateurs", "ations"].includes(suffix) &&
        r2.includes(suffix)
      ) {
        word = word.slice(0, -suffix.length);
        step1Success = true;

        if (word.slice(-2) === "ic") {
          if (r2.includes("ic")) {
            word = word.slice(0, -2);
          } else {
            word = word.slice(0, -2) + "iqU";
          }
        }
      } else if ((suffix === "logie" || suffix === "logies") && r2.includes(suffix)) {
        word = suffixReplace(word, suffix, "log");
        step1Success = true;
      } else if (
        ["usion", "ution", "usions", "utions"].includes(suffix) &&
        r2.includes(suffix)
      ) {
        word = suffixReplace(word, suffix, "u");
        step1Success = true;
      } else if ((suffix === "ence" || suffix === "ences") && r2.includes(suffix)) {
        word = suffixReplace(word, suffix, "ent");
        step1Success = true;
      } else if ((suffix === "ité" || suffix === "ités") && r2.includes(suffix)) {
        word = word.slice(0, -suffix.length);
        step1Success = true;

        if (word.slice(-4) === "abil") {
          if (r2.includes("abil")) {
            word = word.slice(0, -4);
          } else {
            word = word.slice(0, -2) + "l";
          }
        } else if (word.slice(-2) === "ic") {
          if (r2.includes("ic")) {
            word = word.slice(0, -2);
          } else {
            word = word.slice(0, -2) + "iqU";
          }
        } else if (word.slice(-2) === "iv") {
          if (r2.includes("iv")) {
            word = word.slice(0, -2);
          }
        }
      } else if (
        ["if", "ive", "ifs", "ives"].includes(suffix) &&
        r2.includes(suffix)
      ) {
        word = word.slice(0, -suffix.length);
        step1Success = true;

        if (word.slice(-2) === "at" && r2.includes("at")) {
          word = word.slice(0, -2);
          if (word.slice(-2) === "ic") {
            if (r2.includes("ic")) {
              word = word.slice(0, -2);
            } else {
              word = word.slice(0, -2) + "iqU";
            }
          }
        }
      }
      break;
    }
  }

  // STEP 2a: Verb suffixes beginning 'i'
  if (!step1Success || rvEndingFound) {
    for (const suffix of FRENCH_STEP2A_SUFFIXES) {
      if (word.endsWith(suffix)) {
        if (
          rv.includes(suffix) &&
          rv.length > suffix.length &&
          !FRENCH_VOWELS.includes(rv[rv.lastIndexOf(suffix) - 1]!)
        ) {
          word = word.slice(0, -suffix.length);
          step2aSuccess = true;
        }
        break;
      }
    }

    // STEP 2b: Other verb suffixes
    if (!step2aSuccess) {
      for (const suffix of FRENCH_STEP2B_SUFFIXES) {
        if (rv.endsWith(suffix)) {
          if (suffix === "ions" && r2.includes("ions")) {
            word = word.slice(0, -4);
            step2bSuccess = true;
          } else if (
            [
              "eraIent", "erions", "èrent", "erais", "erait", "eriez", "erons",
              "eront", "erai", "eras", "erez", "ées", "era", "iez", "ée", "és",
              "er", "ez", "é",
            ].includes(suffix)
          ) {
            word = word.slice(0, -suffix.length);
            step2bSuccess = true;
          } else if (
            [
              "assions", "assent", "assiez", "aIent", "antes", "asses", "âmes",
              "âtes", "ante", "ants", "asse", "ais", "ait", "ant", "ât", "ai",
              "as", "a",
            ].includes(suffix)
          ) {
            word = word.slice(0, -suffix.length);
            rv = rv.slice(0, -suffix.length);
            step2bSuccess = true;
            if (rv.endsWith("e")) {
              word = word.slice(0, -1);
            }
          }
          break;
        }
      }
    }
  }

  // STEP 3
  if (step1Success || step2aSuccess || step2bSuccess) {
    if (word.endsWith("Y")) {
      word = word.slice(0, -1) + "i";
    } else if (word.endsWith("ç")) {
      word = word.slice(0, -1) + "c";
    }
  } else {
    // STEP 4: Residual suffixes
    if (word.length >= 2 && word.endsWith("s") && !"aiouès".includes(at(word, -2))) {
      word = word.slice(0, -1);
    }

    for (const suffix of FRENCH_STEP4_SUFFIXES) {
      if (word.endsWith(suffix)) {
        if (rv.includes(suffix)) {
          if (suffix === "ion" && r2.includes(suffix) && "st".includes(at(rv, -4))) {
            word = word.slice(0, -3);
          } else if (
            suffix === "ier" || suffix === "ière" || suffix === "Ier" || suffix === "Ière"
          ) {
            word = suffixReplace(word, suffix, "i");
          } else if (suffix === "e") {
            word = word.slice(0, -1);
          } else if (suffix === "ë" && word.slice(-3, -1) === "gu") {
            word = word.slice(0, -1);
          }
          break;
        }
      }
    }
  }

  // STEP 5: Undouble
  if (endsWithAny(word, ["enn", "onn", "ett", "ell", "eill"])) {
    word = word.slice(0, -1);
  }

  // STEP 6: Un-accent
  for (let i = 1; i < word.length; i++) {
    if (!FRENCH_VOWELS.includes(at(word, -i))) {
      continue;
    } else {
      if (i !== 1 && (at(word, -i) === "é" || at(word, -i) === "è")) {
        word = word.slice(0, -i) + "e" + word.slice(word.length - i + 1);
      }
      break;
    }
  }

  word = word.replace(/I/g, "i").replace(/U/g, "u").replace(/Y/g, "y");

  return word;
}

// ---------------------------------------------------------------------------
// German
// ---------------------------------------------------------------------------

const GERMAN_VOWELS = "aeiouyäöü";
const GERMAN_S_ENDING = "bdfghklmnrt";
const GERMAN_ST_ENDING = "bdfghklmnt";
const GERMAN_STEP1_SUFFIXES = ["ern", "em", "er", "en", "es", "e", "s"];
const GERMAN_STEP2_SUFFIXES = ["est", "en", "er", "st"];
const GERMAN_STEP3_SUFFIXES = ["isch", "lich", "heit", "keit", "end", "ung", "ig", "ik"];

export function stemGerman(input: string): string {
  let word = input.toLowerCase();
  word = word.replace(/ß/g, "ss");

  // Every occurrence of 'u' and 'y' between vowels is put into upper case.
  for (let i = 1; i < word.length - 1; i++) {
    if (GERMAN_VOWELS.includes(word[i - 1]!) && GERMAN_VOWELS.includes(word[i + 1]!)) {
      if (word[i] === "u") {
        word = word.slice(0, i) + "U" + word.slice(i + 1);
      } else if (word[i] === "y") {
        word = word.slice(0, i) + "Y" + word.slice(i + 1);
      }
    }
  }

  let { r1, r2 } = r1r2Standard(word, GERMAN_VOWELS);

  // R1 is adjusted so that the region before it contains at least 3 letters.
  for (let i = 1; i < word.length; i++) {
    if (!GERMAN_VOWELS.includes(word[i]!) && GERMAN_VOWELS.includes(word[i - 1]!)) {
      const prefixLen = i + 1;
      if (prefixLen > 0 && prefixLen < 3) {
        r1 = word.slice(3);
      } else if (prefixLen === 0) {
        return finishGerman(word);
      }
      break;
    }
  }

  // STEP 1
  for (const suffix of GERMAN_STEP1_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (
        (suffix === "en" || suffix === "es" || suffix === "e") &&
        word.slice(-(suffix.length + 4), -suffix.length) === "niss"
      ) {
        word = word.slice(0, -(suffix.length + 1));
        r1 = r1.slice(0, -(suffix.length + 1));
        r2 = r2.slice(0, -(suffix.length + 1));
      } else if (suffix === "s") {
        if (GERMAN_S_ENDING.includes(at(word, -2))) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
        }
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 2
  for (const suffix of GERMAN_STEP2_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "st") {
        if (GERMAN_ST_ENDING.includes(at(word, -3)) && word.slice(0, -3).length >= 3) {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        }
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 3: Derivational suffixes
  for (const suffix of GERMAN_STEP3_SUFFIXES) {
    if (r2.endsWith(suffix)) {
      if (suffix === "end" || suffix === "ung") {
        if (
          r2.slice(-(suffix.length + 2), -suffix.length).includes("ig") &&
          !r2.slice(-(suffix.length + 3), -(suffix.length + 2)).includes("e")
        ) {
          word = word.slice(0, -(suffix.length + 2));
        } else {
          word = word.slice(0, -suffix.length);
        }
      } else if (
        (suffix === "ig" || suffix === "ik" || suffix === "isch") &&
        !r2.slice(-(suffix.length + 1), -suffix.length).includes("e")
      ) {
        word = word.slice(0, -suffix.length);
      } else if (suffix === "lich" || suffix === "heit") {
        if (
          r1.slice(-(suffix.length + 2), -suffix.length).includes("er") ||
          r1.slice(-(suffix.length + 2), -suffix.length).includes("en")
        ) {
          word = word.slice(0, -(suffix.length + 2));
        } else {
          word = word.slice(0, -suffix.length);
        }
      } else if (suffix === "keit") {
        if (r2.slice(-(suffix.length + 4), -suffix.length).includes("lich")) {
          word = word.slice(0, -(suffix.length + 4));
        } else if (r2.slice(-(suffix.length + 2), -suffix.length).includes("ig")) {
          word = word.slice(0, -(suffix.length + 2));
        } else {
          word = word.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  return finishGerman(word);
}

function finishGerman(word: string): string {
  // Umlaut accents are removed and 'u' and 'y' are put back into lower case.
  return word
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/U/g, "u")
    .replace(/Y/g, "y");
}

// ---------------------------------------------------------------------------
// Italian
// ---------------------------------------------------------------------------

const ITALIAN_VOWELS = "aeiouàèìòù";
const ITALIAN_STEP0_SUFFIXES = [
  "gliela", "gliele", "glieli", "glielo", "gliene", "sene", "mela", "mele",
  "meli", "melo", "mene", "tela", "tele", "teli", "telo", "tene", "cela",
  "cele", "celi", "celo", "cene", "vela", "vele", "veli", "velo", "vene",
  "gli", "ci", "la", "le", "li", "lo", "mi", "ne", "si", "ti", "vi",
];
const ITALIAN_STEP1_SUFFIXES = [
  "atrice", "atrici", "azione", "azioni", "uzione", "uzioni", "usione",
  "usioni", "amento", "amenti", "imento", "imenti", "amente", "abile",
  "abili", "ibile", "ibili", "mente", "atore", "atori", "logia", "logie",
  "anza", "anze", "iche", "ichi", "ismo", "ismi", "ista", "iste", "isti",
  "istà", "istè", "istì", "ante", "anti", "enza", "enze", "ico", "ici",
  "ica", "ice", "oso", "osi", "osa", "ose", "ità", "ivo", "ivi", "iva", "ive",
];
const ITALIAN_STEP2_SUFFIXES = [
  "erebbero", "irebbero", "assero", "assimo", "eranno", "erebbe", "eremmo",
  "ereste", "eresti", "essero", "iranno", "irebbe", "iremmo", "ireste",
  "iresti", "iscano", "iscono", "issero", "arono", "avamo", "avano", "avate",
  "eremo", "erete", "erono", "evamo", "evano", "evate", "iremo", "irete",
  "irono", "ivamo", "ivano", "ivate", "ammo", "ando", "asse", "assi", "emmo",
  "enda", "ende", "endi", "endo", "erai", "erei", "Yamo", "iamo", "immo",
  "irai", "irei", "isca", "isce", "isci", "isco", "ano", "are", "ata", "ate",
  "ati", "ato", "ava", "avi", "avo", "erà", "ere", "erò", "ete", "eva", "evi",
  "evo", "irà", "ire", "irò", "ita", "ite", "iti", "ito", "iva", "ivi", "ivo",
  "ono", "uta", "ute", "uti", "uto", "ar", "ir",
];

export function stemItalian(input: string): string {
  let word = input.toLowerCase();
  let step1Success = false;

  // All acute accents are replaced by grave accents.
  word = word
    .replace(/á/g, "à")
    .replace(/é/g, "è")
    .replace(/í/g, "ì")
    .replace(/ó/g, "ò")
    .replace(/ú/g, "ù");

  // Every occurrence of 'u' after 'q' is put into upper case.
  for (let i = 1; i < word.length; i++) {
    if (word[i - 1] === "q" && word[i] === "u") {
      word = word.slice(0, i) + "U" + word.slice(i + 1);
    }
  }

  // Every occurrence of 'u' and 'i' between vowels is put into upper case.
  for (let i = 1; i < word.length - 1; i++) {
    if (ITALIAN_VOWELS.includes(word[i - 1]!) && ITALIAN_VOWELS.includes(word[i + 1]!)) {
      if (word[i] === "u") {
        word = word.slice(0, i) + "U" + word.slice(i + 1);
      } else if (word[i] === "i") {
        word = word.slice(0, i) + "I" + word.slice(i + 1);
      }
    }
  }

  const std = r1r2Standard(word, ITALIAN_VOWELS);
  let r1 = std.r1;
  let r2 = std.r2;
  let rv = rvStandard(word, ITALIAN_VOWELS);

  // STEP 0: Attached pronoun
  for (const suffix of ITALIAN_STEP0_SUFFIXES) {
    if (rv.endsWith(suffix)) {
      if (
        ["ando", "endo"].includes(rv.slice(-(suffix.length + 4), -suffix.length))
      ) {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
      } else if (
        ["ar", "er", "ir"].includes(rv.slice(-(suffix.length + 2), -suffix.length))
      ) {
        word = suffixReplace(word, suffix, "e");
        r1 = suffixReplace(r1, suffix, "e");
        r2 = suffixReplace(r2, suffix, "e");
        rv = suffixReplace(rv, suffix, "e");
      }
      break;
    }
  }

  // STEP 1: Standard suffix removal
  for (const suffix of ITALIAN_STEP1_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (suffix === "amente" && r1.endsWith(suffix)) {
        step1Success = true;
        word = word.slice(0, -6);
        r2 = r2.slice(0, -6);
        rv = rv.slice(0, -6);

        if (r2.endsWith("iv")) {
          word = word.slice(0, -2);
          r2 = r2.slice(0, -2);
          rv = rv.slice(0, -2);
          if (r2.endsWith("at")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          }
        } else if (r2.endsWith("os") || r2.endsWith("ic")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        } else if (r2.endsWith("abil")) {
          word = word.slice(0, -4);
          rv = rv.slice(0, -4);
        }
      } else if (
        (suffix === "amento" || suffix === "amenti" || suffix === "imento" || suffix === "imenti") &&
        rv.endsWith(suffix)
      ) {
        step1Success = true;
        word = word.slice(0, -6);
        rv = rv.slice(0, -6);
      } else if (r2.endsWith(suffix)) {
        step1Success = true;
        if (
          suffix === "azione" || suffix === "azioni" ||
          suffix === "atore" || suffix === "atori"
        ) {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          if (r2.endsWith("ic")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          }
        } else if (suffix === "logia" || suffix === "logie") {
          word = word.slice(0, -2);
          rv = word.slice(0, -2);
        } else if (
          suffix === "uzione" || suffix === "uzioni" ||
          suffix === "usione" || suffix === "usioni"
        ) {
          word = word.slice(0, -5);
          rv = rv.slice(0, -5);
        } else if (suffix === "enza" || suffix === "enze") {
          word = suffixReplace(word, suffix, "te");
          rv = suffixReplace(rv, suffix, "te");
        } else if (suffix === "ità") {
          word = word.slice(0, -3);
          r2 = r2.slice(0, -3);
          rv = rv.slice(0, -3);
          if (r2.endsWith("ic") || r2.endsWith("iv")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          } else if (r2.endsWith("abil")) {
            word = word.slice(0, -4);
            rv = rv.slice(0, -4);
          }
        } else if (
          suffix === "ivo" || suffix === "ivi" || suffix === "iva" || suffix === "ive"
        ) {
          word = word.slice(0, -3);
          r2 = r2.slice(0, -3);
          rv = rv.slice(0, -3);
          if (r2.endsWith("at")) {
            word = word.slice(0, -2);
            r2 = r2.slice(0, -2);
            rv = rv.slice(0, -2);
            if (r2.endsWith("ic")) {
              word = word.slice(0, -2);
              rv = rv.slice(0, -2);
            }
          }
        } else {
          word = word.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  // STEP 2: Verb suffixes
  if (!step1Success) {
    for (const suffix of ITALIAN_STEP2_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }
  }

  // STEP 3a
  if (endsWithAny(rv, ["a", "e", "i", "o", "à", "è", "ì", "ò"])) {
    word = word.slice(0, -1);
    rv = rv.slice(0, -1);
    if (rv.endsWith("i")) {
      word = word.slice(0, -1);
      rv = rv.slice(0, -1);
    }
  }

  // STEP 3b
  if (rv.endsWith("ch") || rv.endsWith("gh")) {
    word = word.slice(0, -1);
  }

  word = word.replace(/I/g, "i").replace(/U/g, "u");

  return word;
}

// ---------------------------------------------------------------------------
// Norwegian
// ---------------------------------------------------------------------------

const NORWEGIAN_VOWELS = "aeiouyæåø";
const NORWEGIAN_S_ENDING = "bcdfghjlmnoprtvyz";
const NORWEGIAN_STEP1_SUFFIXES = [
  "hetenes", "hetene", "hetens", "heter", "heten", "endes", "ande", "ende",
  "edes", "enes", "erte", "ede", "ane", "ene", "ens", "ers", "ets", "het",
  "ast", "ert", "en", "ar", "er", "as", "es", "et", "a", "e", "s",
];
const NORWEGIAN_STEP2_SUFFIXES = ["dt", "vt"];
const NORWEGIAN_STEP3_SUFFIXES = [
  "hetslov", "eleg", "elig", "elov", "slov", "leg", "eig", "lig", "els",
  "lov", "ig",
];

export function stemNorwegian(input: string): string {
  let word = input.toLowerCase();
  let r1 = r1Scandinavian(word, NORWEGIAN_VOWELS);

  // STEP 1
  for (const suffix of NORWEGIAN_STEP1_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "erte" || suffix === "ert") {
        word = suffixReplace(word, suffix, "er");
        r1 = suffixReplace(r1, suffix, "er");
      } else if (suffix === "s") {
        if (
          NORWEGIAN_S_ENDING.includes(at(word, -2)) ||
          (at(word, -2) === "k" && !NORWEGIAN_VOWELS.includes(at(word, -3)))
        ) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
        }
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 2
  for (const suffix of NORWEGIAN_STEP2_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      word = word.slice(0, -1);
      r1 = r1.slice(0, -1);
      break;
    }
  }

  // STEP 3
  for (const suffix of NORWEGIAN_STEP3_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      word = word.slice(0, -suffix.length);
      break;
    }
  }

  return word;
}

// ---------------------------------------------------------------------------
// Portuguese
// ---------------------------------------------------------------------------

const PORTUGUESE_VOWELS = "aeiouáéíóúâêô";
const PORTUGUESE_STEP1_SUFFIXES = [
  "amentos", "imentos", "uço~es", "amento", "imento", "adoras", "adores",
  "aço~es", "logias", "ências", "amente", "idades", "anças", "ismos",
  "istas", "adora", "aça~o", "antes", "ância", "logia", "uça~o", "ência",
  "mente", "idade", "ança", "ezas", "icos", "icas", "ismo", "ável", "ível",
  "ista", "osos", "osas", "ador", "ante", "ivas", "ivos", "iras", "eza",
  "ico", "ica", "oso", "osa", "iva", "ivo", "ira",
];
const PORTUGUESE_STEP2_SUFFIXES = [
  "aríamos", "eríamos", "iríamos", "ássemos", "êssemos", "íssemos",
  "ardeis", "erdeis", "irdeis", "ásseis", "ésseis", "ísseis", "áramos",
  "éramos", "íramos", "ávamos", "aremos", "eremos", "iremos", "ariam",
  "eriam", "iriam", "assem", "essem", "issem", "ara~o", "era~o", "ira~o",
  "arias", "erias", "irias", "ardes", "erdes", "irdes", "asses", "esses",
  "isses", "astes", "estes", "istes", "áreis", "areis", "éreis", "ereis",
  "íreis", "ireis", "áveis", "ídamos", "armos", "ermos", "irmos", "aria",
  "eria", "iria", "asse", "esse", "isse", "aste", "este", "iste", "arei",
  "erei", "irei", "aram", "eram", "iram", "avam", "arem", "erem", "irem",
  "ando", "endo", "indo", "adas", "idas", "arás", "aras", "erás", "eras",
  "irás", "avas", "ares", "eres", "ires", "ídeis", "ados", "idos", "ámos",
  "amos", "emos", "imos", "iras", "ada", "ida", "ará", "ara", "erá", "era",
  "irá", "ava", "iam", "ado", "ido", "ias", "ais", "eis", "ira", "ia", "ei",
  "am", "em", "ar", "er", "ir", "as", "es", "is", "eu", "iu", "ou",
];
const PORTUGUESE_STEP4_SUFFIXES = ["os", "a", "i", "o", "á", "í", "ó"];

export function stemPortuguese(input: string): string {
  let word = input.toLowerCase();
  let step1Success = false;
  let step2Success = false;

  word = word
    .replace(/ã/g, "a~")
    .replace(/õ/g, "o~")
    .replace(/qü/g, "qu")
    .replace(/gü/g, "gu");

  const std = r1r2Standard(word, PORTUGUESE_VOWELS);
  const r1 = std.r1;
  let r2 = std.r2;
  let rv = rvStandard(word, PORTUGUESE_VOWELS);

  // STEP 1: Standard suffix removal
  for (const suffix of PORTUGUESE_STEP1_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (suffix === "amente" && r1.endsWith(suffix)) {
        step1Success = true;
        word = word.slice(0, -6);
        r2 = r2.slice(0, -6);
        rv = rv.slice(0, -6);
        if (r2.endsWith("iv")) {
          word = word.slice(0, -2);
          r2 = r2.slice(0, -2);
          rv = rv.slice(0, -2);
          if (r2.endsWith("at")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          }
        } else if (r2.endsWith("os") || r2.endsWith("ic") || r2.endsWith("ad")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        }
      } else if (
        (suffix === "ira" || suffix === "iras") &&
        rv.endsWith(suffix) &&
        word.slice(-(suffix.length + 1), -suffix.length) === "e"
      ) {
        step1Success = true;
        word = suffixReplace(word, suffix, "ir");
        rv = suffixReplace(rv, suffix, "ir");
      } else if (r2.endsWith(suffix)) {
        step1Success = true;
        if (suffix === "logia" || suffix === "logias") {
          word = suffixReplace(word, suffix, "log");
          rv = suffixReplace(rv, suffix, "log");
        } else if (suffix === "uça~o" || suffix === "uço~es") {
          word = suffixReplace(word, suffix, "u");
          rv = suffixReplace(rv, suffix, "u");
        } else if (suffix === "ência" || suffix === "ências") {
          word = suffixReplace(word, suffix, "ente");
          rv = suffixReplace(rv, suffix, "ente");
        } else if (suffix === "mente") {
          word = word.slice(0, -5);
          r2 = r2.slice(0, -5);
          rv = rv.slice(0, -5);
          if (r2.endsWith("ante") || r2.endsWith("avel") || r2.endsWith("ivel")) {
            word = word.slice(0, -4);
            rv = rv.slice(0, -4);
          }
        } else if (suffix === "idade" || suffix === "idades") {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          if (r2.endsWith("ic") || r2.endsWith("iv")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          } else if (r2.endsWith("abil")) {
            word = word.slice(0, -4);
            rv = rv.slice(0, -4);
          }
        } else if (
          suffix === "iva" || suffix === "ivo" || suffix === "ivas" || suffix === "ivos"
        ) {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          if (r2.endsWith("at")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          }
        } else {
          word = word.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  // STEP 2: Verb suffixes
  if (!step1Success) {
    for (const suffix of PORTUGUESE_STEP2_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        step2Success = true;
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }
  }

  // STEP 3
  if (step1Success || step2Success) {
    if (rv.endsWith("i") && at(word, -2) === "c") {
      word = word.slice(0, -1);
      rv = rv.slice(0, -1);
    }
  }

  // STEP 4: Residual suffix
  if (!step1Success && !step2Success) {
    for (const suffix of PORTUGUESE_STEP4_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }
  }

  // STEP 5
  if (rv.endsWith("e") || rv.endsWith("é") || rv.endsWith("ê")) {
    word = word.slice(0, -1);
    rv = rv.slice(0, -1);
    if (
      (word.endsWith("gu") && rv.endsWith("u")) ||
      (word.endsWith("ci") && rv.endsWith("i"))
    ) {
      word = word.slice(0, -1);
    }
  } else if (word.endsWith("ç")) {
    word = suffixReplace(word, "ç", "c");
  }

  word = word.replace(/a~/g, "ã").replace(/o~/g, "õ");

  return word;
}

// ---------------------------------------------------------------------------
// Romanian
// ---------------------------------------------------------------------------

const ROMANIAN_VOWELS = "aeiouăâî";
const ROMANIAN_STEP0_SUFFIXES = [
  "iilor", "ului", "elor", "iile", "ilor", "atei", "aţie", "aţia", "aua",
  "ele", "iua", "iei", "ile", "ul", "ea", "ii",
];
const ROMANIAN_STEP1_SUFFIXES = [
  "abilitate", "abilitati", "abilităţi", "ibilitate", "abilităi", "ivitate",
  "ivitati", "ivităţi", "icitate", "icitati", "icităţi", "icatori",
  "ivităi", "icităi", "icator", "aţiune", "atoare", "ătoare", "iţiune",
  "itoare", "iciva", "icive", "icivi", "icivă", "icala", "icale", "icali",
  "icală", "ativa", "ative", "ativi", "ativă", "atori", "ători", "itiva",
  "itive", "itivi", "itivă", "itori", "iciv", "ical", "ativ", "ator",
  "ător", "itiv", "itor",
];
const ROMANIAN_STEP2_SUFFIXES = [
  "abila", "abile", "abili", "abilă", "ibila", "ibile", "ibili", "ibilă",
  "atori", "itate", "itati", "ităţi", "abil", "ibil", "oasa", "oasă",
  "oase", "anta", "ante", "anti", "antă", "ator", "ităi", "iune", "iuni",
  "isme", "ista", "iste", "isti", "istă", "işti", "ata", "ată", "ati",
  "ate", "uta", "ută", "uti", "ute", "ita", "ită", "iti", "ite", "ica",
  "ice", "ici", "ică", "osi", "oşi", "ant", "iva", "ive", "ivi", "ivă",
  "ism", "ist", "at", "ut", "it", "ic", "os", "iv",
];
const ROMANIAN_STEP3_SUFFIXES = [
  "seserăţi", "aserăţi", "iserăţi", "âserăţi", "userăţi", "seserăm",
  "aserăm", "iserăm", "âserăm", "userăm", "serăţi", "seseşi", "seseră",
  "ească", "arăţi", "urăţi", "irăţi", "ârăţi", "aseşi", "aseră", "iseşi",
  "iseră", "âseşi", "âseră", "useşi", "useră", "serăm", "sesem", "indu",
  "ându", "ează", "eşti", "eşte", "ăşti", "ăşte", "eaţi", "iaţi", "arăm",
  "urăm", "irăm", "ârăm", "asem", "isem", "âsem", "usem", "seşi", "seră",
  "sese", "are", "ere", "ire", "âre", "ind", "ând", "eze", "ezi", "esc",
  "ăsc", "eam", "eai", "eau", "iam", "iai", "iau", "aşi", "ară", "uşi",
  "ură", "işi", "iră", "âşi", "âră", "ase", "ise", "âse", "use", "aţi",
  "eţi", "iţi", "âţi", "sei", "ez", "am", "ai", "au", "ea", "ia", "ui",
  "âi", "ăm", "em", "im", "âm", "se",
];

export function stemRomanian(input: string): string {
  let word = input.toLowerCase();
  let step1Success = false;
  let step2Success = false;

  for (let i = 1; i < word.length - 1; i++) {
    if (ROMANIAN_VOWELS.includes(word[i - 1]!) && ROMANIAN_VOWELS.includes(word[i + 1]!)) {
      if (word[i] === "u") {
        word = word.slice(0, i) + "U" + word.slice(i + 1);
      } else if (word[i] === "i") {
        word = word.slice(0, i) + "I" + word.slice(i + 1);
      }
    }
  }

  const std = r1r2Standard(word, ROMANIAN_VOWELS);
  const r1 = std.r1;
  let r2 = std.r2;
  let rv = rvStandard(word, ROMANIAN_VOWELS);

  // STEP 0: Removal of plurals and other simplifications
  for (const suffix of ROMANIAN_STEP0_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.includes(suffix)) {
        if (suffix === "ul" || suffix === "ului") {
          word = word.slice(0, -suffix.length);
          if (rv.includes(suffix)) {
            rv = rv.slice(0, -suffix.length);
          } else {
            rv = "";
          }
        } else if (
          suffix === "aua" ||
          suffix === "atei" ||
          (suffix === "ile" && word.slice(-5, -3) !== "ab")
        ) {
          word = word.slice(0, -2);
        } else if (suffix === "ea" || suffix === "ele" || suffix === "elor") {
          word = suffixReplace(word, suffix, "e");
          if (rv.includes(suffix)) {
            rv = suffixReplace(rv, suffix, "e");
          } else {
            rv = "";
          }
        } else if (
          suffix === "ii" || suffix === "iua" || suffix === "iei" ||
          suffix === "iile" || suffix === "iilor" || suffix === "ilor"
        ) {
          word = suffixReplace(word, suffix, "i");
          if (rv.includes(suffix)) {
            rv = suffixReplace(rv, suffix, "i");
          } else {
            rv = "";
          }
        } else if (suffix === "aţie" || suffix === "aţia") {
          word = word.slice(0, -1);
        }
      }
      break;
    }
  }

  // STEP 1: Reduction of combining suffixes
  while (true) {
    let replacementDone = false;

    for (const suffix of ROMANIAN_STEP1_SUFFIXES) {
      if (word.endsWith(suffix)) {
        if (r1.includes(suffix)) {
          step1Success = true;
          replacementDone = true;

          if (
            suffix === "abilitate" || suffix === "abilitati" ||
            suffix === "abilităi" || suffix === "abilităţi"
          ) {
            word = suffixReplace(word, suffix, "abil");
          } else if (suffix === "ibilitate") {
            word = word.slice(0, -5);
          } else if (
            suffix === "ivitate" || suffix === "ivitati" ||
            suffix === "ivităi" || suffix === "ivităţi"
          ) {
            word = suffixReplace(word, suffix, "iv");
          } else if (
            suffix === "icitate" || suffix === "icitati" || suffix === "icităţi" ||
            suffix === "icator" || suffix === "icatori" || suffix === "iciv" ||
            suffix === "iciva" || suffix === "icive" || suffix === "icivi" ||
            suffix === "icivă" || suffix === "ical" || suffix === "icala" ||
            suffix === "icale" || suffix === "icali" || suffix === "icală"
          ) {
            word = suffixReplace(word, suffix, "ic");
          } else if (
            suffix === "ativ" || suffix === "ativa" || suffix === "ative" ||
            suffix === "ativi" || suffix === "ativă" || suffix === "aţiune" ||
            suffix === "atoare" || suffix === "ator" || suffix === "atori" ||
            suffix === "ătoare" || suffix === "ător" || suffix === "ători"
          ) {
            word = suffixReplace(word, suffix, "at");
            if (r2.includes(suffix)) {
              r2 = suffixReplace(r2, suffix, "at");
            }
          } else if (
            suffix === "itiv" || suffix === "itiva" || suffix === "itive" ||
            suffix === "itivi" || suffix === "itivă" || suffix === "iţiune" ||
            suffix === "itoare" || suffix === "itor" || suffix === "itori"
          ) {
            word = suffixReplace(word, suffix, "it");
            if (r2.includes(suffix)) {
              r2 = suffixReplace(r2, suffix, "it");
            }
          }
        } else {
          step1Success = false;
        }
        break;
      }
    }

    if (!replacementDone) {
      break;
    }
  }

  // STEP 2: Removal of standard suffixes
  for (const suffix of ROMANIAN_STEP2_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r2.includes(suffix)) {
        step2Success = true;
        if (suffix === "iune" || suffix === "iuni") {
          if (at(word, -5) === "ţ") {
            word = word.slice(0, -5) + "t";
          }
        } else if (
          suffix === "ism" || suffix === "isme" || suffix === "ist" ||
          suffix === "ista" || suffix === "iste" || suffix === "isti" ||
          suffix === "istă" || suffix === "işti"
        ) {
          word = suffixReplace(word, suffix, "ist");
        } else {
          word = word.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  // STEP 3: Removal of verb suffixes
  if (!step1Success && !step2Success) {
    for (const suffix of ROMANIAN_STEP3_SUFFIXES) {
      if (word.endsWith(suffix)) {
        if (rv.includes(suffix)) {
          if (
            [
              "seserăţi", "seserăm", "serăţi", "seseşi", "seseră", "serăm",
              "sesem", "seşi", "seră", "sese", "aţi", "eţi", "iţi", "âţi",
              "sei", "ăm", "em", "im", "âm", "se",
            ].includes(suffix)
          ) {
            word = word.slice(0, -suffix.length);
            rv = rv.slice(0, -suffix.length);
          } else {
            if (
              !rv.startsWith(suffix) &&
              !"aeioăâî".includes(rv[rv.indexOf(suffix) - 1]!)
            ) {
              word = word.slice(0, -suffix.length);
            }
          }
          break;
        }
      }
    }
  }

  // STEP 4: Removal of final vowel
  for (const suffix of ["ie", "a", "e", "i", "ă"]) {
    if (word.endsWith(suffix)) {
      if (rv.includes(suffix)) {
        word = word.slice(0, -suffix.length);
      }
      break;
    }
  }

  word = word.replace(/I/g, "i").replace(/U/g, "u");

  return word;
}

// ---------------------------------------------------------------------------
// Russian
// ---------------------------------------------------------------------------

const RUSSIAN_PERFECTIVE_GERUND_SUFFIXES = [
  "ivshis'", "yvshis'", "vshis'", "ivshi", "yvshi", "vshi", "iv", "yv", "v",
];
const RUSSIAN_ADJECTIVAL_SUFFIXES = [
  "ui^ushchi^ui^u", "ui^ushchi^ai^a", "ui^ushchimi", "ui^ushchymi",
  "ui^ushchego", "ui^ushchogo", "ui^ushchemu", "ui^ushchomu",
  "ui^ushchikh", "ui^ushchykh", "ui^ushchui^u", "ui^ushchaia",
  "ui^ushchoi^u", "ui^ushchei^u", "i^ushchi^ui^u", "i^ushchi^ai^a",
  "ui^ushchee", "ui^ushchie", "ui^ushchye", "ui^ushchoe", "ui^ushchei`",
  "ui^ushchii`", "ui^ushchyi`", "ui^ushchoi`", "ui^ushchem", "ui^ushchim",
  "ui^ushchym", "ui^ushchom", "i^ushchimi", "i^ushchymi", "i^ushchego",
  "i^ushchogo", "i^ushchemu", "i^ushchomu", "i^ushchikh", "i^ushchykh",
  "i^ushchui^u", "i^ushchai^a", "i^ushchoi^u", "i^ushchei^u", "i^ushchee",
  "i^ushchie", "i^ushchye", "i^ushchoe", "i^ushchei`", "i^ushchii`",
  "i^ushchyi`", "i^ushchoi`", "i^ushchem", "i^ushchim", "i^ushchym",
  "i^ushchom", "shchi^ui^u", "shchi^ai^a", "ivshi^ui^u", "ivshi^ai^a",
  "yvshi^ui^u", "yvshi^ai^a", "shchimi", "shchymi", "shchego", "shchogo",
  "shchemu", "shchomu", "shchikh", "shchykh", "shchui^u", "shchai^a",
  "shchoi^u", "shchei^u", "ivshimi", "ivshymi", "ivshego", "ivshogo",
  "ivshemu", "ivshomu", "ivshikh", "ivshykh", "ivshui^u", "ivshai^a",
  "ivshoi^u", "ivshei^u", "yvshimi", "yvshymi", "yvshego", "yvshogo",
  "yvshemu", "yvshomu", "yvshikh", "yvshykh", "yvshui^u", "yvshai^a",
  "yvshoi^u", "yvshei^u", "vshi^ui^u", "vshi^ai^a", "shchee", "shchie",
  "shchye", "shchoe", "shchei`", "shchii`", "shchyi`", "shchoi`", "shchem",
  "shchim", "shchym", "shchom", "ivshee", "ivshie", "ivshye", "ivshoe",
  "ivshei`", "ivshii`", "ivshyi`", "ivshoi`", "ivshem", "ivshim", "ivshym",
  "ivshom", "yvshee", "yvshie", "yvshye", "yvshoe", "yvshei`", "yvshii`",
  "yvshyi`", "yvshoi`", "yvshem", "yvshim", "yvshym", "yvshom", "vshimi",
  "vshymi", "vshego", "vshogo", "vshemu", "vshomu", "vshikh", "vshykh",
  "vshui^u", "vshai^a", "vshoi^u", "vshei^u", "emi^ui^u", "emi^ai^a",
  "nni^ui^u", "nni^ai^a", "vshee", "vshie", "vshye", "vshoe", "vshei`",
  "vshii`", "vshyi`", "vshoi`", "vshem", "vshim", "vshym", "vshom", "emimi",
  "emymi", "emego", "emogo", "ememu", "emomu", "emikh", "emykh", "emui^u",
  "emai^a", "emoi^u", "emei^u", "nnimi", "nnymi", "nnego", "nnogo", "nnemu",
  "nnomu", "nnikh", "nnykh", "nnui^u", "nnai^a", "nnoi^u", "nnei^u", "emee",
  "emie", "emye", "emoe", "emei`", "emii`", "emyi`", "emoi`", "emem", "emim",
  "emym", "emom", "nnee", "nnie", "nnye", "nnoe", "nnei`", "nnii`", "nnyi`",
  "nnoi`", "nnem", "nnim", "nnym", "nnom", "i^ui^u", "i^ai^a", "imi", "ymi",
  "ego", "ogo", "emu", "omu", "ikh", "ykh", "ui^u", "ai^a", "oi^u", "ei^u",
  "ee", "ie", "ye", "oe", "ei`", "ii`", "yi`", "oi`", "em", "im", "ym", "om",
];
const RUSSIAN_ADJECTIVAL_A_CHECK = new Set([
  "i^ushchi^ui^u", "i^ushchi^ai^a", "i^ushchui^u", "i^ushchai^a",
  "i^ushchoi^u", "i^ushchei^u", "i^ushchimi", "i^ushchymi", "i^ushchego",
  "i^ushchogo", "i^ushchemu", "i^ushchomu", "i^ushchikh", "i^ushchykh",
  "shchi^ui^u", "shchi^ai^a", "i^ushchee", "i^ushchie", "i^ushchye",
  "i^ushchoe", "i^ushchei`", "i^ushchii`", "i^ushchyi`", "i^ushchoi`",
  "i^ushchem", "i^ushchim", "i^ushchym", "i^ushchom", "vshi^ui^u",
  "vshi^ai^a", "shchui^u", "shchai^a", "shchoi^u", "shchei^u", "emi^ui^u",
  "emi^ai^a", "nni^ui^u", "nni^ai^a", "shchimi", "shchymi", "shchego",
  "shchogo", "shchemu", "shchomu", "shchikh", "shchykh", "vshui^u",
  "vshai^a", "vshoi^u", "vshei^u", "shchee", "shchie", "shchye", "shchoe",
  "shchei`", "shchii`", "shchyi`", "shchoi`", "shchem", "shchim", "shchym",
  "shchom", "vshimi", "vshymi", "vshego", "vshogo", "vshemu", "vshomu",
  "vshikh", "vshykh", "emui^u", "emai^a", "emoi^u", "emei^u", "nnui^u",
  "nnai^a", "nnoi^u", "nnei^u", "vshee", "vshie", "vshye", "vshoe",
  "vshei`", "vshii`", "vshyi`", "vshoi`", "vshem", "vshim", "vshym",
  "vshom", "emimi", "emymi", "emego", "emogo", "ememu", "emomu", "emikh",
  "emykh", "nnimi", "nnymi", "nnego", "nnogo", "nnemu", "nnomu", "nnikh",
  "nnykh", "emee", "emie", "emye", "emoe", "emei`", "emii`", "emyi`",
  "emoi`", "emem", "emim", "emym", "emom", "nnee", "nnie", "nnye", "nnoe",
  "nnei`", "nnii`", "nnyi`", "nnoi`", "nnem", "nnim", "nnym", "nnom",
]);
const RUSSIAN_REFLEXIVE_SUFFIXES = ["si^a", "s'"];
const RUSSIAN_VERB_SUFFIXES = [
  "esh'", "ei`te", "ui`te", "ui^ut", "ish'", "ete", "i`te", "i^ut", "nno",
  "ila", "yla", "ena", "ite", "ili", "yli", "ilo", "ylo", "eno", "i^at",
  "uet", "eny", "it'", "yt'", "ui^u", "la", "na", "li", "em", "lo", "no",
  "et", "ny", "t'", "ei`", "ui`", "il", "yl", "im", "ym", "en", "it", "yt",
  "i^u", "i`", "l", "n",
];
const RUSSIAN_VERB_A_CHECK = new Set([
  "la", "na", "ete", "i`te", "li", "i`", "l", "em", "n", "lo", "no", "et",
  "i^ut", "ny", "t'", "esh'", "nno",
]);
const RUSSIAN_NOUN_SUFFIXES = [
  "ii^ami", "ii^akh", "i^ami", "ii^am", "i^akh", "ami", "iei`", "i^am",
  "iem", "akh", "ii^u", "'i^u", "ii^a", "'i^a", "ev", "ov", "ie", "'e",
  "ei", "ii", "ei`", "oi`", "ii`", "em", "am", "om", "i^u", "i^a", "a",
  "e", "i", "i`", "o", "u", "y", "'",
];
const RUSSIAN_SUPERLATIVE_SUFFIXES = ["ei`she", "ei`sh"];
const RUSSIAN_DERIVATIONAL_SUFFIXES = ["ost'", "ost"];

function cyrillicToRoman(word: string): string {
  return word
    .replace(/А/g, "a").replace(/а/g, "a")
    .replace(/Б/g, "b").replace(/б/g, "b")
    .replace(/В/g, "v").replace(/в/g, "v")
    .replace(/Г/g, "g").replace(/г/g, "g")
    .replace(/Д/g, "d").replace(/д/g, "d")
    .replace(/Е/g, "e").replace(/е/g, "e")
    .replace(/Ё/g, "e").replace(/ё/g, "e")
    .replace(/Ж/g, "zh").replace(/ж/g, "zh")
    .replace(/З/g, "z").replace(/з/g, "z")
    .replace(/И/g, "i").replace(/и/g, "i")
    .replace(/Й/g, "i`").replace(/й/g, "i`")
    .replace(/К/g, "k").replace(/к/g, "k")
    .replace(/Л/g, "l").replace(/л/g, "l")
    .replace(/М/g, "m").replace(/м/g, "m")
    .replace(/Н/g, "n").replace(/н/g, "n")
    .replace(/О/g, "o").replace(/о/g, "o")
    .replace(/П/g, "p").replace(/п/g, "p")
    .replace(/Р/g, "r").replace(/р/g, "r")
    .replace(/С/g, "s").replace(/с/g, "s")
    .replace(/Т/g, "t").replace(/т/g, "t")
    .replace(/У/g, "u").replace(/у/g, "u")
    .replace(/Ф/g, "f").replace(/ф/g, "f")
    .replace(/Х/g, "kh").replace(/х/g, "kh")
    .replace(/Ц/g, "t^s").replace(/ц/g, "t^s")
    .replace(/Ч/g, "ch").replace(/ч/g, "ch")
    .replace(/Ш/g, "sh").replace(/ш/g, "sh")
    .replace(/Щ/g, "shch").replace(/щ/g, "shch")
    .replace(/Ъ/g, "''").replace(/ъ/g, "''")
    .replace(/Ы/g, "y").replace(/ы/g, "y")
    .replace(/Ь/g, "'").replace(/ь/g, "'")
    .replace(/Э/g, "e`").replace(/э/g, "e`")
    .replace(/Ю/g, "i^u").replace(/ю/g, "i^u")
    .replace(/Я/g, "i^a").replace(/я/g, "i^a");
}

function romanToCyrillic(word: string): string {
  return word
    .replace(/i\^u/g, "ю")
    .replace(/i\^a/g, "я")
    .replace(/shch/g, "щ")
    .replace(/kh/g, "х")
    .replace(/t\^s/g, "ц")
    .replace(/ch/g, "ч")
    .replace(/e`/g, "э")
    .replace(/i`/g, "й")
    .replace(/sh/g, "ш")
    .replace(/k/g, "к")
    .replace(/e/g, "е")
    .replace(/zh/g, "ж")
    .replace(/a/g, "а")
    .replace(/b/g, "б")
    .replace(/v/g, "в")
    .replace(/g/g, "г")
    .replace(/d/g, "д")
    .replace(/e/g, "е")
    .replace(/z/g, "з")
    .replace(/i/g, "и")
    .replace(/l/g, "л")
    .replace(/m/g, "м")
    .replace(/n/g, "н")
    .replace(/o/g, "о")
    .replace(/p/g, "п")
    .replace(/r/g, "р")
    .replace(/s/g, "с")
    .replace(/t/g, "т")
    .replace(/u/g, "у")
    .replace(/f/g, "ф")
    .replace(/''/g, "ъ")
    .replace(/y/g, "ы")
    .replace(/'/g, "ь");
}

function regionsRussian(word: string): { rv: string; r2: string } {
  let r1 = "";
  let r2 = "";
  let rv = "";

  const vowels = "AUaeiouy";
  const marked = word.replace(/i\^a/g, "A").replace(/i\^u/g, "U").replace(/e`/g, "E");

  for (let i = 1; i < marked.length; i++) {
    if (!vowels.includes(marked[i]!) && vowels.includes(marked[i - 1]!)) {
      r1 = marked.slice(i + 1);
      break;
    }
  }

  for (let i = 1; i < r1.length; i++) {
    if (!vowels.includes(r1[i]!) && vowels.includes(r1[i - 1]!)) {
      r2 = r1.slice(i + 1);
      break;
    }
  }

  for (let i = 0; i < marked.length; i++) {
    if (vowels.includes(marked[i]!)) {
      rv = marked.slice(i + 1);
      break;
    }
  }

  r2 = r2.replace(/A/g, "i^a").replace(/U/g, "i^u").replace(/E/g, "e`");
  rv = rv.replace(/A/g, "i^a").replace(/U/g, "i^u").replace(/E/g, "e`");

  return { rv, r2 };
}

export function stemRussian(input: string): string {
  let word = input;

  let chrExceeded = false;
  for (const ch of word) {
    if (ch.codePointAt(0)! > 255) {
      chrExceeded = true;
      break;
    }
  }
  if (!chrExceeded) {
    return word;
  }

  word = cyrillicToRoman(word);

  let step1Success = false;
  let adjectivalRemoved = false;
  let verbRemoved = false;
  let undoubleSuccess = false;
  let superlativeRemoved = false;

  const regions = regionsRussian(word);
  let rv = regions.rv;
  let r2 = regions.r2;

  // Step 1
  for (const suffix of RUSSIAN_PERFECTIVE_GERUND_SUFFIXES) {
    if (rv.endsWith(suffix)) {
      if (suffix === "v" || suffix === "vshi" || suffix === "vshis'") {
        if (
          rv.slice(-(suffix.length + 3), -suffix.length) === "i^a" ||
          rv.slice(-(suffix.length + 1), -suffix.length) === "a"
        ) {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          step1Success = true;
          break;
        }
      } else {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        step1Success = true;
        break;
      }
    }
  }

  if (!step1Success) {
    for (const suffix of RUSSIAN_REFLEXIVE_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }

    for (const suffix of RUSSIAN_ADJECTIVAL_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        if (RUSSIAN_ADJECTIVAL_A_CHECK.has(suffix)) {
          if (
            rv.slice(-(suffix.length + 3), -suffix.length) === "i^a" ||
            rv.slice(-(suffix.length + 1), -suffix.length) === "a"
          ) {
            word = word.slice(0, -suffix.length);
            r2 = r2.slice(0, -suffix.length);
            rv = rv.slice(0, -suffix.length);
            adjectivalRemoved = true;
            break;
          }
        } else {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          adjectivalRemoved = true;
          break;
        }
      }
    }

    if (!adjectivalRemoved) {
      for (const suffix of RUSSIAN_VERB_SUFFIXES) {
        if (rv.endsWith(suffix)) {
          if (RUSSIAN_VERB_A_CHECK.has(suffix)) {
            if (
              rv.slice(-(suffix.length + 3), -suffix.length) === "i^a" ||
              rv.slice(-(suffix.length + 1), -suffix.length) === "a"
            ) {
              word = word.slice(0, -suffix.length);
              r2 = r2.slice(0, -suffix.length);
              rv = rv.slice(0, -suffix.length);
              verbRemoved = true;
              break;
            }
          } else {
            word = word.slice(0, -suffix.length);
            r2 = r2.slice(0, -suffix.length);
            rv = rv.slice(0, -suffix.length);
            verbRemoved = true;
            break;
          }
        }
      }
    }

    if (!adjectivalRemoved && !verbRemoved) {
      for (const suffix of RUSSIAN_NOUN_SUFFIXES) {
        if (rv.endsWith(suffix)) {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          break;
        }
      }
    }
  }

  // Step 2
  if (rv.endsWith("i")) {
    word = word.slice(0, -1);
    r2 = r2.slice(0, -1);
  }

  // Step 3
  for (const suffix of RUSSIAN_DERIVATIONAL_SUFFIXES) {
    if (r2.endsWith(suffix)) {
      word = word.slice(0, -suffix.length);
      break;
    }
  }

  // Step 4
  if (word.endsWith("nn")) {
    word = word.slice(0, -1);
    undoubleSuccess = true;
  }

  if (!undoubleSuccess) {
    for (const suffix of RUSSIAN_SUPERLATIVE_SUFFIXES) {
      if (word.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        superlativeRemoved = true;
        break;
      }
    }
    if (word.endsWith("nn")) {
      word = word.slice(0, -1);
    }
  }

  if (!undoubleSuccess && !superlativeRemoved) {
    if (word.endsWith("'")) {
      word = word.slice(0, -1);
    }
  }

  word = romanToCyrillic(word);

  return word;
}

// ---------------------------------------------------------------------------
// Spanish
// ---------------------------------------------------------------------------

const SPANISH_VOWELS = "aeiouáéíóúü";
const SPANISH_STEP0_SUFFIXES = [
  "selas", "selos", "sela", "selo", "las", "les", "los", "nos", "me", "se",
  "la", "le", "lo",
];
const SPANISH_STEP1_SUFFIXES = [
  "amientos", "imientos", "amiento", "imiento", "acion", "aciones",
  "uciones", "adoras", "adores", "ancias", "logías", "encias", "amente",
  "idades", "anzas", "ismos", "ables", "ibles", "istas", "adora", "ación",
  "antes", "ancia", "logía", "ución", "encia", "mente", "anza", "icos",
  "icas", "ismo", "able", "ible", "ista", "osos", "osas", "ador", "ante",
  "idad", "ivas", "ivos", "ico", "ica", "oso", "osa", "iva", "ivo",
];
const SPANISH_STEP2A_SUFFIXES = [
  "yeron", "yendo", "yamos", "yais", "yan", "yen", "yas", "yes", "ya", "ye",
  "yo", "yó",
];
const SPANISH_STEP2B_SUFFIXES = [
  "aríamos", "eríamos", "iríamos", "iéramos", "iésemos", "aríais",
  "aremos", "eríais", "eremos", "iríais", "iremos", "ierais", "ieseis",
  "asteis", "isteis", "ábamos", "áramos", "ásemos", "arían", "arías",
  "aréis", "erían", "erías", "eréis", "irían", "irías", "iréis", "ieran",
  "iesen", "ieron", "iendo", "ieras", "ieses", "abais", "arais", "aseis",
  "éamos", "arán", "arás", "aría", "erán", "erás", "ería", "irán", "irás",
  "iría", "iera", "iese", "aste", "iste", "aban", "aran", "asen", "aron",
  "ando", "abas", "adas", "idas", "aras", "ases", "íais", "ados", "idos",
  "amos", "imos", "emos", "ará", "aré", "erá", "eré", "irá", "iré", "aba",
  "ada", "ida", "ara", "ase", "ían", "ado", "ido", "ías", "áis", "éis",
  "ía", "ad", "ed", "id", "an", "ió", "ar", "er", "ir", "as", "ís", "en",
  "es",
];
const SPANISH_STEP3_SUFFIXES = ["os", "a", "e", "o", "á", "é", "í", "ó"];

function replaceAccentedSpanish(word: string): string {
  return word
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u");
}

export function stemSpanish(input: string): string {
  let word = input.toLowerCase();
  let step1Success = false;

  const std = r1r2Standard(word, SPANISH_VOWELS);
  let r1 = std.r1;
  let r2 = std.r2;
  let rv = rvStandard(word, SPANISH_VOWELS);

  // STEP 0: Attached pronoun
  for (const suffix of SPANISH_STEP0_SUFFIXES) {
    if (!(word.endsWith(suffix) && rv.endsWith(suffix))) {
      continue;
    }

    const rvPrefix = rv.slice(0, -suffix.length);
    if (
      endsWithAny(rvPrefix, [
        "ando", "ándo", "ar", "ár", "er", "ér", "iendo", "iéndo", "ir", "ír",
      ]) ||
      (rvPrefix.endsWith("yendo") && word.slice(0, -suffix.length).endsWith("uyendo"))
    ) {
      word = replaceAccentedSpanish(word.slice(0, -suffix.length));
      r1 = replaceAccentedSpanish(r1.slice(0, -suffix.length));
      r2 = replaceAccentedSpanish(r2.slice(0, -suffix.length));
      rv = replaceAccentedSpanish(rv.slice(0, -suffix.length));
    }
    break;
  }

  // STEP 1: Standard suffix removal
  for (const suffix of SPANISH_STEP1_SUFFIXES) {
    if (!word.endsWith(suffix)) {
      continue;
    }

    if (suffix === "amente" && r1.endsWith(suffix)) {
      step1Success = true;
      word = word.slice(0, -6);
      r2 = r2.slice(0, -6);
      rv = rv.slice(0, -6);

      if (r2.endsWith("iv")) {
        word = word.slice(0, -2);
        r2 = r2.slice(0, -2);
        rv = rv.slice(0, -2);
        if (r2.endsWith("at")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        }
      } else if (r2.endsWith("os") || r2.endsWith("ic") || r2.endsWith("ad")) {
        word = word.slice(0, -2);
        rv = rv.slice(0, -2);
      }
    } else if (r2.endsWith(suffix)) {
      step1Success = true;
      if (
        suffix === "adora" || suffix === "ador" || suffix === "ación" ||
        suffix === "adoras" || suffix === "adores" || suffix === "acion" ||
        suffix === "aciones" || suffix === "ante" || suffix === "antes" ||
        suffix === "ancia" || suffix === "ancias"
      ) {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        if (r2.endsWith("ic")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        }
      } else if (suffix === "logía" || suffix === "logías") {
        word = suffixReplace(word, suffix, "log");
        rv = suffixReplace(rv, suffix, "log");
      } else if (suffix === "ución" || suffix === "uciones") {
        word = suffixReplace(word, suffix, "u");
        rv = suffixReplace(rv, suffix, "u");
      } else if (suffix === "encia" || suffix === "encias") {
        word = suffixReplace(word, suffix, "ente");
        rv = suffixReplace(rv, suffix, "ente");
      } else if (suffix === "mente") {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        if (r2.endsWith("ante") || r2.endsWith("able") || r2.endsWith("ible")) {
          word = word.slice(0, -4);
          rv = rv.slice(0, -4);
        }
      } else if (suffix === "idad" || suffix === "idades") {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        for (const preSuff of ["abil", "ic", "iv"]) {
          if (r2.endsWith(preSuff)) {
            word = word.slice(0, -preSuff.length);
            rv = rv.slice(0, -preSuff.length);
          }
        }
      } else if (
        suffix === "ivo" || suffix === "iva" || suffix === "ivos" || suffix === "ivas"
      ) {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        if (r2.endsWith("at")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        }
      } else {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
      }
    }
    break;
  }

  // STEP 2a: Verb suffixes beginning 'y'
  if (!step1Success) {
    for (const suffix of SPANISH_STEP2A_SUFFIXES) {
      if (rv.endsWith(suffix) && word.slice(-(suffix.length + 1), -suffix.length) === "u") {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }

    // STEP 2b: Other verb suffixes
    for (const suffix of SPANISH_STEP2B_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        if (suffix === "en" || suffix === "es" || suffix === "éis" || suffix === "emos") {
          if (word.endsWith("gu")) {
            word = word.slice(0, -1);
          }
          if (rv.endsWith("gu")) {
            rv = rv.slice(0, -1);
          }
        }
        break;
      }
    }
  }

  // STEP 3: Residual suffix
  for (const suffix of SPANISH_STEP3_SUFFIXES) {
    if (rv.endsWith(suffix)) {
      word = word.slice(0, -suffix.length);
      if (suffix === "e" || suffix === "é") {
        rv = rv.slice(0, -suffix.length);
        if (word.slice(-2) === "gu" && rv.endsWith("u")) {
          word = word.slice(0, -1);
        }
      }
      break;
    }
  }

  word = replaceAccentedSpanish(word);

  return word;
}

// ---------------------------------------------------------------------------
// Swedish
// ---------------------------------------------------------------------------

const SWEDISH_VOWELS = "aeiouyäåö";
const SWEDISH_S_ENDING = "bcdfghjklmnoprtvy";
const SWEDISH_STEP1_SUFFIXES = [
  "heterna", "hetens", "heter", "heten", "anden", "arnas", "ernas", "ornas",
  "andes", "andet", "arens", "arna", "erna", "orna", "ande", "arne", "aste",
  "aren", "ades", "erns", "ade", "are", "ern", "ens", "het", "ast", "ad",
  "en", "ar", "er", "or", "as", "es", "at", "a", "e", "s",
];
const SWEDISH_STEP2_SUFFIXES = ["dd", "gd", "nn", "dt", "gt", "kt", "tt"];
const SWEDISH_STEP3_SUFFIXES = ["fullt", "löst", "els", "lig", "ig"];

export function stemSwedish(input: string): string {
  let word = input.toLowerCase();
  let r1 = r1Scandinavian(word, SWEDISH_VOWELS);

  // STEP 1
  for (const suffix of SWEDISH_STEP1_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "s") {
        if (SWEDISH_S_ENDING.includes(at(word, -2))) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
        }
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 2
  for (const suffix of SWEDISH_STEP2_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      word = word.slice(0, -1);
      r1 = r1.slice(0, -1);
      break;
    }
  }

  // STEP 3
  for (const suffix of SWEDISH_STEP3_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "els" || suffix === "lig" || suffix === "ig") {
        word = word.slice(0, -suffix.length);
      } else if (suffix === "fullt" || suffix === "löst") {
        word = word.slice(0, -1);
      }
      break;
    }
  }

  return word;
}

// ---------------------------------------------------------------------------
// Registry / public API
// ---------------------------------------------------------------------------

export const SNOWBALL_LANGUAGES = [
  "danish",
  "dutch",
  "english",
  "french",
  "german",
  "italian",
  "norwegian",
  "portuguese",
  "romanian",
  "russian",
  "spanish",
  "swedish",
] as const;

export type SnowballLanguage = (typeof SNOWBALL_LANGUAGES)[number];

const SNOWBALL_STEMMERS: Record<string, (word: string) => string> = {
  danish: stemDanish,
  dutch: stemDutch,
  english: stemEnglish,
  french: stemFrench,
  german: stemGerman,
  italian: stemItalian,
  norwegian: stemNorwegian,
  portuguese: stemPortuguese,
  romanian: stemRomanian,
  russian: stemRussian,
  spanish: stemSpanish,
  swedish: stemSwedish,
};

/**
 * Stem `word` with the NLTK-compatible Snowball stemmer for `language`.
 *
 * Throws an Error (mirroring NLTK's ValueError) when the language is not
 * supported. Each language's algorithm lowercases internally (except
 * Russian, which does not lowercase — matching NLTK exactly).
 */
export function snowballStem(word: string, language: string): string {
  const key = language.toLowerCase();
  const stemmer = SNOWBALL_STEMMERS[key];
  if (!stemmer) {
    throw new Error(`The language '${language}' is not supported.`);
  }
  return stemmer(word);
}

export function isSnowballLanguage(language: string): boolean {
  return Object.prototype.hasOwnProperty.call(SNOWBALL_STEMMERS, language.toLowerCase());
}
