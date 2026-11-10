import { describe, expect, test } from "bun:test";
import { bubble, merge, quick, selection } from "../src/misc_sort";
import { MinimalSet } from "../src/misc_minimalset";
import { generateChomsky, _internal } from "../src/misc_chomsky";
import { babelizeShell } from "../src/misc_babelfish";
import { check, revword, step, wordfinder, word_finder } from "../src/misc_wordfinder";

// Pinned against NLTK 3.10.3 (see test/misc_oracle.py).

describe("nltk.misc.sort instrumented counts", () => {
  const data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const sorted = [1, 1, 2, 3, 3, 4, 5, 5, 6, 9];
  test("selection", () => {
    const a = [...data];
    expect(selection(a)).toBe(45);
    expect(a).toEqual(sorted);
  });
  test("bubble", () => {
    const a = [...data];
    expect(bubble(a)).toBe(15);
    expect(a).toEqual(sorted);
  });
  test("merge", () => {
    const a = [...data];
    expect(merge(a)).toBe(22);
    expect(a).toEqual(sorted);
  });
  test("quick", () => {
    const a = [...data];
    expect(quick(a)).toBe(10);
    expect(a).toEqual(sorted);
  });
  test("edge cases", () => {
    expect(selection([])).toBe(0);
    const s = [1, 2, 3, 4, 5];
    expect(quick(s)).toBe(4);
  });
});

describe("nltk.misc.minimalset.MinimalSet", () => {
  const ms = new MinimalSet([
    ["at", "f", "fat"], ["at", "c", "cat"], ["at", "b", "bat"],
    ["og", "d", "dog"], ["aining", "tr", "training"], ["aining", "dr", "draining"],
  ]);
  test("contexts/targets/display pins", () => {
    expect(ms.contexts().sort()).toEqual(["aining", "at"]);
    expect(ms.contexts(3)).toEqual(["at"]);
    expect([...ms.targets()].sort()).toEqual(["b", "c", "d", "dr", "f", "tr"]);
    expect(ms.display("at", "f")).toBe("fat");
    expect(ms.display("at", "z")).toBe("");
    expect(ms.display("at", "z", "D")).toBe("D");
    expect(ms.displayAll("at").sort()).toEqual(["bat", "cat", "fat"]);
    expect(ms.displayAll("og").sort()).toEqual(["dog"]);
    expect(ms.display_all("at").sort()).toEqual(["bat", "cat", "fat"]);
  });
});

describe("nltk.misc.chomsky + babelfish", () => {
  test("generate_chomsky structure (nltk prints; ours returns the string)", () => {
    const out = generateChomsky(1, 40);
    expect(typeof out).toBe("string");
    expect(Math.max(...out.split("\n").map((l) => l.length))).toBeLessThanOrEqual(40);
    expect(out.split(/\s+/).filter(Boolean).length).toBeGreaterThan(10);
  });
  test("textwrap.fill parity pin", () => {
    expect(_internal.textwrapFill("alpha beta gamma delta epsilon zeta eta theta iota", 20))
      .toBe("alpha beta gamma\ndelta epsilon zeta\neta theta iota");
  });
  test("babelize_shell prints the discontinued notice like nltk", () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
    try {
      expect(babelizeShell()).toBeUndefined();
    } finally {
      console.log = orig;
    }
    expect(lines.join("\n") + "\n").toBe("Babelfish online translation service is no longer available.\n");
  });
});

describe("nltk.misc.wordfinder", () => {
  const grid = (): string[][] => Array.from({ length: 4 }, () => Array(4).fill("") as string[]);

  test("check dir placements + unknown dir returns undefined like nltk None", () => {
    let g = grid();
    expect(check("AB", 2, 3, 1, g, 4, 4)).toBe(true);
    expect(g).toEqual([["", "", "", ""], ["", "", "", ""], ["", "B", "", ""], ["", "A", "", ""]]);

    g = grid();
    expect(check("ABC", 2, 1, 1, g, 4, 4)).toBe(false);
    expect(g.flat().every((c) => c === "")).toBe(true);

    g = grid();
    expect(check("AB", 4, 2, 3, g, 4, 4)).toBe(true);
    expect(g[2]).toEqual(["", "", "B", "A"]);

    g = grid();
    expect(check("AB", 1, 3, 3, g, 4, 4)).toBe(true);
    expect(g[2]).toEqual(["", "", "B", ""]);
    expect(g[3]).toEqual(["", "", "", "A"]);

    g = grid();
    expect(check("AB", 3, 3, 0, g, 4, 4)).toBe(true);
    expect(g[2]).toEqual(["", "B", "", ""]);
    expect(g[3]).toEqual(["A", "", "", ""]);

    expect(check("AB", 9, 3, 3, grid(), 4, 4)).toBeUndefined();

    g = grid();
    g[2]![1] = "Z";
    expect(check("AB", 4, 2, 3, g, 4, 4)).toBe(true);
    expect(g[2]).toEqual(["", "Z", "B", "A"]);
  });

  test("step places via xf/yf coordinate functions", () => {
    const g = grid();
    expect(step("AB", 0, (i) => i, 0, (i) => i, g)).toBe(true);
    expect(g[0]).toEqual(["A", "", "", ""]);
    expect(g[1]).toEqual(["", "B", "", ""]);
  });

  test("revword reverses or keeps (50/50); wordfinder structural invariants", () => {
    const results = new Set(Array.from({ length: 60 }, () => revword("ABC")));
    expect([...results].every((r) => r === "ABC" || r === "CBA")).toBe(true);
    const words = ["cat", "dog", "sun", "tree"];
    const { grid: g, used } = wordfinder(words, 10, 10, 200, "XYZ");
    expect(g.length).toBe(10);
    expect(g.every((row) => row.length === 10 && row.every((c) => c !== ""))).toBe(true);
    expect(used.every((w) => words.map((x) => x.toUpperCase()).includes(w))).toBe(true);
  });

  test("word_finder is corpus-bound and throws a descriptive error", () => {
    expect(() => word_finder()).toThrow("nltk.corpus.words");
  });
});
