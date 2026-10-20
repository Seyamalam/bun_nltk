use crate::numeric_validation::{filled, offsets, product};
use crate::{CoreError, CoreResult};

pub fn predict_batch(
    feature_ids: &[u32],
    token_offsets: &[u32],
    weights: &[f32],
    model_feature_count: u32,
    tag_count: u32,
    out_tag_ids: &mut [u16],
) -> CoreResult<()> {
    if tag_count == 0 || tag_count > u16::MAX as u32 + 1 {
        return Err(CoreError::InvalidN);
    }
    if token_offsets.is_empty() {
        return if feature_ids.is_empty() {
            Ok(())
        } else {
            Err(CoreError::InsufficientCapacity)
        };
    }
    offsets(token_offsets, feature_ids.len())?;

    let token_count = token_offsets.len() - 1;
    if out_tag_ids.len() < token_count {
        return Err(CoreError::InsufficientCapacity);
    }

    let expected_weights = product(model_feature_count as usize, tag_count as usize)?;
    if weights.len() < expected_weights {
        return Err(CoreError::InsufficientCapacity);
    }

    if weights[..expected_weights]
        .iter()
        .any(|value| !value.is_finite())
    {
        return Err(CoreError::InvalidN);
    }
    let mut scores = filled(tag_count as usize, 0f32)?;

    for token_idx in 0..token_count {
        scores.iter_mut().for_each(|s| *s = 0.0);
        let start = token_offsets[token_idx] as usize;
        let end = token_offsets[token_idx + 1] as usize;

        for &feature_id in &feature_ids[start..end] {
            if feature_id >= model_feature_count {
                continue;
            }

            let base = (feature_id as usize) * (tag_count as usize);
            for tag_idx in 0..(tag_count as usize) {
                scores[tag_idx] += weights[base + tag_idx];
            }
        }

        if scores.iter().any(|value| !value.is_finite()) {
            return Err(CoreError::InvalidN);
        }
        let mut best_id: u16 = 0;
        let mut best_score: f32 = scores[0];
        for (tag_idx, &score) in scores.iter().enumerate().skip(1) {
            if score > best_score {
                best_score = score;
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
    fn rejects_malformed_buffers_before_writing_output() {
        for offsets in [&[0, 1, 0][..], &[1, 1], &[0, 2], &[0, 0]] {
            let mut out = [77; 2];
            assert_eq!(
                predict_batch(&[0], offsets, &[1.0, 0.0], 1, 2, &mut out),
                Err(CoreError::InsufficientCapacity)
            );
            assert_eq!(out, [77; 2]);
        }
        assert_eq!(
            predict_batch(&[0], &[0, 1], &[0.0], 1, 2, &mut [0]),
            Err(CoreError::InsufficientCapacity)
        );
        assert_eq!(
            predict_batch(&[], &[0], &[], u32::MAX, 65536, &mut []),
            Err(CoreError::InsufficientCapacity)
        );
        assert_eq!(
            predict_batch(&[], &[], &[], 0, 65537, &mut []),
            Err(CoreError::InvalidN)
        );
        assert_eq!(
            predict_batch(&[0], &[], &[], 0, 1, &mut []),
            Err(CoreError::InsufficientCapacity)
        );
    }

    #[test]
    fn rejects_nonfinite_weights_and_score_overflow() {
        for value in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            assert_eq!(
                predict_batch(&[0], &[0, 1], &[value], 1, 1, &mut [0]),
                Err(CoreError::InvalidN)
            );
        }
        assert_eq!(
            predict_batch(&[0, 0], &[0, 2], &[f32::MAX], 1, 1, &mut [0]),
            Err(CoreError::InvalidN)
        );
    }

    #[test]
    fn keeps_unknown_features_ties_empty_rows_and_full_u16_tag_range() {
        let mut out = [9; 2];
        predict_batch(&[u32::MAX], &[0, 0, 1], &[], 0, 2, &mut out).unwrap();
        assert_eq!(out, [0, 0]);
        let mut weights = vec![0.0; 65536];
        weights[65535] = 1.0;
        predict_batch(&[0], &[0, 1], &weights, 1, 65536, &mut out).unwrap();
        assert_eq!(out, [65535, 0]);
    }

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
