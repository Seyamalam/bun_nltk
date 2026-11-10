import { suffixReplace } from "./helpers";

// Hungarian — ported line-for-line from NLTK's nltk/stem/snowball.py
// http://snowball.tartarus.org/algorithms/hungarian/stemmer.html
// NLTK's HungarianStemmer lowercases its input and checks stopwords on the
// lowercased word (handled by the SnowballStemmer wrapper).

const VOWELS = "aeiouöüáéíóõúû";
const DIGRAPHS = ["cs", "dz", "dzs", "gy", "ly", "ny", "ty", "zs"];
const DOUBLE_CONSONANTS = [
  "bb", "cc", "ccs", "dd", "ff", "gg", "ggy", "jj", "kk", "ll", "lly",
  "mm", "nn", "nny", "pp", "rr", "ss", "ssz", "tt", "tty", "vv", "zz", "zzs",
];

const STEP1_SUFFIXES = ["al", "el"];
const STEP2_SUFFIXES = [
  "képpen", "onként", "enként", "anként", "képp", "ként", "ban", "ben",
  "nak", "nek", "val", "vel", "tól", "tõl", "ról", "rõl", "ból", "bõl",
  "hoz", "hez", "höz", "nál", "nél", "ért", "kor", "ba", "be", "ra", "re",
  "ig", "at", "et", "ot", "öt", "ul", "ül", "vá", "vé", "en", "on", "an",
  "ön", "n", "t",
];
const STEP3_SUFFIXES = ["ánként", "án", "én"];
const STEP4_SUFFIXES = ["astul", "estül", "ástul", "éstül", "stul", "stül"];
const STEP5_SUFFIXES = ["á", "é"];
const STEP6_SUFFIXES = [
  "oké", "öké", "aké", "eké", "áké", "áéi", "éké", "ééi", "ké", "éi", "éé", "é",
];
const STEP7_SUFFIXES = [
  "ájuk", "éjük", "ünk", "unk", "juk", "jük", "ánk", "énk", "nk", "uk",
  "ük", "em", "om", "am", "od", "ed", "ad", "öd", "ja", "je", "ám", "ád",
  "ém", "éd", "m", "d", "a", "e", "o", "á", "é",
];
const STEP8_SUFFIXES = [
  "jaitok", "jeitek", "jaink", "jeink", "aitok", "eitek", "áitok", "éitek",
  "jaim", "jeim", "jaid", "jeid", "eink", "aink", "itek", "jeik", "jaik",
  "áink", "éink", "aim", "eim", "aid", "eid", "jai", "jei", "ink", "aik",
  "eik", "áim", "áid", "áik", "éim", "éid", "éik", "im", "id", "ai", "ei",
  "ik", "ái", "éi", "i",
];
const STEP9_SUFFIXES = ["ák", "ék", "ök", "ok", "ek", "ak", "k"];

function pySlice(s: string, a: number, b: number): string {
  const n = s.length;
  const i = Math.max(0, a < 0 ? n + a : a);
  const j = Math.min(n, b < 0 ? n + b : b);
  return j > i ? s.slice(i, j) : "";
}

function r1Hungarian(word: string): string {
  let r1 = "";
  if (VOWELS.includes(word[0]!)) {
    for (const digraph of DIGRAPHS) {
      if (word.slice(1).includes(digraph)) {
        r1 = word.slice(word.indexOf(digraph[digraph.length - 1]!) + 1);
        return r1;
      }
    }
    for (let i = 1; i < word.length; i++) {
      if (!VOWELS.includes(word[i]!)) {
        r1 = word.slice(i + 1);
        break;
      }
    }
  } else {
    for (let i = 1; i < word.length; i++) {
      if (VOWELS.includes(word[i]!)) {
        r1 = word.slice(i + 1);
        break;
      }
    }
  }
  return r1;
}

export function stemHungarian(input: string): string {
  let word = input.toLowerCase();
  let r1 = r1Hungarian(word);

  // STEP 1: Remove instrumental case
  if (STEP1_SUFFIXES.some((s) => r1.endsWith(s))) {
    for (const doubleCons of DOUBLE_CONSONANTS) {
      if (pySlice(word, -2 - doubleCons.length, -2) === doubleCons) {
        word = word.slice(0, -4) + word[word.length - 3]!;
        if (pySlice(r1, -2 - doubleCons.length, -2) === doubleCons) {
          r1 = r1.slice(0, -4) + r1[r1.length - 3]!;
        }
        break;
      }
    }
  }

  // STEP 2: Remove frequent cases
  for (const suffix of STEP2_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        if (r1.endsWith("á")) {
          word = word.slice(0, -1) + "a";
          r1 = suffixReplace(r1, "á", "a");
        } else if (r1.endsWith("é")) {
          word = word.slice(0, -1) + "e";
          r1 = suffixReplace(r1, "é", "e");
        }
      }
      break;
    }
  }

  // STEP 3: Remove special cases
  for (const suffix of STEP3_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "én") {
        word = suffixReplace(word, suffix, "e");
        r1 = suffixReplace(r1, suffix, "e");
      } else {
        word = suffixReplace(word, suffix, "a");
        r1 = suffixReplace(r1, suffix, "a");
      }
      break;
    }
  }

  // STEP 4: Remove other cases
  for (const suffix of STEP4_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (suffix === "ástul") {
        word = suffixReplace(word, suffix, "a");
        r1 = suffixReplace(r1, suffix, "a");
      } else if (suffix === "éstül") {
        word = suffixReplace(word, suffix, "e");
        r1 = suffixReplace(r1, suffix, "e");
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 5: Remove factive case
  for (const suffix of STEP5_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      for (const doubleCons of DOUBLE_CONSONANTS) {
        if (pySlice(word, -1 - doubleCons.length, -1) === doubleCons) {
          word = word.slice(0, -3) + word[word.length - 2]!;
          if (pySlice(r1, -1 - doubleCons.length, -1) === doubleCons) {
            r1 = r1.slice(0, -3) + r1[r1.length - 2]!;
          }
          break;
        }
      }
    }
  }

  // STEP 6: Remove owned
  for (const suffix of STEP6_SUFFIXES) {
    if (r1.endsWith(suffix)) {
      if (["áké", "áéi"].includes(suffix)) {
        word = suffixReplace(word, suffix, "a");
        r1 = suffixReplace(r1, suffix, "a");
      } else if (["éké", "ééi", "éé"].includes(suffix)) {
        word = suffixReplace(word, suffix, "e");
        r1 = suffixReplace(r1, suffix, "e");
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
      }
      break;
    }
  }

  // STEP 7: Remove singular owner suffixes
  for (const suffix of STEP7_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.endsWith(suffix)) {
        if (["ánk", "ájuk", "ám", "ád", "á"].includes(suffix)) {
          word = suffixReplace(word, suffix, "a");
          r1 = suffixReplace(r1, suffix, "a");
        } else if (["énk", "éjük", "ém", "éd", "é"].includes(suffix)) {
          word = suffixReplace(word, suffix, "e");
          r1 = suffixReplace(r1, suffix, "e");
        } else {
          word = word.slice(0, -suffix.length);
          r1 = r1.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  // STEP 8: Remove plural owner suffixes
  for (const suffix of STEP8_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.endsWith(suffix)) {
        if (["áim", "áid", "ái", "áink", "áitok", "áik"].includes(suffix)) {
          word = suffixReplace(word, suffix, "a");
          r1 = suffixReplace(r1, suffix, "a");
        } else if (["éim", "éid", "éi", "éink", "éitek", "éik"].includes(suffix)) {
          word = suffixReplace(word, suffix, "e");
          r1 = suffixReplace(r1, suffix, "e");
        } else {
          word = word.slice(0, -suffix.length);
          r1 = r1.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  // STEP 9: Remove plural suffixes
  for (const suffix of STEP9_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.endsWith(suffix)) {
        if (suffix === "ák") {
          word = suffixReplace(word, suffix, "a");
        } else if (suffix === "ék") {
          word = suffixReplace(word, suffix, "e");
        } else {
          word = word.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  return word;
}
