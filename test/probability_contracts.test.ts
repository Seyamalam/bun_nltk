import { expect, test } from "bun:test";
import { FreqDist, ConditionalFreqDist } from "../src/freqdist";
import { CrossValidationProbDist, HeldoutProbDist, KneserNeyProbDist, type Trigram } from "../src/probability_missing";
import { DictionaryProbDist, DictionaryConditionalProbDist, ConditionalProbDist, LaplaceProbDist } from "../src/probability";
import { ProbabilityContractRuntime } from "../src/probability_abi";
import { readFileSync } from "node:fs";

type Scalar = string | number | boolean | null;
class ConcreteCrossValidation<T> extends CrossValidationProbDist<T> {
  override max(): T { return this.freqdists()[0]!.max(); }
}
type Outcome = { value: number | null } | { error: string };
function outcome(fn: () => number | null): Outcome {
  try { return { value: fn() }; } catch (e) { return { error: e instanceof TypeError ? "TypeError" : e instanceof RangeError ? "ValueError" : "Error" }; }
}
function compare(actual: Outcome, expected: Outcome): void {
  if ("error" in expected) {
    expect("error" in actual).toBe(true);
    if ("error" in actual) expect(actual.error).toBe(["ZeroDivisionError", "IndexError", "ValueError"].includes(expected.error) ? "ValueError" : expected.error);
  } else {
    expect("value" in actual).toBe(true);
    if ("value" in actual) {
      if (expected.value === null) expect(actual.value).toBeNull();
      else expect(actual.value).toBeCloseTo(expected.value, 11);
    }
  }
}
function oracle<T>(source: string, data: unknown): T {
  const proc = Bun.spawnSync(["python3", "-c", `import json,sys,nltk\nassert nltk.__version__ == '3.10.3'\n${source}`], {
    stdin: new TextEncoder().encode(JSON.stringify(data)), stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  return JSON.parse(new TextDecoder().decode(proc.stdout)) as T;
}

test("Heldout and CrossValidation train/prob/logprob/samples/errors differential against NLTK 3.10.3", () => {
  const cases: Array<{ rows: Scalar[][]; bins: number | null; probes: Scalar[] }> = [];
  let seed = 8267;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const values: Scalar[] = ["a", "b", "c", null, true, 1, false, 0, 2];
  for (let i = 0; i < 35; i++) cases.push({ rows: Array.from({ length: 3 }, () => Array.from({ length: 18 }, () => values[Math.floor(random() * values.length)]!)), bins: i % 3 ? 12 : null, probes: [...values, "unseen"] });
  cases.push({ rows: [[], ["a"]], bins: 4, probes: ["a"] }, { rows: [["a"], []], bins: 4, probes: ["a"] },
    { rows: [["a"], ["b"]], bins: 0, probes: ["a", "b", "unseen"] },
    { rows: [["a", "b"], ["a"]], bins: 1, probes: ["a", "b", "unseen"] },
    { rows: [], bins: 4, probes: ["a"] }, { rows: [["a"]], bins: 4, probes: ["a"] });
  const expected = oracle<Array<Record<string, { constructorError?: string; probs: Outcome[]; logs: Outcome[]; samples: Scalar[] }>>>(`
from nltk.probability import FreqDist,HeldoutProbDist,CrossValidationProbDist
class ConcreteCrossValidation(CrossValidationProbDist):
 def max(self): return self.freqdists()[0].max()
def result(f):
 try: return {'value':f()}
 except Exception as e: return {'error':type(e).__name__}
out=[]
for c in json.load(sys.stdin):
 row={};fds=[FreqDist(r) for r in c['rows']]
 for name in ['heldout','cross']:
  try:
   d=HeldoutProbDist(fds[0],fds[1],c['bins']) if name=='heldout' else ConcreteCrossValidation(fds,c['bins'])
   row[name]={'probs':[result(lambda:d.prob(p)) for p in c['probes']], 'logs':[result(lambda:d.logprob(p)) for p in c['probes']], 'samples':list(d.samples())}
  except Exception as e: row[name]={'constructorError':type(e).__name__}
 out.append(row)
print(json.dumps(out))`, cases);
  for (const [i, c] of cases.entries()) {
    const fds = c.rows.map(row => new FreqDist(row));
    for (const name of ["heldout", "cross"]) {
      const wanted = expected[i]![name]!;
      const create = () => name === "heldout" ? new HeldoutProbDist(fds[0]!, fds[1]!, c.bins) : new ConcreteCrossValidation(fds, c.bins);
      if (wanted.constructorError) { expect(create).toThrow(); continue; }
      const d = create();
      for (const [j, p] of c.probes.entries()) {
        compare(outcome(() => d.prob(p)), wanted.probs[j]!);
        compare(outcome(() => d.logprob(p)), wanted.logs[j]!);
      }
      // Python set iteration order is intentionally unspecified.
      const canonical = (values: Iterable<Scalar>) => [...values].map(v => typeof v === "boolean" ? Number(v) : v).map(v => JSON.stringify(v)).sort();
      expect(canonical(d.samples())).toEqual(canonical(wanted.samples));
    }
  }
});

test("CrossValidation excludes repeated FreqDist identity and defers no-pairs division error", () => {
  const fd = new FreqDist(["a"]), other = new FreqDist(["a", "b"]);
  expect(() => Reflect.construct(CrossValidationProbDist, [[fd, fd], 3])).toThrow("abstract");
  const repeated = new ConcreteCrossValidation([fd, fd], 3);
  expect(() => repeated.prob("a")).toThrow("division by zero");
  const d = new ConcreteCrossValidation([fd, fd, other], 3);
  expect(d.prob("a")).toBeCloseTo(0.5, 12);
  expect(d.freqdists()).toEqual([fd, fd, other]);
});

test("KneserNey trigram seen/backoff/unseen/logprob/errors and discount cache match Python", () => {
  const train: Trigram<Scalar>[] = [
    ["a", "b", "c"], ["a", "b", "c"], ["a", "b", "d"], ["x", "b", "e"], ["y", "b", "c"],
    [null, true, "z"], [null, 1, "z"], [false, null, "q"], [0, null, "q"],
  ];
  const probes: Trigram<Scalar>[] = [["a", "b", "c"], ["a", "b", "e"], ["x", "b", "d"], ["x", "b", "c"], ["u", "b", "c"], [null, 1, "z"], [false, null, "q"], ["a", "b", "unseen"]];
  const expected = oracle<{ before: Outcome[]; logs: Outcome[]; after: Outcome[]; fresh: Outcome; samples: Trigram<Scalar>[]; max: Trigram<Scalar> }>(`
from nltk.probability import FreqDist,KneserNeyProbDist
def result(f):
 try: return {'value':f()}
 except Exception as e: return {'error':type(e).__name__}
c=json.load(sys.stdin);d=KneserNeyProbDist(FreqDist(map(tuple,c['train'])))
before=[result(lambda:d.prob(p)) for p in c['probes']]
logs=[result(lambda:d.logprob(p)) for p in c['probes']]
d.set_discount(.5)
print(json.dumps({'before':before,'logs':logs,'after':[result(lambda:d.prob(p)) for p in c['probes']], 'fresh':result(lambda:d.prob(('y','b','e'))), 'samples':list(d.samples()), 'max':d.max()}))`, { train, probes });
  const d = new KneserNeyProbDist(new FreqDist(train));
  try {
    probes.forEach((p, i) => { compare(outcome(() => d.prob(p)), expected.before[i]!); compare(outcome(() => d.logprob(p)), expected.logs[i]!); });
    d.set_discount(0.5);
    probes.forEach((p, i) => compare(outcome(() => d.prob(p)), expected.after[i]!));
    compare(outcome(() => d.prob(["y", "b", "e"])), expected.fresh);
    expect([...d.samples()]).toEqual(expected.samples);
    expect(d.max()).toEqual(expected.max);
    expect(() => d.prob(["a"] as unknown as Trigram<Scalar>)).toThrow("3 members");
  } finally { d.dispose(); }
  expect(() => d.prob(probes[0]!)).toThrow("disposed");
});

test("KneserNey empty data and negative discounted probability log errors", () => {
  const empty = new KneserNeyProbDist(new FreqDist<Trigram<string>>());
  expect(empty.prob(["a", "b", "c"])).toBe(0);
  expect(empty.logprob(["a", "b", "c"])).toBe(-1e300);
  expect([...empty.samples()]).toEqual([]);
  expect(() => empty.max()).toThrow();
  empty.dispose();
  const d = new KneserNeyProbDist(new FreqDist<Trigram<string>>([["a", "b", "c"]]), null, 2);
  expect(d.prob(["a", "b", "c"])).toBe(-1);
  expect(() => d.logprob(["a", "b", "c"])).toThrow("math domain");
  d.dispose();
});

test("DictionaryConditionalProbDist missing conditions and Python numeric/None equality", () => {
  const expected = oracle<{ probabilities: number[]; conditions: Scalar[]; missingSamples: string[] }>(`
from nltk.probability import DictionaryConditionalProbDist,DictionaryProbDist
d=DictionaryConditionalProbDist({True:DictionaryProbDist({'a':1}),None:DictionaryProbDist({'b':1})})
probs=[d[1].prob('a'),d[None].prob('b')]
samples=list(d['missing'].samples())
print(json.dumps({'probabilities':probs,'conditions':d.conditions(),'missingSamples':samples}))`, null);
  const d = new DictionaryConditionalProbDist<Scalar, string>(new Map([[true, new DictionaryProbDist({ a: 1 })], [null, new DictionaryProbDist({ b: 1 })]]));
  expect([d.get(1).prob("a"), d.get(null).prob("b")]).toEqual(expected.probabilities);
  expect([...d.get("missing").samples()]).toEqual(expected.missingSamples);
  expect(d.get("missing")).toBe(d.get("missing"));
  expect(d.conditions()).toEqual(expected.conditions);
});

test("ConditionalProbDist keeps callback errors intact and merges equivalent Python conditions", () => {
  let calls = 0;
  const failure = new RangeError("oracle factory error");
  const broken = new ConditionalProbDist(new ConditionalFreqDist<string, string>(), (_fd: FreqDist<string>) => { calls++; throw failure; });
  expect(() => broken.get("missing")).toThrow(failure);
  expect(calls).toBe(1);
  expect(broken.conditions()).toEqual([]);
  const d = new ConditionalProbDist(new ConditionalFreqDist<Scalar, string>([[true, "a"]]), LaplaceProbDist, 3);
  expect(d.get(1)).toBe(d.get(true));
  expect(d.get(1).prob("a")).toBe(0.5);
  expect(d.get(null).prob("new")).toBeCloseTo(1 / 3, 12);
  const merged = new ConditionalProbDist(new ConditionalFreqDist<Scalar, string>([[true, "a"], [1, "b"]]), LaplaceProbDist, 3);
  expect(merged.conditions()).toEqual([true]);
  expect(merged.get(1).prob("a")).toBe(0.4);
  expect(merged.get(true).prob("b")).toBe(0.4);
});

test("Heldout retains original estimates but uses live base frequency classes", () => {
  const base = new FreqDist(["a", "a", "b"]), held = new FreqDist(["a", "b", "b"]);
  const d = new HeldoutProbDist(base, held, 4);
  expect(d.prob("a")).toBeCloseTo(1 / 3, 12);
  base.set("a", 1);
  expect(d.prob("a")).toBeCloseTo(2 / 3, 12);
  base.set("a", 3);
  expect(() => d.prob("a")).toThrow("list index out of range");
});

test("Probability dedicated ABI rejects malformed requests and unsafe memory ranges", () => {
  const bytes = readFileSync(new URL("../native/bun_nltk.wasm", import.meta.url));
  const runtime = new ProbabilityContractRuntime(bytes);
  expect(() => runtime.call(3, [0.75, 1, 0, 0, 0, -1], 1)).toThrow("invalid");
  expect(() => runtime.call(6, [1, 0, 0, 0, 1e9], 1)).toThrow("invalid");
  expect(() => runtime.call(4, [1.5, 0, 0, 0], 1)).toThrow("invalid");
  expect(() => runtime.call(12, [1, 2 ** 53], 1)).toThrow("invalid");
  const exports = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as unknown as {
    bunnltk_wasm_probability_contract(op: number, input: number, length: number, output: number, capacity: number): number;
  };
  for (const [input, length, output, capacity] of [[1, 1, 16, 1], [8, 0xffffffff, 16, 1], [8, 1, 8, 1], [0, 0, 0, 0]]) {
    expect(exports.bunnltk_wasm_probability_contract(1, input!, length!, output!, capacity!)).toBe(0);
  }
});
