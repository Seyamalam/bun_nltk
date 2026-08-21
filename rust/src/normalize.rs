use crate::ascii;
use crate::stopwords;

pub fn count_normalized_tokens_ascii(input: &[u8], remove_stopwords: bool) -> u64 {
    if !remove_stopwords {
        return ascii::token_count_ascii(input);
    }
    count_normalized_tokens_ascii_scalar(input, remove_stopwords)
}

pub fn count_normalized_tokens_ascii_scalar(input: &[u8], remove_stopwords: bool) -> u64 {
    let mut total: u64 = 0;
    let mut in_token = false;
    let mut token_hash = ascii::FNV_OFFSET_BASIS;

    for &ch in input {
        if ascii::is_token_char(ch) {
            if !in_token {
                in_token = true;
                token_hash = ascii::FNV_OFFSET_BASIS;
            }
            token_hash = ascii::token_hash_update(token_hash, ch);
        } else if in_token {
            if !remove_stopwords || !stopwords::is_stopword_hash(token_hash) {
                total += 1;
            }
            in_token = false;
        }
    }

    if in_token {
        if !remove_stopwords || !stopwords::is_stopword_hash(token_hash) {
            total += 1;
        }
    }

    total
}

pub fn fill_normalized_token_offsets_ascii(
    input: &[u8],
    remove_stopwords: bool,
    out_offsets: &mut [u32],
    out_lengths: &mut [u32],
) -> u64 {
    if !remove_stopwords {
        return ascii::fill_token_offsets_ascii(input, out_offsets, out_lengths);
    }
    fill_normalized_token_offsets_ascii_scalar(input, remove_stopwords, out_offsets, out_lengths)
}

pub fn fill_normalized_token_offsets_ascii_scalar(
    input: &[u8],
    remove_stopwords: bool,
    out_offsets: &mut [u32],
    out_lengths: &mut [u32],
) -> u64 {
    let mut total: u64 = 0;
    let mut written: usize = 0;
    let mut in_token = false;
    let mut token_start: usize = 0;
    let mut token_hash = ascii::FNV_OFFSET_BASIS;

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
            let drop = remove_stopwords && stopwords::is_stopword_hash(token_hash);
            if !drop {
                if written < out_offsets.len()
                    && token_start <= u32::MAX as usize
                    && token_len <= u32::MAX as usize
                {
                    out_offsets[written] = token_start as u32;
                    out_lengths[written] = token_len as u32;
                    written += 1;
                }
                total += 1;
            }
            in_token = false;
        }
    }

    if in_token {
        let token_len = input.len() - token_start;
        let drop = remove_stopwords && stopwords::is_stopword_hash(token_hash);
        if !drop {
            if written < out_offsets.len()
                && token_start <= u32::MAX as usize
                && token_len <= u32::MAX as usize
            {
                out_offsets[written] = token_start as u32;
                out_lengths[written] = token_len as u32;
            }
            total += 1;
        }
    }

    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalized_offsets_remove_stopwords() {
        let input = b"The quick brown fox and the dog";
        assert_eq!(count_normalized_tokens_ascii(input, true), 4);
        assert_eq!(count_normalized_tokens_ascii(input, false), 7);

        let mut offsets = [0u32; 8];
        let mut lengths = [0u32; 8];
        let total = fill_normalized_token_offsets_ascii(input, true, &mut offsets, &mut lengths);
        assert_eq!(total, 4);

        assert_eq!(&input[offsets[0] as usize..(offsets[0] + lengths[0]) as usize], b"quick");
        assert_eq!(&input[offsets[1] as usize..(offsets[1] + lengths[1]) as usize], b"brown");
        assert_eq!(&input[offsets[2] as usize..(offsets[2] + lengths[2]) as usize], b"fox");
        assert_eq!(&input[offsets[3] as usize..(offsets[3] + lengths[3]) as usize], b"dog");
    }
}
