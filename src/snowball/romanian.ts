import { at, r1r2Standard, rvStandard, suffixReplace } from "./helpers";

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

