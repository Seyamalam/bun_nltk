use crate::ascii;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u16)]
pub enum TagId {
    Nn = 0,
    Nnp = 1,
    Cd = 2,
    Vbg = 3,
    Vbd = 4,
    Rb = 5,
    Dt = 6,
    Cc = 7,
    Prp = 8,
    Vb = 9,
}

const DETERMINERS: [&[u8]; 7] = [b"a", b"an", b"the", b"this", b"that", b"these", b"those"];
const CONJUNCTIONS: [&[u8]; 5] = [b"and", b"or", b"but", b"yet", b"nor"];
const PRONOUNS: [&[u8]; 12] = [
    b"i", b"you", b"he", b"she", b"it", b"we", b"they", b"me", b"him", b"her", b"us", b"them",
];
const VERB_BASE: [&[u8]; 14] = [
    b"is", b"am", b"are", b"was", b"were", b"be", b"been", b"being", b"do", b"does", b"did",
    b"have", b"has", b"had",
];

fn init_sorted_hashes(words: &[&[u8]]) -> Vec<u64> {
    let mut v: Vec<u64> = words.iter().map(|w| ascii::hash_token_const(w)).collect();
    v.sort_unstable();
    v
}

fn determiner_hashes() -> &'static [u64] {
    static CELL: OnceLock<Vec<u64>> = OnceLock::new();
    CELL.get_or_init(|| init_sorted_hashes(&DETERMINERS))
}

fn conjunction_hashes() -> &'static [u64] {
    static CELL: OnceLock<Vec<u64>> = OnceLock::new();
    CELL.get_or_init(|| init_sorted_hashes(&CONJUNCTIONS))
}

fn pronoun_hashes() -> &'static [u64] {
    static CELL: OnceLock<Vec<u64>> = OnceLock::new();
    CELL.get_or_init(|| init_sorted_hashes(&PRONOUNS))
}

fn verb_base_hashes() -> &'static [u64] {
    static CELL: OnceLock<Vec<u64>> = OnceLock::new();
    CELL.get_or_init(|| init_sorted_hashes(&VERB_BASE))
}

fn contains_hash(hashes: &[u64], hash: u64) -> bool {
    hashes.binary_search(&hash).is_ok()
}

fn has_suffix_ignore_case(token: &[u8], suffix: &[u8]) -> bool {
    if token.len() < suffix.len() {
        return false;
    }
    let start = token.len() - suffix.len();
    for (idx, &expected) in suffix.iter().enumerate() {
        if ascii::ascii_lower(token[start + idx]) != expected {
            return false;
        }
    }
    true
}

fn is_all_digits(token: &[u8]) -> bool {
    if token.is_empty() {
        return false;
    }
    token.iter().all(|&ch| ch.is_ascii_digit())
}

fn is_determiner(hash: u64) -> bool {
    contains_hash(determiner_hashes(), hash)
}

fn is_conjunction(hash: u64) -> bool {
    contains_hash(conjunction_hashes(), hash)
}

fn is_pronoun(hash: u64) -> bool {
    contains_hash(pronoun_hashes(), hash)
}

fn is_verb_base(hash: u64) -> bool {
    contains_hash(verb_base_hashes(), hash)
}

fn classify_token(token: &[u8], hash: u64) -> TagId {
    if is_all_digits(token) {
        return TagId::Cd;
    }
    if is_pronoun(hash) {
        return TagId::Prp;
    }
    if is_determiner(hash) {
        return TagId::Dt;
    }
    if is_conjunction(hash) {
        return TagId::Cc;
    }
    if is_verb_base(hash) {
        return TagId::Vb;
    }
    if has_suffix_ignore_case(token, b"ing") {
        return TagId::Vbg;
    }
    if has_suffix_ignore_case(token, b"ed") {
        return TagId::Vbd;
    }
    if has_suffix_ignore_case(token, b"ly") {
        return TagId::Rb;
    }
    if token.len() > 1 && token[0].is_ascii_uppercase() {
        return TagId::Nnp;
    }
    TagId::Nn
}

pub fn classify_token_ascii(token: &[u8], hash: u64) -> TagId {
    classify_token(token, hash)
}

pub fn count_pos_tags_ascii(input: &[u8]) -> u64 {
    ascii::token_count_ascii(input)
}

pub fn fill_pos_tags_ascii(
    input: &[u8],
    out_offsets: &mut [u32],
    out_lengths: &mut [u32],
    out_tag_ids: &mut [u16],
) -> u64 {
    let mut total: u64 = 0;
    let mut written: usize = 0;
    let mut in_token = false;
    let mut token_start: usize = 0;
    let mut token_hash: u64 = ascii::FNV_OFFSET_BASIS;

    for (idx, &ch) in input.iter().enumerate() {
        if ascii::is_token_char(ch) {
            if !in_token {
                in_token = true;
                token_start = idx;
                token_hash = ascii::FNV_OFFSET_BASIS;
            }
            token_hash = ascii::token_hash_update(token_hash, ch);
        } else if in_token {
            let token_len = idx - token_start;
            let token = &input[token_start..idx];
            let tag = classify_token(token, token_hash);
            if written < out_offsets.len()
                && written < out_lengths.len()
                && written < out_tag_ids.len()
                && token_start <= u32::MAX as usize
                && token_len <= u32::MAX as usize
            {
                out_offsets[written] = token_start as u32;
                out_lengths[written] = token_len as u32;
                out_tag_ids[written] = tag as u16;
                written += 1;
            }
            total += 1;
            in_token = false;
        }
    }

    if in_token {
        let token_len = input.len() - token_start;
        let token = &input[token_start..];
        let tag = classify_token(token, token_hash);
        if written < out_offsets.len()
            && written < out_lengths.len()
            && written < out_tag_ids.len()
            && token_start <= u32::MAX as usize
            && token_len <= u32::MAX as usize
        {
            out_offsets[written] = token_start as u32;
            out_lengths[written] = token_len as u32;
            out_tag_ids[written] = tag as u16;
        }
        total += 1;
    }

    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tagger_basic_heuristics() {
        let input = b"Dr Smith is running quickly and he coded 123";
        let mut offsets = [0u32; 16];
        let mut lengths = [0u32; 16];
        let mut tags = [0u16; 16];

        let total = fill_pos_tags_ascii(input, &mut offsets, &mut lengths, &mut tags);
        assert_eq!(total, 9);
        assert_eq!(tags[0], TagId::Nnp as u16);
        assert_eq!(tags[1], TagId::Nnp as u16);
        assert_eq!(tags[2], TagId::Vb as u16);
        assert_eq!(tags[3], TagId::Vbg as u16);
        assert_eq!(tags[4], TagId::Rb as u16);
        assert_eq!(tags[5], TagId::Cc as u16);
        assert_eq!(tags[6], TagId::Prp as u16);
        assert_eq!(tags[7], TagId::Vbd as u16);
        assert_eq!(tags[8], TagId::Cd as u16);
    }
}
