use crate::ascii;
use crate::{CoreError, CoreResult};
use std::collections::HashMap;

pub struct TokenIdData {
    pub token_ids: Vec<u32>,
    pub token_texts: Vec<Vec<u8>>,
    pub token_counts: Vec<u64>,
}

impl TokenIdData {
    pub fn unique_count(&self) -> usize {
        self.token_texts.len()
    }

    pub fn token_blob_bytes(&self) -> usize {
        let mut total: usize = 0;
        for token in &self.token_texts {
            total += token.len();
        }
        total
    }
}

fn emit_token(result: &mut TokenIdData, map: &mut HashMap<Vec<u8>, u32>, scratch: &[u8]) {
    if let Some(&id) = map.get(scratch) {
        result.token_counts[id as usize] += 1;
        result.token_ids.push(id);
    } else {
        let id = result.token_texts.len() as u32;
        map.insert(scratch.to_vec(), id);
        result.token_texts.push(scratch.to_vec());
        result.token_counts.push(1);
        result.token_ids.push(id);
    }
}

pub fn build_token_id_data_ascii(input: &[u8]) -> CoreResult<TokenIdData> {
    let mut result = TokenIdData {
        token_ids: Vec::new(),
        token_texts: Vec::new(),
        token_counts: Vec::new(),
    };

    let mut map: HashMap<Vec<u8>, u32> = HashMap::new();

    let mut scratch: Vec<u8> = Vec::new();
    let mut in_token = false;
    let mut token_start: usize = 0;

    for (i, &ch) in input.iter().enumerate() {
        if ascii::is_token_char(ch) {
            if !in_token {
                in_token = true;
                token_start = i;
            }
        } else if in_token {
            scratch.clear();
            for &token_ch in &input[token_start..i] {
                scratch.push(ascii::ascii_lower(token_ch));
            }

            emit_token(&mut result, &mut map, &scratch);
            in_token = false;
        }
    }

    if in_token {
        scratch.clear();
        for &token_ch in &input[token_start..] {
            scratch.push(ascii::ascii_lower(token_ch));
        }

        emit_token(&mut result, &mut map, &scratch);
    }

    Ok(result)
}

pub fn count_token_blob_bytes_ascii(input: &[u8]) -> CoreResult<u64> {
    let data = build_token_id_data_ascii(input)?;
    Ok(data.token_blob_bytes() as u64)
}

pub fn fill_token_freq_dist_ids_ascii(
    data: &TokenIdData,
    out_blob: &mut [u8],
    out_offsets: &mut [u32],
    out_lengths: &mut [u32],
    out_counts: &mut [u64],
) -> CoreResult<()> {
    if out_offsets.len() != out_lengths.len() || out_offsets.len() != out_counts.len() {
        return Err(CoreError::InsufficientCapacity);
    }

    let unique = data.unique_count();
    if out_offsets.len() < unique {
        return Err(CoreError::InsufficientCapacity);
    }

    let mut cursor: usize = 0;
    for (i, token) in data.token_texts.iter().enumerate() {
        if cursor + token.len() > out_blob.len() {
            return Err(CoreError::InsufficientCapacity);
        }

        out_blob[cursor..cursor + token.len()].copy_from_slice(token);
        out_offsets[i] = cursor as u32;
        out_lengths[i] = token.len() as u32;
        out_counts[i] = data.token_counts[i];
        cursor += token.len();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_id_data_is_reversible_and_collision_free() {
        let text = b"Apple apple APPLE banana BANANA";

        let data = build_token_id_data_ascii(text).unwrap();

        assert_eq!(data.unique_count(), 2);
        assert_eq!(data.token_texts[0].as_slice(), b"apple");
        assert_eq!(data.token_texts[1].as_slice(), b"banana");
        assert_eq!(data.token_counts[0], 3);
        assert_eq!(data.token_counts[1], 2);

        let needed = data.token_blob_bytes();
        let mut blob = vec![0u8; needed];

        let mut offsets = [0u32; 2];
        let mut lengths = [0u32; 2];
        let mut counts = [0u64; 2];
        fill_token_freq_dist_ids_ascii(
            &data,
            &mut blob,
            &mut offsets,
            &mut lengths,
            &mut counts,
        )
        .unwrap();

        let start = offsets[0] as usize;
        let end = start + lengths[0] as usize;
        assert_eq!(&blob[start..end], b"apple");
        let start = offsets[1] as usize;
        let end = start + lengths[1] as usize;
        assert_eq!(&blob[start..end], b"banana");
    }
}
