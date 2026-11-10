import { expect, test } from "bun:test";
import {
  EnglishStemmer,
  GermanStemmer,
  LancasterStemmer,
  RegexpStemmer,
  RussianStemmer,
  SnowballStemmer,
  WordNetLemmatizer,
} from "../index";

test("RegexpStemmer strips matching suffix", () => {
  const stemmer = new RegexpStemmer("ing$", 3);
  expect(stemmer.stem("running")).toBe("runn");
  expect(stemmer.stem("go")).toBe("go");
});

test("LancasterStemmer is aggressive", () => {
  const stemmer = new LancasterStemmer();
  expect(stemmer.stem("running")).toBe("run");
  expect(stemmer.stem("happiness")).toBe("happi");
});

test("SnowballStemmer english path uses porter-like stemming", () => {
  const stemmer = new SnowballStemmer("english");
  expect(stemmer.stem("running")).toBe("run");
  expect(stemmer.stem("studies")).toBe("studi");
});

test("WordNetLemmatizer uses morphy behavior", () => {
  const l = new WordNetLemmatizer();
  expect(l.lemmatize("dogs", "n")).toBe("dog");
  expect(l.lemmatize("running", "v")).toBe("run");
});

// Values below are pinned to Python NLTK 3.10.3 (WordNetLemmatizer + wn._morphy/morphy).
test("WordNetLemmatizer picks shortest lemma like NLTK", () => {
  const l = new WordNetLemmatizer();
  const cases: Array<[string, string, string]> = [
    ["us", "n", "u"],
    ["better", "a", "good"],
    ["dogs", "n", "dog"],
    ["Dogs", "n", "Dogs"],
    ["mice", "n", "mouse"],
    ["churches", "n", "church"],
    ["aardwolves", "n", "aardwolf"],
    ["abaci", "n", "abacus"],
    ["hardrock", "n", "hardrock"],
    ["catss", "n", "catss"],
    ["running", "v", "run"],
    ["went", "v", "go"],
    ["bought", "v", "buy"],
    ["geese", "n", "goose"],
    ["corpora", "n", "corpus"],
    ["axes", "n", "ax"],
    ["children", "n", "child"],
    ["men", "n", "men"],
    ["teeth", "n", "teeth"],
    ["worse", "a", "bad"],
    ["worst", "a", "bad"],
    ["faster", "a", "fast"],
    ["best", "a", "best"],
    ["quickly", "r", "quickly"],
    ["lives", "v", "live"],
    ["lives", "n", "life"],
    ["saw", "v", "saw"],
    ["saw", "n", "saw"],
  ];
  for (const [word, pos, expected] of cases) {
    expect(l.lemmatize(word, pos)).toBe(expected);
  }
});

test("WordNetLemmatizer _morphy returns the full lemma list like NLTK", () => {
  const l = new WordNetLemmatizer();
  const cases: Array<[string, string, string[]]> = [
    ["us", "n", ["us", "u"]],
    ["better", "a", ["better", "good", "well"]],
    ["dogs", "n", ["dog"]],
    ["mice", "n", ["mouse"]],
    ["went", "v", ["go"]],
    ["axes", "n", ["ax", "axis"]],
    ["catss", "n", []],
    ["Dogs", "n", []],
    ["lives", "v", ["live"]],
    ["saw", "n", ["saw"]],
    ["better", "s", ["better", "good", "well"]],
    ["worse", "a", ["worse", "bad"]],
  ];
  for (const [form, pos, expected] of cases) {
    expect(l._morphy(form, pos)).toEqual(expected);
  }
});

test("WordNetLemmatizer morphy returns first lemma or null like NLTK", () => {
  const l = new WordNetLemmatizer();
  expect(l.morphy("us", "n")).toBe("us");
  expect(l.morphy("dogs")).toBe("dog");
  expect(l.morphy("book", "a")).toBeNull();
  expect(l.morphy("catss")).toBeNull();
  expect(l.morphy("better")).toBe("better");
  expect(l.morphy("saw", "v")).toBe("saw");
  expect(l.morphy("lives")).toBe("life");
  expect(l.morphy("mice", "n", false)).toBeNull();
  expect(l.morphy("us", "n", false)).toBe("us");
  expect(l.morphy("went", "v", false)).toBeNull();
});

// Oracle values below are pinned against Python NLTK 3.10.3.

test("SnowballStemmer ignore_stopwords returns stopwords unstemmed", () => {
  const eng = new SnowballStemmer("english", true);
  expect(eng.stem("The")).toBe("the");
  expect(eng.stem("the")).toBe("the");
  expect(eng.stem("running")).toBe("run");
  expect(eng.stopwords.size).toBe(198);
  expect(new SnowballStemmer("english").stem("the")).toBe("the");
});

test("language-specific snowball classes mirror NLTK", () => {
  expect(new EnglishStemmer(true).stem("running")).toBe("run");
  expect(new EnglishStemmer(true).stem("about")).toBe("about");
  expect(new GermanStemmer(true).stem("und")).toBe("und");
  expect(new GermanStemmer(true).stem("Autobahnen")).toBe("autobahn");
  expect(new SnowballStemmer("german", true).stem("Autobahnen")).toBe("autobahn");
  expect(new RussianStemmer(true).stem("и")).toBe("и");
  expect(new RussianStemmer(true).stem("И")).toBe("и");
});

test("SnowballStemmer porter delegates to classic PorterStemmer", () => {
  const porter = new SnowballStemmer("porter");
  expect(porter.stem("running")).toBe("run");
  expect(porter.stem("relational")).toBe("relat");
  expect(() => new SnowballStemmer("porter", true)).toThrow(
    "<PorterStemmer> has no list of stopwords. Please set 'ignore_stopwords' to 'False'.",
  );
  expect(SnowballStemmer.languages).toContain("porter");
});

