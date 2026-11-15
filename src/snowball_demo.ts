// nltk.stem.snowball.demo — interactive Snowball-stemmer tour over the UDHR
// corpus. input() is injectable so the oracle can drive the loop; an
// exhausted input function raises EOFError like python's input().
// Original: nltk/stem/snowball.py

import { pyError } from "./internals";
import { type PrintSink } from "./ext_pure";
import { SnowballStemmer } from "./stemmers";
import { UdhrCorpusReader } from "./corpus_text_readers";

const print_ = (out: PrintSink, s: string): void => out(`${s}\n`);

/** Python str.center(width). */
const pyCenter = (s: string, width: number): string => {
  const marg = width - s.length;
  if (marg <= 0) return s;
  const left = Math.floor(marg / 2) + ((marg & width) & 1);
  return " ".repeat(left) + s + " ".repeat(marg - left);
};

/** re.sub(r"(.{,70})\s", r"\1\n", s + " ").rstrip() — python `.{,70}` == `.{0,70}`. */
const wrap70 = (s: string): string =>
  (s + " ").replace(/(.{0,70})\s/g, "$1\n").replace(/\s+$/, "");

const UDHR_CORPUS: Record<string, string> = {
  arabic: "Arabic_Alarabia-Arabic",
  danish: "Danish_Dansk-Latin1",
  dutch: "Dutch_Nederlands-Latin1",
  english: "English-Latin1",
  finnish: "Finnish_Suomi-Latin1",
  french: "French_Francais-Latin1",
  german: "German_Deutsch-Latin1",
  hungarian: "Hungarian_Magyar-UTF8",
  italian: "Italian_Italiano-Latin1",
  norwegian: "Norwegian-Latin1",
  porter: "English-Latin1",
  portuguese: "Portuguese_Portugues-Latin1",
  romanian: "Romanian_Romana-Latin2",
  russian: "Russian-UTF8",
  spanish: "Spanish-Latin1",
  swedish: "Swedish_Svenska-Latin1",
};

/**
 * nltk.stem.snowball.demo — adapted: `input()` comes from `inputFn`
 * (python reads stdin); output goes to `out`. Passing `null`/returning
 * null from inputFn raises EOFError like python's input() at EOF.
 */
export function demo(inputFn: () => string | null, out: PrintSink = (s) => process.stdout.write(s)): void {
  const udhr = new UdhrCorpusReader();
  const languages = SnowballStemmer.languages;

  const input = (prompt: string): string => {
    out(prompt);
    const v = inputFn();
    if (v === null) throw pyError("EOFError", "EOF when reading a line");
    return v;
  };

  print_(out, "\n");
  print_(out, "******************************");
  print_(out, "Demo for the Snowball stemmers");
  print_(out, "******************************");

  for (;;) {
    const language = input(
      "Please enter the name of the language " +
      "to be demonstrated\n" +
      languages.join("/") +
      "\n(enter 'exit' in order to leave): ",
    );

    if (language === "exit") break;

    if (!languages.includes(language)) {
      print_(out, "\nOops, there is no stemmer for this language. Please try again.\n");
      continue;
    }

    const stemmer = new SnowballStemmer(language);
    const excerpt = (udhr.words(UDHR_CORPUS[language]!) as string[] | { toArray(): string[] });
    const excerptArr = Array.isArray(excerpt) ? excerpt : excerpt.toArray();
    const first300 = excerptArr.slice(0, 300);

    let stemmed = first300.map((word) => stemmer.stem(word)).join(" ");
    stemmed = wrap70(stemmed);
    const excerptJoined = wrap70(first300.join(" "));

    print_(out, "\n");
    print_(out, "-".repeat(70));
    print_(out, pyCenter("ORIGINAL", 70));
    print_(out, excerptJoined);
    print_(out, "\n\n");
    print_(out, pyCenter("STEMMED RESULTS", 70));
    print_(out, stemmed);
    print_(out, "-".repeat(70));
    print_(out, "\n");
  }
}
