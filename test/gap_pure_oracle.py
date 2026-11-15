"""Reference dump: capture stdout of every pure NLTK 3.10.3 demo target."""
import contextlib
import io
import json
import random
import sys

import nltk

assert nltk.__version__ == "3.10.3"

out = {}
errs = {}


def run(name, f):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            v = f()
        out[name] = {"text": buf.getvalue(), "ret": repr(v) if v is not None else None}
    except Exception as e:
        out[name] = {"text": buf.getvalue(), "ret": None}
        errs[name] = f"{type(e).__name__}: {e!r}"[:400]
    except SystemExit as e:
        out[name] = {"text": buf.getvalue(), "ret": None}
        errs[name] = f"SystemExit: {e.code}"


# ---------------- parse demos ----------------
from nltk.parse import chart as _chart
run("chart_demo_2", lambda: _chart.demo(choice="2", print_times=True))
run("chart_demo_6", lambda: _chart.demo(choice="6", print_times=True))
run("chart_demo_5", lambda: _chart.demo(choice="5", print_times=True))
run("chart_demo_bad", lambda: _chart.demo(choice="9", print_times=True))
run("chart_demo_grammar", lambda: _chart.demo(choice="2", print_grammar=True))

from nltk.parse import recursivedescent as _rd
run("rd_demo", lambda: _rd.demo())

from nltk.parse import shiftreduce as _sr
run("sr_demo", lambda: _sr.demo())

from nltk.parse import earleychart as _ec
run("earley_demo", lambda: _ec.demo())

from nltk.parse import featurechart as _fc
run("feature_demo", lambda: _fc.demo())
run("feature_demo_earley", lambda: _fc.demo(parser=_fc.FeatureEarleyChartParser))
run("feature_demo_td", lambda: _fc.demo(parser=_fc.FeatureTopDownChartParser))

from nltk.parse import pchart as _pc
random.seed(42)
run("pchart_demo_0", lambda: _pc.demo(choice=0, draw_parses=False, print_parses=True))
random.seed(7)
run("pchart_demo_1", lambda: _pc.demo(choice=1, draw_parses=False, print_parses=True))
run("pchart_demo_bad", lambda: _pc.demo(choice=9, draw_parses=False, print_parses=False))

from nltk.parse import viterbi as _vit
import sys as _sys
class _Stdin:
    def __init__(self, s): self.s = s
    def readline(self):
        r = self.s[0]; self.s = self.s[1:]; return r + "\n"
_stdin = _sys.stdin
try:
    _sys.stdin = _Stdin(["1"])
    run("viterbi_demo_1", lambda: _vit.demo())
    _sys.stdin = _Stdin(["2"])
    run("viterbi_demo_2", lambda: _vit.demo())
    _sys.stdin = _Stdin(["9"])
    run("viterbi_demo_bad", lambda: _vit.demo())
finally:
    _sys.stdin = _stdin

from nltk.parse import generate as _gen
run("generate_demo", lambda: _gen.demo())

from nltk.parse import dependencygraph as _dg
run("conll_demo", lambda: _dg.conll_demo())
run("conll_file_demo", lambda: _dg.conll_file_demo())
run("cycle_finding_demo", lambda: _dg.cycle_finding_demo())
run("dg_demo", lambda: _dg.demo())

from nltk.parse import nonprojectivedependencyparser as _npp
run("npp_demo", lambda: _npp.demo())
run("hall_demo", lambda: _npp.hall_demo())
run("nonprojective_conll_parse_demo", lambda: _npp.nonprojective_conll_parse_demo())
run("rule_based_demo", lambda: _npp.rule_based_demo())

from nltk.parse import projectivedependencyparser as _pdp
run("pdp_demo", lambda: _pdp.demo())
run("projective_rule_parse_demo", lambda: _pdp.projective_rule_parse_demo())
run("arity_parse_demo", lambda: _pdp.arity_parse_demo())
run("projective_prob_parse_demo", lambda: _pdp.projective_prob_parse_demo())

# ---------------- metrics / misc ----------------
from nltk.metrics import distance as _dist
run("distance_demo", lambda: _dist.demo())
from nltk.metrics import scores as _scores
run("scores_demo", lambda: _scores.demo())
from nltk.misc import sort as _sort
random.seed(0)
run("sort_demo", lambda: _sort.demo())

# ---------------- cluster ----------------
from nltk.cluster import em as _em
run("em_demo", lambda: _em.demo())
from nltk.cluster import kmeans as _km
run("kmeans_demo", lambda: _km.demo())

# ---------------- sem ----------------
from nltk.sem import evaluate as _ev
run("propdemo", lambda: _ev.prop_demo() if hasattr(_ev,"prop_demo") else _ev.propdemo())
run("prodemo_attr", lambda: _ev.prodemo())
run("propdemo_trace", lambda: _ev.propdemo(trace=1))
run("folmodel", lambda: _ev.folmodel())
run("foldemo", lambda: _ev.foldemo())
run("satdemo", lambda: _ev.satdemo())
run("evaluate_demo", lambda: _ev.demo())
run("evaluate_demo_3", lambda: _ev.demo(3))

from nltk.sem import drt as _drt
run("drt_demo", lambda: _drt.demo())
from nltk.sem import linearlogic as _ll
run("linearlogic_demo", lambda: _ll.demo())
from nltk.sem import cooper_storage as _cs
run("cooper_demo", lambda: _cs.demo())

from nltk.sem.lfg import demo_read_depgraph
run("lfg_demo_read_depgraph", demo_read_depgraph)

from nltk.tokenize.punkt import demo as _punkt_demo
_punkt_text = "I saw a man. He was tall. Did Mr. Smith go? Yes."
run("punkt_demo", lambda: _punkt_demo(_punkt_text))

from nltk.sem import util as _util
run("util_demo_default", lambda: _util.demo())
_argv = sys.argv
try:
    for nm, argv in [
        ("util_demo_e", ["DEMO", "-e"]),
        ("util_demo_m", ["DEMO", "-m", "mymodel"]),
        ("util_demo_bogus_opt", ["DEMO", "--bogus"]),
        ("util_demo_g", ["DEMO", "-g", "grammars/book_grammars/storage.fcfg"]),
        ("util_demo_T", ["DEMO", "-T"]),
    ]:
        sys.argv = argv
        errbuf = io.StringIO()
        buf2 = io.StringIO()
        try:
            with contextlib.redirect_stderr(errbuf), contextlib.redirect_stdout(buf2):
                _util.demo()
            out[nm] = {"text": buf2.getvalue(), "stderr": errbuf.getvalue(), "ret": None}
        except SystemExit as e:
            out[nm] = {"text": buf2.getvalue(), "stderr": errbuf.getvalue(), "ret": f"SystemExit:{e.code}"}
        except Exception as e:
            out[nm] = {"text": buf2.getvalue(), "stderr": errbuf.getvalue(), "ret": None}
            errs[nm] = f"{type(e).__name__}: {str(e)[:300]}"
finally:
    sys.argv = _argv

# ---------------- chunk ----------------
from nltk import chunk
text = """\
    [ the/DT little/JJ cat/NN ] sat/VBD on/IN [ the/DT mat/NN ] ./.
    [ John/NNP ] saw/VBD [the/DT cats/NNS] [the/DT dog/NN] chased/VBD ./.
    [ John/NNP ] thinks/VBZ [ Mary/NN ] saw/VBD [ the/DT cat/NN ] sit/VB on/IN [ the/DT mat/NN ]./.
    """
grammar = r"""
    NP:                   # NP stage
      {<DT>?<JJ>*<NN>}    # chunk determiners, adjectives and nouns
      {<NNP>+}            # chunk proper nouns
    """
cp = chunk.RegexpParser(grammar)
run("demo_eval", lambda: chunk.regexp.demo_eval(cp, text))

# ---------------- chat ----------------
import nltk.chat as _chat
out["chatbots_bots"] = {"text": None, "ret": [[b[0].__name__, b[1]] for b in _chat.bots]}

# ---------------- twitter ----------------
from nltk.twitter.api import TweetHandlerI, BasicTweetHandler, LocalTimezoneOffsetWithUTC, LOCAL
import tempfile, os, gzip, csv

out["basic_handler"] = {"text": None, "ret": None}
bh = BasicTweetHandler()
vals = {
    "limit": bh.limit, "counter": bh.counter, "do_stop": bh.do_stop,
    "max_id": bh.max_id, "do_continue_0": bh.do_continue(),
}
bh.counter = 20
vals["do_continue_20"] = bh.do_continue()
bh.counter = 5; bh.do_stop = True
vals["do_continue_stop"] = bh.do_continue()
out["basic_handler"]["ret"] = vals

class _TH(TweetHandlerI):
    def handle(self, data): print("handled:", data)
    def on_finish(self): pass

try:
    TweetHandlerI(limit=3)
    out["tweet_handler_abstract"] = {"text": None, "ret": "instantiated?"}
except TypeError as e:
    out["tweet_handler_abstract"] = {"text": None, "ret": f"TypeError: {e}"}

th = _TH(limit=3, upper_date_limit=(2015, 4, 2), lower_date_limit=(2015, 4, 1))
vals2 = {"startingup": th.startingup, "limit": th.limit}
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    th.check_date_limit({"created_at": "Wed Apr 01 12:00:00 +0000 2015"}, verbose=True)
vals2["in_range_stop"] = th.do_stop
th2 = _TH(limit=3, upper_date_limit=(2015, 4, 2))
with contextlib.redirect_stdout(buf):
    th2.check_date_limit({"created_at": "Wed Apr 03 12:00:00 +0000 2015"}, verbose=True)
vals2["after_upper_stop"] = th2.do_stop
vals2["stdout"] = buf.getvalue()
out["tweet_handler_i"] = {"text": None, "ret": vals2}
out["local_tz"] = {"text": None, "ret": {
    "stdoffset": str(LocalTimezoneOffsetWithUTC.STDOFFSET),
    "dstoffset": str(LocalTimezoneOffsetWithUTC.DSTOFFSET),
    "utcoffset": str(LOCAL.utcoffset(None)),
}}

# outf_writer_compat
from nltk.twitter.common import outf_writer_compat
tmp = tempfile.mkdtemp()
p1 = os.path.join(tmp, "o.csv")
w, f = outf_writer_compat(p1, "utf8", "replace")
w.writerow(["a", "b c", 1, None])
f.close()
out["outf_plain"] = {"text": None, "ret": open(p1, "rb").read().decode()}
p2 = os.path.join(tmp, "o.csv.gz")
w, f = outf_writer_compat(p2, "utf8", "replace", gzip_compress=True)
w.writerow(["x", 'y"z'])
f.close()
out["outf_gzip"] = {"text": None, "ret": gzip.open(p2, "rt").read()}

# ---------------- malt ----------------
from nltk.parse.malt import malt_regex_tagger, find_maltparser, find_malt_model, find_jars_within_path
from nltk.data import ZipFilePathPointer
tagger = malt_regex_tagger()
out["malt_regex_tagger"] = {"text": None, "ret": tagger("the cats 123 , . saw".split())}
for nm, f in [
    ("find_maltparser_abs_missing", lambda: find_maltparser("/nonexistent-xyz")),
    ("find_maltparser_rel", lambda: find_maltparser("maltparser-1.9.2")),
    ("find_malt_model_none", lambda: find_malt_model(None)),
    ("find_malt_model_missing", lambda: find_malt_model("nonexistent-xyz.mco")),
    ("find_jars_within_missing", lambda: find_jars_within_path("/nonexistent-xyz")),
]:
    try:
        out[nm] = {"text": None, "ret": f()}
    except Exception as e:
        out[nm] = {"text": None, "ret": None}
        errs[nm] = f"{type(e).__name__}: {str(e)[:250]}"

# ---------------- corenlp / internals / stanford ----------------
from nltk.parse.corenlp import try_port
from nltk.internals import find_jar_iter, find_jar, find_jars_within_path
out["try_port"] = {"text": None, "ret": None}
try:
    p = try_port()
    out["try_port"]["ret"] = {"port_int": isinstance(p, int), "gt0": p > 0}
except Exception as e:
    errs["try_port"] = f"{type(e).__name__}: {e}"

import re
for nm, f in [
    ("find_jar_missing", lambda: find_jar("nonexistent-xyz.jar", env_vars=("NONEXISTENT_XYZ",), searchpath=("/nonexistent-dir-xyz",), url="http://x")),
    ("find_jar_iter_classpath", lambda: list(find_jar_iter("nltk-test.jar"))),
    ("find_jars_within_path_missing", lambda: find_jars_within_path("/nonexistent-xyz")),
]:
    try:
        out[nm] = {"text": None, "ret": f()}
    except Exception as e:
        out[nm] = {"text": None, "ret": None}
        errs[nm] = f"{type(e).__name__}: {str(e)[:400]}"

# try_port on occupied port
import socket
s = socket.socket(); s.bind(("localhost", 0)); s.listen(1)
occupied = s.getsockname()[1]
try:
    try_port(occupied)
    out["try_port_occupied"] = {"text": None, "ret": "no error?"}
except OSError as e:
    out["try_port_occupied"] = {"text": None, "ret": f"OSError: {e.errno}: {e.strerror}"}
s.close()


from nltk.stem.porter import demo as _porter_demo
run("porter_demo", _porter_demo)

from nltk.tag import tnt as _tnt
run("tnt_demo", lambda: _tnt.demo())
run("tnt_demo_errors", lambda: _tnt.demo_errors())

from nltk.chat import eliza as _eliza, iesha as _iesha, rude as _rude, suntsu as _suntsu, zen as _zen
_stdin = sys.stdin
try:
    sys.stdin = io.StringIO("hello\n")
    random.seed(0); run("chat_eliza_demo", _eliza.demo)
    random.seed(0); run("chat_iesha_demo", _iesha.demo)
    random.seed(0); run("chat_rude_demo", _rude.demo)
    random.seed(0); run("chat_suntsu_demo", _suntsu.demo)
    random.seed(0); run("chat_zen_demo", _zen.demo)
finally:
    sys.stdin = _stdin

from nltk.cluster import gaac as _gaac
run("gaac_demo", _gaac.demo)

from nltk.misc import wordfinder as _wf
random.seed(0); run("word_finder_demo", _wf.word_finder)

# ---------------- tbl demos (nltk.tbl.demo) ----------------
# Template.ALLTEMPLATES accumulates across the process in python — each key
# resets the registry so outputs equal a fresh-process run.
from nltk.tbl import demo as _tbl
from nltk.tbl.template import Template as _Tpl


def tblrun(name, f):
    _Tpl._cleartemplates()
    run(name, f)


tblrun("tbl_demo", _tbl.demo)
tblrun("tbl_demo_repr", _tbl.demo_repr_rule_format)
tblrun("tbl_demo_str", _tbl.demo_str_rule_format)
tblrun("tbl_demo_verbose", _tbl.demo_verbose_rule_format)
tblrun("tbl_demo_multipos", _tbl.demo_multiposition_feature)
tblrun("tbl_demo_multifeat", _tbl.demo_multifeature_template)
tblrun("tbl_demo_template_stats", _tbl.demo_template_statistics)
tblrun("tbl_demo_generated", _tbl.demo_generated_templates)
tblrun("tbl_demo_high_accuracy", _tbl.demo_high_accuracy_rules)
tblrun("tbl_demo_learning_curve", _tbl.demo_learning_curve)


def tblfile(name, f, files):
    _Tpl._cleartemplates()
    d = tempfile.mkdtemp()
    cwd = os.getcwd()
    buf = io.StringIO()
    try:
        os.chdir(d)
        with contextlib.redirect_stdout(buf):
            f()
    except Exception as e:
        errs[name] = f"{type(e).__name__}: {e!r}"[:400]
    finally:
        os.chdir(cwd)
    out[name] = {
        "text": buf.getvalue(),
        "ret": None,
        "files": {
            p: open(os.path.join(d, p), "rb").read().decode("utf-8", "replace")
            for p in files
            if os.path.exists(os.path.join(d, p))
        },
    }


tblfile("tbl_demo_error_analysis", _tbl.demo_error_analysis, ["errors.txt"])
tblfile("tbl_demo_serialize", _tbl.demo_serialize_tagger, ["tagger.pcl"])

# ---------------- hmm demos (nltk.tag.hmm) ----------------
import nltk.tag.hmm as _hmm

run("hmm_demo", _hmm.demo)
run("hmm_demo_pos", _hmm.demo_pos)
run("hmm_demo_bw", _hmm.demo_bw)
run("hmm_demo_pos_bw", _hmm.demo_pos_bw)

# ---------------- toolbox demo (nltk.toolbox) ----------------
import nltk.toolbox as _tb
run("toolbox_demo", _tb.demo)

# ---------------- snowball demo (nltk.stem.snowball) ----------------
import builtins as _builtins
import nltk.stem.snowball as _sb

def _snowball_demo_inputs(seq):
    it = iter(seq)
    def f():
        orig = _builtins.input
        _builtins.input = lambda p="": (print(p, end=""), next(it))[1]
        try:
            _sb.demo()
        finally:
            _builtins.input = orig
    return f

run("snowball_demo_en", _snowball_demo_inputs(["bogus", "english", "exit"]))
run("snowball_demo_fr", _snowball_demo_inputs(["french", "exit"]))

print(json.dumps({"out": out, "errs": errs}))
