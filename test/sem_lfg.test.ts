import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { DependencyGraph } from "../src/dependency_graph";
import { FStructure } from "../src/sem_lfg";

const ORACLE = resolve(import.meta.dir, "lfg_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");

const DEPGRAPHS = [
  `1\tJohn\t_\tNNP\tNNP\t_\t2\tSUBJ\t_\t_
2\tsees\t_\tVB\tVB\t_\t0\tROOT\t_\t_
3\ta\t_\tex_quant\tex_quant\t_\t4\tSPEC\t_\t_
4\tdog\t_\tNN\tNN\t_\t2\tOBJ\t_\t_
`,
  `1\tJohn\t_\tNNP\tNNP\t_\t2\tSUBJ\t_\t_
2\tsaw\t_\tVB\tVBD\t_\t0\tROOT\t_\t_
3\tit\t_\tPRP\tPRP\t_\t2\tOBJ\t_\t_
`,
  `1\tJohn\t_\tNNP\tNNP\t_\t2\tSUBJ\t_\t_
2\tgives\t_\tVB\tVB\t_\t0\tROOT\t_\t_
3\ta\t_\tDT\tDT\t_\t4\tSPEC\t_\t_
4\tbook\t_\tNN\tNN\t_\t2\tOBJ\t_\t_
5\tto\t_\tTO\tTO\t_\t6\tPCASE\t_\t_
6\tMary\t_\tNNP\tNNP\t_\t4\tNMOD\t_\t_
`,
];

const oracle = (() => {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    stdin: Buffer.from(JSON.stringify({ depgraphs: DEPGRAPHS })),
    env: { ...process.env, NLTK_DATA: resolve(import.meta.dir, "../.cache/nltk-data") },
  });
  if (proc.exitCode !== 0) throw new Error(`oracle failed: ${proc.stderr.toString()}`);
  return JSON.parse(proc.stdout.toString());
})();

const canonItem = (item: unknown): Record<string, unknown> => {
  if (item instanceof FStructure) return { type: "fs", pretty: item.prettyFormat() };
  if (Array.isArray(item) && typeof item[0] === "string") return { type: "tuple", v: item };
  if (Array.isArray(item)) return { type: "list", n: item.length };
  return { type: "?", v: item };
};

describe("nltk.sem.lfg.FStructure parity (oracle: NLTK 3.10.3)", () => {
  const ours = DEPGRAPHS.map((d) => {
    const dg = new DependencyGraph(d);
    return FStructure.readDepgraph(dg) as FStructure;
  });

  test("pretty_format/repr/pred/label/features match oracle", () => {
    oracle.cases.forEach((o: any, i: number) => {
      const fs = ours[i]!;
      expect(fs.prettyFormat()).toBe(o.pretty);
      expect(fs.repr()).toBe(o.repr);
      expect(fs.pred).toEqual(o.pred);
      expect(fs.label).toBe(o.label);
      expect([...fs.keys()].sort()).toEqual(o.keys);
      const features: Record<string, unknown[]> = {};
      for (const k of fs.keys()) features[k] = fs.get(k)!.map(canonItem);
      expect(features).toEqual(o.features);
    });
  });

  test("to_depgraph nodes/deps/root match oracle", () => {
    oracle.cases.forEach((o: any, i: number) => {
      const dg2 = ours[i]!.toDepgraph();
      const got: Record<string, unknown> = {};
      for (const [a, n] of Object.entries(dg2.nodes)) {
        const node = n as unknown as Record<string, unknown>;
        got[a] = {
          address: node["address"], word: node["word"], tag: node["tag"],
          head: node["head"], rel: node["rel"], deps: node["deps"],
        };
      }
      expect(got).toEqual(o.to_depgraph);
      expect((dg2.root as unknown as Record<string, unknown>)["address"]).toBe(o.to_depgraph_root);
    });
  });

  test("case-insensitive keys + safeappend + _makeLabel", () => {
    const fs = new FStructure();
    fs.safeappend("OBJ", ["dog", "NN"]);
    fs.safeappend("obj", ["cat", "NN"]);
    expect(fs.get("Obj")).toEqual([["dog", "NN"], ["cat", "NN"]]);
    expect(FStructure._makeLabel(1)).toBe("f");
    expect(FStructure._makeLabel(26)).toBe("e1");
    expect(() => FStructure._makeLabel(27)).toThrow(/list index out of range/);
    try { FStructure._makeLabel(27); } catch (e: any) { expect(e.name).toBe("IndexError"); }
  });
});
