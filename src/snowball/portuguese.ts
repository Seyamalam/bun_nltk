import { at, r1r2Standard, rvStandard, suffixReplace } from "./helpers";

// Portuguese
// ---------------------------------------------------------------------------

const PORTUGUESE_VOWELS = "aeiouáéíóúâêô";
const PORTUGUESE_STEP1_SUFFIXES = [
  "amentos", "imentos", "uço~es", "amento", "imento", "adoras", "adores",
  "aço~es", "logias", "ências", "amente", "idades", "anças", "ismos",
  "istas", "adora", "aça~o", "antes", "ância", "logia", "uça~o", "ência",
  "mente", "idade", "ança", "ezas", "icos", "icas", "ismo", "ável", "ível",
  "ista", "osos", "osas", "ador", "ante", "ivas", "ivos", "iras", "eza",
  "ico", "ica", "oso", "osa", "iva", "ivo", "ira",
];
const PORTUGUESE_STEP2_SUFFIXES = [
  "aríamos", "eríamos", "iríamos", "ássemos", "êssemos", "íssemos",
  "ardeis", "erdeis", "irdeis", "ásseis", "ésseis", "ísseis", "áramos",
  "éramos", "íramos", "ávamos", "aremos", "eremos", "iremos", "ariam",
  "eriam", "iriam", "assem", "essem", "issem", "ara~o", "era~o", "ira~o",
  "arias", "erias", "irias", "ardes", "erdes", "irdes", "asses", "esses",
  "isses", "astes", "estes", "istes", "áreis", "areis", "éreis", "ereis",
  "íreis", "ireis", "áveis", "ídamos", "armos", "ermos", "irmos", "aria",
  "eria", "iria", "asse", "esse", "isse", "aste", "este", "iste", "arei",
  "erei", "irei", "aram", "eram", "iram", "avam", "arem", "erem", "irem",
  "ando", "endo", "indo", "adas", "idas", "arás", "aras", "erás", "eras",
  "irás", "avas", "ares", "eres", "ires", "ídeis", "ados", "idos", "ámos",
  "amos", "emos", "imos", "iras", "ada", "ida", "ará", "ara", "erá", "era",
  "irá", "ava", "iam", "ado", "ido", "ias", "ais", "eis", "ira", "ia", "ei",
  "am", "em", "ar", "er", "ir", "as", "es", "is", "eu", "iu", "ou",
];
const PORTUGUESE_STEP4_SUFFIXES = ["os", "a", "i", "o", "á", "í", "ó"];

export function stemPortuguese(input: string): string {
  let word = input.toLowerCase();
  let step1Success = false;
  let step2Success = false;

  word = word
    .replace(/ã/g, "a~")
    .replace(/õ/g, "o~")
    .replace(/qü/g, "qu")
    .replace(/gü/g, "gu");

  const std = r1r2Standard(word, PORTUGUESE_VOWELS);
  const r1 = std.r1;
  let r2 = std.r2;
  let rv = rvStandard(word, PORTUGUESE_VOWELS);

  // STEP 1: Standard suffix removal
  for (const suffix of PORTUGUESE_STEP1_SUFFIXES) {
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
        } else if (r2.endsWith("os") || r2.endsWith("ic") || r2.endsWith("ad")) {
          word = word.slice(0, -2);
          rv = rv.slice(0, -2);
        }
      } else if (
        (suffix === "ira" || suffix === "iras") &&
        rv.endsWith(suffix) &&
        word.slice(-(suffix.length + 1), -suffix.length) === "e"
      ) {
        step1Success = true;
        word = suffixReplace(word, suffix, "ir");
        rv = suffixReplace(rv, suffix, "ir");
      } else if (r2.endsWith(suffix)) {
        step1Success = true;
        if (suffix === "logia" || suffix === "logias") {
          word = suffixReplace(word, suffix, "log");
          rv = suffixReplace(rv, suffix, "log");
        } else if (suffix === "uça~o" || suffix === "uço~es") {
          word = suffixReplace(word, suffix, "u");
          rv = suffixReplace(rv, suffix, "u");
        } else if (suffix === "ência" || suffix === "ências") {
          word = suffixReplace(word, suffix, "ente");
          rv = suffixReplace(rv, suffix, "ente");
        } else if (suffix === "mente") {
          word = word.slice(0, -5);
          r2 = r2.slice(0, -5);
          rv = rv.slice(0, -5);
          if (r2.endsWith("ante") || r2.endsWith("avel") || r2.endsWith("ivel")) {
            word = word.slice(0, -4);
            rv = rv.slice(0, -4);
          }
        } else if (suffix === "idade" || suffix === "idades") {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          if (r2.endsWith("ic") || r2.endsWith("iv")) {
            word = word.slice(0, -2);
            rv = rv.slice(0, -2);
          } else if (r2.endsWith("abil")) {
            word = word.slice(0, -4);
            rv = rv.slice(0, -4);
          }
        } else if (
          suffix === "iva" || suffix === "ivo" || suffix === "ivas" || suffix === "ivos"
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
  }

  // STEP 2: Verb suffixes
  if (!step1Success) {
    for (const suffix of PORTUGUESE_STEP2_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        step2Success = true;
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }
  }

  // STEP 3
  if (step1Success || step2Success) {
    if (rv.endsWith("i") && at(word, -2) === "c") {
      word = word.slice(0, -1);
      rv = rv.slice(0, -1);
    }
  }

  // STEP 4: Residual suffix
  if (!step1Success && !step2Success) {
    for (const suffix of PORTUGUESE_STEP4_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }
  }

  // STEP 5
  if (rv.endsWith("e") || rv.endsWith("é") || rv.endsWith("ê")) {
    word = word.slice(0, -1);
    rv = rv.slice(0, -1);
    if (
      (word.endsWith("gu") && rv.endsWith("u")) ||
      (word.endsWith("ci") && rv.endsWith("i"))
    ) {
      word = word.slice(0, -1);
    }
  } else if (word.endsWith("ç")) {
    word = suffixReplace(word, "ç", "c");
  }

  word = word.replace(/a~/g, "ã").replace(/o~/g, "õ");

  return word;
}

