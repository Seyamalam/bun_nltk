//! English Punkt inference from NLTK 3.10.3 (Apache-2.0).
//! Offsets are UTF-8 bytes. The trained model is supplied by the caller.
use serde::Serialize;
use std::collections::{HashMap, HashSet};

use crate::tokenizer_unicode as unicode;

fn in_ranges(c: char, ranges: &[(u32, u32)]) -> bool {
    let cp = c as u32;
    let index = ranges.partition_point(|&(_, end)| end < cp);
    ranges.get(index).is_some_and(|&(start, _)| start <= cp)
}

#[derive(Default, Debug)]
pub struct PunktModel {
    pub abbreviations: HashSet<String>,
    pub collocations: HashSet<(String, String)>,
    pub sentence_starters: HashSet<String>,
    pub ortho_context: HashMap<String, u32>,
}

// Python str.isspace includes C0 separators, unlike Unicode White_Space.
pub fn is_space(c: char) -> bool {
    matches!(c, '\u{9}'..='\u{d}' | '\u{1c}'..='\u{20}' | '\u{85}' | '\u{a0}' |
        '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' |
        '\u{202f}' | '\u{205f}' | '\u{3000}')
}

fn nonword(c: char) -> bool {
    ")\";}]*:@'({[‘’“”«»?!".contains(c)
}

fn word_start(c: char) -> bool {
    !"(\"`{[:;&#*@)}]-,".contains(c)
}

pub(crate) fn decimal(c: char) -> bool {
    in_ranges(c, unicode::DECIMAL)
}

pub(crate) fn initial_char(c: char) -> bool {
    // Python alnum covers L* + N* (Nd, Nl, No); Punkt initials exclude Nd.
    c == '_' || (in_ranges(c, unicode::WORD) && !in_ranges(c, unicode::DECIMAL))
}

/// The three alternatives of PunktLanguageVars._re_multi_char_punct.
/// Spaced ellipses require exactly one whitespace scalar between dots.
fn multi_end(chars: &[(usize, char)], i: usize) -> Option<usize> {
    let c = chars[i].1;
    if c == '-' || c == '.' {
        let mut end = i + 1;
        while end < chars.len() && chars[end].1 == c {
            end += 1;
        }
        if end > i + 1 {
            return Some(end);
        }
    }
    if c == '.' {
        let mut end = i;
        let mut pairs = 0;
        while end + 2 < chars.len()
            && chars[end].1 == '.'
            && is_space(chars[end + 1].1)
            && chars[end + 2].1 == '.'
        {
            end += 2;
            pairs += 1;
        }
        if pairs >= 2 {
            return Some(end + 1);
        }
    }
    None
}

fn word_end(chars: &[(usize, char)], i: usize) -> bool {
    if i == chars.len() {
        return true;
    }
    let c = chars[i].1;
    is_space(c)
        || nonword(c)
        || multi_end(chars, i).is_some()
        || (c == ','
            && (i + 1 == chars.len()
                || is_space(chars[i + 1].1)
                || nonword(chars[i + 1].1)
                || multi_end(chars, i + 1).is_some()))
}

#[derive(Debug)]
pub(crate) struct Token<'a> {
    pub(crate) text: &'a str,
    pub(crate) typ: String,
    pub(crate) sentbreak: bool,
    pub(crate) abbr: bool,
    pub(crate) ellipsis: bool,
    pub(crate) initial: bool,
    pub(crate) parastart: bool,
    pub(crate) linestart: bool,
}

impl<'a> Token<'a> {
    fn new(text: &'a str, model: &PunktModel) -> Self {
        let mut chars = text.chars().peekable();
        if chars.peek() == Some(&'-') {
            chars.next();
        }
        if matches!(chars.peek(), Some('.' | ',')) {
            chars.next();
        }
        let numeric = chars.next().is_some_and(decimal)
            && chars.all(|c| decimal(c) || matches!(c, ',' | '.' | '-'));
        let typ = if numeric {
            "##number##".to_owned()
        } else {
            text.to_lowercase()
        };
        let mut c = text.chars();
        let initial =
            c.next().is_some_and(initial_char) && c.next() == Some('.') && c.next().is_none();
        let ellipsis = text.len() >= 2 && text.bytes().all(|b| b == b'.');
        let mut abbr = false;
        let sentbreak = if matches!(text, "." | "?" | "!") {
            true
        } else if ellipsis {
            false
        } else if text.ends_with('.') && !text.ends_with("..") {
            let base = text[..text.len() - 1].to_lowercase();
            abbr = model.abbreviations.contains(&base)
                || model
                    .abbreviations
                    .contains(base.rsplit('-').next().unwrap());
            !abbr
        } else {
            false
        };
        Self {
            text,
            typ,
            sentbreak,
            abbr,
            ellipsis,
            initial,
            parastart: false,
            linestart: false,
        }
    }

    pub(crate) fn no_period(&self) -> &str {
        if self.typ.len() > 1 && self.typ.ends_with('.') {
            &self.typ[..self.typ.len() - 1]
        } else {
            &self.typ
        }
    }

    pub(crate) fn no_sent_period(&self) -> &str {
        if self.sentbreak {
            self.no_period()
        } else {
            &self.typ
        }
    }

    pub(crate) fn upper(&self) -> bool {
        self.text.chars().next().unwrap().is_uppercase()
    }
    pub(crate) fn lower(&self) -> bool {
        self.text.chars().next().unwrap().is_lowercase()
    }
}

pub(crate) fn tokenize<'a>(text: &'a str, model: &PunktModel) -> Vec<Token<'a>> {
    let mut result = Vec::new();
    let mut para = false;
    // NLTK tokenizes each line independently, including spaced ellipses.
    for line in text.split('\n') {
        if line.trim_matches(is_space).is_empty() {
            para = true;
            continue;
        }
        let mut first = true;
        let chars: Vec<_> = line.char_indices().collect();
        let mut i = 0;
        while i < chars.len() {
            if is_space(chars[i].1) {
                i += 1;
                continue;
            }
            let start = i;
            if let Some(end) = multi_end(&chars, i) {
                i = end;
            } else if word_start(chars[i].1) {
                i += 1;
                while !word_end(&chars, i) {
                    i += 1;
                }
            } else {
                i += 1;
            }
            let stop = if i == chars.len() {
                line.len()
            } else {
                chars[i].0
            };
            let mut token = Token::new(&line[chars[start].0..stop], model);
            token.linestart = first;
            token.parastart = first && para;
            first = false;
            para = false;
            result.push(token);
        }
    }
    result
}

impl PunktModel {
    fn heuristic(&self, t: &Token<'_>) -> Option<bool> {
        if matches!(t.text, ";" | ":" | "," | "." | "!" | "?") {
            return Some(false);
        }
        let context = self
            .ortho_context
            .get(t.no_sent_period())
            .copied()
            .unwrap_or(0);
        if t.upper() && context & 112 != 0 && context & 4 == 0 {
            return Some(true);
        }
        if t.lower() && (context & 14 != 0 || context & 16 == 0) {
            return Some(false);
        }
        None
    }

    fn contains_break(&self, text: &str) -> bool {
        let mut tokens = tokenize(text, self);
        for i in 0..tokens.len().saturating_sub(1) {
            let (left, right) = tokens.split_at_mut(i + 1);
            let t = &mut left[i];
            let next = &right[0];
            self.second_pass(t, next);
            if t.sentbreak {
                return true;
            }
        }
        false
    }

    fn second_pass(&self, t: &mut Token<'_>, next: &Token<'_>) -> Option<&'static str> {
        if !t.text.ends_with('.') {
            return None;
        }
        if self
            .collocations
            .contains(&(t.no_period().to_owned(), next.no_sent_period().to_owned()))
        {
            t.sentbreak = false;
            t.abbr = true;
            return Some("known collocation (both words)");
        }
        let h = self.heuristic(next);
        if (t.abbr || t.ellipsis) && !t.initial {
            if h == Some(true) {
                t.sentbreak = true;
                return Some("abbreviation + orthographic heuristic");
            }
            if next.upper() && self.sentence_starters.contains(next.no_sent_period()) {
                t.sentbreak = true;
                return Some("abbreviation + frequent sentence starter");
            }
        }
        if t.initial || t.no_period() == "##number##" {
            if h == Some(false) {
                t.sentbreak = false;
                t.abbr = true;
                return Some("initial + orthographic heuristic");
            }
            if h.is_none()
                && t.initial
                && next.upper()
                && self
                    .ortho_context
                    .get(next.no_sent_period())
                    .copied()
                    .unwrap_or(0)
                    & 112
                    == 0
            {
                t.sentbreak = false;
                t.abbr = true;
                return Some("initial + special orthographic heuristic");
            }
        }
        None
    }

    fn contexts(&self, text: &str) -> Vec<(usize, usize, usize, Option<usize>)> {
        let chars: Vec<_> = text.char_indices().collect();
        // (preceding-word start, punctuation end, after-token end, next-token start)
        let mut contexts = Vec::new();
        let mut previous = None;
        let (mut slice_start, mut slice_end) = (0, 0);
        for (i, &(pos, c)) in chars.iter().enumerate() {
            if !matches!(c, '.' | '?' | '!') || i + 1 == chars.len() {
                continue;
            }
            let punct_end = pos + 1;
            let (after_end, next_start) = if nonword(chars[i + 1].1) {
                (chars[i + 1].0 + chars[i + 1].1.len_utf8(), None)
            } else if is_space(chars[i + 1].1) {
                let mut j = i + 1;
                while j < chars.len() && is_space(chars[j].1) {
                    j += 1;
                }
                if j == chars.len() {
                    continue;
                }
                let next_start = chars[j].0;
                while j < chars.len() && !is_space(chars[j].1) {
                    j += 1;
                }
                (
                    if j == chars.len() {
                        text.len()
                    } else {
                        chars[j].0
                    },
                    Some(next_start),
                )
            } else {
                continue;
            };
            // NLTK intentionally searches only string.whitespace here, and treats
            // a whitespace at relative index zero like no whitespace found.
            let whitespace = text[slice_end..pos]
                .char_indices()
                .rev()
                .find(|(_, c)| " \t\n\r\x0b\x0c".contains(*c))
                .map(|(i, _)| i)
                .unwrap_or(0);
            let start = if whitespace != 0 {
                slice_end + whitespace + 1
            } else {
                slice_start
            };
            if previous.is_some() && slice_end <= start {
                contexts.push(previous.take().unwrap());
            }
            previous = Some((start, punct_end, after_end, next_start));
            slice_start = start;
            slice_end = pos;
        }
        if let Some(context) = previous {
            contexts.push(context);
        }
        contexts
    }

    pub fn debug_decisions(&self, text: &str) -> Result<Vec<DebugDecision>, String> {
        let mut result = Vec::new();
        for (start, end, after_end, _) in self.contexts(text) {
            let context = &text[start..after_end];
            let mut tokens = tokenize(context, self);
            let first = tokens
                .iter()
                .position(|t| t.text.ends_with(['.', '?', '!']));
            let Some(i) = first.filter(|&i| i + 1 < tokens.len()) else {
                return Err(
                    "Punkt debug context requires two tokens (NLTK raises IndexError here)".into(),
                );
            };
            let (left, right) = tokens.split_at_mut(i + 1);
            let (t, next) = (&mut left[i], &right[0]);
            let bits = self
                .ortho_context
                .get(next.no_sent_period())
                .copied()
                .unwrap_or(0);
            let mut decision = DebugDecision {
                period_index: text[..end - 1].encode_utf16().count(),
                text: context.into(),
                type1: t.typ.clone(),
                type2: next.typ.clone(),
                type1_in_abbrs: t.abbr,
                type1_is_initial: t.initial,
                type2_is_sent_starter: self.sentence_starters.contains(next.no_sent_period()),
                type2_ortho_heuristic: self
                    .heuristic(next)
                    .map(serde_json::Value::Bool)
                    .unwrap_or_else(|| "unknown".into()),
                type2_ortho_contexts: ["BEG-UC", "MID-UC", "UNK-UC", "BEG-LC", "MID-LC", "UNK-LC"]
                    .into_iter()
                    .enumerate()
                    .filter(|(i, _)| bits & (2 << i) != 0)
                    .map(|(_, name)| name)
                    .collect(),
                // NLTK debug uses no_sent_period here, not the inference key.
                collocation: self
                    .collocations
                    .contains(&(t.no_sent_period().into(), next.no_sent_period().into())),
                reason: "default decision",
                break_decision: None,
            };
            let reason = self.second_pass(t, next);
            decision.reason = reason.unwrap_or("default decision");
            decision.break_decision = if t.sentbreak {
                Some(true)
            } else if reason.is_some() {
                Some(false)
            } else {
                None
            };
            result.push(decision);
        }
        Ok(result)
    }

    pub fn spans(&self, text: &str, realign_boundaries: bool) -> Vec<(usize, usize)> {
        let mut slices = Vec::new();
        let mut last = 0;
        for (start, end, after_end, next_start) in self.contexts(text) {
            if self.contains_break(&text[start..after_end]) {
                slices.push((last, end));
                last = next_start.unwrap_or(end);
            }
        }
        slices.push((last, text.trim_end_matches(is_space).len()));
        if !realign_boundaries {
            return slices;
        }
        let mut spans = Vec::new();
        let mut realign = 0;
        for (i, &(start, end)) in slices.iter().enumerate() {
            let start = start + realign;
            realign = 0;
            let mut stop = end;
            if let Some(&(next_start, next_end)) = slices.get(i + 1) {
                if next_end >= next_start {
                    if let Some((match_end, trimmed_end)) = alignment(&text[next_start..next_end]) {
                        stop = next_start + trimmed_end;
                        realign = match_end;
                    }
                }
            }
            if stop > start {
                spans.push((start, stop));
            }
        }
        spans
    }
}

/// NLTK field names; period_index is explicitly a JS UTF-16 index in this API.
#[derive(Serialize)]
pub struct DebugDecision {
    period_index: usize,
    text: String,
    type1: String,
    type2: String,
    type1_in_abbrs: bool,
    type1_is_initial: bool,
    type2_is_sent_starter: bool,
    type2_ortho_heuristic: serde_json::Value,
    type2_ortho_contexts: Vec<&'static str>,
    collocation: bool,
    reason: &'static str,
    break_decision: Option<bool>,
}

fn alignment(text: &str) -> Option<(usize, usize)> {
    let mut end = 0;
    for c in text.chars() {
        if !"\"')]}‘’“”«»".contains(c) {
            break;
        }
        end += c.len_utf8();
        let rest = &text[end..];
        let spaces = rest.len() - rest.trim_start_matches(is_space).len();
        if spaces > 0 {
            return Some((end + spaces, end));
        }
        if rest.is_empty() || rest.starts_with("--") {
            return Some((end, end));
        }
    }
    None
}

/// Versioned length-prefixed UTF-8 inference payload, without JSON delimiters.
pub fn decode_model(bytes: &[u8]) -> Option<PunktModel> {
    struct Reader<'a> {
        data: &'a [u8],
        pos: usize,
    }
    impl Reader<'_> {
        fn u32(&mut self) -> Option<u32> {
            let end = self.pos.checked_add(4)?;
            let value = u32::from_le_bytes(self.data.get(self.pos..end)?.try_into().ok()?);
            self.pos = end;
            Some(value)
        }
        fn string(&mut self) -> Option<String> {
            let len = self.u32()? as usize;
            let end = self.pos.checked_add(len)?;
            let value = std::str::from_utf8(self.data.get(self.pos..end)?)
                .ok()?
                .to_owned();
            self.pos = end;
            Some(value)
        }
    }
    let mut r = Reader {
        data: bytes,
        pos: 0,
    };
    if r.u32()? != 1 {
        return None;
    }
    let mut m = PunktModel::default();
    for _ in 0..r.u32()? {
        m.abbreviations.insert(r.string()?);
    }
    for _ in 0..r.u32()? {
        m.collocations.insert((r.string()?, r.string()?));
    }
    for _ in 0..r.u32()? {
        m.sentence_starters.insert(r.string()?);
    }
    for _ in 0..r.u32()? {
        m.ortho_context.insert(r.string()?, r.u32()?);
    }
    (r.pos == bytes.len()).then_some(m)
}

#[cfg(test)]
mod tests;
