//! NLTK categorical Naive Bayes over interned (feature name, value) pairs.
//! Value zero represents Python None, including implicit missing training values.
use crate::{CoreError, CoreResult};
use std::collections::{HashMap, HashSet};

fn log2(value: f64) -> f64 {
    value.ln() / std::f64::consts::LN_2
}

struct Feature {
    unseen: Vec<f64>,
    values: HashMap<u32, Vec<f64>>,
}

pub struct CategoricalNaiveBayes {
    priors: Vec<f64>,
    features: HashMap<u32, Feature>,
}

impl CategoricalNaiveBayes {
    pub fn train(
        pairs: &[u32],
        offsets: &[u32],
        labels: &[u32],
        label_count: u32,
        smoothing: f64,
    ) -> CoreResult<Self> {
        let invalid = CoreError::InvalidN;
        let classes = label_count as usize;
        if classes == 0
            || classes > labels.len()
            || labels.is_empty()
            || !smoothing.is_finite()
            || smoothing <= 0.0
            || pairs.len() % 2 != 0
            || offsets.len() != labels.len() + 1
            || offsets.first() != Some(&0)
            || offsets.last().copied() != Some((pairs.len() / 2) as u32)
            || offsets.windows(2).any(|w| w[0] > w[1])
            || labels.iter().any(|&l| l >= label_count)
        {
            return Err(invalid);
        }
        let mut docs = vec![0u64; classes];
        // name -> value -> counts per label. Counts are sparse in feature values.
        let mut counts: HashMap<u32, HashMap<u32, Vec<u64>>> = HashMap::new();
        for (i, &label) in labels.iter().enumerate() {
            let label = label as usize;
            docs[label] += 1;
            let mut seen = HashSet::new();
            for pair in pairs[2 * offsets[i] as usize..2 * offsets[i + 1] as usize].chunks_exact(2)
            {
                if !seen.insert(pair[0]) {
                    return Err(invalid);
                }
                counts
                    .entry(pair[0])
                    .or_default()
                    .entry(pair[1])
                    .or_insert_with(|| vec![0; classes])[label] += 1;
            }
        }
        if docs.contains(&0) {
            return Err(invalid);
        }
        let total = labels.len() as f64 + smoothing * classes as f64;
        if !total.is_finite() { return Err(invalid); }
        let priors = docs
            .iter()
            .map(|&n| log2((n as f64 + smoothing) / total))
            .collect();
        let mut features = HashMap::new();
        for (name, mut values) in counts {
            let mut missing = docs.clone();
            for counts in values.values() {
                for (left, &right) in missing.iter_mut().zip(counts) {
                    *left -= right;
                }
            }
            if missing.iter().any(|&n| n > 0) {
                let null = values.entry(0).or_insert_with(|| vec![0; classes]);
                for (count, missing) in null.iter_mut().zip(missing) {
                    *count += missing;
                }
            }
            let bins = values.len() as f64;
            let denominators: Vec<f64> =
                docs.iter().map(|&n| n as f64 + smoothing * bins).collect();
            if denominators.iter().any(|d| !d.is_finite()) { return Err(invalid); }
            let unseen = denominators.iter().map(|&d| log2(smoothing / d)).collect();
            let values = values
                .into_iter()
                .map(|(value, counts)| {
                    let logs = counts
                        .iter()
                        .zip(&denominators)
                        .map(|(&n, &d)| log2((n as f64 + smoothing) / d))
                        .collect();
                    (value, logs)
                })
                .collect();
            features.insert(name, Feature { unseen, values });
        }
        Ok(Self { priors, features })
    }

    pub fn predict(&self, pairs: &[u32], out: &mut [f64]) -> CoreResult<()> {
        if pairs.len() % 2 != 0 || out.len() != self.priors.len() {
            return Err(CoreError::InvalidN);
        }
        let mut seen = HashSet::new();
        out.copy_from_slice(&self.priors);
        for pair in pairs.chunks_exact(2) {
            if !seen.insert(pair[0]) {
                return Err(CoreError::InvalidN);
            }
            if let Some(feature) = self.features.get(&pair[0]) {
                let logs = feature.values.get(&pair[1]).unwrap_or(&feature.unseen);
                for (score, log) in out.iter_mut().zip(logs) {
                    *score += log;
                }
            }
        }
        let max = out.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let sum: f64 = out.iter().map(|&score| (score - max).exp2()).sum();
        let normalizer = max + log2(sum);
        for score in out {
            *score -= normalizer;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn swapped_associations_and_missing_none_values() {
        let model =
            CategoricalNaiveBayes::train(&[0, 1, 1, 2, 0, 2, 1, 1], &[0, 2, 4], &[0, 1], 2, 0.5)
                .unwrap();
        let mut scores = [0.0; 2];
        model.predict(&[0, 1, 1, 2], &mut scores).unwrap();
        assert!((scores[0].exp2() - 0.9).abs() < 1e-14);
        model.predict(&[0, 2, 1, 1], &mut scores).unwrap();
        assert!((scores[1].exp2() - 0.9).abs() < 1e-14);
        let model =
            CategoricalNaiveBayes::train(&[0, 1, 0, 0], &[0, 1, 1, 2], &[0, 1, 1], 2, 0.5).unwrap();
        model.predict(&[0, 0], &mut scores).unwrap();
        assert!((scores[0].exp2() - 9.0 / 59.0).abs() < 1e-14);
        model.predict(&[99, 1], &mut scores).unwrap();
        assert!((scores[0].exp2() - 0.375).abs() < 1e-14);
    }
    #[test]
    fn rejects_malformed_offsets_labels_duplicates_and_smoothing() {
        for offsets in [&[1, 1][..], &[0, 2][..], &[0][..]] {
            assert!(CategoricalNaiveBayes::train(&[0, 1], offsets, &[0], 1, 0.5).is_err());
        }
        assert!(CategoricalNaiveBayes::train(&[0, 1, 0, 2], &[0, 2], &[0], 1, 0.5).is_err());
        assert!(CategoricalNaiveBayes::train(&[], &[0, 0], &[1], 1, 0.5).is_err());
        for gamma in [0.0, -1.0, f64::NAN, f64::INFINITY] {
            assert!(CategoricalNaiveBayes::train(&[], &[0, 0], &[0], 1, gamma).is_err());
        }
    }
}
