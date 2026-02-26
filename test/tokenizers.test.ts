import { expect, test } from "bun:test";
import { tweetTokenizeSubset, wordTokenizeSubset } from "../index";

test("wordTokenizeSubset handles PTB-like contractions", () => {
  const text = "John's big idea isn't all that bad.";
  expect(wordTokenizeSubset(text)).toEqual([
    "John",
    "'s",
    "big",
    "idea",
    "is",
    "n't",
    "all",
    "that",
    "bad",
    ".",
  ]);
});

test("tweetTokenizeSubset strips handles and reduces length", () => {
  const text = "@myke: Let's test waaaaayyyy too much!!!!!!";
  expect(
    tweetTokenizeSubset(text, {
      stripHandles: true,
      reduceLen: true,
      matchPhoneNumbers: true,
    }),
  ).toEqual([":", "Let's", "test", "waaayyy", "too", "much", "!", "!", "!", "!", "!", "!"]);
});

test("tweetTokenizeSubset phone behavior matches subset expectations", () => {
  const text1 = "My number is 601-984-4813, except it's not.";
  expect(
    tweetTokenizeSubset(text1, {
      stripHandles: false,
      reduceLen: false,
      matchPhoneNumbers: true,
    }),
  ).toEqual(["My", "number", "is", "601-984-4813", ",", "except", "it's", "not", "."]);

  expect(
    tweetTokenizeSubset(text1, {
      stripHandles: false,
      reduceLen: false,
      matchPhoneNumbers: false,
    }),
  ).toEqual(["My", "number", "is", "601", "-", "984", "-", "4813", ",", "except", "it's", "not", "."]);
});

test("tweetTokenizeSubset keeps emoji ZWJ sequences", () => {
  const text = "👨‍👩‍👧‍👧 👩🏾‍🎓";
  expect(tweetTokenizeSubset(text)).toEqual(["👨‍👩‍👧‍👧", "👩🏾‍🎓"]);
});
