import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { DrtParser } from "../src/drt";
import type { DrtExpression } from "../src/drt";

const p = new DrtParser();
const parse = (s: string): DrtExpression => p.parse(s);

describe("DrtParser basic", () => {
  test("parses simple DRS", () => {
    const d = parse("([x],[man(x)])");
    expect(d.str()).toBe("([x],[man(x)])");
    expect(d.fol().str()).toBe("exists x.man(x)");
  });
  test("parses DRS with two refs", () => {
    const d = parse("([x,y],[man(x), walks(y)])");
    expect(d.fol().str()).toBe("exists x y.(man(x) & walks(y))");
  });
  test("lambda over DRS", () => {
    const d = parse("\\x.([x],[dog(x)])");
    expect(d.str()).toBe("\\x.([x],[dog(x)])");
    expect(d.fol().str()).toBe("\\x.exists x.dog(x)");
  });
  test("DRS concatenation +", () => {
    const d = parse("([x],[man(x)]) + ([y],[walks(y)])");
    expect(d.fol().str()).toBe("(exists x.man(x) & exists y.walks(y))");
    expect((d as unknown as { simplify(): unknown }).simplify !== undefined);
    const simp = (d as unknown as { simplify(): { str(): string } }).simplify();
    expect(simp.str()).toBe("([x,y],[man(x), walks(y)])");
  });
  test("DRS implication", () => {
    const d = parse("([x],[man(x)]) -> ([y],[walks(y)])");
    expect(d.fol().str()).toBe("all x.(man(x) -> exists y.walks(y))");
  });
  test("DRS disjunction", () => {
    const d = parse("([x],[man(x)]) | ([y],[walks(y)])");
    expect(d.fol().str()).toBe("(exists x.man(x) | exists y.walks(y))");
  });
  test("equality", () => {
    const d = parse("([x],[x=y])");
    expect(d.fol().str()).toBe("exists x.(x = y)");
  });
  test("SDRS-lite proposition label", () => {
    const d = parse("p:([x],[man(x)])");
    expect(d.str()).toContain(":");
    expect(d.fol().str()).toBe("exists x.man(x)");
  });
});

// Python parity
const DRT_CASES = [
  { expression: "([x],[man(x)])", operations: ["str", "fol", "simplify"] },
  { expression: "([x,y],[man(x), walks(y)])", operations: ["str", "fol"] },
  { expression: "([x],[man(x), tall(x)])", operations: ["str", "fol"] },
  { expression: "([x],[x=y])", operations: ["str", "fol"] },
  { expression: "([x],[man(x)]) + ([y],[walks(y)])", operations: ["str", "fol", "simplify"] },
  { expression: "([x],[man(x)]) | ([y],[walks(y)])", operations: ["str", "fol"] },
  { expression: "([x],[man(x)]) -> ([y],[walks(y)])", operations: ["str", "fol"] },
  { expression: "\\x.([x],[dog(x)])", operations: ["str", "fol"] },
  { expression: "\\x y.([x],[dog(x), barks(y)])", operations: ["str", "fol"] },
  { expression: "((([x],[man(x)]) + ([y],[walks(y)])) -> ([z],[barks(z)]))", operations: ["str", "fol", "simplify"] },
];

function runJsCases(cases: typeof DRT_CASES) {
  return cases.map((c) => {
    const entry: Record<string, unknown> = { expression: c.expression };
    try {
      const e = p.parse(c.expression);
      const res: Record<string, unknown> = {};
      for (const op of c.operations) {
        if (op === "str") res["str"] = e.str();
        else if (op === "fol") {
          try { res["fol"] = e.fol().str(); } catch (ex) { res["fol_error"] = String(ex); }
        } else if (op === "simplify") {
          try {
            const s = (e as unknown as { simplify(): { str(): string } }).simplify();
            res["simplify"] = s.str();
          } catch (ex) { res["simplify_error"] = String(ex); }
        }
      }
      entry["results"] = res;
    } catch (ex) {
      entry["error"] = String(ex);
    }
    return entry;
  });
}

test("DRT full parity against python nltk baseline", () => {
  const payload = JSON.stringify({ cases: DRT_CASES });
  const proc = Bun.spawnSync(
    ["python3", "bench/python_drt_baseline.py", "--payload", payload],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim());
  const js = runJsCases(DRT_CASES);
  const mismatches: string[] = [];
  for (let i = 0; i < Math.max(js.length, py.length); i++) {
    if (JSON.stringify(js[i]) !== JSON.stringify(py[i])) {
      mismatches.push(`${DRT_CASES[i]!.expression}: js=${JSON.stringify(js[i])} py=${JSON.stringify(py[i])}`);
    }
  }
  expect(mismatches).toEqual([]);
});
