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
