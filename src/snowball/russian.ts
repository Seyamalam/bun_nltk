import { at } from "./helpers";

// Russian
// ---------------------------------------------------------------------------

const RUSSIAN_PERFECTIVE_GERUND_SUFFIXES = [
  "ivshis'", "yvshis'", "vshis'", "ivshi", "yvshi", "vshi", "iv", "yv", "v",
];
const RUSSIAN_ADJECTIVAL_SUFFIXES = [
  "ui^ushchi^ui^u", "ui^ushchi^ai^a", "ui^ushchimi", "ui^ushchymi",
  "ui^ushchego", "ui^ushchogo", "ui^ushchemu", "ui^ushchomu",
  "ui^ushchikh", "ui^ushchykh", "ui^ushchui^u", "ui^ushchaia",
  "ui^ushchoi^u", "ui^ushchei^u", "i^ushchi^ui^u", "i^ushchi^ai^a",
  "ui^ushchee", "ui^ushchie", "ui^ushchye", "ui^ushchoe", "ui^ushchei`",
  "ui^ushchii`", "ui^ushchyi`", "ui^ushchoi`", "ui^ushchem", "ui^ushchim",
  "ui^ushchym", "ui^ushchom", "i^ushchimi", "i^ushchymi", "i^ushchego",
  "i^ushchogo", "i^ushchemu", "i^ushchomu", "i^ushchikh", "i^ushchykh",
  "i^ushchui^u", "i^ushchai^a", "i^ushchoi^u", "i^ushchei^u", "i^ushchee",
  "i^ushchie", "i^ushchye", "i^ushchoe", "i^ushchei`", "i^ushchii`",
  "i^ushchyi`", "i^ushchoi`", "i^ushchem", "i^ushchim", "i^ushchym",
  "i^ushchom", "shchi^ui^u", "shchi^ai^a", "ivshi^ui^u", "ivshi^ai^a",
  "yvshi^ui^u", "yvshi^ai^a", "shchimi", "shchymi", "shchego", "shchogo",
  "shchemu", "shchomu", "shchikh", "shchykh", "shchui^u", "shchai^a",
  "shchoi^u", "shchei^u", "ivshimi", "ivshymi", "ivshego", "ivshogo",
  "ivshemu", "ivshomu", "ivshikh", "ivshykh", "ivshui^u", "ivshai^a",
  "ivshoi^u", "ivshei^u", "yvshimi", "yvshymi", "yvshego", "yvshogo",
  "yvshemu", "yvshomu", "yvshikh", "yvshykh", "yvshui^u", "yvshai^a",
  "yvshoi^u", "yvshei^u", "vshi^ui^u", "vshi^ai^a", "shchee", "shchie",
  "shchye", "shchoe", "shchei`", "shchii`", "shchyi`", "shchoi`", "shchem",
  "shchim", "shchym", "shchom", "ivshee", "ivshie", "ivshye", "ivshoe",
  "ivshei`", "ivshii`", "ivshyi`", "ivshoi`", "ivshem", "ivshim", "ivshym",
  "ivshom", "yvshee", "yvshie", "yvshye", "yvshoe", "yvshei`", "yvshii`",
  "yvshyi`", "yvshoi`", "yvshem", "yvshim", "yvshym", "yvshom", "vshimi",
  "vshymi", "vshego", "vshogo", "vshemu", "vshomu", "vshikh", "vshykh",
  "vshui^u", "vshai^a", "vshoi^u", "vshei^u", "emi^ui^u", "emi^ai^a",
  "nni^ui^u", "nni^ai^a", "vshee", "vshie", "vshye", "vshoe", "vshei`",
  "vshii`", "vshyi`", "vshoi`", "vshem", "vshim", "vshym", "vshom", "emimi",
  "emymi", "emego", "emogo", "ememu", "emomu", "emikh", "emykh", "emui^u",
  "emai^a", "emoi^u", "emei^u", "nnimi", "nnymi", "nnego", "nnogo", "nnemu",
  "nnomu", "nnikh", "nnykh", "nnui^u", "nnai^a", "nnoi^u", "nnei^u", "emee",
  "emie", "emye", "emoe", "emei`", "emii`", "emyi`", "emoi`", "emem", "emim",
  "emym", "emom", "nnee", "nnie", "nnye", "nnoe", "nnei`", "nnii`", "nnyi`",
  "nnoi`", "nnem", "nnim", "nnym", "nnom", "i^ui^u", "i^ai^a", "imi", "ymi",
  "ego", "ogo", "emu", "omu", "ikh", "ykh", "ui^u", "ai^a", "oi^u", "ei^u",
  "ee", "ie", "ye", "oe", "ei`", "ii`", "yi`", "oi`", "em", "im", "ym", "om",
];
const RUSSIAN_ADJECTIVAL_A_CHECK = new Set([
  "i^ushchi^ui^u", "i^ushchi^ai^a", "i^ushchui^u", "i^ushchai^a",
  "i^ushchoi^u", "i^ushchei^u", "i^ushchimi", "i^ushchymi", "i^ushchego",
  "i^ushchogo", "i^ushchemu", "i^ushchomu", "i^ushchikh", "i^ushchykh",
  "shchi^ui^u", "shchi^ai^a", "i^ushchee", "i^ushchie", "i^ushchye",
  "i^ushchoe", "i^ushchei`", "i^ushchii`", "i^ushchyi`", "i^ushchoi`",
  "i^ushchem", "i^ushchim", "i^ushchym", "i^ushchom", "vshi^ui^u",
  "vshi^ai^a", "shchui^u", "shchai^a", "shchoi^u", "shchei^u", "emi^ui^u",
  "emi^ai^a", "nni^ui^u", "nni^ai^a", "shchimi", "shchymi", "shchego",
  "shchogo", "shchemu", "shchomu", "shchikh", "shchykh", "vshui^u",
  "vshai^a", "vshoi^u", "vshei^u", "shchee", "shchie", "shchye", "shchoe",
  "shchei`", "shchii`", "shchyi`", "shchoi`", "shchem", "shchim", "shchym",
  "shchom", "vshimi", "vshymi", "vshego", "vshogo", "vshemu", "vshomu",
  "vshikh", "vshykh", "emui^u", "emai^a", "emoi^u", "emei^u", "nnui^u",
  "nnai^a", "nnoi^u", "nnei^u", "vshee", "vshie", "vshye", "vshoe",
  "vshei`", "vshii`", "vshyi`", "vshoi`", "vshem", "vshim", "vshym",
  "vshom", "emimi", "emymi", "emego", "emogo", "ememu", "emomu", "emikh",
  "emykh", "nnimi", "nnymi", "nnego", "nnogo", "nnemu", "nnomu", "nnikh",
  "nnykh", "emee", "emie", "emye", "emoe", "emei`", "emii`", "emyi`",
  "emoi`", "emem", "emim", "emym", "emom", "nnee", "nnie", "nnye", "nnoe",
  "nnei`", "nnii`", "nnyi`", "nnoi`", "nnem", "nnim", "nnym", "nnom",
]);
const RUSSIAN_REFLEXIVE_SUFFIXES = ["si^a", "s'"];
const RUSSIAN_VERB_SUFFIXES = [
  "esh'", "ei`te", "ui`te", "ui^ut", "ish'", "ete", "i`te", "i^ut", "nno",
  "ila", "yla", "ena", "ite", "ili", "yli", "ilo", "ylo", "eno", "i^at",
  "uet", "eny", "it'", "yt'", "ui^u", "la", "na", "li", "em", "lo", "no",
  "et", "ny", "t'", "ei`", "ui`", "il", "yl", "im", "ym", "en", "it", "yt",
  "i^u", "i`", "l", "n",
];
const RUSSIAN_VERB_A_CHECK = new Set([
  "la", "na", "ete", "i`te", "li", "i`", "l", "em", "n", "lo", "no", "et",
  "i^ut", "ny", "t'", "esh'", "nno",
]);
const RUSSIAN_NOUN_SUFFIXES = [
  "ii^ami", "ii^akh", "i^ami", "ii^am", "i^akh", "ami", "iei`", "i^am",
  "iem", "akh", "ii^u", "'i^u", "ii^a", "'i^a", "ev", "ov", "ie", "'e",
  "ei", "ii", "ei`", "oi`", "ii`", "em", "am", "om", "i^u", "i^a", "a",
  "e", "i", "i`", "o", "u", "y", "'",
];
const RUSSIAN_SUPERLATIVE_SUFFIXES = ["ei`she", "ei`sh"];
const RUSSIAN_DERIVATIONAL_SUFFIXES = ["ost'", "ost"];

function cyrillicToRoman(word: string): string {
  return word
    .replace(/А/g, "a").replace(/а/g, "a")
    .replace(/Б/g, "b").replace(/б/g, "b")
    .replace(/В/g, "v").replace(/в/g, "v")
    .replace(/Г/g, "g").replace(/г/g, "g")
    .replace(/Д/g, "d").replace(/д/g, "d")
    .replace(/Е/g, "e").replace(/е/g, "e")
    .replace(/Ё/g, "e").replace(/ё/g, "e")
    .replace(/Ж/g, "zh").replace(/ж/g, "zh")
    .replace(/З/g, "z").replace(/з/g, "z")
    .replace(/И/g, "i").replace(/и/g, "i")
    .replace(/Й/g, "i`").replace(/й/g, "i`")
    .replace(/К/g, "k").replace(/к/g, "k")
    .replace(/Л/g, "l").replace(/л/g, "l")
    .replace(/М/g, "m").replace(/м/g, "m")
    .replace(/Н/g, "n").replace(/н/g, "n")
    .replace(/О/g, "o").replace(/о/g, "o")
    .replace(/П/g, "p").replace(/п/g, "p")
    .replace(/Р/g, "r").replace(/р/g, "r")
    .replace(/С/g, "s").replace(/с/g, "s")
    .replace(/Т/g, "t").replace(/т/g, "t")
    .replace(/У/g, "u").replace(/у/g, "u")
    .replace(/Ф/g, "f").replace(/ф/g, "f")
    .replace(/Х/g, "kh").replace(/х/g, "kh")
    .replace(/Ц/g, "t^s").replace(/ц/g, "t^s")
    .replace(/Ч/g, "ch").replace(/ч/g, "ch")
    .replace(/Ш/g, "sh").replace(/ш/g, "sh")
    .replace(/Щ/g, "shch").replace(/щ/g, "shch")
    .replace(/Ъ/g, "''").replace(/ъ/g, "''")
    .replace(/Ы/g, "y").replace(/ы/g, "y")
    .replace(/Ь/g, "'").replace(/ь/g, "'")
    .replace(/Э/g, "e`").replace(/э/g, "e`")
    .replace(/Ю/g, "i^u").replace(/ю/g, "i^u")
    .replace(/Я/g, "i^a").replace(/я/g, "i^a");
}

function romanToCyrillic(word: string): string {
  return word
    .replace(/i\^u/g, "ю")
    .replace(/i\^a/g, "я")
    .replace(/shch/g, "щ")
    .replace(/kh/g, "х")
    .replace(/t\^s/g, "ц")
    .replace(/ch/g, "ч")
    .replace(/e`/g, "э")
    .replace(/i`/g, "й")
    .replace(/sh/g, "ш")
    .replace(/k/g, "к")
    .replace(/e/g, "е")
    .replace(/zh/g, "ж")
    .replace(/a/g, "а")
    .replace(/b/g, "б")
    .replace(/v/g, "в")
    .replace(/g/g, "г")
    .replace(/d/g, "д")
    .replace(/e/g, "е")
    .replace(/z/g, "з")
    .replace(/i/g, "и")
    .replace(/l/g, "л")
    .replace(/m/g, "м")
    .replace(/n/g, "н")
    .replace(/o/g, "о")
    .replace(/p/g, "п")
    .replace(/r/g, "р")
    .replace(/s/g, "с")
    .replace(/t/g, "т")
    .replace(/u/g, "у")
    .replace(/f/g, "ф")
    .replace(/''/g, "ъ")
    .replace(/y/g, "ы")
    .replace(/'/g, "ь");
}

function regionsRussian(word: string): { rv: string; r2: string } {
  let r1 = "";
  let r2 = "";
  let rv = "";

  const vowels = "AUaeiouy";
  const marked = word.replace(/i\^a/g, "A").replace(/i\^u/g, "U").replace(/e`/g, "E");

  for (let i = 1; i < marked.length; i++) {
    if (!vowels.includes(marked[i]!) && vowels.includes(marked[i - 1]!)) {
      r1 = marked.slice(i + 1);
      break;
    }
  }

  for (let i = 1; i < r1.length; i++) {
    if (!vowels.includes(r1[i]!) && vowels.includes(r1[i - 1]!)) {
      r2 = r1.slice(i + 1);
      break;
    }
  }

  for (let i = 0; i < marked.length; i++) {
    if (vowels.includes(marked[i]!)) {
      rv = marked.slice(i + 1);
      break;
    }
  }

  r2 = r2.replace(/A/g, "i^a").replace(/U/g, "i^u").replace(/E/g, "e`");
  rv = rv.replace(/A/g, "i^a").replace(/U/g, "i^u").replace(/E/g, "e`");

  return { rv, r2 };
}

export function stemRussian(input: string): string {
  let word = input;

  let chrExceeded = false;
  for (const ch of word) {
    if (ch.codePointAt(0)! > 255) {
      chrExceeded = true;
      break;
    }
  }
  if (!chrExceeded) {
    return word;
  }

  word = cyrillicToRoman(word);

  let step1Success = false;
  let adjectivalRemoved = false;
  let verbRemoved = false;
  let undoubleSuccess = false;
  let superlativeRemoved = false;

  const regions = regionsRussian(word);
  let rv = regions.rv;
  let r2 = regions.r2;

  // Step 1
  for (const suffix of RUSSIAN_PERFECTIVE_GERUND_SUFFIXES) {
    if (rv.endsWith(suffix)) {
      if (suffix === "v" || suffix === "vshi" || suffix === "vshis'") {
        if (
          rv.slice(-(suffix.length + 3), -suffix.length) === "i^a" ||
          rv.slice(-(suffix.length + 1), -suffix.length) === "a"
        ) {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          step1Success = true;
          break;
        }
      } else {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        step1Success = true;
        break;
      }
    }
  }

  if (!step1Success) {
    for (const suffix of RUSSIAN_REFLEXIVE_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
        rv = rv.slice(0, -suffix.length);
        break;
      }
    }

    for (const suffix of RUSSIAN_ADJECTIVAL_SUFFIXES) {
      if (rv.endsWith(suffix)) {
        if (RUSSIAN_ADJECTIVAL_A_CHECK.has(suffix)) {
          if (
            rv.slice(-(suffix.length + 3), -suffix.length) === "i^a" ||
            rv.slice(-(suffix.length + 1), -suffix.length) === "a"
          ) {
            word = word.slice(0, -suffix.length);
            r2 = r2.slice(0, -suffix.length);
            rv = rv.slice(0, -suffix.length);
            adjectivalRemoved = true;
            break;
          }
        } else {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          adjectivalRemoved = true;
          break;
        }
      }
    }

    if (!adjectivalRemoved) {
      for (const suffix of RUSSIAN_VERB_SUFFIXES) {
        if (rv.endsWith(suffix)) {
          if (RUSSIAN_VERB_A_CHECK.has(suffix)) {
            if (
              rv.slice(-(suffix.length + 3), -suffix.length) === "i^a" ||
              rv.slice(-(suffix.length + 1), -suffix.length) === "a"
            ) {
              word = word.slice(0, -suffix.length);
              r2 = r2.slice(0, -suffix.length);
              rv = rv.slice(0, -suffix.length);
              verbRemoved = true;
              break;
            }
          } else {
            word = word.slice(0, -suffix.length);
            r2 = r2.slice(0, -suffix.length);
            rv = rv.slice(0, -suffix.length);
            verbRemoved = true;
            break;
          }
        }
      }
    }

    if (!adjectivalRemoved && !verbRemoved) {
      for (const suffix of RUSSIAN_NOUN_SUFFIXES) {
        if (rv.endsWith(suffix)) {
          word = word.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          rv = rv.slice(0, -suffix.length);
          break;
        }
      }
    }
  }

  // Step 2
  if (rv.endsWith("i")) {
    word = word.slice(0, -1);
    r2 = r2.slice(0, -1);
  }

  // Step 3
  for (const suffix of RUSSIAN_DERIVATIONAL_SUFFIXES) {
    if (r2.endsWith(suffix)) {
      word = word.slice(0, -suffix.length);
      break;
    }
  }

  // Step 4
  if (word.endsWith("nn")) {
    word = word.slice(0, -1);
    undoubleSuccess = true;
  }

  if (!undoubleSuccess) {
    for (const suffix of RUSSIAN_SUPERLATIVE_SUFFIXES) {
      if (word.endsWith(suffix)) {
        word = word.slice(0, -suffix.length);
        superlativeRemoved = true;
        break;
      }
    }
    if (word.endsWith("nn")) {
      word = word.slice(0, -1);
    }
  }

  if (!undoubleSuccess && !superlativeRemoved) {
    if (word.endsWith("'")) {
      word = word.slice(0, -1);
    }
  }

  word = romanToCyrillic(word);

  return word;
}

