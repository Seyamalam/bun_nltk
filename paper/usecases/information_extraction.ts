/**
 * Information extraction: tokenize -> POS-tag (averaged perceptron) ->
 * named-entity chunking over a short business-news paragraph.
 *
 * Run: bun run paper/usecases/information_extraction.ts
 */
import { posTagPerceptronAscii } from "../../src/perceptron_tagger";
import { neChunk, neChunkIob } from "../../src/named_entity";
import type { TaggedToken } from "../../src/chunk";

const PARAGRAPH =
  "Tim Cook visited Microsoft headquarters in Redmond last week and met Satya Nadella to discuss a new partnership between Apple and OpenAI.";

console.log("== Information extraction: POS tagging + NE chunking ==");
console.log(`\nInput paragraph:\n  ${PARAGRAPH}\n`);

const t0 = performance.now();

// 1. Tokenize + POS tag with the averaged perceptron tagger.
const tagged = posTagPerceptronAscii(PARAGRAPH);
const tTag = performance.now();

// 2. Named-entity chunking over the tagged tokens.
const taggedTokens: TaggedToken[] = tagged.map((tok) => ({ token: tok.token, tag: tok.tag }));
const tree = neChunk(taggedTokens);
const iob = neChunkIob(taggedTokens);
const tChunk = performance.now();

// ------------------------------------------------------------------ print
console.log("POS tags (perceptron):");
console.table(
  tagged.map((tok) => ({ token: tok.token, pos: tok.tag })),
);

type Entity = { label: string; text: string };
const entities: Entity[] = [];
for (const node of tree) {
  if ("kind" in node) {
    entities.push({ label: node.label, text: node.tokens.map((t) => t.token).join(" ") });
  }
}

console.log("\nNamed entities found:");
console.table(
  entities.map((e, i) => ({ "#": i + 1, type: e.label, text: e.text })),
);

console.log("\nIOB tags:");
for (let i = 0; i < iob.length; i += 4) {
  const slice = iob.slice(i, i + 4);
  console.log(
    "  " +
      slice.map(([w, p, ne]) => `${w}/${p}/${ne}`).join("  "),
  );
}

if (entities.length === 0) {
  console.warn("[warn] no entities recognized — check that the paragraph contains capitalized proper nouns.");
}

console.log("\nTiming:");
console.log(`  perceptron POS tagging (${tagged.length} tokens): ${(tTag - t0).toFixed(2)} ms`);
console.log(`  NE chunking: ${(tChunk - tTag).toFixed(2)} ms`);
console.log(`  total wall time: ${(tChunk - t0).toFixed(2)} ms`);
