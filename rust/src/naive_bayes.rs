pub fn log_scores(
    doc_token_ids: &[u32],
    vocab_size: u32,
    token_counts_matrix: &[u32], // row-major [label_count * vocab_size]
    label_doc_counts: &[u32],
    label_token_totals: &[u32],
    total_docs: u32,
    smoothing: f64,
    out_scores: &mut [f64],
) {
    if vocab_size == 0 || label_doc_counts.is_empty() {
        out_scores.fill(f64::NEG_INFINITY);
        return;
    }
    let label_count = label_doc_counts.len();
    if label_token_totals.len() < label_count || out_scores.len() < label_count {
        out_scores.fill(f64::NEG_INFINITY);
        return;
    }
    let matrix_needed = (vocab_size as usize) * label_count;
    if token_counts_matrix.len() < matrix_needed {
        out_scores.fill(f64::NEG_INFINITY);
        return;
    }

    let smooth = if smoothing.is_finite() && smoothing > 0.0 {
        smoothing
    } else {
        1.0
    };
    let docs_f = 1u32.max(total_docs) as f64;
    let labels_f = label_count as u32 as f64;
    let vocab_f = vocab_size as f64;

    for (label_idx, &doc_count) in label_doc_counts.iter().enumerate() {
        let mut score = (((doc_count as f64) + smooth) / (docs_f + smooth * labels_f)).ln();
        let denom = (label_token_totals[label_idx] as f64) + smooth * vocab_f;
        let row_start = label_idx * (vocab_size as usize);
        for &tok in doc_token_ids {
            if tok >= vocab_size {
                continue;
            }
            let idx = row_start + tok as usize;
            let count = token_counts_matrix[idx];
            score += (((count as f64) + smooth) / denom).ln();
        }
        out_scores[label_idx] = score;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn naive_bayes_log_scores_prefers_positive_label() {
        // labels: pos=0, neg=1
        // vocab: good=0, bad=1, fast=2
        let doc: [u32; 2] = [0, 2];
        let matrix: [u32; 6] = [10, 1, 8, 1, 10, 1];
        let label_docs: [u32; 2] = [5, 5];
        let label_totals: [u32; 2] = [19, 12];
        let mut scores = [0f64; 2];
        log_scores(&doc, 3, &matrix, &label_docs, &label_totals, 10, 1.0, &mut scores);
        assert!(scores[0] > scores[1]);
    }
}
