use crate::ascii;
use crate::CoreResult;
use std::collections::HashMap;

pub fn update_count(map: &mut HashMap<u64, u64>, key: u64) {
    *map.entry(key).or_insert(0) += 1;
}

pub fn update_count_u128(map: &mut HashMap<u128, u64>, key: u128) {
    *map.entry(key).or_insert(0) += 1;
}

pub fn build_token_freq_map_ascii(input: &[u8]) -> CoreResult<HashMap<u64, u64>> {
    let mut map: HashMap<u64, u64> = HashMap::new();

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
            update_count(&mut map, token_hash);
            in_token = false;
        }
    }

    if in_token {
        update_count(&mut map, token_hash);
    }

    Ok(map)
}

pub fn build_ngram_freq_map_ascii(input: &[u8], n: usize) -> CoreResult<HashMap<u64, u64>> {
    if n == 0 {
        return Err(crate::CoreError::InvalidN);
    }

    let mut map: HashMap<u64, u64> = HashMap::new();
    let mut window = vec![0u64; n];

    let mut seen_tokens: usize = 0;
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
            window[seen_tokens % n] = token_hash;
            seen_tokens += 1;
            if seen_tokens >= n {
                let start = (seen_tokens - n) % n;
                update_count(&mut map, ascii::hash_ngram(&window, start, n));
            }
            in_token = false;
        }
    }

    if in_token {
        window[seen_tokens % n] = token_hash;
        seen_tokens += 1;
        if seen_tokens >= n {
            let start = (seen_tokens - n) % n;
            update_count(&mut map, ascii::hash_ngram(&window, start, n));
        }
    }

    Ok(map)
}

pub fn fill_from_map(
    map: &HashMap<u64, u64>,
    out_hashes: &mut [u64],
    out_counts: &mut [u64],
) -> CoreResult<()> {
    if out_hashes.len() != out_counts.len() {
        return Err(crate::CoreError::InsufficientCapacity);
    }

    let unique = map.len();
    if out_hashes.len() < unique {
        return Err(crate::CoreError::InsufficientCapacity);
    }

    let mut idx: usize = 0;
    for (key, value) in map.iter() {
        out_hashes[idx] = *key;
        out_counts[idx] = *value;
        idx += 1;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn freqdist_building() {
        let input = b"this this is is a a test test";

        let token_map = build_token_freq_map_ascii(input).unwrap();
        assert_eq!(token_map.len(), 4);

        let ngram_map = build_ngram_freq_map_ascii(input, 2).unwrap();
        assert_eq!(ngram_map.len(), 7);
    }

    #[test]
    fn freqdist_invalid_n() {
        let result = build_ngram_freq_map_ascii(b"abc", 0);
        assert!(result.is_err());
    }
}
