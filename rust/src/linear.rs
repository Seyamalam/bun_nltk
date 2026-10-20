use crate::numeric_validation::{filled, offsets, product};
use crate::{CoreError, CoreResult};

fn validate_sparse(doc_offsets: &[u32], ids: &[u32], values: &[f64]) -> CoreResult<()> {
    offsets(doc_offsets, ids.len())?;
    if ids.len() != values.len() {
        return Err(CoreError::InsufficientCapacity);
    }
    if values.iter().any(|value| !value.is_finite()) {
        return Err(CoreError::InvalidN);
    }
    Ok(())
}

// Flat row-major buffers mirror the shared native/WASM scoring ABI.
#[allow(clippy::too_many_arguments)]
pub fn scores_sparse_ids(
    doc_offsets: &[u32],
    feature_ids: &[u32],
    feature_values: &[f64],
    class_count: u32,
    feature_count: u32,
    weights: &[f64],        // row-major [class_count * feature_count]
    bias: &[f64],           // [class_count]
    out_scores: &mut [f64], // row-major [doc_count * class_count]
) -> CoreResult<()> {
    if class_count == 0 {
        return Err(CoreError::InvalidN);
    }
    if doc_offsets.is_empty() {
        return Err(CoreError::InvalidN);
    }
    validate_sparse(doc_offsets, feature_ids, feature_values)?;

    let docs = doc_offsets.len() - 1;
    let classes = class_count as usize;
    let features = feature_count as usize;
    let expected_weights = product(classes, features)?;
    let expected_scores = product(docs, classes)?;
    if weights.len() < expected_weights || bias.len() < classes {
        return Err(CoreError::InsufficientCapacity);
    }
    if out_scores.len() < expected_scores {
        return Err(CoreError::InsufficientCapacity);
    }
    if weights[..expected_weights]
        .iter()
        .chain(&bias[..classes])
        .any(|value| !value.is_finite())
    {
        return Err(CoreError::InvalidN);
    }

    for doc_idx in 0..docs {
        let start = doc_offsets[doc_idx] as usize;
        let end = doc_offsets[doc_idx + 1] as usize;

        let out_base = doc_idx * classes;
        for class_idx in 0..classes {
            let weight_base = class_idx * features;
            let mut score = bias[class_idx];
            for nnz_idx in start..end {
                let feature = feature_ids[nnz_idx] as usize;
                if feature < features {
                    score += weights[weight_base + feature] * feature_values[nnz_idx];
                }
            }
            if !score.is_finite() {
                return Err(CoreError::InvalidN);
            }
            out_scores[out_base + class_idx] = score;
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingAlgorithm {
    Logistic,
    LinearSvm,
}

#[allow(clippy::too_many_arguments)]
pub fn train_sparse_ids(
    doc_offsets: &[u32],
    feature_ids: &[u32],
    feature_values: &[f64],
    label_ids: &[u32],
    class_count: u32,
    feature_count: u32,
    algorithm: TrainingAlgorithm,
    epochs: u32,
    learning_rate: f64,
    l2: f64,
    margin: f64,
    weights: &mut [f64],
    bias: &mut [f64],
) -> CoreResult<()> {
    if doc_offsets.is_empty()
        || class_count == 0
        || epochs == 0
        || !learning_rate.is_finite()
        || learning_rate <= 0.0
        || !l2.is_finite()
        || l2 < 0.0
        || !margin.is_finite()
        || margin <= 0.0
    {
        return Err(CoreError::InvalidN);
    }
    validate_sparse(doc_offsets, feature_ids, feature_values)?;
    let docs = doc_offsets.len() - 1;
    let classes = class_count as usize;
    let features = feature_count as usize;
    let weight_count = product(classes, features)?;
    if label_ids.len() != docs
        || feature_ids.len() != feature_values.len()
        || weights.len() < weight_count
        || bias.len() < classes
        || label_ids.iter().any(|label| *label as usize >= classes)
    {
        return Err(CoreError::InsufficientCapacity);
    }

    let weights = &mut weights[..weight_count];
    let bias = &mut bias[..classes];
    if weights
        .iter()
        .chain(bias.iter())
        .any(|value| !value.is_finite())
    {
        return Err(CoreError::InvalidN);
    }
    let mut grad_weights = filled(weight_count, 0.0)?;
    let mut grad_bias = filled(classes, 0.0)?;
    let inv_docs = 1.0 / docs.max(1) as f64;

    for _ in 0..epochs {
        grad_weights.fill(0.0);
        grad_bias.fill(0.0);
        for doc_idx in 0..docs {
            let start = doc_offsets[doc_idx] as usize;
            let end = doc_offsets[doc_idx + 1] as usize;
            let gold = label_ids[doc_idx] as usize;
            for class_idx in 0..classes {
                let weight_base = class_idx * features;
                let mut score = bias[class_idx];
                for item_idx in start..end {
                    let feature = feature_ids[item_idx] as usize;
                    if feature < features {
                        score += weights[weight_base + feature] * feature_values[item_idx];
                    }
                }
                if !score.is_finite() {
                    return Err(CoreError::InvalidN);
                }
                let gradient = match algorithm {
                    TrainingAlgorithm::Logistic => {
                        let probability = if score >= 0.0 {
                            let z = (-score).exp();
                            1.0 / (1.0 + z)
                        } else {
                            let z = score.exp();
                            z / (1.0 + z)
                        };
                        let target = if class_idx == gold { 1.0 } else { 0.0 };
                        target - probability
                    }
                    TrainingAlgorithm::LinearSvm => {
                        let target = if class_idx == gold { 1.0 } else { -1.0 };
                        if target * score < margin {
                            -target
                        } else {
                            0.0
                        }
                    }
                };
                grad_bias[class_idx] += gradient;
                for item_idx in start..end {
                    let feature = feature_ids[item_idx] as usize;
                    if feature < features {
                        grad_weights[weight_base + feature] += gradient * feature_values[item_idx];
                    }
                }
            }
        }

        if grad_weights
            .iter()
            .chain(&grad_bias)
            .any(|value| !value.is_finite())
        {
            return Err(CoreError::InvalidN);
        }
        match algorithm {
            TrainingAlgorithm::Logistic => {
                for class_idx in 0..classes {
                    bias[class_idx] += learning_rate * grad_bias[class_idx] * inv_docs;
                }
                for (weight, gradient) in weights.iter_mut().zip(&grad_weights) {
                    let current = *weight;
                    *weight += learning_rate * (*gradient * inv_docs - l2 * current);
                }
            }
            TrainingAlgorithm::LinearSvm => {
                for class_idx in 0..classes {
                    bias[class_idx] -= learning_rate * grad_bias[class_idx] * inv_docs;
                }
                for (weight, gradient) in weights.iter_mut().zip(&grad_weights) {
                    let current = *weight;
                    *weight -= learning_rate * (*gradient * inv_docs + l2 * current);
                }
            }
        }
        if weights
            .iter()
            .chain(bias.iter())
            .any(|value| !value.is_finite())
        {
            return Err(CoreError::InvalidN);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_offsets_do_not_partially_write_or_train() {
        for offsets in [&[0, 1, 0][..], &[1, 1], &[0, 2], &[0, 0]] {
            let mut out = [77.0; 2];
            assert_eq!(
                scores_sparse_ids(offsets, &[0], &[1.0], 1, 1, &[1.0], &[0.0], &mut out),
                Err(CoreError::InsufficientCapacity)
            );
            assert_eq!(out, [77.0; 2]);
            let mut weights = [1.0];
            let mut bias = [0.0];
            assert_eq!(
                train_sparse_ids(
                    offsets,
                    &[0],
                    &[1.0],
                    &[0],
                    1,
                    1,
                    TrainingAlgorithm::Logistic,
                    1,
                    0.1,
                    0.0,
                    1.0,
                    &mut weights,
                    &mut bias
                ),
                Err(CoreError::InsufficientCapacity)
            );
            assert_eq!(weights, [1.0]);
            assert_eq!(bias, [0.0]);
        }
    }

    #[test]
    fn rejects_nonfinite_inputs_and_unsafe_dimensions() {
        for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            for (values, weights, bias) in [
                ([value], [1.0], [0.0]),
                ([1.0], [value], [0.0]),
                ([1.0], [1.0], [value]),
            ] {
                assert_eq!(
                    scores_sparse_ids(&[0, 1], &[0], &values, 1, 1, &weights, &bias, &mut [0.0]),
                    Err(CoreError::InvalidN)
                );
            }
        }
        assert_eq!(
            scores_sparse_ids(&[0], &[], &[], u32::MAX, u32::MAX, &[], &[], &mut []),
            Err(CoreError::InsufficientCapacity)
        );
        assert_eq!(
            scores_sparse_ids(&[0, 1], &[0], &[f64::MAX], 1, 1, &[2.0], &[0.0], &mut [0.0]),
            Err(CoreError::InvalidN)
        );
    }

    #[test]
    fn rejects_invalid_training_parameters_and_preserves_extra_storage() {
        for (rate, l2, margin) in [
            (f64::NAN, 0.0, 1.0),
            (0.0, 0.0, 1.0),
            (0.1, f64::INFINITY, 1.0),
            (0.1, -1.0, 1.0),
            (0.1, 0.0, f64::NAN),
            (0.1, 0.0, 0.0),
        ] {
            assert_eq!(
                train_sparse_ids(
                    &[0, 1],
                    &[0],
                    &[1.0],
                    &[0],
                    1,
                    1,
                    TrainingAlgorithm::Logistic,
                    1,
                    rate,
                    l2,
                    margin,
                    &mut [0.0],
                    &mut [0.0]
                ),
                Err(CoreError::InvalidN)
            );
        }
        let mut weights = [0.0, 77.0];
        let mut bias = [0.0, 77.0];
        train_sparse_ids(
            &[0, 1],
            &[0],
            &[1.0],
            &[0],
            1,
            1,
            TrainingAlgorithm::Logistic,
            1,
            0.1,
            0.0,
            1.0,
            &mut weights,
            &mut bias,
        )
        .unwrap();
        assert_eq!(weights, [0.05, 77.0]);
        assert_eq!(bias, [0.05, 77.0]);
    }

    #[test]
    fn scores_sparse_ids_computes_expected_class_logits() {
        let doc_offsets: [u32; 3] = [0, 2, 3];
        let feature_ids: [u32; 3] = [0, 2, 1];
        let feature_values: [f64; 3] = [1.0, 2.0, 3.0];
        // class 0 weights: [1, 0, 1], class 1 weights: [0, 2, 1]
        let weights: [f64; 6] = [1.0, 0.0, 1.0, 0.0, 2.0, 1.0];
        let bias: [f64; 2] = [0.5, -0.5];
        let mut out = [0f64; 4];
        scores_sparse_ids(
            &doc_offsets,
            &feature_ids,
            &feature_values,
            2,
            3,
            &weights,
            &bias,
            &mut out,
        )
        .unwrap();
        assert!((out[0] - 3.5).abs() < 1e-12);
        assert!((out[1] - 1.5).abs() < 1e-12);
        assert!((out[2] - 0.5).abs() < 1e-12);
        assert!((out[3] - 5.5).abs() < 1e-12);
    }

    #[test]
    fn native_training_updates_logistic_and_svm_models() {
        let doc_offsets = [0, 1, 2];
        let feature_ids = [0, 1];
        let feature_values = [1.0, 1.0];
        let labels = [0, 1];
        for algorithm in [TrainingAlgorithm::Logistic, TrainingAlgorithm::LinearSvm] {
            let mut weights = [0.0; 4];
            let mut bias = [0.0; 2];
            train_sparse_ids(
                &doc_offsets,
                &feature_ids,
                &feature_values,
                &labels,
                2,
                2,
                algorithm,
                4,
                0.1,
                0.001,
                1.0,
                &mut weights,
                &mut bias,
            )
            .unwrap();
            assert!(weights.iter().any(|weight| weight.abs() > 0.0));
        }
    }
}
