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

