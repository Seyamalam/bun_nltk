"""Generate fixed NLTK 3.10.3 rules/entities; never execute Python at runtime."""
import html.entities
import pathlib
import sys
import unicodedata
import nltk
import regex
from nltk.tokenize import ToktokTokenizer
from nltk.tokenize.casual import REGEXPS, PHONE_REGEX, EMOTICONS

assert sys.version_info[:3] == (3, 14, 4)
assert nltk.__version__ == "3.10.3"
assert regex.__version__ == "2026.9.29"
root = pathlib.Path(__file__).resolve().parents[1] / "rust/src"

def raw(s):
    return 'r###"' + s + '"###'

rows = ["// Generated from pinned NLTK ToktokTokenizer.TOKTOK_REGEXES.",
        "pub const RULES: &[(&str, &str, u8)] = &["]
for pattern, replacement in ToktokTokenizer.TOKTOK_REGEXES:
    source = pattern.pattern
    guard = 0
    if source == r":(?!//)":
        source, guard = ":", 1
    elif source == r"\?(?!\S)":
        source, guard = r"\?", 2
    elif source == r"(?<!,)([,،])(?![,\d])":
        source, guard = "([,،])", 3
    elif source == r"(?<!\.)\.$":
        source, guard = r"\.", 4
    elif source.startswith(r"(?<!\.)\.\s*"):
        source, guard = source.replace(r"(?<!\.)", "").removesuffix("$"), 5
    # Rust's interpolation must delimit numeric capture references.
    for i in range(1, 10):
        replacement = replacement.replace("\\" + str(i), "${" + str(i) + "}")
    rows.append(f"    ({raw(source)}, {raw(replacement)}, {guard}),")
rows.append("];")
(root / "tokenizers_toktok_data.rs").write_text("\n".join(rows) + "\n")

rows = ["// Generated from Python html.entities.name2codepoint (HTML4, as NLTK uses).",
        "pub const ENTITIES: &[(&str, char)] = &["]
rows.extend(f'    ("{name}", \'\\u{{{cp:x}}}\'),' for name, cp in sorted(html.entities.name2codepoint.items()))
rows.append("];")
(root / "tokenizers_entities.rs").write_text("\n".join(rows) + "\n")

rows = ["// Generated from pinned nltk.tokenize.casual; unsupported lookarounds handled by the scanner.",
        f"pub const PHONE: &str = {raw(PHONE_REGEX)};",
        f"pub const EMOTICON: &str = {raw(EMOTICONS)};",
        "pub const PATTERNS: &[&str] = &["]
rows.extend(f"    {raw(pattern)}," for pattern in REGEXPS)
rows.append("];")
(root / "tokenizers_tweet_data.rs").write_text("\n".join(rows) + "\n")

def ranges(points):
    result = []
    for cp in points:
        if result and result[-1][1] + 1 == cp:
            result[-1] = result[-1][0], cp
        else:
            result.append((cp, cp))
    return result

rows = ["// Pinned regex-17 LN differences from shared Python-16 WORD; lowercase exclusions."]
for name, predicate in [
    ("LN_ADDITIONS", lambda c: not (c.isalnum() or c == "_") and regex.fullmatch(r"[\p{L}\p{N}]", c)),
    ("LN_REMOVALS", lambda c: (c.isalnum() or c == "_") and not regex.fullmatch(r"[\p{L}\p{N}]", c)),
    ("UNASSIGNED_CASED", lambda c: unicodedata.category(c) == "Cn" and regex.fullmatch(r"\p{Cased}", c)),
]:
    rows.append(f"pub const {name}: &[(u32, u32)] = &[")
    rows.extend(f"    (0x{a:x}, 0x{b:x})," for a, b in ranges(cp for cp in range(0x110000) if predicate(chr(cp))))
    rows.append("];")
(root / "tokenizers_tweet_unicode.rs").write_text("\n".join(rows) + "\n")
