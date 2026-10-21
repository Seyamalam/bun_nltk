//! Exact package version-1 heuristic, not NLTK inference. UTF-16 units retain
//! JS indexing and lone surrogates; only ASCII token lookahead is intentional.
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyModel {
    #[serde(default)]
    abbreviations: Vec<String>,
    #[serde(default)]
    collocations: Vec<(String, String)>,
    #[serde(default)]
    sentence_starters: Vec<String>,
    #[serde(default)]
    abbreviation_scores: Vec<(String, f64)>,
    #[serde(default)]
    orthographic_context: Vec<(String, Context)>,
}
#[derive(Default, Deserialize)]
struct Context {
    #[serde(default)]
    lower: f64,
    #[serde(default)]
    upper: f64,
}
struct Prepared {
    abbreviations: HashSet<String>,
    collocations: HashSet<String>,
    starters: HashSet<String>,
    scores: HashMap<String, f64>,
    context: HashMap<String, Context>,
}
fn normalize(s: &str) -> String {
    s.trim_end_matches('.').to_lowercase()
}
fn space(c: u16) -> bool {
    matches!(c, 0x9..=0xd | 0x20 | 0xa0 | 0x1680 | 0x2000..=0x200a | 0x2028 | 0x2029 | 0x202f | 0x205f | 0x3000 | 0xfeff)
}
fn closer(c: u16) -> bool {
    matches!(c, 34 | 39 | 41 | 93 | 125)
}
fn alpha(c: u16) -> bool {
    matches!(c, 65..=90 | 97..=122)
}
fn digit(c: u16) -> bool {
    matches!(c, 48..=57)
}
fn word(c: u16) -> bool {
    alpha(c) || digit(c) || c == 46
}
fn prev_token(text: &[u16], mut end: usize) -> String {
    // `end` is the exclusive end (the TS original uses an inclusive index).
    while end > 0
        && (space(text[end - 1])
            || matches!(text[end - 1], 34 | 39 | 40 | 41 | 91 | 93 | 123 | 125))
    {
        end -= 1;
    }
    let mut start = end;
    while start > 0 && word(text[start - 1]) {
        start -= 1;
    }
    String::from_utf16_lossy(&text[start..end])
}
struct Look {
    lower: String,
    first: u16,
}
fn next_token(text: &[u16], mut start: usize) -> Option<Look> {
    while start < text.len() && (space(text[start]) || closer(text[start])) {
        start += 1;
    }
    let mut end = start;
    while end < text.len() && word(text[end]) {
        end += 1;
    }
    (end > start).then(|| Look {
        lower: String::from_utf16_lossy(&text[start..end]).to_lowercase(),
        first: text[start],
    })
}
fn should_split(text: &[u16], i: usize, m: &Prepared) -> bool {
    let punct = text[i];
    let prev = i.checked_sub(1).map(|j| text[j]).unwrap_or(0);
    let next = text.get(i + 1).copied().unwrap_or(0);
    if punct == 46
        && (digit(prev) && digit(next)
            || next == 46
            || (alpha(next) && text.get(i + 2) == Some(&46)))
    {
        return false;
    }
    let prev = normalize(&prev_token(text, i));
    let Some(look) = next_token(text, i + 1) else {
        return true;
    };
    let upper = matches!(look.first, 65..=90);
    let lower = matches!(look.first, 97..=122);
    if punct == 46 && prev.len() == 1 && prev.bytes().all(|b| b.is_ascii_alphabetic()) && upper {
        return false;
    }
    if punct == 46 && matches!(prev.as_str(), "a.m" | "p.m") {
        return false;
    }
    if punct == 46 && m.abbreviations.contains(&prev) {
        if matches!(prev.as_str(), "dr" | "prof") && upper {
            return false;
        }
        if lower {
            return false;
        }
        if m.context
            .get(&look.lower)
            .is_some_and(|c| c.lower > c.upper * 1.5)
        {
            return false;
        }
        if m.collocations
            .contains(&format!("{prev}\u{1}{}", look.lower))
        {
            return false;
        }
        let starter = m.starters.contains(&look.lower);
        if m.scores.get(&prev).copied().unwrap_or(0.0) >= 0.75 && !starter {
            return false;
        }
        if !upper && !starter {
            return false;
        }
    }
    if upper || digit(look.first) || matches!(look.first, 34 | 39 | 40) || matches!(punct, 33 | 63)
    {
        return true;
    }
    if lower && !m.starters.contains(&look.lower) {
        return false;
    }
    true
}
pub fn spans(text: &[u16], model: LegacyModel) -> Vec<(usize, usize)> {
    let m = Prepared {
        abbreviations: model
            .abbreviations
            .into_iter()
            .map(|s| normalize(&s))
            .collect(),
        collocations: model
            .collocations
            .into_iter()
            .map(|(a, b)| format!("{}\u{1}{}", normalize(&a), b.to_lowercase()))
            .collect(),
        starters: model
            .sentence_starters
            .into_iter()
            .map(|s| s.to_lowercase())
            .collect(),
        scores: model
            .abbreviation_scores
            .into_iter()
            .map(|(s, v)| (normalize(&s), v))
            .collect(),
        context: model
            .orthographic_context
            .into_iter()
            .map(|(s, c)| {
                (
                    s.to_lowercase(),
                    Context {
                        lower: c.lower.max(0.0),
                        upper: c.upper.max(0.0),
                    },
                )
            })
            .collect(),
    };
    let mut result = Vec::new();
    let mut start = 0;
    let mut append = |mut start: usize, mut end: usize| {
        while start < end && space(text[start]) {
            start += 1;
        }
        while end > start && space(text[end - 1]) {
            end -= 1;
        }
        if end > start {
            result.push((start, end));
        }
    };
    for i in 0..text.len() {
        if !matches!(text[i], 46 | 33 | 63) || !should_split(text, i, &m) {
            continue;
        }
        let mut end = i + 1;
        while end < text.len() && closer(text[end]) {
            end += 1;
        }
        append(start, end);
        start = end;
    }
    append(start, text.len());
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn javascript_spaces_and_surrogates() {
        let text: Vec<_> = "\u{feff}Hello.\u{85}Next.  ".encode_utf16().collect();
        assert_eq!(spans(&text, LegacyModel::default()), [(1, 7), (7, 13)]);
        assert_eq!(
            spans(&[0xd800, 46, 32, 65, 46], LegacyModel::default()),
            [(0, 2), (3, 5)]
        );
    }
}
