struct NextToken {
    start: usize,
    len: usize,
    is_upper_start: bool,
    is_lower_start: bool,
}

fn is_whitespace(ch: u8) -> bool {
    ch == b' ' || ch == b'\n' || ch == b'\r' || ch == b'\t'
}

fn is_sentence_punct(ch: u8) -> bool {
    ch == b'.' || ch == b'!' || ch == b'?'
}

fn is_closer(ch: u8) -> bool {
    ch == b'"' || ch == b'\'' || ch == b')' || ch == b']' || ch == b'}'
}

fn is_token_char(ch: u8) -> bool {
    ch.is_ascii_alphanumeric() || ch == b'.'
}

fn is_skippable_left(ch: u8) -> bool {
    is_whitespace(ch)
        || ch == b'"'
        || ch == b'\''
        || ch == b'('
        || ch == b')'
        || ch == b'['
        || ch == b']'
        || ch == b'{'
        || ch == b'}'
}

fn lower_ascii(ch: u8) -> u8 {
    if ch >= b'A' && ch <= b'Z' {
        ch + 32
    } else {
        ch
    }
}

fn normalize_token_lower<'a>(token: &[u8], out: &'a mut [u8; 32]) -> &'a [u8] {
    if token.is_empty() {
        return b"";
    }
    let mut end = token.len();
    while end > 0 && token[end - 1] == b'.' {
        end -= 1;
    }
    if end == 0 {
        return b"";
    }
    let write_len = end.min(out.len());
    for idx in 0..write_len {
        out[idx] = lower_ascii(token[idx]);
    }
    &out[0..write_len]
}

fn is_known_abbrev(token: &[u8]) -> bool {
    let mut buf = [0u8; 32];
    let norm = normalize_token_lower(token, &mut buf);
    if norm.is_empty() {
        return false;
    }
    norm == b"mr"
        || norm == b"mrs"
        || norm == b"ms"
        || norm == b"dr"
        || norm == b"prof"
        || norm == b"sr"
        || norm == b"jr"
        || norm == b"st"
        || norm == b"vs"
        || norm == b"etc"
        || norm == b"e.g"
        || norm == b"i.e"
        || norm == b"u.s"
        || norm == b"u.k"
        || norm == b"a.m"
        || norm == b"p.m"
}

fn is_title_abbrev(token: &[u8]) -> bool {
    let mut buf = [0u8; 32];
    let norm = normalize_token_lower(token, &mut buf);
    if norm.is_empty() {
        return false;
    }
    norm == b"dr" || norm == b"prof"
}

fn find_prev_token<'a>(input: &'a [u8], idx: usize) -> &'a [u8] {
    if input.is_empty() {
        return b"";
    }
    let mut end_opt: Option<usize> = Some(idx);
    while let Some(end) = end_opt {
        if !is_skippable_left(input[end]) {
            break;
        }
        if end == 0 {
            end_opt = None;
        } else {
            end_opt = Some(end - 1);
        }
    }
    let end = match end_opt {
        Some(e) => e,
        None => return b"",
    };

    let mut start = end;
    while start > 0 && is_token_char(input[start - 1]) {
        start -= 1;
    }
    &input[start..end + 1]
}

fn find_next_token(input: &[u8], idx: usize) -> Option<NextToken> {
    if idx >= input.len() {
        return None;
    }
    let mut i = idx;
    while i < input.len() && (is_whitespace(input[i]) || is_closer(input[i])) {
        i += 1;
    }
    if i >= input.len() {
        return None;
    }

    let start = i;
    while i < input.len() && is_token_char(input[i]) {
        i += 1;
    }
    if i <= start {
        return None;
    }
    let first = input[start];
    Some(NextToken {
        start,
        len: i - start,
        is_upper_start: first >= b'A' && first <= b'Z',
        is_lower_start: first >= b'a' && first <= b'z',
    })
}

fn should_split_at(input: &[u8], punct_idx: usize) -> bool {
    let punct = input[punct_idx];
    let prev = if punct_idx > 0 { input[punct_idx - 1] } else { 0 };
    let next = if punct_idx + 1 < input.len() {
        input[punct_idx + 1]
    } else {
        0
    };

    if punct == b'.' && prev.is_ascii_digit() && next.is_ascii_digit() {
        return false;
    }
    if punct == b'.' && next == b'.' {
        return false;
    }

    if punct == b'.'
        && next.is_ascii_alphabetic()
        && punct_idx + 2 < input.len()
        && input[punct_idx + 2] == b'.'
    {
        return false;
    }

    let prev_token = find_prev_token(input, if punct_idx == 0 { 0 } else { punct_idx - 1 });
    let look = match find_next_token(input, punct_idx + 1) {
        Some(l) => l,
        None => return true,
    };

    if punct == b'.' && is_known_abbrev(prev_token) {
        if is_title_abbrev(prev_token) && look.is_upper_start {
            return false;
        }
        if look.is_lower_start {
            return false;
        }
    }

    if look.is_upper_start {
        return true;
    }
    if input[look.start].is_ascii_digit() {
        return true;
    }
    if punct == b'!' || punct == b'?' {
        return true;
    }
    false
}

fn trim_range(input: &[u8], start: usize, end: usize) -> (usize, usize) {
    let mut s = start;
    let mut e = end;
    while s < e && is_whitespace(input[s]) {
        s += 1;
    }
    while e > s && is_whitespace(input[e - 1]) {
        e -= 1;
    }
    (s, e)
}

pub fn count_sentence_offsets_ascii(input: &[u8]) -> u64 {
    let mut total: u64 = 0;
    let mut start: usize = 0;
    let mut i: usize = 0;
    while i < input.len() {
        if !is_sentence_punct(input[i]) {
            i += 1;
            continue;
        }
        if !should_split_at(input, i) {
            i += 1;
            continue;
        }

        let mut end = i + 1;
        while end < input.len() && is_closer(input[end]) {
            end += 1;
        }
        let (ts, te) = trim_range(input, start, end);
        if te > ts {
            total += 1;
        }
        start = end;
        i += 1;
    }

    let (ts, te) = trim_range(input, start, input.len());
    if te > ts {
        total += 1;
    }
    total
}

pub fn fill_sentence_offsets_ascii(
    input: &[u8],
    out_offsets: &mut [u32],
    out_lengths: &mut [u32],
) -> u64 {
    let mut total: u64 = 0;
    let mut written: usize = 0;
    let mut start: usize = 0;
    let mut i: usize = 0;

    while i < input.len() {
        if !is_sentence_punct(input[i]) {
            i += 1;
            continue;
        }
        if !should_split_at(input, i) {
            i += 1;
            continue;
        }

        let mut end = i + 1;
        while end < input.len() && is_closer(input[end]) {
            end += 1;
        }
        let (ts, te) = trim_range(input, start, end);
        if te > ts {
            if written < out_offsets.len() {
                let len = te - ts;
                out_offsets[written] = ts as u32;
                out_lengths[written] = len as u32;
                written += 1;
            }
            total += 1;
        }
        start = end;
        i += 1;
    }

    let (ts, te) = trim_range(input, start, input.len());
    if te > ts {
        if written < out_offsets.len() {
            let len = te - ts;
            out_offsets[written] = ts as u32;
            out_lengths[written] = len as u32;
        }
        total += 1;
    }

    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn punkt_sentence_offsets_basic_behavior() {
        let input = b"Dr. Smith lives in the U.S. He works at 9 a.m.";
        let mut offsets = [0u32; 4];
        let mut lengths = [0u32; 4];
        let total = fill_sentence_offsets_ascii(input, &mut offsets, &mut lengths);
        assert_eq!(total, 2);
        assert_eq!(
            &input[offsets[0] as usize..(offsets[0] + lengths[0]) as usize],
            b"Dr. Smith lives in the U.S."
        );
        assert_eq!(
            &input[offsets[1] as usize..(offsets[1] + lengths[1]) as usize],
            b"He works at 9 a.m."
        );
    }

    #[test]
    fn punkt_sentence_offsets_title_abbreviations_and_punctuation() {
        let input = b"Prof. Ada wrote this. Did Dr. Bob agree? Yes!";
        assert_eq!(count_sentence_offsets_ascii(input), 3);
    }
}
