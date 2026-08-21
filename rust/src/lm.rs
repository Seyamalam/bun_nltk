use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelType {
    Mle = 0,
    Lidstone = 1,
    KneserNeyInterpolated = 2,
}

struct Counts {
    unigram: HashMap<u32, u32>,
    bigram: HashMap<u64, u32>,
    trigram: HashMap<u128, u32>,

    followers1: HashMap<u32, u32>,
    followers2: HashMap<u64, u32>,
    continuation: HashMap<u32, u32>,

    seen_bigram_len: u64,
    unigram_total: u64,
    continuation_type_count: u64,
}

fn key_bigram(a: u32, b: u32) -> u64 {
    ((a as u64) << 32) | (b as u64)
}

fn key_trigram(a: u32, b: u32, c: u32) -> u128 {
    ((a as u128) << 64) | ((b as u128) << 32) | (c as u128)
}

fn build_counts(token_ids: &[u32], sentence_offsets: &[u32], order: u32) -> Counts {
    let mut counts = Counts {
        unigram: HashMap::new(),
        bigram: HashMap::new(),
        trigram: HashMap::new(),
        followers1: HashMap::new(),
        followers2: HashMap::new(),
        continuation: HashMap::new(),
        seen_bigram_len: 0,
        unigram_total: 0,
        continuation_type_count: 0,
    };

    // Dedup sets are only needed during construction; we track sizes for
    // continuation_type_count and use the follower/continuation maps' insert
    // semantics to mirror "first time this bigram is seen".
    let mut seen_bigram: std::collections::HashSet<u64> = std::collections::HashSet::new();
    let mut seen_trigram: std::collections::HashSet<u128> = std::collections::HashSet::new();

    let mut sent_idx: usize = 0;
    while sent_idx + 1 < sentence_offsets.len() {
        let start = sentence_offsets[sent_idx] as usize;
        let end = sentence_offsets[sent_idx + 1] as usize;
        sent_idx += 1;
        if end <= start || end > token_ids.len() {
            continue;
        }
        let sentence = &token_ids[start..end];

        for (i, &tok) in sentence.iter().enumerate() {
            *counts.unigram.entry(tok).or_insert(0) += 1;
            counts.unigram_total += 1;

            if order >= 2 && i >= 1 {
                let prev = sentence[i - 1];
                *counts.bigram.entry(key_bigram(prev, tok)).or_insert(0) += 1;

                let k = key_bigram(prev, tok);
                if seen_bigram.insert(k) {
                    *counts.followers1.entry(prev).or_insert(0) += 1;
                    *counts.continuation.entry(tok).or_insert(0) += 1;
                }
            }
            if order >= 3 && i >= 2 {
                let a = sentence[i - 2];
                let b = sentence[i - 1];
                *counts.trigram.entry(key_trigram(a, b, tok)).or_insert(0) += 1;

                let trigram_k = key_trigram(a, b, tok);
                if seen_trigram.insert(trigram_k) {
                    let context_k = key_bigram(a, b);
                    *counts.followers2.entry(context_k).or_insert(0) += 1;
                }
            }
        }
    }

    counts.seen_bigram_len = seen_bigram.len() as u64;
    counts.continuation_type_count = counts.seen_bigram_len;
    counts
}

fn count_context(counts: &Counts, ctx: &[u32]) -> u32 {
    match ctx.len() {
        0 => {
            if counts.unigram_total > u32::MAX as u64 {
                u32::MAX
            } else {
                counts.unigram_total as u32
            }
        }
        1 => counts.unigram.get(&ctx[0]).copied().unwrap_or(0),
        2 => counts.bigram.get(&key_bigram(ctx[0], ctx[1])).copied().unwrap_or(0),
        _ => 0,
    }
}

fn ngram_count(counts: &Counts, ctx: &[u32], word: u32) -> u32 {
    match ctx.len() {
        0 => counts.unigram.get(&word).copied().unwrap_or(0),
        1 => counts.bigram.get(&key_bigram(ctx[0], word)).copied().unwrap_or(0),
        2 => counts
            .trigram
            .get(&key_trigram(ctx[0], ctx[1], word))
            .copied()
            .unwrap_or(0),
        _ => 0,
    }
}

fn follower_count(counts: &Counts, ctx: &[u32]) -> u32 {
    match ctx.len() {
        1 => counts.followers1.get(&ctx[0]).copied().unwrap_or(0),
        2 => counts.followers2.get(&key_bigram(ctx[0], ctx[1])).copied().unwrap_or(0),
        _ => 0,
    }
}

fn backoff_tail(ctx: &[u32]) -> &[u32] {
    if ctx.is_empty() {
        return ctx;
    }
    &ctx[1..]
}

fn score_mle(counts: &Counts, word: u32, ctx: &[u32]) -> f64 {
    if ctx.is_empty() {
        if counts.unigram_total == 0 {
            return 0.0;
        }
        return (ngram_count(counts, ctx, word) as f64) / (counts.unigram_total as f64);
    }
    let ctx_count = count_context(counts, ctx);
    if ctx_count == 0 {
        return score_mle(counts, word, backoff_tail(ctx));
    }
    let gram_count = ngram_count(counts, ctx, word);
    (gram_count as f64) / (ctx_count as f64)
}

fn score_lidstone(counts: &Counts, word: u32, ctx: &[u32], gamma: f64, vocab_size: u32) -> f64 {
    let vocab_f = 1u32.max(vocab_size) as f64;
    if ctx.is_empty() {
        let gram = ngram_count(counts, ctx, word) as f64;
        let denom = (counts.unigram_total as f64) + gamma * vocab_f;
        if denom <= 0.0 {
            return 0.0;
        }
        return (gram + gamma) / denom;
    }
    let ctx_count = count_context(counts, ctx);
    if ctx_count == 0 {
        return score_lidstone(counts, word, backoff_tail(ctx), gamma, vocab_size);
    }
    let gram_count = ngram_count(counts, ctx, word) as f64;
    let denom = (ctx_count as f64) + gamma * vocab_f;
    if denom <= 0.0 {
        return 0.0;
    }
    (gram_count + gamma) / denom
}

fn continuation_prob(counts: &Counts, word: u32) -> f64 {
    if counts.continuation_type_count == 0 {
        return 0.0;
    }
    let cont = counts.continuation.get(&word).copied().unwrap_or(0);
    if cont == 0 {
        return 1.0 / ((counts.continuation_type_count as f64) * 10.0);
    }
    (cont as f64) / (counts.continuation_type_count as f64)
}

fn score_kneser_ney(counts: &Counts, word: u32, ctx: &[u32], discount: f64) -> f64 {
    if ctx.is_empty() {
        return continuation_prob(counts, word);
    }

    let ctx_count = count_context(counts, ctx);
    if ctx_count == 0 {
        return score_kneser_ney(counts, word, backoff_tail(ctx), discount);
    }

    let gram_count = ngram_count(counts, ctx, word);
    let followers = follower_count(counts, ctx);

    let ctx_f = ctx_count as f64;
    let discounted = (((gram_count as f64) - discount).max(0.0)) / ctx_f;
    let lambda = (discount * (followers as f64)) / ctx_f;
    discounted + lambda * score_kneser_ney(counts, word, backoff_tail(ctx), discount)
}

fn score_word(
    counts: &Counts,
    word: u32,
    context: &[u32],
    order: u32,
    model: ModelType,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
) -> f64 {
    let keep_len = (order.saturating_sub(1)) as usize;
    let keep: &[u32] = if context.len() > keep_len {
        &context[context.len() - keep_len..]
    } else {
        context
    };
    match model {
        ModelType::Mle => score_mle(counts, word, keep),
        ModelType::Lidstone => score_lidstone(counts, word, keep, gamma, vocab_size),
        ModelType::KneserNeyInterpolated => score_kneser_ney(counts, word, keep, discount),
    }
}

pub fn eval_ids(
    token_ids: &[u32],
    sentence_offsets: &[u32],
    order: u32,
    model: ModelType,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
    probe_context_flat: &[u32],
    probe_context_lens: &[u32],
    probe_words: &[u32],
    out_scores: &mut [f64],
    perplexity_tokens: &[u32],
    prefix_tokens: &[u32],
) -> f64 {
    let counts = build_counts(token_ids, sentence_offsets, order);

    let mut ctx_cursor: usize = 0;
    let probe_count = probe_context_lens
        .len()
        .min(probe_words.len())
        .min(out_scores.len());
    for i in 0..probe_count {
        let ctx_len = probe_context_lens[i] as usize;
        if ctx_cursor + ctx_len > probe_context_flat.len() {
            out_scores[i] = 0.0;
            continue;
        }
        let ctx = &probe_context_flat[ctx_cursor..ctx_cursor + ctx_len];
        ctx_cursor += ctx_len;
        out_scores[i] = score_word(
            &counts,
            probe_words[i],
            ctx,
            order,
            model,
            gamma,
            discount,
            vocab_size,
        );
    }

    if perplexity_tokens.is_empty() {
        return f64::INFINITY;
    }
    let mut history: Vec<u32> = prefix_tokens.to_vec();

    let mut neg_log2: f64 = 0.0;
    for &tok in perplexity_tokens {
        let keep_len = history.len().min((order.saturating_sub(1)) as usize);
        let ctx: &[u32] = if keep_len == 0 {
            &history[0..0]
        } else {
            &history[history.len() - keep_len..]
        };
        let mut prob = score_word(&counts, tok, ctx, order, model, gamma, discount, vocab_size);
        if !prob.is_finite() || prob <= 0.0 {
            prob = 1e-12;
        }
        neg_log2 += -prob.log2();
        history.push(tok);
    }

    2f64.powf(neg_log2 / (perplexity_tokens.len() as f64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lm_eval_ids_basic_parity_sanity() {
        let tokens: [u32; 8] = [1, 2, 3, 4, 1, 2, 5, 4];
        let offsets: [u32; 3] = [0, 4, 8];
        let probe_ctx: [u32; 4] = [1, 2, 1, 2];
        let probe_lens: [u32; 2] = [2, 2];
        let probe_words: [u32; 2] = [3, 5];
        let mut out = [0f64; 2];
        let perplexity_tokens: [u32; 4] = [1, 2, 3, 4];
        let prefix: [u32; 2] = [0, 0];

        let ppl = eval_ids(
            &tokens,
            &offsets,
            3,
            ModelType::KneserNeyInterpolated,
            0.1,
            0.75,
            6,
            &probe_ctx,
            &probe_lens,
            &probe_words,
            &mut out,
            &perplexity_tokens,
            &prefix,
        );
        assert!(out[0] > 0.0);
        assert!(out[1] > 0.0);
        assert!(ppl.is_finite());
    }
}
