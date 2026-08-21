use crate::token_ids;
use crate::{CoreError, CoreResult};

fn token_count(input: &[u8]) -> CoreResult<usize> {
    let data = token_ids::build_token_id_data_ascii(input)?;
    Ok(data.token_ids.len())
}

pub fn count_ngrams_ids_ascii(input: &[u8], n: usize) -> CoreResult<u64> {
    if n == 0 {
        return Err(CoreError::InvalidN);
    }
    let t = token_count(input)?;
    if t < n {
        return Ok(0);
    }
    Ok((t - n + 1) as u64)
}

pub fn fill_ngrams_ids_ascii(input: &[u8], n: usize, out_flat_ids: &mut [u32]) -> CoreResult<u64> {
    if n == 0 {
        return Err(CoreError::InvalidN);
    }

    let data = token_ids::build_token_id_data_ascii(input)?;

    let t = data.token_ids.len();
    if t < n {
        return Ok(0);
    }

    let grams = t - n + 1;
    let needed_ids = grams * n;
    if out_flat_ids.len() < needed_ids {
        return Err(CoreError::InsufficientCapacity);
    }

    let mut out_idx: usize = 0;
    for start in 0..grams {
        out_flat_ids[out_idx..out_idx + n].copy_from_slice(&data.token_ids[start..start + n]);
        out_idx += n;
    }

    Ok(grams as u64)
}

pub fn count_everygrams_ids_ascii(input: &[u8], min_len: usize, max_len: usize) -> CoreResult<u64> {
    if min_len == 0 || max_len == 0 {
        return Err(CoreError::InvalidN);
    }
    if min_len > max_len {
        return Ok(0);
    }

    let t = token_count(input)?;
    if t == 0 {
        return Ok(0);
    }

    let max_n = max_len.min(t);
    let mut total: usize = 0;

    for start in 0..t {
        let span = t - start;
        let upper = max_n.min(span);
        if upper < min_len {
            continue;
        }
        total += upper - min_len + 1;
    }

    Ok(total as u64)
}

pub fn count_everygram_id_values_ascii(input: &[u8], min_len: usize, max_len: usize) -> CoreResult<u64> {
    if min_len == 0 || max_len == 0 {
        return Err(CoreError::InvalidN);
    }
    if min_len > max_len {
        return Ok(0);
    }

    let data = token_ids::build_token_id_data_ascii(input)?;

    let t = data.token_ids.len();
    if t == 0 {
        return Ok(0);
    }

    let max_n = max_len.min(t);
    let mut total_ids: usize = 0;

    for start in 0..t {
        let span = t - start;
        let upper = max_n.min(span);
        if upper < min_len {
            continue;
        }
        for n in min_len..=upper {
            total_ids += n;
        }
    }

    Ok(total_ids as u64)
}

pub fn fill_everygrams_ids_ascii(
    input: &[u8],
    min_len: usize,
    max_len: usize,
    out_lens: &mut [u32],
    out_flat_ids: &mut [u32],
) -> CoreResult<u64> {
    if min_len == 0 || max_len == 0 {
        return Err(CoreError::InvalidN);
    }
    if min_len > max_len {
        return Ok(0);
    }

    let data = token_ids::build_token_id_data_ascii(input)?;

    let t = data.token_ids.len();
    if t == 0 {
        return Ok(0);
    }

    let max_n = max_len.min(t);
    let mut total_grams: usize = 0;
    let mut total_ids: usize = 0;

    for start in 0..t {
        let span = t - start;
        let upper = max_n.min(span);
        if upper < min_len {
            continue;
        }
        total_grams += upper - min_len + 1;
        for n in min_len..=upper {
            total_ids += n;
        }
    }

    if out_lens.len() < total_grams || out_flat_ids.len() < total_ids {
        return Err(CoreError::InsufficientCapacity);
    }

    let mut gram_idx: usize = 0;
    let mut id_idx: usize = 0;

    for start in 0..t {
        let span = t - start;
        let upper = max_n.min(span);
        if upper < min_len {
            continue;
        }

        for n in min_len..=upper {
            out_lens[gram_idx] = n as u32;
            out_flat_ids[id_idx..id_idx + n].copy_from_slice(&data.token_ids[start..start + n]);
            gram_idx += 1;
            id_idx += n;
        }
    }

    Ok(total_grams as u64)
}

fn count_skipgrams_from_seq(token_seq: &[u32], n: usize, k: usize) -> usize {
    if n == 0 {
        return 0;
    }
    if n == 1 {
        return token_seq.len();
    }

    let tail_slots = n + k - 1;
    let mut total: usize = 0;

    fn run(
        token_seq: &[u32],
        i: usize,
        tail_slots: usize,
        need: usize,
        start_slot: usize,
        combo: &mut Vec<usize>,
        total: &mut usize,
    ) {
        if need == 0 {
            for &slot in combo.iter() {
                let idx = i + 1 + slot;
                if idx >= token_seq.len() {
                    return;
                }
            }
            *total += 1;
            return;
        }

        let mut s = start_slot;
        while s <= tail_slots - need {
            combo.push(s);
            run(token_seq, i, tail_slots, need - 1, s + 1, combo, total);
            combo.pop();
            s += 1;
        }
    }

    let mut combo: Vec<usize> = Vec::with_capacity(n - 1);

    for i in 0..token_seq.len() {
        run(token_seq, i, tail_slots, n - 1, 0, &mut combo, &mut total);
    }

    total
}

pub fn count_skipgrams_ids_ascii(input: &[u8], n: usize, k: usize) -> CoreResult<u64> {
    if n == 0 {
        return Err(CoreError::InvalidN);
    }

    let data = token_ids::build_token_id_data_ascii(input)?;

    Ok(count_skipgrams_from_seq(&data.token_ids, n, k) as u64)
}

pub fn fill_skipgrams_ids_ascii(
    input: &[u8],
    n: usize,
    k: usize,
    out_flat_ids: &mut [u32],
) -> CoreResult<u64> {
    if n == 0 {
        return Err(CoreError::InvalidN);
    }

    let data = token_ids::build_token_id_data_ascii(input)?;

    let token_seq = &data.token_ids;
    let total = count_skipgrams_from_seq(token_seq, n, k);
    let needed_ids = total * n;
    if out_flat_ids.len() < needed_ids {
        return Err(CoreError::InsufficientCapacity);
    }

    if n == 1 {
        out_flat_ids[..token_seq.len()].copy_from_slice(token_seq);
        return Ok(token_seq.len() as u64);
    }

    let tail_slots = n + k - 1;
    let mut combo: Vec<usize> = Vec::with_capacity(n - 1);
    let mut out_idx: usize = 0;

    fn run(
        token_seq: &[u32],
        i: usize,
        tail_slots: usize,
        need: usize,
        start_slot: usize,
        combo: &mut Vec<usize>,
        out_ids: &mut [u32],
        out_idx: &mut usize,
    ) {
        if need == 0 {
            for &slot in combo.iter() {
                let idx = i + 1 + slot;
                if idx >= token_seq.len() {
                    return;
                }
            }

            out_ids[*out_idx] = token_seq[i];
            *out_idx += 1;
            for &slot in combo.iter() {
                let idx = i + 1 + slot;
                out_ids[*out_idx] = token_seq[idx];
                *out_idx += 1;
            }
            return;
        }

        let mut s = start_slot;
        while s <= tail_slots - need {
            combo.push(s);
            run(token_seq, i, tail_slots, need - 1, s + 1, combo, out_ids, out_idx);
            combo.pop();
            s += 1;
        }
    }

    for i in 0..token_seq.len() {
        run(token_seq, i, tail_slots, n - 1, 0, &mut combo, out_flat_ids, &mut out_idx);
    }

    Ok(total as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ngram_ids_and_everygrams_match_expected_counts() {
        let input = b"a b c";

        let grams2 = count_ngrams_ids_ascii(input, 2).unwrap();
        assert_eq!(grams2, 2);

        let every = count_everygrams_ids_ascii(input, 1, 3).unwrap();
        assert_eq!(every, 6);

        let every_ids = count_everygram_id_values_ascii(input, 1, 3).unwrap();
        assert_eq!(every_ids, 10);
    }

    #[test]
    fn skipgram_count_example() {
        let input = b"Insurgents killed in ongoing fighting";
        let count = count_skipgrams_ids_ascii(input, 2, 2).unwrap();
        assert_eq!(count, 9);
    }
}
