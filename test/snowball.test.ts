import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { SNOWBALL_LANGUAGES, snowballStem } from "../src/snowball";

test("snowballStem english Porter2 spec vectors", () => {
  expect(snowballStem("generously", "english")).toBe("generous");
  expect(snowballStem("agreed", "english")).toBe("agre");
  expect(snowballStem("agreement", "english")).toBe("agreement");
  expect(snowballStem("running", "english")).toBe("run");
  expect(snowballStem("studies", "english")).toBe("studi");
  expect(snowballStem("flies", "english")).toBe("fli");
  expect(snowballStem("dies", "english")).toBe("die");
  expect(snowballStem("denied", "english")).toBe("deni");
  expect(snowballStem("sky", "english")).toBe("sky");
  expect(snowballStem("news", "english")).toBe("news");
  expect(snowballStem("proceed", "english")).toBe("proceed");
  expect(snowballStem("nationalization", "english")).toBe("nation");
  expect(snowballStem("rational", "english")).toBe("ration");
});

test("snowballStem french handles accents and undoubling", () => {
  expect(snowballStem("réellement", "french")).toBe("réel");
  expect(snowballStem("constitutionnelles", "french")).toBe("constitutionnel");
  expect(snowballStem("coopération", "french")).toBe("cooper");
  expect(snowballStem("généralement", "french")).toBe("général");
});

test("snowballStem german handles eszett and umlauts", () => {
  expect(snowballStem("Strauße", "german")).toBe("strauss");
  expect(snowballStem("häuser", "german")).toBe("haus");
  expect(snowballStem("entwicklung", "german")).toBe("entwickl");
  expect(snowballStem("universität", "german")).toBe("universitat");
});

test("snowballStem russian stems cyrillic words", () => {
  expect(snowballStem("работа", "russian")).toBe("работ");
  expect(snowballStem("развитие", "russian")).toBe("развит");
});

test("snowballStem lowercases like NLTK", () => {
  expect(snowballStem("Running", "english")).toBe("run");
  expect(snowballStem("ÉTABLISSEMENT", "french")).toBe(
    snowballStem("établissement", "french"),
  );
});

test("snowballStem russian transliteration round-trips cyrillic case", () => {
  expect(snowballStem("РАБОТА", "russian")).toBe("работ");
  expect(snowballStem("Работа", "russian")).toBe("работ");
});

test("snowballStem throws on unsupported language", () => {
  expect(() => snowballStem("running", "finnish")).toThrowError(
    "The language 'finnish' is not supported.",
  );
});

test("SNOWBALL_LANGUAGES registry covers the ported languages", () => {
  expect(SNOWBALL_LANGUAGES).toContain("english");
  expect(SNOWBALL_LANGUAGES).toContain("russian");
  expect(SNOWBALL_LANGUAGES.length).toBe(12);
});

type PythonBaseline = Record<string, string[]>;

function runPythonSnowballBaseline(langWords: Record<string, string[]>): PythonBaseline {
  const proc = Bun.spawnSync(
    ["python3", "bench/python_snowball_baseline.py", "--payload", JSON.stringify({ lang_words: langWords })],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonBaseline;
}

test("snowball parity with python3 nltk baseline", () => {
  const langWords: Record<string, string[]> = {
    english: ["generously", "agreed", "running", "studies", "flies", "nationalization"],
    french: ["réellement", "constitutionnelles", "coopération", "chevaux"],
    german: ["Strauße", "häuser", "entwicklung", "geschwindigkeit"],
    spanish: ["avión", "caminando", "producción"],
    italian: ["attività", "produzione", "metropolitana"],
    dutch: ["aanschouwde", "geleerdheid", "mogelijkheden"],
    portuguese: ["importância", "esperança", "constituição"],
    romanian: ["copiii", "omului", "libertatea"],
    danish: ["jagten", "børnene", "udvikling"],
    norwegian: ["jaktene", "barnas", "utvikling"],
    swedish: ["jakterna", "barnens", "utveckling"],
    russian: ["времени", "работа", "развитие"],
  };

  const py = runPythonSnowballBaseline(langWords);

  for (const [language, words] of Object.entries(langWords)) {
    for (let i = 0; i < words.length; i++) {
      expect(snowballStem(words[i]! as string, language as string)).toBe(py[language]![i] as unknown as string);
    }
  }
});
