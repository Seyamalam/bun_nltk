import json
import os
import sys
import tempfile
import warnings

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.internals import (
    Deprecated,
    find_binary_iter,
    find_file_iter,
    is_writable,
    overridden,
    read_int,
    read_number,
    read_str,
)


def capture(fn, *args):
    try:
        val, end = fn(*args)
        return {"v": val, "end": end}
    except Exception as e:  # noqa: BLE001
        return {"err": type(e).__name__, "msg": str(e), "expected": getattr(e, "expected", None), "position": getattr(e, "position", None)}


def main():
    out = {}
    out["read_str"] = [
        capture(read_str, '"Hello", World!', 0),
        capture(read_str, "x = 'it\\'s' + 3", 4),
        capture(read_str, 'u"abc\\n"', 0),
        capture(read_str, 'r"a\\tb"', 0),
        capture(read_str, '"""a\nb""" rest', 0),
        capture(read_str, "'tab\\there'", 0),
        capture(read_str, "noquote", 0),
        capture(read_str, "'unterminated", 0),
    ]
    out["read_int"] = [
        capture(read_int, "42 is the answer", 0),
        capture(read_int, "  -17 x", 2),
        capture(read_int, "abc", 0),
    ]
    out["read_number"] = [
        capture(read_number, "Pi is 3.14159", 6),
        capture(read_number, "-2.5e", 0),
        capture(read_number, ".5", 0),
        capture(read_number, "3.", 0),
        capture(read_number, "-", 0),
        capture(read_number, "12x", 0),
    ]

    class EaterI:
        def eat(self, food):
            if overridden(self.batch_eat):
                return self.batch_eat([food])[0]
            raise NotImplementedError

        def batch_eat(self, foods):
            return [self.eat(food) for food in foods]

    class EaterSub(EaterI):
        def batch_eat(self, foods):
            return ["sub:" + f for f in foods]

    out["overridden"] = {
        "base": EaterI().eat("x") if False else None,
        "sub_result": EaterSub().eat("y"),
        "sub_overridden": EaterSub().batch_eat.__self__.__class__.__name__ == "EaterSub",
    }
    # Direct flag checks: base self.batch_eat defined once (False), sub twice (True)
    def check(inst):
        name = "batch_eat"
        import types
        funcs = [c.__dict__[name] for c in type(inst).__mro__ if name in c.__dict__]
        return len(funcs) > 1

    out["overridden"]["base_flag"] = check(EaterI())
    out["overridden"]["sub_flag"] = check(EaterSub())

    class NewName:
        pass

    class OldName(Deprecated, NewName):
        "Use NewName instead."

    with warnings.catch_warnings(record=True) as rec:
        warnings.simplefilter("always")
        OldName()
    out["deprecated"] = [str(w.message) for w in rec]

    with tempfile.TemporaryDirectory() as td:
        fpath = os.path.join(td, "toolx")
        with open(fpath, "w") as f:
            f.write("x")
        os.chmod(fpath, 0o755)
        bin_dir = os.path.join(td, "envroot", "bin")
        os.makedirs(bin_dir)
        with open(os.path.join(bin_dir, "toolx"), "w") as f:
            f.write("x")
        os.mkdir(os.path.join(td, "sp"))
        with open(os.path.join(td, "sp", "toolx"), "w") as f:
            f.write("x")
        os.chmod(os.path.join(bin_dir, "toolx"), 0o755)
        os.chmod(os.path.join(td, "sp", "toolx"), 0o755)

        env = dict(os.environ)
        env["NLTK_TEST_VAR"] = os.path.join(td, "envroot")
        old = os.environ.copy()
        os.environ.update(env)
        try:
            out["find_file_iter"] = sorted(
                p for p in find_file_iter("toolx", searchpath=[os.path.join(td, "sp")])
            )
            os.chdir(td)
            out["find_binary"] = sorted(find_binary_iter("toolx", searchpath=[os.path.join(td, "sp")]))
        finally:
            os.environ.clear()
            os.environ.update(old)

        out["writable"] = {
            "file": is_writable(fpath),
            "ro": is_writable("/proc/version"),
            "missing": is_writable(os.path.join(td, "nope")),
        }

        # nltk.data.find on a synthetic resource tree
        from nltk.data import find as data_find

        corpus_root = os.path.join(td, "data")
        os.makedirs(os.path.join(corpus_root, "corpora", "toy"))
        with open(os.path.join(corpus_root, "corpora", "toy", "a.txt"), "w") as f:
            f.write("hi")
        try:
            out["data_find"] = {
                "hit": str(data_find("corpora/toy", [corpus_root])).replace(td, "<TD>"),
                "hit_file": str(data_find("corpora/toy/a.txt", [corpus_root])).replace(td, "<TD>"),
                "miss": None,
            }
            try:
                data_find("corpora/absent", [corpus_root])
            except Exception as e:  # noqa: BLE001
                out["data_find"]["miss"] = type(e).__name__
        except Exception as e:  # noqa: BLE001
            out["data_find"] = {"setup_err": f"{type(e).__name__}: {e}"}
    print(json.dumps(out))


if __name__ == "__main__":
    main()
