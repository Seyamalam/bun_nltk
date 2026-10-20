//! Collision-free ASCII aggregate metrics across arbitrary byte-chunk boundaries.
use crate::ascii;
use crate::{CoreError, CoreResult};
use std::collections::{HashMap, HashSet};

pub struct ExactMetricsStream {
    order: usize,
    max_token_bytes: usize,
    max_unique_tokens: usize,
    max_unique_ngrams: usize,
    vocabulary: HashMap<Vec<u8>, u32>,
    grams: HashSet<Vec<u32>>,
    token: Vec<u8>,
    window: Vec<u32>,
    key: Vec<u32>,
    tokens: u64,
    finished: bool,
    failed: bool,
}

impl ExactMetricsStream {
    pub fn new(
        order: usize,
        max_token_bytes: usize,
        max_unique_tokens: usize,
        max_unique_ngrams: usize,
    ) -> CoreResult<Self> {
        if !(1..=64).contains(&order)
            || max_token_bytes == 0
            || max_unique_tokens == 0
            || max_unique_ngrams == 0
        {
            return Err(CoreError::InvalidN);
        }
        Ok(Self {
            order,
            max_token_bytes,
            max_unique_tokens,
            max_unique_ngrams,
            vocabulary: HashMap::new(),
            grams: HashSet::new(),
            token: Vec::new(),
            window: vec![0; order],
            key: vec![0; order],
            tokens: 0,
            finished: false,
            failed: false,
        })
    }

    fn emit_token(&mut self) -> CoreResult<()> {
        if self.token.is_empty() {
            return Ok(());
        }
        if self.tokens >= 9_007_199_254_740_991 {
            return Err(CoreError::InsufficientCapacity);
        }
        let id = if let Some(&id) = self.vocabulary.get(self.token.as_slice()) {
            id
        } else {
            if self.vocabulary.len() >= self.max_unique_tokens {
                return Err(CoreError::InsufficientCapacity);
            }
            let id = u32::try_from(self.vocabulary.len())
                .map_err(|_| CoreError::InsufficientCapacity)?;
            self.vocabulary
                .try_reserve(1)
                .map_err(|_| CoreError::OutOfMemory)?;
            let mut token = Vec::new();
            token
                .try_reserve_exact(self.token.len())
                .map_err(|_| CoreError::OutOfMemory)?;
            token.extend_from_slice(&self.token);
            self.vocabulary.insert(token, id);
            id
        };
        self.window[(self.tokens % self.order as u64) as usize] = id;
        self.tokens += 1;
        if self.tokens >= self.order as u64 {
            let start = (self.tokens % self.order as u64) as usize;
            for i in 0..self.order {
                self.key[i] = self.window[(start + i) % self.order];
            }
            if !self.grams.contains(self.key.as_slice()) {
                if self.grams.len() >= self.max_unique_ngrams {
                    return Err(CoreError::InsufficientCapacity);
                }
                self.grams
                    .try_reserve(1)
                    .map_err(|_| CoreError::OutOfMemory)?;
                let mut key = Vec::new();
                key.try_reserve_exact(self.order)
                    .map_err(|_| CoreError::OutOfMemory)?;
                key.extend_from_slice(&self.key);
                self.grams.insert(key);
            }
        }
        self.token.clear();
        Ok(())
    }

    fn consume(&mut self, input: &[u8]) -> CoreResult<()> {
        for &byte in input {
            if ascii::is_token_char(byte) {
                if self.token.len() >= self.max_token_bytes {
                    return Err(CoreError::InsufficientCapacity);
                }
                self.token
                    .try_reserve(1)
                    .map_err(|_| CoreError::OutOfMemory)?;
                self.token.push(ascii::ascii_lower(byte));
            } else {
                self.emit_token()?;
            }
        }
        Ok(())
    }

    pub fn update(&mut self, input: &[u8]) -> CoreResult<()> {
        if self.failed || self.finished {
            return Err(CoreError::InvalidN);
        }
        let result = self.consume(input);
        if result.is_err() {
            self.failed = true;
        }
        result
    }

    pub fn finish(&mut self) -> CoreResult<[u64; 4]> {
        if self.failed {
            return Err(CoreError::InvalidN);
        }
        if !self.finished {
            if let Err(error) = self.emit_token() {
                self.failed = true;
                return Err(error);
            }
            self.finished = true;
        }
        Ok([
            self.tokens,
            self.vocabulary.len() as u64,
            self.tokens.saturating_sub(self.order as u64 - 1),
            self.grams.len() as u64,
        ])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_byte_boundary_matches_exact_batch() {
        let text = b"Hello WORLD! 'a' a A12\0abc\xffdef last";
        for order in 1..=8 {
            let expected = crate::freqdist::exact_ascii_metrics(text, order).unwrap();
            for size in 1..=text.len() {
                let mut stream = ExactMetricsStream::new(order, 100, 100, 100).unwrap();
                for chunk in text.chunks(size) {
                    stream.update(chunk).unwrap();
                }
                assert_eq!(stream.finish().unwrap(), expected);
                assert_eq!(stream.finish().unwrap(), expected);
                assert!(stream.update(b" ").is_err());
            }
        }
    }
    #[test]
    fn capacity_failure_poisons_partial_stream() {
        for (token_bytes, tokens, grams, text) in [
            (2, 10, 10, &b"long"[..]),
            (10, 1, 10, &b"a b "[..]),
            (10, 10, 1, &b"a b c "[..]),
        ] {
            let mut stream = ExactMetricsStream::new(2, token_bytes, tokens, grams).unwrap();
            assert!(stream.update(text).is_err());
            assert!(stream.finish().is_err());
            assert!(stream.update(b" ").is_err());
        }
        assert!(ExactMetricsStream::new(65, 10, 10, 10).is_err());
    }
}
