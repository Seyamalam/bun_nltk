#!/usr/bin/env python3
"""Generate docs/PARITY_CHECKLIST.md by diffing the NLTK API index (nltk.org)
against bun_nltk's src/ + test/ surface.

Usage:
    python3 scripts/parity-checklist.py            # regenerate checklist
    python3 scripts/parity-checklist.py --summary  # print counts only

The scraped module list is cached at /tmp/nltk_modules.json; delete it to force
a re-scrape. Coverage flags live in the COVERED map below — update it when a
new module lands.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = "/tmp/nltk_modules.json"
API_URL = "https://www.nltk.org/api/nltk.html"

# ---------------------------------------------------------------------------
# 1. Scrape (or load cached) NLTK API module index
# ---------------------------------------------------------------------------


def scrape() -> list[str]:
    if os.path.exists(CACHE):
        return json.load(open(CACHE))
    req = urllib.request.Request(API_URL, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    mods = sorted(set(re.findall(r'href="nltk\.([a-z0-9_.]+)\.html"', html)))
    json.dump(mods, open(CACHE, "w"))
    return mods


# ---------------------------------------------------------------------------
# 2. Coverage map — True = implemented in src/ with tests.
#    Keep this in sync when adding modules; the checklist regenerates from it.
# ---------------------------------------------------------------------------

COVERED: dict[str, bool] = {
    # tokenize
    "tokenize": True, "tokenize.api": True, "tokenize.casual": True,
    "tokenize.destructive": True, "tokenize.regexp": True,
    "tokenize.treebank": True, "tokenize.toktok": True, "tokenize.mwe": True,
    "tokenize.punkt": True, "tokenize.util": True, "tokenize.simple": True,
    "tokenize.legality_principle": False, "tokenize.sonority_sequencing": False,
    "tokenize.sexpr": False, "tokenize.texttiling": False, "tokenize.repp": False,
    "tokenize.stanford_segmenter": False, "tokenize.stanford": False,
    "tokenize.nist": False,
    # stem
    "stem.api": True, "stem.porter": True, "stem.snowball": True,
    "stem.lancaster": True, "stem.regexp": True, "stem.wordnet": True,
    "stem.util": True, "stem.cistem": False, "stem.isri": False,
    "stem.rslp": False, "stem.arlstem": False, "stem.arlstem2": False,
    # tag
    "tag.api": True, "tag.perceptron": True, "tag.sequential": True,
    "tag.brill": True, "tag.brill_trainer": True, "tag.hmm": True,
    "tag.util": True, "tag.mapping": False, "tag.tnt": False, "tag.crf": False,
    "tag.senna": False, "tag.hunpos": False, "tag.stanford": False,
    # tbl
    "tbl.api": True, "tbl.rule": True, "tbl.template": True,
    "tbl.feature": True, "tbl.demo": False, "tbl.erroranalysis": False,
    # probability / lm
    "probability": True,
    "lm.api": True, "lm.models": True, "lm.smoothing": True,
    "lm.counter": True, "lm.vocabulary": True, "lm.preprocessing": True,
    "lm.util": True,
    # metrics
    "metrics": True, "metrics.agreement": True, "metrics.aline": False,
    "metrics.association": True, "metrics.confusionmatrix": True,
    "metrics.distance": True, "metrics.paice": False, "metrics.scores": True,
    "metrics.segmentation": True, "metrics.spearman": True,
    # translate
    "translate.api": True, "translate.bleu_score": True,
    "translate.chrf_score": True, "translate.nist_score": True,
    "translate.metrics": True, "translate.gale_church": False,
    "translate.gdfa": False, "translate.ibm_model": False,
    "translate.ibm1": False, "translate.ibm2": False, "translate.ibm3": False,
    "translate.ibm4": False, "translate.ibm5": False, "translate.lepor": False,
    "translate.meteor_score": False, "translate.phrase_based": False,
    "translate.ribes_score": False, "translate.stack_decoder": False,
    "translate.gleu_score": False,
    # sem
    "sem.logic": True, "sem.evaluate": True, "sem.util": False,
    "sem.drt": False, "sem.boxer": False, "sem.chat80": False,
    "sem.cooper_storage": False, "sem.drt_glue_demo": False,
    "sem.glue": False, "sem.hole": False, "sem.lfg": False,
    "sem.linearlogic": False, "sem.relextract": False, "sem.skolemize": False,
    # classify
    "classify.api": True, "classify.naivebayes": True,
    "classify.positivenaivebayes": True, "classify.decisiontree": True,
    "classify.maxent": True, "classify.util": True, "classify.megam": False,
    "classify.rte_classify": False, "classify.scikitlearn": False,
    "classify.senna": False, "classify.svm": False, "classify.tadm": False,
    "classify.textcat": False, "classify.weka": False,
    # parse
    "parse": True, "parse.api": True, "parse.cfg": True, "parse.pcfg": True,
    "parse.chart": True, "parse.earleychart": True,
    "parse.recursivedescent": True, "parse.pchart": True, "parse.viterbi": True,
    "parse.featurechart": True, "parse.util": True,
    "parse.dependencygraph": True, "parse.nonprojectivedependencyparser": True,
    "parse.projectivedependencyparser": True, "parse.bllip": False,
    "parse.corenlp": False, "parse.evaluate": False, "parse.generate": False,
    "parse.malt": False, "parse.shiftreduce": False, "parse.stanford": False,
    "parse.transitionparser": False,
    # chunk
    "chunk": True, "chunk.api": True, "chunk.regexp": True, "chunk.util": True,
    "chunk.named_entity": False,
    # corpus readers (subset)
    "corpus": True, "corpus.reader": True, "corpus.reader.api": True,
    "corpus.reader.plaintext": True, "corpus.reader.tagged": True,
    "corpus.reader.chunked": True, "corpus.reader.conll": True,
    "corpus.reader.wordnet": True, "corpus.reader.util": True,
    "corpus.util": True,
    # single-module families
    "collocations": True, "text": True, "wsd": True,
    "treetransforms": True, "grammar": True, "probability": True,
    # tree family (core covered; prettyprinter/parented/immutable out)
    "tree": True, "tree.tree": True, "tree.probabilistic": True,
    "tree.transforms": True, "tree.parsing": True,
    "tree.prettyprinter": False, "tree.parented": False,
    "tree.immutable": False, "treeprettyprinter": False,
    # sentiment
    "sentiment.vader": True, "sentiment.util": True,
    "sentiment.sentiment_analyzer": False,
}

# Families deliberately out of scope for a JS library (GUI/demo/external-tool).
OUT_OF_SCOPE = {
    "app", "chat", "draw", "help", "internals", "jsontags", "lazyimport",
    "cli", "downloader",
}


def classify_family(module: str) -> str:
    fam = module.split(".")[0]
    if fam == "corpus":
        return "corpus"
    return fam


def main() -> None:
    summary_only = "--summary" in sys.argv
    mods = scrape()

    rows: list[tuple[str, bool]] = []
    for m in mods:
        rows.append((m, COVERED.get(m, False)))

    fams: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for _, ok in rows:
        pass

    per_fam: dict[str, dict[str, bool]] = defaultdict(dict)
    for m, ok in rows:
        per_fam[classify_family(m)][m] = ok

    total_c = sum(1 for _, ok in rows if ok)
    total = len(rows)

    lines: list[str] = []
    lines.append("# NLTK API Parity Checklist")
    lines.append("")
    lines.append(
        f"> Auto-generated from the [NLTK API index]({API_URL}) "
        f"({total} public modules) diffed against `src/`."
    )
    lines.append(f"> Last regenerated: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    lines.append("")
    lines.append(
        f"**Coverage: {total_c}/{total} modules ({100 * total_c / total:.1f}%)** "
        f"— {len([f for f in per_fam if any(per_fam[f].values())])} of "
        f"{len(per_fam)} families touched."
    )
    lines.append("")

    order = sorted(per_fam.items(), key=lambda kv: (-sum(kv[1].values()), kv[0]))
    for fam, members in order:
        c = sum(1 for ok in members.values() if ok)
        t = len(members)
        mark = "x" if all(members.values()) else ("~" if c else " ")
        lines.append(f"- [{mark}] `{fam}` ({c}/{t})")
        for m in sorted(members):
            if m == fam:
                continue
            ok = members[m]
            short = m[len(fam) + 1:]
            check = "x" if ok else " "
            note = "" if ok else " — *out of scope*" if fam in OUT_OF_SCOPE or fam in {"app", "chat", "draw"} else ""
            lines.append(f"  - [{check}] `{fam}.{short}`{note}")
        lines.append("")

    lines.append("_Regenerate with `python3 scripts/parity-checklist.py`._")

    if not summary_only:
        out = os.path.join(ROOT, "docs", "PARITY_CHECKLIST.md")
        with open(out, "w") as fh:
            fh.write("\n".join(lines) + "\n")
        print(f"wrote {out}")

    print(f"coverage: {total_c}/{total} = {100 * total_c / total:.1f}%")
    for fam, members in sorted(per_fam.items(), key=lambda kv: -len(kv[1])):
        c = sum(1 for ok in members.values() if ok)
        if c:
            print(f"  {fam:12s} {c}/{len(members)}")


if __name__ == "__main__":
    main()
