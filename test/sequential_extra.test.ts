import { describe, expect, test } from "bun:test";
import { AffixTagger, DefaultTagger, ClassifierBasedPOSTagger } from "../src/sequential_taggers";
import { NaiveBayesClassifier } from "../src/classifier_compat";
import type { GoldSentence } from "../src/sequential_taggers";

// sequential-extra-differential: values pinned against Python NLTK 3.10.3 (test/sequential_extra_oracle.py).

const train: GoldSentence[] = [
  [["the", "DT"], ["quick", "JJ"], ["brown", "JJ"], ["fox", "NN"], ["jumps", "VBZ"]],
  [["a", "DT"], ["slow", "JJ"], ["dog", "NN"], ["barks", "VBZ"]],
  [["running", "VBG"], ["quickly", "RB"]],
];

describe("nltk.tag.sequential.AffixTagger", () => {
  test("suffix tagging matches oracle", () => {
    const t = new AffixTagger(train, null, -3);
    expect(t.tag(["the", "slow", "running", "xyz"])).toEqual([
      ["the", null], ["slow", null], ["running", "VBG"], ["xyz", null]]);
  });
  test("prefix tagging + backoff matches oracle", () => {
    const t = new AffixTagger(train, null, 2, 2, new DefaultTagger("NN"));
    expect(t.tag(["the", "slow", "running", "xyz"])).toEqual([
      ["the", "NN"], ["slow", "JJ"], ["running", "VBG"], ["xyz", "NN"]]);
    expect(t.context(["abcdef"], 0, [])).toBe("ab");
    expect(t.context(["ab"], 0, [])).toBeNull();
  });
});

describe("nltk.tag.sequential.ClassifierBasedPOSTagger", () => {
  test("feature_detector matches oracle", () => {
    const cb = new ClassifierBasedPOSTagger({ classifier: { classify: () => "X" } });
    expect(cb.feature_detector(["The", "quick", "Fox"], 1, ["DT"])).toEqual({
      prevtag: "DT", prevprevtag: null, word: "quick", "word.lower": "quick",
      suffix3: "ick", suffix2: "ck", suffix1: "k", prevprevword: null, prevword: "the",
      "prevtag+word": "DT+quick", "prevprevtag+word": "None+quick",
      "prevword+word": "the+quick", shape: "downcase",
    });
  });
  test("train + tag matches oracle", () => {
    const cb = new ClassifierBasedPOSTagger({
      train, classifier_builder: (l) => NaiveBayesClassifier.train(l as never),
    });
    expect(cb.tag(["the", "slow", "running", "xyz", "a"])).toEqual([
      ["the", "DT"], ["slow", "JJ"], ["running", "VBG"], ["xyz", "RB"], ["a", "DT"]]);
  });
  test("_check_params raises like NLTK", () => {
    expect(() => new ClassifierBasedPOSTagger()).toThrow("Must specify either training data or trained model.");
    expect(() => new ClassifierBasedPOSTagger({ train, classifier: { classify: () => "X" } }))
      .toThrow("Must specify either training data or trained classifier.");
  });
});
