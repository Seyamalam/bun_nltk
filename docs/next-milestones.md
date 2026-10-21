# Milestones 2–10 integration ledger

Baseline: `6965c57`. Semaphore activation (#1) is explicitly excluded.
Package limits remain 400 files / 13,000,000 bytes; WASM remains 1,100,000 bytes.
Official oracle: project `.venv`, Python 3.14.4 / NLTK 3.10.3, with hash-locked
resources provisioned in `/tmp/opencode/bun-nltk-next-data`.

## Delegation registry

Eight isolated-worktree T3 tasks were launched with provider instance `opencode`,
model `AgentRouter-responses-gateway/gpt-6.1-sol`, and `variant=high`.
All use this exact task ID prefix, followed by the milestone number:

```
node:delegated-task:command%3Amcp%3A675a115f-6205-4f61-8f5c-7b390257d426%3Adelegate-task%3Anext-nine-20261021-r1-
```

| Milestone | Task suffix | Integration status |
| --- | --- | --- |
| 2 Native provenance/real-host validation | `2` | Running; foreign-host checks blocked |
| 3 Current inventory/evidence audit | `3` | Running |
| 4 Explicit official resources | Parent-owned | Offline tests and live resource check pass |
| 5 Tweet/Toktok/MWE Rust migration | `5` | Running |
| 6 Jaro/Jaro-Winkler/GHD/BLEU contracts | `6` | Running |
| 7 Generic Rust language models | `7` | Running |
| 8 Official-model perceptron features | `8` | Running |
| 9 Tree/grammar/chart contracts | `9` | Running |
| 10 Robustness/performance tooling | `10` | Running |

These are implementation tasks, not completed parity claims. Parent review,
integration, artifact regeneration and full gates remain required. Source-built
Linux validation cannot establish macOS/Windows validation. Native binaries in
the baseline are not fresh provenance evidence merely because they ship.

## Resource evidence

`scripts/nltk-resources.py check` verifies archive and extracted bytes without
downloading, reports license metadata from the locked index, and limits the
Python data search path to the chosen directory. WordNet, English perceptron and
VADER load successfully. These probes establish resource availability, not
algorithm equivalence. Run instructions are in `docs/nltk-resources.md`.
