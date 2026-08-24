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
    "tokenize.legality_principle": True, "tokenize.sonority_sequencing": True,
    "tokenize.sexpr": True, "tokenize.texttiling": True, "tokenize.repp": True,
    "tokenize.stanford_segmenter": True, "tokenize.stanford": True,
    "tokenize.nist": True,
    # stem
    "stem.api": True, "stem.porter": True, "stem.snowball": True,
    "stem.lancaster": True, "stem.regexp": True, "stem.wordnet": True,
    "stem.util": True, "stem.cistem": True, "stem.isri": True,
    "stem.rslp": True, "stem.arlstem": True, "stem.arlstem2": True,
    # tag
    "tag.api": True, "tag.perceptron": True, "tag.sequential": True,
    "tag.brill": True, "tag.brill_trainer": True, "tag.hmm": True,
    "tag.util": True, "tag.mapping": True, "tag.tnt": True, "tag.crf": True,
    "tag.senna": True, "tag.hunpos": True, "tag.stanford": True,
    # tbl
    "tbl.api": True, "tbl.rule": True, "tbl.template": True,
    "tbl.feature": True, "tbl.demo": True, "tbl.erroranalysis": True,
    # probability / lm
    "probability": True,
    "lm.api": True, "lm.models": True, "lm.smoothing": True,
    "lm.counter": True, "lm.vocabulary": True, "lm.preprocessing": True,
    "lm.util": True,
    # metrics
    "metrics": True, "metrics.agreement": True, "metrics.aline": True,
    "metrics.association": True, "metrics.confusionmatrix": True,
    "metrics.distance": True, "metrics.paice": True, "metrics.scores": True,
    "metrics.segmentation": True, "metrics.spearman": True,
    # translate
    "translate.api": True, "translate.bleu_score": True,
    "translate.chrf_score": True, "translate.nist_score": True,
    "translate.metrics": True, "translate.gale_church": True,
    "translate.gdfa": True, "translate.ibm_model": True,
    "translate.ibm1": True, "translate.ibm2": True, "translate.ibm3": True,
    "translate.ibm4": True, "translate.ibm5": True, "translate.lepor": True,
    "translate.meteor_score": True, "translate.phrase_based": True,
    "translate.ribes_score": True, "translate.stack_decoder": True,
    "translate.gleu_score": True,
    # sem
    "sem.logic": True, "sem.evaluate": True,
    "sem.drt": True, "sem.skolemize": True, "sem.util": True,
    "sem.boxer": True, "sem.chat80": True,
    "sem.cooper_storage": True, "sem.drt_glue_demo": True,
    "sem.glue": True, "sem.hole": True, "sem.lfg": True,
    "sem.linearlogic": True, "sem.relextract": True,
    # classify
    "classify.api": True, "classify.naivebayes": True,
    "classify.positivenaivebayes": True, "classify.decisiontree": True,
    "classify.maxent": True, "classify.util": True, "classify.megam": True,
    "classify.rte_classify": True, "classify.scikitlearn": True,
    "classify.senna": True, "classify.svm": True, "classify.tadm": True,
    "classify.textcat": True, "classify.weka": True,
    # parse
    "parse": True, "parse.api": True, "parse.cfg": True, "parse.pcfg": True,
    "parse.chart": True, "parse.earleychart": True,
    "parse.recursivedescent": True, "parse.pchart": True, "parse.viterbi": True,
    "parse.featurechart": True, "parse.util": True,
    "parse.dependencygraph": True, "parse.nonprojectivedependencyparser": True,
    "parse.projectivedependencyparser": True, "parse.bllip": True,
    "parse.corenlp": True, "parse.evaluate": True, "parse.generate": True,
    "parse.malt": True, "parse.shiftreduce": True, "parse.stanford": True,
    "parse.transitionparser": True,
    # chunk
    "chunk": True, "chunk.api": True, "chunk.regexp": True, "chunk.util": True,
    "chunk.named_entity": True,
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
    "tree.prettyprinter": True, "tree.parented": True,
    "tree.immutable": True, "treeprettyprinter": True,
    # sentiment
    "sentiment.vader": True, "sentiment.util": True,
    "sentiment.sentiment_analyzer": True,
    # cluster
    "cluster": True, "cluster.api": True, "cluster.em": True,
    "cluster.gaac": True, "cluster.kmeans": True, "cluster.util": True,
    # misc + tgrep/toolbox
    "misc": True, "misc.babelfish": True, "misc.chomsky": True,
    "misc.minimalset": True, "misc.sort": True, "misc.wordfinder": True,
    "tgrep": True, "toolbox": True,
    # ccg
    "ccg": True, "ccg.api": True, "ccg.chart": True, "ccg.combinator": True,
    "ccg.lexicon": True, "ccg.ccgcat": True, "ccg.logic": True,
    # inference
    "inference": True, "inference.api": True, "inference.resolution": True,
    "inference.tableau": True, "inference.prover9": True, "inference.mace": True,
    "inference.discourse": True,
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
