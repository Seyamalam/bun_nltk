# Upstream tracking

Oracle target remains **NLTK 3.10.3 on Python 3.14.4** (see `AGENTS.md`).
This file records what changed in later upstream releases and how each
delta maps onto this port.

## NLTK 3.10.4 (diffed 2026-11-15, wheel vs installed 3.10.3)

3.10.4 is a **security-hardening release**: 205 touched files, the bulk of
which are the `safe_print` sweep (untrusted values routed through
`sanitize_terminal`) plus ReDoS mitigation. Behavior-relevant deltas:

### New modules

- `nltk.termsec` — terminal escape neutralization (CWE-150):
  `sanitize_terminal` (escapes C0/C1 controls, DEL, bidi overrides,
  invisible chars; leaves tabs/newlines/Unicode), `safe_print`,
  `sanitize_csv_field` (re-exported from `nltk.csvsec`).
- `nltk.csvsec` — spreadsheet formula-injection defense (CWE-1236):
  `SafeCsvWriter`, `SafeCsvDictWriter`, `safe_csv_writer`,
  `sanitize_csv_field` (defuses leading `= + - @`, keeps numeric
  sign, refuses int render bombs).
- `nltk.corpus.reader.stopwords_extended` — new reader module.

### Semantic changes in existing code

- `nltk.sem.relextract.ne_chunked` **bug fixed upstream**: 3.10.4 adds
  `import nltk` inside the function, repairing the `NameError: name
  'nltk' is not defined` that 3.10.3 always raises after printing the
  header. Our port reproduces the **3.10.3** crash in `ne_chunked` and
  ships the intended loop as `ne_chunked_fixed` — see
  `docs/MIGRATING_FROM_NLTK.md`.
- `extract_rels` wraps caller-supplied `pattern` in
  `nltk.redos.reharden` (ReDoS wall-clock cap + compile-time source
  guard).
- `in_demo`'s `IN` pattern replaced with the atomic-group form
  `(?>.*\bin\b)(?!\b.+ing)` (same match semantics, O(n) instead of
  O(n²) — CWE-407). Python-only regex feature; JS has no atomic groups,
  so our port keeps the 3.10.3 pattern.
- `semi_rel2reldict` inner loop rewritten as index iteration (same
  output).
- All demo/diagnostic `print` sites became `safe_print` — output bytes
  are identical for clean text; they differ only when content carries
  control characters.

### Not new API

- ~200 of the 205 changed files are the mechanical `safe_print` /
  `reharden` / comment sweep or version bookkeeping; the `nltk/test/`
  tree was removed from the wheel (never shipped API).

## Posture

The pinned oracle, inventory, and all differential evidence stay on
3.10.3. `termsec`/`csvsec`/`stopwords_extended` are pure-stdlib and
implementable if the target is bumped to 3.10.4; none are mapped today
because the inventory's review base is 3.10.3.

## Engine-level regex deltas (JS vs Python) — swept 2026-11-10

The unicode/whitespace sweeps converted every Python-`\w`, `\b`, `\s`,
`\S`, `str.split()`, and `str.strip()` site to Python semantics
(`[\p{L}\p{N}_]`, Unicode lookarounds, `PY_WS*` helpers). One class is
deliberately deferred:

- `.` (dot): Python `.` = `[^\n]`; JS `.` = `[^\n\r\u2028\u2029]`. ~1,300
  literal sites make a mechanical sweep high-risk for low-frequency
  gain (corpus text is line-split before most `.`-patterns run, so `\r`
  / `\u2028` / `\u2029` almost never reach them). Convert `[^\n]` at
  individual sites if a real corpus exhibits the divergence.
- `\d`: Python `\d` = `\p{Nd}` (Unicode decimal digits); JS `\d` =
  `[0-9]`. Remaining `\d` sites are ASCII-bound format specs (TIMIT
  filenames, RFC2822 dates, ages, numeric coercion) where Unicode
  digits do not occur; same per-site treatment if needed.
