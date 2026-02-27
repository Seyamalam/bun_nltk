const std = @import("std");

pub const PerceptronError = error{
    InvalidDimensions,
    OutOfMemory,
    InsufficientCapacity,
};

pub fn predictBatch(
    feature_ids: []const u32,
    token_offsets: []const u32,
    weights: []const f32,
    model_feature_count: u32,
    tag_count: u32,
    out_tag_ids: []u16,
    allocator: std.mem.Allocator,
) PerceptronError!void {
    if (tag_count == 0) return error.InvalidDimensions;
    if (token_offsets.len == 0) return;

    const token_count = token_offsets.len - 1;
    if (out_tag_ids.len < token_count) return error.InsufficientCapacity;

    const expected_weights = @as(usize, model_feature_count) * @as(usize, tag_count);
    if (weights.len < expected_weights) return error.InsufficientCapacity;

    const scores = allocator.alloc(f32, @as(usize, tag_count)) catch return error.OutOfMemory;
    defer allocator.free(scores);

    for (0..token_count) |token_idx| {
        @memset(scores, 0);
        const start = token_offsets[token_idx];
        const end = token_offsets[token_idx + 1];

        if (start > end or end > feature_ids.len) return error.InsufficientCapacity;

        for (@as(usize, start)..@as(usize, end)) |feature_idx| {
            const feature_id = feature_ids[feature_idx];
            if (feature_id >= model_feature_count) continue;

            const base = @as(usize, feature_id) * @as(usize, tag_count);
            for (0..@as(usize, tag_count)) |tag_idx| {
                scores[tag_idx] += weights[base + tag_idx];
            }
        }

        var best_id: u16 = 0;
        var best_score: f32 = scores[0];
        for (1..@as(usize, tag_count)) |tag_idx| {
            if (scores[tag_idx] > best_score) {
                best_score = scores[tag_idx];
                best_id = @as(u16, @intCast(tag_idx));
            }
        }

        out_tag_ids[token_idx] = best_id;
    }
}

test "predict batch basic case" {
    const allocator = std.testing.allocator;
    const feature_ids = [_]u32{ 0, 1, 1 };
    const token_offsets = [_]u32{ 0, 1, 3 };
    const weights = [_]f32{
        1.0, 0.0,
        0.0, 1.0,
    };
    var out = [_]u16{ 0, 0 };

    try predictBatch(&feature_ids, &token_offsets, &weights, 2, 2, &out, allocator);
    try std.testing.expectEqual(@as(u16, 0), out[0]);
    try std.testing.expectEqual(@as(u16, 1), out[1]);
}
