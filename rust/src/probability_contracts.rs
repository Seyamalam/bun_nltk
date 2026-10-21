//! NLTK 3.10.3 heldout, cross-validation and trigram Kneser–Ney estimates.
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContractError {
    Invalid,
    EmptyBase,
    ZeroDivision,
    NoneProbability,
    BadFeatureId,
    MissingHandle,
}

pub type Result<T> = std::result::Result<T, ContractError>;

pub fn count(value: f64) -> Result<u64> {
    if !value.is_finite() || value < 0.0 || value.fract() != 0.0 || value > 9_007_199_254_740_991.0
    {
        return Err(ContractError::Invalid);
    }
    Ok(value as u64)
}

pub const NINF: f64 = -1e300;
pub fn add_logs(left: f64, right: f64) -> f64 {
    const MAX_DIFF: f64 = -99.65784284662087;
    if left < right + MAX_DIFF {
        return right;
    }
    if right < left + MAX_DIFF {
        return left;
    }
    let base = left.min(right);
    base + ((left - base).exp2() + (right - base).exp2()).log2()
}
pub fn sum_logs(logs: &[f64]) -> f64 {
    logs.split_first()
        .map(|(&first, rest)| rest.iter().copied().fold(first, add_logs))
        .unwrap_or(NINF)
}
pub fn log_probability(p: f64, zero: f64) -> Result<f64> {
    if p < 0.0 {
        return Err(ContractError::Invalid);
    }
    Ok(if p == 0.0 { zero } else { p.log2() })
}
pub fn normalize(values: &[f64], log: bool) -> Result<Vec<f64>> {
    if values.is_empty() {
        return Err(ContractError::EmptyBase);
    }
    let sum = if log {
        sum_logs(values)
    } else {
        values.iter().sum()
    };
    let uniform = if log {
        (1.0 / values.len() as f64).log2()
    } else {
        1.0 / values.len() as f64
    };
    Ok(values
        .iter()
        .map(|&v| {
            if (log && sum <= NINF) || (!log && sum == 0.0) {
                uniform
            } else if log {
                v - sum
            } else {
                v * (1.0 / sum)
            }
        })
        .collect())
}
pub fn divide(numerator: f64, denominator: f64) -> Result<f64> {
    if denominator == 0.0 {
        return Err(ContractError::ZeroDivision);
    }
    Ok(numerator / denominator)
}

/// Frozen regression/switch/renormalization parameters, but probability queries
/// read the caller's live FreqDist counts and count-of-counts (as NLTK does).
#[derive(Clone, Copy)]
pub struct GoodTuring {
    pub slope: f64,
    pub intercept: f64,
    pub switch_at: f64,
    pub renormal: f64,
}
impl GoodTuring {
    pub fn new(counts: &[f64]) -> Result<Self> {
        if counts.iter().any(|v| !v.is_finite() || *v <= 0.0) {
            return Err(ContractError::Invalid);
        }
        let mut sorted = counts.to_vec();
        sorted.sort_by(f64::total_cmp);
        let mut r = Vec::new();
        let mut nr = Vec::new();
        for v in sorted {
            if r.last() == Some(&v) {
                *nr.last_mut().unwrap() += 1.0;
            } else {
                r.push(v);
                nr.push(1.0);
            }
        }
        let mut result = Self {
            slope: 0.0,
            intercept: 0.0,
            switch_at: 0.0,
            renormal: 1.0,
        };
        if r.is_empty() {
            return Ok(result);
        }
        let x: Vec<f64> = r.iter().map(|v| v.ln()).collect();
        let y: Vec<f64> = (0..r.len())
            .map(|j| {
                let i = if j == 0 { 0.0 } else { r[j - 1] };
                let k = if j + 1 == r.len() {
                    2.0 * r[j] - i
                } else {
                    r[j + 1]
                };
                (2.0 * nr[j] / (k - i)).ln()
            })
            .collect();
        let xm = x.iter().sum::<f64>() / x.len() as f64;
        let ym = y.iter().sum::<f64>() / y.len() as f64;
        let cov: f64 = x.iter().zip(&y).map(|(&a, &b)| (a - xm) * (b - ym)).sum();
        let var: f64 = x.iter().map(|&a| (a - xm).powi(2)).sum();
        result.slope = if var == 0.0 { 0.0 } else { cov / var };
        result.intercept = ym - result.slope * xm;
        for i in 0..r.len() {
            let v = r[i];
            if i + 1 == r.len() || r[i + 1] != v + 1.0 {
                result.switch_at = v;
                break;
            }
            let smooth = (v + 1.0) * result.smoothed(v + 1.0)? / result.smoothed(v)?;
            let unsmoothed = (v + 1.0) * nr[i + 1] / nr[i];
            let std = ((v + 1.0).powi(2) * (nr[i + 1] / nr[i].powi(2)) * (1.0 + nr[i + 1] / nr[i]))
                .sqrt();
            if (unsmoothed - smooth).abs() <= 1.96 * std {
                result.switch_at = v;
                break;
            }
        }
        let total: f64 = counts.iter().sum();
        let mut coverage = 0.0;
        for (&v, &n) in r.iter().zip(&nr) {
            coverage += n * result.measure(v, total, counts)?;
        }
        if coverage != 0.0 {
            result.renormal = (1.0 - result.measure(0.0, total, counts)?) / coverage;
        }
        Ok(result)
    }
    pub fn smoothed(&self, r: f64) -> Result<f64> {
        if r <= 0.0 {
            return Err(ContractError::Invalid);
        }
        Ok((self.intercept + self.slope * r.ln()).exp())
    }
    fn measure(&self, r: f64, total: f64, counts: &[f64]) -> Result<f64> {
        let nr = |r| counts.iter().filter(|&&v| v == r).count() as f64;
        if r == 0.0 {
            return if total == 0.0 {
                Ok(1.0)
            } else {
                divide(nr(1.0), total)
            };
        }
        let (a, b) = if self.switch_at > r {
            (nr(r + 1.0), nr(r))
        } else {
            (self.smoothed(r + 1.0)?, self.smoothed(r)?)
        };
        divide(divide((r + 1.0) * a, b)?, total)
    }
    pub fn prob(&self, r: f64, total: f64, bins: f64, counts: &[f64]) -> Result<f64> {
        let p = self.measure(r, total, counts)?;
        if r != 0.0 {
            return Ok(p * self.renormal);
        }
        if bins == counts.len() as f64 {
            Ok(0.0)
        } else {
            divide(p, bins - counts.len() as f64)
        }
    }
}

/// `None` is intentional: NLTK returns None for an unseen count class with
/// zero bins. Do not silently replace that result with numeric zero.
pub fn heldout(base: &[f64], held: &[f64], bins: Option<f64>) -> Result<HashMap<u64, Option<f64>>> {
    if base.len() != held.len() || bins.is_some_and(|b| !b.is_finite()) {
        return Err(ContractError::Invalid);
    }
    let mut nr = HashMap::<u64, f64>::new();
    let mut tr = HashMap::<u64, f64>::new();
    let mut total = 0.0;
    let mut observed = 0;
    for (&b, &h) in base.iter().zip(held) {
        let r = count(b)?;
        count(h)?;
        if r > 0 {
            *nr.entry(r).or_default() += 1.0;
            observed += 1;
        }
        *tr.entry(r).or_default() += h;
        total += h;
    }
    if observed == 0 {
        return Err(ContractError::EmptyBase);
    }
    nr.insert(0, bins.map(|b| b - observed as f64).unwrap_or(0.0));
    let mut estimates = HashMap::new();
    for (r, n) in nr {
        let estimate = if n == 0.0 {
            None
        } else if total == 0.0 {
            return Err(ContractError::ZeroDivision);
        } else {
            Some(tr.get(&r).copied().unwrap_or(0.0) / (n * total))
        };
        estimates.insert(r, estimate);
    }
    Ok(estimates)
}

/// Ordered pairs exclude identical FreqDist *objects*, not equal contents.
pub fn cross_validation(
    rows: &[Vec<f64>],
    identities: &[u32],
    bins: Option<f64>,
) -> Result<Vec<f64>> {
    let width = rows.first().map(Vec::len).unwrap_or(0);
    if rows.len() != identities.len() || rows.iter().any(|r| r.len() != width) {
        return Err(ContractError::Invalid);
    }
    let mut result = vec![0.0; width + 1];
    let mut pairs = 0;
    for (i, base) in rows.iter().enumerate() {
        for (j, held) in rows.iter().enumerate() {
            if identities[i] == identities[j] {
                continue;
            }
            let estimates = heldout(base, held, bins)?;
            for (k, &b) in base.iter().chain(std::iter::once(&0.0)).enumerate() {
                result[k] += estimates
                    .get(&count(b)?)
                    .copied()
                    .flatten()
                    .unwrap_or(f64::NAN);
            }
            pairs += 1;
        }
    }
    if pairs == 0 {
        return Ok(vec![f64::NAN; width + 1]);
    }
    for value in &mut result {
        *value /= pairs as f64;
    }
    Ok(result)
}

pub struct KneserNey {
    trigrams: HashMap<(u32, u32, u32), f64>,
    bigrams: HashMap<(u32, u32), f64>,
    after: HashMap<(u32, u32), f64>,
    contain: HashMap<u32, f64>,
    before: HashMap<(u32, u32), f64>,
    cache: HashMap<(u32, u32, u32), f64>,
    pub discount: f64,
}

impl KneserNey {
    pub fn new(rows: &[(u32, u32, u32, f64)], discount: f64) -> Result<Self> {
        if !discount.is_finite() {
            return Err(ContractError::Invalid);
        }
        let mut model = Self {
            trigrams: HashMap::new(),
            bigrams: HashMap::new(),
            after: HashMap::new(),
            contain: HashMap::new(),
            before: HashMap::new(),
            cache: HashMap::new(),
            discount,
        };
        for &(a, b, c, n) in rows {
            if count(n)? == 0 || model.trigrams.insert((a, b, c), n).is_some() {
                return Err(ContractError::Invalid);
            }
            *model.bigrams.entry((a, b)).or_default() += n;
            *model.after.entry((a, b)).or_default() += 1.0;
            *model.contain.entry(b).or_default() += 1.0;
            *model.before.entry((b, c)).or_default() += 1.0;
        }
        Ok(model)
    }

    pub fn prob(&mut self, key: (u32, u32, u32)) -> Result<f64> {
        if let Some(&p) = self.cache.get(&key) {
            return Ok(p);
        }
        let (a, b, c) = key;
        let p = if let Some(&n) = self.trigrams.get(&key) {
            (n - self.discount) / self.bigrams[&(a, b)]
        } else if let (Some(&n), Some(&before)) =
            (self.bigrams.get(&(a, b)), self.before.get(&(b, c)))
        {
            let after = self.after[&(a, b)];
            let denominator = self.contain[&b] - after;
            if denominator == 0.0 {
                return Err(ContractError::ZeroDivision);
            }
            (after * self.discount / n) * (before / denominator)
        } else {
            0.0
        };
        self.cache.insert(key, p);
        Ok(p)
    }

    // Match NLTK: changing D does not invalidate probabilities already cached.
    pub fn set_discount(&mut self, discount: f64) -> Result<()> {
        if !discount.is_finite() {
            return Err(ContractError::Invalid);
        }
        self.discount = discount;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn probability_numeric_contracts() {
        assert_eq!(sum_logs(&[]), NINF);
        assert_eq!(sum_logs(&[-2.0, -2.0]), -1.0);
        assert_eq!(normalize(&[0.0, 0.0], false).unwrap(), vec![0.5, 0.5]);
        assert_eq!(normalize(&[NINF, NINF], true).unwrap(), vec![-1.0, -1.0]);
        assert_eq!(log_probability(0.0, NINF).unwrap(), NINF);
        assert!(log_probability(-1.0, NINF).is_err());
        assert!(divide(1.0, 0.0).is_err());
        let counts = [4.0, 2.0, 2.0, 1.0, 1.0];
        let fit = GoodTuring::new(&counts).unwrap();
        let total = counts.iter().sum();
        let seen: f64 = counts
            .iter()
            .map(|&r| fit.prob(r, total, 7.0, &counts).unwrap())
            .sum();
        assert!((seen + 2.0 * fit.prob(0.0, total, 7.0, &counts).unwrap() - 1.0).abs() < 1e-12);
    }
    #[test]
    fn heldout_none_and_empty_contracts() {
        let estimates = heldout(&[2.0, 1.0, 0.0], &[1.0, 2.0, 3.0], None).unwrap();
        assert_eq!(estimates[&0], None);
        assert_eq!(estimates[&1], Some(1.0 / 3.0));
        assert_eq!(
            heldout(&[], &[], None).unwrap_err(),
            ContractError::EmptyBase
        );
        assert_eq!(
            heldout(&[1.0], &[0.0], Some(2.0)).unwrap_err(),
            ContractError::ZeroDivision
        );
        assert_eq!(
            heldout(&[1.5], &[1.0], None).unwrap_err(),
            ContractError::Invalid
        );
    }
    #[test]
    fn cross_validation_identity() {
        let rows = vec![vec![2.0, 1.0], vec![1.0, 2.0]];
        assert!(cross_validation(&rows, &[0, 0], Some(3.0))
            .unwrap()
            .iter()
            .all(|v| v.is_nan()));
        let p = cross_validation(&rows, &[0, 1], Some(3.0)).unwrap();
        assert_eq!(p, vec![0.5, 0.5, 0.0]);
    }
    #[test]
    fn kneser_backoff_and_stale_discount_cache() {
        let mut m = KneserNey::new(&[(0, 1, 2, 2.0), (3, 1, 4, 1.0)], 0.75).unwrap();
        assert_eq!(m.prob((0, 1, 2)).unwrap(), 0.625);
        assert_eq!(m.prob((0, 1, 4)).unwrap(), 0.375);
        m.set_discount(0.5).unwrap();
        assert_eq!(m.prob((0, 1, 4)).unwrap(), 0.375);
        assert_eq!(m.prob((3, 1, 2)).unwrap(), 0.5);
    }
}
