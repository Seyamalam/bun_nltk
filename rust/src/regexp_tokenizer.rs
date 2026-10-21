//! Bounded NLTK redos/regex V0 adapter, not an arbitrary Python regexp engine.
use super::{scalar_spans, unicode};
use std::cell::RefCell;

thread_local! {
    static CACHE: RefCell<Vec<(String, u32, regex_lite::Regex)>> = const { RefCell::new(Vec::new()) };
}

#[path = "regexp_unicode.rs"]
mod tables;

const SUPPORTED_FLAGS: u32 = 2 | 8 | 16 | 32 | 64 | 128;
pub const DEFAULT_FLAGS: u32 = 32 | 8 | 16;

fn unsupported(detail: &str) -> String {
    format!("unsupported RegexpTokenizer construct: {detail}")
}

fn class(mut ranges: Vec<(u32, u32)>, ignore_case: bool, ascii: bool, negated: bool) -> String {
    ranges = merge_ranges(ranges);
    if ignore_case {
        let additions: Vec<_> = tables::CASE_PAIRS
            .iter()
            .filter_map(|&(a, b)| {
                let index = ranges.partition_point(|&(_, end)| end < a);
                ((!ascii || (a < 128 && b < 128))
                    && ranges.get(index).is_some_and(|&(start, _)| start <= a))
                .then_some((b, b))
            })
            .collect();
        ranges.extend(additions);
    }
    let mut out = if negated { "[^" } else { "[" }.to_owned();
    for (a, b) in merge_ranges(ranges) {
        out.push_str(&format!(r"\x{{{a:x}}}"));
        if a != b {
            out.push_str(&format!(r"-\x{{{b:x}}}"));
        }
    }
    out.push(']');
    out
}

fn merge_ranges(mut ranges: Vec<(u32, u32)>) -> Vec<(u32, u32)> {
    ranges.sort_unstable();
    let mut merged: Vec<(u32, u32)> = Vec::new();
    for (a, b) in ranges {
        if let Some(last) = merged.last_mut() {
            if a <= last.1 + 1 {
                last.1 = last.1.max(b);
                continue;
            }
        }
        merged.push((a, b));
    }
    merged
}

fn complement(ranges: &[(u32, u32)]) -> Vec<(u32, u32)> {
    let mut out = Vec::new();
    let mut left = 0;
    for &(a, b) in ranges {
        if left < a {
            out.push((left, a - 1));
        }
        left = b + 1;
    }
    if left <= 0x10ffff {
        out.push((left, 0x10ffff));
    }
    // Rust regex works on scalars, so do not emit surrogate ranges.
    out.into_iter()
        .flat_map(|(a, b)| {
            let mut scalar = Vec::new();
            if a < 0xd800 {
                scalar.push((a, b.min(0xd7ff)));
            }
            if b > 0xdfff {
                scalar.push((a.max(0xe000), b));
            }
            scalar
        })
        .collect()
}

enum Escape {
    Ranges(Vec<(u32, u32)>),
    Anchor(&'static str),
}

fn escape(chars: &[char], i: &mut usize, ascii: bool, in_class: bool) -> Result<Escape, String> {
    let c = *chars.get(*i).ok_or("invalid regexp: trailing backslash")?;
    *i += 1;
    let base: Option<Vec<(u32, u32)>> = match c.to_ascii_lowercase() {
        'w' => Some(if ascii {
            vec![(48, 57), (65, 90), (95, 95), (97, 122)]
        } else {
            unicode::REGEX_WORD.to_vec()
        }),
        'd' => Some(if ascii {
            vec![(48, 57)]
        } else {
            tables::DECIMAL.to_vec()
        }),
        's' => Some(if ascii {
            vec![(9, 13), (32, 32)]
        } else {
            vec![
                (9, 13),
                (32, 32),
                (0x85, 0x85),
                (0xa0, 0xa0),
                (0x1680, 0x1680),
                (0x2000, 0x200a),
                (0x2028, 0x2029),
                (0x202f, 0x202f),
                (0x205f, 0x205f),
                (0x3000, 0x3000),
            ]
        }),
        _ => None,
    };
    if let Some(base) = base {
        return Ok(Escape::Ranges(if c.is_ascii_uppercase() {
            complement(&base)
        } else {
            base
        }));
    }
    let literal = match c {
        'n' => '\n',
        'r' => '\r',
        't' => '\t',
        'f' => '\u{c}',
        'v' => '\u{b}',
        'a' => '\u{7}',
        'b' if in_class => '\u{8}',
        'A' if !in_class => return Ok(Escape::Anchor(r"\A")),
        'Z' | 'z' if !in_class => return Ok(Escape::Anchor(r"\z")),
        'x' | 'u' | 'U' => {
            let n = match c {
                'x' => 2,
                'u' => 4,
                _ => 8,
            };
            let end = *i + n;
            let hex: String = chars
                .get(*i..end)
                .ok_or("invalid regexp: incomplete hex escape")?
                .iter()
                .collect();
            if !hex.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err("invalid regexp: hex escape".into());
            }
            *i = end;
            char::from_u32(u32::from_str_radix(&hex, 16).map_err(|e| e.to_string())?)
                .ok_or_else(|| unsupported("non-scalar escape"))?
        }
        '0'..='9'
        | 'b'
        | 'B'
        | 'N'
        | 'p'
        | 'P'
        | 'g'
        | 'k'
        | 'G'
        | 'K'
        | 'X'
        | 'R'
        | 'm'
        | 'M'
        | 'h'
        | 'H'
        | 'V' => {
            return Err(unsupported(
                "backreferences, boundaries, octal, properties or regex-only escapes",
            ))
        }
        c if c.is_ascii_alphabetic() => {
            return Err(format!("invalid regexp: unknown escape \\{c}"))
        }
        c => c,
    };
    Ok(Escape::Ranges(vec![(literal as u32, literal as u32)]))
}

fn translate(pattern: &str, flags: u32) -> Result<String, String> {
    if flags & !SUPPORTED_FLAGS != 0 {
        return Err(unsupported(
            "flags (including re.ASCII=256 / regex.VERSION1); redos ASCII is 128",
        ));
    }
    if flags & 128 != 0 && flags & 32 != 0 {
        return Err("invalid regexp: ASCII and UNICODE flags are incompatible".into());
    }
    if pattern.len() > 16_384 {
        return Err(unsupported("pattern exceeds 16384 UTF-8 bytes"));
    }
    let ascii = flags & 128 != 0;
    let icase = flags & 2 != 0;
    let chars: Vec<_> = pattern.chars().collect();
    let mut i = 0;
    let mut out = String::new();
    while i < chars.len() {
        let c = chars[i];
        i += 1;
        match c {
            '\\' => match escape(&chars, &mut i, ascii, false)? {
                Escape::Ranges(r) => out.push_str(&class(r, icase, ascii, false)),
                Escape::Anchor(s) => out.push_str(s),
            },
            '[' => {
                let negated = chars.get(i) == Some(&'^');
                if negated {
                    i += 1;
                }
                let mut ranges = Vec::new();
                let mut first = true;
                loop {
                    let c = *chars
                        .get(i)
                        .ok_or("invalid regexp: unclosed character class")?;
                    if c == ']' && !first {
                        i += 1;
                        break;
                    }
                    if c == '[' && chars.get(i + 1) == Some(&':') {
                        return Err(unsupported("POSIX character classes"));
                    }
                    first = false;
                    i += 1;
                    let mut atom = if c == '\\' {
                        match escape(&chars, &mut i, ascii, true)? {
                            Escape::Ranges(r) => r,
                            _ => unreachable!(),
                        }
                    } else {
                        vec![(c as u32, c as u32)]
                    };
                    if chars.get(i) == Some(&'-') && chars.get(i + 1).is_some_and(|&c| c != ']') {
                        i += 1;
                        let end = chars[i];
                        i += 1;
                        let end = if end == '\\' {
                            match escape(&chars, &mut i, ascii, true)? {
                                Escape::Ranges(r) => r,
                                _ => unreachable!(),
                            }
                        } else {
                            vec![(end as u32, end as u32)]
                        };
                        if atom.len() != 1
                            || end.len() != 1
                            || atom[0].0 != atom[0].1
                            || end[0].0 != end[0].1
                            || atom[0].0 > end[0].0
                        {
                            return Err("invalid regexp: character range".into());
                        }
                        atom[0].1 = end[0].0;
                    }
                    ranges.extend(atom);
                    if ranges.len() > 16_384 {
                        return Err(unsupported("character class exceeds 16384 ranges"));
                    }
                }
                out.push_str(&class(ranges, icase, ascii, negated));
            }
            '(' if chars.get(i) == Some(&'?') => {
                if chars.get(i + 1) == Some(&':') {
                    out.push_str("(?:");
                    i += 2;
                } else if chars.get(i + 1) == Some(&'P') && chars.get(i + 2) == Some(&'<') {
                    out.push_str("(?P<");
                    i += 3;
                    while let Some(&c) = chars.get(i) {
                        i += 1;
                        out.push(c);
                        if c == '>' {
                            break;
                        }
                        if !c.is_ascii_alphanumeric() && c != '_' {
                            return Err("invalid regexp: capture name".into());
                        }
                    }
                } else {
                    return Err(unsupported(
                        "lookaround, inline flags, atomic, conditional or extension groups",
                    ));
                }
            }
            '*' | '+' | '?' | '}' if chars.get(i) == Some(&'+') => {
                return Err(unsupported("possessive quantifier"))
            }
            '#' if flags & 64 != 0 => {
                while i < chars.len() && chars[i] != '\n' {
                    i += 1;
                }
            }
            c if flags & 64 != 0 && super::python_space(c) => {}
            '{' => {
                let start = i;
                while chars
                    .get(i)
                    .is_some_and(|c| c.is_ascii_digit() || *c == ',')
                {
                    i += 1;
                }
                if chars.get(i) == Some(&'}') && i > start {
                    out.push('{');
                    out.extend(chars[start..i].iter());
                    out.push('}');
                    i += 1;
                    if chars.get(i) == Some(&'+') {
                        return Err(unsupported("possessive quantifier"));
                    }
                } else {
                    i = start;
                    out.push_str(r"\{");
                }
            }
            '}' => out.push_str(r"\}"),
            '.' | '^' | '$' | '(' | ')' | '|' | '*' | '+' | '?' => out.push(c),
            c => out.push_str(&class(vec![(c as u32, c as u32)], icase, ascii, false)),
        }
        if out.len() > 262_144 {
            return Err(unsupported("expanded pattern exceeds 262144 bytes"));
        }
    }
    // No Rust Unicode/case tables are linked: classes and folds above are pinned.
    let modes = format!(
        "(?{}{})",
        if flags & 8 != 0 { "m" } else { "" },
        if flags & 16 != 0 { "s" } else { "" }
    );
    Ok(if modes == "(?)" { out } else { modes + &out })
}

fn repeated_capture(source: &str) -> Result<bool, String> {
    let chars: Vec<_> = source.chars().collect();
    let mut stack = Vec::new();
    let mut escaped = false;
    let mut in_class = false;
    let mut repeated = false;
    for (i, &c) in chars.iter().enumerate() {
        if escaped {
            escaped = false;
            continue;
        }
        if c == '\\' {
            escaped = true;
            continue;
        }
        if c == '[' {
            in_class = true;
        }
        if in_class {
            if c == ']' {
                in_class = false;
            }
            continue;
        }
        if c == '(' {
            stack.push((
                usize::from(chars.get(i + 1) != Some(&'?') || chars.get(i + 2) == Some(&'P')),
                chars.get(i + 1) != Some(&'?') || chars.get(i + 2) == Some(&'P'),
            ));
        }
        if c == ')' {
            let (captures, own_capture) = stack.pop().unwrap_or((0, false));
            if captures != 0 {
                if let Some(parent) = stack.last_mut() {
                    parent.0 += captures;
                }
                let mut repeats = matches!(chars.get(i + 1), Some('+' | '*'));
                let mut tuple_capture = chars.get(i + 1) == Some(&'+');
                if chars.get(i + 1) == Some(&'{') {
                    let count: String = chars[i + 2..].iter().take_while(|&&c| c != '}').collect();
                    repeats |= count.contains(',') || count.parse::<usize>().is_ok_and(|n| n > 1);
                    tuple_capture = count
                        .split(',')
                        .next()
                        .and_then(|n| n.parse::<usize>().ok())
                        .is_some_and(|n| n > 0)
                        && repeats;
                }
                if repeats {
                    if captures > 1 || !own_capture {
                        return Err(unsupported("nested captures under repetition (Python retains earlier participating captures)"));
                    }
                    if tuple_capture {
                        repeated = true;
                    }
                }
            }
        }
    }
    Ok(repeated)
}

pub(super) fn execute(request: &super::Request) -> Result<super::Response, String> {
    let pattern = request
        .pattern
        .as_deref()
        .ok_or("regexp tokenizer requires pattern")?;
    let regex = CACHE.with(|cache| -> Result<regex_lite::Regex, String> {
        let mut cache = cache.borrow_mut();
        if let Some((_, _, regex)) = cache
            .iter()
            .find(|(p, f, _)| p == pattern && *f == request.flags)
        {
            return Ok(regex.clone());
        }
        let source = translate(pattern, request.flags)?;
        let regex = regex_lite::RegexBuilder::new(&source)
            .size_limit(2 * 1024 * 1024)
            .nest_limit(64)
            .build()
            .map_err(|e| format!("invalid or unsupported regexp: {e}"))?;
        if cache.len() == 16 {
            cache.remove(0);
        }
        cache.push((pattern.to_owned(), request.flags, regex.clone()));
        Ok(regex)
    })?;
    let text = &request.text;
    let repeated = repeated_capture(regex.as_str())?;
    if request.flags & 8 == 0 && regex.as_str().contains('$') && text.ends_with('\n') {
        return Err(unsupported("non-MULTILINE $ with a final newline"));
    }
    if regex.is_match("") && !matches!(pattern, "" | "^" | "$" | r"\A" | r"\Z" | r"\z") {
        return Err(unsupported("nullable consuming patterns (Python permits nonempty matches immediately after empty ones)"));
    }
    let captures: Vec<_> = regex.captures_iter(text).collect();
    if captures.iter().any(|c| c.get(0).unwrap().is_empty())
        && !matches!(pattern, "" | "^" | "$" | r"\A" | r"\Z" | r"\z")
    {
        return Err(unsupported(
            "empty matches in contextual or nullable consuming patterns",
        ));
    }
    if request.spans {
        let mut bytes = Vec::new();
        let mut left = 0;
        for capture in &captures {
            let m = capture.get(0).unwrap();
            if request.gaps {
                if m.start() != left {
                    bytes.push((left, m.start()));
                }
                left = m.end();
            } else {
                bytes.push((m.start(), m.end()));
            }
        }
        if request.gaps && (!request.discard_empty || left != text.len()) {
            bytes.push((left, text.len()));
        }
        return Ok(super::Response::Spans(scalar_spans(text, bytes)));
    }
    if !request.gaps && (regex.captures_len() > 2 || (regex.captures_len() == 2 && repeated)) {
        return Ok(super::Response::CaptureTokens(
            captures
                .iter()
                .map(|c| {
                    (1..regex.captures_len())
                        .map(|i| c.get(i).map_or("", |m| m.as_str()).to_owned())
                        .collect()
                })
                .collect(),
        ));
    }
    let mut tokens = Vec::new();
    let mut left = 0;
    for capture in &captures {
        let m = capture.get(0).unwrap();
        if request.gaps {
            tokens.push(Some(text[left..m.start()].to_owned()));
            for i in 1..regex.captures_len() {
                tokens.push(capture.get(i).map(|m| m.as_str().to_owned()));
            }
            left = m.end();
        } else {
            tokens.push(Some(
                capture
                    .get(usize::from(regex.captures_len() > 1))
                    .map_or("", |m| m.as_str())
                    .to_owned(),
            ));
        }
    }
    if request.gaps {
        tokens.push(Some(text[left..].to_owned()));
        if request.discard_empty {
            tokens.retain(|s| s.as_ref().is_some_and(|s| !s.is_empty()));
        }
    }
    if tokens.iter().any(Option::is_none) {
        Ok(super::Response::SplitTokens(tokens))
    } else {
        Ok(super::Response::Tokens(
            tokens.into_iter().flatten().collect(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn run(pattern: &str, text: &str, gaps: bool, discard: bool, spans: bool) -> String {
        serde_json::to_string(&super::super::execute(serde_json::from_value(serde_json::json!({
            "kind":"regexp", "pattern":pattern, "text":text, "gaps":gaps, "discard_empty":discard, "spans":spans
        })).unwrap()).unwrap()).unwrap()
    }
    #[test]
    fn capture_shapes_and_gap_quirks() {
        assert_eq!(
            run("(a)?(b)", "b ab", false, true, false),
            r#"[["","b"],["a","b"]]"#
        );
        assert_eq!(run("(a)?b", "b", true, false, false), r#"["",null,""]"#);
        assert_eq!(run(",", ",a,,", true, false, true), "[[1,2],[4,4]]");
    }
    #[test]
    fn scalar_classes_and_directed_case() {
        assert_eq!(
            run(r"\w+|\d+", "😀 e\u{301} ² ٣", false, true, false),
            r#"["é","٣"]"#
        );
        let r = regex_lite::Regex::new(&translate("i", 2).unwrap()).unwrap();
        assert_eq!(
            r.find_iter("iIİı").map(|m| m.as_str()).collect::<Vec<_>>(),
            ["i", "I", "İ"]
        );
        assert_eq!(run("", "😀a", false, true, true), "[[0,0],[1,1],[2,2]]");
        assert!(translate(r"(?=a)", DEFAULT_FLAGS)
            .unwrap_err()
            .contains("unsupported"));
    }
}
