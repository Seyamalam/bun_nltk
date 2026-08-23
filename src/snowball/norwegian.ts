import { at, r1Scandinavian, suffixReplace } from "./helpers";

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

