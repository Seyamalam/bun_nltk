use crate::{numeric_validation, CoreError, CoreResult};
use std::collections::HashMap;

// Bound both construction work and key storage, not just the number of tokens.
pub const MAX_ORDER: u32 = 64;
pub const MAX_TOKENS: usize = 1_000_000;
pub const MAX_NGRAMS: usize = 1_000_000;
pub const MAX_KEY_UNITS: usize = 8_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelType {
    Mle = 0,
    Lidstone = 1,
    KneserNeyInterpolated = 2,
    StupidBackoff = 3,
    WittenBellInterpolated = 4,
    AbsoluteDiscountingInterpolated = 5,
}

impl ModelType {
    pub fn from_u32(value: u32) -> CoreResult<Self> {
        match value {
            0 => Ok(Self::Mle),
            1 => Ok(Self::Lidstone),
            2 => Ok(Self::KneserNeyInterpolated),
            3 => Ok(Self::StupidBackoff),
            4 => Ok(Self::WittenBellInterpolated),
            5 => Ok(Self::AbsoluteDiscountingInterpolated),
            _ => Err(CoreError::InvalidN),
        }
    }
}

#[derive(Clone, Copy)]
pub struct Options {
    pub order: u32,
    pub model: ModelType,
    pub gamma: f64,
    pub discount: f64,
    pub alpha: f64,
    pub vocab_size: u32,
}

impl Options {
    pub fn validate(&self) -> CoreResult<()> {
        if !(1..=MAX_ORDER).contains(&self.order)
            || !self.gamma.is_finite()
            || self.gamma < 0.0
            || !self.discount.is_finite()
            || !(0.0..=1.0).contains(&self.discount)
            || !self.alpha.is_finite()
            || self.alpha < 0.0
        {
            return Err(CoreError::InvalidN);
        }
        Ok(())
    }
}

#[derive(Default, Clone, Copy)]
struct Frequency {
    count: u32,
    total: u32,
    followers: u32,
    continuation: u32,
    continuation_total: u32,
}

/// Raw counts, follower counts and unique-predecessor counts share one key store.
pub struct Counts {
    frequencies: HashMap<Vec<u32>, Frequency>,
}

fn copy_key(key: &[u32]) -> CoreResult<Vec<u32>> {
    let mut out = Vec::new();
    out.try_reserve_exact(key.len())
        .map_err(|_| CoreError::OutOfMemory)?;
    out.extend_from_slice(key);
    Ok(out)
}

impl Counts {
    pub fn build(tokens: &[u32], offsets: &[u32], order: u32) -> CoreResult<Self> {
        numeric_validation::offsets(offsets, tokens.len())?;
        if !(1..=MAX_ORDER).contains(&order)
            || tokens.len() > MAX_TOKENS
            || offsets.len() > MAX_TOKENS + 1
        {
            return Err(CoreError::InvalidN);
        }
        let mut grams = 0usize;
        let mut key_units = 0usize;
        for bounds in offsets.windows(2) {
            let len = (bounds[1] - bounds[0]) as usize;
            for n in 1..=(order as usize).min(len) {
                grams += len + 1 - n;
                key_units += (len + 1 - n) * n;
                if grams > MAX_NGRAMS || key_units > MAX_KEY_UNITS {
                    return Err(CoreError::InsufficientCapacity);
                }
            }
        }
        let mut counts = Self {
            frequencies: HashMap::new(),
        };
        for bounds in offsets.windows(2) {
            let row = &tokens[bounds[0] as usize..bounds[1] as usize];
            for n in 1..=(order as usize).min(row.len()) {
                for gram in row.windows(n) {
                    let frequency = counts.entry(gram)?;
                    let first = frequency.count == 0;
                    frequency.count += 1;
                    let context = &gram[..n - 1];
                    counts.entry(context)?.total += 1;
                    if first && n > 1 {
                        counts.entry(context)?.followers += 1;
                        counts.entry(&gram[1..])?.continuation += 1;
                        counts.entry(&gram[1..n - 1])?.continuation_total += 1;
                    }
                }
            }
        }
        Ok(counts)
    }

    fn entry(&mut self, key: &[u32]) -> CoreResult<&mut Frequency> {
        if !self.frequencies.contains_key(key) {
            self.frequencies
                .try_reserve(1)
                .map_err(|_| CoreError::OutOfMemory)?;
            self.frequencies
                .insert(copy_key(key)?, Frequency::default());
        }
        Ok(self.frequencies.get_mut(key).unwrap())
    }

    fn get(&self, key: &[u32]) -> Frequency {
        self.frequencies.get(key).copied().unwrap_or_default()
    }

    pub fn vocabulary(&self, unknown: u32) -> Vec<u32> {
        let mut ids: Vec<_> = self
            .frequencies
            .iter()
            .filter(|(key, value)| key.len() == 1 && value.count > 0)
            .map(|(key, _)| key[0])
            .collect();
        if !ids.contains(&unknown) {
            ids.push(unknown);
        }
        ids.sort_unstable();
        ids
    }

    pub fn score(&self, word: u32, context: &[u32], options: &Options) -> f64 {
        let keep = context.len().min(options.order as usize - 1);
        self.score_context(word, &context[context.len() - keep..], options)
    }

    fn score_context(&self, word: u32, context: &[u32], options: &Options) -> f64 {
        let mut gram = [0u32; MAX_ORDER as usize];
        gram[..context.len()].copy_from_slice(context);
        gram[context.len()] = word;
        let frequency = self.get(&gram[..context.len() + 1]);
        let prefix = self.get(context);
        let count = frequency.count as f64;
        let total = prefix.total as f64;
        match options.model {
            ModelType::Mle => {
                if total > 0.0 {
                    count / total
                } else {
                    0.0
                }
            }
            ModelType::Lidstone => {
                (count + options.gamma) / (total + options.gamma * options.vocab_size.max(1) as f64)
            }
            ModelType::KneserNeyInterpolated if context.is_empty() => {
                if prefix.continuation_total == 0 {
                    return 0.0;
                }
                frequency.continuation as f64 / prefix.continuation_total as f64
            }
            _ if context.is_empty() => {
                if total > 0.0 {
                    count / total
                } else {
                    0.0
                }
            }
            ModelType::StupidBackoff if count > 0.0 => count / total,
            _ => {
                let lower = self.score_context(word, &context[1..], options);
                if options.model == ModelType::StupidBackoff {
                    return options.alpha * lower;
                }
                if total == 0.0 {
                    return lower;
                }
                let followers = prefix.followers as f64;
                if options.model == ModelType::WittenBellInterpolated {
                    let gamma = followers / (followers + total);
                    return (1.0 - gamma) * (count / total) + gamma * lower;
                }
                let (count, total) = if options.model == ModelType::KneserNeyInterpolated
                    && context.len() + 1 != options.order as usize
                {
                    (
                        frequency.continuation as f64,
                        prefix.continuation_total as f64,
                    )
                } else {
                    (count, total)
                };
                if total == 0.0 {
                    return lower;
                }
                (count - options.discount).max(0.0) / total
                    + options.discount * followers / total * lower
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn evaluate(
        &self,
        options: &Options,
        flat: &[u32],
        lens: &[u32],
        words: &[u32],
        scores: &mut [f64],
        sequence: &[u32],
        prefix: &[u32],
    ) -> CoreResult<f64> {
        if lens.len() != words.len()
            || scores.len() < words.len()
            || lens.iter().map(|&n| n as u64).sum::<u64>() != flat.len() as u64
            || sequence.len() > MAX_TOKENS
            || words.len() > MAX_TOKENS
            || flat.len() > MAX_KEY_UNITS
        {
            return Err(CoreError::InsufficientCapacity);
        }
        let mut cursor = 0;
        for (i, &len) in lens.iter().enumerate() {
            let end = cursor + len as usize;
            scores[i] = self.score(words[i], &flat[cursor..end], options);
            cursor = end;
        }
        if sequence.is_empty() {
            return Ok(f64::INFINITY);
        }
        // At most order-1 context IDs, regardless of evaluation sequence length.
        let mut history = [0u32; MAX_ORDER as usize];
        let capacity = options.order as usize - 1;
        let mut len = prefix.len().min(capacity);
        history[..len].copy_from_slice(&prefix[prefix.len() - len..]);
        let mut neg_log2 = 0.0;
        for &word in sequence {
            neg_log2 -= safe_prob(self.score(word, &history[..len], options)).log2();
            if capacity > 0 {
                if len == capacity {
                    history.copy_within(1..len, 0);
                    len -= 1;
                }
                history[len] = word;
                len += 1;
            }
        }
        Ok(2f64.powf(neg_log2 / sequence.len() as f64))
    }
}

pub fn safe_prob(probability: f64) -> f64 {
    if probability.is_finite() && probability > 0.0 {
        probability
    } else {
        1e-12
    }
}

// Existing flat-buffer ABI delegates to the same generic, validated count kernel.
#[allow(clippy::too_many_arguments)]
pub fn try_eval_ids(
    tokens: &[u32],
    offsets: &[u32],
    order: u32,
    model: ModelType,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
    flat: &[u32],
    lens: &[u32],
    words: &[u32],
    scores: &mut [f64],
    sequence: &[u32],
    prefix: &[u32],
) -> CoreResult<f64> {
    let options = Options {
        order,
        model,
        gamma,
        discount,
        alpha: 0.4,
        vocab_size,
    };
    options.validate()?;
    Counts::build(tokens, offsets, order)?
        .evaluate(&options, flat, lens, words, scores, sequence, prefix)
}

#[allow(clippy::too_many_arguments)]
pub fn eval_ids(
    tokens: &[u32],
    offsets: &[u32],
    order: u32,
    model: ModelType,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
    flat: &[u32],
    lens: &[u32],
    words: &[u32],
    scores: &mut [f64],
    sequence: &[u32],
    prefix: &[u32],
) -> f64 {
    match try_eval_ids(
        tokens, offsets, order, model, gamma, discount, vocab_size, flat, lens, words, scores,
        sequence, prefix,
    ) {
        Ok(value) => value,
        Err(error) => {
            crate::error_state::set_error(error.code());
            f64::INFINITY
        }
    }
}

#[cfg(test)]
#[path = "lm_tests.rs"]
mod tests;
