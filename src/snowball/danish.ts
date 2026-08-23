import { at, endsWithAny, r1Scandinavian } from "./helpers";

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

