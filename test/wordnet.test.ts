import { expect, test } from "bun:test";
import { loadWordNetExtended, loadWordNetMini } from "../index";

test("wordnet mini returns noun synsets and relation links", () => {
  const wn = loadWordNetMini();
  const dog = wn.synsets("dog", "n")[0];
  expect(dog?.id).toBe("dog.n.01");
  expect(dog?.lemmas).toContain("domestic_dog");

  const hypernym = wn.hypernyms(dog!)[0];
  expect(hypernym?.id).toBe("animal.n.01");
});

test("wordnet mini supports morphy-style inflection recovery", () => {
  const wn = loadWordNetMini();
  expect(wn.morphy("dogs", "n")).toBe("dog");
  expect(wn.morphy("sprinted", "v")).toBe("sprint");
  expect(wn.synsets("dogs", "n").map((row) => row.id)).toContain("dog.n.01");
});

test("wordnet mini returns antonyms and similar-to edges", () => {
  const wn = loadWordNetMini();
  const quick = wn.synsets("quick", "a")[0];
  const antonymIds = wn.antonyms(quick!).map((row) => row.id);
  const similarIds = wn.similarTo(quick!).map((row) => row.id);

  expect(antonymIds).toEqual(["slow.a.01"]);
  expect(similarIds).toEqual(["speedy.a.01"]);
});

test("wordnet extended exposes larger vocabulary", () => {
  const wn = loadWordNetExtended();
  expect(wn.synsets("computer", "n").map((row) => row.id)).toContain("computer.n.01");
  expect(wn.synsets("optimize", "v").map((row) => row.id)).toContain("optimize.v.01");
});
