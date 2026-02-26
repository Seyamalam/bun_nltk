import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sentenceTokenizeSubset } from "../index";

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dir, "fixtures", "sentence_tokenizer_cases.json"), "utf8"),
) as {
  cases: Array<{ name: string; input: string; expected: string[] }>;
};

for (const item of fixture.cases) {
  test(`sentence tokenizer: ${item.name}`, () => {
    expect(sentenceTokenizeSubset(item.input)).toEqual(item.expected);
  });
}
