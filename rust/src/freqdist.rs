use crate::ascii;
use crate::CoreResult;
use std::collections::{HashMap, HashSet};

/// Collision-free aggregate counts without retaining the full token stream.
pub fn exact_ascii_metrics(input: &[u8], n: usize) -> CoreResult<[u64; 4]> {
    if n == 0 {
        return Err(crate::CoreError::InvalidN);
    }
    let mut vocabulary: HashMap<Vec<u8>, u32> = HashMap::new();
    let mut grams: HashSet<Vec<u32>> = HashSet::new();
    // Do not reserve an enormous window for an order larger than the corpus.
    let possible = n as u64 <= ascii::token_count_ascii(input);
    let mut window = if possible { vec![0; n] } else { Vec::new() };
    let mut key = if possible { vec![0; n] } else { Vec::new() };
    let mut token = Vec::new();
    let mut count = 0usize;
    for byte in input.iter().copied().chain(std::iter::once(0)) {
        if ascii::is_token_char(byte) {
            token.push(ascii::ascii_lower(byte));
        } else if !token.is_empty() {
            let next_id = u32::try_from(vocabulary.len())
                .map_err(|_| crate::CoreError::InsufficientCapacity)?;
            let id = match vocabulary.get(token.as_slice()) {
                Some(&id) => id,
                None => {
                    vocabulary.insert(token.clone(), next_id);
                    next_id
                }
            };
            token.clear();
            if possible {
                window[count % n] = id;
                count += 1;
                if count >= n {
                    let start = count % n;
                    for i in 0..n {
                        key[i] = window[(start + i) % n];
                    }
                    if !grams.contains(key.as_slice()) {
                        grams.insert(key.clone());
                    }
                }
            } else {
                count += 1;
            }
        }
    }
    Ok([
        count as u64,
        vocabulary.len() as u64,
        count.saturating_sub(n - 1) as u64,
        grams.len() as u64,
    ])
}

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

    for (idx, (key, value)) in map.iter().enumerate() {
        out_hashes[idx] = *key;
        out_counts[idx] = *value;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aggregate_counts_do_not_merge_ngram_hash_collisions() {
        let words: Vec<String> = (0..128).map(|i| format!("word{i}")).collect();
        let mut text = String::new();
        let mut expected = HashSet::new();
        let mut previous = None;
        for a in &words {
            for b in &words {
                text.push_str(a);
                text.push(' ');
                text.push_str(b);
                text.push(' ');
                if let Some(prev) = previous {
                    expected.insert((prev, a.as_str()));
                }
                expected.insert((a.as_str(), b.as_str()));
                previous = Some(b.as_str());
            }
        }
        let exact = exact_ascii_metrics(text.as_bytes(), 2).unwrap();
        assert_eq!(exact, [32768, 128, 32767, expected.len() as u64]);
        assert!(
            build_ngram_freq_map_ascii(text.as_bytes(), 2)
                .unwrap()
                .len()
                < expected.len()
        );
        assert_eq!(
            exact_ascii_metrics(b"A a B", usize::MAX).unwrap(),
            [3, 2, 0, 0]
        );
    }

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
