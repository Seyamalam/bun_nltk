const std = @import("std");

pub const LinearError = error{
    InvalidDimensions,
    InsufficientCapacity,
};

pub fn scoresSparseIds(
    doc_offsets: []const u32,
    feature_ids: []const u32,
    feature_values: []const f64,
    class_count: u32,
    feature_count: u32,
    weights: []const f64, // row-major [class_count * feature_count]
    bias: []const f64, // [class_count]
    out_scores: []f64, // row-major [doc_count * class_count]
) LinearError!void {
    if (class_count == 0) return error.InvalidDimensions;
    if (doc_offsets.len == 0) return error.InvalidDimensions;
    if (feature_ids.len != feature_values.len) return error.InsufficientCapacity;

    const docs = doc_offsets.len - 1;
    const classes = @as(usize, class_count);
    const features = @as(usize, feature_count);
    const expected_weights = classes * features;
    if (weights.len < expected_weights or bias.len < classes) return error.InsufficientCapacity;
    if (out_scores.len < docs * classes) return error.InsufficientCapacity;

    var doc_idx: usize = 0;
    while (doc_idx < docs) : (doc_idx += 1) {
        const start = @as(usize, doc_offsets[doc_idx]);
        const end = @as(usize, doc_offsets[doc_idx + 1]);
        if (start > end or end > feature_ids.len) return error.InsufficientCapacity;

        const out_base = doc_idx * classes;
        @memcpy(out_scores[out_base .. out_base + classes], bias[0..classes]);

        var nnz_idx: usize = start;
        while (nnz_idx < end) : (nnz_idx += 1) {
            const fid = @as(usize, feature_ids[nnz_idx]);
            if (fid >= features) continue;
            const value = feature_values[nnz_idx];

            var class_idx: usize = 0;
            while (class_idx < classes) : (class_idx += 1) {
                const weight = weights[class_idx * features + fid];
                out_scores[out_base + class_idx] += weight * value;
            }
        }
    }
}

test "scores sparse ids computes expected class logits" {
    const doc_offsets = [_]u32{ 0, 2, 3 };
    const feature_ids = [_]u32{ 0, 2, 1 };
    const feature_values = [_]f64{ 1.0, 2.0, 3.0 };
    // class 0 weights: [1, 0, 1], class 1 weights: [0, 2, 1]
    const weights = [_]f64{
        1.0, 0.0, 1.0,
        0.0, 2.0, 1.0,
    };
    const bias = [_]f64{ 0.5, -0.5 };
    var out = [_]f64{ 0.0, 0.0, 0.0, 0.0 };
    try scoresSparseIds(&doc_offsets, &feature_ids, &feature_values, 2, 3, &weights, &bias, &out);
    try std.testing.expectApproxEqAbs(@as(f64, 3.5), out[0], 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 1.5), out[1], 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 0.5), out[2], 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 5.5), out[3], 1e-12);
}
