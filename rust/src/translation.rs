//! Batched BLEU/NIST sufficient statistics over token-ID streams.
//!
//! Mirrors `nltk.translate.bleu_score` and `nltk.translate.nist_score`
//! semantics at the modified-precision/n-gram-statistics level so the JS
//! layer can reproduce exact NLTK scores from the returned accumulators.

use std::collections::HashMap;

/// Collision-free n-gram key: `[order, t1, t2, ..., tn]` (unused lanes = 0).
/// A u128 has only four 32-bit lanes, so order + 5 tokens cannot fit — an
/// array key is exact, fixed-size, and gets a fast derived Hash/Eq.
pub type NgramKey = [u32; 6];

fn pack_ngram(ids: &[u32]) -> NgramKey {
    let mut key = [0u32; 6];
    key[0] = ids.len() as u32;
    for (i, &id) in ids.iter().enumerate() {
        key[i + 1] = id;
    }
    key
}

fn ngram_order(key: &NgramKey) -> usize {
    key[0] as usize
}

/// The (n-1)-gram prefix key: drop the last token lane, decrement order.
fn drop_last(key: &NgramKey) -> NgramKey {
    let mut m = [0u32; 6];
    m[0] = key[0] - 1;
    m[1..key[0] as usize].copy_from_slice(&key[1..key[0] as usize]);
    m
}

fn log2(x: f64) -> f64 {
    x.ln() / std::f64::consts::LN_2
}

/// Accumulated corpus statistics for BLEU (modified precision, closest ref len).
pub struct BleuAccumulator {
    clipped: [u64; 5],
    totals: [u64; 5],
    ref_len: u64,
    hyp_len: u64,
    max_order: usize,
}

impl BleuAccumulator {
    pub fn new(max_order: usize) -> Self {
        BleuAccumulator {
            clipped: [0; 5],
            totals: [0; 5],
            ref_len: 0,
            hyp_len: 0,
            max_order: max_order.min(5),
        }
    }

    pub fn add_sentence(&mut self, references: &[&[u32]], hypothesis: &[u32]) {
        for order in 1..=self.max_order {
            if hypothesis.len() < order {
                // NLTK's modified_precision returns Fraction(0, 1) for short
                // hypotheses: zero numerator, ONE denominator.
                self.totals[order - 1] += 1;
                continue;
            }
            let mut hyp_counts: HashMap<NgramKey, u32> = HashMap::new();
            for window in hypothesis.windows(order) {
                *hyp_counts.entry(pack_ngram(window)).or_insert(0) += 1;
            }

            // NLTK modified_precision: max_counts[ngram] = max over refs of
            // ref count; clipped = min(hyp_count, max_counts).
            let mut max_counts: HashMap<NgramKey, u32> = HashMap::new();
            for reference in references {
                let mut ref_counts: HashMap<NgramKey, u32> = HashMap::new();
                if reference.len() >= order {
                    for window in reference.windows(order) {
                        *ref_counts.entry(pack_ngram(window)).or_insert(0) += 1;
                    }
                }
                for ngram in hyp_counts.keys() {
                    let rc = ref_counts.get(ngram).copied().unwrap_or(0);
                    let slot = max_counts.entry(*ngram).or_insert(0);
                    if rc > *slot {
                        *slot = rc;
                    }
                }
            }

            let mut clipped_total: u64 = 0;
            for (ngram, &count) in &hyp_counts {
                clipped_total += count.min(max_counts.get(ngram).copied().unwrap_or(0)) as u64;
            }
            self.clipped[order - 1] += clipped_total;
            self.totals[order - 1] += (hypothesis.len() - order + 1) as u64;
        }

        self.hyp_len += hypothesis.len() as u64;

        // NLTK closest_ref_length: min |len(ref)-len(hyp)|; ties -> smallest ref.
        let hyp_len = hypothesis.len() as i64;
        let mut closest: u32 = 0;
        let mut best_diff = i64::MAX;
        for reference in references {
            let diff = (reference.len() as i64 - hyp_len).abs();
            if diff < best_diff
                || (diff == best_diff && reference.len() < closest as usize)
            {
                best_diff = diff;
                closest = reference.len() as u32;
            }
        }
        self.ref_len += closest as u64;
    }

    /// Returns (clipped[5], totals[5], ref_len, hyp_len).
    pub fn finish(&self) -> ([u64; 5], [u64; 5], u64, u64) {
        (self.clipped, self.totals, self.ref_len, self.hyp_len)
    }
}

/// NIST information weights + accumulation, mirroring
/// `nltk.translate.nist_score.corpus_nist`.
pub struct NistAccumulator {
    n: usize,
    ngram_freq: HashMap<NgramKey, u64>,
    total_reference_words: u64,
    numerator_per_order: [f64; 5],
    denominator_per_order: [u64; 5],
    l_ref: u64,
    l_sys: u64,
    weights_ready: bool,
    information_weights: HashMap<NgramKey, f64>,
}

impl NistAccumulator {
    pub fn new(n: usize) -> Self {
        NistAccumulator {
            n: n.min(5),
            ngram_freq: HashMap::new(),
            total_reference_words: 0,
            numerator_per_order: [0.0; 5],
            denominator_per_order: [0; 5],
            l_ref: 0,
            l_sys: 0,
            weights_ready: false,
            information_weights: HashMap::new(),
        }
    }

    /// Phase 1: accumulate reference n-gram frequencies. Call for every
    /// reference sentence before any add_hypothesis.
    pub fn add_reference(&mut self, reference: &[u32]) {
        for order in 1..=self.n {
            if reference.len() < order {
                continue;
            }
            for window in reference.windows(order) {
                *self.ngram_freq.entry(pack_ngram(window)).or_insert(0) += 1;
            }
        }
        self.total_reference_words += reference.len() as u64;
        self.weights_ready = false;
    }

    fn ensure_weights(&mut self) {
        if self.weights_ready {
            return;
        }
        self.information_weights.clear();
        for (&ngram, &freq) in &self.ngram_freq {
            let order = ngram_order(&ngram);
            let info = if order == 1 {
                log2(self.total_reference_words as f64 / freq as f64)
            } else {
                let mgram = drop_last(&ngram);
                match self.ngram_freq.get(&mgram) {
                    Some(&m_freq) => log2(m_freq as f64 / freq as f64),
                    None => log2(self.total_reference_words as f64 / freq as f64),
                }
            };
            self.information_weights.insert(ngram, info);
        }
        self.weights_ready = true;
    }

    /// Phase 2: accumulate hypothesis statistics. All add_reference calls must
    /// have completed first.
    pub fn add_hypothesis(&mut self, references: &[&[u32]], hypothesis: &[u32]) {
        self.ensure_weights();

        for order in 1..=self.n {
            // NLTK picks the max by tuple (precision, numerator, denominator, ref_len).
            let mut best: (f64, f64, u64, u32) = (f64::NEG_INFINITY, 0.0, 0, 0);

            for reference in references {
                let ref_len = reference.len() as u32;
                let hyp_counts = if hypothesis.len() >= order {
                    let mut m: HashMap<NgramKey, u32> = HashMap::new();
                    for window in hypothesis.windows(order) {
                        *m.entry(pack_ngram(window)).or_insert(0) += 1;
                    }
                    m
                } else {
                    HashMap::new()
                };
                let ref_counts = if reference.len() >= order {
                    let mut m: HashMap<NgramKey, u32> = HashMap::new();
                    for window in reference.windows(order) {
                        *m.entry(pack_ngram(window)).or_insert(0) += 1;
                    }
                    m
                } else {
                    HashMap::new()
                };

                let mut numerator = 0.0f64;
                for (&key, &count) in &hyp_counts {
                    if let Some(&ref_count) = ref_counts.get(&key) {
                        let weight = self.information_weights.get(&key).copied().unwrap_or(0.0);
                        numerator += weight * count.min(ref_count) as f64;
                    }
                }
                let denominator: u64 = hyp_counts.values().map(|&c| c as u64).sum();
                let precision = if denominator == 0 {
                    0.0
                } else {
                    numerator / denominator as f64
                };

                if precision > best.0
                    || (precision == best.0 && numerator > best.1)
                    || (precision == best.0 && numerator == best.1 && denominator > best.2)
                    || (precision == best.0
                        && numerator == best.1
                        && denominator == best.2
                        && ref_len > best.3)
                {
                    best = (precision, numerator, denominator, ref_len);
                }
            }

            self.numerator_per_order[order - 1] += best.1;
            self.denominator_per_order[order - 1] += best.2;
            self.l_ref += best.3 as u64;
            self.l_sys += hypothesis.len() as u64;
        }
    }

    /// Returns (numerators[5], denominators[5], l_ref, l_sys).
    pub fn finish(&self) -> ([f64; 5], [u64; 5], u64, u64) {
        (
            self.numerator_per_order,
            self.denominator_per_order,
            self.l_ref,
            self.l_sys,
        )
    }
}
