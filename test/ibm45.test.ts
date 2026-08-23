import { expect, test } from "bun:test";
import { IBMModel4 } from "../src/ibm4";
import { IBMModel5 } from "../src/ibm5";

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
const SRC_CLASSES = { the: 0, a: 0, small: 1, big: 1, house: 2, book: 2, is: 3, was: 3, i: 4, summarize: 5 };
const TRG_CLASSES = { das: 0, ein: 0, haus: 1, buch: 1, klein: 2, groß: 2, ist: 3, war: 3, ja: 4, ich: 5, fasse: 6, zusammen: 6 };

test("IBMModel4 doctest values (order-independent subset)", () => {
  const ibm4 = new IBMModel4(BITEXT, 5, SRC_CLASSES, TRG_CLASSES);
  // Strong lexical signals are stable regardless of hillclimb tie order.
  expect(Number((ibm4.translation_table.get("buch")?.get("book") ?? 0).toFixed(2))).toBe(1.0);
  expect(Number((ibm4.translation_table.get("das")?.get("book") ?? 0).toFixed(2))).toBe(0.0);
  expect(Number((ibm4.fertility_table.get(2)?.get("summarize") ?? 0).toFixed(2))).toBe(1.0);
  expect(Number((ibm4.fertility_table.get(1)?.get("book") ?? 0).toFixed(2))).toBe(1.0);
  expect(ibm4.p1).toBeGreaterThan(0);
  expect(ibm4.p1).toBeLessThan(0.2);
});

test("IBMModel5 trains and produces sane tables", () => {
  const ibm5 = new IBMModel5(BITEXT, 5, SRC_CLASSES, TRG_CLASSES);
  expect(Number((ibm5.translation_table.get("buch")?.get("book") ?? 0).toFixed(2))).toBe(1.0);
  expect(Number((ibm5.fertility_table.get(2)?.get("summarize") ?? 0).toFixed(2))).toBe(1.0);
  expect(ibm5.p1).toBeGreaterThan(0);
  expect(ibm5.p1).toBeLessThan(0.2);
  // Vacancy tables populated
  expect(ibm5.head_vacancy_table.size).toBeGreaterThan(0);
  expect(ibm5.non_head_vacancy_table.size).toBeGreaterThan(0);
});
