import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { SimpleTree } from "../index";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");

function generator(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
}

const LABELS = ["S", "NP", "VP", "NN", "DT", "JJ", "PRP", "IN", ".", "leaf",
  "café", "😀", "x-y", "a'b", "2", "N$", "``", "''", "VBD|<NN>", ""];

/** Build random tree strings — mostly valid, sometimes corrupted. */
function corpus(seed: number, count: number): string[] {
  const random = generator(seed);
  const texts: string[] = [];
  const label = () => LABELS[random() % LABELS.length]!;
  const build = (depth: number): string => {
    if (depth >= 4 || random() % 4 === 0) return label() || "leaf";
    const n = 1 + (random() % 3);
    return `(${label()} ${Array.from({ length: n }, () => build(depth + 1)).join(" ")})`;
  };
  for (let i = 0; i < count; i++) {
    let s = `(${build(0)})`;
    // ~40% corruption: drop/insert brackets or stray tokens.
    if (random() % 5 < 2) {
      const ops = [() => s.slice(0, -1), () => `(${s}`, () => `${s})`,
        () => s.replace("(", ""), () => `${s} stray`, () => `stray ${s}`,
        () => s.replace(/ \w+ /, " ( ) "), () => s.split(" ").join("  ")];
      s = ops[random() % ops.length]!();
    }
    texts.push(s);
  }
  return texts;
}

function jsRun(text: string): unknown {
  try { return SimpleTree.fromstring(text).toString(); }
  catch (err) { return ["__ERR__", "ValueError", (err as Error).message]; }
}

test("seeded tree strings: SimpleTree.fromstring matches NLTK 3.10.3", { timeout: 120_000 }, () => {
  const texts = corpus(0xBEEF, 400);
  const res = spawnSync("python3", ["test/tree_fuzz_oracle.py"], {
    input: JSON.stringify(texts),
    encoding: "utf-8",
    env: { ...process.env, NLTK_DATA, PYTHONHASHSEED: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  const oracle = JSON.parse(res.stdout) as unknown[];
  const mismatches: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const js = jsRun(texts[i]!);
    const py = oracle[i];
    // Byte-exact: successful parses compare str(tree); errors compare the
    // class name and full caret-formatted message.
    if (JSON.stringify(js) !== JSON.stringify(py)) {
      mismatches.push(`input=${JSON.stringify(texts[i])}\n  js=${JSON.stringify(js)}\n  py=${JSON.stringify(py)}`);
    }
  }
  expect(mismatches.join("\n\n")).toBe("");
});
