#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from nltk.tokenize import MWETokenizer, ToktokTokenizer, TreebankWordTokenizer, TweetTokenizer, WordPunctTokenizer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()

    payload = json.loads(args.payload)
    text_treebank = str(payload.get("text_treebank", payload.get("text", "")))
    text_wordpunct = str(payload.get("text_wordpunct", payload.get("text", "")))
    text_toktok = str(payload.get("text_toktok", payload.get("text", "")))
    text_tweet = str(payload.get("text_tweet", payload.get("text", "")))
    tweet_options = payload.get("tweet_options", {}) or {}
    mwe_tokens = [str(x) for x in payload.get("mwe_tokens", [])]
    mwes = [[str(part) for part in row] for row in payload.get("mwes", [])]
    separator = str(payload.get("separator", "_"))

    tweet = TweetTokenizer(
        preserve_case=bool(tweet_options.get("preserveCase", True)),
        strip_handles=bool(tweet_options.get("stripHandles", False)),
        reduce_len=bool(tweet_options.get("reduceLen", False)),
        match_phone_numbers=bool(tweet_options.get("matchPhoneNumbers", True)),
    )

    mwe = MWETokenizer(mwes, separator=separator)

    out = {
        "treebank": TreebankWordTokenizer().tokenize(text_treebank),
        "wordpunct": WordPunctTokenizer().tokenize(text_wordpunct),
        "toktok": ToktokTokenizer().tokenize(text_toktok),
        "tweet": tweet.tokenize(text_tweet),
        "mwe": mwe.tokenize(mwe_tokens),
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()
