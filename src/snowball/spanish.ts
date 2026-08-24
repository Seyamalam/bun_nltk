import { endsWithAny, r1r2Standard, rvStandard, suffixReplace } from "./helpers";

// Spanish
// ---------------------------------------------------------------------------

const SPANISH_VOWELS = "aeiouáéíóúü";
const SPANISH_STEP0_SUFFIXES = [
  "selas", "selos", "sela", "selo", "las", "les", "los", "nos", "me", "se",
  "la", "le", "lo",
];
const SPANISH_STEP1_SUFFIXES = [
  "amientos", "imientos", "amiento", "imiento", "acion", "aciones",
  "uciones", "adoras", "adores", "ancias", "logías", "encias", "amente",
  "idades", "anzas", "ismos", "ables", "ibles", "istas", "adora", "ación",
  "antes", "ancia", "logía", "ución", "encia", "mente", "anza", "icos",
  "icas", "ismo", "able", "ible", "ista", "osos", "osas", "ador", "ante",
  "idad", "ivas", "ivos", "ico", "ica", "oso", "osa", "iva", "ivo",
];
const SPANISH_STEP2A_SUFFIXES = [
  "yeron", "yendo", "yamos", "yais", "yan", "yen", "yas", "yes", "ya", "ye",
  "yo", "yó",
];
const SPANISH_STEP2B_SUFFIXES = [
  "aríamos", "eríamos", "iríamos", "iéramos", "iésemos", "aríais",
  "aremos", "eríais", "eremos", "iríais", "iremos", "ierais", "ieseis",
  "asteis", "isteis", "ábamos", "áramos", "ásemos", "arían", "arías",
  "aréis", "erían", "erías", "eréis", "irían", "irías", "iréis", "ieran",
  "iesen", "ieron", "iendo", "ieras", "ieses", "abais", "arais", "aseis",
  "éamos", "arán", "arás", "aría", "erán", "erás", "ería", "irán", "irás",
  "iría", "iera", "iese", "aste", "iste", "aban", "aran", "asen", "aron",
  "ando", "abas", "adas", "idas", "aras", "ases", "íais", "ados", "idos",
  "amos", "imos", "emos", "ará", "aré", "erá", "eré", "irá", "iré", "aba",
  "ada", "ida", "ara", "ase", "ían", "ado", "ido", "ías", "áis", "éis",
  "ía", "ad", "ed", "id", "an", "ió", "ar", "er", "ir", "as", "ís", "en",
  "es",
];
const SPANISH_STEP3_SUFFIXES = ["os", "a", "e", "o", "á", "é", "í", "ó"];

function replaceAccentedSpanish(word: string): string {
  return word
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u");
}

export function stemSpanish(input: string): string {
  let word = input.toLowerCase();
  let step1Success = false;

  const std = r1r2Standard(word, SPANISH_VOWELS);
  let r1 = std.r1;
  let r2 = std.r2;
  let rv = rvStandard(word, SPANISH_VOWELS);

  // STEP 0: Attached pronoun
  for (const suffix of SPANISH_STEP0_SUFFIXES) {
    if (!(word.endsWith(suffix) && rv.endsWith(suffix))) {
      continue;
    }

    const rvPrefix = rv.slice(0, -suffix.length);
    if (
      endsWithAny(rvPrefix, [
        "ando", "ándo", "ar", "ár", "er", "ér", "iendo", "iéndo", "ir", "ír",
      ]) ||
      (rvPrefix.endsWith("yendo") && word.slice(0, -suffix.length).endsWith("uyendo"))
    ) {
      word = replaceAccentedSpanish(word.slice(0, -suffix.length));
      r1 = replaceAccentedSpanish(r1.slice(0, -suffix.length));
      r2 = replaceAccentedSpanish(r2.slice(0, -suffix.length));
      rv = replaceAccentedSpanish(rv.slice(0, -suffix.length));
    }
    break;
  }

  // STEP 1: Standard suffix removal
  for (const suffix of SPANISH_STEP1_SUFFIXES) {
    if (!word.endsWith(suffix)) {
      continue;
    }

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
      } else if (r2.endsWith("os") || r2.endsWith("ic") || r2.endsWith("ad")) {
        word = word.slice(0, -2);
        rv = rv.slice(0, -2);
      }
    } else if (r2.endsWith(suffix)) {
      step1Success = true;
      if (
        suffix === "adora" || suffix === "ador" || suffix === "ación" ||
        suffix === "adoras" || suffix === "adores" || suffix === "acion" ||
        suffix === "aciones" || suffix === "ante" || suffix === "antes" ||
        suffix === "ancia" || suffix === "ancias"
      ) {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        if (r2.endsWith("ic")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        }
      } else if (suffix === "logía" || suffix === "logías") {
        word = suffixReplace(word, suffix, "log");
        rv = suffixReplace(rv, suffix, "log");
      } else if (suffix === "ución" || suffix === "uciones") {
        word = suffixReplace(word, suffix, "u");
        rv = suffixReplace(rv, suffix, "u");
      } else if (suffix === "encia" || suffix === "encias") {
        word = suffixReplace(word, suffix, "ente");
        rv = suffixReplace(rv, suffix, "ente");
      } else if (suffix === "mente") {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        if (r2.endsWith("ante") || r2.endsWith("able") || r2.endsWith("ible")) {
          word = word.slice(0, -4);
          rv = rv.slice(0, -4);
        }
      } else if (suffix === "idad" || suffix === "idades") {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        for (const preSuff of ["abil", "ic", "iv"]) {
          if (r2.endsWith(preSuff)) {
            word = word.slice(0, -preSuff.length);
            rv = rv.slice(0, -preSuff.length);
          }
        }
      } else if (
        suffix === "ivo" || suffix === "iva" || suffix === "ivos" || suffix === "ivas"
      ) {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        if (r2.endsWith("at")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        }
      } else {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
      }
    }
    break;
  }

  // STEP 2a: Verb suffixes beginning 'y'
  if (!step1Success) {
    for (const suffix of SPANISH_STEP2A_SUFFIXES) {
      if (rv.endsWith(suffix) && word.slice(-(suffix.length + 1), -suffix.length) === "u") {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }

    // STEP 2b: Other verb suffixes
    for (const suffix of SPANISH_STEP2B_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        if (suffix === "en" || suffix === "es" || suffix === "éis" || suffix === "emos") {
          if (word.endsWith("gu")) {
            word = word.slice(0, -1);
          }
          if (rv.endsWith("gu")) {
            rv = rv.slice(0, -1);
          }
        }
        break;
      }
    }
  }

  // STEP 3: Residual suffix
  for (const suffix of SPANISH_STEP3_SUFFIXES) {
    if (rv.endsWith(suffix)) {
      word = word.slice(0, -suffix.length);
      if (suffix === "e" || suffix === "é") {
        rv = rv.slice(0, -suffix.length);
        if (word.slice(-2) === "gu" && rv.endsWith("u")) {
          word = word.slice(0, -1);
        }
      }
      break;
    }
  }

  word = replaceAccentedSpanish(word);

  return word;
}

