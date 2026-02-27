#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from typing import Any

from nltk.lm import KneserNeyInterpolated, Lidstone, MLE
from nltk.lm.preprocessing import padded_everygram_pipeline


def build_model(payload: dict[str, Any]):
    order = int(payload["order"])
    model_name = str(payload["model"])
    gamma = float(payload.get("gamma", 0.1))
    discount = float(payload.get("discount", 0.75))
    sentences = [
        [str(token).lower() for token in sentence]
        for sentence in payload["sentences"]
    ]

    train_data, vocab = padded_everygram_pipeline(order, sentences)
    if model_name == "mle":
        model = MLE(order)
    elif model_name == "lidstone":
        model = Lidstone(gamma, order)
    elif model_name == "kneser_ney_interpolated":
        model = KneserNeyInterpolated(order, discount=discount)
    else:
        raise ValueError(f"unsupported model: {model_name}")

    model.fit(train_data, vocab)
    return model


def perplexity_from_scores(model, payload: dict[str, Any]) -> float:
    order = int(payload["order"])
    pad_left = bool(payload.get("padLeft", True))
    pad_right = bool(payload.get("padRight", True))
    start_token = str(payload.get("startToken", "<s>"))
    end_token = str(payload.get("endToken", "</s>"))
    tokens = [str(tok).lower() for tok in payload["perplexityTokens"]]

    sequence = list(tokens)
    if pad_right:
        sequence.append(end_token)
    if not sequence:
        return float("inf")

    history: list[str] = [start_token] * max(0, order - 1) if pad_left else []
    neg_log2 = 0.0
    for token in sequence:
        context = tuple(history[-(order - 1):]) if order > 1 else ()
        prob = max(float(model.score(token, context)), 1e-12)
        neg_log2 += -math.log2(prob)
        history.append(token)
    return 2 ** (neg_log2 / len(sequence))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()

    payload = json.loads(args.payload)
    model = build_model(payload)

    probe_scores = []
    for probe in payload.get("probes", []):
        word = str(probe["word"]).lower()
        context = tuple(str(item).lower() for item in probe.get("context", []))
        score = float(model.score(word, context))
        probe_scores.append(
            {
                "word": word,
                "context": list(context),
                "score": score,
                "logScore": math.log2(max(score, 1e-12)),
            }
        )

    result = {
        "probeScores": probe_scores,
        "perplexity": perplexity_from_scores(model, payload),
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
