"""Pinned oracle for excluded-module closures (NLTK 3.10.3)."""
import json
import sys

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"

from nltk.chat.util import Chat
from nltk.chat.eliza import pairs as eliza_pairs
from nltk.chat.zen import responses as zen_pairs
from nltk.chat.util import reflections
from nltk.toolbox import (
    ToolboxData, ToolboxSettings, to_sfm_string, to_settings_string,
    remove_blanks, add_default_fields, sort_fields, add_blank_lines,
)
from nltk.twitter.common import (
    extract_fields, get_header_field_list, json2csv, json2csv_entities,
)
from nltk.downloader import Package, Collection, md5_hexdigest, sha256_hexdigest
from nltk.compat import add_py3_data, py3_data
import io, os, csv, tempfile

out = {}

# --- Chat.respond: single-response patterns are deterministic.
pairs = [
    (r"you are (.*)", ["Why do you think I am %1?"]),
    (r"hello", ["Hi there."]),
]
c = Chat(pairs, reflections)
out["chat"] = {
    "resp1": c.respond("you are sure"),
    "resp2": c.respond("hello"),
    "noMatch": c.respond("zzz no match"),
    "reflSub": c.respond("you are very nice and I am happy"),
}
# converse with scripted input
c2 = Chat(pairs, reflections)
convo = []
inputs = iter(["you are mad!", "hello", "quit"])
import builtins
orig_input = builtins.input
builtins.input = lambda prompt="": next(inputs)
import contextlib
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    c2.converse()
builtins.input = orig_input
out["chat"]["converse"] = buf.getvalue()

# --- toolbox parse + to_sfm_string + settings
SFM = "\\_sh v3.0  400  Rotokas\n\\lx kaa\n\\ps V.A\n\\ge gag\n\n\\lx kaa\n\\ps V.B\n\\ge strangle\n"
d = ToolboxData()
d.open_string(SFM)
p = d.parse()
recs = p.findall("record")
out["toolbox"] = {
    "records": len(recs),
    "lx0": recs[0].findall("lx")[0].text,
    "header_sh": p.find("header").find("_sh").text,
    "sfm": to_sfm_string(p),
    "tags": [[ch.tag for ch in r] for r in recs],
}

# settings: nested +/- blocks
SET = "\\+mkrOverThis lx\n\\mkrOverThis lx\n\\+lngDefault English\n\\lngDefault English\n\\-lngDefault\n\\-mkrOverThis\n"
s = ToolboxSettings()
s.open_string(SET)
st = s.parse()
def ser(el, depth=0):
    return {"tag": el.tag, "text": el.text, "kids": [ser(c) for c in el]}
out["toolbox"]["settings_tree"] = ser(st)
class EW:
    def __init__(self, root): self._r = root
    def getroot(self): return self._r
out["toolbox"]["settings_str"] = to_settings_string(EW(st))

# helpers
from xml.etree.ElementTree import Element, SubElement
root = Element("record")
SubElement(root, "lx").text = "x"
SubElement(root, "ge")
SubElement(root, "ps").text = "n"
def snap(el):
    return [{"tag": c.tag, "text": c.text} for c in el]
out["toolbox"]["before_rm"] = snap(root)
remove_blanks(root)
out["toolbox"]["after_rm"] = snap(root)
r2 = Element("record")
SubElement(r2, "ps").text = "n"
SubElement(r2, "ge").text = "g"
add_default_fields(r2, {"record": ("lx", "ps", "ge")})
out["toolbox"]["default_fields"] = [c.tag for c in r2]
r3 = Element("record")
for t in ("ge", "ps", "lx"):
    SubElement(r3, t)
sort_fields(r3, {"record": ("lx", "ps", "ge")})
out["toolbox"]["sorted"] = [c.tag for c in r3]

# --- twitter common
tweet = {"id": 1, "text": "hello, world", "user": {"id": 9},
         "entities": {"hashtags": [{"text": "a"}, {"text": "b"}]}}
out["twitter"] = {
    "extract": extract_fields(tweet, ["id", "text", "user.id"]),
    "header": get_header_field_list(["id"], "hashtags", ["text"]),
    "header_composed": get_header_field_list(["id"], "user.urls", ["url"]),
}
tmp = tempfile.mkdtemp()
jfile = os.path.join(tmp, "t.csv")
with io.StringIO('{"id": 1, "text": "hello, world", "user": {"id": 9}}\n{"id": 2, "text": "t\\"q\\"", "user": {"id": 3}}\n') as fp:
    json2csv(fp, jfile, ["id", "text", "user.id"])
out["twitter"]["csv"] = open(jfile).read()
j2 = os.path.join(tmp, "e.csv")
with io.StringIO('{"id": 1, "entities": {"hashtags": [{"text": "a"}, {"text": "b"}]}}\n') as fp:
    json2csv_entities(fp, j2, ["id"], "hashtags", ["text"])
out["twitter"]["csv_ent"] = open(j2).read()

# --- downloader value layer
from xml.etree.ElementTree import fromstring as _ets
pkg = Package.fromxml(_ets('<package id="stopwords" url="https://x/stopwords.zip" subdir="corpora" size="100" unzipped_size="300" checksum="abc" unzip="1"/>'))
out["dl"] = {
    "pkg": {k: getattr(pkg, k) for k in ("id", "name", "subdir", "url", "size", "unzipped_size", "checksum", "unzip", "filename", "author", "license")},
    "repr": repr(pkg),
}
col = Collection.fromxml(_ets('<collection id="all"><item ref="stopwords"/><item ref="punkt"/></collection>'))
out["dl"]["col"] = {"id": col.id, "name": col.name, "children": col.children, "repr": repr(col)}
md5file = os.path.join(tmp, "m.bin")
open(md5file, "wb").write(b"nltk")
out["dl"]["md5"] = md5_hexdigest(md5file)
out["dl"]["sha256"] = sha256_hexdigest(md5file)

# id/subdir validation errors
for label, kw in [
    ("bad_subdir", dict(id="x", url="u", subdir="..", size="1", unzipped_size="1")),
    ("bad_id", dict(id="a/b", url="u", size="1", unzipped_size="1")),
]:
    try:
        Package(**kw)
        out["dl"][label] = None
    except Exception as e:
        out["dl"][label] = type(e).__name__

# --- compat
out["compat"] = {
    "add_py3": add_py3_data("corpora/x.zip/foo"),
    "py3": py3_data(lambda a, b: b)("p", "corpora/x.zip/foo"),
}

print(json.dumps(out, sort_keys=True))
