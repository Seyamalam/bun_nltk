//! NLTK 3.10.3 Treebank and basic tokenizers. Spans count Unicode scalars,
//! matching Python indices, not UTF-8 bytes or JavaScript UTF-16 code units.
use regex_lite::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

use crate::tokenizer_unicode as unicode;
#[path = "regexp_tokenizer.rs"]
mod regexp_tokenizer;

const PY_SPACE: &str = r"[\x09-\x0d\x1c-\x20\x{85}\x{a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}]";
const REGEX_SPACE: &str =
    r"[\x09-\x0d\x20\x{85}\x{a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}]";

fn in_ranges(c: char, ranges: &[(u32, u32)]) -> bool {
    let cp = c as u32;
    let index = ranges.partition_point(|&(_, end)| end < cp);
    ranges.get(index).is_some_and(|&(start, _)| start <= cp)
}

fn python_space(c: char) -> bool {
    c.is_whitespace() || ('\u{1c}'..='\u{1f}').contains(&c)
}

fn decimal_class() -> &'static str {
    static CLASS: OnceLock<String> = OnceLock::new();
    CLASS.get_or_init(|| {
        let mut class = String::from("[");
        for &(start, end) in unicode::DECIMAL {
            class.push_str(&format!(r"\x{{{start:x}}}-\x{{{end:x}}}"));
        }
        class.push(']');
        class
    })
}

fn regex_word_class() -> &'static str {
    static CLASS: OnceLock<String> = OnceLock::new();
    CLASS.get_or_init(|| {
        let mut class = String::from("[");
        for &(start, end) in unicode::REGEX_WORD {
            class.push_str(&format!(r"\x{{{start:x}}}-\x{{{end:x}}}"));
        }
        class.push(']');
        class
    })
}

struct Rule {
    regex: Regex,
    replacement: &'static str,
    not_followed_by_period: bool,
}

// regex-lite has no nested classes: expand \s to the class body inside
// an enclosing [...] and to the full class outside one.
fn expand_python_space(source: &str) -> String {
    let body = &PY_SPACE[1..PY_SPACE.len() - 1];
    let mut out = String::with_capacity(source.len());
    let mut chars = source.chars().peekable();
    let mut in_class = false;
    let mut class_fresh = false;
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.peek() {
                Some('s') => {
                    chars.next();
                    out.push_str(if in_class { body } else { PY_SPACE });
                }
                Some(&next) => {
                    out.push(c);
                    out.push(next);
                    chars.next();
                }
                None => out.push(c),
            }
            class_fresh = false;
            continue;
        }
        match c {
            '[' if !in_class => {
                in_class = true;
                class_fresh = true;
            }
            ']' if in_class && !class_fresh => in_class = false,
            '^' if class_fresh => {}
            _ => class_fresh = false,
        }
        out.push(c);
    }
    out
}

fn rules(rows: &[(&str, &'static str)]) -> Vec<Rule> {
    rows.iter()
        .map(|&(source, replacement)| {
            // Python re's whitespace includes U+001C..001F. Its decimal table
            // is pinned independently of the regex crate's Unicode version.
            let not_followed_by_period = source.contains(r"(?!\.)");
            let source = expand_python_space(
                &source
                    .replace(
                        r"[^\d]",
                        &format!("[^{}]", &decimal_class()[1..decimal_class().len() - 1]),
                    )
                    .replace(r"(?!\.)", ""),
            );
            let source = if let Some(prefix) = source.strip_suffix('$') {
                // Final-period rules already consume every trailing Python
                // whitespace, so absolute end is equivalent to Python's $.
                format!(r"{prefix}\z")
            } else {
                source
            };
            Rule {
                regex: Regex::new(&source).expect("static NLTK rule"),
                replacement,
                not_followed_by_period,
            }
        })
        .collect()
}

fn apply(mut text: String, rows: &[Rule]) -> String {
    for rule in rows {
        if !rule.not_followed_by_period {
            text = rule.regex.replace_all(&text, rule.replacement).into_owned();
            continue;
        }
        let mut result = String::with_capacity(text.len());
        let mut previous = 0;
        for capture in rule.regex.captures_iter(&text) {
            let matched = capture.get(0).unwrap();
            if text[capture.get(2).unwrap().end()..].starts_with('.') {
                continue;
            }
            result.push_str(&text[previous..matched.start()]);
            capture.expand(rule.replacement, &mut result);
            previous = matched.end();
        }
        result.push_str(&text[previous..]);
        text = result;
    }
    text
}

fn starting() -> &'static [Rule] {
    static RULES: OnceLock<Vec<Rule>> = OnceLock::new();
    RULES.get_or_init(|| {
        rules(&[
            (r#"^\""#, "``"),
            (r"(``)", " ${1} "),
            (r#"([ (\[{<])("|'{2})"#, "${1} `` "),
        ])
    })
}

fn punctuation() -> &'static [Rule] {
    static RULES: OnceLock<Vec<Rule>> = OnceLock::new();
    RULES.get_or_init(|| {
        rules(&[
            (r"([:,])([^\d])", " ${1} ${2}"),
            (r"([:,])(\n?)$", " ${1} ${2}"),
            (r"\.\.\.", " ... "),
            (r"[;@#$%&]", " ${0} "),
            (r#"([^\.])(\.)([\]\)}>"']*)\s*$"#, "${1} ${2}${3} "),
            (r"[?!]", " ${0} "),
            (r"([^'])' ", "${1} ' "),
            (r"[\]\[(){}<>]", " ${0} "),
        ])
    })
}

fn ending() -> &'static [Rule] {
    static RULES: OnceLock<Vec<Rule>> = OnceLock::new();
    RULES.get_or_init(|| {
        rules(&[
            (r"''", " '' "),
            (r#"""#, " '' "),
            (r"([^' ])('[sS]|'[mM]|'[dD]|') ", "${1} ${2} "),
            (r"([^' ])('ll|'LL|'re|'RE|'ve|'VE|n't|N'T) ", "${1} ${2} "),
        ])
    })
}

const PARENS: [(&str, &str); 6] = [
    ("(", "-LRB-"),
    (")", "-RRB-"),
    ("[", "-LSB-"),
    ("]", "-RSB-"),
    ("{", "-LCB-"),
    ("}", "-RCB-"),
];

struct Contraction {
    regex: Regex,
    whitespace_end: bool,
    initial_space: bool,
}

fn python_ignorecase(literal: &str) -> String {
    literal
        .chars()
        .map(|c| match c {
            'i' => "[iIİı]".to_owned(),
            's' => "[sSſ]".to_owned(),
            'k' => "[kKK]".to_owned(),
            'a'..='z' => format!("[{c}{}]", c.to_ascii_uppercase()),
            _ => c.to_string(),
        })
        .collect()
}

fn contractions(reverse: bool) -> &'static [Contraction] {
    static FORWARD: OnceLock<Vec<Contraction>> = OnceLock::new();
    static REVERSE: OnceLock<Vec<Contraction>> = OnceLock::new();
    let cell = if reverse { &REVERSE } else { &FORWARD };
    cell.get_or_init(|| {
        let pairs = [
            ("can", "not"),
            ("d", "'ye"),
            ("gim", "me"),
            ("gon", "na"),
            ("got", "ta"),
            ("lem", "me"),
            ("more", "'n"),
            ("wan", "na"),
            ("'t", "is"),
            ("'t", "was"),
        ];
        pairs
            .iter()
            .enumerate()
            .map(|(i, &(left, right))| {
                // Python's ASCII IGNORECASE adds dotted/dotless I, long S and
                // Kelvin K. Expand this fixed vocabulary instead of linking a
                // full Unicode case-fold table into WASM.
                let source = format!(
                    "{}({}){}({})",
                    if i >= 8 { " " } else { "" },
                    python_ignorecase(left),
                    if reverse { PY_SPACE } else { "" },
                    python_ignorecase(right)
                );
                Contraction {
                    regex: Regex::new(&source).expect("static contraction"),
                    whitespace_end: i == 7,
                    initial_space: i >= 8,
                }
            })
            .collect()
    })
}

fn contract(mut text: String, reverse: bool) -> String {
    let rows = contractions(reverse);
    let indices: Vec<usize> = if reverse {
        (8..10).chain(0..8).collect()
    } else {
        (0..10).collect()
    };
    for i in indices {
        let row = &rows[i];
        let mut result = String::with_capacity(text.len());
        let mut previous = 0;
        for capture in row.regex.captures_iter(&text) {
            let matched = capture.get(0).unwrap();
            let before = text[..matched.start()].chars().next_back();
            let after = text[matched.end()..].chars().next();
            if (!row.initial_space && before.is_some_and(|c| in_ranges(c, unicode::WORD)))
                || (row.whitespace_end && !after.is_some_and(python_space))
                || (!row.whitespace_end && after.is_some_and(|c| in_ranges(c, unicode::WORD)))
            {
                continue;
            }
            result.push_str(&text[previous..matched.start()]);
            if !reverse {
                result.push(' ');
            }
            result.push_str(capture.get(1).unwrap().as_str());
            if !reverse {
                result.push(' ');
            }
            result.push_str(capture.get(2).unwrap().as_str());
            if !reverse {
                result.push(' ');
            }
            previous = matched.end();
        }
        result.push_str(&text[previous..]);
        text = result;
    }
    text
}

pub fn treebank(text: &str, convert_parentheses: bool) -> Result<Vec<String>, String> {
    let mut text = apply(text.to_owned(), starting());
    text = apply(text, punctuation());
    if convert_parentheses {
        for (plain, ptb) in PARENS {
            text = text.replace(plain, ptb);
        }
    }
    text = text.replace("--", " -- ");
    text = apply(format!(" {text} "), ending());
    text = contract(text, false);
    Ok(text
        .split(python_space)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect())
}

fn detokenizer_ending() -> &'static [Rule] {
    static RULES: OnceLock<Vec<Rule>> = OnceLock::new();
    RULES.get_or_init(|| {
        rules(&[
            (r"([^' ])\s('ll|'LL|'re|'RE|'ve|'VE|n't|N'T) ", "${1}${2} "),
            (r"([^' ])\s('[sS]|'[mM]|'[dD]|') ", "${1}${2} "),
            (r"([^'\s])\s('')", "${1}${2}"),
            (r#"([,.;:!?'])\s+("|'')"#, "${1}${2}"),
            (r"('')\s([.,:)\]>};%])", "${1}${2}"),
            (r"''", "\""),
            (r#"([,.;:!?])"(')"#, "${1}${2}\""),
        ])
    })
}

fn detokenizer_padding() -> &'static [Rule] {
    static RULES: OnceLock<Vec<Rule>> = OnceLock::new();
    RULES.get_or_init(|| {
        rules(&[
            (r"([\[({<])\s", "${1}"),
            (r"\s([\])}>])", "${1}"),
            (r"([\])}>])\s([:;,.])", "${1}${2}"),
            (r"([^'])\s'\s", "${1}' "),
            (r"\s([?!])", "${1}"),
            (r#"([^\.])\s(\.)(?!\.)([\]\)}>"']*)"#, "${1}${2}${3}"),
            (r"([#$])\s", "${1}"),
            (r"\s([;%])", "${1}"),
            (r"\s\.\.\.\s", "..."),
            (r"\s([:,])", "${1}"),
            (r"([ (\[{<])\s``", "${1}``"),
            (r"(``)\s", "${1}"),
            (r"``", "\""),
        ])
    })
}

pub fn detokenize(tokens: &[String], convert_parentheses: bool) -> Result<String, String> {
    let mut text = contract(format!(" {} ", tokens.join(" ")), true);
    text = apply(text, detokenizer_ending());
    text = text.trim_matches(python_space).replace(" -- ", "--");
    if convert_parentheses {
        for (plain, ptb) in PARENS {
            text = text.replace(ptb, plain);
        }
    }
    text = apply(text, detokenizer_padding());
    Ok(text.trim_matches(python_space).to_owned())
}

pub fn treebank_spans(text: &str) -> Result<Vec<(usize, usize)>, String> {
    let mut tokens = treebank(text, false)?;
    if text.contains('"') || text.contains("''") {
        static QUOTES: OnceLock<Regex> = OnceLock::new();
        let regex = QUOTES.get_or_init(|| Regex::new(r#"``|'{2}|""#).unwrap());
        let mut quotes = regex.find_iter(text);
        for token in &mut tokens {
            if matches!(token.as_str(), "\"" | "``" | "''") {
                *token = quotes
                    .next()
                    .ok_or("quote alignment exhausted")?
                    .as_str()
                    .to_owned();
            }
        }
    }
    let mut byte = 0;
    let mut scalar = 0;
    let mut spans = Vec::with_capacity(tokens.len());
    for token in tokens {
        let offset = text[byte..]
            .find(&token)
            .ok_or_else(|| format!("substring {token:?} not found in {text:?}"))?;
        scalar += text[byte..byte + offset].chars().count();
        byte += offset;
        let end = scalar + token.chars().count();
        spans.push((scalar, end));
        scalar = end;
        byte += token.len();
    }
    Ok(spans)
}

fn simple_regex(kind: &str) -> Option<&'static Regex> {
    static WORD: OnceLock<Regex> = OnceLock::new();
    static SPACE: OnceLock<Regex> = OnceLock::new();
    static BLANK: OnceLock<Regex> = OnceLock::new();
    static LINE: OnceLock<Regex> = OnceLock::new();
    Some(match kind {
        "wordpunct" => WORD.get_or_init(|| {
            let word = regex_word_class();
            let word_body = &word[1..word.len() - 1];
            let space_body = &REGEX_SPACE[1..REGEX_SPACE.len() - 1];
            let source = format!(r"{word}+|[^{word_body}{space_body}]+");
            Regex::new(&source).unwrap()
        }),
        "whitespace" => SPACE.get_or_init(|| Regex::new(&format!("{REGEX_SPACE}+")).unwrap()),
        "blankline" => BLANK.get_or_init(|| {
            Regex::new(&format!(r"{REGEX_SPACE}*\n{REGEX_SPACE}*\n{REGEX_SPACE}*")).unwrap()
        }),
        "line" => LINE.get_or_init(|| Regex::new(&format!(r"\n({REGEX_SPACE}+\n)*")).unwrap()),
        _ => return None,
    })
}

fn gap_spans(text: &str, regex: &Regex, discard_empty: bool) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();
    let mut left = 0;
    for matched in regex.find_iter(text) {
        if matched.start() != left {
            spans.push((left, matched.start()));
        }
        left = matched.end();
    }
    if !discard_empty || left != text.len() {
        spans.push((left, text.len()));
    }
    spans
}

fn delimiter_spans(text: &str, delimiter: &str) -> Vec<(usize, usize)> {
    let mut left = 0;
    let mut spans = Vec::new();
    for (right, _) in text.match_indices(delimiter) {
        // Preserve NLTK string_span_tokenize's unusual leading/trailing empty
        // behavior (different from str.split's tokens).
        if right != 0 {
            spans.push((left, right));
        }
        left = right + delimiter.len();
    }
    if left != text.len() {
        spans.push((left, text.len()));
    }
    spans
}

fn scalar_spans(text: &str, bytes: Vec<(usize, usize)>) -> Vec<(usize, usize)> {
    let mut result = Vec::with_capacity(bytes.len());
    let mut previous = 0;
    let mut scalar = 0;
    for (left, right) in bytes {
        scalar += text[previous..left].chars().count();
        let end = scalar + text[left..right].chars().count();
        result.push((scalar, end));
        scalar = end;
        previous = right;
    }
    result
}

fn line_tokens(text: &str, blanklines: &str) -> Result<Vec<String>, String> {
    if !matches!(blanklines, "keep" | "discard" | "discard-eof") {
        return Err("blanklines must be keep, discard, or discard-eof".into());
    }
    let mut lines = Vec::new();
    let mut left = 0;
    let mut chars = text.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        if matches!(
            c,
            '\n' | '\r'
                | '\u{b}'
                | '\u{c}'
                | '\u{1c}'
                | '\u{1d}'
                | '\u{1e}'
                | '\u{85}'
                | '\u{2028}'
                | '\u{2029}'
        ) {
            lines.push(text[left..i].to_owned());
            left = i + c.len_utf8();
            if c == '\r' && chars.peek().is_some_and(|&(_, next)| next == '\n') {
                left = chars.next().unwrap().0 + 1;
            }
        }
    }
    if left < text.len() {
        lines.push(text[left..].to_owned());
    }
    if blanklines == "discard" {
        lines.retain(|line| !line.trim_end_matches(python_space).is_empty());
    }
    if blanklines == "discard-eof"
        && lines
            .last()
            .is_some_and(|line| line.trim_matches(python_space).is_empty())
    {
        lines.pop();
    }
    Ok(lines)
}

#[derive(Deserialize)]
pub struct Request {
    pub kind: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub tokens: Vec<String>,
    #[serde(default)]
    pub spans: bool,
    #[serde(default)]
    pub convert_parentheses: bool,
    #[serde(default = "default_blanklines")]
    pub blanklines: String,
    #[serde(default)]
    pub pattern: Option<String>,
    #[serde(default)]
    pub gaps: bool,
    #[serde(default = "default_discard_empty")]
    pub discard_empty: bool,
    #[serde(default = "default_regexp_flags")]
    pub flags: u32,
}

fn default_discard_empty() -> bool {
    true
}
fn default_regexp_flags() -> u32 {
    regexp_tokenizer::DEFAULT_FLAGS
}

fn default_blanklines() -> String {
    "discard".into()
}

#[derive(Serialize, Debug)]
#[serde(untagged)]
pub enum Response {
    Tokens(Vec<String>),
    CaptureTokens(Vec<Vec<String>>),
    SplitTokens(Vec<Option<String>>),
    Spans(Vec<(usize, usize)>),
    Text(String),
}

pub fn execute(request: Request) -> Result<Response, String> {
    if request.kind == "regexp" {
        return regexp_tokenizer::execute(&request);
    }
    let text = &request.text;
    if request.kind == "treebank-detokenize" {
        if request.spans {
            return Err("detokenization does not produce spans".into());
        }
        return detokenize(&request.tokens, request.convert_parentheses).map(Response::Text);
    }
    if request.kind == "treebank" {
        return if request.spans {
            treebank_spans(text).map(Response::Spans)
        } else {
            treebank(text, request.convert_parentheses).map(Response::Tokens)
        };
    }
    if request.kind == "line" && !request.spans {
        return line_tokens(text, &request.blanklines).map(Response::Tokens);
    }
    if request.kind == "line"
        && !matches!(
            request.blanklines.as_str(),
            "keep" | "discard" | "discard-eof"
        )
    {
        return Err("blanklines must be keep, discard, or discard-eof".into());
    }
    if matches!(request.kind.as_str(), "space" | "tab") && !request.spans {
        let delimiter = if request.kind == "space" { ' ' } else { '\t' };
        return Ok(Response::Tokens(
            text.split(delimiter).map(str::to_owned).collect(),
        ));
    }
    let bytes = match request.kind.as_str() {
        "space" => delimiter_spans(text, " "),
        "tab" => delimiter_spans(text, "\t"),
        // NLTK passes r"\n" to string_span_tokenize, a literal two-character
        // delimiter rather than a newline. This is intentionally not repaired.
        "line" if request.blanklines == "keep" => delimiter_spans(text, r"\n"),
        "wordpunct" => simple_regex("wordpunct")
            .unwrap()
            .find_iter(text)
            .map(|m| (m.start(), m.end()))
            .collect(),
        "whitespace" | "blankline" | "line" => gap_spans(
            text,
            simple_regex(&request.kind).unwrap(),
            request.kind != "line",
        ),
        _ => return Err(format!("unknown tokenizer: {}", request.kind)),
    };
    if request.spans {
        Ok(Response::Spans(scalar_spans(text, bytes)))
    } else {
        Ok(Response::Tokens(
            bytes
                .into_iter()
                .map(|(start, end)| text[start..end].to_owned())
                .collect(),
        ))
    }
}

#[cfg(test)]
mod tests;
