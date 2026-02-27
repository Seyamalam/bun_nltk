#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import nltk


TOKEN_RE = re.compile(r"[A-Za-z0-9']+")
NONTERM_VALID_RE = re.compile(r"[^A-Za-z0-9_]+")


def normalize_token(token: str) -> str | None:
    tok = token.lower()
    if TOKEN_RE.fullmatch(tok) is None:
        return None
    if not any(ch.isalnum() for ch in tok):
        return None
    return tok


def sanitize_nonterminal(label: str) -> str:
    out = NONTERM_VALID_RE.sub("_", label)
    out = out.strip("_")
    if not out:
        out = "NT"
    if not (out[0].isalpha() or out[0] == "_"):
        out = f"NT_{out}"
    return out


def build_pcfg_fixture(max_trees: int, max_cases: int) -> dict[str, Any]:
    nltk.download("treebank", quiet=True)
    from nltk.corpus import treebank
    from nltk.grammar import Nonterminal, induce_pcfg

    productions = []
    normalized_tree_cases: list[list[str]] = []
    trees_used = 0
    for tree in treebank.parsed_sents():
        if trees_used >= max_trees:
            break
        normalized = [tok for tok in (normalize_token(t) for t in tree.leaves()) if tok]
        if 3 <= len(normalized) <= 12:
            normalized_tree_cases.append(normalized)
        t = tree.copy(deep=True)
        t.collapse_unary(collapsePOS=False, collapseRoot=False)
        t.chomsky_normal_form(horzMarkov=2)
        productions.extend(t.productions())
        trees_used += 1

    grammar = induce_pcfg(Nonterminal("S"), productions)

    all_nonterms: set[str] = set()
    for prod in grammar.productions():
        all_nonterms.add(str(prod.lhs()))
        for sym in prod.rhs():
            if not isinstance(sym, str):
                all_nonterms.add(str(sym))

    nonterm_map: dict[str, str] = {}
    used: set[str] = set()
    for original in sorted(all_nonterms):
        base = sanitize_nonterminal(original)
        candidate = base
        idx = 2
        while candidate in used:
            candidate = f"{base}_{idx}"
            idx += 1
        used.add(candidate)
        nonterm_map[original] = candidate

    grouped: dict[str, dict[tuple[str, ...], float]] = defaultdict(dict)
    lexical_tokens: set[str] = set()
    for prod in grammar.productions():
        lhs = nonterm_map[str(prod.lhs())]
        rhs: list[str] = []
        for sym in prod.rhs():
            if isinstance(sym, str):
                tok = normalize_token(sym)
                if tok is None:
                    break
                rhs.append(json.dumps(tok))
                lexical_tokens.add(tok)
            else:
                rhs.append(nonterm_map[str(sym)])
        else:
            key = tuple(rhs)
            grouped[lhs][key] = grouped[lhs].get(key, 0.0) + float(prod.prob())

    lines = []
    for lhs, alts in sorted(grouped.items(), key=lambda kv: kv[0]):
        total = sum(alts.values())
        if total <= 0:
            continue
        right = " | ".join(f"{' '.join(rhs)} [{(prob / total):.10f}]" for rhs, prob in sorted(alts.items()))
        lines.append(f"{lhs} -> {right}")
    grammar_text = "\n".join(lines)
    parser_obj = nltk.ViterbiParser(nltk.PCFG.fromstring(grammar_text))

    seen: set[tuple[str, ...]] = set()
    cases: list[list[str]] = []

    def try_add_case(tokens: list[str]) -> None:
        if len(tokens) < 3 or len(tokens) > 12:
            return
        if any(tok not in lexical_tokens for tok in tokens):
            return
        key = tuple(tokens)
        if key in seen:
            return
        try:
            first = next(parser_obj.parse(tokens), None)
        except Exception:
            return
        if first is None:
            return
        seen.add(key)
        cases.append(tokens)

    for row in normalized_tree_cases:
        try_add_case(row)
        if len(cases) >= max_cases:
            break

    if len(cases) < max_cases:
        for sent in treebank.sents():
            row = [tok for tok in (normalize_token(t) for t in sent) if tok]
            if not row:
                continue
            try_add_case(row)
            if len(cases) >= max_cases:
                break

    return {
        "source": "nltk.treebank",
        "trees_used": trees_used,
        "case_count": len(cases),
        "grammar": grammar_text,
        "cases": cases,
    }


def build_classifier_fixture(train_per_label: int, test_per_label: int) -> dict[str, Any]:
    nltk.download("movie_reviews", quiet=True)
    from nltk.corpus import movie_reviews

    def rows(label: str) -> list[dict[str, str]]:
        out: list[dict[str, str]] = []
        for fid in movie_reviews.fileids(label):
            tokens = [normalize_token(tok) for tok in movie_reviews.words(fid)]
            cleaned = [tok for tok in tokens if tok]
            if len(cleaned) < 30:
                continue
            text = " ".join(cleaned[:220])
            out.append({"label": label, "text": text})
        return out

    pos = rows("pos")
    neg = rows("neg")
    train = pos[:train_per_label] + neg[:train_per_label]
    test = pos[train_per_label : train_per_label + test_per_label] + neg[train_per_label : train_per_label + test_per_label]

    return {
        "source": "nltk.movie_reviews",
        "train_size": len(train),
        "test_size": len(test),
        "train": train,
        "test": test,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="test/fixtures/nltk_imported")
    parser.add_argument("--max-trees", type=int, default=220)
    parser.add_argument("--max-parser-cases", type=int, default=80)
    parser.add_argument("--train-per-label", type=int, default=220)
    parser.add_argument("--test-per-label", type=int, default=80)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    parser_fixture = build_pcfg_fixture(args.max_trees, args.max_parser_cases)
    classifier_fixture = build_classifier_fixture(args.train_per_label, args.test_per_label)

    parser_path = out_dir / "pcfg_treebank_fixture.json"
    clf_path = out_dir / "classifier_movie_reviews_fixture.json"
    parser_path.write_text(json.dumps(parser_fixture, indent=2) + "\n", encoding="utf-8")
    clf_path.write_text(json.dumps(classifier_fixture, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "ok": True,
                "out_dir": str(out_dir.resolve()),
                "pcfg_fixture": str(parser_path.resolve()),
                "classifier_fixture": str(clf_path.resolve()),
                "pcfg_cases": parser_fixture["case_count"],
                "classifier_train": classifier_fixture["train_size"],
                "classifier_test": classifier_fixture["test_size"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
