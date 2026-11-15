// Pure-gaps differential vs pinned NLTK 3.10.3 oracle (test/gap_pure_oracle.py).
// Oracle output has nondeterministic bits — normalized here:
//   * heap addresses      0x[0-9a-f]+        → 0xADDR
//   * elapsed seconds     "N.NNNsec"/Time:   → normalized floats
//   * python set ordering {...}              → member-sorted
//   * misc.sort/kmeans(2) RNG                → shape/invariants only
import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import {
  arityParseDemo, chartDemo, collect, conllDemo, conllFileDemo, cooperDemo,
  cycleFindingDemo, demoEval, dependencygraphDemo, distanceDemo, drtDemo,
  earleychartDemo, emDemo, evaluateDemo, featurechartDemo, foldemo, folmodel,
  generateDemo, hallDemo, kmeansDemo, linearlogicDemo, nonprojectiveConllParseDemo,
  nppDemo, pchartDemo, pdpDemo, prodemoMissing, projectiveProbParseDemo,
  demoReadDepgraph, punktDemo, porterDemo, tntDemo, tntDemoErrors,
  elizaDemo, ieshaDemo, rudeDemo, suntsuDemo, zenDemo, gaacDemo, wordfinderDemo,
  projectiveRuleParseDemo, propdemo, recursivedescentDemo, ruleBasedDemo,
  satdemo, scoresDemo, semUtilDemo, shiftreduceDemo, sortDemo, viterbiDemo,
} from "../src/demos";
import {
  BasicTweetHandler, LOCAL, LocalTimezoneOffsetWithUTC, PyRandom, TweetHandlerI,
  findJarIter, findJar, findJarsWithinPath, findMaltModel, findMaltparser,
  maltRegexTagger, outfWriterCompat, stanfordFindJar, tryPort,
} from "../src/ext_pure";
import { bots } from "../src/ext_pure";
import { RegexpParser } from "../src/chunk_nltk";
import { resetUniqueVariableCounter } from "../src/sem_logic";
import { clearTemplateRegistry } from "../src/brill_tagger";
import { demo as hmmDemo, demo_bw, demo_pos, demo_pos_bw } from "../src/hmm_tagger";
import { demo as toolboxDemo } from "../src/toolbox";
import { demo as snowballDemo } from "../src/snowball_demo";
import { demo as chunkRegexpDemo } from "../src/chunk_regexp_demo";
import { demo as transitionparserDemo } from "../src/parse_wrappers";
import {
  demo as tblDemo,
  demoErrorAnalysis, demoGeneratedTemplates, demoHighAccuracyRules,
  demoLearningCurve, demoMultifeatureTemplate, demoMultipositionFeature,
  demoReprRuleFormat, demoSerializeTagger, demoStrRuleFormat,
  demoTemplateStatistics, demoVerboseRuleFormat,
} from "../src/tbl_demo";
import { dataPath } from "../src/data";
import { gunzipSync } from "node:zlib";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");

function oracle(): { out: Record<string, any>; errs: Record<string, string> } {
  const res = spawnSync("python3", ["test/gap_pure_oracle.py"], {
    encoding: "utf-8",
    env: { ...process.env, NLTK_DATA, PYTHONHASHSEED: "0" },
  });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

// ---------- normalizers ----------

/** Sort members of top-level {...} set literals (python hash order is unstable). */
function normSets(s: string): string {
  let res = "", i = 0;
  while (i < s.length) {
    if (s[i] === "{") {
      let depth = 0, j = i;
      for (; j < s.length; j++) {
        if (s[j] === "{") depth++;
        else if (s[j] === "}") { depth--; if (!depth) { j++; break; } }
      }
      if (depth === 0) {
        const inner = s.slice(i + 1, j - 1);
        // split top level commas (nesting in (), [] and {}); normalize each
        // part recursively so nested sets sort too — python hash order varies.
        const parts: string[] = [];
        let d = 0, last = 0;
        for (let k = 0; k <= inner.length; k++) {
          const c = inner[k];
          if (c === "(" || c === "[" || c === "{") d++;
          else if (c === ")" || c === "]" || c === "}") d--;
          if ((c === "," && d === 0) || k === inner.length) {
            parts.push(normSets(inner.slice(last, k)));
            last = k + 1;
          }
        }
        if (parts.length > 1) { res += "{" + parts.map(p => p.trim()).sort().join(", ") + "}"; i = j; continue; }
      }
    }
    res += s[i++];
  }
  return res;
}

function norm(s: string): string {
  let t = s
    .replace(/0x[0-9a-fA-F]+/g, "0xADDR")
    // "parser:  0.123sec" / "Time: 0.123"
    .replace(/(parser:)\s+[\d.]+sec/g, "$1 TIME")
    .replace(/(Time: )[\d.eE+-]+/g, "$1TIME")
    // pchart/viterbi summary tables: elapsed seconds column
    .replace(/(Time \(secs\)\s+# Parses   Average P\(parse\)\n-+\n\s*)[\d.]+/g, "$1TIME")
    .replace(/(\|\s*)[\d.]+(\s+\d+\s+[\d.eE+-]+)/g, "$1TIME$2")
    .replace(/(Trained tbl tagger in )[\d.]+( seconds)/g, "$1TIME$2")
    // em loglikelihood: trailing digits diverge via LAPACK dgetri + libm pow
    // internals (OpenBLAS/glibc vs our scalar port) — truncate to 13 decimals.
    .replace(/(iteration; loglikelihood -?\d+\.\d{13})\d+/g, "$1");
  // "* Parsing times" rows are sorted by real elapsed time — order is timing-dependent.
  const rows = t.split("\n");
  const isTimeRow = (l: string) => l.endsWith(" parser: TIME");
  const sorted = rows.filter(isTimeRow).sort();
  let ri = 0;
  return normSets(rows.map((l) => (isTimeRow(l) ? sorted[ri++]! : l)).join("\n"));
}

/** Python err string "Name: ..." prefix compare. */
function errName(s: string | null | undefined): string {
  return s ? s.split(":")[0]! : "null";
}

function errWrap(f: () => unknown): { text: string; err: string | null } {
  const c = collect();
  try { f(); return { text: c.text(), err: null }; }
  catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    return { text: c.text(), err: name };
  }
}

const O = oracle();
// Demos load grammars/book_grammars via data.find — make the cache dir
// discoverable regardless of which test file ran before us.
if (!dataPath.includes(NLTK_DATA)) dataPath.push(NLTK_DATA);
const T = (k: string) => norm(O.out[k]?.text ?? "");
const E = (k: string) => O.errs[k] ?? undefined;

// helper: fresh collector per call
function run(f: (out: (s: string) => void) => void): string {
  const c = collect(); f(c.out); return norm(c.text());
}

describe("chart/rd/sr/earley/feature", () => {
  test("chart 2", () => expect(run(o => chartDemo(o, { choice: "2" }))).toBe(T("chart_demo_2")));
  test("chart 6", () => expect(run(o => chartDemo(o, { choice: "6" }))).toBe(T("chart_demo_6")));
  test("chart 5", () => expect(run(o => chartDemo(o, { choice: "5" }))).toBe(T("chart_demo_5")));
  test("chart bad", () => expect(run(o => chartDemo(o, { choice: "9" }))).toBe(T("chart_demo_bad")));
  test("chart grammar", () => expect(run(o => chartDemo(o, { choice: "2", print_grammar: true }))).toBe(T("chart_demo_grammar")));
  test("rd", () => expect(run(o => recursivedescentDemo(o))).toBe(T("rd_demo")));
  test("sr", () => expect(run(o => shiftreduceDemo(o))).toBe(T("sr_demo")));
  test("earley", () => expect(run(o => earleychartDemo(o))).toBe(T("earley_demo")));
  test("feature", () => expect(run(o => featurechartDemo(o))).toBe(T("feature_demo")));
  test("feature td", () => expect(run(o => featurechartDemo(o, { parser: "FeatureTopDownChartParser" }))).toBe(T("feature_demo_td")));
  test("feature earley (AttributeError)", () => {
    const r = errWrap(() => featurechartDemo(collect().out, { parser: "FeatureEarleyChartParser" }));
    expect(r.err).toBe(errName(E("feature_demo_earley")));
  });
});

describe("pchart/viterbi/generate", () => {
  test("pchart 0", () => expect(run(o => pchartDemo(o, { choice: 0, draw_parses: false, print_parses: true, rng: new PyRandom(42) }))).toBe(T("pchart_demo_0")));
  test("pchart 1", () => expect(run(o => pchartDemo(o, { choice: 1, draw_parses: false, print_parses: true, rng: new PyRandom(7) }))).toBe(T("pchart_demo_1")));
  test("pchart bad", () => expect(run(o => pchartDemo(o, { choice: 9, draw_parses: false, print_parses: false }))).toBe(T("pchart_demo_bad")));
  test("viterbi bad", () => {
    const lines = ["9", "n", "n"]; let i = 0;
    expect(run(o => viterbiDemo(o, { readline: () => lines[i++] ?? "" }))).toBe(T("viterbi_demo_bad"));
  });
  test("viterbi 1 IndexError", () => {
    // Oracle's _Stdin(["1"]) raises IndexError on the second readline call.
    const lines = ["1"]; let i = 0;
    const c = collect(); let err: string | null = null;
    try { viterbiDemo(c.out, { readline: () => lines[i++] ?? null }); }
    catch (e) { err = (e as Error).name; }
    expect(err).toBe("IndexError");
    expect(norm(c.text())).toBe(T("viterbi_demo_1"));
  });
  test("viterbi 2 IndexError", () => {
    const lines = ["2"]; let i = 0;
    const c = collect(); let err: string | null = null;
    try { viterbiDemo(c.out, { readline: () => lines[i++] ?? null }); }
    catch (e) { err = (e as Error).name; }
    expect(err).toBe("IndexError");
    expect(norm(c.text())).toBe(T("viterbi_demo_2"));
  });
  test("generate", () => expect(run(o => generateDemo(o))).toBe(T("generate_demo")));
});

describe("dependency graph demos", () => {
  test("conll", () => expect(run(o => conllDemo(o))).toBe(T("conll_demo")));
  test("conll file", () => expect(run(o => conllFileDemo(o))).toBe(T("conll_file_demo")));
  test("cycle", () => expect(run(o => cycleFindingDemo(o))).toBe(T("cycle_finding_demo")));
  test("dg", () => expect(run(o => dependencygraphDemo(o))).toBe(T("dg_demo")));
});

describe("dependency parser demos", () => {
  test("npp", () => expect(run(o => nppDemo(o))).toBe(T("npp_demo")));
  test("hall", () => expect(run(o => hallDemo(o))).toBe(T("hall_demo")));
  test("npp conll", () => expect(run(o => nonprojectiveConllParseDemo(o))).toBe(T("nonprojective_conll_parse_demo")));
  test("rule based", () => expect(run(o => ruleBasedDemo(o))).toBe(T("rule_based_demo")));
  test("pdp", () => expect(run(o => pdpDemo(o))).toBe(T("pdp_demo")));
  test("pdp rule", () => expect(run(o => projectiveRuleParseDemo(o))).toBe(T("projective_rule_parse_demo")));
  test("arity", () => expect(run(o => arityParseDemo(o))).toBe(T("arity_parse_demo")));
  test("pdp prob", () => expect(run(o => projectiveProbParseDemo(o))).toBe(T("projective_prob_parse_demo")));
});

describe("metrics/sort/cluster", () => {
  test("distance", () => expect(run(o => distanceDemo(o))).toBe(T("distance_demo")));
  test("scores", () => expect(run(o => scoresDemo(o))).toBe(T("scores_demo")));
  test("sort (shape)", () => {
    const got = run(o => sortDemo(o, { rng: new PyRandom(0) }));
    const want = T("sort_demo");
    const shape = (s: string) => s.replace(/=\s*\d+/g, "= N");
    expect(shape(got)).toBe(shape(want));
    for (const m of got.matchAll(/size=\s*(\d+):.*selection=\s*(\d+).*bubble=\s*(\d+).*merge=\s*(\d+).*quick=\s*(\d+)/g)) {
      const n = +m[1]!;
      expect(+m[2]!).toBe(n * (n - 1) / 2); // selection count is data-independent
    }
  });
  test("em", () => expect(run(o => emDemo(o))).toBe(T("em_demo")));
  test("kmeans", () => {
    const got = run(o => kmeansDemo(o, { rng: new PyRandom(0) }));
    const want = T("kmeans_demo");
    // First block (deterministic initial means) must match exactly.
    const cut = (s: string) => s.slice(0, s.indexOf("Clustered: [array([3, 3])"));
    expect(cut(got)).toBe(cut(want));
    // Second block: same line shape, values may differ by RNG.
    const tail = (s: string) => s.slice(s.indexOf("Clustered: [array([3, 3])"));
    const shape = (s: string) => s.replace(/\[[-0-9., eE]+\]/g, "[N]").replace(/array/g, "array");
    expect(shape(tail(got)).replace(/\d+/g, "N")).toBe(shape(tail(want)).replace(/\d+/g, "N"));
  });
});

describe("sem demos", () => {
  // The oracle runs in a fresh python process; z<N> unique-variable numbering
  // reflects a counter that starts at 0. Earlier test files may advance our
  // shared module counter — reset once before this block so demo ordering
  // (and intra-block accumulation, which Python also does) still matches.
  beforeAll(() => resetUniqueVariableCounter());
  test("propdemo", () => expect(run(o => propdemo(o))).toBe(T("propdemo")));
  test("propdemo trace", () => expect(run(o => propdemo(o, 1))).toBe(T("propdemo_trace")));
  test("prodemo AttributeError", () => {
    const r = errWrap(() => prodemoMissing());
    expect(r.err).toBe(errName(E("prodemo_attr")));
  });
  test("folmodel", () => expect(run(o => folmodel(o))).toBe(T("folmodel")));
  test("foldemo", () => expect(run(o => foldemo(o))).toBe(T("foldemo")));
  test("satdemo", () => expect(run(o => satdemo(o))).toBe(T("satdemo")));
  test("evaluate demo", () => expect(run(o => evaluateDemo(o))).toBe(T("evaluate_demo")));
  test("evaluate 3", () => expect(run(o => evaluateDemo(o, 3))).toBe(T("evaluate_demo_3")));
  test("drt", () => expect(run(o => drtDemo(o))).toBe(T("drt_demo")));
  test("linearlogic", () => expect(run(o => linearlogicDemo(o))).toBe(T("linearlogic_demo")));
  test("cooper", () => expect(run(o => cooperDemo(o))).toBe(T("cooper_demo")));
  test("lfg read_depgraph", () => expect(run(o => demoReadDepgraph(o))).toBe(T("lfg_demo_read_depgraph")));
  test("punkt demo", () => expect(run(o => punktDemo(o, "I saw a man. He was tall. Did Mr. Smith go? Yes."))).toBe(T("punkt_demo")));
  test("porter demo", () => expect(run(o => porterDemo(o))).toBe(T("porter_demo")));
  test("tnt demo", () => expect(run(o => tntDemo(o))).toBe(T("tnt_demo")));
  test("tnt demo_errors", () => expect(run(o => tntDemoErrors(o))).toBe(T("tnt_demo_errors")));
  test("chat demos", () => {
    // The oracle swaps in a single io.StringIO("hello\n") for all five demos:
    // eliza consumes "hello"; the rest hit EOF on their first input(">").
    let n = 0;
    const feed = () => (n++ === 0 ? "hello" : null);
    expect(run(o => elizaDemo(o, feed, new PyRandom(0)))).toBe(T("chat_eliza_demo"));
    expect(run(o => ieshaDemo(o, feed, new PyRandom(0)))).toBe(T("chat_iesha_demo"));
    expect(run(o => rudeDemo(o, feed, new PyRandom(0)))).toBe(T("chat_rude_demo"));
    expect(run(o => suntsuDemo(o, feed, new PyRandom(0)))).toBe(T("chat_suntsu_demo"));
    expect(run(o => zenDemo(o, feed, new PyRandom(0)))).toBe(T("chat_zen_demo"));
  });
  test("gaac demo", () => expect(run(o => gaacDemo(o))).toBe(T("gaac_demo")));
  test("wordfinder demo", () => expect(run(o => wordfinderDemo(o, new PyRandom(0)))).toBe(T("word_finder_demo")));
});

describe("util.demo option surface", () => {
  test("default LookupError", () => {
    const r = errWrap(() => semUtilDemo(collect().out, ["DEMO"]));
    expect(r.err).toBe(errName(E("util_demo_default")));
    expect(E("util_demo_default")).toContain("sample_grammars");
  });
  test("-e LookupError", () => {
    const r = errWrap(() => semUtilDemo(collect().out, ["DEMO", "-e"]));
    expect(r.err).toBe(errName(E("util_demo_e")));
  });
  test("-T LookupError", () => {
    const r = errWrap(() => semUtilDemo(collect().out, ["DEMO", "-T"]));
    expect(r.err).toBe(errName(E("util_demo_T")));
  });
  test("-g coverage ValueError", () => {
    const r = errWrap(() => semUtilDemo(collect().out, ["DEMO", "-g", "grammars/book_grammars/storage.fcfg"]));
    expect(r.err).toBe("ValueError");
    expect(r.err && E("util_demo_g")).toContain("Grammar does not cover");
  });
  test("-m SystemExit 2", () => {
    const r = errWrap(() => semUtilDemo(collect().out, ["DEMO", "-m", "mymodel"]));
    expect(r.err).toBe("SystemExit");
  });
  test("--bogus SystemExit 2", () => {
    const r = errWrap(() => semUtilDemo(collect().out, ["DEMO", "--bogus"]));
    expect(r.err).toBe("SystemExit");
    expect(E("util_demo_bogus_opt")).toBeUndefined();
  });
});

describe("chunk demo_eval", () => {
  const text = `    [ the/DT little/JJ cat/NN ] sat/VBD on/IN [ the/DT mat/NN ] ./.
    [ John/NNP ] saw/VBD [the/DT cats/NNS] [the/DT dog/NN] chased/VBD ./.
    [ John/NNP ] thinks/VBZ [ Mary/NN ] saw/VBD [ the/DT cat/NN ] sit/VB on/IN [ the/DT mat/NN ]./.
    `;
  const grammar = `
    NP:                   # NP stage
      {<DT>?<JJ>*<NN>}    # chunk determiners, adjectives and nouns
      {<NNP>+}            # chunk proper nouns
    `;
  test("demo_eval", () => {
    const cp = new RegexpParser(grammar);
    expect(run(o => demoEval(o, cp, text))).toBe(T("demo_eval"));
  });
});

describe("chat/twitter", () => {
  test("chatbots bots list", () => {
    const names = bots.map(([f, d]) => [f.name, d]);
    expect(names).toEqual(O.out.chatbots_bots.ret);
  });
  test("basic handler", () => {
    const bh = new BasicTweetHandler();
    const vals: Record<string, unknown> = {
      limit: bh.limit, counter: bh.counter, do_stop: bh.do_stop,
      max_id: bh.max_id, do_continue_0: bh.do_continue(),
    };
    bh.counter = 20;
    vals.do_continue_20 = bh.do_continue();
    bh.counter = 5; bh.do_stop = true;
    vals.do_continue_stop = bh.do_continue();
    expect(vals).toEqual(O.out.basic_handler.ret);
  });
  test("TweetHandlerI abstract TypeError", () => {
    try {
      new (TweetHandlerI as any)({ limit: 3 });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as Error).name).toBe("TypeError");
      expect((e as Error).message).toContain("abstract");
    }
  });
  test("tweet handler i", () => {
    class TH extends (TweetHandlerI as any) {
      constructor(o: any) { super(o); }
      handle() {} on_finish() {}
    }
    const c = collect();
    const th = new TH({ limit: 3, upper_date_limit: [2015, 4, 2], lower_date_limit: [2015, 4, 1] });
    th.check_date_limit({ created_at: "Wed Apr 01 12:00:00 +0000 2015" }, true, c.out);
    const inRange = th.do_stop;
    const th2 = new TH({ limit: 3, upper_date_limit: [2015, 4, 2] });
    th2.check_date_limit({ created_at: "Wed Apr 03 12:00:00 +0000 2015" }, true, c.out);
    expect({ stdout: c.text(), inRange, after: th2.do_stop }).toEqual({
      stdout: O.out.tweet_handler_i.ret.stdout,
      inRange: O.out.tweet_handler_i.ret.in_range_stop,
      after: O.out.tweet_handler_i.ret.after_upper_stop,
    });
  });
  test("local tz", () => {
    expect({
      stdoffset: String(LocalTimezoneOffsetWithUTC.STDOFFSET),
      dstoffset: String(LocalTimezoneOffsetWithUTC.DSTOFFSET),
      utcoffset: String(LOCAL.utcoffset(null)),
    }).toEqual(O.out.local_tz.ret);
  });
  test("outf plain/gzip", () => {
    const tmp = mkdtempSync(join(tmpdir(), "nltk"));
    const p1 = join(tmp, "o.csv");
    const [w1, f1] = outfWriterCompat(p1, "utf8", "replace");
    w1.writerow(["a", "b c", 1, null]);
    f1.close();
    expect(readFileSync(p1).toString()).toBe(O.out.outf_plain.ret);
    const p2 = join(tmp, "o.csv.gz");
    const [w2, f2] = outfWriterCompat(p2, "utf8", "replace", { gzip_compress: true });
    w2.writerow(["x", 'y"z']);
    f2.close();
    // Oracle reads via gzip.open(..., "rt") — universal newlines -> \n.
    expect(gunzipSync(readFileSync(p2)).toString().replace(/\r\n/g, "\n")).toBe(O.out.outf_gzip.ret);
  });
});

describe("malt/jar/port helpers", () => {
  test("malt regex tagger", () => {
    const tagger = maltRegexTagger();
    expect(tagger("the cats 123 , . saw".split(" "))).toEqual(O.out.malt_regex_tagger.ret);
  });
  test("find_maltparser abs missing", () => {
    try { findMaltparser("/nonexistent-xyz"); expect.unreachable(); }
    catch (e) { expect((e as Error).name).toBe(errName(E("find_maltparser_abs_missing"))); }
  });
  test("find_maltparser rel", () => {
    try { findMaltparser("maltparser-1.9.2"); expect.unreachable(); }
    catch (e) { expect((e as Error).name).toBe(errName(E("find_maltparser_rel"))); }
  });
  test("find_malt_model none", () => expect(findMaltModel(null)).toBe(O.out.find_malt_model_none.ret));
  test("find_malt_model missing", () => {
    try { findMaltModel("nonexistent-xyz.mco"); expect.unreachable(); }
    catch (e) { expect((e as Error).name).toBe(errName(E("find_malt_model_missing"))); }
  });
  test("find_jars_within_path missing", () => {
    // os.walk on a missing dir yields nothing — no error in the oracle.
    expect(findJarsWithinPath("/nonexistent-xyz")).toEqual([]);
  });
  test("find_jar missing", () => {
    try { findJar("nonexistent-xyz.jar", { envVars: ["NONEXISTENT_XYZ"], searchpath: ["/nonexistent-dir-xyz"], url: "http://x" }); expect.unreachable(); }
    catch (e) { expect((e as Error).name).toBe(errName(E("find_jar_missing"))); }
  });
  test("find_jar_iter classpath missing", () => {
    try { void [...findJarIter("nltk-test.jar")]; expect.unreachable(); }
    catch (e) { expect((e as Error).name).toBe(errName(E("find_jar_iter_classpath"))); }
  });
  test("try_port", async () => {
    const p = await tryPort();
    expect(typeof p).toBe("number");
    expect(p).toBeGreaterThan(0);
  });
  test("try_port occupied", async () => {
    const { createServer } = await import("node:net");
    const srv = createServer();
    await new Promise<void>((res) => srv.listen(0, "localhost", res));
    const port = (srv.address() as { port: number }).port;
    try {
      await tryPort(port);
      expect.unreachable("occupied port should throw");
    } catch (e) {
      expect((e as NodeJS.ErrnoException).code === "EADDRINUSE" || (e as Error).name === "OSError").toBeTruthy();
    } finally { srv.close(); }
  });
  test("stanford find_jar missing", () => {
    try { stanfordFindJar("nonexistent-xyz.jar", { envVars: ["NONEXISTENT_XYZ"], searchpath: ["/nonexistent-dir-xyz"] }); expect.unreachable(); }
    catch (e) { expect((e as Error).name).toBe("LookupError"); }
  });
});

// ---------- nltk.tbl.demo ----------
// Oracle resets Template.ALLTEMPLATES before each key (python's registry
// accumulates process-wide); mirror with clearTemplateRegistry().

function tblRun(f: (out: (s: string) => void) => void): string {
  clearTemplateRegistry();
  return run(f);
}
function tblErr(f: () => void): { text: string; err: string | null } {
  clearTemplateRegistry();
  return errWrap(f);
}

describe("nltk.tbl.demo", () => {
  test("demo", () => expect(tblRun((o) => tblDemo(o))).toBe(T("tbl_demo")));
  test("repr ruleformat", () => expect(tblRun((o) => demoReprRuleFormat(o))).toBe(T("tbl_demo_repr")));
  test("str ruleformat", () => expect(tblRun((o) => demoStrRuleFormat(o))).toBe(T("tbl_demo_str")));
  test("verbose ruleformat", () => expect(tblRun((o) => demoVerboseRuleFormat(o))).toBe(T("tbl_demo_verbose")));
  test("multiposition", () => expect(tblRun((o) => demoMultipositionFeature(o))).toBe(T("tbl_demo_multipos")));
  test("multifeature", () => expect(tblRun((o) => demoMultifeatureTemplate(o))).toBe(T("tbl_demo_multifeat")));
  test("template statistics (upstream TypeError)", () => {
    const c = collect();
    const r = tblErr(() => demoTemplateStatistics(c.out));
    expect(norm(c.text())).toBe(T("tbl_demo_template_stats"));
    expect(r.err).toBe(errName(E("tbl_demo_template_stats")));
  });
  test("generated templates (upstream TypeError)", () => {
    const c = collect();
    const r = tblErr(() => demoGeneratedTemplates(c.out));
    expect(norm(c.text())).toBe(T("tbl_demo_generated"));
    expect(r.err).toBe(errName(E("tbl_demo_generated")));
  });
  test("high accuracy rules", () => expect(tblRun((o) => demoHighAccuracyRules(o))).toBe(T("tbl_demo_high_accuracy")));
  test("learning curve (ModuleNotFoundError)", () => {
    const c = collect();
    const r = tblErr(() => demoLearningCurve(c.out));
    expect(norm(c.text())).toBe(T("tbl_demo_learning_curve"));
    expect(r.err).toBe(errName(E("tbl_demo_learning_curve")));
  });
  test("error analysis (upstream TypeError + header file)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tblerr-"));
    const cwd = process.cwd();
    let r: { text: string; err: string | null };
    let fileText: string | null = null;
    try {
      process.chdir(dir);
      const c = collect();
      clearTemplateRegistry();
      try { demoErrorAnalysis(c.out); r = { text: c.text(), err: null }; }
      catch (e) { r = { text: c.text(), err: e instanceof Error ? e.name : "Error" }; }
      try { fileText = readFileSync("errors.txt", "utf8"); } catch { fileText = null; }
    } finally {
      process.chdir(cwd);
    }
    expect(norm(r!.text)).toBe(T("tbl_demo_error_analysis"));
    expect(r!.err).toBe(errName(E("tbl_demo_error_analysis")));
    expect(fileText).toBe(O.out.tbl_demo_error_analysis?.files?.["errors.txt"] ?? null);
  });
  test("serialize tagger (pickle gap: identical stdout prefix)", () => {
    const c = collect();
    const r = tblErr(() => demoSerializeTagger(c.out));
    // Python's pickle.dump succeeds (file + "Wrote/Reloaded" lines) then
    // crashes inside pickle_load — unreachable without CPython pickle. Our
    // stdout is a strict prefix of the oracle's.
    expect(r.err).toBe("TypeError");
    const py = T("tbl_demo_serialize");
    const ours = norm(c.text());
    expect(py.startsWith(ours)).toBe(true);
    expect(py.slice(ours.length)).toBe(
      "Wrote pickled tagger to tagger.pcl\nReloaded pickled tagger from tagger.pcl\n",
    );
  });
});

describe("nltk.tag.hmm demos vs NLTK 3.10.3", () => {
  test("demo (market HMM probability)", () => {
    const c = collect();
    hmmDemo(c.out);
    expect(c.text()).toBe(T("hmm_demo"));
  });
  test("demo_pos (brown supervised)", { timeout: 120_000 }, () => {
    const c = collect();
    demo_pos(c.out);
    // `Entropy:` lines carry ulp-level float noise: python itself varies by
    // ~1e-12 across hash seeds because load_pos builds tag_set/symbols via
    // list(set). Everything else must match byte-for-byte.
    const normEnt = (s: string) => s.replace(/Entropy: -?[\d.eE+]+/g, "Entropy: F");
    const ents = (s: string) => [...s.matchAll(/Entropy: (-?[\d.eE+]+)/g)].map((m) => Number(m[1]));
    const py = T("hmm_demo_pos");
    const ours = c.text();
    expect(normEnt(ours)).toBe(normEnt(py));
    const [pe, oe] = [ents(py), ents(ours)];
    expect(oe.length).toBe(pe.length);
    pe.forEach((v, i) => expect(Math.abs(oe[i]! - v)).toBeLessThan(1e-9));
  });
  test("demo_bw (Baum-Welch EM on market samples)", { timeout: 120_000 }, () => {
    const c = collect();
    demo_bw(c.out);
    // `iteration i logprob F` floats carry ulp noise (numpy vectorized
    // np.power vs scalar 2** inside np.logaddexp2/logsumexp2) — everything
    // else, including EM convergence at iteration 203, byte-for-byte.
    const normLp = (s: string) => s.replace(/(iteration \d+ logprob) -?[\d.eE+nan]+/g, "$1 F");
    const lps = (s: string) => [...s.matchAll(/iteration (\d+) logprob (-?[\d.eE+nan]+)/g)]
      .map((m) => [Number(m[1]), Number(m[2])] as const);
    const py = T("hmm_demo_bw");
    const ours = c.text();
    expect(normLp(ours)).toBe(normLp(py));
    const [pe, oe] = [lps(py), lps(ours)];
    expect(oe.length).toBe(pe.length);
    pe.forEach(([it, v], i) => {
      expect(oe[i]![0]).toBe(it);
      expect(Math.abs(oe[i]![1] - v)).toBeLessThan(1e-9);
    });
  });
  test("demo_pos_bw (supervised + Baum-Welch on brown)", { timeout: 300_000 }, () => {
    const c = collect();
    demo_pos_bw(10, 20, 10, true, 5, c.out);
    // After `Training (unsupervised` the model degenerates (entropy -> nan);
    // the post-BW argmax over nan-poisoned rows is hash-order-dependent —
    // python itself scores 3.17/3.87/3.52 across hash seeds. Pin: everything
    // before the marker byte-exact modulo float epsilons; after it, tag
    // assignments + the final accuracy are normalized structurally.
    const norm = (s: string) => {
      const idx = s.indexOf("Training (unsupervised");
      const det = s.slice(0, idx)
        .replace(/Entropy: -?[\w.]+/g, "Entropy: E");
      const nondet = s.slice(idx)
        .replace(/Entropy: -?[\w.]+/g, "Entropy: E")
        .replace(/(iteration \d+ logprob) -?[\d.eE+nan]+/g, "$1 F")
        .replace(/(accuracy over \d+ tokens:) [\d.]+/g, "$1 F")
        .split("\n")
        .map((l) => l.startsWith("HMM-tagged:") ? l.replace(/\/[^ \n]+/g, "/T") : l)
        .join("\n");
      return det + nondet;
    };
    const floats = (s: string, re: RegExp) => [...s.matchAll(re)].map((m) => Number(m[1]));
    const py = T("hmm_demo_pos_bw");
    const ours = c.text();
    expect(norm(ours)).toBe(norm(py));
    // Epsilon-compare the deterministic-half floats (entropy + logprob).
    const entRe = /Entropy: (-?[\w.]+)/g;
    const lpRe = /iteration \d+ logprob (-?[\d.eE+nan]+)/g;
    const detPart = (s: string) => s.slice(0, s.indexOf("Training (unsupervised"));
    const [pe, oe] = [floats(detPart(py), entRe), floats(detPart(ours), entRe)];
    expect(oe.length).toBe(pe.length);
    pe.forEach((v, i) => expect(Math.abs(oe[i]! - v)).toBeLessThan(1e-9));
    const [pl, ol] = [floats(py, lpRe), floats(ours, lpRe)];
    expect(ol.length).toBe(pl.length);
    pl.forEach((v, i) => expect(Math.abs(ol[i]! - v)).toBeLessThan(1e-9));
  });
});

describe("nltk.toolbox.demo vs NLTK 3.10.3", () => {
  test("toolbox.demo crashes upstream: PathPointer.open(None) yields bytes", () => {
    const r = errWrap(() => toolboxDemo());
    expect(r.err).toBe(errName(E("toolbox_demo")));
    expect(E("toolbox_demo")).toContain("bytes-like object");
  });
});

describe("nltk.stem.snowball.demo vs NLTK 3.10.3", () => {
  test("snowball.demo bogus+english+exit (byte-exact)", () => {
    const inputs = ["bogus", "english", "exit"];
    const c = collect();
    snowballDemo(() => inputs.shift() ?? null, c.out);
    expect(c.text()).toBe(T("snowball_demo_en"));
  });
  test("snowball.demo french+exit (byte-exact)", () => {
    const inputs = ["french", "exit"];
    const c = collect();
    snowballDemo(() => inputs.shift() ?? null, c.out);
    expect(c.text()).toBe(T("snowball_demo_fr"));
  });
});

describe("nltk.chunk.regexp.demo vs NLTK 3.10.3", () => {
  test("demo output byte-exact except hash-ordered missed/incorrect chunks", () => {
    const c = collect();
    chunkRegexpDemo(c.out);
    // python ChunkScore stores ((count,pos), frozen_tree) pairs in a set —
    // missed()/incorrect() iterate in hash order (varies per process).
    const CHUNK_LINE = /^   \(/;
    const strip = (t: string) => t.split("\n").filter((l) => !CHUNK_LINE.test(l)).join("\n");
    const sortedChunks = (t: string) => t.split("\n").filter((l) => CHUNK_LINE.test(l)).sort();
    expect(strip(c.text())).toBe(strip(T("chunk_regexp_demo")));
    expect(sortedChunks(c.text())).toEqual(sortedChunks(T("chunk_regexp_demo")));
  });
});

describe("nltk.parse.transitionparser.demo vs NLTK 3.10.3", () => {
  test("demo() is a no-op like python (doctest holder)", () => {
    const c = collect();
    transitionparserDemo();
    expect(c.text()).toBe(T("transitionparser_demo"));
    expect(T("transitionparser_demo")).toBe("");
  });
});
