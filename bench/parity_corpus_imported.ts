import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CorpusReader } from "../index";

type FixtureDoc = {
  id: string;
  categories: string[];
  text: string;
  expected_words: string[];
  sentence_count: number;
  token_count: number;
};

type CorpusFixture = {
  snapshot_sha256: string;
  documents: FixtureDoc[];
};

function main() {
  const fixturePath = resolve(import.meta.dir, "..", "test", "fixtures", "nltk_imported", "corpus_subsets_fixture.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as CorpusFixture;
  if (!Array.isArray(fixture.documents) || fixture.documents.length === 0) {
    throw new Error("imported corpus fixture has no documents");
  }

  const reader = new CorpusReader(
    fixture.documents.map((doc) => ({
      id: doc.id,
      text: doc.text,
      categories: doc.categories,
    })),
  );

  let wordsParity = true;
  let tokenCountParity = true;
  let categoriesParity = true;
  for (const doc of fixture.documents) {
    const words = reader.words({ fileIds: [doc.id] }).filter((tok) => /[a-z0-9]/i.test(tok));
    if (JSON.stringify(words) !== JSON.stringify(doc.expected_words)) wordsParity = false;
    if (words.length !== doc.token_count) tokenCountParity = false;
    const ids = reader.fileIds({ categories: doc.categories });
    if (!ids.includes(doc.id)) categoriesParity = false;
  }

  const parity = wordsParity && tokenCountParity && categoriesParity;
  if (!parity) {
    throw new Error(
      `imported corpus parity mismatch: words=${wordsParity} token_count=${tokenCountParity} categories=${categoriesParity}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        parity,
        snapshot_sha256: fixture.snapshot_sha256,
        documents: fixture.documents.length,
      },
      null,
      2,
    ),
  );
}

main();
