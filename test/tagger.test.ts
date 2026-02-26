import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { posTagAscii, posTagAsciiNative } from "../index";

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dir, "fixtures", "pos_tagger_cases.json"), "utf8"),
) as {
  cases: Array<{ name: string; input: string; expected_tags: string[] }>;
};

for (const item of fixture.cases) {
  test(`pos tagger: ${item.name}`, () => {
    const native = posTagAsciiNative(item.input);
    const ref = posTagAscii(item.input);
    expect(native).toEqual(ref);
    expect(native.map((row) => row.tag)).toEqual(item.expected_tags);
  });
}
