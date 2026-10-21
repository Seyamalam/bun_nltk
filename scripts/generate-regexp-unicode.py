"""Pinned redos/regex V0 classes and directed simple IGNORECASE mappings."""
import pathlib
import runpy
import sys

import nltk
import regex
from regex import _regex

ranges = runpy.run_path(str(pathlib.Path(__file__).with_name("generate-tokenizer-unicode.py")))["ranges"]


def main():
    assert sys.version_info[:3] == (3, 14, 4), sys.version
    assert nltk.__version__ == "3.10.3", nltk.__version__
    assert regex.__version__ == "2026.9.29", regex.__version__
    rows = ["// Generated: Python 3.14.4, NLTK 3.10.3, regex 2026.9.29 V0."]
    rows.append("pub const DECIMAL: &[(u32, u32)] = &[")
    rows.extend(f"    (0x{a:x}, 0x{b:x})," for a, b in ranges(lambda c: regex.fullmatch(r"\d", c) is not None))
    rows.append("];")
    rows.append("pub const CASE_PAIRS: &[(u32, u32)] = &[")
    for cp in range(0x110000):
        if 0xD800 <= cp <= 0xDFFF:
            continue
        for other in _regex.get_all_cases(0, cp):
            if other != cp:
                rows.append(f"    (0x{cp:x}, 0x{other:x}),")
    rows.append("];")
    root = pathlib.Path(__file__).resolve().parents[1]
    target = root / "rust/src/regexp_unicode.rs"
    content = "\n".join(rows) + "\n"
    if "--check" in sys.argv[1:]:
        if not target.exists() or target.read_text() != content:
            raise SystemExit(f"{target} does not match the pinned generator")
    else:
        target.write_text(content)


if __name__ == "__main__":
    main()
