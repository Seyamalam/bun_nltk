import { expect, test } from "bun:test";
import { FreqDist } from "../src/freqdist.ts";
import { DictionaryProbDist, MLEProbDist, LidstoneProbDist, LaplaceProbDist, ELEProbDist,
  WittenBellProbDist, SimpleGoodTuringProbDist, UniformProbDist, MutableProbDist,
  addLogs, sumLogs, entropy, logLikelihood, type ProbDistLike } from "../src/probability.ts";

function oracle(code: string, input: unknown): unknown {
  const process = Bun.spawnSync(["python3", "-c", `
import json,sys,math,nltk
from nltk.probability import *
assert nltk.__version__=='3.10.3'
assert sys.version_info[:3]==(3,14,4)
data=json.load(sys.stdin)
def safe(v):
    if isinstance(v,float) and not math.isfinite(v): return 'NaN' if math.isnan(v) else ('-Infinity' if v<0 else 'Infinity')
    if isinstance(v,(list,tuple)): return [safe(x) for x in v]
    if isinstance(v,dict): return {k:safe(x) for k,x in v.items()}
    return v
def call(f):
    try: return safe(f())
    except Exception: return 'error'
${code}
print(json.dumps(safe(out),allow_nan=False))
`], { stdin: new TextEncoder().encode(JSON.stringify(input)), stdout: "pipe", stderr: "pipe" });
  if (process.exitCode !== 0) throw new Error(new TextDecoder().decode(process.stderr));
  return JSON.parse(new TextDecoder().decode(process.stdout));
}
function check(actual: () => unknown, expected: unknown): void {
  if (expected === "error") { expect(actual).toThrow(); return; }
  const value = actual();
  if (typeof expected === "number") {
    expect(Math.abs(Number(value) - expected)).toBeLessThan(1e-11 * Math.max(1, Math.abs(expected)));
  } else if (expected === "NaN" || expected === "-Infinity" || expected === "Infinity") expect(value).toBe(Number(expected));
  else expect(value).toEqual(expected);
}

test("Rust MLE/Lidstone/Laplace/ELE/WittenBell/GoodTuring probabilities and live mutation match NLTK", () => {
  const cases: Array<{ counts: Record<string, number>; kind: string; gamma: number; bins: number }> = [];
  for (const counts of [{ a: 4, b: 2, c: 2, d: 1, e: 1 }, { a: 1 }, { a: 3, b: 7, c: 10 }, {}] as Array<Record<string, number>>)
    for (const kind of ["MLE", "Lidstone", "Laplace", "ELE", "WittenBell", "SimpleGoodTuring"])
      for (const gamma of kind === "Lidstone" ? [0, 0.5, 1, -0.25] : [0])
        cases.push({ counts, kind, gamma, bins: Object.keys(counts).length + 5 });
  const expected = oracle(`
out=[]
for c in data:
    fd=FreqDist(c['counts']); cls=globals()[c['kind']+'ProbDist']
    dist=cls(fd) if c['kind']=='MLE' else cls(fd,c['gamma'],c['bins']) if c['kind']=='Lidstone' else cls(fd,c['bins'])
    stages=[]
    for mutate in [False,True]:
        if mutate:
            fd['a']+=2; fd['new']=1
        stages.append({'samples':list(dist.samples()),'probs':[call(lambda s=s:dist.prob(s)) for s in ['a','b','new','missing']],
            'logs':[call(lambda s=s:dist.logprob(s)) for s in ['a','b','new','missing']],
            'discount':call(dist.discount) if hasattr(dist,'discount') else None,
            'smooth':[call(lambda r=r:dist.smoothedNr(r)) for r in [1,2,7]] if hasattr(dist,'smoothedNr') else None})
    out.append(stages)
`, cases) as Array<Array<{ samples: string[]; probs: unknown[]; logs: unknown[]; discount: unknown; smooth: unknown[] | null }>>;
  for (const [i, c] of cases.entries()) {
    const fd = new FreqDist<string>(c.counts);
    const dist = c.kind === "MLE" ? new MLEProbDist(fd) : c.kind === "Lidstone" ? new LidstoneProbDist(fd, c.gamma, c.bins)
      : c.kind === "Laplace" ? new LaplaceProbDist(fd, c.bins) : c.kind === "ELE" ? new ELEProbDist(fd, c.bins)
        : c.kind === "WittenBell" ? new WittenBellProbDist(fd, c.bins) : new SimpleGoodTuringProbDist(fd, c.bins);
    for (let stage = 0; stage < 2; stage++) {
      if (stage) { fd.inc("a", 2); fd.set("new", 1); }
      const want = expected[i]![stage]!;
      // Existing FreqDist.keys() orders by count rather than Python insertion.
      expect([...dist.samples()].sort()).toEqual([...want.samples].sort());
      for (const [p, sample] of ["a", "b", "new", "missing"].entries()) {
        // NLTK's empty GoodTuring lacks fitted attributes. Keep the existing
        // empty-TS extension rather than falsely certifying mutation parity.
        if (c.kind === "SimpleGoodTuring" && Object.keys(c.counts).length === 0 && stage) continue;
        check(() => dist.prob(sample), want.probs[p]);
        check(() => dist.logprob(sample), want.logs[p]);
      }
      if ("discount" in dist && !(c.kind === "SimpleGoodTuring" && Object.keys(c.counts).length === 0))
        check(() => dist.discount(), want.discount);
      if (dist instanceof SimpleGoodTuringProbDist && Object.keys(c.counts).length > 0)
        for (const [p, r] of [1, 2, 7].entries()) check(() => dist.smoothedNr(r), want.smooth![p]);
    }
  }
});

test("Rust Dictionary normalization, logs, numeric/None equality and snapshot copy match NLTK", () => {
  const cases = [];
  for (const values of [[2, 1, 0], [0, 0, 0], [-2, -1, -3], [-1e300, -1e300, -1e300]])
    for (const log of [false, true]) for (const normalize of [false, true]) cases.push({ values, log, normalize });
  const expected = oracle(`
out=[]
for c in data:
    source=dict(zip(['a','b','c'],c['values'])); d=DictionaryProbDist(source,c['log'],c['normalize']); source['a']=999
    out.append({'probs':[call(lambda s=s:d.prob(s)) for s in ['a','b','c','missing']],
                'logs':[call(lambda s=s:d.logprob(s)) for s in ['a','b','c','missing']]})
`, cases) as Array<{ probs: unknown[]; logs: unknown[] }>;
  for (const [i, c] of cases.entries()) {
    const source = new Map(c.values.map((v, i) => [["a", "b", "c"][i]!, v] as [string, number]));
    const dist = new DictionaryProbDist(source, c.log, c.normalize); source.set("a", 999);
    for (const [p, s] of ["a", "b", "c", "missing"].entries()) {
      check(() => dist.prob(s), expected[i]!.probs[p]); check(() => dist.logprob(s), expected[i]!.logs[p]);
    }
  }
  const dist = new DictionaryProbDist<unknown>(new Map<unknown, number>([[true, 0.2], [1, 0.5], [null, 0.1], [undefined, 0.4]]));
  expect([...dist.samples()]).toEqual([true, null]);
  expect(dist.prob(true)).toBe(dist.prob(1)); expect(dist.prob(null)).toBe(dist.prob(undefined));
});

test("Rust information helpers, WittenBell errors, Uniform duplicates and Mutable quirks match the oracle", () => {
  const expected = oracle(`
out={}
out['sum']=[call(lambda a=a:sum_logs(a)) for a in [[],[-2,-2],[-1000,-1],[-1e300,-1e300]]]
out['entropy']=[call(lambda a=a:entropy(DictionaryProbDist(dict(zip(['a','b'],a))))) for a in [[.75,.25],[1,0],[-1,2]]]
out['witten']=[call(lambda fd=fd:WittenBellProbDist(FreqDist(fd))) for fd in [{},{'a':1}]]
u=UniformProbDist([True,1,False,0,None,None]); out['uniform']=[u.prob(x) for x in [True,1,False,0,None,'none']]
u.samples().append('new'); out['uniformMutation']=[u.prob(True),u.prob('new')]
out['mutable']=[]
for logs in [True,False]:
    samples=['a','b','a']; d=MutableProbDist(DictionaryProbDist({'a':.75,'b':.25}),samples,logs)
    row=[d.max(),list(d.samples()),call(lambda:d.update('b',-1)),d.prob('b'),d.logprob('b'),call(lambda:d.update('new',.1,False)),call(lambda:d.update('a',0,False))]
    samples.append('c'); row.extend([list(d.samples()),d.prob('c'),d.max()]); out['mutable'].append(row)
`, null) as { sum: unknown[]; entropy: unknown[]; witten: unknown[]; uniform: unknown[]; uniformMutation: unknown[]; mutable: unknown[][] };
  for (const [i, values] of [[], [-2, -2], [-1000, -1], [-1e300, -1e300]].entries()) check(() => sumLogs(values), expected.sum[i]);
  expect(addLogs(-2, -2)).toBe(sumLogs([-2, -2]));
  for (const [i, values] of [[0.75, 0.25], [1, 0], [-1, 2]].entries())
    check(() => entropy(new DictionaryProbDist({ a: values[0]!, b: values[1]! })), expected.entropy[i]);
  for (const [i, values] of ([{}, { a: 1 }] as Array<Record<string, number>>).entries())
    check(() => new WittenBellProbDist(new FreqDist(values)), expected.witten[i]);
  const uniform = new UniformProbDist<unknown>([true, 1, false, 0, null, null]);
  for (const [i, value] of [true, 1, false, 0, null, "none"].entries()) check(() => uniform.prob(value), expected.uniform[i]);
  (uniform.samples() as unknown[]).push("new");
  check(() => uniform.prob(true), expected.uniformMutation[0]); check(() => uniform.prob("new"), expected.uniformMutation[1]);
  for (const [i, logs] of [true, false].entries()) {
    const samples = ["a", "b", "a"], dist = new MutableProbDist(new DictionaryProbDist({ a: 0.75, b: 0.25 }), samples, logs);
    const want = expected.mutable[i]!;
    check(() => dist.max(), want[0]); check(() => [...dist.samples()], want[1]);
    check(() => { dist.update("b", -1); return null; }, want[2]);
    check(() => dist.prob("b"), want[3]); check(() => dist.logprob("b"), want[4]);
    check(() => dist.update("new", 0.1, false), want[5]); check(() => { dist.update("a", 0, false); return null; }, want[6]);
    samples.push("c"); check(() => [...dist.samples()], want[7]); check(() => dist.prob("c"), want[8]); check(() => dist.max(), want[9]);
  }
  // NLTK's log_likelihood iterates ProbDistI (normally non-iterable); this
  // existing TS samples()-based API is intentionally retained as an extension.
  const actual: ProbDistLike<string> = new DictionaryProbDist({ a: 0.75, b: 0.25 });
  expect(logLikelihood(new DictionaryProbDist({ a: 0.5, b: 0.5 }), actual)).toBe(-1);
});
