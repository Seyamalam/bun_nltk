import { expect, test } from "bun:test";
import {
  mweTokenize,
  MWETokenizer,
  toktokTokenize,
  treebankWordTokenize,
  TweetTokenizer,
  tweetTokenize,
  WordPunctTokenizer,
  wordPunctTokenize,
} from "../index";

test("Treebank tokenizer splits contractions and punctuation", () => {
  const text = `Can't stop, won't stop.`;
  expect(treebankWordTokenize(text)).toEqual(["Ca", "n't", "stop", ",", "wo", "n't", "stop", "."]);
});

test("WordPunct tokenizer splits around punctuation groups", () => {
  const text = "Good muffins cost $3.88 in New-York.";
  expect(wordPunctTokenize(text)).toEqual(["Good", "muffins", "cost", "$", "3", ".", "88", "in", "New", "-", "York", "."]);
  expect(new WordPunctTokenizer().tokenize("can't")).toEqual(["can", "'", "t"]);
});

test("Toktok tokenizer keeps ellipsis and contractions", () => {
  const text = "Well... this isn't bad!";
  expect(toktokTokenize(text)).toEqual(["Well", "...", "this", "isn't", "bad", "!"]);
});

test("MWETokenizer merges longest matching multi-word expressions", () => {
  const tokenizer = new MWETokenizer([["new", "york"], ["new", "york", "city"]]);
  const tokens = ["i", "love", "new", "york", "city", "today"];
  expect(tokenizer.tokenize(tokens)).toEqual(["i", "love", "new_york_city", "today"]);
  tokenizer.addMwe(["san", "francisco"]);
  expect(tokenizer.tokenize(["san", "francisco", "rocks"])).toEqual(["san_francisco", "rocks"]);
  expect(mweTokenize(["new", "york", "times"], [["new", "york"]])).toEqual(["new_york", "times"]);
});

test("TweetTokenizer supports preserveCase + emoticon casing rules", () => {
  const tokenizer = new TweetTokenizer({ preserveCase: false });
  expect(tokenizer.tokenize("I LOVE NLP :D #Fun")).toEqual(["i", "love", "nlp", ":D", "#fun"]);
});

test("tweetTokenize keeps existing subset behavior and supports extra options", () => {
  expect(
    tweetTokenize("@myke wowwwww 601-984-4813", {
      stripHandles: true,
      reduceLen: true,
      matchPhoneNumbers: true,
    }),
  ).toEqual(["wowww", "601-984-4813"]);
});

