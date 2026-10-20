import { expect, test } from "bun:test";
import { editDistance } from "../src/metrics";
import { editDistanceAlign } from "../src/distance_metrics";
import { WasmNltk } from "../src/wasm";

test("Rust distance and weighted Unicode alignment match NLTK differential oracle", () => {
  const pairs = [["CA", "ABC"], ["😀", "😀x"], ["a", "b"], ["", ""], ["kitten", "sitting"], ["é", "é"], ["😀a", "a😀"]];
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const alphabet = ["a", "b", "c", "😀", "é", "́"];
  function text(): string { return Array.from({ length: Math.floor(random() * 12) }, () => alphabet[Math.floor(random() * alphabet.length)]).join(""); }
  for (let i = 0; i < 120; i++) pairs.push([text(), text()]);
  const cases = pairs.flatMap(([left, right]) => [0, 0.5, 1, 2, 3, -0.5].map((cost) => ({ left: left!, right: right!, cost })));
  const oracle = Bun.spawnSync(["python3", "-c", `
import json,sys,nltk
from nltk.metrics.distance import edit_distance,edit_distance_align
assert nltk.__version__ == '3.10.3'
print(json.dumps([{
 'plain':edit_distance(c['left'],c['right'],c['cost'],False),
 'transposed':edit_distance(c['left'],c['right'],c['cost'],True),
 'alignment':edit_distance_align(c['left'],c['right'],c['cost'])
} for c in json.load(sys.stdin)]))
`], { stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe" });
  if (oracle.exitCode !== 0) throw new Error(new TextDecoder().decode(oracle.stderr));
  const expected = JSON.parse(new TextDecoder().decode(oracle.stdout)) as Array<{ plain: number; transposed: number; alignment: [number, number][] }>;
  cases.forEach(({ left, right, cost }, i) => {
    expect(editDistance(left, right, { substitutionCost: cost })).toBe(expected[i]!.plain);
    expect(editDistance(left, right, { substitutionCost: cost, transpositions: true })).toBe(expected[i]!.transposed);
    expect(editDistanceAlign(left, right, cost)).toEqual(expected[i]!.alignment);
  });
});

test("distance rejects oversized inputs and retains tiny staging memory", async () => {
  const wasm = await WasmNltk.init();
  try {
    expect(wasm.editDistance("😀".repeat(2000), "")).toBe(2000);
    expect(() => wasm.editDistance("😀".repeat(2001), "")).toThrow("MAX_DISTANCE_INPUT_LEN");
    expect(() => wasm.editDistanceAlign("a", "b", Infinity)).toThrow(RangeError);
    expect(wasm.editDistance("a".repeat(2000), "b".repeat(2000))).toBe(2000);
    expect(wasm.memoryBytes).toBeLessThan(4 * 1024 * 1024);
    wasm.dispose();
    expect(() => wasm.editDistance("a", "b")).toThrow("disposed");
  } finally { wasm.dispose(); }
});
