//! Training-row validation, encoding and NLTK's stopping policy.
use super::{CategoricalMaxent, EncodedLabel, MaxentOptions};
use crate::{CoreError, CoreResult};
use std::collections::{HashMap, HashSet};

pub(super) fn validate_training(
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

pub(super) fn encode_training_rows(
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

pub(super) struct CutoffState {
    iter: u32,
    last_ll: Option<f64>,
    last_acc: Option<f64>,
}

impl CutoffState {
    pub(super) fn new(_options: MaxentOptions) -> Self {
        Self {
            iter: 1,
            last_ll: None,
            last_acc: None,
        }
    }

    pub(super) fn check(
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
