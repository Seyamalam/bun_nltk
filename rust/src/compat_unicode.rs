//! Handwritten lookup logic over audited Python/UCD/regex Unicode tables.
#[path = "compat_unicode_data.rs"]
mod data;
use data::*;

fn in_ranges(ch: u32, ranges: &[(u32, u32)]) -> bool {
    let i = ranges.partition_point(|&(_, end)| end < ch);
    i < ranges.len() && ranges[i].0 <= ch
}
pub fn is_word(ch: u32) -> bool {
    in_ranges(ch, WORD)
}
pub fn is_space(ch: u32) -> bool {
    in_ranges(ch, SPACE)
}
pub fn is_pyword(ch: u32) -> bool {
    in_ranges(ch, PYWORD)
}
pub fn is_pyspace(ch: u32) -> bool {
    in_ranges(ch, PYSPACE)
}
pub fn is_decimal(ch: u32) -> bool {
    in_ranges(ch, DECIMAL)
}
pub fn is_cased(ch: u32) -> bool {
    in_ranges(ch, CASED)
}
pub fn is_case_ignorable(ch: u32) -> bool {
    in_ranges(ch, CASE_IGNORABLE)
}
pub fn lowercase_char(ch: u32, out: &mut Vec<u32>) {
    match LOWERCASE.binary_search_by_key(&ch, |&(codepoint, _)| codepoint) {
        Ok(index) => out.extend_from_slice(LOWERCASE[index].1),
        Err(_) => out.push(ch),
    }
}
