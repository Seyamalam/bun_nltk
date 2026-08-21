#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum WordNetPos {
    Any = 0,
    Noun = 1,
    Verb = 2,
    Adjective = 3,
    Adverb = 4,
}

fn ascii_lower(ch: u8) -> u8 {
    if ch >= b'A' && ch <= b'Z' {
        ch + 32
    } else {
        ch
    }
}

fn normalize_word(input: &[u8], out: &mut [u8]) -> usize {
    let take = input.len().min(out.len());
    for idx in 0..take {
        out[idx] = match input[idx] {
            b' ' => b'_',
            ch => ascii_lower(ch),
        };
    }
    take
}

fn ends_with(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.len() >= needle.len() && &haystack[haystack.len() - needle.len()..] == needle
}

fn write_candidate(base: &[u8], suffix_trim: usize, suffix_add: &[u8], out: &mut [u8]) -> usize {
    if base.len() < suffix_trim {
        return 0;
    }
    let left_len = base.len() - suffix_trim;
    let total = left_len + suffix_add.len();
    if total > out.len() {
        return 0;
    }
    out[0..left_len].copy_from_slice(&base[0..left_len]);
    if !suffix_add.is_empty() {
        out[left_len..total].copy_from_slice(suffix_add);
    }
    total
}

fn noun_morph(word: &[u8], out: &mut [u8]) -> usize {
    if ends_with(word, b"ies") && word.len() > 3 {
        return write_candidate(word, 3, b"y", out);
    }
    if ends_with(word, b"ves") && word.len() > 3 {
        return write_candidate(word, 3, b"f", out);
    }
    if ends_with(word, b"es") && word.len() > 2 {
        return write_candidate(word, 2, b"", out);
    }
    if ends_with(word, b"s") && word.len() > 1 {
        return write_candidate(word, 1, b"", out);
    }
    write_candidate(word, 0, b"", out)
}

fn verb_morph(word: &[u8], out: &mut [u8]) -> usize {
    if ends_with(word, b"ies") && word.len() > 3 {
        return write_candidate(word, 3, b"y", out);
    }
    if ends_with(word, b"ing") && word.len() > 4 {
        return write_candidate(word, 3, b"", out);
    }
    if ends_with(word, b"ed") && word.len() > 3 {
        return write_candidate(word, 2, b"", out);
    }
    if ends_with(word, b"s") && word.len() > 1 {
        return write_candidate(word, 1, b"", out);
    }
    write_candidate(word, 0, b"", out)
}

fn adjective_morph(word: &[u8], out: &mut [u8]) -> usize {
    if ends_with(word, b"est") && word.len() > 3 {
        return write_candidate(word, 3, b"", out);
    }
    if ends_with(word, b"er") && word.len() > 2 {
        return write_candidate(word, 2, b"", out);
    }
    write_candidate(word, 0, b"", out)
}

pub fn morphy_ascii(input: &[u8], pos: WordNetPos, out: &mut [u8]) -> usize {
    if input.is_empty() || out.is_empty() {
        return 0;
    }
    let mut normalized_buf = [0u8; 128];
    let normalized_len = normalize_word(input, &mut normalized_buf);
    let normalized = &normalized_buf[0..normalized_len];

    match pos {
        WordNetPos::Noun => noun_morph(normalized, out),
        WordNetPos::Verb => verb_morph(normalized, out),
        WordNetPos::Adjective => adjective_morph(normalized, out),
        WordNetPos::Adverb => write_candidate(normalized, 0, b"", out),
        WordNetPos::Any => {
            let noun_len = noun_morph(normalized, out);
            if noun_len > 0 {
                return noun_len;
            }
            let verb_len = verb_morph(normalized, out);
            if verb_len > 0 {
                return verb_len;
            }
            adjective_morph(normalized, out)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn morphy_ascii_noun_rules() {
        let mut out = [0u8; 64];
        let len1 = morphy_ascii(b"dogs", WordNetPos::Noun, &mut out);
        assert_eq!(&out[0..len1], b"dog");
        let len2 = morphy_ascii(b"parties", WordNetPos::Noun, &mut out);
        assert_eq!(&out[0..len2], b"party");
    }

    #[test]
    fn morphy_ascii_verb_and_adjective_rules() {
        let mut out = [0u8; 64];
        let len1 = morphy_ascii(b"sprinted", WordNetPos::Verb, &mut out);
        assert_eq!(&out[0..len1], b"sprint");
        let len2 = morphy_ascii(b"faster", WordNetPos::Adjective, &mut out);
        assert_eq!(&out[0..len2], b"fast");
    }
}
