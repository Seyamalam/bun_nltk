use crate::linear::{self, TrainingAlgorithm};
use crate::{CoreError, CoreResult};
use std::collections::{BTreeMap, HashMap};

const RESULT_MAGIC: &[u8] = b"BNSV1";

pub struct NativeLinearTextResult {
    bytes: Vec<u8>,
}

fn tokens_ascii(text: &[u8]) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut start = None;
    for (index, byte) in text.iter().copied().chain(std::iter::once(0)).enumerate() {
        let is_token = byte.is_ascii_alphanumeric() || byte == b'\'';
        match (start, is_token) {
            (None, true) => start = Some(index),
            (Some(token_start), false) => {
                let token = text[token_start..index]
                    .iter()
                    .map(|value| value.to_ascii_lowercase() as char)
                    .collect();
                tokens.push(token);
                start = None;
            }
            _ => {}
        }
    }
    tokens
}

fn features(tokens: &[String], min_n: usize, max_n: usize) -> Vec<String> {
    let mut out = Vec::new();
    for n in min_n..=max_n.max(min_n) {
        if n == 0 || tokens.len() < n {
            continue;
        }
        for start in 0..=tokens.len() - n {
            out.push(tokens[start..start + n].join("\u{1}"));
        }
    }
    out
}

fn push_u32(out: &mut Vec<u8>, value: usize) -> CoreResult<()> {
    let value = u32::try_from(value).map_err(|_| CoreError::OutOfMemory)?;
    out.extend_from_slice(&value.to_le_bytes());
    Ok(())
}

fn encode_result(
    vocabulary: &[String],
    class_count: usize,
    weights: &[f64],
    bias: &[f64],
) -> CoreResult<Vec<u8>> {
    let vocabulary_bytes: usize = vocabulary.iter().map(|feature| 4 + feature.len()).sum();
    let capacity = RESULT_MAGIC.len()
        + 8
        + vocabulary_bytes
        + (weights.len() + bias.len()) * std::mem::size_of::<f64>();
    let mut out = Vec::with_capacity(capacity);
    out.extend_from_slice(RESULT_MAGIC);
    push_u32(&mut out, vocabulary.len())?;
    push_u32(&mut out, class_count)?;
    for feature in vocabulary {
        push_u32(&mut out, feature.len())?;
        out.extend_from_slice(feature.as_bytes());
    }
    for value in weights.iter().chain(bias) {
        out.extend_from_slice(&value.to_le_bytes());
    }
    Ok(out)
}

#[allow(clippy::too_many_arguments)]
pub fn train(
    text_blob: &[u8],
    text_offsets: &[u32],
    label_ids: &[u32],
    class_count: u32,
    ngram_min: u32,
    ngram_max: u32,
    binary: bool,
    max_features: u32,
    algorithm: TrainingAlgorithm,
    epochs: u32,
    learning_rate: f64,
    l2: f64,
    margin: f64,
) -> CoreResult<NativeLinearTextResult> {
    if text_offsets.is_empty()
        || class_count == 0
        || ngram_min == 0
        || ngram_max < ngram_min
        || max_features == 0
    {
        return Err(CoreError::InvalidN);
    }
    let documents = text_offsets.len() - 1;
    if label_ids.len() != documents {
        return Err(CoreError::InsufficientCapacity);
    }

    let mut document_features = Vec::with_capacity(documents);
    let mut counts: HashMap<String, u32> = HashMap::new();
    for document in 0..documents {
        let start = text_offsets[document] as usize;
        let end = text_offsets[document + 1] as usize;
        if start > end || end > text_blob.len() {
            return Err(CoreError::InsufficientCapacity);
        }
        let row = features(
            &tokens_ascii(&text_blob[start..end]),
            ngram_min as usize,
            ngram_max as usize,
        );
        for feature in &row {
            *counts.entry(feature.clone()).or_default() += 1;
        }
        document_features.push(row);
    }

    let mut ranked: Vec<(String, u32)> = counts.into_iter().collect();
    ranked.sort_unstable_by(|left, right| {
        right
            .1
            .cmp(&left.1)
            .then_with(|| left.0.as_bytes().cmp(right.0.as_bytes()))
    });
    ranked.truncate(max_features as usize);
    let vocabulary: Vec<String> = ranked.into_iter().map(|(feature, _)| feature).collect();
    let feature_to_id: HashMap<&str, u32> = vocabulary
        .iter()
        .enumerate()
        .map(|(index, feature)| (feature.as_str(), index as u32))
        .collect();

    let mut doc_offsets = Vec::with_capacity(documents + 1);
    let mut feature_ids = Vec::new();
    let mut feature_values = Vec::new();
    doc_offsets.push(0);
    for row in document_features {
        let mut sparse: BTreeMap<u32, f64> = BTreeMap::new();
        for feature in row {
            let Some(id) = feature_to_id.get(feature.as_str()).copied() else {
                continue;
            };
            if binary {
                sparse.insert(id, 1.0);
            } else {
                *sparse.entry(id).or_default() += 1.0;
            }
        }
        for (id, value) in sparse {
            feature_ids.push(id);
            feature_values.push(value);
        }
        doc_offsets.push(feature_ids.len() as u32);
    }

    let mut weights = vec![0.0; class_count as usize * vocabulary.len()];
    let mut bias = vec![0.0; class_count as usize];
    linear::train_sparse_ids(
        &doc_offsets,
        &feature_ids,
        &feature_values,
        label_ids,
        class_count,
        vocabulary.len() as u32,
        algorithm,
        epochs,
        learning_rate,
        l2,
        margin,
        &mut weights,
        &mut bias,
    )?;
    Ok(NativeLinearTextResult {
        bytes: encode_result(&vocabulary, class_count as usize, &weights, &bias)?,
    })
}

impl NativeLinearTextResult {
    pub fn len(&self) -> usize {
        self.bytes.len()
    }

    pub fn copy_to(&self, out: &mut [u8]) -> CoreResult<usize> {
        if out.len() < self.bytes.len() {
            return Err(CoreError::InsufficientCapacity);
        }
        out[..self.bytes.len()].copy_from_slice(&self.bytes);
        Ok(self.bytes.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizer_and_feature_order_match_reference_rules() {
        assert_eq!(
            tokens_ascii(b"Fast, CAN'T stop."),
            ["fast", "can't", "stop"]
        );
        assert_eq!(features(&tokens_ascii(b"a b"), 1, 2), ["a", "b", "a\u{1}b"]);
    }

    #[test]
    fn end_to_end_training_returns_binary_model() {
        let blob = b"good fastbad slow";
        let result = train(
            blob,
            &[0, 9, 17],
            &[1, 0],
            2,
            1,
            2,
            false,
            64,
            TrainingAlgorithm::LinearSvm,
            4,
            0.1,
            0.001,
            1.0,
        )
        .unwrap();
        assert!(result.bytes.starts_with(RESULT_MAGIC));
    }
}
