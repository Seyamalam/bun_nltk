"""Pinned oracle for external-tool gap adapters (NLTK 3.10.3).

Covers: nltk.internals finders + java machinery (incl. CVE-2026-12841
option/jar hardening), stanford/hunpos/senna taggers, malt, bllip,
corenlp server+HTTP client, boxer/candc pipeline, dot2img,
megam/tadm wrappers + train_maxent_classifier_with_megam.

All tool invocations use fake POSIX scripts generated under a temp dir;
HTTP uses a localhost mock. Output: one JSON object on the last line.
"""
import contextlib
import http.server
import io
import json
import os
import re
import socket
import sys
import tempfile
import threading
import types
import urllib.error
import urllib.parse
import urllib.request
import warnings

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"
import nltk.data
from nltk import internals as I
from nltk.tag import stanford as st
from nltk.tag import hunpos as hp_mod
from nltk.tag import senna as t_senna
from nltk.classify import senna as c_senna
from nltk.classify import megam as mg
from nltk.classify import tadm as td
from nltk.classify import maxent as mx
from nltk.parse import malt as mp
from nltk.parse import bllip as bl
from nltk.sem import boxer as bxmod
from nltk.parse import dependencygraph as dgmod

FIX = tempfile.mkdtemp(prefix="gapadapters-")
NLTK_DATA_FIX = os.path.join(FIX, "nltkdata")
os.makedirs(NLTK_DATA_FIX)
# jars under a configured nltk_data dir are "trusted" for the jar sandbox
nltk.data.path.insert(0, NLTK_DATA_FIX)


def rel(s):
    if not isinstance(s, str):
        return s
    s = s.replace(FIX, "<T>")
    # random mkstemp/NamedTemporaryFile basenames (8+ chars of [a-z0-9_])
    s = re.sub(r"(?<![\w.])(tmp|nltk-|boxer-|malt_input\.conll\.|malt_output\.conll\.|malt_train\.conll\.)[a-z0-9_]+",
               r"\1<F>", s)
    s = re.sub(r"nltk-<F>-(events|weights)-[a-z0-9_]+", r"nltk-<F>-\1-<F>", s)
    s = re.sub(r"0x[0-9a-fA-F]+", "0x<F>", s)
    return s


def pnorm(v):
    """Normalize CoreNLP ports — try_port() yields 9000 when free, else an
    ephemeral fallback (e.g. when a prior server left 9000 in TIME_WAIT)."""
    if isinstance(v, str):
        return re.sub(r"localhost:\d+", "localhost:<P>", v)
    if isinstance(v, tuple):
        return tuple(pnorm(x) for x in v)
    if isinstance(v, list):
        return [
            "<P>"
            if i > 0 and v[i - 1] == "-port" and isinstance(x, str) and x.isdigit()
            else pnorm(x)
            for i, x in enumerate(v)
        ]
    if isinstance(v, dict):
        return {k: pnorm(x) for k, x in v.items()}
    return v


def norm(x):
    if isinstance(x, dict):
        return {k: norm(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [norm(v) for v in x]
    if isinstance(x, bytes):
        return {"b": repr(rel(x.decode("utf-8", "replace")))}
    return rel(x) if isinstance(x, str) else x


def err(f):
    try:
        return {"err": None, "val": norm(f())}
    except Exception as e:
        return {"err": f"{type(e).__name__}:{rel(str(e))[:400]}", "val": None}


@contextlib.contextmanager
def envctx(**kw):
    old = {k: os.environ.get(k) for k in kw}
    for k, v in kw.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    try:
        yield
    finally:
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


def mkdir(*parts):
    d = os.path.join(FIX, *parts)
    os.makedirs(d, exist_ok=True)
    return d


def touch(path, data=b""):
    with open(path, "wb") as f:
        f.write(data)
    return path


def tool(name, body, dir=None):
    d = dir or mkdir("bin-" + name)
    p = os.path.join(d, name)
    with open(p, "w") as f:
        f.write(body)
    os.chmod(p, 0o755)
    return p


@contextlib.contextmanager
def chdir(d):
    old = os.getcwd()
    os.chdir(d)
    try:
        yield
    finally:
        os.chdir(old)


def captured(f):
    """Run f() with stdout captured; returns {'printed','result'|'err'}."""
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            v = f()
        return {"printed": rel(buf.getvalue()), "val": norm(v)}
    except Exception as e:
        return {"printed": rel(buf.getvalue()), "err": f"{type(e).__name__}:{rel(str(e))[:400]}"}


out = {}

# ---------------- fake tools ----------------
FAKE_JAVA = tool("java", """#!/bin/sh
printf '%s\\n' "$@" > "${FAKE_JAVA_ARGV:-/dev/null}"
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
exit "${FAKE_JAVA_RC:-0}"
""")

FAKE_HUNPOS = tool("hunpos-tag", """#!/bin/sh
while IFS= read -r line; do
  printf '%s\\tTAGGED\\n' "$line"
done
""")

FAKE_SENNA_BODY = """#!/bin/sh
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
"""

FAKE_CANDC = tool("candc", """#!/bin/sh
/bin/cat > /dev/null
printf 'canned-candc\\n'
""")

FAKE_BOXER = tool("boxer", """#!/bin/sh
printf "id('0',1).\\nsem(1,[x1],drs([[1001,1002]:x1, [1003]:e2], [[1001,1002]:pred(x1, dog, n, 0), [1003]:rel(e2, x1, agent, 0)])).\\n"
""")

FAKE_DOT = tool("dot", """#!/bin/sh
/bin/cat > /dev/null
printf '<svg>fake</svg>\\n'
""")

FAKE_MEGAM = tool("megam", """#!/bin/sh
printf '%s\\n' "$@" > "${FAKE_MEGAM_ARGV:-/dev/null}"
printf '0 0.5\\n1 -0.5\\n'
exit "${FAKE_MEGAM_RC:-0}"
""")

FAKE_TADM = tool("tadm", """#!/bin/sh
printf '%s\\n' "$@" > "${FAKE_TADM_ARGV:-/dev/null}"
prev=
for a in "$@"; do
  if [ "$prev" = "-params_out" ]; then printf '0.1\\n0.2\\n0.3\\n-0.1\\n-0.2\\n-0.3\\n' > "$a"; fi
  prev="$a"
done
""")

FAKE_MEGAM_ARGV = os.path.join(FIX, "megam.argv")
FAKE_TADM_ARGV = os.path.join(FIX, "tadm.argv")
FAKE_JAVA_ARGV = os.path.join(FIX, "java.argv")


def read_argv(p):
    try:
        with open(p) as f:
            lines = [rel(l.rstrip("\n")) for l in f]
    except FileNotFoundError:
        return None
    # jar set order is nondeterministic -> sort the -cp value
    if "-cp" in lines:
        i = lines.index("-cp") + 1
        lines[i] = ":".join(sorted(lines[i].split(":")))
    return lines


out["host_tools"] = {t: (os.popen(f"command -v {t} 2>/dev/null").read().strip() or None)
                     for t in ["java", "dot", "senna", "hunpos-tag", "megam", "tadm", "boxer", "candc"]}
out["data_path"] = [rel(p) for p in nltk.data.path]

# ---------------- finders ----------------
out["find_binary_java"] = err(lambda: I.find_binary("java"))
out["find_binary_java_name"] = err(lambda: I.find_binary("java", binary_names=["java", "java.exe"]))
with envctx(PATH="/nonexistent"):
    out["find_binary_deadpath"] = err(lambda: I.find_binary("java"))
out["find_binary_patharg"] = err(lambda: I.find_binary("java", path_to_bin="/nonexistent/java"))
out["find_file_missing"] = err(lambda: I.find_file("never-here-xyz.txt"))
out["find_dir_env_unchecked"] = envctx_wrap = None
with envctx(MALT_PARSER="/nonexistent-env-dir"):
    out["find_dir_env_unchecked"] = err(lambda: I.find_dir("x", env_vars=("MALT_PARSER",)))

# bare-name cwd quirk: java planted in cwd, absent from PATH -> security LookupError
cwd_dir = mkdir("cwd-quirk")
touch(os.path.join(cwd_dir, "java"))
with chdir(cwd_dir):
    out["find_binary_cwd_quirk"] = err(lambda: I.find_binary("java"))

# env-var dir + binary name
tool_dir = mkdir("tooldir")
touch(os.path.join(tool_dir, "mytool")); os.chmod(os.path.join(tool_dir, "mytool"), 0o755)
with envctx(FAKE_TOOL=tool_dir):
    out["find_binary_env_dir"] = err(lambda: I.find_binary("mytool", env_vars=("FAKE_TOOL",)))
with envctx(FAKE_TOOL=os.path.join(tool_dir, "mytool")):
    out["find_binary_env_file"] = err(lambda: I.find_binary("x", binary_names=["mytool"], env_vars=("FAKE_TOOL",)))

# ---------------- find_jar ----------------
out["find_jar_missing"] = err(lambda: I.find_jar("stanford-postagger.jar"))
out["find_jar_patharg"] = err(lambda: I.find_jar("x.jar", path_to_jar="/nonexistent/x.jar"))

jardir = mkdir("jars")
touch(os.path.join(jardir, "a.jar")); touch(os.path.join(jardir, "b.jar")); touch(os.path.join(jardir, "c.jar"))
touch(os.path.join(jardir, "notajar.txt"))
with envctx(CLASSPATH=jardir):
    out["find_jar_classpath_dir"] = err(lambda: I.find_jar("a.jar"))
with envctx(CLASSPATH=os.path.join(jardir, "b.jar")):
    out["find_jar_classpath_file"] = err(lambda: I.find_jar("b.jar"))
with envctx(MYJARS=jardir):
    out["find_jar_env_dir"] = err(lambda: I.find_jar("c.jar", env_vars=("MYJARS",)))
with envctx(MYJARS=os.path.join(jardir, "a.jar")):
    out["find_jar_env_file"] = err(lambda: I.find_jar("a.jar", env_vars=("MYJARS",)))
# regex + searchpath quirk: yields every file in dir
out["find_jar_regex_quirk"] = err(lambda: sorted(I.find_jar_iter(
    r"\.jar$", searchpath=(jardir,), env_vars=(), is_regex=True, verbose=False)))
out["find_jar_searchpath"] = err(lambda: list(I.find_jar_iter(
    "a.jar", searchpath=(jardir,), env_vars=(), verbose=False)))
nested = mkdir("nested", "inner")
touch(os.path.join(nested, "n1.jar")); touch(os.path.join(nested, "notjar.txt"))
out["find_jars_within_path"] = err(lambda: list(I.find_jars_within_path(os.path.join(FIX, "nested"))))

# ---------------- java machinery ----------------
out["java_str_cmd"] = err(lambda: I.java("java"))
out["java_empty_cp"] = err(lambda: I.java(["X"], classpath=""))
out["java_rel_cp"] = err(lambda: I.java(["X"], classpath="rel.jar"))
out["java_untrusted_cp"] = err(lambda: I.java(["X"], classpath="/outside-xyz/x.jar"))
trusted_jar = touch(os.path.join(NLTK_DATA_FIX, "tj.jar"))
out["java_trusted_cp"] = err(lambda: I.java(["-version"], classpath=trusted_jar))

opts_cases = {
    "int": [123],
    "atfile": ["@argfile"],
    "metachar": ["-Xmx512m ; rm -rf /"],
    "onerror": ["-XX:OnError=foo"],
    "dprop": ["-Dfoo=bar"],
    "javaagent": ["-javaagent:x.jar"],
    "modules_noval": ["--add-modules"],
    "modules_ok": ["--add-modules=java.se"],
    "modules_badval": ["--add-modules", "bad mod"],
    "valid": ["-mx2g", "-Xmx512m", "-server", "-verbose:gc", "-ms64m", "-ss2m", "-client"],
    "ea": ["-ea"],
}
for k, o in opts_cases.items():
    out[f"java_opts_{k}"] = err(lambda o=o: I.java(["-version"], options=o))

out["java_missing"] = err(lambda: I.java(["-version"], stdout="pipe", stderr="pipe"))
out["config_java_missing"] = err(lambda: I.config_java())
out["config_java_path"] = err(lambda: I.config_java(bin="/nonexistent/java"))
out["stale_java_bin"] = repr(I._java_bin)

with envctx(JAVAHOME=None):
    I.config_java(bin=FAKE_JAVA, verbose=False)
    out["java_fake_stdio"] = err(lambda: I.java(["-version"], stdout="pipe", stderr="pipe"))
    with envctx(FAKE_JAVA_RC="3"):
        out["java_fake_fail"] = err(lambda: I.java(["-version"], stdout="pipe", stderr="pipe"))
    # classpath argv preserved verbatim (join order + ':' separator)
    jars = [touch(os.path.join(NLTK_DATA_FIX, "j1.jar")), touch(os.path.join(NLTK_DATA_FIX, "j2.jar"))]
    with envctx(FAKE_JAVA_ARGV=FAKE_JAVA_ARGV):
        I.java(["Main"], classpath=jars, stdout="pipe", stderr="pipe")
    out["java_cp_argv"] = read_argv(FAKE_JAVA_ARGV)
    # trusted_raw_options bypasses allowlist
    out["java_trusted_opts"] = err(lambda: I.java(
        ["-version"], stdout="pipe", stderr="pipe", trusted_raw_options=["-Dsecret=1"]))
    # blocking=False
    popen = I.java(["-sleep", "x"], classpath=None, blocking=False)
    rec = {"pid_is_int": isinstance(popen.pid, int), "poll": popen.poll()}
    popen.terminate()
    rec["wait"] = popen.wait()
    out["java_blocking_false"] = rec
    I._java_bin = None  # reset cache

# ---------------- stanford ----------------
with envctx(STANFORD_MODELS=None, STANFORD_PARSER=None, STANFORD_TAGGER=None, CLASSPATH=None):
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        r = err(lambda: st.StanfordPOSTagger("model.tagger"))
        r["warnings"] = [str(x.message) for x in w]
        out["stanford_pos_ctor"] = r
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        r = err(lambda: st.StanfordNERTagger("model.ser.gz"))
        r["warnings"] = [str(x.message) for x in w]
        out["stanford_ner_ctor"] = r
    out["stanford_base_abstract"] = err(lambda: st.StanfordTagger())

jardir2 = mkdir("stanford")
posjar = touch(os.path.join(jardir2, "stanford-postagger.jar"))
with envctx(STANFORD_MODELS=None):
    out["stanford_pos_model_missing"] = err(
        lambda: st.StanfordPOSTagger("model.tagger", path_to_jar=posjar))

# happy env: jar inside trusted nltk_data + model file + fake java
modeldir = mkdir("stmodels")
model = touch(os.path.join(modeldir, "model.tagger"))
tjar = touch(os.path.join(NLTK_DATA_FIX, "stanford-postagger.jar"))
with envctx(STANFORD_MODELS=modeldir, CLASSPATH=None):
    I.config_java(bin=FAKE_JAVA, verbose=False)
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        r = err(lambda: st.StanfordPOSTagger("model.tagger", path_to_jar=tjar).tag_sents([["a", "b"]]))
        r["warnings"] = [str(x.message) for x in w]
        out["stanford_pos_tag_sents"] = r
    I._java_bin = None

# _cmd surface via unbound instance (ctor skipped to avoid jar lookup)
inst = st.StanfordPOSTagger.__new__(st.StanfordPOSTagger)
inst._stanford_model = model
inst._input_file_path = "/in.txt"
out["stanford_pos_cmd"] = norm(inst._cmd)
inst2 = st.StanfordNERTagger.__new__(st.StanfordNERTagger)
inst2._stanford_model = model
inst2._input_file_path = "/in.txt"
out["stanford_ner_cmd"] = norm(inst2._cmd)
out["stanford_pos_separator"] = st.StanfordPOSTagger._SEPARATOR
out["stanford_ner_separator"] = st.StanfordNERTagger._SEPARATOR
out["stanford_jar_pat"] = st.StanfordPOSTagger._JAR
out["stanford_ner_jar_pat"] = st.StanfordNERTagger._JAR
out["stanford_parse_output_pos"] = st.StanfordPOSTagger.__new__(
    st.StanfordPOSTagger).parse_output("a_TAG1 b_TAG2\nc_TAG3\n", [["a", "b"], ["c"]])
out["stanford_parse_output_ner"] = st.StanfordNERTagger.__new__(
    st.StanfordNERTagger).parse_output("a/X1 b/O\nc/X2\n", [["a", "b"], ["c"]])

# ---------------- hunpos ----------------
with envctx(HUNPOS_TAGGER=None):
    out["hunpos_ctor"] = err(lambda: hp_mod.HunposTagger("model"))
    out["hunpos_ctor_patharg"] = err(
        lambda: hp_mod.HunposTagger("model", path_to_bin="/nonexistent/hunpos-tag"))
hunpos_model = touch(os.path.join(os.path.dirname(FAKE_HUNPOS), "hpmodel"))
with envctx(HUNPOS_TAGGER=os.path.dirname(FAKE_HUNPOS)):
    r = err(lambda: hp_mod.HunposTagger("hpmodel"))
    out["hunpos_ctor_ok"] = r
    if r["err"] is None:
        tagger = hp_mod.HunposTagger("hpmodel")
        # str(obj) embeds id() — normalize through rel() so the pin is stable.
        r["val"] = rel(str(tagger))
        out["hunpos_tag"] = err(lambda: tagger.tag(["a", "b"]))
        out["hunpos_tag_newline"] = err(lambda: tagger.tag(["a\nb"]))
        tagger.close()
with envctx(HUNPOS_TAGGER=os.path.dirname(FAKE_HUNPOS)):
    out["hunpos_model_missing"] = err(lambda: hp_mod.HunposTagger("nope"))

# ---------------- senna ----------------
senna_dir = mkdir("senna")
senna_exe = os.path.join(senna_dir, "senna-linux64")
with open(senna_exe, "w") as f:
    f.write(FAKE_SENNA_BODY)
os.chmod(senna_exe, 0o755)

with envctx(SENNA=None):
    out["senna_ctor_absent"] = err(lambda: c_senna.Senna("/nonexistent-abs", ["pos"]))
    out["senna_ctor_relative"] = err(lambda: c_senna.Senna("relative-path", ["pos"]))
with envctx(SENNA="relative-env"):
    out["senna_ctor_env_relative"] = err(lambda: c_senna.Senna(None, ["pos"]))
empty_senna_dir = mkdir("senna-empty")
with envctx(SENNA=None):
    out["senna_ctor_nobin"] = err(lambda: c_senna.Senna(empty_senna_dir, ["pos"]))
with envctx(SENNA=None):
    s = c_senna.Senna(senna_dir, ["pos", "chk", "ner"])
    out["senna_ctor_ok"] = {"path": rel(s._path), "exe": s.executable(os.path.basename(s._path))}
    out["senna_map_pcn"] = s._map()
    out["senna_map_chk"] = c_senna.Senna(senna_dir, ["chk"])._map()
    out["senna_map_np"] = c_senna.Senna(senna_dir, ["ner", "pos"])._map()
    out["senna_tag"] = err(lambda: s.tag(["a", "b"]))
    out["senna_tag_sents"] = err(lambda: s.tag_sents([["a", "b"], ["c"]]))
    out["senna_tagger"] = err(lambda: t_senna.SennaTagger(senna_dir).tag(["a", "b"]))
    out["senna_chunk_tagger"] = err(lambda: t_senna.SennaChunkTagger(senna_dir).tag(["a", "b", "c"]))
    out["senna_ner_tagger"] = err(lambda: t_senna.SennaNERTagger(senna_dir).tag(["a", "b", "c"]))
    out["senna_bio_chunks"] = list(t_senna.SennaChunkTagger(senna_dir).bio_to_chunks(
        [("x", "B-NP"), ("y", "I-NP"), ("z", "O"), ("w", "B-VP"), ("v", "I-VP")], "NP"))
    out["senna_exe_name"] = c_senna.Senna.executable(c_senna.Senna.__new__(c_senna.Senna), "DUMMY")
    # failing senna
    bad_dir = mkdir("senna-bad")
    bad = os.path.join(bad_dir, "senna-linux64")
    with open(bad, "w") as f:
        f.write("#!/bin/sh\nprintf 'oops' >&2\nexit 3\n")
    os.chmod(bad, 0o755)
    sb = c_senna.Senna(bad_dir, ["pos"])
    out["senna_fail"] = err(lambda: sb.tag_sents([["a"]]))
    # exe removed after ctor
    gone_dir = mkdir("senna-gone")
    gp = os.path.join(gone_dir, "senna-linux64")
    with open(gp, "w") as f:
        f.write("#!/bin/sh\n")
    os.chmod(gp, 0o755)
    sg = c_senna.Senna(gone_dir, ["pos"])
    os.unlink(gp)
    out["senna_exe_gone"] = err(lambda: sg.tag_sents([["a"]]))

# ---------------- malt ----------------
with envctx(MALT_PARSER=None, MALT_MODEL=None):
    out["malt_ctor_empty"] = err(lambda: mp.MaltParser())
    out["malt_ctor_missingdir"] = err(lambda: mp.MaltParser("relative-missing"))
    out["malt_ctor_emptydir"] = err(lambda: mp.MaltParser(mkdir("malt-empty")))

malt_dir = mkdir("malt-trusted") if False else os.path.join(NLTK_DATA_FIX, "malt")
os.makedirs(malt_dir, exist_ok=True)
for j in ["log4j.jar", "libsvm.jar", "liblinear-1.8.jar", "maltparser-1.9.2.jar"]:
    touch(os.path.join(malt_dir, j))
mco = touch(os.path.join(FIX, "model.mco"))

with envctx(MALT_PARSER=None, MALT_MODEL=None):
    out["find_malt_model_none"] = mp.find_malt_model(None)
    out["find_malt_model_missing"] = err(lambda: mp.find_malt_model("x.mco"))
with envctx(MALT_MODEL=os.path.dirname(mco)):
    out["find_malt_model_envdir"] = rel(mp.find_malt_model("model.mco"))

with envctx(MALT_PARSER=malt_dir, MALT_MODEL=None):
    mp_obj = mp.MaltParser(model_filename=mco)
    # malt_jars is a list(set) — jar set order is nondeterministic; sort it so
    # order-sensitive pins (error messages embed the -cp join) are stable.
    mp_obj.malt_jars = sorted(mp_obj.malt_jars)
    out["malt_ctor_jars"] = sorted(rel(j) for j in mp_obj.malt_jars)

    def norm_cmd(cmd):
        c = list(cmd)
        if "-cp" in c:
            i = c.index("-cp") + 1
            c[i] = ":".join(sorted(c[i].split(":")))
        return [rel(x) for x in c]

    out["malt_cmd_parse"] = norm_cmd(mp_obj.generate_malt_command(
        "/in.conll", outputfilename="/out.conll", mode="parse"))
    out["malt_cmd_learn"] = norm_cmd(mp_obj.generate_malt_command(
        "/in.conll", mode="learn"))
    mp_bad = mp.MaltParser(additional_java_args=["-Dfoo=1"], model_filename=mco)
    out["malt_java_args_invalid"] = err(lambda: mp_bad.generate_malt_command(
        "/i", outputfilename="/o", mode="parse"))
    mp_untrained = mp.MaltParser()
    out["malt_parse_untrained"] = err(lambda: list(mp_untrained.parse_tagged_sents([[]])))

    fakebin_on_path = os.path.dirname(FAKE_JAVA) + ":" + os.environ["PATH"]
    tagged = [[("John", "NNP"), ("sees", "VBZ")]]
    with envctx(PATH=fakebin_on_path, FAKE_JAVA_ARGV=FAKE_JAVA_ARGV):
        r = err(lambda: [next(g).to_conll(10) for g in mp_obj.parse_tagged_sents(tagged)])
        r["argv"] = read_argv(FAKE_JAVA_ARGV)
        out["malt_parse_sents"] = r
        r2 = err(lambda: [str(next(g).tree()) for g in mp_obj.parse_tagged_sents(tagged)])
        out["malt_parse_tree"] = r2
        with envctx(FAKE_JAVA_RC="3"):
            out["malt_java_fail"] = err(lambda: list(mp_obj.parse_tagged_sents(tagged)))
        # train_from_file happy + failure
        train_conll = os.path.join(FIX, "train.conll")
        with open(train_conll, "w") as f:
            f.write("1\tJohn\t_\tNNP\tNNP\t_\t2\tsubj\t_\t_\n2\tsees\t_\tVBZ\tVBZ\t_\t0\tROOT\t_\t_\n\n")
        r3 = err(lambda: mp_obj.train_from_file(train_conll))
        r3["argv"] = read_argv(FAKE_JAVA_ARGV)
        r3["trained"] = mp_obj._trained
        out["malt_train"] = r3
        with envctx(FAKE_JAVA_RC="3"):
            out["malt_train_fail"] = err(lambda: mp_obj.train_from_file(train_conll))

# untrusted malt dir (outside nltk_data)
malt_untrusted = mkdir("malt-outside")
for j in ["log4j.jar", "libsvm.jar", "liblinear-1.8.jar", "maltparser-1.9.2.jar"]:
    touch(os.path.join(malt_untrusted, j))
with envctx(MALT_PARSER=malt_untrusted):
    mo = mp.MaltParser()
    # sort so the first untrusted entry named in the error is deterministic.
    mo.malt_jars = sorted(mo.malt_jars)
    out["malt_untrusted_jars"] = err(lambda: mo.generate_malt_command(
        "/i", outputfilename="/o", mode="parse"))

out["malt_regex_tagger"] = mp.malt_regex_tagger()(["The", "cat", "runs", "5", "."])

# ---------------- bllip ----------------
out["bllip_ctor"] = err(lambda: bl.BllipParser())
out["bllip_unified"] = err(lambda: bl.BllipParser.from_unified_model_dir("/x"))
out["bllip_unified_this_dir"] = err(lambda: bl.BllipParser.from_unified_model_dir_this_dir())
out["bllip_ensure_ascii_ok"] = err(lambda: bl._ensure_ascii(["a", "b"]))
out["bllip_ensure_ascii_bad"] = err(lambda: bl._ensure_ascii(["a", "é"]))
unbound = object.__new__(bl.BllipParser)
out["bllip_unbound_parse"] = err(lambda: list(unbound.parse("hello world")))

# ---------------- corenlp ----------------
from nltk.parse import corenlp as cnlp

with envctx(CORENLP=None, CORENLP_MODELS=None, CLASSPATH=None):
    out["corenlp_ctor_missing"] = err(lambda: cnlp.CoreNLPServer())
corenlp_jar = touch(os.path.join(FIX, "stanford-corenlp-3.9.2.jar"))
with envctx(CORENLP_MODELS=None):
    out["corenlp_ctor_models_missing"] = err(lambda: cnlp.CoreNLPServer(
        path_to_jar=corenlp_jar, path_to_models_jar="/nonexistent-models"))
# two jars via env dir -> max() TypeError quirk
corenlp_dir = mkdir("corenlp-jars")
touch(os.path.join(corenlp_dir, "stanford-corenlp-3.9.1.jar"))
touch(os.path.join(corenlp_dir, "stanford-corenlp-3.9.2.jar"))
with envctx(CORENLP=corenlp_dir, CORENLP_MODELS=None):
    out["corenlp_two_jars"] = err(lambda: cnlp.CoreNLPServer())

# good ctor: single jar + models jar via env file paths inside trusted dir
cnlp_jar = touch(os.path.join(NLTK_DATA_FIX, "stanford-corenlp-3.9.2.jar"))
cnlp_model = touch(os.path.join(NLTK_DATA_FIX, "stanford-corenlp-3.9.2-models.jar"))
with envctx(CORENLP=cnlp_jar, CORENLP_MODELS=cnlp_model):
    srv = cnlp.CoreNLPServer()
    out["corenlp_ctor_ok"] = pnorm({
        "url": srv.url, "classpath": [rel(c) for c in srv._classpath],
        "opts": srv.corenlp_options, "java_opts": srv.java_options})
    out["corenlp_url_fmt"] = pnorm(srv.url)
# busy port -> OSError
s = socket.socket()
s.bind(("localhost", 0))
busy_port = s.getsockname()[1]
s.listen(1)
with envctx(CORENLP=cnlp_jar, CORENLP_MODELS=cnlp_model):
    out["corenlp_busy_port"] = err(lambda: cnlp.CoreNLPServer(port=busy_port))
s.close()

out["try_port"] = (lambda p: isinstance(p, int) and p > 0)(cnlp.try_port())
out["try_port_arg"] = cnlp.try_port(19999)
out["corenlp_tagtype_bad"] = err(lambda: cnlp.CoreNLPParser(tagtype="bad"))
out["corenlp_parser_annots"] = {
    "parser": cnlp.CoreNLPParser.parser_annotator,
    "dep": cnlp.CoreNLPDependencyParser.parser_annotator,
}
out["corenlp_server_err"] = str(cnlp.CoreNLPServerError(3, "boom msg"))

# ---- requests micro-shim over urllib (venv has no requests) ----
req = types.ModuleType("requests")


class _ConnErr(Exception):
    pass


class _Resp:
    def __init__(self, code, body):
        self.status_code = code
        self.content = body

    @property
    def ok(self):
        return self.status_code < 400

    def json(self, strict=True):
        return json.loads(self.content.decode("utf-8"), strict=strict)

    def raise_for_status(self):
        if not self.ok:
            raise HTTPError(f"{self.status_code} Error")


class HTTPError(Exception):
    pass
_HTTPError = HTTPError


def _do(method, url, params=None, data=None, headers=None, timeout=None):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=timeout)
        return _Resp(resp.status, resp.read())
    except urllib.error.HTTPError as e:
        return _Resp(e.code, e.read())
    except (urllib.error.URLError, ConnectionError, OSError) as e:
        raise _ConnErr(str(e))


class _Session:
    def post(self, url, params=None, data=None, headers=None, timeout=None):
        return _do("POST", url, params, data, headers, timeout)


req.Session = _Session
req.get = lambda url, **kw: _do("GET", url, **kw)
req.compat = types.SimpleNamespace(urljoin=urllib.parse.urljoin)
req.exceptions = types.SimpleNamespace(ConnectionError=_ConnErr, HTTPError=_HTTPError)
sys.modules["requests"] = req
import requests  # noqa: E402  (the shim)

# ---- localhost mock server with canned CoreNLP JSON ----
CANNED = {
    "sentences": [
        {
            "parse": "(ROOT (S (NP (NNP John)) (VP (VBZ sees) (NP (NNP Mary))) (. .)))",
            "basicDependencies": [
                {"dep": "ROOT", "governor": 0, "dependent": 2,
                 "dependentGloss": "sees", "governorGloss": "ROOT"},
                {"dep": "nsubj", "governor": 2, "dependent": 1,
                 "dependentGloss": "John", "governorGloss": "sees"},
                {"dep": "dobj", "governor": 2, "dependent": 3,
                 "dependentGloss": "Mary", "governorGloss": "sees"},
                {"dep": "punct", "governor": 2, "dependent": 4,
                 "dependentGloss": ".", "governorGloss": "sees"},
            ],
            "tokens": [
                {"index": 1, "word": "John", "originalText": "John",
                 "lemma": "John", "pos": "NNP", "ner": "PERSON",
                 "characterOffsetBegin": 0, "characterOffsetEnd": 4},
                {"index": 2, "word": "sees", "originalText": None,
                 "lemma": "see", "pos": "VBZ", "ner": "O",
                 "characterOffsetBegin": 5, "characterOffsetEnd": 9},
                {"index": 3, "word": "Mary", "originalText": "Mary",
                 "lemma": "Mary", "pos": "NNP", "ner": "PERSON",
                 "characterOffsetBegin": 10, "characterOffsetEnd": 14},
                {"index": 4, "word": ".", "originalText": ".",
                 "lemma": ".", "pos": ".", "ner": "O",
                 "characterOffsetBegin": 14, "characterOffsetEnd": 15},
            ],
        }
    ]
}

http_log = []


class _Handler(http.server.BaseHTTPRequestHandler):
    def _reply(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if isinstance(body, str):
            body = body.encode()
        self.wfile.write(body)

    def do_GET(self):
        http_log.append(["GET", self.path])
        if self.path in ("/live", "/ready"):
            self._reply(200, "ok")
        else:
            self._reply(404, "nope")

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        http_log.append(["POST", self.path,
                         self.headers.get("Content-Type"), body.decode("utf-8", "replace")])
        if body == b"LOOSE":
            self._reply(200, b'{"x": "a\x01b", "sentences": []}')
        elif body == b"FAIL":
            self._reply(500, "server error")
        else:
            self._reply(200, json.dumps(CANNED))

    def log_message(self, *a):
        pass


httpd = http.server.HTTPServer(("localhost", 0), _Handler)
http_port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
mock_url = f"http://localhost:{http_port}"

with envctx(CORENLP=cnlp_jar, CORENLP_MODELS=cnlp_model):
    srv2 = cnlp.CoreNLPServer(port=None, verbose=False)
    # srv2.url port is free; bind a second mock there for /live+/ready
    port2 = int(srv2.url.rsplit(":", 1)[1])
    httpd2 = http.server.HTTPServer(("localhost", port2), _Handler)
    threading.Thread(target=httpd2.serve_forever, daemon=True).start()
    with envctx(PATH=os.path.dirname(FAKE_JAVA) + ":" + os.environ["PATH"]):
        r = err(lambda: srv2.start())
    out["corenlp_server_start"] = r
    if r["err"] is None:
        out["corenlp_server_url"] = pnorm(srv2.url)
        with envctx(PATH=os.path.dirname(FAKE_JAVA) + ":" + os.environ["PATH"]):
            srv2.stop()
        out["corenlp_server_stopped"] = True
    I._java_bin = None
    httpd2.shutdown()

http_log.clear()
p = cnlp.CoreNLPParser(url=mock_url)
out["corenlp_raw_parse"] = err(lambda: [str(t) for t in p.raw_parse("John sees Mary.")])
pd = cnlp.CoreNLPDependencyParser(url=mock_url)
out["corenlp_dep_parse"] = err(
    lambda: [[sorted((n["address"], str(n["tag"]), str(n["rel"]),
                     str(sorted(n["deps"].values())))
              for n in next(g).nodes.values() if n["address"] is not None)]
             for g in pd.raw_parse_sents(["John sees Mary."])])
out["corenlp_tokenize"] = err(lambda: list(p.tokenize("John sees Mary.")))
out["corenlp_tag_pos"] = err(lambda: cnlp.CoreNLPParser(url=mock_url, tagtype="pos").tag(["a", "b"]))
out["corenlp_tag_ner"] = err(lambda: cnlp.CoreNLPParser(url=mock_url, tagtype="ner").tag(["a"]))
out["corenlp_make_tree"] = str(p.make_tree(CANNED["sentences"][0]))
out["corenlp_http_log"] = [e for e in http_log if e[0] == "POST"]
http_log.clear()

# strict_json: control-char body fails strict, parses lenient
out["corenlp_json_strict"] = err(lambda: p.api_call("LOOSE")["x"])
out["corenlp_json_loose"] = err(lambda: cnlp.CoreNLPParser(url=mock_url, strict_json=False).api_call("LOOSE")["x"])
out["corenlp_http_500"] = err(lambda: p.api_call("FAIL"))
http_log.clear()

# ---------------- boxer ----------------
with envctx(CANDC=None, BOXER=None):
    out["boxer_ctor"] = err(lambda: bxmod.Boxer())
    out["boxer_ctor_bindir"] = err(lambda: bxmod.Boxer(bin_dir="/nonexistent"))
# relative bin_dir w/ planted candc+boxer (non-absolute -> custom error)
relbin = os.path.join(FIX, "relproj", "bin")
os.makedirs(relbin)
touch(os.path.join(relbin, "candc")); touch(os.path.join(relbin, "boxer"))
with chdir(os.path.join(FIX, "relproj")):
    out["boxer_ctor_rel_bindir"] = err(lambda: bxmod.Boxer(bin_dir="bin"))

fakebin_dir = mkdir("boxerbin")
tool("candc", open(FAKE_CANDC).read(), dir=fakebin_dir)
tool("boxer", open(FAKE_BOXER).read(), dir=fakebin_dir)
with envctx(CANDC=fakebin_dir, BOXER=None):
    bxr = bxmod.Boxer()
    out["boxer_ctor_ok"] = {"candc": rel(bxr._candc_bin), "boxer": rel(bxr._boxer_bin),
                            "models": rel(bxr._candc_models_path)}
    out["boxer_interpret"] = err(lambda: str(bxr.interpret("The dog runs")))
    out["boxer_interpret_multi"] = err(
        lambda: [str(d) for d in bxr.interpret_multi_sents([["a"]])])
    out["boxer_call_fail"] = err(lambda: bxr._call_boxer("input"))
    # make boxer fail: overwrite with failing script
    with open(os.path.join(fakebin_dir, "boxer"), "w") as f:
        f.write("#!/bin/sh\nprintf 'oops' >&2\nexit 3\n")
    os.chmod(os.path.join(fakebin_dir, "boxer"), 0o755)
    out["boxer_call_rc"] = err(lambda: bxr.interpret("The dog runs"))

# ---------------- dot2img ----------------
DOT_SRC = "digraph G {\n0 [label=\"John\"];\n}"
with envctx(PATH="/nonexistent"):
    out["dot2img_missing"] = err(lambda: dgmod.dot2img(DOT_SRC))
dot_dir = os.path.dirname(FAKE_DOT)
with envctx(PATH=dot_dir + ":" + os.environ["PATH"]):
    out["dot2img_svg"] = err(lambda: dgmod.dot2img(DOT_SRC, "svg"))
    out["dot2img_png"] = err(lambda: dgmod.dot2img(DOT_SRC, "png"))
# non-executable dot
baddir = mkdir("baddot")
touch(os.path.join(baddir, "dot"))  # no +x
with envctx(PATH=baddir + ":/nonexistent"):
    out["dot2img_noexec"] = err(lambda: dgmod.dot2img(DOT_SRC))

# ---------------- megam/tadm ----------------
out["call_megam_str"] = err(lambda: mg.call_megam("str"))
out["call_tadm_str"] = err(lambda: td.call_tadm("str"))
with envctx(MEGAM=None, PATH="/nonexistent"):
    out["call_megam_missing"] = err(lambda: mg.call_megam([]))
with envctx(TADM=None, PATH="/nonexistent"):
    out["call_tadm_missing"] = err(lambda: td.call_tadm([]))

megam_dir = os.path.dirname(FAKE_MEGAM)
mg.config_megam(bin=FAKE_MEGAM)
with envctx(FAKE_MEGAM_ARGV=FAKE_MEGAM_ARGV):
    out["call_megam_fake"] = captured(lambda: mg.call_megam(["-x", "y"]))
    out["call_megam_argv"] = read_argv(FAKE_MEGAM_ARGV)
    with envctx(FAKE_MEGAM_RC="3"):
        out["call_megam_fail"] = captured(lambda: mg.call_megam(["a"]))
mg._megam_bin = None

td.config_tadm(bin=FAKE_TADM)
with envctx(FAKE_TADM_ARGV=FAKE_TADM_ARGV):
    out["call_tadm_fake"] = err(lambda: td.call_tadm(["-x"]))
    out["call_tadm_argv"] = read_argv(FAKE_TADM_ARGV)
td._tadm_bin = None

# train_maxent_classifier_with_megam happy path
train_toks = [({"alwayson": True, "f1": True, "f2": 2}, "A"),
              ({"alwayson": True, "f1": False, "f2": 1}, "B"),
              ({"alwayson": True, "f1": True}, "A"),
              ({"alwayson": True, "f2": 3}, "B")]
mg.config_megam(bin=FAKE_MEGAM)
with envctx(FAKE_MEGAM_ARGV=FAKE_MEGAM_ARGV):
    def _train():
        clf = mx.train_maxent_classifier_with_megam(train_toks, trace=0)
        return {"labels": sorted(clf.labels()), "weights": clf._weights.tolist(),
                "argv": read_argv(FAKE_MEGAM_ARGV)}
    out["megam_train"] = captured(_train)
out["megam_train_encoding_labels"] = err(
    lambda: mx.train_maxent_classifier_with_megam(
        train_toks, encoding="x", labels=["A"], trace=0))
mg._megam_bin = None

# TadmMaxentClassifier.train with fake tadm
td.config_tadm(bin=FAKE_TADM)
with envctx(FAKE_TADM_ARGV=FAKE_TADM_ARGV):
    def _tadm_train():
        clf = mx.TadmMaxentClassifier.train(train_toks, trace=0)
        return {"labels": sorted(clf.labels()), "weights": clf._weights.tolist(),
                "argv": read_argv(FAKE_TADM_ARGV)}
    out["tadm_train"] = err(_tadm_train)
td._tadm_bin = None

# pure helpers re-exported by the adapter
out["write_megam_file"] = io.StringIO()
buf = io.StringIO()
_benc = mx.BinaryMaxentFeatureEncoding.train(train_toks)
# train() collects labels into a set — iteration order is hash-randomized;
# sort for a deterministic labels()/label order in the pinned output.
_benc._labels = sorted(_benc._labels)
mx.write_megam_file(train_toks, _benc, buf)
out["write_megam_file"] = buf.getvalue()
out["parse_megam_weights"] = mx.parse_megam_weights(
    "0 0.5\n1 -0.5\n", 5).tolist()
buf2 = io.StringIO()
mx.write_tadm_file(train_toks, mx.TadmEventMaxentFeatureEncoding.train(train_toks), buf2)
out["write_tadm_file"] = buf2.getvalue()
out["parse_tadm_weights"] = mx.parse_tadm_weights(
    ["0.25\n", "-0.25\n"]).tolist()

print(json.dumps(out, default=str))
