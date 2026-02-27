import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  everygramsAsciiNative,
  porterStemAscii,
  posTagAsciiNative,
  sentenceTokenizeSubset,
  skipgramsAsciiNative,
  tokenizeAsciiNative,
} from "../index";

type CoverageFixture = {
  tokenizer_cases: Array<{ name: string; input: string; expected_lower: string[] }>;
  sentence_cases: Array<{ name: string; input: string; expected: string[] }>;
  everygram_cases: Array<{ name: string; input: string; min_len: number; max_len: number; expected: string[][] }>;
  skipgram_cases: Array<{ name: string; input: string; n: number; k: number; expected: string[][] }>;
  porter_cases: Array<{ word: string; stem: string }>;
  pos_cases: Array<{ name: string; input: string; expected_tags: string[] }>;
};

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dir, "fixtures", "nltk_coverage_slices.json"), "utf8"),
) as CoverageFixture;

test("coverage slices: tokenizer", () => {
  for (const item of fixture.tokenizer_cases) {
    expect(tokenizeAsciiNative(item.input)).toEqual(item.expected_lower);
  }
});

test("coverage slices: sentence tokenizer", () => {
  for (const item of fixture.sentence_cases) {
    expect(sentenceTokenizeSubset(item.input)).toEqual(item.expected);
  }
});

test("coverage slices: everygrams", () => {
  for (const item of fixture.everygram_cases) {
    expect(everygramsAsciiNative(item.input, item.min_len, item.max_len)).toEqual(item.expected);
  }
});

test("coverage slices: skipgrams", () => {
  for (const item of fixture.skipgram_cases) {
    expect(skipgramsAsciiNative(item.input, item.n, item.k)).toEqual(item.expected);
  }
});

test("coverage slices: porter", () => {
  for (const item of fixture.porter_cases) {
    expect(porterStemAscii(item.word)).toBe(item.stem);
  }
});

test("coverage slices: pos tagger", () => {
  for (const item of fixture.pos_cases) {
    const tags = posTagAsciiNative(item.input).map((row) => row.tag);
    expect(tags).toEqual(item.expected_tags);
  }
});
