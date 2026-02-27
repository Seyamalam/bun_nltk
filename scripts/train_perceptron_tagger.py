#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

TAGS = ["NN", "NNS", "VB", "VBD", "VBG", "JJ", "RB", "DT", "PRP", "IN", "CC", "CD", "NNP"]

LEX = {
    "DT": ["the", "a", "an", "this", "that", "these", "those"],
    "PRP": ["I", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them"],
    "IN": ["in", "on", "at", "from", "to", "with", "over", "under", "into", "after", "before"],
    "CC": ["and", "or", "but", "yet", "nor"],
    "JJ": ["quick", "slow", "smart", "bright", "small", "large", "stable", "robust", "neural", "formal"],
    "RB": ["quickly", "slowly", "carefully", "boldly", "quietly", "strongly"],
    "NN": ["model", "system", "paper", "result", "dataset", "token", "parser", "engine", "signal", "network"],
    "NNS": ["models", "systems", "papers", "results", "datasets", "tokens", "parsers", "engines", "signals", "networks"],
    "VB": ["run", "test", "ship", "build", "score", "train", "predict", "deploy", "measure"],
    "VBD": ["ran", "tested", "shipped", "built", "scored", "trained", "predicted", "deployed", "measured"],
    "VBG": ["running", "testing", "shipping", "building", "scoring", "training", "predicting", "deploying", "measuring"],
    "NNP": ["Alice", "Bob", "OpenAI", "Zig", "Bun", "Node", "London", "Paris", "Euler", "Curie"],
}


def synth_sentence(rng: random.Random) -> list[tuple[str, str]]:
    n = str(rng.randint(1, 9999))
    return [
        (rng.choice(LEX["DT"]), "DT"),
        (rng.choice(LEX["JJ"]), "JJ"),
        (rng.choice(LEX["NN"]), "NN"),
        (rng.choice(LEX["VBD"]), "VBD"),
        (rng.choice(LEX["IN"]), "IN"),
        (rng.choice(LEX["DT"]), "DT"),
        (rng.choice(LEX["JJ"]), "JJ"),
        (rng.choice(LEX["NN"]), "NN"),
        (rng.choice(LEX["CC"]), "CC"),
        (rng.choice(LEX["PRP"]), "PRP"),
        (rng.choice(LEX["VB"]), "VB"),
        (n, "CD"),
    ]


def build_corpus(sentences: int, seed: int) -> list[list[tuple[str, str]]]:
    rng = random.Random(seed)
    corpus: list[list[tuple[str, str]]] = []
    for _ in range(sentences):
        s = synth_sentence(rng)
        if rng.random() < 0.4:
            s.insert(0, (rng.choice(LEX["NNP"]), "NNP"))
        if rng.random() < 0.3:
            s.append((rng.choice(LEX["RB"]), "RB"))
        if rng.random() < 0.3:
            s.append((rng.choice(LEX["VBG"]), "VBG"))
        if rng.random() < 0.2:
            s.append((rng.choice(LEX["NNS"]), "NNS"))
        corpus.append(s)
    return corpus


def has_digit(token: str) -> bool:
    return any(ch.isdigit() for ch in token)


def has_hyphen(token: str) -> bool:
    return "-" in token


def title(token: str) -> bool:
    return bool(token) and token[:1].isupper()


def feats(tokens: list[str], i: int) -> list[str]:
    tok = tokens[i]
    low = tok.lower()
    prev = tokens[i - 1].lower() if i > 0 else "<BOS>"
    nxt = tokens[i + 1].lower() if i + 1 < len(tokens) else "<EOS>"
    out = [
        "bias",
        f"w={low}",
        f"p1={low[:1]}",
        f"p2={low[:2]}",
        f"p3={low[:3]}",
        f"s1={low[-1:]}",
        f"s2={low[-2:]}",
        f"s3={low[-3:]}",
        f"prev={prev}",
        f"next={nxt}",
        f"is_upper={tok.isupper()}",
        f"is_title={title(tok)}",
        f"has_digit={has_digit(tok)}",
        f"has_hyphen={has_hyphen(tok)}",
    ]
    return out


@dataclass
class AveragedPerceptron:
    classes: list[str]

    def __post_init__(self) -> None:
        self.weights: dict[str, dict[str, float]] = {}
        self._totals: dict[tuple[str, str], float] = defaultdict(float)
        self._ts: dict[tuple[str, str], int] = defaultdict(int)
        self.i = 0

    def predict(self, features: Iterable[str]) -> str:
        scores = {c: 0.0 for c in self.classes}
        for feat in features:
            if feat not in self.weights:
                continue
            w = self.weights[feat]
            for c, v in w.items():
                scores[c] += v
        best = self.classes[0]
        best_score = scores[best]
        for c in self.classes[1:]:
            if scores[c] > best_score:
                best = c
                best_score = scores[c]
        return best

    def _upd_feat(self, feat: str, cls: str, v: float) -> None:
        key = (feat, cls)
        self._totals[key] += (self.i - self._ts[key]) * self.weights[feat].get(cls, 0.0)
        self._ts[key] = self.i
        self.weights[feat][cls] = self.weights[feat].get(cls, 0.0) + v

    def update(self, truth: str, guess: str, features: Iterable[str]) -> None:
        self.i += 1
        if truth == guess:
            return
        for feat in features:
            self.weights.setdefault(feat, {})
            self._upd_feat(feat, truth, 1.0)
            self._upd_feat(feat, guess, -1.0)

    def average(self) -> None:
        for feat, weights in self.weights.items():
            new_w: dict[str, float] = {}
            for cls, weight in weights.items():
                key = (feat, cls)
                total = self._totals[key] + (self.i - self._ts[key]) * weight
                avg = total / max(1, self.i)
                if abs(avg) > 1e-6:
                    new_w[cls] = avg
            self.weights[feat] = new_w


def train(corpus: list[list[tuple[str, str]]], epochs: int) -> AveragedPerceptron:
    model = AveragedPerceptron(TAGS)
    for _ in range(epochs):
        random.shuffle(corpus)
        for sent in corpus:
            tokens = [w for w, _ in sent]
            for i, (_, gold) in enumerate(sent):
                f = feats(tokens, i)
                pred = model.predict(f)
                model.update(gold, pred, f)
    model.average()
    return model


def accuracy(model: AveragedPerceptron, corpus: list[list[tuple[str, str]]]) -> float:
    ok = 0
    total = 0
    for sent in corpus:
        tokens = [w for w, _ in sent]
        for i, (_, gold) in enumerate(sent):
            pred = model.predict(feats(tokens, i))
            ok += int(pred == gold)
            total += 1
    return ok / max(1, total)


def serialize(model: AveragedPerceptron, epochs: int, seed: int, train_sents: int, dev_sents: int, dev_acc: float) -> dict:
    feature_keys = sorted(model.weights.keys())
    feature_index = {k: i for i, k in enumerate(feature_keys)}
    tag_index = {tag: i for i, tag in enumerate(model.classes)}
    tag_count = len(model.classes)
    weights = [0.0] * (len(feature_keys) * tag_count)

    for f, by_tag in model.weights.items():
        fi = feature_index[f]
        base = fi * tag_count
        for tag, value in by_tag.items():
            ti = tag_index[tag]
            weights[base + ti] = round(float(value), 6)

    return {
        "version": 1,
        "type": "averaged_perceptron_token_classifier",
        "tags": model.classes,
        "feature_count": len(feature_keys),
        "tag_count": tag_count,
        "feature_index": feature_index,
        "weights": weights,
        "metadata": {
            "source": "synthetic_template_corpus_v1",
            "epochs": epochs,
            "seed": seed,
            "train_sentences": train_sents,
            "dev_sentences": dev_sents,
            "dev_accuracy": round(dev_acc, 6),
        },
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--out", type=Path, default=Path("models/perceptron_tagger_ascii.json"))
    p.add_argument("--sentences", type=int, default=6000)
    p.add_argument("--epochs", type=int, default=8)
    p.add_argument("--seed", type=int, default=1337)
    args = p.parse_args()

    corpus = build_corpus(args.sentences, args.seed)
    split = int(len(corpus) * 0.85)
    train_corpus = corpus[:split]
    dev_corpus = corpus[split:]

    model = train(train_corpus, args.epochs)
    dev_acc = accuracy(model, dev_corpus)
    payload = serialize(model, args.epochs, args.seed, len(train_corpus), len(dev_corpus), dev_acc)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "out": str(args.out),
                "feature_count": payload["feature_count"],
                "tag_count": payload["tag_count"],
                "dev_accuracy": payload["metadata"]["dev_accuracy"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
