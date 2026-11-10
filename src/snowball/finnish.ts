import { at, r1r2Standard, suffixReplace } from "./helpers";

// Finnish — ported line-for-line from NLTK's nltk/stem/snowball.py
// http://snowball.tartarus.org/algorithms/finnish/stemmer.html
// NLTK's FinnishStemmer lowercases its input and checks stopwords on the
// lowercased word (handled by the SnowballStemmer wrapper).

const VOWELS = "aeiouyäö";
const RESTRICTED_VOWELS = "aeiouäö";
const LONG_VOWELS = ["aa", "ee", "ii", "oo", "uu", "ää", "öö"];
const CONSONANTS = "bcdfghjklmnpqrstvwxz";
const DOUBLE_CONSONANTS = [
  "bb", "cc", "dd", "ff", "gg", "hh", "jj", "kk", "ll", "mm", "nn", "pp",
  "qq", "rr", "ss", "tt", "vv", "ww", "xx", "zz",
];

const STEP1_SUFFIXES = ["kaan", "kään", "sti", "kin", "han", "hän", "ko", "kö", "pa", "pä"];
const STEP2_SUFFIXES = ["nsa", "nsä", "mme", "nne", "si", "ni", "an", "än", "en"];
const STEP3_SUFFIXES = [
  "siin", "tten", "seen", "han", "hen", "hin", "hon", "hän", "hön", "den",
  "tta", "ttä", "ssa", "ssä", "sta", "stä", "lla", "llä", "lta", "ltä",
  "lle", "ksi", "ine", "ta", "tä", "na", "nä", "a", "ä", "n",
];
const STEP4_SUFFIXES = [
  "impi", "impa", "impä", "immi", "imma", "immä", "mpi", "mpa", "mpä",
  "mmi", "mma", "mmä", "eja", "ejä",
];

function pySlice(s: string, a: number, b: number): string {
  const n = s.length;
  const i = Math.max(0, a < 0 ? n + a : a);
  const j = Math.min(n, b < 0 ? n + b : b);
  return j > i ? s.slice(i, j) : "";
}

export function stemFinnish(input: string): string {
  let word = input.toLowerCase();
  let step3Success = false;

  let { r1, r2 } = r1r2Standard(word, VOWELS);

  // STEP 1: Particles etc.
  for (const suffix of STEP1_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "sti") {
        if (r2.includes(suffix)) {
          word = word.slice(0, -3);
          r1 = r1.slice(0, -3);
          r2 = r2.slice(0, -3);
        }
      } else {
        if ("ntaeiouyäö".includes(at(word, -suffix.length - 1))) {
          word = word.slice(0, -suffix.length);
          r1 = r1.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  // STEP 2: Possessives
  for (const suffix of STEP2_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "si") {
        if (at(word, -3) !== "k") {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        }
      } else if (suffix === "ni") {
        word = word.slice(0, -2);
        r1 = r1.slice(0, -2);
        r2 = r2.slice(0, -2);
        if (word.endsWith("kse")) {
          word = suffixReplace(word, "kse", "ksi");
        }
        if (r1.endsWith("kse")) {
          r1 = suffixReplace(r1, "kse", "ksi");
        }
        if (r2.endsWith("kse")) {
          r2 = suffixReplace(r2, "kse", "ksi");
        }
      } else if (suffix === "an") {
        if (
          ["ta", "na"].includes(pySlice(word, -4, -2)) ||
          ["ssa", "sta", "lla", "lta"].includes(pySlice(word, -5, -2))
        ) {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        }
      } else if (suffix === "än") {
        if (
          ["tä", "nä"].includes(pySlice(word, -4, -2)) ||
          ["ssä", "stä", "llä", "ltä"].includes(pySlice(word, -5, -2))
        ) {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        }
      } else if (suffix === "en") {
        if (["lle", "ine"].includes(pySlice(word, -5, -2))) {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        }
      } else {
        word = word.slice(0, -3);
        r1 = r1.slice(0, -3);
        r2 = r2.slice(0, -3);
      }
      break;
    }
  }

  // STEP 3: Cases
  for (const suffix of STEP3_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (["han", "hen", "hin", "hon", "hän", "hön"].includes(suffix)) {
        if (
          (suffix === "han" && at(word, -4) === "a") ||
          (suffix === "hen" && at(word, -4) === "e") ||
          (suffix === "hin" && at(word, -4) === "i") ||
          (suffix === "hon" && at(word, -4) === "o") ||
          (suffix === "hän" && at(word, -4) === "ä") ||
          (suffix === "hön" && at(word, -4) === "ö")
        ) {
          word = word.slice(0, -3);
          r1 = r1.slice(0, -3);
          r2 = r2.slice(0, -3);
          step3Success = true;
        }
      } else if (["siin", "den", "tten"].includes(suffix)) {
        if (
          at(word, -suffix.length - 1) === "i" &&
          RESTRICTED_VOWELS.includes(at(word, -suffix.length - 2))
        ) {
          word = word.slice(0, -suffix.length);
          r1 = r1.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          step3Success = true;
        } else {
          continue;
        }
      } else if (suffix === "seen") {
        if (LONG_VOWELS.includes(pySlice(word, -6, -4))) {
          word = word.slice(0, -4);
          r1 = r1.slice(0, -4);
          r2 = r2.slice(0, -4);
          step3Success = true;
        } else {
          continue;
        }
      } else if (["a", "ä"].includes(suffix)) {
        if (VOWELS.includes(at(word, -2)) && CONSONANTS.includes(at(word, -3))) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
          step3Success = true;
        }
      } else if (["tta", "ttä"].includes(suffix)) {
        if (at(word, -4) === "e") {
          word = word.slice(0, -3);
          r1 = r1.slice(0, -3);
          r2 = r2.slice(0, -3);
          step3Success = true;
        }
      } else if (suffix === "n") {
        word = word.slice(0, -1);
        r1 = r1.slice(0, -1);
        r2 = r2.slice(0, -1);
        step3Success = true;
        if (word.slice(-2) === "ie" || LONG_VOWELS.includes(word.slice(-2))) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
        }
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        step3Success = true;
      }
      break;
    }
  }

  // STEP 4: Other endings
  for (const suffix of STEP4_SUFFIXES) {
    if (r2.endsWith(suffix)) {
      if (["mpi", "mpa", "mpä", "mmi", "mma", "mmä"].includes(suffix)) {
        if (pySlice(word, -5, -3) !== "po") {
          word = word.slice(0, -3);
          r1 = r1.slice(0, -3);
          r2 = r2.slice(0, -3);
        }
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 5: Plurals
  if (step3Success && r1.length >= 1 && "ij".includes(r1[r1.length - 1]!)) {
    word = word.slice(0, -1);
    r1 = r1.slice(0, -1);
  } else if (
    !step3Success &&
    r1.length >= 2 &&
    r1[r1.length - 1] === "t" &&
    VOWELS.includes(r1[r1.length - 2]!)
  ) {
    word = word.slice(0, -1);
    r1 = r1.slice(0, -1);
    r2 = r2.slice(0, -1);
    if (r2.endsWith("imma")) {
      word = word.slice(0, -4);
      r1 = r1.slice(0, -4);
    } else if (r2.endsWith("mma") && pySlice(r2, -5, -3) !== "po") {
      word = word.slice(0, -3);
      r1 = r1.slice(0, -3);
    }
  }

  // STEP 6: Tidying up
  if (LONG_VOWELS.includes(r1.slice(-2))) {
    word = word.slice(0, -1);
    r1 = r1.slice(0, -1);
  }

  if (r1.length >= 2 && CONSONANTS.includes(r1[r1.length - 2]!) && "aäei".includes(r1[r1.length - 1]!)) {
    word = word.slice(0, -1);
    r1 = r1.slice(0, -1);
  }

  if (r1.endsWith("oj") || r1.endsWith("uj")) {
    word = word.slice(0, -1);
    r1 = r1.slice(0, -1);
  }

  if (r1.endsWith("jo")) {
    word = word.slice(0, -1);
    r1 = r1.slice(0, -1);
  }

  // If the word ends with a double consonant followed by zero or more
  // vowels, the last consonant is removed.
  for (let i = 1; i < word.length; i++) {
    if (VOWELS.includes(at(word, -i))) {
      continue;
    }
    if (i === 1) {
      if (DOUBLE_CONSONANTS.includes(word.slice(-2))) {
        word = word.slice(0, -1);
      }
    } else {
      if (DOUBLE_CONSONANTS.includes(pySlice(word, -i - 1, -i + 1))) {
        word = word.slice(0, -i) + word.slice(word.length - i + 1);
      }
    }
    break;
  }

  return word;
}
