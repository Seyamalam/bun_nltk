#!/usr/bin/env python3
"""Oracle pins for nltk.data BufferedGzipFile + retrieve (NLTK 3.10.3)."""
import gzip
import io
import json
import os
import sys

import nltk

assert nltk.__version__ == "3.10.3"
from nltk.data import BufferedGzipFile, retrieve


def outcome(fn):
    try:
        return {"ok": True, "v": fn()}
    except BaseException as e:  # noqa: BLE001
        return {"ok": False, "type": type(e).__name__, "msg": str(e)[:160]}


def main():
    req = json.loads(sys.stdin.read())
    out = {}
    if req["mode"] == "deprecation":
        import warnings
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            BufferedGzipFile(fileobj=io.BytesIO(gzip.compress(b"x")))
            out["warnings"] = [(x.category.__name__, str(x.message)[:100]) for x in w]
        print(json.dumps(out))
        return
    if req["mode"] == "make_gz":
        with gzip.open(req["path"], "wb") as f:
            f.write(req["content"].encode("utf-8"))
        out["size"] = os.path.getsize(req["path"])
    elif req["mode"] == "gzipfile":
        path = req["path"]
        f = BufferedGzipFile(path)
        out["read5"] = f.read(5).decode()
        out["readline"] = f.readline().decode()
        out["tell"] = f.tell()
        out["peek"] = f.peek(2).decode(errors="replace")[:2]
        out["seek0"] = f.seek(0)
        out["readlines"] = [b.decode() for b in f.readlines()]
        f.close()
        f2 = BufferedGzipFile(path)
        out["has_size"] = hasattr(f2, "size")
        f2.seek(10_000)
        out["eof_read"] = f2.read().decode()
        f2.close()
        # write mode returns None (subclass quirk)
        wpath = req["wpath"]
        w = BufferedGzipFile(wpath, "wb")
        out["write_ret"] = w.write(b"abc\n")
        w.write(b"def\n")
        w.close()
        out["wroundtrip"] = gzip.open(wpath, "rb").read().decode()
        out["badmode"] = outcome(lambda: BufferedGzipFile(path, "zz"))
        out["write_on_read"] = outcome(
            lambda: BufferedGzipFile(path).__class__.write(BufferedGzipFile(path), b"x")
        )
    elif req["mode"] == "retrieve":
        src, dst = req["src"], req["dst"]
        v = io.StringIO()
        import contextlib
        with contextlib.redirect_stdout(v):
            res = outcome(lambda: retrieve(src, filename=dst))
        out["first"] = res
        out["stdout"] = v.getvalue()
        if res["ok"]:
            out["bytes_eq"] = open(dst, "rb").read() == open(
                src.split(":", 1)[1], "rb"
            ).read()
            v2 = io.StringIO()
            with contextlib.redirect_stdout(v2):
                out["exists_again"] = outcome(lambda: retrieve(src, filename=dst))
        # default filename derivation
        cwd = os.getcwd()
        os.chdir(req["workdir"])
        try:
            v3 = io.StringIO()
            with contextlib.redirect_stdout(v3):
                out["default_name"] = outcome(
                    lambda: (retrieve(src), None)[1]
                )
            out["derived"] = sorted(os.listdir("."))
        finally:
            os.chdir(cwd)
    print(json.dumps(out))


if __name__ == "__main__":
    main()
