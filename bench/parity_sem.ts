/*
 * Parity harness for src/sem_logic.ts against real nltk.sem.logic / nltk.sem.evaluate.
 * Spawns bench/python_sem_baseline.py with the same case list and compares JSON.
 */
import { resolve } from "node:path";
import {
  Assignment,
  LogicParser,
  Model,
  Valuation,
  resetUniqueVariableCounter,
  type Expression,
  type ModelSpec,
} from "../src/sem_logic";

export interface SemCase {
  expression: string;
  operations: string[];
  model?: ModelSpec;
  assignment?: Record<string, string>;
  variable?: string;
}

const FOL_MODEL: ModelSpec = {
  domain: ["b1", "b2", "g1", "g2", "d1"],
  valuations: {
    adam: "b1",
    betty: "g1",
    fido: "d1",
    girl: ["g1", "g2"],
    boy: ["b1", "b2"],
    dog: ["d1"],
    love: [
      ["b1", "g1"],
      ["b2", "g2"],
      ["g1", "b1"],
      ["g2", "b1"],
    ],
  },
};

export const SEM_CASES: SemCase[] = [
  // Atoms
  { expression: "john", operations: ["str", "free", "constants"] },
  { expression: "man(x)", operations: ["str", "free", "predicates"] },
  { expression: "P(x,y,z)", operations: ["str", "free"] },
  { expression: "x12", operations: ["str"] },
  { expression: "F1(x)", operations: ["str", "free"] },
  { expression: "e1", operations: ["str"] },
  // Negation and boolean precedence torture
  { expression: "-man(x)", operations: ["str", "simplify"] },
  { expression: "not man(x)", operations: ["str"] },
  { expression: "--P", operations: ["str"] },
  { expression: "man(x) & tall(x) | walks(x)", operations: ["str"] },
  { expression: "a & b -> c", operations: ["str"] },
  { expression: "a -> b & c", operations: ["str"] },
  { expression: "a -> b -> c", operations: ["str"] },
  { expression: "a <-> b -> c", operations: ["str"] },
  { expression: "a -> b <-> c", operations: ["str"] },
  { expression: "a | b & c", operations: ["str"] },
  { expression: "(a | b) & c", operations: ["str"] },
  { expression: "a & (b | c)", operations: ["str"] },
  // Equality
  { expression: "x = y", operations: ["str"] },
  { expression: "x != y", operations: ["str"] },
  { expression: "-x = y", operations: ["str"] },
  { expression: "x = y & P(x)", operations: ["str"] },
  { expression: "x = y = z", operations: ["str"] },
  { expression: "!(x = y)", operations: ["str"] },
  // Quantifiers (scope to end unless parenthesized)
  { expression: "exists x.(man(x) & tall(x))", operations: ["str", "free", "normalize"] },
  { expression: "all x.man(x) & tall(x)", operations: ["str"] },
  { expression: "all x y.(see(x,y) -> love(x,y))", operations: ["str", "normalize"] },
  { expression: "some x.exist y.walks(x,y)", operations: ["str"] },
  { expression: "forall z1.dog(z1)", operations: ["str"] },
  { expression: "exists x.x = y", operations: ["str", "free"] },
  { expression: "exists x.(x = y)", operations: ["str"] },
  { expression: "exists x.(dog(x) & -(x = adam))", operations: ["str", "free", "normalize"] },
  { expression: "iota x.man(x)", operations: ["str"] },
  { expression: "exists x.P(x)", operations: ["normalize", "str"] },
  { expression: "exists x.all y.sees(x,y)", operations: ["normalize", "str"] },
  // Lambda abstraction and beta reduction
  { expression: "\\x.man(x)", operations: ["str", "simplify"] },
  { expression: "\\x.man(x)(john)", operations: ["simplify", "str"] },
  { expression: "\\x.\\y.sees(x,y)(john)(mary)", operations: ["simplify", "str"] },
  { expression: "\\x y.sees(x,y)(a,b)", operations: ["str"] },
  { expression: "\\x y.sees(x,y)(john,mary)", operations: ["str"] },
  { expression: "(\\x.exists y.walks(x,y))(y)", operations: ["simplify", "str"] },
  {
    expression: "all x.(man(x) & (\\x.exists y.walks(x,y))(x))",
    operations: ["simplify", "str"],
  },
  {
    expression: "(\\P.\\Q.exists x.(P(x) & Q(x)))(\\x.dog(x))(\\x.bark(x))",
    operations: ["simplify", "str"],
  },
  { expression: "\\P Q.exists x.(P(x) & Q(x))", operations: ["str"] },
  { expression: "\\x.sees(x,y)(john)", operations: ["str", "free", "normalize"] },
  { expression: "P(x) & x=y & P(y)", operations: ["str", "constants", "predicates"] },
  { expression: "man(x) <-> tall(x)", operations: ["str"] },
  // Evaluation over the small FOL model
  { expression: "love(adam, betty)", operations: ["evaluate"], model: FOL_MODEL, assignment: { x: "b1", y: "g2" } },
  { expression: "adam = betty", operations: ["evaluate"], model: FOL_MODEL, assignment: {} },
  { expression: "boy(x)", operations: ["evaluate"], model: FOL_MODEL, assignment: { x: "b1" } },
  { expression: "\\x.boy(x)(adam)", operations: ["evaluate", "str", "simplify"], model: FOL_MODEL, assignment: {} },
  {
    expression: "exists x.(boy(x) & all y.love(y,x))",
    operations: ["evaluate"],
    model: FOL_MODEL,
  },
  {
    expression: "all x.(girl(x) -> exists y.boy(y) & love(x,y))",
    operations: ["evaluate"],
    model: FOL_MODEL,
  },
  { expression: "walks(x)", operations: ["evaluate"], model: FOL_MODEL, assignment: { x: "b1" } },
  { expression: "z", operations: ["evaluate"], model: FOL_MODEL, assignment: { x: "b1" } },
  { expression: "love(adam, x)", operations: ["satisfiers"], model: FOL_MODEL, variable: "x" },
  { expression: "-(x = adam)", operations: ["satisfiers"], model: FOL_MODEL, variable: "x" },
  {
    expression: "all y.(girl(y) -> love(y,x))",
    operations: ["satisfiers"],
    model: FOL_MODEL,
    variable: "x",
  },
  { expression: "exists y.love(y,x)", operations: ["satisfiers"], model: FOL_MODEL, variable: "x" },
  { expression: "girl(x) | boy(x)", operations: ["satisfiers"], model: FOL_MODEL, variable: "x" },
  // Parse errors (error class names must match)
  { expression: "(P(x) & Q(x)", operations: [] },
  { expression: "exists", operations: [] },
  { expression: "P(x)Q(x)", operations: [] },
];

function buildModel(spec: ModelSpec): Model {
  return new Model(spec.domain, new Valuation(spec.valuations));
}

function sortedVarNames(set: Set<string>): string[] {
  return Array.from(set).sort();
}

export function runJsCases(cases: SemCase[]): unknown[] {
  resetUniqueVariableCounter();
  const lp = new LogicParser();
  const out: unknown[] = [];
  for (const c of cases) {
    const entry: Record<string, unknown> = { expression: c.expression };
    let e: Expression;
    try {
      e = lp.parse(c.expression);
    } catch (ex) {
      const err = ex as Error;
      entry.error = err.name ?? "Error";
      out.push(entry);
      continue;
    }
    const results: Record<string, unknown> = {};
    let model: Model | undefined;
    let g: Assignment | undefined;
    for (const op of c.operations) {
      if (op === "str") {
        results.str = e.str();
      } else if (op === "simplify") {
        results.simplify = e.simplify().str();
      } else if (op === "free") {
        results.free = sortedVarNames(new Set(Array.from(e.free()).map((v) => v.name)));
      } else if (op === "variables") {
        results.variables = sortedVarNames(new Set(Array.from(e.variables()).map((v) => v.name)));
      } else if (op === "constants") {
        results.constants = sortedVarNames(
          new Set(Array.from(e.constants()).map((v) => v.name)),
        );
      } else if (op === "predicates") {
        results.predicates = sortedVarNames(
          new Set(Array.from(e.predicates()).map((v) => v.name)),
        );
      } else if (op === "normalize") {
        results.normalize = e.normalize().str();
      } else if (op === "evaluate" || op === "satisfiers") {
        if (!model) {
          model = buildModel(c.model!);
          g = new Assignment(c.model!.domain, c.assignment ?? {});
        }
        if (op === "evaluate") {
          results.evaluate = model.evaluate(c.expression, g!);
        } else {
          results.satisfiers = sortedVarNames(model.satisfiers(e, c.variable!, g!));
        }
      }
    }
    entry.results = results;
    out.push(entry);
  }
  return out;
}

function main(): void {
  const payload = JSON.stringify({ cases: SEM_CASES });
  const proc = Bun.spawnSync(
    ["python3", "bench/python_sem_baseline.py", "--payload", payload],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python sem baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim());
  const js = runJsCases(SEM_CASES);

  const parity = JSON.stringify(js) === JSON.stringify(py);
  console.log(
    JSON.stringify({ parity, cases: SEM_CASES.length }, null, 2),
  );
  if (!parity) {
    for (let i = 0; i < Math.max(js.length, py.length); i++) {
      const a = JSON.stringify(js[i]);
      const b = JSON.stringify(py[i]);
      if (a !== b) {
        throw new Error(`sem parity failed at case ${i}: ${SEM_CASES[i]!.expression}\njs=${a}\npy=${b}`);
      }
    }
  }
}

if (import.meta.main) {
  main();
}
