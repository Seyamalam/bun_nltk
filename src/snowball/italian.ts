import { at, endsWithAny, r1r2Standard, rvStandard, suffixReplace } from "./helpers";

// Italian
// ---------------------------------------------------------------------------

const ITALIAN_VOWELS = "aeiouàèìòù";
const ITALIAN_STEP0_SUFFIXES = [
  "gliela", "gliele", "glieli", "glielo", "gliene", "sene", "mela", "mele",
  "meli", "melo", "mene", "tela", "tele", "teli", "telo", "tene", "cela",
  "cele", "celi", "celo", "cene", "vela", "vele", "veli", "velo", "vene",
  "gli", "ci", "la", "le", "li", "lo", "mi", "ne", "si", "ti", "vi",
];
const ITALIAN_STEP1_SUFFIXES = [
  "atrice", "atrici", "azione", "azioni", "uzione", "uzioni", "usione",
  "usioni", "amento", "amenti", "imento", "imenti", "amente", "abile",
  "abili", "ibile", "ibili", "mente", "atore", "atori", "logia", "logie",
  "anza", "anze", "iche", "ichi", "ismo", "ismi", "ista", "iste", "isti",
  "istà", "istè", "istì", "ante", "anti", "enza", "enze", "ico", "ici",
  "ica", "ice", "oso", "osi", "osa", "ose", "ità", "ivo", "ivi", "iva", "ive",
];
const ITALIAN_STEP2_SUFFIXES = [
  "erebbero", "irebbero", "assero", "assimo", "eranno", "erebbe", "eremmo",
  "ereste", "eresti", "essero", "iranno", "irebbe", "iremmo", "ireste",
  "iresti", "iscano", "iscono", "issero", "arono", "avamo", "avano", "avate",
  "eremo", "erete", "erono", "evamo", "evano", "evate", "iremo", "irete",
  "irono", "ivamo", "ivano", "ivate", "ammo", "ando", "asse", "assi", "emmo",
  "enda", "ende", "endi", "endo", "erai", "erei", "Yamo", "iamo", "immo",
  "irai", "irei", "isca", "isce", "isci", "isco", "ano", "are", "ata", "ate",
  "ati", "ato", "ava", "avi", "avo", "erà", "ere", "erò", "ete", "eva", "evi",
  "evo", "irà", "ire", "irò", "ita", "ite", "iti", "ito", "iva", "ivi", "ivo",
  "ono", "uta", "ute", "uti", "uto", "ar", "ir",
];

export function stemItalian(input: string): string {
  let word = input.toLowerCase();
  let step1Success = false;

  // All acute accents are replaced by grave accents.
  word = word
    .replace(/á/g, "à")
    .replace(/é/g, "è")
    .replace(/í/g, "ì")
    .replace(/ó/g, "ò")
    .replace(/ú/g, "ù");

  // Every occurrence of 'u' after 'q' is put into upper case.
  for (let i = 1; i < word.length; i++) {
    if (word[i - 1] === "q" && word[i] === "u") {
      word = word.slice(0, i) + "U" + word.slice(i + 1);
    }
  }

  // Every occurrence of 'u' and 'i' between vowels is put into upper case.
  for (let i = 1; i < word.length - 1; i++) {
    if (ITALIAN_VOWELS.includes(word[i - 1]!) && ITALIAN_VOWELS.includes(word[i + 1]!)) {
      if (word[i] === "u") {
        word = word.slice(0, i) + "U" + word.slice(i + 1);
      } else if (word[i] === "i") {
        word = word.slice(0, i) + "I" + word.slice(i + 1);
      }
    }
  }

  const std = r1r2Standard(word, ITALIAN_VOWELS);
  let r1 = std.r1;
  let r2 = std.r2;
  let rv = rvStandard(word, ITALIAN_VOWELS);

  // STEP 0: Attached pronoun
  for (const suffix of ITALIAN_STEP0_SUFFIXES) {
    if (rv.endsWith(suffix)) {
      if (
        ["ando", "endo"].includes(rv.slice(-(suffix.length + 4), -suffix.length))
      ) {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
      } else if (
        ["ar", "er", "ir"].includes(rv.slice(-(suffix.length + 2), -suffix.length))
      ) {
        word = suffixReplace(word, suffix, "e");
        r1 = suffixReplace(r1, suffix, "e");
        r2 = suffixReplace(r2, suffix, "e");
        rv = suffixReplace(rv, suffix, "e");
      }
      break;
    }
  }

  // STEP 1: Standard suffix removal
  for (const suffix of ITALIAN_STEP1_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (suffix === "amente" && r1.endsWith(suffix)) {
        step1Success = true;
        word = word.slice(0, -6);
        r2 = r2.slice(0, -6);
        rv = rv.slice(0, -6);

        if (r2.endsWith("iv")) {
          word = word.slice(0, -2);
          r2 = r2.slice(0, -2);
          rv = rv.slice(0, -2);
          if (r2.endsWith("at")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          }
        } else if (r2.endsWith("os") || r2.endsWith("ic")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        } else if (r2.endsWith("abil")) {
          word = word.slice(0, -4);
          rv = rv.slice(0, -4);
        }
      } else if (
        (suffix === "amento" || suffix === "amenti" || suffix === "imento" || suffix === "imenti") &&
        rv.endsWith(suffix)
      ) {
        step1Success = true;
        word = word.slice(0, -6);
        rv = rv.slice(0, -6);
      } else if (r2.endsWith(suffix)) {
        step1Success = true;
        if (
          suffix === "azione" || suffix === "azioni" ||
          suffix === "atore" || suffix === "atori"
        ) {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          if (r2.endsWith("ic")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          }
        } else if (suffix === "logia" || suffix === "logie") {
          word = word.slice(0, -2);
          rv = word.slice(0, -2);
        } else if (
          suffix === "uzione" || suffix === "uzioni" ||
          suffix === "usione" || suffix === "usioni"
        ) {
          word = word.slice(0, -5);
          rv = rv.slice(0, -5);
        } else if (suffix === "enza" || suffix === "enze") {
          word = suffixReplace(word, suffix, "te");
          rv = suffixReplace(rv, suffix, "te");
        } else if (suffix === "ità") {
          word = word.slice(0, -3);
          r2 = r2.slice(0, -3);
          rv = rv.slice(0, -3);
          if (r2.endsWith("ic") || r2.endsWith("iv")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          } else if (r2.endsWith("abil")) {
            word = word.slice(0, -4);
            rv = rv.slice(0, -4);
          }
        } else if (
          suffix === "ivo" || suffix === "ivi" || suffix === "iva" || suffix === "ive"
        ) {
          word = word.slice(0, -3);
          r2 = r2.slice(0, -3);
          rv = rv.slice(0, -3);
          if (r2.endsWith("at")) {
            word = word.slice(0, -2);
            r2 = r2.slice(0, -2);
            rv = rv.slice(0, -2);
            if (r2.endsWith("ic")) {
              word = word.slice(0, -2);
              rv = rv.slice(0, -2);
            }
          }
        } else {
          word = word.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
        }
      }
      break;
    }
  }

  // STEP 2: Verb suffixes
  if (!step1Success) {
    for (const suffix of ITALIAN_STEP2_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }
  }

  // STEP 3a
  if (endsWithAny(rv, ["a", "e", "i", "o", "à", "è", "ì", "ò"])) {
    word = word.slice(0, -1);
    rv = rv.slice(0, -1);
    if (rv.endsWith("i")) {
      word = word.slice(0, -1);
      rv = rv.slice(0, -1);
    }
  }

  // STEP 3b
  if (rv.endsWith("ch") || rv.endsWith("gh")) {
    word = word.slice(0, -1);
  }

  word = word.replace(/I/g, "i").replace(/U/g, "u");

  return word;
}

