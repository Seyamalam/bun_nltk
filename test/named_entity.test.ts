import { expect, test } from "bun:test";
import { neChunk, neChunkIob, type ChunkNode, type TaggedToken } from "../index";

const sentence: TaggedToken[] = [
  { token: "Barack", tag: "NNP" },
  { token: "Obama", tag: "NNP" },
  { token: "met", tag: "VBD" },
  { token: "Apple", tag: "NNP" },
  { token: "executives", tag: "NNS" },
  { token: "in", tag: "IN" },
  { token: "California", tag: "NNP" },
];

test("ne_chunk groups multi-token person names (binary=false keeps labels)", () => {
  const tree = neChunk(sentence);
  const chunks = tree.filter((n): n is ChunkNode => "kind" in n) as Array<{ label: string; tokens: TaggedToken[] }>;
  const person = chunks.find((c) => c.label === "PERSON");
  expect(person).toBeDefined();
  expect(person!.tokens.map((t) => t.token)).toEqual(["Barack", "Obama"]);
});

test("ne_chunk labels remaining single proper nouns as GPE", () => {
  const tree = neChunk([{ token: "France", tag: "NNP" }]);
  expect(tree).toHaveLength(1);
  expect(tree[0]).toMatchObject({ kind: "chunk", label: "GPE" });
});

test("ne_chunk binary=true collapses all entities to NE", () => {
  const tree = neChunk(sentence, { binary: true });
  const chunks = tree.filter((n) => "kind" in n) as Array<{ label: string }>;
  expect(chunks.length).toBeGreaterThan(0);
  for (const c of chunks) expect(c.label).toBe("NE");
});

test("ne_chunkIob returns [word, pos, ne] tuples with B-/I- IOB tags", () => {
  const rows = neChunkIob(sentence);
  expect(rows).toHaveLength(sentence.length);
  expect(rows[0]).toEqual(["Barack", "NNP", "B-PERSON"]);
  expect(rows[1]).toEqual(["Obama", "NNP", "I-PERSON"]);
  expect(rows[3]).toEqual(["Apple", "NNP", "B-GPE"]);
  expect(rows[6]).toEqual(["California", "NNP", "B-GPE"]);
  for (const row of rows.slice(2, 3)) expect(row[2]).toBe("O");
});

test("ne_chunk leaves non-entity tokens ungrouped", () => {
  const tree = neChunk([
    { token: "The", tag: "DT" },
    { token: "dog", tag: "NN" },
    { token: "runs", tag: "VBZ" },
  ]);
  expect(tree.every((n) => !("kind" in n))).toBe(true);
});
