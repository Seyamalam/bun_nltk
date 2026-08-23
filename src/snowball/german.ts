import { at, r1r2Standard } from "./helpers";

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

