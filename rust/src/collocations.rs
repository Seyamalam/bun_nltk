use crate::ascii;
use crate::freqdist;
use crate::token_ids;
use crate::{CoreError, CoreResult};
use std::collections::HashMap;

pub fn pack_bigram_key(left: u64, right: u64) -> u128 {
    ((left as u128) << 64) | (right as u128)
}

pub fn unpack_bigram_left(key: u128) -> u64 {
    (key >> 64) as u64
}

pub fn unpack_bigram_right(key: u128) -> u64 {
    (key & (u64::MAX as u128)) as u64
}

struct BigramBuildResult {
    token_total: u64,
    word_map: HashMap<u64, u64>,
    bigram_map: HashMap<u128, u64>,
}

fn build_bigram_stats_ascii(input: &[u8]) -> CoreResult<BigramBuildResult> {
    let mut word_map: HashMap<u64, u64> = HashMap::new();
    let mut bigram_map: HashMap<u128, u64> = HashMap::new();

    let mut in_token = false;
    let mut token_hash = ascii::FNV_OFFSET_BASIS;
    let mut token_total: u64 = 0;
    let mut prev_hash: Option<u64> = None;

    for &ch in input {
        if ascii::is_token_char(ch) {
            if !in_token {
                in_token = true;
                token_hash = ascii::FNV_OFFSET_BASIS;
            }
            token_hash = ascii::token_hash_update(token_hash, ch);
        } else if in_token {
            freqdist::update_count(&mut word_map, token_hash);
            if let Some(prev) = prev_hash {
                freqdist::update_count_u128(&mut bigram_map, pack_bigram_key(prev, token_hash));
            }
            prev_hash = Some(token_hash);
            token_total += 1;
            in_token = false;
        }
    }

    if in_token {
        freqdist::update_count(&mut word_map, token_hash);
        if let Some(prev) = prev_hash {
            freqdist::update_count_u128(&mut bigram_map, pack_bigram_key(prev, token_hash));
        }
        token_total += 1;
    }

    Ok(BigramBuildResult {
        token_total,
        word_map,
        bigram_map,
    })
}

fn build_windowed_bigram_stats_ascii(input: &[u8], window_size: usize) -> CoreResult<BigramBuildResult> {
    if window_size < 2 {
        return Err(CoreError::InvalidN);
    }

    let token_hashes = ascii::collect_token_hashes_ascii(input);

    let mut word_map: HashMap<u64, u64> = HashMap::new();
    for &token_hash in &token_hashes {
        freqdist::update_count(&mut word_map, token_hash);
    }

    let mut bigram_map: HashMap<u128, u64> = HashMap::new();

    for (i, &left_hash) in token_hashes.iter().enumerate() {
        let end = token_hashes.len().min(i + window_size);
        for j in i + 1..end {
            freqdist::update_count_u128(&mut bigram_map, pack_bigram_key(left_hash, token_hashes[j]));
        }
    }

    Ok(BigramBuildResult {
        token_total: token_hashes.len() as u64,
        word_map,
        bigram_map,
    })
}

#[derive(Clone, Copy)]
struct PmiEntry {
    key: u128,
    score: f64,
}

fn pmi_entry_better(a: PmiEntry, b: PmiEntry) -> bool {
    if a.score > b.score {
        return true;
    }
    if a.score < b.score {
        return false;
    }
    a.key < b.key
}

fn pmi_entry_worse(a: PmiEntry, b: PmiEntry) -> bool {
    if a.score < b.score {
        return true;
    }
    if a.score > b.score {
        return false;
    }
    a.key > b.key
}

fn worst_entry_index(entries: &[PmiEntry]) -> usize {
    let mut worst_idx: usize = 0;
    for i in 1..entries.len() {
        if pmi_entry_worse(entries[i], entries[worst_idx]) {
            worst_idx = i;
        }
    }
    worst_idx
}

fn sort_pmi_entries_desc(entries: &mut [PmiEntry]) {
    if entries.len() <= 1 {
        return;
    }

    for i in 1..entries.len() {
        let mut j = i;
        while j > 0 && pmi_entry_better(entries[j], entries[j - 1]) {
            entries.swap(j - 1, j);
            j -= 1;
        }
    }
}

pub fn fill_top_pmi_bigrams_ascii(
    input: &[u8],
    window_size: usize,
    top_k: usize,
    out_left_hashes: &mut [u64],
    out_right_hashes: &mut [u64],
    out_scores: &mut [f64],
) -> CoreResult<u64> {
    if top_k == 0 || input.is_empty() {
        return Ok(0);
    }
    if window_size < 2 {
        return Err(CoreError::InvalidN);
    }
    if out_left_hashes.len() != out_right_hashes.len() || out_left_hashes.len() != out_scores.len() {
        return Err(CoreError::InsufficientCapacity);
    }
    if out_left_hashes.is_empty() {
        return Err(CoreError::InsufficientCapacity);
    }

    let stats = if window_size == 2 {
        build_bigram_stats_ascii(input)?
    } else {
        build_windowed_bigram_stats_ascii(input, window_size)?
    };

    if stats.token_total < 2 || stats.bigram_map.is_empty() {
        return Ok(0);
    }

    let target = top_k.min(out_left_hashes.len());
    let mut best: Vec<PmiEntry> = Vec::with_capacity(target);
    let mut best_len: usize = 0;

    for (&key, &count_bigram) in stats.bigram_map.iter() {
        let left = unpack_bigram_left(key);
        let right = unpack_bigram_right(key);

        let left_count = match stats.word_map.get(&left) {
            Some(c) => *c,
            None => continue,
        };
        let right_count = match stats.word_map.get(&right) {
            Some(c) => *c,
            None => continue,
        };
        if left_count == 0 || right_count == 0 {
            continue;
        }

        let window_norm = (window_size - 1) as f64;
        let numerator = ((count_bigram as f64) * (stats.token_total as f64)) / window_norm;
        let denominator = (left_count as f64) * (right_count as f64);
        let score = (numerator / denominator).log2();
        let cand = PmiEntry { key, score };

        if best_len < target {
            best.push(cand);
            best_len += 1;
        } else {
            let idx = worst_entry_index(&best[..best_len]);
            if pmi_entry_better(cand, best[idx]) {
                best[idx] = cand;
            }
        }
    }

    sort_pmi_entries_desc(&mut best[..best_len]);

    for (i, item) in best[..best_len].iter().enumerate() {
        out_left_hashes[i] = unpack_bigram_left(item.key);
        out_right_hashes[i] = unpack_bigram_right(item.key);
        out_scores[i] = item.score;
    }

    Ok(best_len as u64)
}

fn pack_bigram_id_key(left_id: u32, right_id: u32) -> u64 {
    ((left_id as u64) << 32) | (right_id as u64)
}

fn unpack_bigram_left_id(key: u64) -> u32 {
    (key >> 32) as u32
}

fn unpack_bigram_right_id(key: u64) -> u32 {
    (key & (u32::MAX as u64)) as u32
}

#[derive(Clone, Copy)]
struct IdBigramEntry {
    key: u64,
    count: u64,
    pmi: f64,
}

fn sort_id_bigram_entries(entries: &mut [IdBigramEntry]) {
    if entries.len() <= 1 {
        return;
    }

    for i in 1..entries.len() {
        let mut j = i;
        while j > 0 && entries[j].key < entries[j - 1].key {
            entries.swap(j - 1, j);
            j -= 1;
        }
    }
}

fn build_bigram_id_count_map(
    token_id_sequence: &[u32],
    window_size: usize,
) -> CoreResult<HashMap<u64, u64>> {
    if window_size < 2 {
        return Err(CoreError::InvalidN);
    }

    let mut map: HashMap<u64, u64> = HashMap::new();

    for (i, &left_id) in token_id_sequence.iter().enumerate() {
        let end = token_id_sequence.len().min(i + window_size);
        for j in i + 1..end {
            let right_id = token_id_sequence[j];
            let key = pack_bigram_id_key(left_id, right_id);
            freqdist::update_count(&mut map, key);
        }
    }

    Ok(map)
}

pub fn count_unique_bigrams_window_ids_ascii(input: &[u8], window_size: usize) -> CoreResult<u64> {
    if window_size < 2 {
        return Err(CoreError::InvalidN);
    }

    let ids = token_ids::build_token_id_data_ascii(input)?;
    if ids.token_ids.len() < 2 {
        return Ok(0);
    }

    let map = build_bigram_id_count_map(&ids.token_ids, window_size)?;

    Ok(map.len() as u64)
}

pub fn fill_bigram_window_stats_ids_ascii(
    input: &[u8],
    window_size: usize,
    out_left_ids: &mut [u32],
    out_right_ids: &mut [u32],
    out_counts: &mut [u64],
    out_pmis: &mut [f64],
) -> CoreResult<u64> {
    if window_size < 2 {
        return Err(CoreError::InvalidN);
    }
    if out_left_ids.len() != out_right_ids.len()
        || out_left_ids.len() != out_counts.len()
        || out_left_ids.len() != out_pmis.len()
    {
        return Err(CoreError::InsufficientCapacity);
    }

    let ids = token_ids::build_token_id_data_ascii(input)?;
    if ids.token_ids.len() < 2 {
        return Ok(0);
    }

    let bigram_counts = build_bigram_id_count_map(&ids.token_ids, window_size)?;

    let unique = bigram_counts.len();
    if out_left_ids.len() < unique {
        return Err(CoreError::InsufficientCapacity);
    }

    let mut entries: Vec<IdBigramEntry> = Vec::with_capacity(unique);

    for (&key, &count) in bigram_counts.iter() {
        let left_id = unpack_bigram_left_id(key);
        let right_id = unpack_bigram_right_id(key);

        let left_count = ids.token_counts[left_id as usize];
        let right_count = ids.token_counts[right_id as usize];
        let numerator = (count as f64) * (ids.token_ids.len() as f64);
        let denominator =
            (left_count as f64) * (right_count as f64) * ((window_size - 1) as f64);

        entries.push(IdBigramEntry {
            key,
            count,
            pmi: (numerator / denominator).log2(),
        });
    }

    sort_id_bigram_entries(&mut entries);

    for (i, row) in entries.iter().enumerate() {
        out_left_ids[i] = unpack_bigram_left_id(row.key);
        out_right_ids[i] = unpack_bigram_right_id(row.key);
        out_counts[i] = row.count;
        out_pmis[i] = row.pmi;
    }

    Ok(unique as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ascii;

    fn find_score(
        left_hashes: &[u64],
        right_hashes: &[u64],
        scores: &[f64],
        left: u64,
        right: u64,
    ) -> Option<f64> {
        for (i, &lh) in left_hashes.iter().enumerate() {
            if lh == left && right_hashes[i] == right {
                return Some(scores[i]);
            }
        }
        None
    }

    #[test]
    fn top_pmi_bigrams_repeated_sentence() {
        let input = b"this this is is a a test test";
        let mut left = [0u64; 3];
        let mut right = [0u64; 3];
        let mut scores = [0f64; 3];

        let written = fill_top_pmi_bigrams_ascii(input, 2, 3, &mut left, &mut right, &mut scores).unwrap();
        assert_eq!(written, 3);
        for score in scores.iter().take(written as usize) {
            assert!((score - 1.0).abs() < 1e-12);
        }
    }

    #[test]
    fn windowed_top_pmi_matches_nltk_sample_scores() {
        let input = b"this this is is a a test test";

        let hash_this = ascii::hash_token(b"this");
        let hash_is = ascii::hash_token(b"is");
        let hash_a = ascii::hash_token(b"a");
        let hash_test = ascii::hash_token(b"test");

        let mut left3 = [0u64; 16];
        let mut right3 = [0u64; 16];
        let mut scores3 = [0f64; 16];
        let written3 = fill_top_pmi_bigrams_ascii(input, 3, 16, &mut left3, &mut right3, &mut scores3).unwrap();
        assert_eq!(written3, 7);

        let n = written3 as usize;
        let score_this_is_w3 = find_score(&left3[..n], &right3[..n], &scores3[..n], hash_this, hash_is).unwrap();
        let score_is_a_w3 = find_score(&left3[..n], &right3[..n], &scores3[..n], hash_is, hash_a).unwrap();
        let score_a_test_w3 = find_score(&left3[..n], &right3[..n], &scores3[..n], hash_a, hash_test).unwrap();
        assert!((score_this_is_w3 - 1.584962500721156).abs() < 1e-12);
        assert!((score_is_a_w3 - 1.584962500721156).abs() < 1e-12);
        assert!((score_a_test_w3 - 1.584962500721156).abs() < 1e-12);

        let mut left5 = [0u64; 16];
        let mut right5 = [0u64; 16];
        let mut scores5 = [0f64; 16];
        let written5 = fill_top_pmi_bigrams_ascii(input, 5, 16, &mut left5, &mut right5, &mut scores5).unwrap();
        assert_eq!(written5, 9);

        let n5 = written5 as usize;
        let score_this_a_w5 = find_score(&left5[..n5], &right5[..n5], &scores5[..n5], hash_this, hash_a).unwrap();
        let score_is_test_w5 = find_score(&left5[..n5], &right5[..n5], &scores5[..n5], hash_is, hash_test).unwrap();
        assert!((score_this_a_w5 - 0.5849625007211562).abs() < 1e-12);
        assert!((score_is_test_w5 - 0.5849625007211562).abs() < 1e-12);
    }

    #[test]
    fn windowed_id_bigram_stats_include_expected_counts() {
        let input = b"this this is is a a test test";

        let unique = count_unique_bigrams_window_ids_ascii(input, 3).unwrap();
        assert_eq!(unique, 7);

        let mut left = [0u32; 8];
        let mut right = [0u32; 8];
        let mut counts = [0u64; 8];
        let mut pmis = [0f64; 8];
        let written = fill_bigram_window_stats_ids_ascii(input, 3, &mut left, &mut right, &mut counts, &mut pmis).unwrap();
        assert_eq!(written, 7);

        // First-occurrence ids for this sentence:
        // this->0, is->1, a->2, test->3
        // window=3 should include (0,1), (1,2), (2,3) with count 3
        let n = written as usize;
        let mut found_01 = false;
        let mut found_12 = false;
        let mut found_23 = false;
        for i in 0..n {
            if left[i] == 0 && right[i] == 1 && counts[i] == 3 {
                found_01 = true;
            }
            if left[i] == 1 && right[i] == 2 && counts[i] == 3 {
                found_12 = true;
            }
            if left[i] == 2 && right[i] == 3 && counts[i] == 3 {
                found_23 = true;
            }
        }
        assert!(found_01 && found_12 && found_23);
    }
}
