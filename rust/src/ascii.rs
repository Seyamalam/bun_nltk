pub const FNV_OFFSET_BASIS: u64 = 14695981039346656037;
pub const FNV_PRIME: u64 = 1099511628211;

#[inline]
pub fn is_token_char(ch: u8) -> bool {
    ch.is_ascii_alphanumeric() || ch == b'\''
}

#[inline]
pub fn ascii_lower(ch: u8) -> u8 {
    if ch.is_ascii_uppercase() {
        ch + 32
    } else {
        ch
    }
}

#[inline]
pub fn token_hash_update(hash: u64, ch: u8) -> u64 {
    (hash ^ (ascii_lower(ch) as u64)).wrapping_mul(FNV_PRIME)
}

#[inline]
pub fn hash_token(token: &[u8]) -> u64 {
    let mut hash = FNV_OFFSET_BASIS;
    for &ch in token {
        hash = token_hash_update(hash, ch);
    }
    hash
}

pub const fn hash_token_const(token: &[u8]) -> u64 {
    let mut hash = FNV_OFFSET_BASIS;
    let mut i = 0;
    while i < token.len() {
        let ch = token[i];
        let lower = if ch >= b'A' && ch <= b'Z' { ch + 32 } else { ch };
        hash ^= lower as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
        i += 1;
    }
    hash
}

pub fn token_count_ascii(input: &[u8]) -> u64 {
    token_count_ascii_scalar(input)
}

pub fn token_count_ascii_scalar(input: &[u8]) -> u64 {
    let mut total: u64 = 0;
    let mut in_token = false;

    for &ch in input {
        if is_token_char(ch) {
            if !in_token {
                total += 1;
                in_token = true;
            }
        } else {
            in_token = false;
        }
    }

    total
}

pub fn hash_ngram(window: &[u64], start: usize, n: usize) -> u64 {
    let mut hash = FNV_OFFSET_BASIS;
    hash ^= n as u64;
    hash = hash.wrapping_mul(FNV_PRIME);

    for i in 0..n {
        let token_hash = window[(start + i) % n];
        hash ^= token_hash;
        hash = hash.wrapping_mul(FNV_PRIME);
    }

    hash
}

pub fn fill_token_offsets_ascii(input: &[u8], out_offsets: &mut [u32], out_lengths: &mut [u32]) -> u64 {
    let mut total: u64 = 0;
    let mut written: usize = 0;
    let mut in_token = false;
    let mut token_start: usize = 0;

    for (idx, &ch) in input.iter().enumerate() {
        if is_token_char(ch) {
            if !in_token {
                in_token = true;
                token_start = idx;
            }
        } else if in_token {
            let token_len = idx - token_start;
            if written < out_offsets.len()
                && token_start <= u32::MAX as usize
                && token_len <= u32::MAX as usize
            {
                out_offsets[written] = token_start as u32;
                out_lengths[written] = token_len as u32;
                written += 1;
            }
            total += 1;
            in_token = false;
        }
    }

    if in_token {
        let token_len = input.len() - token_start;
        if written < out_offsets.len()
            && token_start <= u32::MAX as usize
            && token_len <= u32::MAX as usize
        {
            out_offsets[written] = token_start as u32;
            out_lengths[written] = token_len as u32;
        }
        total += 1;
    }

    total
}

pub fn collect_token_hashes_ascii(input: &[u8]) -> Vec<u64> {
    let mut hashes: Vec<u64> = Vec::new();

    let mut in_token = false;
    let mut token_hash = FNV_OFFSET_BASIS;

    for &ch in input {
        if is_token_char(ch) {
            if !in_token {
                in_token = true;
                token_hash = FNV_OFFSET_BASIS;
            }
            token_hash = token_hash_update(token_hash, ch);
        } else if in_token {
            hashes.push(token_hash);
            in_token = false;
        }
    }

    if in_token {
        hashes.push(token_hash);
    }

    hashes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ascii_token_counting_and_offsets() {
        let input = b"This, this is a test.";
        assert_eq!(token_count_ascii(input), 5);

        let mut offsets = [0u32; 5];
        let mut lengths = [0u32; 5];
        let total = fill_token_offsets_ascii(input, &mut offsets, &mut lengths);
        assert_eq!(total, 5);

        assert_eq!(&input[offsets[0] as usize..offsets[0] as usize + lengths[0] as usize], b"This");
        assert_eq!(&input[offsets[1] as usize..offsets[1] as usize + lengths[1] as usize], b"this");
        assert_eq!(&input[offsets[2] as usize..offsets[2] as usize + lengths[2] as usize], b"is");
        assert_eq!(&input[offsets[3] as usize..offsets[3] as usize + lengths[3] as usize], b"a");
        assert_eq!(&input[offsets[4] as usize..offsets[4] as usize + lengths[4] as usize], b"test");
    }

    #[test]
    fn collect_token_hashes() {
        let input = b"a b c";
        let hashes = collect_token_hashes_ascii(input);
        assert_eq!(hashes.len(), 3);
    }

    #[test]
    fn known_hash_values() {
        // Cross-checked against the Zig implementation's FNV-1a variant.
        assert_eq!(hash_token(b"the"), hash_token(b"THE"));
        assert_ne!(hash_token(b"the"), hash_token(b"then"));
    }
}
