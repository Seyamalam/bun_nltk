//! Modified from NLTK 3.10.3 PositiveNaiveBayesClassifier (Apache-2.0).
use crate::categorical_nb::{CategoricalNaiveBayes, Feature};
use crate::{CoreError, CoreResult};
use std::collections::{HashMap, HashSet};

fn log_probability(value: f64) -> f64 {
    if value == 0.0 {
        -1e300
    } else {
        value.ln() / std::f64::consts::LN_2
    }
}

fn count_group(
    pairs: &[u32],
    offsets: &[u32],
    group: usize,
    counts: &mut HashMap<u32, HashMap<u32, [u64; 2]>>,
) -> CoreResult<usize> {
    if !pairs.len().is_multiple_of(2)
        || offsets.first() != Some(&0)
        || offsets.last().copied().map(u64::from) != Some((pairs.len() / 2) as u64)
        || offsets.windows(2).any(|w| w[0] > w[1])
    {
        return Err(CoreError::InvalidN);
    }
    for window in offsets.windows(2) {
        let mut names = HashSet::new();
        for pair in pairs[window[0] as usize * 2..window[1] as usize * 2].chunks_exact(2) {
            if !names.insert(pair[0]) {
                return Err(CoreError::InvalidN);
            }
            counts
                .entry(pair[0])
                .or_default()
                .entry(pair[1])
                .or_default()[group] += 1;
        }
    }
    Ok(offsets.len() - 1)
}

pub fn train(
    positive_pairs: &[u32],
    positive_offsets: &[u32],
    unlabeled_pairs: &[u32],
    unlabeled_offsets: &[u32],
    prior: f64,
    smoothing: f64,
) -> CoreResult<CategoricalNaiveBayes> {
    if !prior.is_finite()
        || !(0.0..1.0).contains(&prior)
        || !smoothing.is_finite()
        || smoothing <= 0.0
    {
        return Err(CoreError::InvalidN);
    }
    let mut counts = HashMap::new();
    let positive_count = count_group(positive_pairs, positive_offsets, 0, &mut counts)?;
    let unlabeled_count = count_group(unlabeled_pairs, unlabeled_offsets, 1, &mut counts)?;
    let mut features = HashMap::new();
    for (name, mut values) in counts {
        let mut missing = [positive_count as u64, unlabeled_count as u64];
        for counts in values.values() {
            for (left, &right) in missing.iter_mut().zip(counts) {
                *left -= right;
            }
        }
        // Unlike ordinary NB, NLTK always includes None, even at count zero.
        let none = values.entry(0).or_default();
        for (count, missing) in none.iter_mut().zip(missing) {
            *count += missing;
        }
        let bins = values.len() as f64;
        let pos_denominator = positive_count as f64 + smoothing * bins;
        let global_denominator = unlabeled_count as f64 + smoothing * bins;
        if !pos_denominator.is_finite() || !global_denominator.is_finite() {
            return Err(CoreError::InvalidN);
        }
        let mut rows: Vec<_> = values.into_iter().collect();
        rows.sort_unstable_by_key(|&(value, _)| value);
        let mut probabilities = Vec::with_capacity(rows.len());
        let mut negative_total = 0.0;
        for (value, counts) in rows {
            let positive = (counts[0] as f64 + smoothing) / pos_denominator;
            let global = (counts[1] as f64 + smoothing) / global_denominator;
            let negative = ((global - prior * positive) / (1.0 - prior)).max(0.0);
            negative_total += negative;
            probabilities.push((value, positive, negative));
        }
        let values = probabilities
            .into_iter()
            .map(|(value, positive, negative)| {
                let normalized = if negative_total == 0.0 {
                    1.0 / bins
                } else {
                    negative * (1.0 / negative_total)
                };
                (
                    value,
                    vec![log_probability(positive), log_probability(normalized)],
                )
            })
            .collect();
        features.insert(
            name,
            Feature {
                values,
                unseen: vec![log_probability(smoothing / pos_denominator), -1e300],
            },
        );
    }
    Ok(CategoricalNaiveBayes {
        priors: vec![log_probability(prior), log_probability(1.0 - prior)],
        features,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_associations_and_unseen_negative_zero() {
        let model = train(
            &[0, 1, 1, 2],
            &[0, 2],
            &[0, 1, 1, 2, 0, 2, 1, 1],
            &[0, 2, 4],
            0.5,
            0.5,
        )
        .unwrap();
        let mut out = [0.0; 2];
        model.predict(&[0, 1, 1, 2], &mut out).unwrap();
        assert!(out[0] > out[1]);
        model.predict(&[0, 2, 1, 1], &mut out).unwrap();
        assert!(out[1] > out[0]);
        model.predict(&[0, 99], &mut out).unwrap();
        assert_eq!(out[0].exp2(), 1.0);
        assert_eq!(out[1].exp2(), 0.0);
    }
    #[test]
    fn validates_groups_and_prior() {
        assert!(train(&[0, 1], &[0, 2], &[], &[0], 0.5, 0.5).is_err());
        for prior in [-1.0, 1.0, f64::NAN, f64::INFINITY] {
            assert!(train(&[], &[0], &[], &[0], prior, 0.5).is_err());
        }
        let model = train(&[], &[0], &[], &[0], 0.0, 0.5).unwrap();
        let mut out = [0.0; 2];
        model.predict(&[], &mut out).unwrap();
        assert_eq!(out[1], 0.0);
    }
}
