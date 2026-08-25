#!/usr/bin/env python3
"""Scaling figure: runtime vs input size (log-log) + real-corpus bars.

From paper/bench/scaling_results.json -> paper/figs/scaling.pdf
"""
from __future__ import annotations

import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "bench", "scaling_results.json")))

RUNNERS = [
    ("python_ms", "Python NLTK", "#b04a4a"),
    ("native_ms", "bun_nltk native", "#3f7d3f"),
    ("wasm_ms", "bun_nltk WASM", "#4a76b0"),
]
SIZES = [10, 100, 1024, 10240]
SIZE_LABELS = ["10 KB", "100 KB", "1 MB", "10 MB"]
TASKS = [("tokenize", "Word tokenize"), ("punkt", "Punkt sentence split"), ("bigrams", "Bigram PMI top-30")]

fig = plt.figure(figsize=(12.0, 4.6))
gs = fig.add_gridspec(1, 4, width_ratios=[1.15, 1.15, 1.15, 1.35], wspace=0.32)

# --- log-log scaling panels
for i, (task_key, title) in enumerate(TASKS):
    ax = fig.add_subplot(gs[0, i])
    rows = data["size_scaling_kb"][task_key]
    for key, name, color in RUNNERS:
        ys = [rows[str(s)][key] for s in SIZES]
        ax.plot(SIZES, ys, marker="o", markersize=4.5, linewidth=1.8, label=name, color=color)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xticks(SIZES, SIZE_LABELS, fontsize=8)
    ax.set_title(title, fontsize=10)
    if i == 0:
        ax.set_ylabel("wall-clock ms (log)", fontsize=9)
    ax.grid(alpha=0.25, linewidth=0.5)
    ax.set_axisbelow(True)

# --- real corpus panel
ax = fig.add_subplot(gs[0, 3])
real = data.get("real_datasets", {})
labels, py_vals, nat_vals, wasm_vals = [], [], [], []
for name, entry in real.items():
    if not isinstance(entry, dict) or entry.get("skipped"):
        continue
    tim = entry.get("timings", {})
    if f"tokenize_python_ms" in tim:
        labels.append(name)
        py_vals.append(tim["tokenize_python_ms"])
        nat_vals.append(tim["tokenize_native_ms"])
        wasm_vals.append(tim["tokenize_wasm_ms"])

x = np.arange(len(labels))
w = 0.26
ax.bar(x - w, py_vals, w, label="Python", color="#b04a4a")
ax.bar(x, nat_vals, w, label="Native", color="#3f7d3f")
ax.bar(x + w, wasm_vals, w, label="WASM", color="#4a76b0")
ax.set_yscale("log")
ax.set_xticks(x, [l.capitalize() for l in labels], fontsize=9)
ax.set_title("Real corpora: word tokenize", fontsize=10)
ax.grid(axis="y", alpha=0.25, linewidth=0.5)
ax.set_axisbelow(True)

handles, _ = ax.get_legend_handles_labels()
fig.legend(handles, [n for _, n, _ in RUNNERS], loc="lower center", ncol=3, fontsize=9, frameon=False, bbox_to_anchor=(0.5, -0.03))
fig.suptitle("Scaling with input size (log-log) and real corpora (lower is better)", fontsize=12)
fig.tight_layout(rect=(0, 0.07, 1, 0.95))
fig.savefig(os.path.join(HERE, "figs", "scaling.pdf"), bbox_inches="tight")
print("wrote paper/figs/scaling.pdf")

# speedup summary for the caption
for task_key, title in TASKS:
    rows = data["size_scaling_kb"][task_key]
    sp = [rows[str(s)]["python_ms"] / rows[str(s)]["native_ms"] for s in SIZES]
    print(f"{title}: native speedup at sizes = {[round(v,1) for v in sp]}")
