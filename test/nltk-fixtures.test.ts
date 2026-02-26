import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { porterStemAscii, topPmiBigramsAscii, tweetTokenizeSubset, wordTokenizeSubset } from "../index";

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dir, "fixtures", "nltk_parity_cases.json"), "utf8"),
) as {
  collocations: {
    sentence: string;
    window3_expected_pmi: number;
    window5_expected_pmi: number;
  };
  tokenizers: {
    word_case: { input: string; expected: string[] };
    tweet_case: {
      input: string;
      expected_match_phone_true: string[];
      expected_match_phone_false: string[];
    };
  };
  porter_vectors: [string, string][];
};

function hashToken(token: string): bigint {
  let h = 14695981039346656037n;
  for (let i = 0; i < token.length; i += 1) {
    h ^= BigInt(token.charCodeAt(i));
    h = (h * 1099511628211n) & 0xffffffffffffffffn;
  }
  return h;
}

test("fixture: tokenizer parity cases", () => {
  expect(wordTokenizeSubset(fixture.tokenizers.word_case.input)).toEqual(fixture.tokenizers.word_case.expected);

  expect(
    tweetTokenizeSubset(fixture.tokenizers.tweet_case.input, {
      matchPhoneNumbers: true,
    }),
  ).toEqual(fixture.tokenizers.tweet_case.expected_match_phone_true);

  expect(
    tweetTokenizeSubset(fixture.tokenizers.tweet_case.input, {
      matchPhoneNumbers: false,
    }),
  ).toEqual(fixture.tokenizers.tweet_case.expected_match_phone_false);
});

test("fixture: collocation PMI anchors", () => {
  const thisHash = hashToken("this");
  const isHash = hashToken("is");
  const aHash = hashToken("a");
  const testHash = hashToken("test");

  const window3 = topPmiBigramsAscii(fixture.collocations.sentence, 32, 3);
  const window5 = topPmiBigramsAscii(fixture.collocations.sentence, 32, 5);

  const score3 = window3.find((row) => row.leftHash === thisHash && row.rightHash === isHash)?.score;
  const score5 = window5.find((row) => row.leftHash === thisHash && row.rightHash === aHash)?.score;
  const score5b = window5.find((row) => row.leftHash === isHash && row.rightHash === testHash)?.score;

  expect(score3).toBeCloseTo(fixture.collocations.window3_expected_pmi, 12);
  expect(score5).toBeCloseTo(fixture.collocations.window5_expected_pmi, 12);
  expect(score5b).toBeCloseTo(fixture.collocations.window5_expected_pmi, 12);
});

test("fixture: porter vectors", () => {
  for (const [word, expected] of fixture.porter_vectors) {
    expect(porterStemAscii(word)).toBe(expected);
  }
});
