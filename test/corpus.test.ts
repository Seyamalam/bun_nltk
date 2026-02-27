import { expect, test } from "bun:test";
import { loadBundledMiniCorpus } from "../index";

test("bundled mini corpus exposes files and categories", () => {
  const corpus = loadBundledMiniCorpus();
  expect(corpus.fileIds()).toEqual(["fiction", "news", "science"]);
  expect(corpus.categories()).toEqual(["fiction", "news", "report", "research", "science", "story"]);
});

test("bundled mini corpus supports filtered reading", () => {
  const corpus = loadBundledMiniCorpus();
  const researchText = corpus.raw({ categories: ["research"] });
  expect(researchText.toLowerCase()).toContain("perplexity");
  expect(corpus.fileIds({ categories: ["research"] })).toEqual(["science"]);
});

test("bundled mini corpus provides words, sentences, and paragraphs", () => {
  const corpus = loadBundledMiniCorpus();
  const words = corpus.words({ fileIds: ["news"] });
  const sentences = corpus.sents({ fileIds: ["science"] });
  const paragraphs = corpus.paras({ fileIds: ["fiction"] });

  expect(words).toContain("research");
  expect(sentences[0]).toBe("Researchers built a compact corpus for parser evaluation.");
  expect(paragraphs.length).toBe(2);
});

