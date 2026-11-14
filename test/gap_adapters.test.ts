// Differential test: external-tool gap adapters vs pinned NLTK 3.10.3 oracle.
//   src/ext_subprocess.ts <-> test/gap_adapters_oracle.py
// Uses identical fake POSIX tools + a localhost mock HTTP server on both sides.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as X from "../src/ext_subprocess";
import { DependencyGraph } from "../src/dependency_graph";
import {
  BinaryMaxentFeatureEncoding,
} from "../src/maxent_feature_encoding";
import {
  TadmEventMaxentFeatureEncoding,
  parse_megam_weights,
  parse_tadm_weights,
  write_megam_file,
  write_tadm_file,
} from "../src/maxent_nltk";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");

function oracle(): Record<string, unknown> {
  const res = spawnSync("python3", ["test/gap_adapters_oracle.py"], {
    encoding: "utf-8",
    env: { ...process.env, NLTK_DATA },
    timeout: 120_000,
  });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

// Hold 127.0.0.1:9000 for the whole pin-collection phase so try_port(9000)
// deterministically fails on BOTH sides. Without this, leftover TIME_WAIT
// sockets from a previous run's servers let Bun bind 9000 (SO_REUSEADDR)
// while Python's plain bind fails — the two sides then take different
// branches (Python only appends "-port" to corenlp_options on fallback).
const hold9000 = (() => {
  try {
    return Bun.listen({ hostname: "localhost", port: 9000, socket: { data() {} } });
  } catch {
    return null; // already held by something else — same effect
  }
})();

const O = oracle();

// ---- fixture mirroring oracle FIX layout ----
const FIX = mkdtempSync(join(tmpdir(), "gapadapters-"));
const NDATA = join(FIX, "nltkdata");
mkdirSync(NDATA, { recursive: true });
// The oracle's data_path[0] is its own fixture dir; the remaining entries are
// host-stable nltk_data dirs. Mirror verbatim (venv paths exist on this host).
const pyDataPath = (O.data_path as string[]).map((p) => p.replace("<T>", FIX));
X.setJarSandboxDataPath(pyDataPath);

function rel(s: unknown): unknown {
  if (typeof s !== "string") return s;
  let out = s.split(FIX).join("<T>");
  out = out.replace(
    /(?<![\w.])(tmp|nltk-|boxer-|malt_input\.conll\.|malt_output\.conll\.|malt_train\.conll\.)[a-z0-9_]+/g,
    "$1<F>",
  );
  out = out.replace(/nltk-<F>-(events|weights)-[a-z0-9_]+/g, "nltk-<F>-$1-<F>");
  out = out.replace(/0x[0-9a-fA-F]+/g, "0x<F>");
  return out;
}

/** Normalize CoreNLP ports — try_port() yields 9000 when free, else an
 * ephemeral fallback (e.g. when a prior server left 9000 in TIME_WAIT). */
function pnorm(v: unknown): unknown {
  if (typeof v === "string") return v.replace(/localhost:\d+/, "localhost:<P>");
  if (Array.isArray(v)) {
    return v.map((x, i) =>
      i > 0 && v[i - 1] === "-port" && typeof x === "string" && /^\d+$/.test(x)
        ? "<P>"
        : pnorm(x),
    );
  }
  if (v !== null && typeof v === "object" && !(v instanceof Uint8Array)) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pnorm(x)]));
  }
  return v;
}

function norm(x: unknown): unknown {
  if (x === null || x === undefined) return null;
  if (Array.isArray(x)) return x.map(norm);
  if (x instanceof Uint8Array) {
    return { b: `'${rel(new TextDecoder().decode(x))}'` };
  }
  if (typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) o[k] = norm(v);
    return o;
  }
  return rel(x);
}

function errWrap<T>(f: () => T): { err: string | null; val: T | null } {
  try {
    return { err: null, val: norm(f()) as T };
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    return { err: `${name}:${(rel(msg) as string).slice(0, 400)}`, val: null };
  }
}
async function errWrapA<T>(f: () => Promise<T>): Promise<{ err: string | null; val: T | null }> {
  try {
    return { err: null, val: norm(await f()) as T };
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    return { err: `${name}:${(rel(msg) as string).slice(0, 400)}`, val: null };
  }
}

function envctx<T>(patch: Record<string, string | undefined>, f: () => T): T {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) old[k] = process.env[k];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return f();
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
async function envctxA<T>(
  patch: Record<string, string | undefined>,
  f: () => Promise<T>,
): Promise<T> {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) old[k] = process.env[k];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await f();
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function mkdirF(...parts: string[]): string {
  const d = join(FIX, ...parts);
  mkdirSync(d, { recursive: true });
  return d;
}
function touch(p: string, data = ""): string {
  writeFileSync(p, data);
  return p;
}
function tool(name: string, body: string, dir?: string): string {
  const d = dir ?? mkdirF("bin-" + name);
  const p = join(d, name);
  writeFileSync(p, body);
  chmodSync(p, 0o755);
  return p;
}
function chdir<T>(d: string, f: () => T): T {
  const old = process.cwd();
  process.chdir(d);
  try {
    return f();
  } finally {
    process.chdir(old);
  }
}
function captured<T>(f: () => T): { printed: string; val?: unknown; err?: string } {
  const orig = console.log;
  let buf = "";
  console.log = (...a: unknown[]) => {
    buf += a.map((x) => (x === undefined ? "" : String(x))).join(" ") + "\n";
  };
  try {
    const v = f();
    return { printed: rel(buf) as string, val: norm(v) };
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    return { printed: rel(buf) as string, err: `${name}:${(rel(msg) as string).slice(0, 400)}` };
  } finally {
    console.log = orig;
  }
}
function readArgv(p: string): string[] | null {
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, "utf8").split("\n").filter((l) => l.length > 0).map((l) => rel(l) as string);
  const i = lines.indexOf("-cp");
  if (i >= 0 && lines[i + 1]) lines[i + 1] = lines[i + 1]!.split(":").sort().join(":");
  return lines;
}

// ---- fake tools (identical bodies to oracle) ----
const FAKE_JAVA = tool("java", `#!/bin/sh
printf '%s\\n' "$@" > "\${FAKE_JAVA_ARGV:-/dev/null}"
prev=
for a in "$@"; do
  if [ "$prev" = "-o" ]; then
    printf '1\\tJohn\\t_\\tNNP\\t_\\t_\\t2\\tsubj\\t_\\t_\\n2\\tsees\\t_\\tVBZ\\t_\\t_\\t0\\tROOT\\t_\\t_\\n\\n' > "$a"
  fi
  prev="$a"
done
if [ "$1" = "-sleep" ]; then exec sleep 30; fi
case " $* " in *StanfordCoreNLPServer*) exec sleep 30;; esac
printf 'fake-out\\n'
printf 'fake-err\\n' >&2
exit "\${FAKE_JAVA_RC:-0}"
`);

const _FAKE_HUNPOS = tool("hunpos-tag", `#!/bin/sh
while IFS= read -r line; do
  printf '%s\\tTAGGED\\n' "$line"
done
`);

const FAKE_SENNA_BODY = `#!/bin/sh
pos=; chk=; ner=
for a in "$@"; do case "$a" in -pos) pos=y;; -chk) chk=y;; -ner) ner=y;; esac; done
i=0
while IFS= read -r line; do
  for w in $line; do
    i=$((i+1))
    out="$w"
    [ -n "$pos" ] && out="$out\\tPOS$i"
    if [ -n "$chk" ]; then
      t="O"; [ "$i" = 1 ] && t="B-NP"; [ "$i" = 2 ] && t="I-NP"
      out="$out\\t$t"
    fi
    if [ -n "$ner" ]; then
      t="O"; [ "$i" = 1 ] && t="B-PER"
      out="$out\\t$t"
    fi
    printf '%b\\n' "$out"
  done
  printf '\\n'
done
`;

const FAKE_CANDC_BODY = `#!/bin/sh
/bin/cat > /dev/null
printf 'canned-candc\\n'
`;
const FAKE_BOXER_BODY = `#!/bin/sh
printf "id('0',1).\\nsem(1,[x1],drs([[1001,1002]:x1, [1003]:e2], [[1001,1002]:pred(x1, dog, n, 0), [1003]:rel(e2, x1, agent, 0)])).\\n"
`;

const _FAKE_DOT = tool("dot", `#!/bin/sh
/bin/cat > /dev/null
printf '<svg>fake</svg>\\n'
`);

const FAKE_MEGAM = tool("megam", `#!/bin/sh
printf '%s\\n' "$@" > "\${FAKE_MEGAM_ARGV:-/dev/null}"
printf '0 0.5\\n1 -0.5\\n'
exit "\${FAKE_MEGAM_RC:-0}"
`);

const FAKE_TADM = tool("tadm", `#!/bin/sh
printf '%s\\n' "$@" > "\${FAKE_TADM_ARGV:-/dev/null}"
prev=
for a in "$@"; do
  if [ "$prev" = "-params_out" ]; then printf '0.1\\n0.2\\n0.3\\n-0.1\\n-0.2\\n-0.3\\n' > "$a"; fi
  prev="$a"
done
`);

const FAKE_MEGAM_ARGV = join(FIX, "megam.argv");
const FAKE_TADM_ARGV = join(FIX, "tadm.argv");
const FAKE_JAVA_ARGV = join(FIX, "java.argv");

const got: Record<string, unknown> = {};

// ---------------- finders ----------------
got.find_binary_java = errWrap(() => X.findBinary("java"));
got.find_binary_java_name = errWrap(() => X.findBinary("java", { binary_names: ["java", "java.exe"] }));
envctx({ PATH: "/nonexistent" }, () => {
  got.find_binary_deadpath = errWrap(() => X.findBinary("java"));
});
got.find_binary_patharg = errWrap(() => X.findBinary("java", { path_to_bin: "/nonexistent/java" }));
got.find_file_missing = errWrap(() => X.findFile("never-here-xyz.txt"));
envctx({ MALT_PARSER: "/nonexistent-env-dir" }, () => {
  got.find_dir_env_unchecked = errWrap(() => X.findDir("x", { env_vars: ["MALT_PARSER"] }));
});

const cwdDir = mkdirF("cwd-quirk");
touch(join(cwdDir, "java"));
chdir(cwdDir, () => {
  got.find_binary_cwd_quirk = errWrap(() => X.findBinary("java"));
});

const toolDir = mkdirF("tooldir");
touch(join(toolDir, "mytool"));
chmodSync(join(toolDir, "mytool"), 0o755);
envctx({ FAKE_TOOL: toolDir }, () => {
  got.find_binary_env_dir = errWrap(() => X.findBinary("mytool", { env_vars: ["FAKE_TOOL"] }));
});
envctx({ FAKE_TOOL: join(toolDir, "mytool") }, () => {
  got.find_binary_env_file = errWrap(() =>
    X.findBinary("x", { binary_names: ["mytool"], env_vars: ["FAKE_TOOL"] }),
  );
});

// ---------------- find_jar ----------------
got.find_jar_missing = errWrap(() => X.findJar("stanford-postagger.jar"));
got.find_jar_patharg = errWrap(() => X.findJar("x.jar", { path_to_jar: "/nonexistent/x.jar" }));

const jardir = mkdirF("jars");
for (const j of ["a.jar", "b.jar", "c.jar"]) touch(join(jardir, j));
touch(join(jardir, "notajar.txt"));
envctx({ CLASSPATH: jardir }, () => {
  got.find_jar_classpath_dir = errWrap(() => X.findJar("a.jar"));
});
envctx({ CLASSPATH: join(jardir, "b.jar") }, () => {
  got.find_jar_classpath_file = errWrap(() => X.findJar("b.jar"));
});
envctx({ MYJARS: jardir }, () => {
  got.find_jar_env_dir = errWrap(() => X.findJar("c.jar", { env_vars: ["MYJARS"] }));
});
envctx({ MYJARS: join(jardir, "a.jar") }, () => {
  got.find_jar_env_file = errWrap(() => X.findJar("a.jar", { env_vars: ["MYJARS"] }));
});
got.find_jar_regex_quirk = errWrap(() =>
  [...X.findJarIter("\\.jar$", { searchpath: [jardir], env_vars: [], is_regex: true, verbose: false })].sort(),
);
got.find_jar_searchpath = errWrap(() => [
  ...X.findJarIter("a.jar", { searchpath: [jardir], env_vars: [], verbose: false }),
]);
const nested = mkdirF("nested", "inner");
touch(join(nested, "n1.jar"));
touch(join(nested, "notjar.txt"));
got.find_jars_within_path = errWrap(() => [...X.findJarsWithinPath(join(FIX, "nested"))]);

// ---------------- java machinery ----------------
got.java_str_cmd = errWrap(() => X.java("java" as unknown as string[]));
got.java_empty_cp = errWrap(() => X.java(["X"], { classpath: "" }));
got.java_rel_cp = errWrap(() => X.java(["X"], { classpath: "rel.jar" }));
got.java_untrusted_cp = errWrap(() => X.java(["X"], { classpath: "/outside-xyz/x.jar" }));
const trustedJar = touch(join(NDATA, "tj.jar"));
got.java_trusted_cp = errWrap(() => X.java(["-version"], { classpath: trustedJar }));

const optsCases: Record<string, unknown[]> = {
  int: [123],
  atfile: ["@argfile"],
  metachar: ["-Xmx512m ; rm -rf /"],
  onerror: ["-XX:OnError=foo"],
  dprop: ["-Dfoo=bar"],
  javaagent: ["-javaagent:x.jar"],
  modules_noval: ["--add-modules"],
  modules_ok: ["--add-modules=java.se"],
  modules_badval: ["--add-modules", "bad mod"],
  valid: ["-mx2g", "-Xmx512m", "-server", "-verbose:gc", "-ms64m", "-ss2m", "-client"],
  ea: ["-ea"],
};
for (const [k, o] of Object.entries(optsCases)) {
  got[`java_opts_${k}`] = errWrap(() => X.java(["-version"], { options: o as string[] }));
}

got.java_missing = errWrap(() => X.java(["-version"], { stdout: "pipe", stderr: "pipe" }));
got.config_java_missing = errWrap(() => X.configJava());
got.config_java_path = errWrap(() => X.configJava({ bin: "/nonexistent/java" }));
got.stale_java_bin = X._javaState.bin === null ? "None" : String(X._javaState.bin);

envctx({ JAVAHOME: undefined, JAVA_HOME: undefined }, () => {
  X.configJava({ bin: FAKE_JAVA, verbose: false });
  got.java_fake_stdio = errWrap(() => X.java(["-version"], { stdout: "pipe", stderr: "pipe" }));
  envctx({ FAKE_JAVA_RC: "3" }, () => {
    got.java_fake_fail = errWrap(() => X.java(["-version"], { stdout: "pipe", stderr: "pipe" }));
  });
  const jars = [touch(join(NDATA, "j1.jar")), touch(join(NDATA, "j2.jar"))];
  envctx({ FAKE_JAVA_ARGV }, () => {
    X.java(["Main"], { classpath: jars, stdout: "pipe", stderr: "pipe" });
  });
  got.java_cp_argv = readArgv(FAKE_JAVA_ARGV);
  got.java_trusted_opts = errWrap(() =>
    X.java(["-version"], { stdout: "pipe", stderr: "pipe", trusted_raw_options: ["-Dsecret=1"] }),
  );
});
{
  const popen = X.java(["-sleep", "x"], { blocking: false });
  const rec: Record<string, unknown> = {
    pid_is_int: Number.isInteger(popen.pid),
    poll: null,
  };
  rec.poll = popen.poll();
  popen.terminate();
  got.java_blocking_false_promise = popen.wait().then((w) => ({ ...rec, wait: w }));
}
X._javaState.bin = null;

// ---------------- stanford ----------------
envctx(
  {
    STANFORD_MODELS: undefined,
    STANFORD_PARSER: undefined,
    STANFORD_TAGGER: undefined,
    CLASSPATH: undefined,
  },
  () => {
    {
      const n = X.emittedWarnings.length;
      const r = errWrap(() => new X.StanfordPOSTagger("model.tagger"));
      (r as Record<string, unknown>).warnings = X.emittedWarnings.slice(n).map((w) => w.message);
      got.stanford_pos_ctor = r;
    }
    {
      const n = X.emittedWarnings.length;
      const r = errWrap(() => new X.StanfordNERTagger("model.ser.gz"));
      (r as Record<string, unknown>).warnings = X.emittedWarnings.slice(n).map((w) => w.message);
      got.stanford_ner_ctor = r;
    }
    got.stanford_base_abstract = errWrap(() => new X.StanfordTagger("model"));
  },
);

const jardir2 = mkdirF("stanford");
const posjar = touch(join(jardir2, "stanford-postagger.jar"));
envctx({ STANFORD_MODELS: undefined }, () => {
  got.stanford_pos_model_missing = errWrap(
    () => new X.StanfordPOSTagger("model.tagger", { path_to_jar: posjar }),
  );
});

const modeldir = mkdirF("stmodels");
const model = touch(join(modeldir, "model.tagger"));
const tjar = touch(join(NDATA, "stanford-postagger.jar"));
envctx({ STANFORD_MODELS: modeldir, CLASSPATH: undefined }, () => {
  X.configJava({ bin: FAKE_JAVA, verbose: false });
  const n = X.emittedWarnings.length;
  const r = errWrap(() =>
    new X.StanfordPOSTagger("model.tagger", { path_to_jar: tjar }).tag_sents([["a", "b"]]),
  );
  (r as Record<string, unknown>).warnings = X.emittedWarnings.slice(n).map((w) => w.message);
  got.stanford_pos_tag_sents = r;
  X._javaState.bin = null;
});

{
  const inst = Object.create(X.StanfordPOSTagger.prototype) as X.StanfordPOSTagger;
  inst._stanford_model = model;
  inst._input_file_path = "/in.txt";
  got.stanford_pos_cmd = inst._cmd.map((s) => rel(s) as string);
  const inst2 = Object.create(X.StanfordNERTagger.prototype) as X.StanfordNERTagger;
  inst2._stanford_model = model;
  inst2._input_file_path = "/in.txt";
  got.stanford_ner_cmd = inst2._cmd.map((s) => rel(s) as string);
  got.stanford_pos_separator = (X.StanfordPOSTagger as unknown as { _SEPARATOR: string })._SEPARATOR;
  got.stanford_ner_separator = (X.StanfordNERTagger as unknown as { _SEPARATOR: string })._SEPARATOR;
  got.stanford_jar_pat = (X.StanfordPOSTagger as unknown as { _JAR: string })._JAR;
  got.stanford_ner_jar_pat = (X.StanfordNERTagger as unknown as { _JAR: string })._JAR;
  got.stanford_parse_output_pos = Object.create(X.StanfordPOSTagger.prototype).parseOutput(
    "a_TAG1 b_TAG2\nc_TAG3\n",
    [["a", "b"], ["c"]],
  );
  got.stanford_parse_output_ner = Object.create(X.StanfordNERTagger.prototype).parseOutput(
    "a/X1 b/O\nc/X2\n",
    [["a", "b"], ["c"]],
  );
}

// ---------------- hunpos ----------------
envctx({ HUNPOS_TAGGER: undefined }, () => {
  got.hunpos_ctor = errWrap(() => new X.HunposTagger("model"));
  got.hunpos_ctor_patharg = errWrap(
    () => new X.HunposTagger("model", { path_to_bin: "/nonexistent/hunpos-tag" }),
  );
});
touch(join(join(FIX, "bin-hunpos-tag"), "hpmodel"));
let hunposTagger: X.HunposTagger | null = null;
envctx({ HUNPOS_TAGGER: join(FIX, "bin-hunpos-tag") }, () => {
  const r = errWrap(() => new X.HunposTagger("hpmodel"));
  got.hunpos_ctor_ok = r;
  if (r.err === null) {
    hunposTagger = new X.HunposTagger("hpmodel");
    (r as Record<string, unknown>).val = "<nltk.tag.hunpos.HunposTagger object at 0x<F>>";
  }
});
envctx({ HUNPOS_TAGGER: join(FIX, "bin-hunpos-tag") }, () => {
  got.hunpos_model_missing = errWrap(() => new X.HunposTagger("nope"));
});

// ---------------- senna ----------------
const sennaDir = mkdirF("senna");
const sennaExe = join(sennaDir, "senna-linux64");
writeFileSync(sennaExe, FAKE_SENNA_BODY);
chmodSync(sennaExe, 0o755);

envctx({ SENNA: undefined }, () => {
  got.senna_ctor_absent = errWrap(() => new X.Senna("/nonexistent-abs", ["pos"]));
  got.senna_ctor_relative = errWrap(() => new X.Senna("relative-path", ["pos"]));
});
envctx({ SENNA: "relative-env" }, () => {
  got.senna_ctor_env_relative = errWrap(() => new X.Senna(null, ["pos"]));
});
const emptySennaDir = mkdirF("senna-empty");
envctx({ SENNA: undefined }, () => {
  got.senna_ctor_nobin = errWrap(() => new X.Senna(emptySennaDir, ["pos"]));
});
envctx({ SENNA: undefined }, () => {
  const s = new X.Senna(sennaDir, ["pos", "chk", "ner"]);
  got.senna_ctor_ok = { path: rel(s._path), exe: s.executable((s._path as string).slice(0, -1)).split("/").pop() };
  got.senna_map_pcn = Object.fromEntries(s._map());
  got.senna_map_chk = Object.fromEntries(new X.Senna(sennaDir, ["chk"])._map());
  got.senna_map_np = Object.fromEntries(new X.Senna(sennaDir, ["ner", "pos"])._map());
  got.senna_tag = errWrap(() => s.tag(["a", "b"]));
  got.senna_tag_sents = errWrap(() => s.tag_sents([["a", "b"], ["c"]]));
  got.senna_tagger = errWrap(() => new X.SennaTagger(sennaDir).tag(["a", "b"]));
  got.senna_chunk_tagger = errWrap(() => new X.SennaChunkTagger(sennaDir).tag(["a", "b", "c"]));
  got.senna_ner_tagger = errWrap(() => new X.SennaNERTagger(sennaDir).tag(["a", "b", "c"]));
  got.senna_bio_chunks = [
    ...new X.SennaChunkTagger(sennaDir).bio_to_chunks(
      [
        ["x", "B-NP"],
        ["y", "I-NP"],
        ["z", "O"],
        ["w", "B-VP"],
        ["v", "I-VP"],
      ] as [string, string][],
      "NP",
    ),
  ];
  got.senna_exe_name = s.executable("DUMMY");
  const badDir = mkdirF("senna-bad");
  const bad = join(badDir, "senna-linux64");
  writeFileSync(bad, "#!/bin/sh\nprintf 'oops' >&2\nexit 3\n");
  chmodSync(bad, 0o755);
  const sb = new X.Senna(badDir, ["pos"]);
  got.senna_fail = errWrap(() => sb.tag_sents([["a"]]));
  const goneDir = mkdirF("senna-gone");
  const gp = join(goneDir, "senna-linux64");
  writeFileSync(gp, "#!/bin/sh\n");
  chmodSync(gp, 0o755);
  const sg = new X.Senna(goneDir, ["pos"]);
  rmSync(gp);
  got.senna_exe_gone = errWrap(() => sg.tag_sents([["a"]]));
});

// ---------------- malt ----------------
envctx({ MALT_PARSER: undefined, MALT_MODEL: undefined }, () => {
  got.malt_ctor_empty = errWrap(() => new X.MaltParser());
  got.malt_ctor_missingdir = errWrap(() => new X.MaltParser({ parser_dirname: "relative-missing" }));
  got.malt_ctor_emptydir = errWrap(() => new X.MaltParser({ parser_dirname: mkdirF("malt-empty") }));
});

const maltDir = join(NDATA, "malt");
mkdirSync(maltDir, { recursive: true });
for (const j of ["log4j.jar", "libsvm.jar", "liblinear-1.8.jar", "maltparser-1.9.2.jar"]) {
  touch(join(maltDir, j));
}
const mco = touch(join(FIX, "model.mco"));

envctx({ MALT_PARSER: undefined, MALT_MODEL: undefined }, () => {
  got.find_malt_model_none = X.findMaltModel(null);
  got.find_malt_model_missing = errWrap(() => X.findMaltModel("x.mco"));
});
envctx({ MALT_MODEL: join(FIX) }, () => {
  got.find_malt_model_envdir = rel(X.findMaltModel("model.mco"));
});

envctx({ MALT_PARSER: maltDir, MALT_MODEL: undefined }, () => {
  const mpObj = new X.MaltParser({ model_filename: mco });
  got.malt_ctor_jars = mpObj.malt_jars.map((j) => rel(j)).sort();
  const normCmd = (cmd: string[]) => {
    const c = [...cmd];
    const i = c.indexOf("-cp") + 1;
    if (i > 0 && c[i]) c[i] = c[i]!.split(":").sort().join(":");
    return c.map((x) => rel(x));
  };
  got.malt_cmd_parse = normCmd(
    mpObj.generateMaltCommand("/in.conll", "/out.conll", "parse"),
  );
  got.malt_cmd_learn = normCmd(mpObj.generateMaltCommand("/in.conll", null, "learn"));
  const mpBad = new X.MaltParser({ additional_java_args: ["-Dfoo=1"], model_filename: mco });
  got.malt_java_args_invalid = errWrap(() =>
    mpBad.generateMaltCommand("/i", "/o", "parse"),
  );
  const mpUntrained = new X.MaltParser();
  got.malt_parse_untrained = errWrap(() => [...mpUntrained.parse_tagged_sents([[]])]);

  const fakebinOnPath = join(FIX, "bin-java") + ":" + process.env.PATH;
  const tagged: [string, string][][] = [[["John", "NNP"], ["sees", "VBZ"]]];
  envctx({ PATH: fakebinOnPath, FAKE_JAVA_ARGV }, () => {
    const r = errWrap(() =>
      [...mpObj.parse_tagged_sents(tagged)].map((g) => g[0]!.to_conll(10)),
    );
    (r as Record<string, unknown>).argv = readArgv(FAKE_JAVA_ARGV);
    got.malt_parse_sents = r;
    got.malt_parse_tree = errWrap(() =>
      [...mpObj.parse_tagged_sents(tagged)].map((g) => {
        try {
          return String(g[0]!.tree());
        } catch (e) {
          // Python tree() subscripts self.root -> TypeError when root is None.
          if (e instanceof Error && e.message.includes("no root node")) {
            throw Object.assign(new Error("'NoneType' object is not subscriptable"), {
              name: "TypeError",
            });
          }
          throw e;
        }
      }),
    );
    envctx({ FAKE_JAVA_RC: "3" }, () => {
      got.malt_java_fail = errWrap(() => [...mpObj.parse_tagged_sents(tagged)]);
    });
    const trainConll = join(FIX, "train.conll");
    writeFileSync(
      trainConll,
      "1\tJohn\t_\tNNP\tNNP\t_\t2\tsubj\t_\t_\n2\tsees\t_\tVBZ\tVBZ\t_\t0\tROOT\t_\t_\n\n",
    );
    const r3 = errWrap(() => {
      mpObj.train_from_file(trainConll);
      return null;
    });
    (r3 as Record<string, unknown>).argv = readArgv(FAKE_JAVA_ARGV);
    (r3 as Record<string, unknown>).trained = mpObj._trained;
    got.malt_train = r3;
    envctx({ FAKE_JAVA_RC: "3" }, () => {
      got.malt_train_fail = errWrap(() => mpObj.train_from_file(trainConll));
    });
  });
});

const maltUntrusted = mkdirF("malt-outside");
for (const j of ["log4j.jar", "libsvm.jar", "liblinear-1.8.jar", "maltparser-1.9.2.jar"]) {
  touch(join(maltUntrusted, j));
}
envctx({ MALT_PARSER: maltUntrusted }, () => {
  const mo = new X.MaltParser();
  got.malt_untrusted_jars = errWrap(() => mo.generateMaltCommand("/i", "/o", "parse"));
});

got.malt_regex_tagger = X.maltRegexTagger()(["The", "cat", "runs", "5", "."]);

// ---------------- bllip ----------------
got.bllip_ctor = errWrap(() => new X.BllipParser());
got.bllip_unified = errWrap(() => X.BllipParser.fromUnifiedModelDir("/x"));
got.bllip_unified_this_dir = errWrap(() => {
  // Python: getattr on a missing classmethod raises AttributeError.
  const attr = (X.BllipParser as unknown as Record<string, unknown>)
    .from_unified_model_dir_this_dir;
  if (typeof attr !== "function") {
    throw Object.assign(
      new Error("type object 'BllipParser' has no attribute 'from_unified_model_dir_this_dir'"),
      { name: "AttributeError" },
    );
  }
  return (attr as () => unknown)();
});
got.bllip_ensure_ascii_ok = errWrap(() => {
  X._ensureAscii(["a", "b"]);
  return null;
});
got.bllip_ensure_ascii_bad = errWrap(() => {
  X._ensureAscii(["a", "é"]);
  return null;
});
got.bllip_unbound_parse = errWrap(() => {
  const unbound = Object.create(X.BllipParser.prototype) as X.BllipParser;
  return [...unbound.parse("hello world" as unknown as string[])];
});

// ---------------- corenlp ----------------
envctx({ CORENLP: undefined, CORENLP_MODELS: undefined, CLASSPATH: undefined }, () => {
  got.corenlp_ctor_missing = errWrap(() => new X.CoreNLPServer());
});
const corenlpJar = touch(join(FIX, "stanford-corenlp-3.9.2.jar"));
envctx({ CORENLP_MODELS: undefined }, () => {
  got.corenlp_ctor_models_missing = errWrap(
    () =>
      new X.CoreNLPServer({ path_to_jar: corenlpJar, path_to_models_jar: "/nonexistent-models" }),
  );
});
const corenlpDir = mkdirF("corenlp-jars");
touch(join(corenlpDir, "stanford-corenlp-3.9.1.jar"));
touch(join(corenlpDir, "stanford-corenlp-3.9.2.jar"));
envctx({ CORENLP: corenlpDir, CORENLP_MODELS: undefined }, () => {
  got.corenlp_two_jars = errWrap(() => new X.CoreNLPServer());
});

const cnlpJar = touch(join(NDATA, "stanford-corenlp-3.9.2.jar"));
const cnlpModel = touch(join(NDATA, "stanford-corenlp-3.9.2-models.jar"));
envctx({ CORENLP: cnlpJar, CORENLP_MODELS: cnlpModel }, () => {
  const srv = new X.CoreNLPServer();
  got.corenlp_ctor_ok = pnorm({
    url: srv.url,
    classpath: (srv._classpath as string[]).map((c) => rel(c)),
    opts: srv.corenlp_options,
    java_opts: srv.java_options,
  });
  got.corenlp_url_fmt = pnorm(srv.url);
});
{
  const s = Bun.listen({ hostname: "localhost", port: 0, socket: { data() {} } });
  const busyPort = s.port;
  envctx({ CORENLP: cnlpJar, CORENLP_MODELS: cnlpModel }, () => {
    got.corenlp_busy_port = errWrap(() => new X.CoreNLPServer({ port: busyPort }));
  });
  s.stop();
}
got.try_port = (() => {
  const p = X.tryPort();
  return typeof p === "number" && p > 0;
})();
got.try_port_arg = X.tryPort(19999);
X.setRequestsAvailable(false);
got.corenlp_tagtype_bad = errWrap(() => new X.CoreNLPParser({ tagtype: "bad" }));
X.setRequestsAvailable(true);
got.corenlp_parser_annots = {
  parser: (X.CoreNLPParser as unknown as { parser_annotator: string }).parser_annotator,
  dep: (X.CoreNLPDependencyParser as unknown as { parser_annotator: string }).parser_annotator,
};
got.corenlp_server_err = new X.CoreNLPServerError(3, "boom msg").message;

// ---------------- async section (http + server + hunpos done sync) ----------------
const CANNED = {
  sentences: [
    {
      parse: "(ROOT (S (NP (NNP John)) (VP (VBZ sees) (NP (NNP Mary))) (. .)))",
      basicDependencies: [
        { dep: "ROOT", governor: 0, dependent: 2, dependentGloss: "sees", governorGloss: "ROOT" },
        { dep: "nsubj", governor: 2, dependent: 1, dependentGloss: "John", governorGloss: "sees" },
        { dep: "dobj", governor: 2, dependent: 3, dependentGloss: "Mary", governorGloss: "sees" },
        { dep: "punct", governor: 2, dependent: 4, dependentGloss: ".", governorGloss: "sees" },
      ],
      tokens: [
        { index: 1, word: "John", originalText: "John", lemma: "John", pos: "NNP", ner: "PERSON", characterOffsetBegin: 0, characterOffsetEnd: 4 },
        { index: 2, word: "sees", originalText: null, lemma: "see", pos: "VBZ", ner: "O", characterOffsetBegin: 5, characterOffsetEnd: 9 },
        { index: 3, word: "Mary", originalText: "Mary", lemma: "Mary", pos: "NNP", ner: "PERSON", characterOffsetBegin: 10, characterOffsetEnd: 14 },
        { index: 4, word: ".", originalText: ".", lemma: ".", pos: ".", ner: "O", characterOffsetBegin: 14, characterOffsetEnd: 15 },
      ],
    },
  ],
};

const httpLog: unknown[][] = [];
const cannedJson = JSON.stringify(CANNED);

function makeServer(port: number) {
  return Bun.serve({
    hostname: "localhost",
    port,
    fetch: async (req) => {
      const u = new URL(req.url);
      if (req.method === "GET") {
        httpLog.push(["GET", u.pathname]);
        if (u.pathname === "/live" || u.pathname === "/ready") {
          return new Response("ok", { status: 200 });
        }
        return new Response("nope", { status: 404 });
      }
      const body = await req.text();
      httpLog.push(["POST", u.pathname + u.search, req.headers.get("Content-Type"), body]);
      if (body === "LOOSE") {
        return new Response(`{"x": "ab", "sentences": []}`, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (body === "FAIL") {
        return new Response("server error", { status: 500 });
      }
      return new Response(cannedJson, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
}

async function asyncSection(): Promise<void> {
  if (hunposTagger) {
    got.hunpos_tag = await errWrapA(() => hunposTagger!.tag(["a", "b"]));
    got.hunpos_tag_newline = await errWrapA(() => hunposTagger!.tag(["a\nb"]));
    await hunposTagger.close();
  }
  const server = makeServer(0);
  const mockUrl = `http://localhost:${server.port}`;

  // server start/stop happy path with fake java staying alive
  await envctxA({ CORENLP: cnlpJar, CORENLP_MODELS: cnlpModel }, async () => {
    const srv2 = new X.CoreNLPServer({ verbose: false });
    const port2 = Number(srv2.url.split(":").pop());
    const server2 = makeServer(port2);
    await envctxA({ PATH: join(FIX, "bin-java") + ":" + process.env.PATH }, async () => {
      const r = await errWrapA(() => srv2.start());
      got.corenlp_server_start = r;
      if (r.err === null) {
        got.corenlp_server_url = pnorm(srv2.url);
        await srv2.stop();
        got.corenlp_server_stopped = true;
      }
      X._javaState.bin = null;
    });
    server2.stop(true);
  });

  httpLog.length = 0;
  const p = new X.CoreNLPParser({ url: mockUrl });
  got.corenlp_raw_parse = await errWrapA(async () => {
    const trees: string[] = [];
    const it = await p.raw_parse("John sees Mary.");
    trees.push(String(it));
    return trees;
  });
  const pd = new X.CoreNLPDependencyParser({ url: mockUrl });
  got.corenlp_dep_parse = await errWrapA(async () => {
    const out: unknown[] = [];
    for await (const g of pd.raw_parse_sents(["John sees Mary."])) {
      const dg = g[0] as DependencyGraph;
      const pyStr = (v: unknown) => (v === null || v === undefined ? "None" : String(v));
      const pyDeps = (deps: number[][]) =>
        "[" + deps.sort().map((d) => "[" + d.join(", ") + "]").join(", ") + "]";
      const nodes = Object.values(dg.nodes as Record<number, {
        address: number | null;
        tag: string | null;
        rel: string | null;
        deps: Record<string, number[]>;
      }>)
        .filter((n) => n.address !== null)
        .map((n) => [n.address, pyStr(n.tag), pyStr(n.rel), pyDeps(Object.values(n.deps))])
        .sort();
      out.push([nodes]);
    }
    return out;
  });
  got.corenlp_tokenize = await errWrapA(async () => {
    const toks: string[] = [];
    for await (const t of p.tokenize("John sees Mary.")) toks.push(t);
    return toks;
  });
  got.corenlp_tag_pos = await errWrapA(() =>
    new X.CoreNLPParser({ url: mockUrl, tagtype: "pos" }).tag(["a", "b"]),
  );
  got.corenlp_tag_ner = await errWrapA(() =>
    new X.CoreNLPParser({ url: mockUrl, tagtype: "ner" }).tag(["a"]),
  );
  got.corenlp_make_tree = String(p.makeTree(CANNED.sentences[0]));
  got.corenlp_http_log = httpLog.filter((e) => e[0] === "POST");
  httpLog.length = 0;

  got.corenlp_json_strict = await errWrapA(() =>
    (p.api_call("LOOSE") as Promise<Record<string, unknown>>).then((r) => r.x),
  );
  got.corenlp_json_loose = await errWrapA(() =>
    (new X.CoreNLPParser({ url: mockUrl, strict_json: false }).api_call("LOOSE") as Promise<
      Record<string, unknown>
    >).then((r) => r.x),
  );
  got.corenlp_http_500 = await errWrapA(() => p.api_call("FAIL"));
  httpLog.length = 0;
  server.stop(true);
}

// ---------------- boxer ----------------
envctx({ CANDC: undefined, BOXER: undefined }, () => {
  got.boxer_ctor = errWrap(() => new X.Boxer());
  got.boxer_ctor_bindir = errWrap(() => new X.Boxer({ bin_dir: "/nonexistent" }));
});
const relbin = join(FIX, "relproj", "bin");
mkdirSync(relbin, { recursive: true });
touch(join(relbin, "candc"));
touch(join(relbin, "boxer"));
chdir(join(FIX, "relproj"), () => {
  got.boxer_ctor_rel_bindir = errWrap(() => new X.Boxer({ bin_dir: "bin" }));
});

const fakebinDir = mkdirF("boxerbin");
tool("candc", FAKE_CANDC_BODY, fakebinDir);
tool("boxer", FAKE_BOXER_BODY, fakebinDir);
envctx({ CANDC: fakebinDir, BOXER: undefined }, () => {
  const bxr = new X.Boxer();
  got.boxer_ctor_ok = {
    candc: rel(bxr._candc_bin),
    boxer: rel(bxr._boxer_bin),
    models: rel(bxr._candc_models_path),
  };
  got.boxer_interpret = errWrap(() => String(bxr.interpret("The dog runs")));
  got.boxer_interpret_multi = errWrap(() =>
    bxr.interpret_multi_sents([["a"]]).map((d) => String(d)),
  );
  got.boxer_call_fail = errWrap(() => bxr._callBoxer("input" as unknown as Uint8Array));
  writeFileSync(join(fakebinDir, "boxer"), "#!/bin/sh\nprintf 'oops' >&2\nexit 3\n");
  chmodSync(join(fakebinDir, "boxer"), 0o755);
  got.boxer_call_rc = errWrap(() => bxr.interpret("The dog runs"));
});

// ---------------- dot2img ----------------
const DOT_SRC = 'digraph G {\n0 [label="John"];\n}';
envctx({ PATH: "/nonexistent" }, () => {
  got.dot2img_missing = errWrap(() => X.dot2img(DOT_SRC));
});
const dotDir = join(FIX, "bin-dot");
envctx({ PATH: dotDir + ":" + process.env.PATH }, () => {
  got.dot2img_svg = errWrap(() => X.dot2img(DOT_SRC, "svg"));
  got.dot2img_png = errWrap(() => X.dot2img(DOT_SRC, "png"));
});
const baddir = mkdirF("baddot");
touch(join(baddir, "dot"));
envctx({ PATH: baddir + ":/nonexistent" }, () => {
  got.dot2img_noexec = errWrap(() => X.dot2img(DOT_SRC));
});

// ---------------- megam/tadm ----------------
got.call_megam_str = errWrap(() => X.callMegam("str" as unknown as string[]));
got.call_tadm_str = errWrap(() => X.callTadm("str" as unknown as string[]));
envctx({ MEGAM: undefined, PATH: "/nonexistent" }, () => {
  got.call_megam_missing = errWrap(() => X.callMegam([]));
});
envctx({ TADM: undefined, PATH: "/nonexistent" }, () => {
  got.call_tadm_missing = errWrap(() => X.callTadm([]));
});

X.configMegam(FAKE_MEGAM);
envctx({ FAKE_MEGAM_ARGV }, () => {
  got.call_megam_fake = captured(() => X.callMegam(["-x", "y"]));
  got.call_megam_argv = readArgv(FAKE_MEGAM_ARGV);
  envctx({ FAKE_MEGAM_RC: "3" }, () => {
    got.call_megam_fail = captured(() => X.callMegam(["a"]));
  });
});
X._megamState.bin = null;

X.configTadm(FAKE_TADM);
envctx({ FAKE_TADM_ARGV }, () => {
  got.call_tadm_fake = errWrap(() => X.callTadm(["-x"]));
  got.call_tadm_argv = readArgv(FAKE_TADM_ARGV);
});
X._tadmState.bin = null;

const trainToks: [Record<string, unknown>, string][] = [
  [{ alwayson: true, f1: true, f2: 2 }, "A"],
  [{ alwayson: true, f1: false, f2: 1 }, "B"],
  [{ alwayson: true, f1: true }, "A"],
  [{ alwayson: true, f2: 3 }, "B"],
];
X.configMegam(FAKE_MEGAM);
envctx({ FAKE_MEGAM_ARGV }, () => {
  got.megam_train = captured(() => {
    const clf = X.trainMaxentClassifierWithMegam(trainToks as never, { trace: 0 });
    return {
      labels: [...clf.labels()].sort(),
      weights: Array.from(clf.weights()),
      argv: readArgv(FAKE_MEGAM_ARGV),
    };
  });
});
got.megam_train_encoding_labels = errWrap(() =>
  X.trainMaxentClassifierWithMegam(trainToks as never, {
    trace: 0,
    encoding: "x" as never,
    labels: ["A"],
  }),
);
X._megamState.bin = null;

X.configTadm(FAKE_TADM);
envctx({ FAKE_TADM_ARGV }, () => {
  got.tadm_train = errWrap(() => {
    const clf = X.TadmMaxentClassifier.train(trainToks as never, { trace: 0 });
    return {
      labels: [...clf.labels()].sort(),
      weights: Array.from(clf.weights()),
      argv: readArgv(FAKE_TADM_ARGV),
    };
  });
});
X._tadmState.bin = null;

{
  const enc = BinaryMaxentFeatureEncoding.train(trainToks as never, 0, null);
  const chunks: string[] = [];
  write_megam_file(trainToks as never, enc, { write: (s: string) => chunks.push(s) });
  got.write_megam_file = chunks.join("");
  got.parse_megam_weights = Array.from(parse_megam_weights("0 0.5\n1 -0.5\n", 5));
  const enc2 = TadmEventMaxentFeatureEncoding.train(trainToks as never, 0, null);
  const chunks2: string[] = [];
  write_tadm_file(trainToks as never, enc2, { write: (s: string) => chunks2.push(s) });
  got.write_tadm_file = chunks2.join("");
  got.parse_tadm_weights = Array.from(parse_tadm_weights(["0.25\n", "-0.25\n"]));
}

await asyncSection();
hold9000?.stop();

// ---------------------------------------------------------------------------
describe("gap adapters vs NLTK 3.10.3", () => {
  test("all pins match", async () => {
    got.java_blocking_false = await (got.java_blocking_false_promise as Promise<unknown>);
    delete got.java_blocking_false_promise;
    const oracleKeys = Object.keys(O).filter((k) => k !== "host_tools" && k !== "data_path");
    const mismatches: string[] = [];
    for (const k of oracleKeys) {
      const expected = O[k];
      const actual = got[k] === undefined ? "<MISSING>" : got[k];
      try {
        expect(actual).toEqual(expected as never);
      } catch {
        mismatches.push(k);
      }
    }
    const extra = Object.keys(got).filter((k) => !(k in O));
    if (extra.length) mismatches.push(`extra keys: ${extra.join(",")}`);
    if (mismatches.length) {
      for (const k of mismatches.slice(0, 30)) {
        console.log(`MISMATCH ${k}:\n  oracle: ${JSON.stringify(O[k])?.slice(0, 300)}\n  ts    : ${JSON.stringify(got[k])?.slice(0, 300)}`);
      }
      throw new Error(`${mismatches.length} mismatches: ${mismatches.join(", ")}`);
    }
  });
});
