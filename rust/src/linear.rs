use crate::{CoreError, CoreResult};

pub fn scores_sparse_ids(
    doc_offsets: &[u32],
    feature_ids: &[u32],
    feature_values: &[f64],
    class_count: u32,
    feature_count: u32,
    weights: &[f64],  // row-major [class_count * feature_count]
    bias: &[f64],     // [class_count]
    out_scores: &mut [f64], // row-major [doc_count * class_count]
) -> CoreResult<()> {
    if class_count == 0 {
        return Err(CoreError::InvalidN);
    }
    if doc_offsets.is_empty() {
        return Err(CoreError::InvalidN);
    }
    if feature_ids.len() != feature_values.len() {
        return Err(CoreError::InsufficientCapacity);
    }

    let docs = doc_offsets.len() - 1;
    let classes = class_count as usize;
    let features = feature_count as usize;
    let expected_weights = classes * features;
    if weights.len() < expected_weights || bias.len() < classes {
        return Err(CoreError::InsufficientCapacity);
    }
    if out_scores.len() < docs * classes {
        return Err(CoreError::InsufficientCapacity);
    }

    for doc_idx in 0..docs {
        let start = doc_offsets[doc_idx] as usize;
        let end = doc_offsets[doc_idx + 1] as usize;
        if start > end || end > feature_ids.len() {
            return Err(CoreError::InsufficientCapacity);
        }

        let out_base = doc_idx * classes;
        out_scores[out_base..out_base + classes].copy_from_slice(&bias[0..classes]);

        for nnz_idx in start..end {
            let fid = feature_ids[nnz_idx] as usize;
            if fid >= features {
                continue;
            }
            let value = feature_values[nnz_idx];

            for class_idx in 0..classes {
                let weight = weights[class_idx * features + fid];
                out_scores[out_base + class_idx] += weight * value;
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scores_sparse_ids_computes_expected_class_logits() {
        let doc_offsets: [u32; 3] = [0, 2, 3];
        let feature_ids: [u32; 3] = [0, 2, 1];
        let feature_values: [f64; 3] = [1.0, 2.0, 3.0];
        // class 0 weights: [1, 0, 1], class 1 weights: [0, 2, 1]
        let weights: [f64; 6] = [1.0, 0.0, 1.0, 0.0, 2.0, 1.0];
        let bias: [f64; 2] = [0.5, -0.5];
        let mut out = [0f64; 4];
        scores_sparse_ids(&doc_offsets, &feature_ids, &feature_values, 2, 3, &weights, &bias, &mut out).unwrap();
        assert!((out[0] - 3.5).abs() < 1e-12);
        assert!((out[1] - 1.5).abs() < 1e-12);
        assert!((out[2] - 0.5).abs() < 1e-12);
        assert!((out[3] - 5.5).abs() < 1e-12);
    }
}
