import { expect, test } from "bun:test";
import { IBMModel3 } from "../src/ibm3";

const BITEXT = [
  { words: ["klein", "ist", "das", "haus"], mots: ["the", "house", "is", "small"] },
  { words: ["das", "haus", "war", "ja", "groß"], mots: ["the", "house", "was", "big"] },
  { words: ["das", "buch", "ist", "ja", "klein"], mots: ["the", "book", "is", "small"] },
  { words: ["ein", "haus", "ist", "klein"], mots: ["a", "house", "is", "small"] },
  { words: ["das", "haus"], mots: ["the", "house"] },
  { words: ["das", "buch"], mots: ["the", "book"] },
  { words: ["ein", "buch"], mots: ["a", "book"] },
  { words: ["ich", "fasse", "das", "buch", "zusammen"], mots: ["i", "summarize", "the", "book"] },
  { words: ["fasse", "zusammen"], mots: ["summarize"] },
];

test("IBMModel3 matches NLTK doctest values", () => {
  const ibm3 = new IBMModel3(BITEXT, 5);
  expect(Number((ibm3.translation_table.get("buch")?.get("book") ?? 0).toFixed(3))).toBe(1.0);
  expect(Number((ibm3.translation_table.get("das")?.get("book") ?? 0).toFixed(3))).toBe(0.0);
  expect(Number((ibm3.translation_table.get("ja")?.get("NULL") ?? 0).toFixed(3))).toBe(1.0);
  expect(Number((ibm3.distortion_table.get(1)?.get(1)?.get(2)?.get(2) ?? 0).toFixed(3))).toBe(1.0);
  expect(Number((ibm3.distortion_table.get(1)?.get(2)?.get(2)?.get(2) ?? 0).toFixed(3))).toBe(0.0);
  expect(Number((ibm3.distortion_table.get(2)?.get(2)?.get(4)?.get(5) ?? 0).toFixed(3))).toBe(0.75);
  expect(Number((ibm3.fertility_table.get(2)?.get("summarize") ?? 0).toFixed(3))).toBe(1.0);
  expect(Number((ibm3.fertility_table.get(1)?.get("book") ?? 0).toFixed(3))).toBe(1.0);
  expect(Number(ibm3.p1.toFixed(3))).toBe(0.054);
});
