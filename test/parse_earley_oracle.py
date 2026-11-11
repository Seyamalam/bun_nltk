import json
import sys

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.grammar import CFG
from nltk.parse.chart import demo_grammar
from nltk.parse.earleychart import (
    EarleyChartParser,
    IncrementalBottomUpChartParser,
    IncrementalBottomUpLeftCornerChartParser,
    IncrementalChart,
    IncrementalLeftCornerChartParser,
    IncrementalTopDownChartParser,
)

DEMO_SENT = "I saw John with a dog with my cookie"

PARSERS = {
    "earley": EarleyChartParser,
    "td": IncrementalTopDownChartParser,
    "bu": IncrementalBottomUpChartParser,
    "bu_lc": IncrementalBottomUpLeftCornerChartParser,
    "lc": IncrementalLeftCornerChartParser,
}


def run(kind, tokens):
    grammar = demo_grammar()
    parser = PARSERS[kind](grammar)
    chart = parser.chart_parse(tokens)
    parses = [p.pformat(margin=1e9) for p in chart.parses(grammar.start())]
    by_end = []
    for end in range(chart.num_leaves() + 1):
        by_end.append(len(list(chart.select(end=end))))
    return {
        "parses": parses,
        "edges_by_end": by_end,
        "num_edges": chart.num_edges(),
    }


def run_cfg(kind, grammar_text, tokens):
    grammar = CFG.fromstring(grammar_text)
    parser = PARSERS[kind](grammar)
    chart = parser.chart_parse(tokens)
    return [p.pformat(margin=1e9) for p in chart.parses(grammar.start())]


if __name__ == "__main__":
    payload = json.loads(sys.stdin.read() or "{}")
    out = {}
    for name, call in payload.items():
        if "grammar" in call:
            out[name] = run_cfg(call["kind"], call["grammar"], call["tokens"])
        else:
            out[name] = run(call["kind"], call["tokens"])
    print(json.dumps(out))
