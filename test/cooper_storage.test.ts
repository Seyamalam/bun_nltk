import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { Expression, resetUniqueVariableCounter } from "../src/sem_logic";
import { FeatDict, FeatList, FeatureValueTuple, type FeatValue } from "../src/featstruct";
import { CooperStore, cooperStoreFromTree, parse_with_bindops } from "../src/cooper_storage";
import { dataPath } from "../src/data";

const ORACLE = resolve(import.meta.dir, "cooper_storage_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");
const DATA = resolve(import.meta.dir, "../.cache/nltk-data");

// parse_with_bindops resolves grammars/book_grammars/storage.fcfg through
// data.find — self-provision the data dir so the test does not depend on
// NLTK_DATA being set or on another test file pushing it first.
if (!dataPath.includes(DATA)) dataPath.push(DATA);

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
    const trees = parse_with_bindops(sent);
    expect(trees.length).toBe(want.num_trees);
    const analyses = trees.map((t) => {
      const cs = cooperStoreFromTree(t);
      cs.s_retrieve();
      return { ...canonize(String(cs.core), String(cs.store)), readings: cs.readings.map(String) };
    });
    expect(analyses).toEqual(want.analyses.map((a) => ({ ...canonize(a.core, a.store), readings: a.readings })));
  }
});

test("parse_with_bindops(sentence) uses the bundled default storage.fcfg", () => {
  resetUniqueVariableCounter();
  const trees = parse_with_bindops("Angus smiles");
  expect(trees.length).toBe(oracle.bindops["Angus smiles"]!.num_trees);
});

test("parse_with_bindops bad grammar path raises LookupError like the oracle", () => {
  try {
    parse_with_bindops("every girl chases a dog", "grammars/does_not_exist.fcfg");
    expect.unreachable("expected LookupError");
  } catch (e) {
    expect((e as Error).name).toBe("LookupError");
  }
});
