//! Complete numeric ChrF and NIST evaluation over codepoints/token IDs.
use crate::metrics::{MetricError, MetricResult};
use std::collections::HashMap;

pub struct Sentence<'a> {
    pub references: Vec<&'a [u32]>,
    pub hypothesis: &'a [u32],
}
pub fn unpack(mut packet: &[u32]) -> Result<Vec<Sentence<'_>>, MetricError> {
    fn word(packet: &mut &[u32]) -> Result<u32, MetricError> {
        let (&head, tail) = packet.split_first().ok_or(MetricError::InvalidInput)?;
        *packet = tail;
        Ok(head)
    }
    fn sequence<'a>(packet: &mut &'a [u32]) -> Result<&'a [u32], MetricError> {
        let len = word(packet)? as usize;
        if len > packet.len() {
            return Err(MetricError::InvalidInput);
        }
        let (head, tail) = packet.split_at(len);
        *packet = tail;
        Ok(head)
    }
    let n = word(&mut packet)? as usize;
    if n > packet.len() / 2 {
        return Err(MetricError::InvalidInput);
    }
    let mut sentences = Vec::new();
    for _ in 0..n {
        let nr = word(&mut packet)? as usize;
        if nr > packet.len() {
            return Err(MetricError::InvalidInput);
        }
        let mut references = Vec::new();
        for _ in 0..nr {
            references.push(sequence(&mut packet)?);
        }
        sentences.push(Sentence {
            references,
            hypothesis: sequence(&mut packet)?,
        });
    }
    if !packet.is_empty() {
        return Err(MetricError::InvalidInput);
    }
    Ok(sentences)
}

fn counts(values: &[u32], order: usize) -> HashMap<Vec<u32>, usize> {
    let mut result = HashMap::new();
    if order == 0 {
        result.insert(vec![], values.len() + 1);
    } else if order <= values.len() {
        for window in values.windows(order) {
            *result.entry(window.to_vec()).or_default() += 1;
        }
    }
    result
}
fn python_whitespace(c: u32) -> bool {
    matches!(c, 0x09..=0x0d | 0x1c..=0x20 | 0x85 | 0xa0 | 0x1680 | 0x2000..=0x200a | 0x2028..=0x2029 | 0x202f | 0x205f | 0x3000)
}
pub fn chrf(
    sentences: &[Sentence<'_>],
    min: usize,
    max: usize,
    beta: f64,
    ignore_whitespace: bool,
) -> MetricResult {
    if max > 1024 {
        return Err(MetricError::InvalidInput);
    }
    if max < min || sentences.is_empty() {
        return Err(MetricError::ZeroDivision);
    }
    let factor = beta.powi(2);
    let mut sums = vec![0.0; max - min + 1];
    for sentence in sentences {
        if sentence.references.len() != 1 {
            return Err(MetricError::InvalidInput);
        }
        let preprocess = |values: &[u32]| {
            values
                .iter()
                .copied()
                .filter(|&c| !ignore_whitespace || !python_whitespace(c))
                .collect::<Vec<_>>()
        };
        let a = preprocess(sentence.references[0]);
        let b = preprocess(sentence.hypothesis);
        for (order, sum) in (min..=max).zip(&mut sums) {
            let ac = counts(&a, order);
            let bc = counts(&b, order);
            let overlap: usize = bc
                .iter()
                .map(|(k, &n)| n.min(ac.get(k).copied().unwrap_or(0)))
                .sum();
            let na: usize = ac.values().sum();
            let nb: usize = bc.values().sum();
            let score = if na == 0 || nb == 0 {
                1e-16
            } else {
                if beta.is_finite() && beta.abs() > f64::MAX.sqrt() {
                    return Err(MetricError::Overflow);
                }
                let p = overlap as f64 / nb as f64;
                let r = overlap as f64 / na as f64;
                let denominator = factor * p + r;
                if denominator == 0.0 {
                    1e-16
                } else {
                    (1.0 + factor) * (p * r) / denominator
                }
            };
            *sum += score;
        }
    }
    Ok(Some(
        sums.iter().sum::<f64>() / sums.len() as f64 / sentences.len() as f64,
    ))
}

pub fn nist_length_penalty(reference: f64, hypothesis: f64) -> MetricResult {
    if reference == 0.0 {
        return Err(MetricError::ZeroDivision);
    }
    let ratio = hypothesis / reference;
    Ok(Some(if ratio > 0.0 && ratio < 1.0 {
        let beta = 0.5f64.ln() / 1.5f64.ln().powi(2);
        (beta * ratio.ln().powi(2)).exp()
    } else {
        ratio.clamp(0.0, 1.0)
    }))
}
pub fn nist(sentences: &[Sentence<'_>], order: usize) -> MetricResult {
    if order > 1024 {
        return Err(MetricError::InvalidInput);
    }
    if sentences.is_empty() || order == 0 {
        return Err(MetricError::ZeroDivision);
    }
    // Reuse the existing exact Rust accumulator for its supported fixed key sizes.
    if order <= 5 {
        let mut accumulator = crate::translation::NistAccumulator::new(order);
        for sentence in sentences {
            if sentence.references.is_empty() {
                return Err(MetricError::InvalidInput);
            }
            for reference in &sentence.references {
                accumulator.add_reference(reference);
            }
        }
        for sentence in sentences {
            accumulator.add_hypothesis(&sentence.references, sentence.hypothesis);
        }
        let (numerators, denominators, reference, hypothesis) = accumulator.finish();
        let mut score = 0.0;
        for i in 0..order {
            if denominators[i] == 0 {
                return Err(MetricError::ZeroDivision);
            }
            score += numerators[i] / denominators[i] as f64;
        }
        return nist_length_penalty(reference as f64, hypothesis as f64)
            .map(|p| p.map(|p| score * p));
    }
    let mut frequencies = HashMap::<Vec<u32>, usize>::new();
    let mut reference_words = 0;
    for sentence in sentences {
        if sentence.references.is_empty() {
            return Err(MetricError::InvalidInput);
        }
        for reference in &sentence.references {
            for n in 1..=order.min(reference.len()) {
                for (key, count) in counts(reference, n) {
                    *frequencies.entry(key).or_default() += count;
                }
            }
            reference_words += reference.len();
        }
    }
    let mut score = 0.0;
    let mut ref_len = 0;
    let mut hyp_len = 0;
    for n in 1..=order {
        let mut numerator = 0.0;
        let mut denominator = 0;
        for sentence in sentences {
            // Python Counter overlap iteration follows first hypothesis occurrence.
            let mut hc = HashMap::new();
            let mut keys = Vec::new();
            if n <= sentence.hypothesis.len() {
                for window in sentence.hypothesis.windows(n) {
                    let count = hc.entry(window.to_vec()).or_insert_with(|| {
                        keys.push(window.to_vec());
                        0usize
                    });
                    *count += 1;
                }
            }
            let den = sentence.hypothesis.len().saturating_sub(n - 1);
            let mut best = (f64::NEG_INFINITY, 0.0, 0, 0);
            for reference in &sentence.references {
                let rc = counts(reference, n);
                let mut num = 0.0;
                for key in &keys {
                    if let Some(&count) = rc.get(key) {
                        let prefix = if n == 1 {
                            reference_words
                        } else {
                            frequencies[&key[..n - 1]]
                        };
                        let information =
                            (prefix as f64 / frequencies[key] as f64).ln() / std::f64::consts::LN_2;
                        num += information * count.min(hc[key]) as f64;
                    }
                }
                let candidate = (
                    if den == 0 { 0.0 } else { num / den as f64 },
                    num,
                    den,
                    reference.len(),
                );
                if candidate > best {
                    best = candidate;
                }
            }
            numerator += best.1;
            denominator += best.2;
            ref_len += best.3;
            hyp_len += sentence.hypothesis.len();
        }
        if denominator == 0 {
            return Err(MetricError::ZeroDivision);
        }
        score += numerator / denominator as f64;
    }
    nist_length_penalty(ref_len as f64, hyp_len as f64).map(|p| p.map(|p| score * p))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn packet_validation() {
        assert!(unpack(&[1, 1, 5, 0]).is_err());
        assert!(unpack(&[0, 1]).is_err());
        assert_eq!(
            unpack(&[1, 1, 2, 65, 66, 1, 65]).unwrap()[0].hypothesis,
            [65]
        );
    }
    #[test]
    fn chrf_zero_order_whitespace_and_empty() {
        let s = [Sentence {
            references: vec![&[65, 0x1c, 0xfeff]],
            hypothesis: &[65, 0xfeff],
        }];
        assert_eq!(chrf(&s, 0, 2, 3.0, true), Ok(Some(1.0)));
        assert_eq!(chrf(&[], 1, 6, 3.0, true), Err(MetricError::ZeroDivision));
        assert_eq!(chrf(&s, 1, 6, 1e300, true), Err(MetricError::Overflow));
    }
    #[test]
    fn arbitrary_order_nist_and_penalty() {
        let s = [Sentence {
            references: vec![&[0, 1, 2, 3, 4, 5]],
            hypothesis: &[0, 1, 2, 3, 4, 5],
        }];
        assert!(nist(&s, 6).unwrap().unwrap() > 0.0);
        assert_eq!(nist(&s, 7), Err(MetricError::ZeroDivision));
        assert_eq!(
            nist_length_penalty(0.0, 1.0),
            Err(MetricError::ZeroDivision)
        );
        assert_eq!(nist_length_penalty(10.0, -1.0), Ok(Some(0.0)));
    }
}
