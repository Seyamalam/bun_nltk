use regex_lite::Regex;
use std::sync::OnceLock;
#[path = "tokenizers_toktok_data.rs"]
mod data;

pub(super) fn tokenize(text: &str) -> String {
    static RULES: OnceLock<Vec<(Regex, &'static str, u8)>> = OnceLock::new();
    let rules = RULES.get_or_init(|| data::RULES.iter().map(|&(source, replacement, guard)| {
        let space = "\t\n\r\u{b}\u{c}\u{1c}-\u{20}\u{85}\u{a0}\u{1680}\u{2000}-\u{200a}\u{2028}\u{2029}\u{202f}\u{205f}\u{3000}";
        let source = if source == r"(:\/\/)[\S+\.\S+\/\S+][\/]" {
            format!(r"(:\/\/)[^{space}][\/]")
        } else {
            source.replace(r"\S", &format!("[^{space}]")).replace(r"\s", &format!("[{space}]"))
        };
        let source = super::super::regexp_tokenizer::translate(&source, 32).expect("static Toktok translation");
        (Regex::new(&source).expect("static Toktok rule"), replacement, guard)
    }).collect());
    let mut text = text.to_owned();
    for (regex, replacement, guard) in rules {
        let mut result = String::with_capacity(text.len());
        let mut previous = 0;
        for captures in regex.captures_iter(&text) {
            let m = captures.get(0).unwrap();
            let before = text[..m.start()].chars().next_back();
            let after = &text[m.end()..];
            let next = after.chars().next();
            let end = after.is_empty() || after == "\n";
            let accept = match guard {
                1 => !after.starts_with("//"),
                2 => next.is_none_or(super::super::python_space),
                3 => {
                    before != Some(',')
                        && next != Some(',')
                        && !next.is_some_and(|c| {
                            super::super::in_ranges(c, super::super::unicode::DECIMAL)
                        })
                }
                4 | 5 => before != Some('.') && end,
                _ => true,
            };
            if accept {
                result.push_str(&text[previous..m.start()]);
                captures.expand(replacement, &mut result);
                previous = m.end();
            }
        }
        result.push_str(&text[previous..]);
        text = result;
    }
    text.trim_matches(super::super::python_space).to_owned()
}
