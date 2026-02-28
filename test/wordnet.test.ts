import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadWordNet, loadWordNetExtended, loadWordNetMini, loadWordNetPacked } from "../index";

test("wordnet mini returns noun synsets and relation links", () => {
  const wn = loadWordNetMini();
  const dog = wn.synsets("dog", "n")[0];
  expect(dog?.id).toBe("dog.n.01");
  expect(dog?.lemmas).toContain("domestic_dog");

  const hypernym = wn.hypernyms(dog!)[0];
  expect(hypernym?.id).toBe("animal.n.01");
});

test("wordnet mini supports morphy-style inflection recovery", () => {
  const wn = loadWordNetMini();
  expect(wn.morphy("dogs", "n")).toBe("dog");
  expect(wn.morphy("sprinted", "v")).toBe("sprint");
  expect(wn.synsets("dogs", "n").map((row) => row.id)).toContain("dog.n.01");
});

test("wordnet mini returns antonyms and similar-to edges", () => {
  const wn = loadWordNetMini();
  const quick = wn.synsets("quick", "a")[0];
  const antonymIds = wn.antonyms(quick!).map((row) => row.id);
  const similarIds = wn.similarTo(quick!).map((row) => row.id);

  expect(antonymIds).toEqual(["slow.a.01"]);
  expect(similarIds).toEqual(["speedy.a.01"]);
});

test("wordnet hypernym paths and shortest-path similarity are available", () => {
  const wn = loadWordNetMini();
  const dog = wn.synsets("dog", "n")[0]!;
  const cat = wn.synsets("cat", "n")[0]!;

  const paths = wn.hypernymPaths(dog);
  expect(paths.length).toBeGreaterThan(0);
  expect(paths[0]?.map((row) => row.id)).toContain("dog.n.01");
  expect(paths[0]?.map((row) => row.id)).toContain("animal.n.01");

  expect(wn.shortestPathDistance(dog, cat)).toBe(2);
  expect(wn.pathSimilarity(dog, cat)).toBeCloseTo(1 / 3, 10);
});

test("wordnet lowest common hypernyms returns nearest shared ancestor", () => {
  const wn = loadWordNetMini();
  const dog = wn.synsets("dog", "n")[0]!;
  const cat = wn.synsets("cat", "n")[0]!;
  const lch = wn.lowestCommonHypernyms(dog, cat).map((row) => row.id);
  expect(lch).toEqual(["animal.n.01"]);
});

test("wordnet extended exposes larger vocabulary", () => {
  const wn = loadWordNetExtended();
  expect(wn.synsets("computer", "n").map((row) => row.id)).toContain("computer.n.01");
  expect(wn.synsets("optimize", "v").map((row) => row.id)).toContain("optimize.v.01");
});

test("loadWordNet default loader resolves runtime dataset", () => {
  const wn = loadWordNet();
  expect(wn.synsets("dog", "n").length).toBeGreaterThan(0);
});

test("wordnet packed loader parses packed binary payload", () => {
  const payload = {
    version: 1,
    synsets: [
      {
        id: "dog.n.01",
        pos: "n",
        lemmas: ["dog"],
        gloss: "dog",
        examples: [],
        hypernyms: [],
        hyponyms: [],
        similarTo: [],
        antonyms: [],
      },
    ],
  };
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const magic = new TextEncoder().encode("BNWN1");
  const header = new Uint8Array(magic.length + 4);
  header.set(magic, 0);
  new DataView(header.buffer).setUint32(magic.length, body.length, true);
  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header, 0);
  bytes.set(body, header.length);

  const dir = mkdtempSync(join(tmpdir(), "bun-nltk-wordnet-pack-"));
  try {
    const packedPath = join(dir, "wordnet.bin");
    writeFileSync(packedPath, bytes);
    const wn = loadWordNetPacked(packedPath);
    expect(wn.synsets("dog", "n").map((row) => row.id)).toEqual(["dog.n.01"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
