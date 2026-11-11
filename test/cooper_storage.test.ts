import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { Expression, resetUniqueVariableCounter } from "../src/sem_logic";
import { FeatDict, FeatList, FeatureValueTuple, type FeatValue } from "../src/featstruct";
import { CooperStore, cooperStoreFromTree, parse_with_bindops } from "../src/cooper_storage";

const ORACLE = resolve(import.meta.dir, "cooper_storage_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");

const oracle = (() => {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    cwd: resolve(import.meta.dir, ".."),
    env: { ...process.env, NLTK_DATA: resolve(import.meta.dir, "../.cache/nltk-data") },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(`oracle failed: ${proc.stderr.toString()}`);
  return JSON.parse(proc.stdout.toString().trim().split("\n").pop()!) as {
    nltk: string;
    two: { readings: string[] };
    two_trace: { readings: string[]; trace: string[] };
    one: { readings: string[] };
    three: { readings: string[] };
    empty: { readings: string[] };
    featlist_err: string;
    diag: string;
    attr_err: string;
    bindops: Record<string, { num_trees: number; analyses: { core: string; store: string; readings: string[] }[] }>;
  };
})();

// Real book_grammars/storage.fcfg — identical to the oracle script's copy.
const STORAGE_FCFG = `
## Natural Language Toolkit: storage.fcfg
##
## Feature-based grammar that implements Cooper storage by dividing the
## semantics for each phrase into two pieces: the core semantics
## ('SEM','CORE') and a sequence of binding operators ('SEM','STORE').
## Each binding operator is encoded as a logic term <bo(quant, var)>,
## where <quant> is a quantifier expression and the individual variable
## <@var> specifies the 'address' of the quantifier in the core
## semantics.  and <predicate> is a predicate describing that variable.

## In order for this grammar to generate the correct results, all
## variables of the form <@var> must be instantiated (i.e., replaced
## by unique new variables) whenever they are used.  This can be
## accomplished by using the InstantiateVarsChart class when parsing.
## 
## Author: Edward Loper <edloper@gradient.cis.upenn.edu>,
##         Ewan Klein <ewan@inf.ed.ac.uk>
##         Robin Cooper <robin.cooper@ling.gu.se>
## URL: <http://nltk.sourceforge.net>
## For license information, see LICENSE.TXT

%start S

S[SEM=[CORE=<?vp(?subj)>, STORE=(?b1+?b2)]] -> NP[SEM=[CORE=?subj, STORE=?b1]] VP[SEM=[CORE=?vp, STORE=?b2]]

VP[SEM=?s] -> IV[SEM=?s]
VP[SEM=[CORE=<?v(?obj)>, STORE=(?b1+?b2)]] -> TV[SEM=[CORE=?v, STORE=?b1]] NP[SEM=[CORE=?obj, STORE=?b2]]
VP[SEM=[CORE=<?v(?pp)(?obj)>, STORE=(?b1+?b2+?b3)]] -> DTV[SEM=[CORE=?v, STORE=?b1]] NP[SEM=[CORE=?obj, STORE=?b2]] PP[+TO, SEM=[CORE=?pp, STORE=?b3]]  

NP[SEM=[CORE=<@x>, STORE=((<bo(?det(?n),@x)>)+?b1+?b2)]] -> Det[SEM=[CORE=?det, STORE=?b1]] N[SEM=[CORE=?n, STORE=?b2]]

PP[+TO, SEM=[CORE=?np, STORE=?b1]] -> P NP[SEM=[CORE=?np, STORE=?b1]]

# Lexical items:
Det[SEM=[CORE=<\\Q P.exists x.(Q(x) & P(x))>, STORE=(/)]] -> 'a'
Det[SEM=[CORE=<\\Q P.all x.(Q(x) implies P(x))>, STORE=(/)]] -> 'every'

N[SEM=[CORE=<dog>, STORE=(/)]] -> 'dog' 
N[SEM=[CORE=<bone>, STORE=(/)]] -> 'bone' 
N[SEM=[CORE=<girl>, STORE=(/)]] -> 'girl' 
N[SEM=[CORE=<man>, STORE=(/)]] -> 'man'

IV[SEM=[CORE=<\\x.smile(x)>, STORE=(/)]] -> 'smiles' 
IV[SEM=[CORE=<\\x.walk(x)>, STORE=(/)]] -> 'walks'

TV[SEM=[CORE=<\\y x.feed(x,y)>, STORE=(/)]] -> 'feeds' 
TV[SEM=[CORE=<\\y x.chase(x,y)>, STORE=(/)]] -> 'chases'

DTV[SEM=[CORE=<\\z y x.give(x,y,z)>, STORE=(/)]] -> 'gives' 

NP[SEM=[CORE=<@x>, STORE=(<bo(\\P.P(angus),@x)>)]] -> 'Angus' 
NP[SEM=[CORE=<@x>, STORE=(<bo(\\P.P(cyril),@x)>)]] -> 'Cyril'

P[+TO] -> 'to'
`;

const expr = (s: string) => Expression.fromstring(s);
const fsOf = (core: FeatValue, store: FeatValue) => new FeatDict({ CORE: core, STORE: store });

const B1 = () => expr("bo(\\P.all x.(man(x) -> P(x)),z1)");
const B2 = () => expr("bo(\\P.exists y.(dog(y) & P(y)),z2)");
const B3 = () => expr("bo(\\P.exists w.(bone(w) & P(w)),z3)");
const CORE = () => expr("chase(g,d)");

test("CooperStore.s_retrieve permutations match oracle", () => {
  expect(oracle.nltk).toBe("3.10.3");
  const cs = new CooperStore(fsOf(CORE(), [B1(), B2()] as unknown as FeatValue));
  cs.s_retrieve();
  expect(cs.readings.map(String)).toEqual(oracle.two.readings);

  const cs1 = new CooperStore(fsOf(CORE(), [B1()] as unknown as FeatValue));
  cs1.s_retrieve();
  expect(cs1.readings.map(String)).toEqual(oracle.one.readings);

  const cs3 = new CooperStore(fsOf(CORE(), [B1(), B2(), B3()] as unknown as FeatValue));
  cs3.s_retrieve();
  expect(cs3.readings.map(String)).toEqual(oracle.three.readings);

  const cs0 = new CooperStore(fsOf(CORE(), new FeatureValueTuple()));
  cs0.s_retrieve();
  expect(cs0.readings.map(String)).toEqual(oracle.empty.readings);
});

test("s_retrieve trace output matches oracle", () => {
  const cs = new CooperStore(fsOf(CORE(), [B1(), B2()] as unknown as FeatValue));
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => lines.push(a.join(" "));
  try {
    cs.s_retrieve(true);
  } finally {
    console.log = orig;
  }
  expect(lines).toEqual(oracle.two_trace.trace);
  expect(cs.readings.map(String)).toEqual(oracle.two_trace.readings);
});

test("non-storage featstruct prints oracle diagnostic; s_retrieve AttributeError", () => {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => lines.push(a.join(" "));
  let cs: CooperStore;
  try {
    cs = new CooperStore(fsOf(CORE(), undefined as unknown as FeatValue));
  } finally {
    console.log = orig;
  }
  // FeatDict repr differs in shape but the suffix is the oracle's diagnostic.
  expect(lines[0]!.endsWith("is not a Cooper storage structure")).toBe(true);
  try {
    cs!.s_retrieve();
    expect.unreachable("expected AttributeError");
  } catch (e) {
    expect((e as Error).name).toBe("AttributeError");
    expect((e as Error).message).toBe(oracle.attr_err);
  }
});

test("FeatList STORE throws the oracle TypeError", () => {
  const fs = new FeatDict({ CORE: CORE(), STORE: new FeatList([B1()]) });
  const cs = new CooperStore(fs);
  try {
    cs.s_retrieve();
    expect.unreachable("expected TypeError");
  } catch (e) {
    expect((e as Error).name).toBe("TypeError");
    expect((e as Error).message).toBe(oracle.featlist_err);
  }
});

test("parse_with_bindops on storage.fcfg matches oracle end-to-end", () => {
  // z-numbering derives from the shared unique-variable counter — reset so
  // @x instantiation matches the oracle regardless of prior tests in-process.
  resetUniqueVariableCounter();
  // @x instantiation numbering follows chart edge-insertion order, which is
  // cosmetic — canon normalizes z-names per analysis (shared across core+store
  // so bindop→core addressing stays pinned); readings already match exactly.
  const canonize = (core: string, store: string) => {
    const seen = new Map<string, string>();
    let n = 0;
    const cv = (s: string) => s.replace(/z\d+/g, (m) => seen.get(m) ?? (seen.set(m, `@${++n}`), `@${n}`));
    return { core: cv(core), store: cv(store) };
  };
  for (const [sent, want] of Object.entries(oracle.bindops)) {
    const trees = parse_with_bindops(sent, STORAGE_FCFG);
    expect(trees.length).toBe(want.num_trees);
    const analyses = trees.map((t) => {
      const cs = cooperStoreFromTree(t);
      cs.s_retrieve();
      return { ...canonize(String(cs.core), String(cs.store)), readings: cs.readings.map(String) };
    });
    expect(analyses).toEqual(want.analyses.map((a) => ({ ...canonize(a.core, a.store), readings: a.readings })));
  }
});

test("parse_with_bindops without grammar raises LookupError (default storage.fcfg not bundled)", () => {
  try {
    parse_with_bindops("every girl chases a dog");
    expect.unreachable("expected LookupError");
  } catch (e) {
    expect((e as Error).name).toBe("LookupError");
    expect((e as Error).message).toContain("storage.fcfg");
  }
});
