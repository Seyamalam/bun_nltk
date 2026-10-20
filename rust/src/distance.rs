//! Unicode code-point distances with NLTK 3.10.3 semantics and input bounds.
use crate::{CoreError, CoreResult};
use std::collections::HashMap;

pub const MAX_INPUT_LEN: usize = 2000;

fn validate(left: &[u32], right: &[u32], cost: f64) -> CoreResult<()> {
    if left.len().max(right.len()) > MAX_INPUT_LEN || !cost.is_finite() {
        return Err(CoreError::InvalidN);
    }
    Ok(())
}

fn matrix(left: &[u32], right: &[u32], cost: f64, transpositions: bool) -> Vec<f64> {
    let width = right.len() + 1;
    let mut data = vec![0.0; (left.len() + 1) * width];
    for i in 0..=left.len() {
        data[i * width] = i as f64;
    }
    for (j, value) in data[..width].iter_mut().enumerate() {
        *value = j as f64;
    }
    let mut last_seen = HashMap::new();
    for i in 1..=left.len() {
        let mut last_right = 0;
        for j in 1..width {
            let last_left = last_seen.get(&right[j - 1]).copied().unwrap_or(0);
            let equal = left[i - 1] == right[j - 1];
            let previous_right = last_right;
            if equal {
                last_right = j;
            }
            let mut best = (data[(i - 1) * width + j] + 1.0)
                .min(data[i * width + j - 1] + 1.0)
                .min(data[(i - 1) * width + j - 1] + if equal { 0.0 } else { cost });
            if transpositions && last_left > 0 && previous_right > 0 {
                best = best.min(
                    data[(last_left - 1) * width + previous_right - 1]
                        + (i - last_left + j - previous_right - 1) as f64,
                );
            }
            data[i * width + j] = best;
        }
        last_seen.insert(left[i - 1], i);
    }
    data
}

pub fn edit_distance(
    left: &[u32],
    right: &[u32],
    cost: f64,
    transpositions: bool,
) -> CoreResult<f64> {
    validate(left, right, cost)?;
    if transpositions {
        return Ok(*matrix(left, right, cost, true).last().unwrap());
    }
    // Ordinary Levenshtein needs two rows, not a quadratic matrix. Preserve
    // orientation and operation order for weighted and negative costs.
    let mut previous: Vec<f64> = (0..=right.len()).map(|i| i as f64).collect();
    let mut current = vec![0.0; right.len() + 1];
    for (i, &a) in left.iter().enumerate() {
        current[0] = (i + 1) as f64;
        for (j, &b) in right.iter().enumerate() {
            current[j + 1] = (previous[j + 1] + 1.0)
                .min(current[j] + 1.0)
                .min(previous[j] + if a == b { 0.0 } else { cost });
        }
        std::mem::swap(&mut previous, &mut current);
    }
    Ok(previous[right.len()])
}

pub fn edit_alignment(left: &[u32], right: &[u32], cost: f64) -> CoreResult<Vec<[u32; 2]>> {
    validate(left, right, cost)?;
    let data = matrix(left, right, cost, false);
    let width = right.len() + 1;
    let (mut i, mut j) = (left.len(), right.len());
    let mut out = vec![[i as u32, j as u32]];
    while i > 0 || j > 0 {
        let diagonal = if i > 0 && j > 0 {
            data[(i - 1) * width + j - 1]
                + if left[i - 1] == right[j - 1] {
                    0.0
                } else {
                    cost
                }
        } else {
            f64::INFINITY
        };
        let deletion = if i > 0 {
            data[(i - 1) * width + j] + 1.0
        } else {
            f64::INFINITY
        };
        let insertion = if j > 0 {
            data[i * width + j - 1] + 1.0
        } else {
            f64::INFINITY
        };
        // Stable tie precedence: substitution, deletion, insertion.
        if diagonal <= deletion && diagonal <= insertion {
            i -= 1;
            j -= 1;
        } else if deletion <= insertion {
            i -= 1;
        } else {
            j -= 1;
        }
        out.push([i as u32, j as u32]);
    }
    out.reverse();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn points(s: &str) -> Vec<u32> {
        s.chars().map(u32::from).collect()
    }
    #[test]
    fn unicode_and_unrestricted_transpositions() {
        assert_eq!(
            edit_distance(&points("CA"), &points("ABC"), 1.0, true).unwrap(),
            2.0
        );
        assert_eq!(
            edit_distance(&points("CA"), &points("ABC"), 1.0, false).unwrap(),
            3.0
        );
        assert_eq!(
            edit_alignment(&points("😀"), &points("😀x"), 1.0).unwrap(),
            [[0, 0], [1, 1], [1, 2]]
        );
        assert_eq!(
            edit_alignment(&points("a"), &points("b"), 3.0).unwrap(),
            [[0, 0], [0, 1], [1, 1]]
        );
    }
    #[test]
    fn input_bounds() {
        assert!(edit_distance(&vec![0; 2001], &[], 1.0, false).is_err());
        assert!(edit_alignment(&[], &[], f64::NAN).is_err());
        assert_eq!(
            edit_distance(&vec![0; 2000], &[], 1.0, false).unwrap(),
            2000.0
        );
    }
}
