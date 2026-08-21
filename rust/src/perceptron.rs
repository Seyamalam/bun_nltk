use crate::{CoreError, CoreResult};

pub fn predict_batch(
    feature_ids: &[u32],
    token_offsets: &[u32],
    weights: &[f32],
    model_feature_count: u32,
    tag_count: u32,
    out_tag_ids: &mut [u16],
) -> CoreResult<()> {
    if tag_count == 0 {
        return Err(CoreError::InvalidN);
    }
    if token_offsets.is_empty() {
        return Ok(());
    }

    let token_count = token_offsets.len() - 1;
    if out_tag_ids.len() < token_count {
        return Err(CoreError::InsufficientCapacity);
    }

    let expected_weights = (model_feature_count as usize) * (tag_count as usize);
    if weights.len() < expected_weights {
        return Err(CoreError::InsufficientCapacity);
    }

    let mut scores = vec![0f32; tag_count as usize];

    for token_idx in 0..token_count {
        scores.iter_mut().for_each(|s| *s = 0.0);
        let start = token_offsets[token_idx] as usize;
        let end = token_offsets[token_idx + 1] as usize;

        if start > end || end > feature_ids.len() {
            return Err(CoreError::InsufficientCapacity);
        }

        for feature_idx in start..end {
            let feature_id = feature_ids[feature_idx];
            if feature_id >= model_feature_count {
                continue;
            }

            let base = (feature_id as usize) * (tag_count as usize);
            for tag_idx in 0..(tag_count as usize) {
                scores[tag_idx] += weights[base + tag_idx];
            }
        }

        let mut best_id: u16 = 0;
        let mut best_score: f32 = scores[0];
        for tag_idx in 1..(tag_count as usize) {
            if scores[tag_idx] > best_score {
                best_score = scores[tag_idx];
                best_id = tag_idx as u16;
            }
        }

        out_tag_ids[token_idx] = best_id;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn predict_batch_basic_case() {
        let feature_ids: [u32; 3] = [0, 1, 1];
        let token_offsets: [u32; 3] = [0, 1, 3];
        let weights: [f32; 4] = [1.0, 0.0, 0.0, 1.0];
        let mut out = [0u16; 2];

        predict_batch(&feature_ids, &token_offsets, &weights, 2, 2, &mut out).unwrap();
        assert_eq!(out[0], 0);
        assert_eq!(out[1], 1);
    }
}
