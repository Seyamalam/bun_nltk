"""Pinned oracle for nltk.downloader (NLTK 3.10.3).

Builds a private local data-server tree under $DL_ROOT (created 0o700 by the
test harness; $NLTK_DATA must point at the same root so pathsec authorizes
file:// access), runs downloader scenarios against file:// URLs, and emits
one JSON object on the last stdout line.

The fixture contains: valid zips (stored + deflated, one multi-block >32KiB),
an unzip=0 package, a non-"corpora" subdir package, nested collections with a
missing member plus consecutive missing members (enumerate-delete quirk), and
hand-injected index entries for corrupt / bad-md5 / bad-size / cross-package
zips that build_index itself would reject.
"""
import contextlib
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import warnings
import zipfile
from xml.etree import ElementTree

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"
import nltk.downloader as dlmod
from nltk.downloader import (
    Downloader, Package, Collection, build_index, unzip, md5_hexdigest,
    sha256_hexdigest,
)

ROOT = os.environ["DL_ROOT"]
SRV = os.path.join(ROOT, "server")
DL = os.path.join(ROOT, "dl")
DL2 = os.path.join(ROOT, "dl2")
INDEX_URL = f"file://{SRV}/index.xml"
BASE_URL = f"file://{SRV}/packages"

out = {}


def err(f):
    try:
        return {"err": None, "val": f()}
    except Exception as e:
        # 0xADDR: object-repr messages embed a per-process memory address.
        msg = re.sub(r"0x[0-9a-fA-F]+", "0xADDR", str(e)[:400])
        return {"err": f"{type(e).__name__}:{msg}", "val": None}


def cap_stdout(f):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rv = f()
    return {"rv": rv, "out": buf.getvalue()}


def cap_dl(f, *a, **k):
    """Capture a download(): rv + stdout + the print_error_to stream + error."""
    outb, dlb = io.StringIO(), io.StringIO()
    k.setdefault("print_error_to", dlb)
    try:
        with contextlib.redirect_stdout(outb):
            rv = f(*a, **k)
        return {"rv": rv, "stdout": outb.getvalue(), "derr": dlb.getvalue(), "err": None}
    except Exception as e:
        return {"rv": None, "stdout": outb.getvalue(), "derr": dlb.getvalue(),
                "err": f"{type(e).__name__}:{str(e)[:400]}"}


def cap_fd_stderr(f):
    """Capture writes to real fd 2 — needed where print_error_to keeps the
    def-time sys.stderr binding (update(), retry recursion)."""
    saved = os.dup(2)
    tmpf = tempfile.TemporaryFile(mode="w+b")
    try:
        os.dup2(tmpf.fileno(), 2)
        rv = f()
    finally:
        os.dup2(saved, 2)
        os.close(saved)
        tmpf.seek(0)
        data = tmpf.read().decode("utf-8")
        tmpf.close()
    return {"rv": rv, "stderr": data}


def cap_warnings(f):
    with warnings.catch_warnings(record=True) as ws:
        warnings.simplefilter("always")
        rv = f()
    return {"rv": rv, "warnings": [f"{type(w.message).__name__}:{w.message}" for w in ws]}


def msgs(f):
    seq = []
    try:
        for m in f():
            pkg = getattr(m, "package", None)
            col = getattr(m, "collection", None)
            seq.append({
                "t": type(m).__name__,
                "progress": getattr(m, "progress", None),
                "pkg": getattr(pkg, "id", pkg),
                "col": getattr(col, "id", col),
                "msg": getattr(m, "message", None),
                "dir": getattr(m, "download_dir", None),
            })
        return {"seq": seq, "err": None}
    except Exception as e:
        return {"seq": seq, "err": f"{type(e).__name__}:{str(e)[:400]}"}


def snapshot(base):
    """Sorted relpath -> sha256 (files) or '<dir>' for every entry under base."""
    entries = {}
    if not os.path.exists(base):
        return entries
    for dirpath, dirnames, filenames in os.walk(base):
        for d in dirnames:
            p = os.path.join(dirpath, d)
            entries[os.path.relpath(p, base)] = "<dir>"
        for f in filenames:
            p = os.path.join(dirpath, f)
            entries[os.path.relpath(p, base)] = hashlib.sha256(
                open(p, "rb").read()).hexdigest()
    return entries


def statuses(d, ids, ddir):
    return {i: {"status": d.status(i, ddir),
                "installed": d.is_installed(i, ddir),
                "stale": d.is_stale(i, ddir)} for i in ids}


# ---------------------------------------------------------------------------
# Fixture tree
# ---------------------------------------------------------------------------

for d in [SRV, f"{SRV}/packages", f"{SRV}/packages/corpora",
          f"{SRV}/packages/taggers", f"{SRV}/collections", DL, DL2]:
    os.makedirs(d, exist_ok=True)
    os.chmod(d, 0o700)  # is_private_dir for _authorize_data_dir

PACK = f"{SRV}/packages/corpora"
PTAG = f"{SRV}/packages/taggers"
COLL = f"{SRV}/collections"


def wzip(path, members, compression=zipfile.ZIP_STORED):
    with zipfile.ZipFile(path, "w", compression) as z:
        for name, data in members:
            z.writestr(name, data)


def wfile(path, data):
    mode = "wb" if isinstance(data, bytes) else "w"
    with open(path, mode) as f:
        f.write(data)


# valid packages (corpora): stored + deflated + >32KiB multi-block + unzip=0
wzip(f"{PACK}/abc.zip", [("abc/file.txt", "hello abc\n"),
                         ("abc/inner/deep.txt", "deep\n")])
wfile(f"{PACK}/abc.xml",
      '<package id="abc" name="ABC Corpus" license="CC-BY" author="Joe &amp; Jane" '
      'webpage="https://x/abc?a=1&amp;b=2" contact="j@x" copyright="(c) 2024" '
      'unzip="1" svn_revision="42" provides="abc,abc2" size="999" '
      f'url="{BASE_URL}/corpora/abc.zip"/>')

wzip(f"{PACK}/big.zip", [("big/blob.txt", "x" * 40000)],
     compression=zipfile.ZIP_DEFLATED)
wfile(f"{PACK}/big.xml", '<package id="big" name="Big Corpus" unzip="1"/>')

wzip(f"{PACK}/rawdata.zip", [("rawdata/x.txt", "x" * 50)],
     compression=zipfile.ZIP_DEFLATED)
wfile(f"{PACK}/rawdata.xml", '<package id="rawdata" name="Raw Data" unzip="0"/>')

# model package (non-corpora subdir)
wzip(f"{PTAG}/tagger.zip", [("tagger/m.bin", b"\x00\x01\x02" * 100)])
wfile(f"{PTAG}/tagger.xml", '<package id="tagger" name="Tag Model" unzip="1"/>')

# orphan zip without xml -> build_index warning
wzip(f"{PACK}/orphan.zip", [("orphan/o.txt", "o")])

# collections: nested + missing member + consecutive missing members
wfile(f"{COLL}/mini.xml",
      '<collection id="mini" name="Mini Collection">'
      '<item ref="abc"/><item ref="rawdata"/><item ref="big"/></collection>')
wfile(f"{COLL}/all.xml",
      '<collection id="all" name="All Collection">'
      '<item ref="mini"/><item ref="tagger"/><item ref="ghost"/></collection>')
wfile(f"{COLL}/all2.xml",
      '<collection id="all2" name="Consecutive Ghosts">'
      '<item ref="ghostA"/><item ref="ghostB"/></collection>')

# build_index over the clean tree
with warnings.catch_warnings(record=True) as _ws:
    warnings.simplefilter("always")
    _built = build_index(SRV, BASE_URL)
    out["build_index_warnings"] = [f"{type(w.message).__name__}:{w.message}" for w in _ws]
index_xml = ElementTree.tostring(_built, encoding="unicode")
out["index_xml"] = index_xml

# entries build_index would refuse to emit — corrupt zip, checksum/size
# mismatches, and a cross-package zip (members outside its own dir).
wfile(f"{PACK}/corrupt.zip", b"this is not a zip file at all, just bytes")
shutil.copyfile(f"{PACK}/abc.zip", f"{PACK}/badmd5.zip")
shutil.copyfile(f"{PACK}/abc.zip", f"{PACK}/badsize.zip")
shutil.copyfile(f"{PACK}/abc.zip", f"{PACK}/md5only.zip")
wzip(f"{PACK}/sneaky.zip", [("other/x.txt", "x")])


def hexd(p, algo):
    h = hashlib.new(algo)
    with open(p, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


extra = []
extra.append(f'<package id="corrupt" name="corrupt pkg" unzip="1" subdir="corpora" '
             f'size="{os.path.getsize(f"{PACK}/corrupt.zip")}" '
             f'unzipped_size="1" checksum="{hexd(f"{PACK}/corrupt.zip", "md5")}" '
             f'sha256_checksum="{hexd(f"{PACK}/corrupt.zip", "sha256")}" '
             f'url="{BASE_URL}/corpora/corrupt.zip"/>')
extra.append(f'<package id="badmd5" name="badmd5 pkg" unzip="1" subdir="corpora" '
             f'size="{os.path.getsize(f"{PACK}/badmd5.zip")}" '
             f'unzipped_size="1" checksum="{"0" * 32}" '
             f'url="{BASE_URL}/corpora/badmd5.zip"/>')
extra.append(f'<package id="badsize" name="badsize pkg" unzip="1" subdir="corpora" '
             f'size="{os.path.getsize(f"{PACK}/badsize.zip") + 1}" '
             f'unzipped_size="1" checksum="{hexd(f"{PACK}/badsize.zip", "md5")}" '
             f'sha256_checksum="{hexd(f"{PACK}/badsize.zip", "sha256")}" '
             f'url="{BASE_URL}/corpora/badsize.zip"/>')
extra.append(f'<package id="md5only" name="md5only pkg" unzip="1" subdir="corpora" '
             f'size="{os.path.getsize(f"{PACK}/md5only.zip")}" '
             f'unzipped_size="1" checksum="{hexd(f"{PACK}/md5only.zip", "md5")}" '
             f'url="{BASE_URL}/corpora/md5only.zip"/>')
extra.append(f'<package id="sneaky" name="sneaky pkg" unzip="1" subdir="corpora" '
             f'size="{os.path.getsize(f"{PACK}/sneaky.zip")}" '
             f'unzipped_size="1" checksum="{hexd(f"{PACK}/sneaky.zip", "md5")}" '
             f'sha256_checksum="{hexd(f"{PACK}/sneaky.zip", "sha256")}" '
             f'url="{BASE_URL}/corpora/sneaky.zip"/>')

final_xml = index_xml.replace("</packages>", "".join(extra) + "</packages>")
wfile(f"{SRV}/index.xml", final_xml)
out["final_index_xml"] = final_xml

# build_index error mini-trees ------------------------------------------------
BE = os.path.join(ROOT, "bi_err")
os.makedirs(f"{BE}/packages/corpora", exist_ok=True)
os.chmod(BE, 0o700); os.chmod(f"{BE}/packages", 0o700); os.chmod(f"{BE}/packages/corpora", 0o700)
wzip(f"{BE}/packages/corpora/mismatch.zip", [("mismatch/x.txt", "x")])
wfile(f"{BE}/packages/corpora/mismatch.xml", '<package id="other" size="1" unzipped_size="1"/>')
out["bi_err_mismatch"] = err(lambda: build_index(BE, "file:///x"))

BE2 = os.path.join(ROOT, "bi_err2")
os.makedirs(f"{BE2}/packages/corpora", exist_ok=True)
os.chmod(BE2, 0o700); os.chmod(f"{BE2}/packages", 0o700); os.chmod(f"{BE2}/packages/corpora", 0o700)
wfile(f"{BE2}/packages/corpora/nozip.xml", '<package id="nozip" size="1" unzipped_size="1"/>')
out["bi_err_nozip"] = err(lambda: build_index(BE2, "file:///x"))

BE3 = os.path.join(ROOT, "bi_err3")
os.makedirs(f"{BE3}/packages/corpora", exist_ok=True)
os.chmod(BE3, 0o700); os.chmod(f"{BE3}/packages", 0o700); os.chmod(f"{BE3}/packages/corpora", 0o700)
wzip(f"{BE3}/packages/corpora/nosub.zip", [("other/x.txt", "x"), ("nosub/y.txt", "y")])
wfile(f"{BE3}/packages/corpora/nosub.xml", '<package id="nosub" size="1" unzipped_size="1"/>')
out["bi_err_nosubdir"] = err(lambda: build_index(BE3, "file:///x"))

BE4 = os.path.join(ROOT, "bi_err4")
os.makedirs(f"{BE4}/packages/corpora", exist_ok=True)
os.makedirs(f"{BE4}/collections", exist_ok=True)
for _d in [BE4, f"{BE4}/packages", f"{BE4}/packages/corpora", f"{BE4}/collections"]:
    os.chmod(_d, 0o700)
wzip(f"{BE4}/packages/corpora/dup.zip", [("dup/x.txt", "x")])
wfile(f"{BE4}/packages/corpora/dup.xml", '<package id="dup" size="1" unzipped_size="1"/>')
wfile(f"{BE4}/collections/dup.xml", '<collection id="dup"><item ref="dup"/></collection>')
out["bi_err_dupuid"] = err(lambda: build_index(BE4, "file:///x"))

# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------

d = Downloader(INDEX_URL)

# S1 index load: ghost removal message goes to stdout (once).
_r = cap_stdout(lambda: (d.packages(), d.collections()))
out["index_load"] = {"stdout": _r["out"]}

PKGIDS = sorted(p.id for p in d.packages())
out["pkg_ids"] = PKGIDS
out["coll_ids"] = sorted(c.id for c in d.collections())
out["corpora_ids"] = sorted(p.id for p in d.corpora())
out["models_ids"] = sorted(p.id for p in d.models())


def pkg_ser(p):
    return {"repr": repr(p), "str": str(p), "id": p.id, "name": p.name,
            "subdir": p.subdir, "size": p.size, "unzipped_size": p.unzipped_size,
            "checksum": p.checksum, "sha256": getattr(p, "sha256_checksum", None),
            "url": p.url, "license": p.license, "author": p.author,
            "copyright": p.copyright, "contact": p.contact,
            "webpage": getattr(p, "webpage", None),
            "provides": getattr(p, "provides", None),
            "svn_revision": getattr(p, "svn_revision", None),
            "extra": getattr(p, "extra", None),
            "unzip": p.unzip, "filename": p.filename}


out["pkgs"] = [pkg_ser(p) for p in d.packages()]
out["colls"] = [{
    "repr": repr(c), "id": c.id, "name": c.name,
    "children": [f"{type(ch).__name__}:{getattr(ch, 'id', ch)}" for ch in c.children],
    "packages": [p.id for p in c.packages],
} for c in d.collections()]

out["info_abc"] = pkg_ser(d.info("abc"))
out["info_err"] = err(lambda: d.info("nope"))
out["xmlinfo_abc"] = ElementTree.tostring(d.xmlinfo("abc"), encoding="unicode")
out["index_str"] = str(d.index())

ALL_IDS = ["abc", "big", "rawdata", "tagger", "corrupt", "badmd5", "badsize",
           "md5only", "sneaky", "mini", "all", "all2"]

out["statuses_before"] = statuses(d, ALL_IDS, DL)
out["status_abc_default"] = d.status("abc")

_r = cap_stdout(lambda: d.list(download_dir=DL))
out["list_out"] = _r["out"]

# fresh incr_download("abc", DL) — records messages AND downloads abc.
out["msgs_fresh"] = msgs(lambda: d.incr_download("abc", DL))
out["snapshot_abc"] = snapshot(DL)
out["statuses_after_abc"] = {
    "abc": statuses(d, ["abc"], DL)["abc"],
    "abc_default": d.status("abc"),
    "mini_dl": d.status("mini", DL),
    "mini_default": d.status("mini"),
}

out["dl_abc_again"] = cap_dl(d.download, "abc", DL)
out["dl_abc_force"] = cap_dl(d.download, "abc", DL, force=True)
out["dl_abc_quiet"] = cap_dl(d.download, "abc", DL, quiet=True, force=True)
out["msgs_uptodate"] = msgs(lambda: d.incr_download("abc", DL))

out["dl_coll_mini"] = cap_dl(d.download, "mini", DL)
out["dl_coll_all"] = cap_dl(d.download, "all", DL)
out["statuses_after_colls"] = statuses(d, ALL_IDS, DL)

out["dl_nope"] = cap_dl(d.download, "nope", DL)
out["dl_nope_raise"] = cap_dl(d.download, "nope", DL, raise_on_error=True)
out["dl_nope_nohalt_quiet"] = cap_dl(d.download, "nope", DL, halt_on_error=False, quiet=True)

out["dl_corrupt"] = cap_dl(d.download, "corrupt", DL)
out["dl_badmd5"] = cap_dl(d.download, "badmd5", DL)
out["dl_badsize"] = cap_dl(d.download, "badsize", DL)
out["dl_sneaky"] = cap_dl(d.download, "sneaky", DL)
out["dl_all2"] = cap_dl(d.download, "all2", DL)

out["dl_list_input"] = cap_dl(d.download, ["big", "rawdata"], DL)
out["msgs_coll_list"] = msgs(lambda: d.incr_download(["mini", "tagger"], DL))
out["msgs_corrupt"] = msgs(lambda: d.incr_download("corrupt", DL))
out["msgs_nope"] = msgs(lambda: d.incr_download("nope", DL))

# SelectDownloadDirMessage + download into the default dir (root).
d2 = Downloader(INDEX_URL)
out["msgs_default_dir"] = msgs(lambda: d2.incr_download("rawdata"))
out["rawdata_default_status"] = d2.status("rawdata")
out["dl_default_dir_prop"] = d2.download_dir

# default print_error_to route is real stderr (def-time binding quirk).
out["dl_default_stderr"] = cap_fd_stderr(lambda: d.download("big", DL))

# status-cache / unzipped-state edges ----------------------------------------
# zip present, unzipdir removed -> NOT_INSTALLED (zip-only check quirk)
shutil.rmtree(f"{DL}/corpora/abc")
out["status_unzipdir_gone"] = statuses(d, ["abc", "rawdata"], DL)
out["dl_abc_reunzip"] = cap_dl(d.download, "abc", DL)

# unzipdir replaced by a file -> STALE -> download hits extraction error
shutil.rmtree(f"{DL}/corpora/abc")
wfile(f"{DL}/corpora/abc", "i am a file, not a dir")
out["status_unzipdir_file"] = statuses(d, ["abc"], DL)
out["dl_abc_unzipdir_file"] = cap_dl(d.download, "abc", DL)
# cleanup: remove the file + the stale zip so the final snapshot is stable
os.remove(f"{DL}/corpora/abc")
os.remove(f"{DL}/corpora/abc.zip")

# dl2 hand-built states -------------------------------------------------------
os.makedirs(f"{DL2}/corpora", exist_ok=True); os.chmod(f"{DL2}/corpora", 0o700)
# zip only, unzip=1 -> NOT_INSTALLED
shutil.copyfile(f"{SRV}/packages/corpora/big.zip", f"{DL2}/corpora/big.zip")
# zip only, unzip=0 -> INSTALLED
shutil.copyfile(f"{SRV}/packages/corpora/rawdata.zip", f"{DL2}/corpora/rawdata.zip")
# wrong size -> STALE
wfile(f"{DL2}/corpora/badsize.zip", b"tiny")
# size ok, checksum wrong -> STALE. Zip bytes are timestamped, so the same
# file is staged under fixtures/ and copied by both oracle and JS replay.
os.makedirs(f"{ROOT}/fixtures", exist_ok=True)
wzip(f"{ROOT}/fixtures/badmd5.zip", [("badmd5/z.txt", "different bytes")])
shutil.copyfile(f"{ROOT}/fixtures/badmd5.zip", f"{DL2}/corpora/badmd5.zip")
# md5-only entry, file correct -> INSTALLED + RuntimeWarning once
shutil.copyfile(f"{SRV}/packages/corpora/md5only.zip", f"{DL2}/corpora/md5only.zip")
# unzipped_size mismatch -> STALE
shutil.copyfile(f"{SRV}/packages/taggers/tagger.zip", f"{DL2}/corpora/tagger.zip")
os.makedirs(f"{DL2}/corpora/tagger", exist_ok=True)
wfile(f"{DL2}/corpora/tagger/m.bin", b"wrong")

_w1 = cap_warnings(lambda: d.status("md5only", DL2))
_w2 = cap_warnings(lambda: d.status("md5only", DL2))
out["dl2_statuses"] = statuses(d, ["big", "rawdata", "badsize", "badmd5", "md5only", "tagger"], DL2)
out["warn_md5_first"] = _w1
out["warn_md5_second"] = _w2

# unzip=0 in dl2 (zip already present + no extract dir) -> UpToDate, still
# INSTALLED. Fresh unzip=0 download goes to dl4 instead.
DL4 = os.path.join(ROOT, "dl4")
os.makedirs(DL4, exist_ok=True); os.chmod(DL4, 0o700)
out["dl2_rawdata"] = cap_dl(d.download, "rawdata", DL2)
out["dl4_rawdata"] = cap_dl(d.download, "rawdata", DL4)
out["dl4_rawdata_status"] = statuses(d, ["rawdata"], DL4)

# update(): corrupt dl/abc.zip -> STALE -> re-download only that one.
wfile(f"{DL}/corpora/abc.zip", b"garbage-not-the-real-zip")
out["status_abc_stale"] = statuses(d, ["abc"], DL)
d.download_dir = DL
out["update_stderr"] = cap_fd_stderr(lambda: d.update())
out["status_abc_post_update"] = statuses(d, ["abc"], DL)

# list variants ---------------------------------------------------------------
out["list_skip_installed"] = cap_stdout(
    lambda: d.list(download_dir=DL, skip_installed=True))["out"]
out["list_pkgs_only"] = cap_stdout(
    lambda: d.list(download_dir=DL, show_collections=False))["out"]
out["list_colls_only"] = cap_stdout(
    lambda: d.list(download_dir=DL, show_packages=False))["out"]

# unzip() module function -----------------------------------------------------
DL3 = os.path.join(ROOT, "dl3")
os.makedirs(DL3, exist_ok=True); os.chmod(DL3, 0o700)
out["unzip_verbose"] = cap_stdout(
    lambda: unzip(f"{SRV}/packages/corpora/abc.zip", DL3, verbose=True))
out["unzip_verbose_files"] = snapshot(DL3)
out["unzip_corrupt"] = err(
    lambda: unzip(f"{SRV}/packages/corpora/corrupt.zip", DL3, verbose=False))

SLIP = f"{ROOT}/slip.zip"
wzip(SLIP, [("../evil.txt", "e"), ("ok/x.txt", "x")])
out["unzip_slip"] = err(lambda: unzip(SLIP, DL3, verbose=False))
out["unzip_slip_files"] = snapshot(DL3)

# Package / Collection object behavior ----------------------------------------
out["pkg_ctor_badid"] = err(lambda: Package(id="a/b", url="u", size="1", unzipped_size="1"))
out["pkg_ctor_badsubdir"] = err(lambda: Package(id="x", url="u", size="1", unzipped_size="1", subdir=".."))
out["pkg_ctor_nosize"] = err(lambda: Package(id="x", url="u"))
out["pkg_fromxml"] = pkg_ser(Package.fromxml(ElementTree.fromstring(
    '<package id="px" url="u/px.zip" size="5" unzipped_size="9" checksum="c" '
    'unzip="0" extra="E" webpage="w"/>')))
_cx = Collection.fromxml(ElementTree.fromstring(
    '<collection id="cx"><item ref="a"/><item ref="b"/></collection>'))
out["coll_fromxml"] = {"id": _cx.id, "children": _cx.children, "name": _cx.name}
out["pkg_repr_coll"] = repr(d._collections["all"])

# checksum helpers ------------------------------------------------------------
out["md5_abc"] = md5_hexdigest(f"{SRV}/packages/corpora/abc.zip")
out["sha256_abc"] = sha256_hexdigest(f"{SRV}/packages/corpora/abc.zip")

# props -----------------------------------------------------------------------
out["default_download_dir"] = d.default_download_dir()
out["url_get"] = d.url
out["download_dir_prop"] = d.download_dir

# url setter: repoint at a different index (same contents), verify reload.
SRV2 = f"{ROOT}/server2"
os.makedirs(SRV2, exist_ok=True); os.chmod(SRV2, 0o700)
shutil.copyfile(f"{SRV}/index.xml", f"{SRV2}/index.xml")
d.url = f"file://{SRV2}/index.xml"
out["url_set"] = {"url": d.url}
out["url_set_bad"] = err(lambda: setattr(d, "url", f"file://{SRV2}/missing_index.xml"))
out["url_after_bad_set"] = d.url
# restore
d.url = INDEX_URL

# _errors persistence quirk: a downloader that once saw an error reports
# "Downloaded collection 'mini' with errors" forever after.
d3 = Downloader(INDEX_URL)
cap_dl(d3.download, "nope", DL, halt_on_error=False, quiet=True)
out["errors_flag"] = bool(d3._errors)
out["dl_errors_quirk"] = cap_dl(d3.download, "mini", DL)

# retry loop — driven through a real subprocess with piped stdin. "y" on a
# checksum failure self-deadlocks in NLTK 3.10.3: _download_package holds
# <pkg>.lock while the suspended outer generator still owns it, so the
# recursive download polls the lock forever. Pinned via timeout.
RETRY_SCRIPT = (
    "import sys, json, os\n"
    "import nltk\n"
    "from nltk.downloader import Downloader\n"
    "d = Downloader(os.environ['INDEX_URL'])\n"
    "rv, err = None, None\n"
    "try:\n"
    "    rv = d.download('badmd5', os.environ['DL'], halt_on_error=False)\n"
    "except BaseException as e:\n"
    "    err = type(e).__name__ + ': ' + str(e)[:400]\n"
    "print('JSON:' + json.dumps({'rv': rv, 'err': err}))\n"
)


def _clean_residue():
    for name in ("corpora/badmd5.zip.lock", "corpora/badmd5.zip.tmp",
                 "corpora/badmd5.zip"):
        try:
            os.remove(os.path.join(DL, name))
        except OSError:
            pass


def retry_sub(stdin):
    try:
        p = subprocess.run(
            [sys.executable, "-c", RETRY_SCRIPT], input=stdin,
            capture_output=True, text=True, timeout=10,
            env={**os.environ, "INDEX_URL": INDEX_URL, "DL": DL, "NLTK_DATA": ROOT})
        tag = [l for l in p.stdout.splitlines() if l.startswith("JSON:")]
        inner = json.loads(tag[-1][5:]) if tag else {"rv": None, "err": None}
        rec = {"code": p.returncode, "stderr": p.stderr,
               "rv": inner["rv"], "err": inner["err"]}
    except subprocess.TimeoutExpired as e:
        stderr = e.stderr or ""
        if isinstance(stderr, bytes):
            stderr = stderr.decode("utf-8", "replace")
        rec = {"code": "timeout", "stderr": stderr, "rv": None, "err": None}
    _clean_residue()
    return rec


out["retry_e"] = retry_sub("e\n")
out["retry_n"] = retry_sub("n\n")
out["retry_y_e"] = retry_sub("y\ne\n")
out["retry_eof"] = retry_sub("")

# module-level _downloader singleton -------------------------------------------
DL5 = os.path.join(ROOT, "dl5")
os.makedirs(DL5, exist_ok=True); os.chmod(DL5, 0o700)
dlmod._downloader.url = INDEX_URL
out["module_download"] = cap_dl(dlmod.download, "abc", DL5)
out["module_update"] = cap_fd_stderr(lambda: dlmod.update())

# final snapshots --------------------------------------------------------------
out["dl_tree"] = snapshot(DL)
out["dl2_tree"] = snapshot(DL2)
out["dl3_tree"] = snapshot(DL3)
out["dl4_tree"] = snapshot(DL4)
out["root_tree_pkgs"] = snapshot(f"{ROOT}/corpora")  # rawdata landed in default dir

# reset shared download dirs so the JS replay starts from the same state
for dd in [DL, DL2, DL3, DL4, DL5]:
    shutil.rmtree(dd); os.makedirs(dd); os.chmod(dd, 0o700)
shutil.rmtree(f"{ROOT}/corpora", ignore_errors=True)

print(json.dumps(out, sort_keys=True))
