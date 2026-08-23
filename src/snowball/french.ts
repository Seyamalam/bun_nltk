import { at, endsWithAny, r1r2Standard, suffixReplace } from "./helpers";

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

