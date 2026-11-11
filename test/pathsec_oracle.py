#!/usr/bin/env python3
"""Oracle pins for nltk.pathsec network/zip half (NLTK 3.10.3).

Reads a JSON request on stdin:
  {"mode": "validate", "urls": [...]}
  {"mode": "zip", "zip_path": str, "member": str, "extract_dir": str}

Emits JSON with per-case outcomes.
"""
import json
import os
import sys
import tempfile
import zipfile

import nltk

assert nltk.__version__ == "3.10.3"
from nltk import pathsec


def outcome(fn):
    try:
        fn()
        return {"ok": True}
    except BaseException as e:  # noqa: BLE001 — record oracle behavior verbatim
        return {"ok": False, "type": type(e).__name__, "msg": str(e)[:200]}


def main():
    req = json.loads(sys.stdin.read())
    if req["mode"] == "validate":
        res = []
        for u in req["urls"]:
            res.append(outcome(lambda u=u: pathsec.validate_network_url(u)))
        print(json.dumps({"results": res}))
    elif req["mode"] == "urlopen_file":
        def go():
            r = pathsec.urlopen(req["url"])
            return r.read()
        out = outcome(go)
        if out["ok"]:
            with open(req["expect_path"], "rb") as f:
                r = pathsec.urlopen(req["url"])
                out["matches"] = r.read() == f.read()
                r.close()
        print(json.dumps(out))
    elif req["mode"] == "zip":
        res = {"namelist": None}
        try:
            zf = pathsec.ZipFile(req["zip_path"])
            res["namelist"] = zf.namelist()
            res["read"] = outcome(lambda: zf.read(req["member"]))
            res["extract"] = outcome(
                lambda: zf.extract(req["member"], path=req["extract_dir"])
            )
            res["extractall"] = outcome(
                lambda: zf.extractall(path=req["extract_dir"])
            )
        except BaseException as e:  # noqa: BLE001
            res["ctor"] = {"ok": False, "type": type(e).__name__, "msg": str(e)[:200]}
        print(json.dumps(res))
    elif req["mode"] == "make_zip":
        # helper so the JS side can produce identical fixtures
        mode = req["zip_mode"]
        path = req["zip_path"]
        with zipfile.ZipFile(path, "w") as z:
            if mode == "safe":
                z.writestr("hello.txt", b"hi nltk")
                z.writestr("sub/inner.txt", b"nested")
            elif mode == "evil":
                z.writestr("../escape.txt", b"pwned")
                z.writestr("ok.txt", b"fine")
        print(json.dumps({"made": path}))


if __name__ == "__main__":
    main()
