import { at, r1r2Standard, suffixReplace } from "./helpers";

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

