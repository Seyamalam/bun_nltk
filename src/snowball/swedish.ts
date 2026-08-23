import { at, r1Scandinavian } from "./helpers";

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

