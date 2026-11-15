import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { CFG } from "../index";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");

function generator(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
}

const NONTERMS = ["S", "NP", "VP", "PP", "N", "V", "DT", "NP'", "NP-x", "x1",
  "café", "😀", "A B", ""];
const TERMS = ["the", "a", "dog", "runs", "café", "😀", "-", "...", "a'b",
  "it's", "5", "", "NP", "->", "#c"];

function corpus(seed: number, count: number): string[] {
  const random = generator(seed);
  const nt = () => NONTERMS[random() % NONTERMS.length]!;
  const term = () => TERMS[random() % TERMS.length]!;
  const rhsItem = () => (random() % 3 === 0 ? nt() : term());
  const prod = (): string => {
    const n = 1 + (random() % 4);
    const alts = [Array.from({ length: n }, rhsItem).join(" ")];
    if (random() % 4 === 0) {
      alts.push(Array.from({ length: 1 + (random() % 3) }, rhsItem).join(" "));
    }
    return `${nt()} -> ${alts.join(" | ")}`;
  };
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const lines: string[] = [prod()];
    const extra = random() % 4;
    for (let j = 0; j < extra; j++) lines.push(prod());
    let s = lines.join("\n");
    // ~35% corruption of the production structure.
    if (random() % 20 < 7) {
      const ops: Array<() => string> = [
        () => s.replace("->", ""),
        () => s.replace("->", "->>"),
        () => s.replace("->", "=>"),
        () => `${s}\n-> orphan`,
        () => `-> ${s}`,
        () => `${s} |`,
        () => s.replace(/\|[^|]*$/, "|"),
        () => `# comment\n${s}`,
        () => `${s}\n# trailing comment`,
        () => s.replace(" ", "  "),
        () => `${s}\n`,
        () => s.split("\n")[0]!.replace(/ .*/, " ->"),
        () => s.replace("'a'", '"a"'),
        () => `S -> '${s.split("\n")[0]}`,
      ];
      s = ops[random() % ops.length]!();
    }
    texts.push(s);
  }
  return texts;
}

function jsRun(text: string): unknown {
  try { return String(CFG.fromstring(text)); }
  catch (err) { return ["__ERR__", (err as Error).name, (err as Error).message]; }
}

test("seeded grammars: CFG.fromstring matches NLTK 3.10.3", { timeout: 120_000 }, () => {
  const texts = corpus(0xBEEF, 400);
  const res = spawnSync("python3", ["test/cfg_fuzz_oracle.py"], {
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
    if (JSON.stringify(js) !== JSON.stringify(py)) {
      mismatches.push(`input=${JSON.stringify(texts[i])}\n  js=${JSON.stringify(js)}\n  py=${JSON.stringify(py)}`);
    }
  }
  expect(mismatches.slice(0, 12)).toEqual([]);
});
