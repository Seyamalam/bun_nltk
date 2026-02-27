const std = @import("std");

pub fn logScores(
    doc_token_ids: []const u32,
    vocab_size: u32,
    token_counts_matrix: []const u32, // row-major [label_count * vocab_size]
    label_doc_counts: []const u32,
    label_token_totals: []const u32,
    total_docs: u32,
    smoothing: f64,
    out_scores: []f64,
) void {
    if (vocab_size == 0 or label_doc_counts.len == 0) {
        @memset(out_scores, -std.math.inf(f64));
        return;
    }
    const label_count = label_doc_counts.len;
    if (label_token_totals.len < label_count or out_scores.len < label_count) {
        @memset(out_scores, -std.math.inf(f64));
        return;
    }
    const matrix_needed = @as(usize, vocab_size) * label_count;
    if (token_counts_matrix.len < matrix_needed) {
        @memset(out_scores, -std.math.inf(f64));
        return;
    }

    const smooth = if (std.math.isFinite(smoothing) and smoothing > 0) smoothing else 1.0;
    const docs_f = @as(f64, @floatFromInt(@max(total_docs, @as(u32, 1))));
    const labels_f = @as(f64, @floatFromInt(@as(u32, @intCast(label_count))));
    const vocab_f = @as(f64, @floatFromInt(vocab_size));

    var label_idx: usize = 0;
    while (label_idx < label_count) : (label_idx += 1) {
        const doc_count = label_doc_counts[label_idx];
        var score = std.math.log(
            f64,
            std.math.e,
            (@as(f64, @floatFromInt(doc_count)) + smooth) / (docs_f + smooth * labels_f),
        );
        const denom = @as(f64, @floatFromInt(label_token_totals[label_idx])) + smooth * vocab_f;
        const row_start = label_idx * @as(usize, vocab_size);
        for (doc_token_ids) |tok| {
            if (tok >= vocab_size) continue;
            const idx = row_start + @as(usize, tok);
            const count = token_counts_matrix[idx];
            score += std.math.log(f64, std.math.e, (@as(f64, @floatFromInt(count)) + smooth) / denom);
        }
        out_scores[label_idx] = score;
    }
}

test "naive bayes log scores prefers positive label" {
    // labels: pos=0, neg=1
    // vocab: good=0, bad=1, fast=2
    const doc = [_]u32{ 0, 2 };
    const matrix = [_]u32{
        // pos row
        10, 1, 8,
        // neg row
        1, 10, 1,
    };
    const label_docs = [_]u32{ 5, 5 };
    const label_totals = [_]u32{ 19, 12 };
    var scores = [_]f64{ 0, 0 };
    logScores(&doc, 3, &matrix, &label_docs, &label_totals, 10, 1.0, &scores);
    try std.testing.expect(scores[0] > scores[1]);
}
