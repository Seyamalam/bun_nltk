// Final-gaps differential vs pinned NLTK 3.10.3 oracle:
//   nltk.sem.boxer (pure DRS family), nltk.sem.chat80 (records/sql/vocab),
//   nltk.parse stepping parsers + TestGrammar, nltk.parse.corenlp.transform.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import {
  AbstractBoxerDrs,
  BoxerCard,
  BoxerDrs,
  BoxerDrsParser,
  BoxerEq,
  BoxerIndexed,
  BoxerNamed,
  BoxerNot,
  BoxerOr,
  BoxerOutputDrsParser,
  BoxerPred,
  BoxerProp,
  BoxerRel,
  BoxerWhq,
  NltkDrtBoxerDrsInterpreter,
  PassthroughBoxerDrsInterpreter,
  parseToDrsDict,
} from "../src/sem_boxer";
import {
  cities2table,
  main as chat80Main,
  processBundle,
  rels,
  sqlDemo,
  sqlQuery,
  str2records,
} from "../src/sem_chat80";
import {
  SteppingRecursiveDescentParser,
  SteppingShiftReduceParser,
  TestGrammar,
  transform,
} from "../src/parse_stepping";
import { CFG } from "../src/grammar";
import { load_parser } from "../src/inference_discourse";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");

function oracle(): Record<string, any> {
  const res = spawnSync("python3", ["test/final_gaps_oracle.py"], {
    encoding: "utf-8",
    env: { ...process.env, NLTK_DATA },
  });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

/** Python f"{type(e).__name__}:{str(e)[:200]}" for thrown errors. */
function errWrap<T>(f: () => T): { err: string | null; val: T | null } {
  try {
    return { err: null, val: f() };
  } catch (e: any) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    return { err: `${name}:${msg.slice(0, 200)}`, val: null };
  }
}

/** Python repr() of a sent_index — float repr for prolog-parse provenance. */
function reprSentIndex(d: BoxerIndexed): string {
  const si = d.sent_index;
  if (si === null) return "None";
  if (d.sentIndexFloat) return Number.isInteger(si) ? `${si}.0` : `${si}`;
  return `${si}`;
}

/** Python str() of a discourse_id. */
function strDisc(d: BoxerIndexed): string {
  return d.discourse_id === null ? "None" : `${d.discourse_id}`;
}

/** Deterministic serialization mirroring the oracle's canon(). */
function canon(d: AbstractBoxerDrs): any {
  if (d instanceof BoxerDrs) {
    return [
      d.consequent !== null ? "imp" : "drs",
      [...d.refs].map(String).sort(),
      d.conds.map((c) => canon(c)),
      d.consequent !== null ? canon(d.consequent) : null,
    ];
  }
  if (d instanceof BoxerNot) return ["not", canon(d.drs)];
  const disc = strDisc(d as BoxerIndexed);
  const si = reprSentIndex(d as BoxerIndexed);
  const wi = [...(d as BoxerIndexed).word_indices];
  if (d instanceof BoxerWhq) {
    return ["whq", disc, si, wi, [...d.ans_types], canon(d.drs1), `${d.variable}`, canon(d.drs2)];
  }
  if (d instanceof BoxerOr) return ["or", disc, si, wi, canon(d.drs1), canon(d.drs2)];
  if (d instanceof BoxerProp) return ["prop", disc, si, wi, `${d.var}`, canon(d.drs)];
  if (d instanceof BoxerPred) return ["pred", disc, si, wi, `${d.var}`, d.name, d.pos, d.sense];
  if (d instanceof BoxerNamed) return ["named", disc, si, wi, `${d.var}`, d.name, d.type, `${d.sense}`];
  if (d instanceof BoxerRel) return ["rel", disc, si, wi, `${d.var1}`, `${d.var2}`, d.rel, d.sense];
  if (d instanceof BoxerEq) return ["eq", disc, si, wi, `${d.var1}`, `${d.var2}`];
  if (d instanceof BoxerCard) return ["card", disc, si, wi, `${d.var}`, d.value, d.type];
  return ["??", `${d}`];
}

const BOXER_INPUTS = [
  "drs([[1000,1001]:x1, [1002]:e2], [[1000,1001]:pred(x1, dog, n, 0), [1002]:rel(e2, x1, agent, 0)])",
  "drs([[1001]:x1], [[10001,2001,15001]:pred(x1, run, v, 0)])",
  "drs([[1001]:x1, [1002]:x2], [[1001]:named(x1, john, per, 0), [1002]:pred(x2, dog, n, 0), [1003]:eq(x1, x2), [1004]:card(x2, 2, ge), [1005]:prop(p1, drs([[1006]:x3], [[1006]:pred(x3, cat, n, 0)])), [1007]:not(drs([[1008]:x4], [[1008]:pred(x4, fish, n, 0)]))])",
  "merge(drs([[1001]:x1], [[1001]:pred(x1, dog, n, 0)]), drs([[1002]:x2], [[1002]:pred(x2, cat, n, 0)]))",
  "drs([[1001]:x1], [[1002]:or(drs([[1003]:x2], [[1003]:pred(x2, dog, n, 0)]), drs([[1004]:x3], [[1004]:pred(x3, cat, n, 0)])), [1005]:imp(drs([[1006]:x4], [[1006]:pred(x4, dog, n, 0)]), drs([[1007]:x5], [[1007]:pred(x5, animal, n, 0)]))])",
  "drs([[1001]:x1], [[1001]:timex(x1, date([]: (+), []:'XXXX', [1004]:'04', []:'XX'))])",
  "drs([[1001]:x1], [[1001]:whq([des:wh num:cou], drs([[1002]:x2], [[1002]:pred(x2, dog, n, 0)]), x2, drs([[1003]:x3], [[1003]:pred(x3, run, v, 0)]))])",
  "drs([[-1]:x1], [[-1]:pred(x1, dog, n, 0)])",
  "alfa(def, drs([[1001]:x1], [[1001]:pred(x1, dog, n, 0)]), drs([[1002]:x2], [[1002]:pred(x2, cat, n, 0)]))",
  "drs([[1001]:x1], [[1001]:duplex(whq, drs([[1002]:x2], [[1002]:pred(x2, dog, n, 0)]), x2, drs([[1003]:x3], [[1003]:pred(x3, run, v, 0)]))])",
];

function boxerCase(s: string) {
  const parsed = new BoxerOutputDrsParser().parse(s) as AbstractBoxerDrs;
  return {
    canon: errWrap(() => canon(parsed)),
    variables: errWrap(() => parsed.variables().map((t) => [...t].map(String).sort())),
    variable_types: errWrap(() =>
      Object.entries(parsed.variableTypes()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    atoms: errWrap(() => parsed.atoms().map((a) => `${a}`).sort()),
    interpret: errWrap(() => `${new NltkDrtBoxerDrsInterpreter().interpret(parsed)}`),
    interpret_occur: errWrap(() => `${new NltkDrtBoxerDrsInterpreter(true).interpret(parsed)}`),
    passthrough: errWrap(() => canon(new PassthroughBoxerDrsInterpreter().interpret(parsed) as AbstractBoxerDrs)),
    clean: errWrap(() => canon(parsed.clean())),
    renumber: errWrap(() =>
      canon(parsed.renumberSentences((i) => (i === null ? null : i + 10)))),
    reparse: errWrap(() =>
      canon(new BoxerDrsParser().parse(`${parsed}`) as AbstractBoxerDrs)),
    reparse_disc: errWrap(() =>
      canon(new BoxerDrsParser("doc7").parse(`${parsed}`) as AbstractBoxerDrs)),
  };
}

// ---------------------------------------------------------------------------
const RD_GRAMMAR = `S -> NP VP
NP -> Det N | Det N PP
VP -> V NP | V NP PP
PP -> P NP
NP -> 'I'
N -> 'man' | 'park' | 'telescope' | 'dog'
Det -> 'the' | 'a'
P -> 'in' | 'with'
V -> 'saw'`;

const SR_GRAMMAR = `S -> NP VP
NP -> 'I' | Det N
Det -> 'a'
N -> 'man'
VP -> V NP
V -> 'saw'`;

const SENT = "I saw a man".split(" ");

function stepStr(r: any): string {
  if (r === null || r === undefined) return "None";
  return typeof r === "boolean" ? (r ? "True" : "False") : `${r}`;
}

function rdCase(trace: number) {
  const g = CFG.fromstring(RD_GRAMMAR);
  const chunks: string[] = [];
  const p = new SteppingRecursiveDescentParser(g, trace, (s) => chunks.push(s));
  p.initialize([...SENT]);
  const steps: string[] = [];
  while (true) {
    const r = p.step();
    steps.push(stepStr(r));
    if (r === null) break;
  }
  return {
    trace: chunks.join(""),
    steps,
    parses: [...p.parses()].map((t: any) => `${t}`),
  };
}

function rdState() {
  const g = CFG.fromstring(RD_GRAMMAR);
  const p = new SteppingRecursiveDescentParser(g);
  p.initialize([...SENT]);
  p.expand();
  return {
    frontier: p.frontier(),
    tree: `${p.tree()}`,
    remaining: [...p.remainingText()!],
    expandable: p.expandableProductions().map((x: any) => `${x}`),
    untried: p.untriedExpandableProductions().map((x: any) => `${x}`),
    untried_match: p.untriedMatch(),
    complete: p.currentlyComplete(),
  };
}

function srCase(trace: number) {
  const g = CFG.fromstring(SR_GRAMMAR);
  const chunks: string[] = [];
  const p = new SteppingShiftReduceParser(g, trace, (s) => chunks.push(s));
  p.initialize([...SENT]);
  const steps: string[] = [];
  while (true) {
    const r = p.step();
    steps.push(stepStr(r));
    if (r === false) break;
  }
  return {
    trace: chunks.join(""),
    steps,
    parses: [...p.parses()].map((t: any) => `${t}`),
  };
}

function srTrace3() {
  const g = CFG.fromstring(SR_GRAMMAR);
  const chunks: string[] = [];
  const p = new SteppingShiftReduceParser(g, 3, (s) => chunks.push(s));
  p.initialize([...SENT]);
  while (true) {
    const r = p.step();
    if (r === false) break;
  }
  return chunks.join("");
}

function srState() {
  const g = CFG.fromstring(SR_GRAMMAR);
  const p = new SteppingShiftReduceParser(g);
  p.initialize([...SENT]);
  p.shift();
  p.reduce();
  const stack1 = p.stack()!.map((x: any) => `${x}`);
  const red = p.reducibleProductions().map((x: any) => `${x}`);
  p.undo();
  const stack2 = p.stack()!.map((x: any) => `${x}`);
  return { after_reduce: stack1, reducible: red, after_undo: stack2, remaining: [...p.remainingText()!] };
}

describe("final gaps vs NLTK 3.10.3 oracle", () => {
  const o = oracle();

  // ------------------------------------------------------------------ boxer
  test("boxer parse/interpret/canon per input", () => {
    for (let i = 0; i < BOXER_INPUTS.length; i++) {
      const expected = o.boxer[i];
      const got = errWrap(() => boxerCase(BOXER_INPUTS[i]!));
      expect(got.err).toBe(expected.err);
      if (expected.val) expect(got.val).toEqual(expected.val);
    }
  });

  test("boxer parse errors", () => {
    const inputs = [
      () => new BoxerOutputDrsParser().parse("drs([[1001]:x1], [[1001]:bogus(x1, dog, n, 0)])"),
      () => new BoxerOutputDrsParser().parse("drs([[1001]:x1], [[1001]:timex(x1, time([1018]:'18', []:'XX', []:'XX'))])"),
      () => new BoxerOutputDrsParser().parse("drs([[1001]:q1], [[1001]:pred(q1, dog, n, 0)])"),
      () => new BoxerOutputDrsParser().parse("bogus"),
      () => new BoxerDrsParser().parse("bogus(x)"),
    ];
    for (let i = 0; i < inputs.length; i++) {
      const got = errWrap(inputs[i]!);
      expect(got.err).toBe(o.boxer_errors[i].err);
    }
  });

  test("boxer _parse_to_drs_dict", () => {
    const cases: [string, boolean][] = [
      ["id('wsj.1',1).\nsem(1,[x1],drs([[1001,1002]:x1, [1003]:e2], [[1001,1002]:pred(x1, dog, n, 0), [1003]:rel(e2, x1, agent, 0)])).\n", false],
      ["id(doc5,2).\nsem(2,[],drs([[1001]:x1],[[1001]:named(x1, john, per, 0)])).\n", true],
    ];
    for (let i = 0; i < cases.length; i++) {
      const [out, useDiscId] = cases[i]!;
      const got = errWrap(() =>
        [...parseToDrsDict(out, useDiscId).entries()]
          .map(([k, v]) => [k, `${v}`])
          .sort(([a]: any, [b]: any) => (a < b ? -1 : a > b ? 1 : 0)));
      expect(got.err).toBe(o.drs_dict[i].err);
      expect(got.val).toEqual(o.drs_dict[i].val);
    }
  });

  // ----------------------------------------------------------------- chat80
  test("chat80 _str2records", () => {
    const records = str2records("cities.pl", "city");
    expect(records.length).toBe(o.chat80_records.n);
    expect(records[0]).toEqual(o.chat80_records.first);
    expect(records[records.length - 1]).toEqual(o.chat80_records.last);
    expect(records.slice(10, 13)).toEqual(o.chat80_records.sample);
  });

  test("chat80 cities2table + sql roundtrip", () => {
    const tmp = mkdtempSync(join(NLTK_DATA, "tmp-chat80-"));
    const dbpath = join(tmp, "city.db");
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: any[]) => logs.push(a.join(" "));
    try {
      cities2table("cities.pl", "city", dbpath, true, true);
    } finally {
      console.log = origLog;
    }
    expect(logs.slice(0, 4)).toEqual(o.cities2table_verbose.slice(0, 4));
    expect(logs[logs.length - 1]).toBe(`Committing update to ${dbpath}`);
    expect(o.cities2table_verbose[o.cities2table_verbose.length - 1]).toMatch(/^Committing update to .*city\.db$/);

    const db = new Database(dbpath, { readonly: true });
    const rows = db.prepare("SELECT * FROM city_table ORDER BY City").values().slice(0, 5);
    expect(rows).toEqual(o.city_table_rows);
    expect(db.prepare("SELECT count(*) FROM city_table").values()).toEqual([[o.city_table_count]]);
    const china = db
      .prepare('SELECT City, Population FROM city_table WHERE Country="china"')
      .values();
    expect(china).toEqual(o.city_query_china);
    db.close();
  });

  test("chat80 sql_query + sql_demo", () => {
    const got = errWrap(() =>
      sqlQuery("corpora/city_database/city.db",
        "SELECT City, Population FROM city_table WHERE Population > 3000 ORDER BY Population DESC"));
    expect(got.err).toBe(o.sql_query.err);
    expect(got.val).toEqual(o.sql_query.val);

    const gotErr = errWrap(() =>
      sqlQuery("corpora/city_database/city.db", "SELECT bogus FROM nope_table"));
    expect(gotErr.err).toBe(o.sql_query_err.err);

    const origLog = console.log;
    const lines: string[] = [];
    console.log = (...a: any[]) => lines.push(a.join(" "));
    try {
      sqlDemo();
    } finally {
      console.log = origLog;
    }
    expect(lines).toEqual(o.sql_demo);
  });

  test("chat80 concepts/vocab + main -v", () => {
    const cmap = processBundle(rels);
    const vocab = Object.values(cmap)
      .map((c) => [c.arity, c.prefLabel] as [number, string])
      .sort(([a1, l1], [a2, l2]) => a1 - a2 || (l1 < l2 ? -1 : l1 > l2 ? 1 : 0));
    expect(vocab.map(([a, l]) => [a, l])).toEqual(o.concepts_vocab);
    expect(`${cmap["city"]}`).toBe(o.concept_city);
    expect(`${cmap["border"]}`).toBe(o.concept_border);

    const origLog = console.log;
    const lines: string[] = [];
    console.log = (...a: any[]) => lines.push(a.join(" "));
    try {
      chat80Main({ vocab: true });
    } finally {
      console.log = origLog;
    }
    expect(lines).toEqual(o.main_vocab_lines);
  });

  test("english -> sql translations + rows", () => {
    const cp = load_parser("grammars/book_grammars/sql0.fcfg") as any;
    const en2sql = (q: string) => {
      const trees = [...cp.parse(q.split(" "))];
      if (!trees.length) return null;
      const sem = trees[0].label.get("SEM") as { items: string[] };
      return sem.items.filter((s) => s).join(" ");
    };
    for (const q of Object.keys(o.en2sql)) {
      const got = errWrap(() => en2sql(q));
      const expected = o.en2sql[q];
      if (expected.err) {
        // coverage failures come from grammar.ts check_coverage as a plain
        // Error (message identical to Python's ValueError) — normalize the name.
        expect(got.err?.replace(/^Error:/, "ValueError:")).toBe(expected.err);
      } else {
        expect(got.val).toBe(expected.val);
      }
    }
    for (const q of Object.keys(o.en2sql_rows)) {
      const rows = sqlQuery("corpora/city_database/city.db", en2sql(q)!);
      expect(rows).toEqual(o.en2sql_rows[q]);
    }
  });

  // -------------------------------------------------------- stepping parsers
  test("stepping recursive descent traces/steps/parses", () => {
    for (const t of [1, 2, 3]) {
      expect(rdCase(t)).toEqual(o.rd[String(t)]);
    }
    expect(rdState()).toEqual(o.rd_state);
  });

  test("stepping shift-reduce traces/steps/parses", () => {
    for (const t of [1, 2]) {
      expect(srCase(t)).toEqual(o.sr[String(t)]);
    }
    expect(srState()).toEqual(o.sr_state);
    // trace>2 hits the genuine nonlexical-production TypeError quirk.
    const got = errWrap(srTrace3);
    expect(got.err).toBe(o.sr_trace3.err);
  });

  // ------------------------------------------------------------- TestGrammar
  test("TestGrammar accept/reject/show_trees/errors", () => {
    const tmp = mkdtempSync(join(NLTK_DATA, "tmp-tg-"));
    const gpath = join(tmp, "test.cfg");
    writeFileSync(gpath, SR_GRAMMAR);
    const url = `file://${gpath}`;

    const tgCase = (suite: any[], show = false) =>
      errWrap(() => {
        const chunks: string[] = [];
        const tg = new TestGrammar(url, suite, null, null, (s) => chunks.push(s));
        tg.run(show);
        return chunks.join("");
      });

    expect(tgCase([
      { doc: "grammar tests", accept: ["I saw a man"], reject: ["man saw", "saw"] },
    ])).toEqual(o.testgrammar_ok);
    expect(tgCase([
      { doc: "show", accept: ["I saw a man"], reject: ["man"] },
    ], true)).toEqual(o.testgrammar_show);
    expect(tgCase([
      { doc: "bad", accept: ["I saw"], reject: ["man"] },
    ])).toEqual(o.testgrammar_fail_accept);
    expect(tgCase([
      { doc: "bad", accept: ["I saw a man"], reject: ["I saw a man"] },
    ])).toEqual(o.testgrammar_fail_reject);
    expect(tgCase([
      { doc: "nobind", accept: ["I saw a man"], reject: [] },
    ])).toEqual(o.testgrammar_unbound);
  });

  // ---------------------------------------------------------------- transform
  test("corenlp transform", () => {
    const sentence = {
      basicDependencies: [
        { dep: "ROOT", governor: 0, dependent: 2 },
        { dep: "nsubj", governor: 2, dependent: 1 },
        { dep: "dobj", governor: 2, dependent: 4 },
        { dep: "det", governor: 4, dependent: 3 },
      ],
      tokens: [
        { index: 1, word: "Dogs", lemma: "dog", pos: "NNS", characterOffsetBegin: 0 },
        { index: 2, word: "run", lemma: "run", pos: "VBP" },
        { index: 3, word: "the", lemma: "the", pos: "DT" },
        { index: 4, word: "park", lemma: "park", pos: "NN" },
      ],
    };
    expect([...transform(sentence)].map((t) => [...t])).toEqual(o.transform);
  });
});
