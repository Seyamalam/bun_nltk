import { expect, test } from "bun:test";
import { LancasterStemmer, RegexpStemmer, SnowballStemmer, WordNetLemmatizer } from "../index";

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

