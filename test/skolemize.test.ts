import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { LogicParser, resetUniqueVariableCounter } from "../src/sem_logic";
import { skolemize } from "../src/skolemize";

describe("skolemize unit", () => {
  test("exists -> constant", () => {
    resetUniqueVariableCounter();
    const e = new LogicParser().parse("exists x.man(x)");
    expect(skolemize(e).str()).toBe("man(z1)");
  });
  test("all exists -> skolem function", () => {
    resetUniqueVariableCounter();
    const e = new LogicParser().parse("all x.exists y.loves(x,y)");
    expect(skolemize(e).str()).toBe("loves(z2,F1(z2))");
  });
  test("all x.man(x) -> tautology removal via univ", () => {
    resetUniqueVariableCounter();
    const e = new LogicParser().parse("all x.man(x)");
    // all x.man(x) => man(z1) (universal replaced by fresh var, no skolem)
    expect(skolemize(e).str()).toBe("man(z1)");
  });
});

const SKOLEM_CASES = [
  { expression: "exists x.man(x)" },
  { expression: "all x.man(x)" },
  { expression: "all x.exists y.loves(x,y)" },
  { expression: "exists x.all y.loves(x,y)" },
  { expression: "man(x) & walks(x)" },
  { expression: "man(x) | walks(x)" },
  { expression: "man(x) -> walks(x)" },
  { expression: "man(x) <-> walks(x)" },
  { expression: "all x.(man(x) -> exists y.walks(y))" },
  { expression: "-all x.man(x)" },
  { expression: "-(man(x) & walks(x))" },
];

test("skolemize parity against python nltk", () => {
  const payload = JSON.stringify({ cases: SKOLEM_CASES });
  const proc = Bun.spawnSync(
    ["python3", "bench/python_skolemize_baseline.py", "--payload", payload],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const py: Array<{ expression: string; skolemize?: string; error?: string }> = JSON.parse(new TextDecoder().decode(proc.stdout).trim());
  const mismatches: string[] = [];
  for (let i = 0; i < SKOLEM_CASES.length; i++) {
    resetUniqueVariableCounter();
    const e = new LogicParser().parse(SKOLEM_CASES[i]!.expression);
    let jsStr: string;
    let jsErr: string | null = null;
    try { jsStr = skolemize(e).str(); } catch (ex) { jsErr = String(ex); jsStr = `ERR:${jsErr}`; }
    const pyEntry = py[i]!;
    const pyStr = pyEntry.skolemize ?? `ERR:${pyEntry.error ?? ""}`;
    if (jsStr !== pyStr) {
      mismatches.push(`${SKOLEM_CASES[i]!.expression}: js=${JSON.stringify(jsStr)} py=${JSON.stringify(pyStr)}`);
    }
  }
  expect(mismatches).toEqual([]);
});
