#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from nltk.tokenize.punkt import PunktSentenceTokenizer, PunktTrainer


def run(train_text: str, text: str) -> dict:
    trainer = PunktTrainer()
    trainer.train(train_text, finalize=True, verbose=False)
    tokenizer = PunktSentenceTokenizer(trainer.get_params())
    return {"sentences": tokenizer.tokenize(text)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--train-text", required=True)
    parser.add_argument("--text", required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.train_text, args.text)))
