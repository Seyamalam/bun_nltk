#!/usr/bin/env python3
"""Cross-runtime benchmark figure from paper/bench/results.json.

Grouped bars, log-y, 2-col layout. Output: paper/figs/cross_runtime.pdf
"""
from __future__ import annotations

import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
results = json.load(open(os.path.join(HERE, "bench", "results.json")))["results"]

RUNNERS = [
    ("python_ms", "Python NLTK 3.10", "#b04a4a"),
    ("native_ms", "bun_nltk native", "#3f7d3f"),
    ("wasm_ms", "bun_nltk WASM", "#4a76b0"),
    ("node_ms", "Node.js + WASM", "#8a63b0"),
    ("natural_ms", "npm natural", "#b08a3f"),
]
TASKS = [
    ("tokenize", "Word tokenize\n(1 MB)"),
    ("punkt", "Sentence split\n(1 MB)"),
    ("porter", "Porter stem\n(100k words)"),
    ("collocations", "Bigram PMI\n(1 MB)"),
    ("freqdist", "FreqDist count\n(1 MB)"),
    ("naive_bayes", "Naive Bayes\ntrain+eval"),
    ("ngrams", "Everygrams n=1-3\n(200 sents)"),
    ("lm_perplexity", "KN-3 LM\nperplexity"),
]

fig, axes = plt.subplots(2, 4, figsize=(12.0, 5.6))
plt.rcParams.update({"font.size": 11})

for ax, (task_key, task_label) in zip(axes.flat, TASKS):
    row = results[task_key]
    labels, values, colors = [], [], []
    for key, name, color in RUNNERS:
        v = row.get(key)
        if v is not None and v > 0:
            labels.append(name.split()[0] if key != "python_ms" else "Python")
            values.append(v)
            colors.append(color)
    x = np.arange(len(labels))
    bars = ax.bar(x, values, color=colors, width=0.62)
    ax.set_yscale("log")
    ax.set_xticks(x, labels, fontsize=8, rotation=38, ha="right")
    ax.set_title(task_label, fontsize=10)
    ax.grid(axis="y", alpha=0.25, linewidth=0.5)
    ax.set_axisbelow(True)
    # annotate fastest
    best_i = int(np.argmin(values))
    bars[best_i].set_edgecolor("black")
    bars[best_i].set_linewidth(1.4)

handles = [plt.Rectangle((0, 0), 1, 1, color=c) for _, _, c in RUNNERS]
fig.legend(handles, [n for _, n, _ in RUNNERS], loc="lower center", ncol=5, fontsize=9, frameon=False, bbox_to_anchor=(0.5, -0.02))
fig.suptitle("Wall-clock time by runtime (lower is better, log scale; black outline = fastest)", fontsize=12)
fig.tight_layout(rect=(0, 0.06, 1, 0.96))
fig.savefig(os.path.join(HERE, "figs", "cross_runtime.pdf"), bbox_inches="tight")
print("wrote paper/figs/cross_runtime.pdf")

# Also print the speedup table used in the paper
print(f"{'task':<15} {'Py->native':>10} {'Py->wasm':>10} {'nat/native':>11}")
for tk, _ in TASKS:
    r = results[tk]
    py, nat, wasm = r.get("python_ms"), r.get("native_ms"), r.get("wasm_ms")
    s1 = f"{py / nat:.1f}x" if py and nat else "-"
    s2 = f"{py / wasm:.1f}x" if py and wasm else "-"
    natural = r.get("natural_ms")
    s3 = f"{natural / nat:.1f}x" if natural and nat else "-"
    print(f"{tk:<15} {s1:>10} {s2:>10} {s3:>11}")
