import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadCorpusBundleFromIndex, parseBrownTagged, parseConllChunked, parseConllTagged } from "../index";

test("parseConllTagged parses sentence blocks", () => {
  const payload = [
    "The\tDT",
    "dog\tNN",
    "",
    "runs\tVBZ",
    "fast\tRB",
    "",
  ].join("\n");
  const out = parseConllTagged(payload);
  expect(out.length).toBe(2);
  expect(out[0]).toEqual([
    { token: "The", tag: "DT" },
    { token: "dog", tag: "NN" },
  ]);
});

test("parseBrownTagged parses slash-tag format", () => {
  const payload = "The/DT dog/NN runs/VBZ fast/RB";
  const out = parseBrownTagged(payload);
  expect(out[0]).toEqual([
    { token: "The", tag: "DT" },
    { token: "dog", tag: "NN" },
    { token: "runs", tag: "VBZ" },
    { token: "fast", tag: "RB" },
  ]);
});

test("parseConllChunked parses chunk triples", () => {
  const payload = [
    "The DT B-NP",
    "dog NN I-NP",
    "",
    "runs VBZ B-VP",
    "",
  ].join("\n");
  const out = parseConllChunked(payload);
  expect(out.length).toBe(2);
  expect(out[0]).toEqual([
    { token: "The", pos: "DT", chunk: "B-NP" },
    { token: "dog", pos: "NN", chunk: "I-NP" },
  ]);
});

test("loadCorpusBundleFromIndex loads optional external corpus bundle", () => {
  const indexPath = resolve(import.meta.dir, "fixtures", "corpora_external", "index.json");
  const corpus = loadCorpusBundleFromIndex(indexPath);
  expect(corpus.fileIds()).toEqual(["sample_a", "sample_b"]);
  expect(corpus.categories()).toEqual(["alpha", "beta"]);
  expect(corpus.paras({ fileIds: ["sample_a"] }).length).toBe(2);
});

