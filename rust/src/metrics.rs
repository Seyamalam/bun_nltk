//! Numeric evaluation contracts from NLTK 3.10.3. Labels are opaque interned IDs.
use std::collections::{BTreeMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricError {
    ZeroDivision,
    InvalidInput,
    MissingLabel,
    Overflow,
}
pub type MetricResult = Result<Option<f64>, MetricError>;

fn divide(numerator: f64, denominator: f64) -> MetricResult {
    if denominator == 0.0 {
        Err(MetricError::ZeroDivision)
    } else {
        Ok(Some(numerator / denominator))
    }
}

pub fn harmonic(p: f64, r: f64, alpha: f64) -> MetricResult {
    if p == 0.0 || r == 0.0 {
        Ok(Some(0.0))
    } else {
        divide(1.0, alpha / p + (1.0 - alpha) / r)
    }
}

// 0 Jaccard, 1 MASI, 2 Dice similarity, 3 Dice distance, 4 precision,
// 5 recall, 6 F-measure, 7 presence, 8 fractional presence.
pub fn set_score(op: u32, a: &[u32], b: &[u32], label: u32, alpha: f64) -> MetricResult {
    let a: HashSet<_> = a.iter().copied().collect();
    let b: HashSet<_> = b.iter().copied().collect();
    let na = a.len() as f64;
    let nb = b.len() as f64;
    let intersection = a.intersection(&b).count() as f64;
    let union = na + nb - intersection;
    match op {
        0 => divide(union - intersection, union),
        1 => {
            let weight = if na == nb && na == intersection {
                1.0
            } else if intersection == na.min(nb) {
                2.0 / 3.0
            } else if intersection > 0.0 {
                1.0 / 3.0
            } else {
                0.0
            };
            divide(intersection, union).map(|v| v.map(|v| 1.0 - v * weight))
        }
        2 | 3 => divide(2.0 * intersection, na + nb)
            .map(|v| v.map(|v| if op == 2 { v } else { 1.0 - v })),
        4 if nb == 0.0 => Ok(None),
        4 => divide(intersection, nb),
        5 if na == 0.0 => Ok(None),
        5 => divide(intersection, na),
        6 if na == 0.0 || nb == 0.0 => Ok(None),
        6 => harmonic(intersection / nb, intersection / na, alpha),
        7 => Ok(Some(if a.contains(&label) == b.contains(&label) {
            1.0
        } else {
            0.0
        })),
        8 => {
            // Python evaluates both reciprocals before multiplying by membership.
            if na == 0.0 || nb == 0.0 {
                return Err(MetricError::ZeroDivision);
            }
            let x = a.contains(&label);
            let y = b.contains(&label);
            Ok(Some(match (x, y) {
                (true, true) => (1.0 / na - 1.0 / nb).abs(),
                (true, false) => 1.0 / na,
                (false, true) => 1.0 / nb,
                (false, false) => 0.0,
            }))
        }
        _ => Err(MetricError::InvalidInput),
    }
}

pub fn interval(a: f64, b: f64) -> f64 {
    (a - b).powi(2)
}

pub fn accuracy(a: &[u32], b: &[u32]) -> MetricResult {
    if a.len() != b.len() {
        return Err(MetricError::InvalidInput);
    }
    divide(
        a.iter().zip(b).filter(|(x, y)| x == y).count() as f64,
        b.len() as f64,
    )
}

pub fn log_likelihood(probabilities: &[f64]) -> MetricResult {
    let mut sum = 0.0;
    for &p in probabilities {
        if p < 0.0 {
            return Err(MetricError::InvalidInput);
        }
        // ProbDistI.logprob uses NLTK's finite negative-infinity sentinel for zero.
        sum += if p == 0.0 { -1e300 } else { p.log2() };
    }
    divide(sum, probabilities.len() as f64)
}

pub fn spearman(a_ids: &[u32], a_ranks: &[f64], b_ids: &[u32], b_ranks: &[f64]) -> MetricResult {
    if a_ids.len() != a_ranks.len() || b_ids.len() != b_ranks.len() {
        return Err(MetricError::InvalidInput);
    }
    // Last value wins; first insertion order is retained, as with Python dict.
    let mut a = Vec::<(u32, f64)>::new();
    let mut positions = BTreeMap::new();
    for (&id, &rank) in a_ids.iter().zip(a_ranks) {
        if let Some(&i) = positions.get(&id) {
            a[i] = (id, rank);
        } else {
            positions.insert(id, a.len());
            a.push((id, rank));
        }
    }
    let b: BTreeMap<_, _> = b_ids.iter().copied().zip(b_ranks.iter().copied()).collect();
    let mut n = 0.0;
    let mut sum = 0.0;
    for (id, rank) in a {
        if let Some(other) = b.get(&id) {
            let d = rank - other;
            sum += d * d;
            n += 1.0;
        }
    }
    if n < 2.0 {
        Ok(Some(0.0))
    } else {
        Ok(Some(1.0 - 6.0 * sum / (n * (n * n - 1.0))))
    }
}

pub fn ranks_from_scores(scores: &[f64], gap: f64) -> Vec<u32> {
    let mut rank = 0;
    scores
        .iter()
        .enumerate()
        .map(|(i, score)| {
            if i > 0 && (score - scores[i - 1]).abs() > gap {
                rank = i as u32;
            }
            rank
        })
        .collect()
}

/// A string's count differs from list membership for multi-character boundaries.
pub struct Segmentation<'a> {
    pub values: &'a [u32],
    pub boundary: &'a [u32],
    pub string: bool,
}
impl Segmentation<'_> {
    fn count(&self, k: usize) -> usize {
        let values = &self.values[..k.min(self.values.len())];
        if self.string {
            if self.boundary.is_empty() {
                return values.len() + 1;
            }
            let mut i = 0;
            let mut count = 0;
            while i + self.boundary.len() <= values.len() {
                if &values[i..i + self.boundary.len()] == self.boundary {
                    count += 1;
                    i += self.boundary.len();
                } else {
                    i += 1;
                }
            }
            count
        } else {
            values.iter().filter(|&&v| self.matches(v)).count()
        }
    }
    fn matches(&self, value: u32) -> bool {
        self.boundary.len() == 1 && self.boundary[0] == value
    }
}

pub fn segmentation(
    a: Segmentation<'_>,
    b: Segmentation<'_>,
    k: Option<i64>,
    pk: bool,
    weighted: bool,
) -> MetricResult {
    if a.values.len() != b.values.len() {
        return Err(MetricError::InvalidInput);
    }
    let n = a.values.len();
    let k = match k {
        Some(k) => k,
        None if pk => ((n as f64) / (a.count(n).max(1) as f64 * 2.0)).round_ties_even() as i64,
        None => return Err(MetricError::InvalidInput),
    };
    if k < 0 || (!pk && k > n as i64) {
        return Err(MetricError::InvalidInput);
    }
    let denominator = n as f64 - k as f64 + 1.0;
    if k > n as i64 {
        return divide(0.0, denominator);
    }
    let k = k as usize;
    let mut ca = a.count(k) as i64;
    let mut cb = b.count(k) as i64;
    let mut error = 0.0;
    for i in 0..=n - k {
        if i > 0 {
            ca += i64::from(a.matches(a.values[i + k - 1])) - i64::from(a.matches(a.values[i - 1]));
            cb += i64::from(b.matches(b.values[i + k - 1])) - i64::from(b.matches(b.values[i - 1]));
        }
        error += if pk {
            f64::from((ca > 0) != (cb > 0))
        } else if weighted {
            (ca - cb).abs() as f64
        } else {
            f64::from(ca != cb)
        };
    }
    divide(error, denominator)
}

pub enum LabelOrder<'a> {
    Identity(usize),
    Numeric(&'a [f64]),
    Text(&'a [Vec<u32>]),
}
pub struct Confusion {
    pub labels: Vec<u32>,
    pub cells: Vec<[u32; 3]>,
    pub correct: usize,
    pub total: usize,
}
pub fn confusion(a: &[u32], b: &[u32], order: LabelOrder<'_>) -> Result<Confusion, MetricError> {
    if a.len() != b.len() {
        return Err(MetricError::InvalidInput);
    }
    let count = match &order {
        LabelOrder::Identity(n) => *n,
        LabelOrder::Numeric(v) => v.len(),
        LabelOrder::Text(v) => v.len(),
    };
    if a.iter().chain(b).any(|&v| v as usize >= count) {
        return Err(MetricError::InvalidInput);
    }
    let mut labels: Vec<u32> = (0..count as u32).collect();
    match order {
        LabelOrder::Identity(_) => (),
        LabelOrder::Numeric(v) => labels.sort_by(|&a, &b| {
            v[a as usize]
                .partial_cmp(&v[b as usize])
                .unwrap_or(std::cmp::Ordering::Equal)
        }),
        LabelOrder::Text(v) => labels.sort_by(|&a, &b| v[a as usize].cmp(&v[b as usize])),
    }
    let mut cells = BTreeMap::<(u32, u32), u32>::new();
    let mut correct = 0;
    for (&a, &b) in a.iter().zip(b) {
        *cells.entry((a, b)).or_default() += 1;
        correct += usize::from(a == b);
    }
    Ok(Confusion {
        labels,
        cells: cells.into_iter().map(|((a, b), n)| [a, b, n]).collect(),
        correct,
        total: a.len(),
    })
}

pub fn confusion_score(op: u32, cells: &[[u32; 3]], label: u32, alpha: f64) -> MetricResult {
    let mut tp = 0.0;
    let mut row = 0.0;
    let mut col = 0.0;
    for &[a, b, n] in cells {
        if a == label {
            row += n as f64;
        }
        if b == label {
            col += n as f64;
        }
        if a == label && b == label {
            tp += n as f64;
        }
    }
    let p = if col == 0.0 { 0.0 } else { tp / col };
    let r = if row == 0.0 { 0.0 } else { tp / row };
    match op {
        0 => Ok(Some(p)),
        1 => Ok(Some(r)),
        2 => harmonic(p, r, alpha),
        _ => Err(MetricError::InvalidInput),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sets_and_none_are_distinct_from_nan() {
        assert_eq!(
            set_score(0, &[], &[], 0, 0.5),
            Err(MetricError::ZeroDivision)
        );
        assert_eq!(
            set_score(1, &[], &[], 0, 0.5),
            Err(MetricError::ZeroDivision)
        );
        assert_eq!(set_score(4, &[0], &[], 0, 0.5), Ok(None));
        assert!(set_score(6, &[0], &[0], 0, f64::NAN)
            .unwrap()
            .unwrap()
            .is_nan());
        assert_eq!(
            set_score(8, &[], &[0], 1, 0.5),
            Err(MetricError::ZeroDivision)
        );
        assert_eq!(
            set_score(0, &[1, 1, 2], &[2, 3], 0, 0.5),
            Ok(Some(2.0 / 3.0))
        );
    }
    #[test]
    fn harmonic_zero_denominator() {
        assert_eq!(harmonic(0.5, 1.0, -1.0), Err(MetricError::ZeroDivision));
        assert_eq!(harmonic(0.0, 0.0, f64::NAN), Ok(Some(0.0)));
    }
    #[test]
    fn segmentation_empty_and_oversize() {
        let s = || Segmentation {
            values: &[],
            boundary: &[1],
            string: false,
        };
        assert_eq!(segmentation(s(), s(), None, true, false), Ok(Some(0.0)));
        assert_eq!(
            segmentation(s(), s(), Some(1), true, false),
            Err(MetricError::ZeroDivision)
        );
        assert_eq!(
            segmentation(s(), s(), Some(2), true, false)
                .unwrap()
                .unwrap()
                .to_bits(),
            (-0.0f64).to_bits()
        );
        assert_eq!(
            segmentation(s(), s(), Some(-1), false, false),
            Err(MetricError::InvalidInput)
        );
    }
    #[test]
    fn ranking_duplicates_and_ties() {
        assert_eq!(
            spearman(&[0, 1, 0], &[9.0, 1.0, 0.0], &[0, 1], &[0.0, 1.0]),
            Ok(Some(1.0))
        );
        assert_eq!(
            ranks_from_scores(&[3.0, 3.0, 2.0, 2.0, 1.0], 1e-15),
            [0, 0, 2, 2, 4]
        );
    }
    #[test]
    fn sparse_confusion_and_scores() {
        let cm = confusion(
            &[0, 1, 0],
            &[0, 0, 0],
            LabelOrder::Text(&[vec![122], vec![65]]),
        )
        .unwrap();
        assert_eq!(cm.labels, [1, 0]);
        assert_eq!(cm.cells, [[0, 0, 2], [1, 0, 1]]);
        assert_eq!(confusion_score(0, &cm.cells, 0, 0.5), Ok(Some(2.0 / 3.0)));
        assert_eq!(confusion_score(1, &cm.cells, 0, 0.5), Ok(Some(1.0)));
        assert_eq!(accuracy(&[], &[]), Err(MetricError::ZeroDivision));
    }
    #[test]
    fn probability_zero_and_invalid() {
        assert_eq!(log_likelihood(&[0.0]), Ok(Some(-1e300)));
        assert_eq!(log_likelihood(&[]), Err(MetricError::ZeroDivision));
        assert_eq!(log_likelihood(&[-1.0]), Err(MetricError::InvalidInput));
    }
}
