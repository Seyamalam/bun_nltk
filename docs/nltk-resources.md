# Official NLTK resources, independently of CI activation

Resource provisioning is explicit and separate from library imports. Nothing
activates Semaphore, publishes artifacts, or silently calls `nltk.download`.
The existing `scripts/ci/nltk-data-lock.json` pins an upstream commit, index hash,
and individual archive SHA-256 hashes. The default selection is WordNet, the
English perceptron tagger, and VADER; other locked IDs can be selected explicitly.

Use the pinned Python environment (3.14.4 with NLTK 3.10.3):

```sh
.venv/bin/python3 scripts/nltk-resources.py prepare \
  --data-dir /tmp/opencode/bun-nltk-next-data \
  --report /tmp/opencode/bun-nltk-resource-report.json

# No network access in check mode; missing/corrupt resources fail.
.venv/bin/python3 scripts/nltk-resources.py check \
  --data-dir /tmp/opencode/bun-nltk-next-data

# Run comparisons against these resources, not an incidental home-directory copy.
NLTK_DATA=/tmp/opencode/bun-nltk-next-data PATH="$PWD/.venv/bin:$PATH" bun test ./test --timeout 30000
```

`prepare` downloads only the selected locked archives. Existing corrupt archives
are rejected rather than silently replaced. Archive limits, traversal, duplicate
paths, links, special files, and preexisting symlink destinations are checked.
`check` verifies archive bytes and all extracted members, then loads the selected
resources with the Python data path restricted to the chosen directory. Its
probes establish availability only, not behavioral equivalence with bun_nltk.

The report retains upstream license/copyright text from the hash-locked index.
Review those notices and upstream resource licenses before redistribution. These
large official resources are not added to the npm package: they are development
oracle data or explicitly supplied runtime models. Their availability does not
turn the project's mini WordNet or ASCII perceptron model into full coverage.

Offline security checks:

```sh
.venv/bin/python3 -m unittest discover -s test -p 'test_nltk_resources.py'
```
