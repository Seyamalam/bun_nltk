import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { chunkTreeToIob, regexpChunkParse, type TaggedToken } from "../index";

const tagged: TaggedToken[] = [
  { token: "The", tag: "DT" },
  { token: "quick", tag: "JJ" },
  { token: "brown", tag: "JJ" },
  { token: "fox", tag: "NN" },
  { token: "jumps", tag: "VBZ" },
  { token: "over", tag: "IN" },
  { token: "the", tag: "DT" },
  { token: "lazy", tag: "JJ" },
  { token: "dog", tag: "NN" },
];

const grammar = `
NP: {<DT>?<JJ>*<NN.*>+}
VP: {<VB.*><IN>?}
`;

test("regexp chunk parser builds NP/VP chunks", () => {
  const tree = regexpChunkParse(tagged, grammar);
  const iob = chunkTreeToIob(tree);
  expect(iob.map((row) => row.iob)).toEqual([
    "B-NP",
    "I-NP",
    "I-NP",
    "I-NP",
    "B-VP",
    "I-VP",
    "B-NP",
    "I-NP",
    "I-NP",
  ]);
});

test("regexp chunk parser parity with nltk RegexpParser on sample grammar", () => {
  const tree = regexpChunkParse(tagged, grammar);
  const jsIob = chunkTreeToIob(tree).map((row) => [row.token, row.tag, row.iob]);
  const payload = JSON.stringify({
    grammar,
    tagged: tagged.map((row) => [row.token, row.tag]),
  });
  const proc = Bun.spawnSync(["python", "bench/python_chunk_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { iob: string[][] };
  expect(jsIob).toEqual(py.iob);
});

