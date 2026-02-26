const std = @import("std");
const ascii = @import("ascii.zig");
const freqdist = @import("freqdist.zig");
const token_ids = @import("token_ids.zig");
const types = @import("types.zig");

pub fn packBigramKey(left: u64, right: u64) u128 {
    return (@as(u128, left) << 64) | @as(u128, right);
}

pub fn unpackBigramLeft(key: u128) u64 {
    return @as(u64, @truncate(key >> 64));
}

pub fn unpackBigramRight(key: u128) u64 {
    return @as(u64, @truncate(key & std.math.maxInt(u64)));
}

const BigramBuildResult = struct {
    token_total: u64,
    word_map: std.AutoHashMap(u64, u64),
    bigram_map: std.AutoHashMap(u128, u64),
};

fn buildBigramStatsAscii(input: []const u8, allocator: std.mem.Allocator) types.CountError!BigramBuildResult {
    var word_map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer word_map.deinit();

    var bigram_map = std.AutoHashMap(u128, u64).init(allocator);
    errdefer bigram_map.deinit();

    var in_token = false;
    var token_hash: u64 = ascii.FNV_OFFSET_BASIS;
    var token_total: u64 = 0;
    var prev_hash: ?u64 = null;

    for (input) |ch| {
        if (ascii.isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_hash = ascii.FNV_OFFSET_BASIS;
            }
            token_hash = ascii.tokenHashUpdate(token_hash, ch);
        } else if (in_token) {
            try freqdist.updateCount(&word_map, token_hash);
            if (prev_hash) |prev| {
                try freqdist.updateCountU128(&bigram_map, packBigramKey(prev, token_hash));
            }
            prev_hash = token_hash;
            token_total += 1;
            in_token = false;
        }
    }

    if (in_token) {
        try freqdist.updateCount(&word_map, token_hash);
        if (prev_hash) |prev| {
            try freqdist.updateCountU128(&bigram_map, packBigramKey(prev, token_hash));
        }
        token_total += 1;
    }

    return .{ .token_total = token_total, .word_map = word_map, .bigram_map = bigram_map };
}

fn buildWindowedBigramStatsAscii(input: []const u8, window_size: usize, allocator: std.mem.Allocator) types.CountError!BigramBuildResult {
    if (window_size < 2) return error.InvalidN;

    const token_hashes = try ascii.collectTokenHashesAscii(input, allocator);
    defer allocator.free(token_hashes);

    var word_map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer word_map.deinit();
    for (token_hashes) |token_hash| {
        try freqdist.updateCount(&word_map, token_hash);
    }

    var bigram_map = std.AutoHashMap(u128, u64).init(allocator);
    errdefer bigram_map.deinit();

    for (token_hashes, 0..) |left_hash, i| {
        const end = @min(token_hashes.len, i + window_size);
        var j = i + 1;
        while (j < end) : (j += 1) {
            try freqdist.updateCountU128(&bigram_map, packBigramKey(left_hash, token_hashes[j]));
        }
    }

    return .{ .token_total = @as(u64, token_hashes.len), .word_map = word_map, .bigram_map = bigram_map };
}

const PmiEntry = struct {
    key: u128,
    score: f64,
};

fn pmiEntryBetter(a: PmiEntry, b: PmiEntry) bool {
    if (a.score > b.score) return true;
    if (a.score < b.score) return false;
    return a.key < b.key;
}

fn pmiEntryWorse(a: PmiEntry, b: PmiEntry) bool {
    if (a.score < b.score) return true;
    if (a.score > b.score) return false;
    return a.key > b.key;
}

fn worstEntryIndex(entries: []const PmiEntry) usize {
    var worst_idx: usize = 0;
    for (1..entries.len) |i| {
        if (pmiEntryWorse(entries[i], entries[worst_idx])) worst_idx = i;
    }
    return worst_idx;
}

fn sortPmiEntriesDesc(entries: []PmiEntry) void {
    if (entries.len <= 1) return;

    var i: usize = 1;
    while (i < entries.len) : (i += 1) {
        var j: usize = i;
        while (j > 0 and pmiEntryBetter(entries[j], entries[j - 1])) : (j -= 1) {
            const tmp = entries[j - 1];
            entries[j - 1] = entries[j];
            entries[j] = tmp;
        }
    }
}

pub fn fillTopPmiBigramsAscii(
    input: []const u8,
    window_size: usize,
    top_k: usize,
    out_left_hashes: []u64,
    out_right_hashes: []u64,
    out_scores: []f64,
    allocator: std.mem.Allocator,
) types.CountError!u64 {
    if (top_k == 0 or input.len == 0) return 0;
    if (window_size < 2) return error.InvalidN;
    if (out_left_hashes.len != out_right_hashes.len or out_left_hashes.len != out_scores.len) {
        return error.InsufficientCapacity;
    }
    if (out_left_hashes.len == 0) return error.InsufficientCapacity;

    var stats = if (window_size == 2)
        try buildBigramStatsAscii(input, allocator)
    else
        try buildWindowedBigramStatsAscii(input, window_size, allocator);
    defer stats.word_map.deinit();
    defer stats.bigram_map.deinit();

    if (stats.token_total < 2 or stats.bigram_map.count() == 0) return 0;

    const target = @min(top_k, out_left_hashes.len);
    const best = allocator.alloc(PmiEntry, target) catch return error.OutOfMemory;
    defer allocator.free(best);
    var best_len: usize = 0;

    var iter = stats.bigram_map.iterator();
    while (iter.next()) |entry| {
        const key = entry.key_ptr.*;
        const left = unpackBigramLeft(key);
        const right = unpackBigramRight(key);

        const left_count = stats.word_map.get(left) orelse continue;
        const right_count = stats.word_map.get(right) orelse continue;
        if (left_count == 0 or right_count == 0) continue;

        const count_bigram = entry.value_ptr.*;
        const window_norm = @as(f64, @floatFromInt(window_size - 1));
        const numerator = (@as(f64, @floatFromInt(count_bigram)) * @as(f64, @floatFromInt(stats.token_total))) / window_norm;
        const denominator = @as(f64, @floatFromInt(left_count)) * @as(f64, @floatFromInt(right_count));
        const score = std.math.log2(numerator / denominator);
        const cand: PmiEntry = .{ .key = key, .score = score };

        if (best_len < target) {
            best[best_len] = cand;
            best_len += 1;
        } else {
            const idx = worstEntryIndex(best[0..best_len]);
            if (pmiEntryBetter(cand, best[idx])) best[idx] = cand;
        }
    }

    const best_slice = best[0..best_len];
    sortPmiEntriesDesc(best_slice);

    for (best_slice, 0..) |item, i| {
        out_left_hashes[i] = unpackBigramLeft(item.key);
        out_right_hashes[i] = unpackBigramRight(item.key);
        out_scores[i] = item.score;
    }

    return @as(u64, best_len);
}

fn packBigramIdKey(left_id: u32, right_id: u32) u64 {
    return (@as(u64, left_id) << 32) | @as(u64, right_id);
}

fn unpackBigramLeftId(key: u64) u32 {
    return @as(u32, @truncate(key >> 32));
}

fn unpackBigramRightId(key: u64) u32 {
    return @as(u32, @truncate(key & std.math.maxInt(u32)));
}

const IdBigramEntry = struct {
    key: u64,
    count: u64,
    pmi: f64,
};

fn idBigramEntryLess(a: IdBigramEntry, b: IdBigramEntry) bool {
    return a.key < b.key;
}

fn sortIdBigramEntries(entries: []IdBigramEntry) void {
    if (entries.len <= 1) return;

    var i: usize = 1;
    while (i < entries.len) : (i += 1) {
        var j: usize = i;
        while (j > 0 and idBigramEntryLess(entries[j], entries[j - 1])) : (j -= 1) {
            const tmp = entries[j - 1];
            entries[j - 1] = entries[j];
            entries[j] = tmp;
        }
    }
}

fn buildBigramIdCountMap(
    token_id_sequence: []const u32,
    window_size: usize,
    allocator: std.mem.Allocator,
) types.CountError!std.AutoHashMap(u64, u64) {
    if (window_size < 2) return error.InvalidN;

    var map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer map.deinit();

    for (token_id_sequence, 0..) |left_id, i| {
        const end = @min(token_id_sequence.len, i + window_size);
        var j = i + 1;
        while (j < end) : (j += 1) {
            const right_id = token_id_sequence[j];
            const key = packBigramIdKey(left_id, right_id);
            try freqdist.updateCount(&map, key);
        }
    }

    return map;
}

pub fn countUniqueBigramsWindowIdsAscii(
    input: []const u8,
    window_size: usize,
    allocator: std.mem.Allocator,
) types.CountError!u64 {
    if (window_size < 2) return error.InvalidN;

    var ids = try token_ids.buildTokenIdDataAscii(input, allocator);
    defer ids.deinit();
    if (ids.token_ids.items.len < 2) return 0;

    var map = try buildBigramIdCountMap(ids.token_ids.items, window_size, allocator);
    defer map.deinit();

    return @as(u64, map.count());
}

pub fn fillBigramWindowStatsIdsAscii(
    input: []const u8,
    window_size: usize,
    out_left_ids: []u32,
    out_right_ids: []u32,
    out_counts: []u64,
    out_pmis: []f64,
    allocator: std.mem.Allocator,
) types.CountError!u64 {
    if (window_size < 2) return error.InvalidN;
    if (out_left_ids.len != out_right_ids.len or out_left_ids.len != out_counts.len or out_left_ids.len != out_pmis.len) {
        return error.InsufficientCapacity;
    }

    var ids = try token_ids.buildTokenIdDataAscii(input, allocator);
    defer ids.deinit();
    if (ids.token_ids.items.len < 2) return 0;

    var bigram_counts = try buildBigramIdCountMap(ids.token_ids.items, window_size, allocator);
    defer bigram_counts.deinit();

    const unique = bigram_counts.count();
    if (out_left_ids.len < unique) return error.InsufficientCapacity;

    const entries = allocator.alloc(IdBigramEntry, unique) catch return error.OutOfMemory;
    defer allocator.free(entries);

    var idx: usize = 0;
    var iter = bigram_counts.iterator();
    while (iter.next()) |entry| {
        const key = entry.key_ptr.*;
        const count = entry.value_ptr.*;
        const left_id = unpackBigramLeftId(key);
        const right_id = unpackBigramRightId(key);

        const left_count = ids.token_counts.items[left_id];
        const right_count = ids.token_counts.items[right_id];
        const numerator = @as(f64, @floatFromInt(count)) * @as(f64, @floatFromInt(ids.token_ids.items.len));
        const denominator = @as(f64, @floatFromInt(left_count)) * @as(f64, @floatFromInt(right_count)) * @as(f64, @floatFromInt(window_size - 1));

        entries[idx] = .{
            .key = key,
            .count = count,
            .pmi = std.math.log2(numerator / denominator),
        };
        idx += 1;
    }

    sortIdBigramEntries(entries);

    for (entries, 0..) |row, i| {
        out_left_ids[i] = unpackBigramLeftId(row.key);
        out_right_ids[i] = unpackBigramRightId(row.key);
        out_counts[i] = row.count;
        out_pmis[i] = row.pmi;
    }

    return @as(u64, unique);
}

fn findScore(left_hashes: []const u64, right_hashes: []const u64, scores: []const f64, left: u64, right: u64) ?f64 {
    for (left_hashes, 0..) |lh, i| {
        if (lh == left and right_hashes[i] == right) return scores[i];
    }
    return null;
}

test "top pmi bigrams repeated sentence" {
    const input = "this this is is a a test test";
    var left = [_]u64{0} ** 3;
    var right = [_]u64{0} ** 3;
    var scores = [_]f64{0} ** 3;

    const written = try fillTopPmiBigramsAscii(input, 2, 3, &left, &right, &scores, std.testing.allocator);
    try std.testing.expectEqual(@as(u64, 3), written);
    for (scores[0..@as(usize, @intCast(written))]) |score| {
        try std.testing.expectApproxEqAbs(@as(f64, 1.0), score, 1e-12);
    }
}

test "windowed top pmi matches NLTK sample scores" {
    const input = "this this is is a a test test";

    var hash_this = ascii.FNV_OFFSET_BASIS;
    for ("this") |ch| hash_this = ascii.tokenHashUpdate(hash_this, ch);
    var hash_is = ascii.FNV_OFFSET_BASIS;
    for ("is") |ch| hash_is = ascii.tokenHashUpdate(hash_is, ch);
    var hash_a = ascii.FNV_OFFSET_BASIS;
    for ("a") |ch| hash_a = ascii.tokenHashUpdate(hash_a, ch);
    var hash_test = ascii.FNV_OFFSET_BASIS;
    for ("test") |ch| hash_test = ascii.tokenHashUpdate(hash_test, ch);

    var left3 = [_]u64{0} ** 16;
    var right3 = [_]u64{0} ** 16;
    var scores3 = [_]f64{0} ** 16;
    const written3 = try fillTopPmiBigramsAscii(input, 3, 16, &left3, &right3, &scores3, std.testing.allocator);
    try std.testing.expectEqual(@as(u64, 7), written3);

    const score_this_is_w3 = findScore(left3[0..@intCast(written3)], right3[0..@intCast(written3)], scores3[0..@intCast(written3)], hash_this, hash_is) orelse return error.TestUnexpectedResult;
    const score_is_a_w3 = findScore(left3[0..@intCast(written3)], right3[0..@intCast(written3)], scores3[0..@intCast(written3)], hash_is, hash_a) orelse return error.TestUnexpectedResult;
    const score_a_test_w3 = findScore(left3[0..@intCast(written3)], right3[0..@intCast(written3)], scores3[0..@intCast(written3)], hash_a, hash_test) orelse return error.TestUnexpectedResult;
    try std.testing.expectApproxEqAbs(@as(f64, 1.584962500721156), score_this_is_w3, 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 1.584962500721156), score_is_a_w3, 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 1.584962500721156), score_a_test_w3, 1e-12);

    var left5 = [_]u64{0} ** 16;
    var right5 = [_]u64{0} ** 16;
    var scores5 = [_]f64{0} ** 16;
    const written5 = try fillTopPmiBigramsAscii(input, 5, 16, &left5, &right5, &scores5, std.testing.allocator);
    try std.testing.expectEqual(@as(u64, 9), written5);

    const score_this_a_w5 = findScore(left5[0..@intCast(written5)], right5[0..@intCast(written5)], scores5[0..@intCast(written5)], hash_this, hash_a) orelse return error.TestUnexpectedResult;
    const score_is_test_w5 = findScore(left5[0..@intCast(written5)], right5[0..@intCast(written5)], scores5[0..@intCast(written5)], hash_is, hash_test) orelse return error.TestUnexpectedResult;
    try std.testing.expectApproxEqAbs(@as(f64, 0.5849625007211562), score_this_a_w5, 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 0.5849625007211562), score_is_test_w5, 1e-12);
}

test "windowed id bigram stats include expected counts" {
    const allocator = std.testing.allocator;
    const input = "this this is is a a test test";

    const unique = try countUniqueBigramsWindowIdsAscii(input, 3, allocator);
    try std.testing.expectEqual(@as(u64, 7), unique);

    var left = [_]u32{0} ** 8;
    var right = [_]u32{0} ** 8;
    var counts = [_]u64{0} ** 8;
    var pmis = [_]f64{0} ** 8;
    const written = try fillBigramWindowStatsIdsAscii(input, 3, &left, &right, &counts, &pmis, allocator);
    try std.testing.expectEqual(@as(u64, 7), written);

    // First-occurrence ids for this sentence:
    // this->0, is->1, a->2, test->3
    // window=3 should include (0,1), (1,2), (2,3) with count 3
    var found_01 = false;
    var found_12 = false;
    var found_23 = false;
    for (0..@as(usize, @intCast(written))) |i| {
        if (left[i] == 0 and right[i] == 1 and counts[i] == 3) found_01 = true;
        if (left[i] == 1 and right[i] == 2 and counts[i] == 3) found_12 = true;
        if (left[i] == 2 and right[i] == 3 and counts[i] == 3) found_23 = true;
    }
    try std.testing.expect(found_01 and found_12 and found_23);
}
