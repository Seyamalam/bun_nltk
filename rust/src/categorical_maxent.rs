//! NLTK-compatible maximum-entropy classification over categorical features.
//!
//! This implements `nltk.classify.maxent.MaxentClassifier` with
//! `BinaryMaxentFeatureEncoding` for IIS and `GISEncoding` for GIS. Feature
//! names, values and labels arrive as interned ids so no feature is flattened
//! into text. Missing keys and explicit `None` values remain distinct, exactly
//! as Python dictionaries keep them distinct.
use crate::{CoreError, CoreResult};
use std::collections::{HashMap, HashSet};

const NINF: f64 = -1e300;
const ADD_LOGS_MAX_DIFF: f64 = -99.65784284662087;
const NEWTON_CONVERGE: f64 = 1e-12;
const MAX_NEWTON: usize = 300;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MaxentAlgorithm {
    Iis,
    Gis,
}

#[derive(Debug, Clone, Copy)]
pub struct MaxentOptions {
    pub algorithm: MaxentAlgorithm,
    pub max_iter: u32,
    pub min_ll: Option<f64>,
    pub min_lldelta: Option<f64>,
    pub max_acc: Option<f64>,
    pub min_accdelta: Option<f64>,
    pub count_cutoff: u32,
}

impl Default for MaxentOptions {
    fn default() -> Self {
        Self {
            algorithm: MaxentAlgorithm::Iis,
            max_iter: 100,
            min_ll: None,
            min_lldelta: None,
            max_acc: None,
            min_accdelta: None,
            count_cutoff: 0,
        }
    }
}

#[derive(Debug, Clone)]
struct EncodedLabel {
    values: Vec<(u32, f64)>,
}

pub struct CategoricalMaxent {
    label_count: usize,
    mapping: HashMap<(u32, u32, u32), u32>,
    features: Vec<(u32, u32, u32)>,
    weights: Vec<f64>,
    correction: Option<f64>,
}

fn add_logs(left: f64, right: f64) -> f64 {
    if left < right + ADD_LOGS_MAX_DIFF {
        return right;
    }
    if right < left + ADD_LOGS_MAX_DIFF {
        return left;
    }
    let base = left.min(right);
    base + ((left - base).exp2() + (right - base).exp2()).log2()
}

fn sum_logs(values: &[f64]) -> f64 {
    match values.split_first() {
        None => NINF,
        Some((first, rest)) => rest.iter().copied().fold(*first, add_logs),
    }
}

fn normalize_log_probs(logits: &[f64]) -> Vec<f64> {
    let total = sum_logs(logits);
    if total <= NINF {
        let uniform = (1.0 / logits.len() as f64).log2();
        return vec![uniform; logits.len()];
    }
    logits.iter().map(|value| value - total).collect()
}

impl CategoricalMaxent {
    /// Train with NLTK's default `BinaryMaxentFeatureEncoding` (IIS) or
    /// `GISEncoding` (GIS). `labels[i]` is the true label id for row `i`.
    pub fn train(
        pairs: &[u32],
        offsets: &[u32],
        labels: &[u32],
        label_count: u32,
        options: MaxentOptions,
    ) -> CoreResult<Self> {
        validate_training(pairs, offsets, labels, label_count, options)?;
        let classes = label_count as usize;

        // BinaryMaxentFeatureEncoding.train. Mapping insertion order follows
        // the first qualifying occurrence, just like the Python dict.
        // NLTK's default BinaryMaxentFeatureEncoding always uses cutoff 0;
        // MaxentClassifier.train accepts count_cutoff but does not forward it
        // to the default encoding. Mirror that behavior for lossless parity.
        let _ = options.count_cutoff;
        let mut mapping = HashMap::new();
        let mut features = Vec::new();
        for (row, &label) in labels.iter().enumerate() {
            let start = 2 * offsets[row] as usize;
            let end = 2 * offsets[row + 1] as usize;
            for pair in pairs[start..end].chunks_exact(2) {
                let key = (pair[0], pair[1], label);
                if let std::collections::hash_map::Entry::Vacant(entry) = mapping.entry(key) {
                    let id = features.len() as u32;
                    entry.insert(id);
                    features.push(key);
                }
            }
        }

        let base_len = features.len();
        let correction = match options.algorithm {
            MaxentAlgorithm::Iis => None,
            MaxentAlgorithm::Gis => {
                let names: HashSet<u32> = features.iter().map(|(name, _, _)| *name).collect();
                Some(names.len() as f64 + 1.0)
            }
        };
        let length = base_len + usize::from(correction.is_some());
        if length == 0 {
            // An empty feature space is still a valid uniform classifier.
            return Ok(Self {
                label_count: classes,
                mapping,
                features,
                weights: Vec::new(),
                correction,
            });
        }

        let encodings = encode_training_rows(&mapping, pairs, offsets, labels, classes, correction);
        let mut empirical = vec![0.0; length];
        for (row, &label) in labels.iter().enumerate() {
            let encoded = &encodings[row][label as usize];
            for &(id, value) in &encoded.values {
                empirical[id as usize] += value;
            }
        }

        let unattested: Vec<usize> = empirical
            .iter()
            .enumerate()
            .filter_map(|(id, &count)| (count == 0.0).then_some(id))
            .collect();

        let mut weights = vec![0.0; length];
        for &id in &unattested {
            weights[id] = f64::NEG_INFINITY;
        }

        let mut model = Self {
            label_count: classes,
            mapping,
            features,
            weights,
            correction,
        };
        let mut data = TrainingData {
            encodings: &encodings,
            labels,
            length,
            empirical_counts: empirical,
            unattested,
            options,
            cutoff: CutoffState::new(options),
        };
        match options.algorithm {
            MaxentAlgorithm::Iis => model.train_iis(&mut data),
            MaxentAlgorithm::Gis => model.train_gis(&mut data),
        }?;
        Ok(model)
    }

    /// Weighted joint vectors from an explicit Binary/Typed encoding. Keep
    /// optimization and probability normalization in the existing Rust engine.
    pub fn train_encoded(
        encodings: &[Vec<Vec<(u32, f64)>>],
        labels: &[u32],
        label_count: u32,
        length: usize,
        constant: Option<f64>,
        options: MaxentOptions,
    ) -> CoreResult<Self> {
        if label_count == 0
            || labels.is_empty()
            || encodings.len() != labels.len()
            || labels.iter().any(|&l| l >= label_count)
            || encodings
                .iter()
                .any(|row| row.len() != label_count as usize)
            || constant.is_some_and(|c| !c.is_finite() || c == 0.0)
            || (options.algorithm == MaxentAlgorithm::Gis && constant.is_none())
            || [
                options.min_ll,
                options.min_lldelta,
                options.max_acc,
                options.min_accdelta,
            ]
            .into_iter()
            .flatten()
            .any(|v| !v.is_finite())
        {
            return Err(CoreError::InvalidN);
        }
        let mut empirical = vec![0.0; length];
        let mut rows = Vec::with_capacity(encodings.len());
        for (row, &label) in encodings.iter().zip(labels) {
            let mut encoded = Vec::with_capacity(row.len());
            for values in row {
                if values
                    .iter()
                    .any(|&(id, v)| id as usize >= length || !v.is_finite())
                {
                    return Err(CoreError::InvalidN);
                }
                encoded.push(EncodedLabel {
                    values: values.clone(),
                });
            }
            for &(id, value) in &encoded[label as usize].values {
                empirical[id as usize] += value;
            }
            rows.push(encoded);
        }
        let unattested: Vec<usize> = empirical
            .iter()
            .enumerate()
            .filter_map(|(id, &v)| (v == 0.0).then_some(id))
            .collect();
        let mut weights = vec![0.0; length];
        for &id in &unattested {
            weights[id] = f64::NEG_INFINITY;
        }
        let mut model = Self {
            label_count: label_count as usize,
            mapping: HashMap::new(),
            features: Vec::new(),
            weights,
            correction: constant,
        };
        // NLTK permits empty IIS spaces (uniform predictions).
        if length != 0 {
            let mut data = TrainingData {
                encodings: &rows,
                labels,
                length,
                empirical_counts: empirical,
                unattested,
                options,
                cutoff: CutoffState::new(options),
            };
            match options.algorithm {
                MaxentAlgorithm::Iis => model.train_iis(&mut data),
                MaxentAlgorithm::Gis => model.train_gis(&mut data),
            }?;
        }
        Ok(model)
    }

    pub fn from_encoded_weights(weights: &[f64], label_count: u32) -> CoreResult<Self> {
        if label_count == 0 || weights.iter().any(|w| w.is_nan() || *w == f64::INFINITY) {
            return Err(CoreError::InvalidN);
        }
        Ok(Self {
            label_count: label_count as usize,
            mapping: HashMap::new(),
            features: Vec::new(),
            weights: weights.to_vec(),
            correction: None,
        })
    }

    pub fn predict_encoded(&self, vectors: Vec<Vec<(u32, f64)>>) -> CoreResult<Vec<f64>> {
        if vectors.len() != self.label_count
            || vectors
                .iter()
                .flatten()
                .any(|&(id, v)| id as usize >= self.weights.len() || !v.is_finite())
        {
            return Err(CoreError::InvalidN);
        }
        let encoded: Vec<_> = vectors
            .into_iter()
            .map(|values| EncodedLabel { values })
            .collect();
        let logs = normalize_log_probs(&self.logits(&encoded));
        Ok(logs
            .iter()
            .copied()
            .chain(logs.iter().map(|v| v.exp2()))
            .collect())
    }

    /// Rebuild a trained model from its numeric encoding, for serialization.
    pub fn from_parts(
        features: &[u32],
        weights: &[f64],
        label_count: u32,
        algorithm: MaxentAlgorithm,
        correction: f64,
    ) -> CoreResult<Self> {
        if label_count == 0 || !features.len().is_multiple_of(3) {
            return Err(CoreError::InvalidN);
        }
        let feature_count = features.len() / 3;
        let correction = match algorithm {
            MaxentAlgorithm::Iis => None,
            MaxentAlgorithm::Gis => {
                if !correction.is_finite() || correction <= 0.0 {
                    return Err(CoreError::InvalidN);
                }
                Some(correction)
            }
        };
        let expected = feature_count + usize::from(correction.is_some());
        if weights.len() != expected {
            return Err(CoreError::InvalidN);
        }
        let mut mapping = HashMap::new();
        let mut triples = Vec::with_capacity(feature_count);
        for (id, triple) in features.chunks_exact(3).enumerate() {
            let key = (triple[0], triple[1], triple[2]);
            if triple[2] >= label_count || mapping.contains_key(&key) {
                return Err(CoreError::InvalidN);
            }
            mapping.insert(key, id as u32);
            triples.push(key);
        }
        if weights.iter().any(|value| value.is_nan()) {
            return Err(CoreError::InvalidN);
        }
        Ok(Self {
            label_count: label_count as usize,
            mapping,
            features: triples,
            weights: weights.to_vec(),
            correction,
        })
    }

    fn encode_label(&self, pairs: &[u32], label: u32) -> EncodedLabel {
        let mut values = Vec::new();
        for pair in pairs.chunks_exact(2) {
            if let Some(&id) = self.mapping.get(&(pair[0], pair[1], label)) {
                values.push((id, 1.0));
            }
        }
        if let Some(constant) = self.correction {
            values.push((self.features.len() as u32, constant - values.len() as f64));
        }
        EncodedLabel { values }
    }

    fn logits(&self, encoded: &[EncodedLabel]) -> Vec<f64> {
        encoded
            .iter()
            .map(|label| {
                label
                    .values
                    .iter()
                    .map(|&(id, value)| self.weights[id as usize] * value)
                    .sum::<f64>()
            })
            .collect()
    }

    fn probabilities(&self, encoded: &[EncodedLabel]) -> Vec<f64> {
        let logits = self.logits(encoded);
        normalize_log_probs(&logits)
            .into_iter()
            .map(|value| value.exp2())
            .collect()
    }

    /// Return base-2 log probabilities followed by ordinary probabilities.
    pub fn predict(&self, pairs: &[u32], out: &mut [f64]) -> CoreResult<()> {
        if !pairs.len().is_multiple_of(2) || out.len() != 2 * self.label_count {
            return Err(CoreError::InvalidN);
        }
        let encoded: Vec<EncodedLabel> = (0..self.label_count)
            .map(|label| self.encode_label(pairs, label as u32))
            .collect();
        let logits = self.logits(&encoded);
        let logs = normalize_log_probs(&logits);
        out[..self.label_count].copy_from_slice(&logs);
        for (index, value) in logs.iter().enumerate() {
            out[self.label_count + index] = value.exp2();
        }
        Ok(())
    }

    pub fn label_count(&self) -> usize {
        self.label_count
    }

    pub fn feature_count(&self) -> usize {
        self.features.len()
    }

    pub fn weight_count(&self) -> usize {
        self.weights.len()
    }

    pub fn correction(&self) -> Option<f64> {
        self.correction
    }

    pub fn copy_features(&self, out: &mut [u32]) -> CoreResult<()> {
        if out.len() < self.features.len() * 3 {
            return Err(CoreError::InvalidN);
        }
        for (index, (name, value, label)) in self.features.iter().enumerate() {
            out[3 * index] = *name;
            out[3 * index + 1] = *value;
            out[3 * index + 2] = *label;
        }
        Ok(())
    }

    pub fn copy_weights(&self, out: &mut [f64]) -> CoreResult<()> {
        if out.len() < self.weights.len() {
            return Err(CoreError::InvalidN);
        }
        out[..self.weights.len()].copy_from_slice(&self.weights);
        Ok(())
    }

    fn log_likelihood(&self, encodings: &[Vec<EncodedLabel>], labels: &[u32]) -> f64 {
        let mut total = 0.0;
        for (row, &label) in labels.iter().enumerate() {
            let probabilities = self.probabilities(&encodings[row]);
            total += probabilities[label as usize];
        }
        let mean = total / labels.len() as f64;
        if mean <= 0.0 {
            f64::NEG_INFINITY
        } else {
            mean.ln()
        }
    }

    fn train_iis(&mut self, data: &mut TrainingData<'_>) -> CoreResult<()> {
        let length = data.length;
        let empirical: Vec<f64> = if length == 0 {
            Vec::new()
        } else {
            data.empirical_counts[..length]
                .iter()
                .map(|count| count / data.labels.len() as f64)
                .collect()
        };

        // calculate_nfmap: the sum of active weighted features for every
        // (row, label) pair, compressed to sorted distinct values.
        let mut nf_values: Vec<f64> = data
            .encodings
            .iter()
            .flat_map(|row| {
                row.iter()
                    .map(|label| label.values.iter().map(|&(_, v)| v).sum::<f64>())
            })
            .collect();
        nf_values.sort_by(f64::total_cmp);
        nf_values.dedup();
        let nf_index: HashMap<u64, usize> = nf_values
            .iter()
            .enumerate()
            .map(|(index, &nf)| ((if nf == 0.0 { 0.0 } else { nf }).to_bits(), index))
            .collect();

        loop {
            // NLTK's calculate_deltas rebuilds A from the current weights on
            // every outer iteration.
            let mut a = vec![vec![0.0; length]; nf_values.len()];
            for row in data.encodings {
                let probabilities = self.probabilities(row);
                for (label, encoded) in row.iter().enumerate() {
                    let nf = encoded.values.iter().map(|&(_, v)| v).sum::<f64>();
                    let row_index = nf_index[&(if nf == 0.0 { 0.0 } else { nf }).to_bits()];
                    for &(id, value) in &encoded.values {
                        a[row_index][id as usize] += probabilities[label] * value;
                    }
                }
            }
            for row in &mut a {
                for value in row.iter_mut() {
                    *value /= data.labels.len() as f64;
                }
            }

            let mut deltas = vec![1.0; length];
            for _ in 0..MAX_NEWTON {
                let mut sum1 = vec![0.0; length];
                let mut sum2 = vec![0.0; length];
                for (row_index, &nf) in nf_values.iter().enumerate() {
                    for id in 0..length {
                        let weight = (nf * deltas[id]).exp2();
                        sum1[id] += weight * a[row_index][id];
                        sum2[id] += nf * weight * a[row_index][id];
                    }
                }
                for &id in &data.unattested {
                    sum2[id] += 1.0;
                }
                for id in 0..length {
                    deltas[id] += (empirical[id] - sum1[id]) / sum2[id];
                }
                let error = empirical
                    .iter()
                    .zip(&sum1)
                    .map(|(left, right)| (left - right).abs())
                    .sum::<f64>()
                    / deltas.iter().map(|value| value.abs()).sum::<f64>();
                if error < NEWTON_CONVERGE {
                    break;
                }
            }
            for (id, delta) in deltas.iter().enumerate() {
                self.weights[id] += *delta;
                if !self.weights[id].is_finite() && self.weights[id] != f64::NEG_INFINITY {
                    return Err(CoreError::InvalidN);
                }
            }
            if data
                .cutoff
                .check(self, data.encodings, data.labels, data.options)
            {
                break;
            }
        }
        Ok(())
    }

    fn train_gis(&mut self, data: &mut TrainingData<'_>) -> CoreResult<()> {
        let length = data.length;
        let constant = self.correction.ok_or(CoreError::InvalidN)?;
        let log_empirical: Vec<f64> = data
            .empirical_counts
            .iter()
            .map(|count| {
                if *count > 0.0 {
                    count.log2()
                } else {
                    f64::NEG_INFINITY
                }
            })
            .collect();

        loop {
            let mut estimated = vec![0.0; length];
            for row in data.encodings {
                let probabilities = self.probabilities(row);
                for (label, encoded) in row.iter().enumerate() {
                    let probability = probabilities[label];
                    for &(id, value) in &encoded.values {
                        estimated[id as usize] += probability * value;
                    }
                }
            }
            for &id in &data.unattested {
                estimated[id] += 1.0;
            }
            for id in 0..length {
                self.weights[id] += (log_empirical[id] - estimated[id].log2()) / constant;
                if !self.weights[id].is_finite() && self.weights[id] != f64::NEG_INFINITY {
                    return Err(CoreError::InvalidN);
                }
            }
            if data
                .cutoff
                .check(self, data.encodings, data.labels, data.options)
            {
                break;
            }
        }
        Ok(())
    }
}

struct TrainingData<'a> {
    encodings: &'a [Vec<EncodedLabel>],
    labels: &'a [u32],
    length: usize,
    empirical_counts: Vec<f64>,
    unattested: Vec<usize>,
    options: MaxentOptions,
    cutoff: CutoffState,
}

fn validate_training(
    pairs: &[u32],
    offsets: &[u32],
    labels: &[u32],
    label_count: u32,
    options: MaxentOptions,
) -> CoreResult<()> {
    if label_count == 0
        || labels.is_empty()
        || !pairs.len().is_multiple_of(2)
        || offsets.len() != labels.len() + 1
        || offsets.first() != Some(&0)
        || offsets.last().copied() != Some((pairs.len() / 2) as u32)
        || offsets.windows(2).any(|window| window[0] > window[1])
        || labels.iter().any(|&label| label >= label_count)
    {
        return Err(CoreError::InvalidN);
    }
    for value in [
        options.min_ll,
        options.min_lldelta,
        options.max_acc,
        options.min_accdelta,
    ]
    .into_iter()
    .flatten()
    {
        if !value.is_finite() {
            return Err(CoreError::InvalidN);
        }
    }
    for window in offsets.windows(2) {
        let start = 2 * window[0] as usize;
        let end = 2 * window[1] as usize;
        let mut names = HashSet::new();
        for pair in pairs[start..end].chunks_exact(2) {
            if !names.insert(pair[0]) {
                return Err(CoreError::InvalidN);
            }
        }
    }
    Ok(())
}

fn encode_training_rows(
    mapping: &HashMap<(u32, u32, u32), u32>,
    pairs: &[u32],
    offsets: &[u32],
    labels: &[u32],
    label_count: usize,
    correction: Option<f64>,
) -> Vec<Vec<EncodedLabel>> {
    let mut rows = Vec::with_capacity(labels.len());
    for row in 0..labels.len() {
        let start = 2 * offsets[row] as usize;
        let end = 2 * offsets[row + 1] as usize;
        let mut encoded = Vec::with_capacity(label_count);
        for label in 0..label_count {
            let mut values = Vec::new();
            for pair in pairs[start..end].chunks_exact(2) {
                if let Some(&id) = mapping.get(&(pair[0], pair[1], label as u32)) {
                    values.push((id, 1.0));
                }
            }
            if let Some(constant) = correction {
                values.push((mapping.len() as u32, constant - values.len() as f64));
            }
            encoded.push(EncodedLabel { values });
        }
        rows.push(encoded);
    }
    rows
}

struct CutoffState {
    iter: u32,
    last_ll: Option<f64>,
    last_acc: Option<f64>,
}

impl CutoffState {
    fn new(_options: MaxentOptions) -> Self {
        Self {
            iter: 1,
            last_ll: None,
            last_acc: None,
        }
    }

    fn check(
        &mut self,
        model: &CategoricalMaxent,
        encodings: &[Vec<EncodedLabel>],
        labels: &[u32],
        options: MaxentOptions,
    ) -> bool {
        self.iter += 1;
        if self.iter >= options.max_iter {
            return true;
        }
        let new_ll = model.log_likelihood(encodings, labels);
        if new_ll.is_nan() {
            return true;
        }
        if options.min_ll.is_some() || options.min_lldelta.is_some() {
            if let Some(min_ll) = options.min_ll {
                if new_ll >= -min_ll.abs() {
                    return true;
                }
            }
            if let Some(delta) = options.min_lldelta {
                if let Some(previous) = self.last_ll {
                    if new_ll - previous <= delta.abs() {
                        return true;
                    }
                }
            }
            self.last_ll = Some(new_ll);
        }
        if options.max_acc.is_some() || options.min_accdelta.is_some() {
            // NLTK's CutoffChecker compares log likelihood here as well.
            let new_acc = new_ll;
            if let Some(max_acc) = options.max_acc {
                if new_acc >= max_acc {
                    return true;
                }
            }
            if let Some(delta) = options.min_accdelta {
                if let Some(previous) = self.last_acc {
                    if new_acc - previous <= delta.abs() {
                        return true;
                    }
                }
            }
            self.last_acc = Some(new_acc);
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weighted_vectors_use_the_existing_optimizer_and_roundtrip() {
        let rows = vec![
            vec![vec![(0, 0.5)], vec![(1, 0.5)]],
            vec![vec![(0, 1.5)], vec![(1, 1.5)]],
            vec![vec![(0, 2.0)], vec![(1, 2.0)]],
        ];
        for algorithm in [MaxentAlgorithm::Iis, MaxentAlgorithm::Gis] {
            let model = CategoricalMaxent::train_encoded(
                &rows,
                &[0, 1, 1],
                2,
                3,
                Some(4.0),
                options(algorithm),
            )
            .unwrap();
            let mut weights = vec![0.0; model.weight_count()];
            model.copy_weights(&mut weights).unwrap();
            assert_eq!(weights[2], f64::NEG_INFINITY);
            let restored = CategoricalMaxent::from_encoded_weights(&weights, 2).unwrap();
            let out = model.predict_encoded(rows[0].clone()).unwrap();
            assert_eq!(out, restored.predict_encoded(rows[0].clone()).unwrap());
            assert!((out[2] + out[3] - 1.0).abs() < 1e-12);
        }
        assert!(CategoricalMaxent::train_encoded(
            &rows,
            &[0, 1, 1],
            2,
            2,
            None,
            options(MaxentAlgorithm::Gis)
        )
        .is_err());
        assert!(CategoricalMaxent::from_encoded_weights(&[f64::NAN], 2).is_err());
        let model = CategoricalMaxent::from_encoded_weights(&[1.0], 1).unwrap();
        assert!(model.predict_encoded(vec![vec![(1, 1.0)]]).is_err());
        assert!(model.predict_encoded(vec![vec![(0, f64::NAN)]]).is_err());
    }

    fn options(algorithm: MaxentAlgorithm) -> MaxentOptions {
        MaxentOptions {
            algorithm,
            max_iter: 50,
            ..Default::default()
        }
    }

    fn trained(algorithm: MaxentAlgorithm) -> CategoricalMaxent {
        // Four rows, two labels, three feature/value pairs.
        let pairs = [0, 1, 1, 2, 0, 2, 1, 1, 0, 1, 2, 2, 1, 2, 0, 1];
        let offsets = [0, 2, 4, 6, 8];
        let labels = [0, 1, 0, 1];
        CategoricalMaxent::train(&pairs, &offsets, &labels, 2, options(algorithm)).unwrap()
    }

    #[test]
    fn learns_separable_probabilities() {
        for algorithm in [MaxentAlgorithm::Iis, MaxentAlgorithm::Gis] {
            let model = trained(algorithm);
            let mut out = [0.0; 4];
            model.predict(&[0, 1], &mut out).unwrap();
            assert!((out[2] + out[3] - 1.0).abs() < 1e-12);
            assert!(out[2] > out[3]);
            model.predict(&[1, 2], &mut out).unwrap();
            assert!((out[2] + out[3] - 1.0).abs() < 1e-12);
        }
    }

    #[test]
    fn round_trips_numeric_encoding() {
        for algorithm in [MaxentAlgorithm::Iis, MaxentAlgorithm::Gis] {
            let model = trained(algorithm);
            let mut features = vec![0; model.feature_count() * 3];
            model.copy_features(&mut features).unwrap();
            let mut weights = vec![0.0; model.weight_count()];
            model.copy_weights(&mut weights).unwrap();
            let restored = CategoricalMaxent::from_parts(
                &features,
                &weights,
                2,
                algorithm,
                model.correction().unwrap_or(0.0),
            )
            .unwrap();
            let mut left = [0.0; 4];
            let mut right = [0.0; 4];
            model.predict(&[0, 1, 1, 2], &mut left).unwrap();
            restored.predict(&[0, 1, 1, 2], &mut right).unwrap();
            assert_eq!(left, right);
        }
    }

    #[test]
    fn rejects_malformed_training_data() {
        let opts = options(MaxentAlgorithm::Iis);
        assert!(CategoricalMaxent::train(&[0, 1], &[0], &[0], 1, opts).is_err());
        assert!(CategoricalMaxent::train(&[0, 1], &[0, 2], &[0], 1, opts).is_err());
        assert!(CategoricalMaxent::train(&[0, 1, 0, 2], &[0, 2], &[0], 1, opts).is_err());
        assert!(CategoricalMaxent::train(&[], &[0, 0], &[1], 1, opts).is_err());
        assert!(CategoricalMaxent::train(&[], &[0, 0], &[0], 1, opts).is_ok());
    }
}
