import nltk

assert nltk.__version__ == "3.10.3"

import io
import json
import contextlib
import textwrap

from nltk.misc.babelfish import babelize_shell
from nltk.misc.chomsky import generate_chomsky
from nltk.misc.minimalset import MinimalSet
from nltk.misc.sort import bubble, merge, quick, selection
from nltk.misc.wordfinder import check, step

out = {}

# instrumented sorts return comparison counts and sort in place
data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]
for fn in (selection, bubble, merge, quick):
    a = list(data)
    out[fn.__name__] = [fn(a), a]
empty = []
out["selection_empty"] = selection(empty)
out["quick_sorted"] = quick([1, 2, 3, 4, 5]) if (a := [1, 2, 3, 4, 5]) else None

# MinimalSet
ms = MinimalSet(
    [
        ("at", "f", "fat"),
        ("at", "c", "cat"),
        ("at", "b", "bat"),
        ("og", "d", "dog"),
        ("aining", "tr", "training"),
        ("aining", "dr", "draining"),
    ]
)
out["ms_contexts"] = sorted(ms.contexts())
out["ms_contexts_min3"] = sorted(ms.contexts(minimum=3))
out["ms_targets"] = sorted(ms.targets())
out["ms_display"] = [ms.display("at", "f"), ms.display("at", "z"), ms.display("at", "z", "D")]
out["ms_display_all_at"] = sorted(ms.display_all("at"))
out["ms_display_all_og"] = sorted(ms.display_all("og"))

# wordfinder placement helpers (deterministic given explicit grid/pos/dir)
def grid(rows, cols):
    return [[""] * cols for _ in range(rows)]

g = grid(4, 4)
out["check_dir2_ok"] = check("AB", 2, 3, 1, g, 4, 4)
out["check_dir2_grid"] = g
g2 = grid(4, 4)
out["check_dir2_edge"] = check("ABC", 2, 1, 1, g2, 4, 4)
out["check_dir2_edge_grid"] = g2
g3 = grid(4, 4)
out["check_dir4"] = check("AB", 4, 2, 3, g3, 4, 4)
out["check_dir4_grid"] = g3
g4 = grid(4, 4)
out["check_dir1"] = check("AB", 1, 3, 3, g4, 4, 4)
out["check_dir1_grid"] = g4
g5 = grid(4, 4)
out["check_dir3"] = check("AB", 3, 3, 0, g5, 4, 4)
out["check_dir3_grid"] = g5
g6 = grid(4, 4)
out["check_unknown_dir"] = check("AB", 9, 3, 3, g6, 4, 4)
# clash: occupied cell with different letter
g7 = grid(4, 4)
g7[2][1] = "Z"
out["check_clash"] = check("AB", 4, 2, 3, g7, 4, 4)
out["check_clash_grid"] = g7
# step direct
g8 = grid(4, 4)
out["step_fn"] = step("AB", 0, lambda i: i, 0, lambda i: i, g8)
out["step_fn_grid"] = g8

# chomsky: NLTK prints; our port returns the string — pin textwrap + structure
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    generate_chomsky(times=1, line_length=40)
chomsky_out = buf.getvalue()
out["chomsky_lines_maxlen"] = max(len(l) for l in chomsky_out.splitlines())
out["chomsky_phrase_count"] = len(chomsky_out.split())
out["textwrap_pin"] = textwrap.fill("alpha beta gamma delta epsilon zeta eta theta iota", 20)

buf2 = io.StringIO()
with contextlib.redirect_stdout(buf2):
    babelize_shell()
out["babelize_print"] = buf2.getvalue()

print(json.dumps(out, indent=1, default=list))
