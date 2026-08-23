import { at, endsWithAny, r1r2Standard, suffixReplace } from "./helpers";

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

