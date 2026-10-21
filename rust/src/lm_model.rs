use crate::lm::{Counts, Options, MAX_TOKENS};
use crate::{numeric_validation, CoreError, CoreResult};

#[derive(Clone, Copy)]
pub struct Padding {
    pub left: bool,
    pub right: bool,
    pub start: u32,
    pub end: u32,
}

pub struct LanguageModel {
    counts: Counts,
    options: Options,
    padding: Padding,
    pub vocabulary: Vec<u32>,
}

impl LanguageModel {
    pub fn train(
        tokens: &[u32],
        offsets: &[u32],
        mut options: Options,
        padding: Padding,
        unknown: u32,
    ) -> CoreResult<Self> {
        options.validate()?;
        numeric_validation::offsets(offsets, tokens.len())?;
        if offsets.len() > MAX_TOKENS + 1 {
            return Err(CoreError::InsufficientCapacity);
        }
        let pad = options.order as usize - 1;
        let added = (offsets.len() - 1)
            .checked_mul(pad)
            .and_then(|n| n.checked_mul(padding.left as usize + padding.right as usize))
            .ok_or(CoreError::InsufficientCapacity)?;
        let len = tokens
            .len()
            .checked_add(added)
            .ok_or(CoreError::InsufficientCapacity)?;
        if len > MAX_TOKENS {
            return Err(CoreError::InsufficientCapacity);
        }
        let mut prepared = Vec::new();
        prepared
            .try_reserve_exact(len)
            .map_err(|_| CoreError::OutOfMemory)?;
        let mut prepared_offsets = Vec::new();
        prepared_offsets
            .try_reserve_exact(offsets.len())
            .map_err(|_| CoreError::OutOfMemory)?;
        prepared_offsets.push(0);
        for bounds in offsets.windows(2) {
            if padding.left {
                prepared.resize(prepared.len() + pad, padding.start);
            }
            prepared.extend_from_slice(&tokens[bounds[0] as usize..bounds[1] as usize]);
            if padding.right {
                prepared.resize(prepared.len() + pad, padding.end);
            }
            prepared_offsets.push(prepared.len() as u32);
        }
        let counts = Counts::build(&prepared, &prepared_offsets, options.order)?;
        let vocabulary = counts.vocabulary(unknown);
        options.vocab_size = vocabulary.len() as u32;
        Ok(Self {
            counts,
            options,
            padding,
            vocabulary,
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub fn evaluate(
        &self,
        flat: &[u32],
        lens: &[u32],
        words: &[u32],
        scores: &mut [f64],
        tokens: &[u32],
        perplexity: bool,
    ) -> CoreResult<f64> {
        let mut sequence = Vec::new();
        if perplexity {
            if tokens.len() + self.padding.right as usize > MAX_TOKENS {
                return Err(CoreError::InsufficientCapacity);
            }
            sequence
                .try_reserve_exact(tokens.len() + 1)
                .map_err(|_| CoreError::OutOfMemory)?;
            sequence.extend_from_slice(tokens);
            // Preserve the existing evaluation contract: one end token, not order-1.
            if self.padding.right {
                sequence.push(self.padding.end);
            }
        }
        let prefix = [self.padding.start; crate::lm::MAX_ORDER as usize];
        let len = if self.padding.left {
            self.options.order as usize - 1
        } else {
            0
        };
        self.counts.evaluate(
            &self.options,
            flat,
            lens,
            words,
            scores,
            &sequence,
            &prefix[..len],
        )
    }
}
