//! Fixed ordered NLTK casual patterns, with bounded lookaround guards in Rust.
use super::super::{in_ranges, regexp_tokenizer, unicode, Request};
use regex_lite::Regex;
use std::sync::OnceLock;
#[path = "tokenizers_tweet_data.rs"]
mod data;
#[path = "tokenizers_entities.rs"]
mod entities;
#[path = "tokenizers_tweet_unicode.rs"]
mod tables;

fn compile(source: &str) -> Regex {
    let source =
        regexp_tokenizer::translate(source, 32 | 2 | 64).expect("static Tweet translation");
    Regex::new(&format!("^(?:{source})"))
        .unwrap_or_else(|e| panic!("static Tweet pattern {source}: {e}"))
}

struct Patterns {
    url: Regex,
    domain: Regex,
    phone: Regex,
    words: Regex,
    emoticon: Regex,
}
fn patterns() -> &'static Patterns {
    static PATTERNS: OnceLock<Patterns> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        let (url, domain) = data::PATTERNS[0]
            .split_once("|\t\t\t\t\t# OR, the following to match naked domains:\n")
            .expect("URL split");
        let domain = domain
            .replace("(?<!@)", "")
            .replace("(?!@)", "")
            .replace(r"\b", "");
        let words = data::PATTERNS[1..]
            .iter()
            .map(|p| regexp_tokenizer::translate(p, 32 | 2 | 64).expect("Tweet word translation"))
            .collect::<Vec<_>>()
            .join("|");
        Patterns {
            url: compile(url),
            domain: compile(&domain),
            phone: compile(data::PHONE),
            words: Regex::new(&format!("^(?:{words})")).expect("Tweet words"),
            emoticon: Regex::new(
                &regexp_tokenizer::translate(data::EMOTICON, 32 | 2 | 64).unwrap(),
            )
            .unwrap(),
        }
    })
}

fn numeric_entity(number: &str) -> Option<u32> {
    let (number, radix) = number.strip_prefix('x').map_or((number, 10), |n| (n, 16));
    let (number, negative) = if let Some(n) = number.strip_prefix('+') {
        (n, false)
    } else {
        number
            .strip_prefix('-')
            .map_or((number, false), |n| (n, true))
    };
    let number = if radix == 16 && (number.starts_with("0x") || number.starts_with("0X")) {
        number[2..].strip_prefix('_').unwrap_or(&number[2..])
    } else {
        number
    };
    let mut digits = String::new();
    let mut previous_digit = false;
    for c in number.chars() {
        if c == '_' {
            if !previous_digit {
                return None;
            }
            previous_digit = false;
        } else {
            let digit = if in_ranges(c, unicode::DECIMAL) {
                let cp = c as u32;
                let index = unicode::DECIMAL.partition_point(|&(_, end)| end < cp);
                char::from_digit((cp - unicode::DECIMAL[index].0) % 10, radix)?
            } else {
                c
            };
            if !digit.is_digit(radix) {
                return None;
            }
            digits.push(digit);
            previous_digit = true;
        }
    }
    if !previous_digit {
        return None;
    }
    u32::from_str_radix(&digits, radix)
        .ok()
        .filter(|&cp| !negative || cp == 0)
}

fn entity(body: &str) -> Result<Option<char>, String> {
    if body.starts_with('#') || body.starts_with('x') && body.len() > 1 {
        let number = body.strip_prefix('#').unwrap_or(body);
        // Python int permits single underscores between digits, but not leading,
        // trailing or consecutive underscores (and accepts Unicode decimal digits).
        let Some(cp) = numeric_entity(number) else {
            return Ok(None);
        };
        if (0xd800..=0xdfff).contains(&cp) {
            return Err("TweetTokenizer numeric entity produces a non-scalar surrogate; UTF-8 tokenizer ABI cannot represent it".into());
        }
        if (0x80..=0x9f).contains(&cp) {
            const CP1252: [u32; 32] = [
                0x20ac, 0, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160,
                0x2039, 0x152, 0, 0x17d, 0, 0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013,
                0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0, 0x17e, 0x178,
            ];
            return Ok(char::from_u32(CP1252[(cp - 0x80) as usize]).filter(|&c| c != '\0'));
        }
        Ok(char::from_u32(cp))
    } else {
        Ok(entities::ENTITIES
            .binary_search_by_key(&body, |&(name, _)| name)
            .ok()
            .map(|i| entities::ENTITIES[i].1))
    }
}

fn html(text: &str) -> Result<String, String> {
    static ENTITY: OnceLock<Regex> = OnceLock::new();
    let regex = ENTITY.get_or_init(|| {
        Regex::new(&format!(
            r"^&(#?(x?))([^&;{}]+);",
            &super::super::REGEX_SPACE[1..super::super::REGEX_SPACE.len() - 1]
        ))
        .unwrap()
    });
    // The entity regex is anchored for scan-at-position, avoiding re-scans of
    // adversarial ampersands; a failed match advances by one scalar.
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < text.len() {
        if text[i..].starts_with('&') {
            if let Some(capture) = regex.captures(&text[i..]) {
                let whole = capture.get(0).unwrap();
                if let Some(c) = entity(&whole.as_str()[1..whole.len() - 1])? {
                    out.push(c);
                }
                i += whole.len();
                continue;
            }
        }
        let c = text[i..].chars().next().unwrap();
        out.push(c);
        i += c.len_utf8();
    }
    Ok(out)
}

fn remove_handles(text: &str) -> String {
    let chars: Vec<_> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let ascii_word = |c: char| c.is_ascii_alphanumeric() || c == '_';
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '@'
            && (i == 0 || !(ascii_word(chars[i - 1]) || "!@#$%&*".contains(chars[i - 1])))
        {
            let n = chars[i + 1..]
                .iter()
                .take_while(|&&c| ascii_word(c))
                .count();
            let len = if n >= 15 && chars.get(i + 16) != Some(&'@') {
                15
            } else if n > 0 && n < 15 && chars.get(i + 1 + n) != Some(&'@') {
                n
            } else {
                0
            };
            if len > 0 {
                out.push(' ');
                i += len + 1;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

fn shorten(text: &str, reduce: bool) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        let mut count = 1;
        while chars.peek() == Some(&c) {
            chars.next();
            count += 1;
        }
        let ln = (in_ranges(c, unicode::WORD) && !in_ranges(c, tables::LN_REMOVALS))
            || in_ranges(c, tables::LN_ADDITIONS);
        let hang = !ln;
        if (reduce && c != '\n' && count >= 3) || (hang && count >= 4) {
            count = 3;
        }
        out.extend(std::iter::repeat_n(c, count));
    }
    out
}

pub(super) fn tokenize(request: &Request) -> Result<Vec<String>, String> {
    let mut text = html(&request.text)?;
    if request.strip_handles {
        text = remove_handles(&text);
    }
    text = shorten(&text, request.reduce_len);
    let p = patterns();
    let mut out = Vec::new();
    let mut i = 0;
    let mut domain_run_end = 0;
    let mut domain_has_dot = false;
    while i < text.len() {
        let tail = &text[i..];
        let c = tail.chars().next().unwrap();
        // Cache the ASCII domain-candidate run. Calling an anchored unbounded
        // label regexp at every phone token in a long digit run is quadratic.
        if i >= domain_run_end {
            let run = tail
                .chars()
                .take_while(|c| {
                    c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | 'K' | 'ſ' | 'İ' | 'ı')
                })
                .map(char::len_utf8)
                .sum::<usize>();
            domain_run_end = i + run;
            domain_has_dot = tail[..run].contains('.');
        }
        let protocol = tail
            .get(..4)
            .is_some_and(|s| s.eq_ignore_ascii_case("http"))
            && tail[4..].starts_with([':', 's', 'S', 'ſ']);
        let mut matched = if domain_has_dot || protocol {
            p.url.find(tail)
        } else {
            None
        };
        if matched.is_none() && domain_has_dot && (i == 0 || !text[..i].ends_with('@')) {
            if let Some(mut domain) = p.domain.find(tail) {
                if domain.as_str().ends_with('/') && tail[domain.end()..].starts_with('@') {
                    domain = p.domain.find(&tail[..domain.end() - 1]).unwrap();
                }
                let boundary = domain.end() - usize::from(domain.as_str().ends_with('/'));
                let after = tail[boundary..].chars().next();
                if tail[domain.end()..].chars().next() != Some('@')
                    && !after.is_some_and(|c| in_ranges(c, unicode::REGEX_WORD))
                {
                    matched = Some(domain);
                }
            }
        }
        if matched.is_none() && request.match_phone_numbers {
            matched = p.phone.find(tail);
        }
        if matched.is_none() {
            matched = p.words.find(tail);
        }
        if matched.is_none() && c.is_whitespace() {
            i += c.len_utf8();
            continue;
        }
        let end = matched.map_or(c.len_utf8(), |m| m.end());
        let token = &tail[..end];
        out.push(if !request.preserve_case && !p.emoticon.is_match(token) {
            lowercase(token)
        } else {
            token.to_owned()
        });
        i += end;
    }
    Ok(out)
}

fn lowercase(token: &str) -> String {
    // String::to_lowercase supplies Python's contextual final sigma and İ's
    // expansion. Preserve characters not assigned in Python's pinned UCD16.
    if !token
        .chars()
        .any(|c| in_ranges(c, tables::UNASSIGNED_CASED))
    {
        return token.to_lowercase();
    }
    let mut out = String::new();
    let mut start = 0;
    for (i, c) in token.char_indices() {
        if in_ranges(c, tables::UNASSIGNED_CASED) {
            out.push_str(&token[start..i].to_lowercase());
            out.push(c);
            start = i + c.len_utf8();
        }
    }
    out.push_str(&token[start..].to_lowercase());
    out
}
