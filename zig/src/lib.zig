const std = @import("std");

const FNV_OFFSET_BASIS: u64 = 14695981039346656037;
const FNV_PRIME: u64 = 1099511628211;

const ErrorCode = enum(u32) {
    ok = 0,
    invalid_n = 1,
    out_of_memory = 2,
    insufficient_capacity = 3,
};

const CountError = error{
    InvalidN,
    OutOfMemory,
    InsufficientCapacity,
};

var last_error_code: u32 = @intFromEnum(ErrorCode.ok);

fn setError(code: ErrorCode) void {
    last_error_code = @intFromEnum(code);
}

fn resetError() void {
    setError(.ok);
}

fn isTokenChar(ch: u8) bool {
    return std.ascii.isAlphanumeric(ch) or ch == '\'';
}

fn asciiLower(ch: u8) u8 {
    if (ch >= 'A' and ch <= 'Z') {
        return ch + 32;
    }
    return ch;
}

fn updateCount(map: *std.AutoHashMap(u64, u64), key: u64) CountError!void {
    if (map.getPtr(key)) |count| {
        count.* += 1;
        return;
    }
    map.put(key, 1) catch return error.OutOfMemory;
}

fn tokenCountAscii(input: []const u8) u64 {
    var total: u64 = 0;
    var in_token = false;

    for (input) |ch| {
        if (isTokenChar(ch)) {
            if (!in_token) {
                total += 1;
                in_token = true;
            }
        } else {
            in_token = false;
        }
    }

    return total;
}

fn tokenHashUpdate(hash: u64, ch: u8) u64 {
    var next = hash;
    next ^= @as(u64, asciiLower(ch));
    next *%= FNV_PRIME;
    return next;
}

fn hashNgram(window: []const u64, start: usize, n: usize) u64 {
    var hash = FNV_OFFSET_BASIS;
    hash ^= @as(u64, n);
    hash *%= FNV_PRIME;

    for (0..n) |i| {
        const token_hash = window[(start + i) % n];
        hash ^= token_hash;
        hash *%= FNV_PRIME;
    }

    return hash;
}

fn buildTokenFreqMapAscii(input: []const u8, allocator: std.mem.Allocator) CountError!std.AutoHashMap(u64, u64) {
    var map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer map.deinit();

    var in_token = false;
    var token_hash: u64 = FNV_OFFSET_BASIS;

    for (input) |ch| {
        if (isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_hash = FNV_OFFSET_BASIS;
            }
            token_hash = tokenHashUpdate(token_hash, ch);
        } else if (in_token) {
            try updateCount(&map, token_hash);
            in_token = false;
        }
    }

    if (in_token) {
        try updateCount(&map, token_hash);
    }

    return map;
}

fn buildNgramFreqMapAscii(input: []const u8, n: usize, allocator: std.mem.Allocator) CountError!std.AutoHashMap(u64, u64) {
    if (n == 0) {
        return error.InvalidN;
    }

    var map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer map.deinit();

    const window = allocator.alloc(u64, n) catch return error.OutOfMemory;
    defer allocator.free(window);

    var seen_tokens: usize = 0;
    var in_token = false;
    var token_hash: u64 = FNV_OFFSET_BASIS;

    for (input) |ch| {
        if (isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_hash = FNV_OFFSET_BASIS;
            }
            token_hash = tokenHashUpdate(token_hash, ch);
        } else if (in_token) {
            window[seen_tokens % n] = token_hash;
            seen_tokens += 1;
            if (seen_tokens >= n) {
                const start = (seen_tokens - n) % n;
                try updateCount(&map, hashNgram(window, start, n));
            }
            in_token = false;
        }
    }

    if (in_token) {
        window[seen_tokens % n] = token_hash;
        seen_tokens += 1;
        if (seen_tokens >= n) {
            const start = (seen_tokens - n) % n;
            try updateCount(&map, hashNgram(window, start, n));
        }
    }

    return map;
}

fn fillFromMap(
    map: *std.AutoHashMap(u64, u64),
    out_hashes: []u64,
    out_counts: []u64,
) CountError!void {
    if (out_hashes.len != out_counts.len) {
        return error.InsufficientCapacity;
    }

    const unique = map.count();
    if (out_hashes.len < unique) {
        return error.InsufficientCapacity;
    }

    var idx: usize = 0;
    var iter = map.iterator();
    while (iter.next()) |entry| {
        out_hashes[idx] = entry.key_ptr.*;
        out_counts[idx] = entry.value_ptr.*;
        idx += 1;
    }
}

fn fillTokenOffsetsAscii(
    input: []const u8,
    out_offsets: []u32,
    out_lengths: []u32,
) u64 {
    var total: u64 = 0;
    var written: usize = 0;
    var in_token = false;
    var token_start: usize = 0;

    for (input, 0..) |ch, idx| {
        if (isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_start = idx;
            }
        } else if (in_token) {
            const token_len = idx - token_start;
            if (written < out_offsets.len and token_start <= std.math.maxInt(u32) and token_len <= std.math.maxInt(u32)) {
                out_offsets[written] = @as(u32, @intCast(token_start));
                out_lengths[written] = @as(u32, @intCast(token_len));
                written += 1;
            }
            total += 1;
            in_token = false;
        }
    }

    if (in_token) {
        const token_len = input.len - token_start;
        if (written < out_offsets.len and token_start <= std.math.maxInt(u32) and token_len <= std.math.maxInt(u32)) {
            out_offsets[written] = @as(u32, @intCast(token_start));
            out_lengths[written] = @as(u32, @intCast(token_len));
        }
        total += 1;
    }

    return total;
}

fn updateCountU128(map: *std.AutoHashMap(u128, u64), key: u128) CountError!void {
    if (map.getPtr(key)) |count| {
        count.* += 1;
        return;
    }
    map.put(key, 1) catch return error.OutOfMemory;
}

fn packBigramKey(left: u64, right: u64) u128 {
    return (@as(u128, left) << 64) | @as(u128, right);
}

fn unpackBigramLeft(key: u128) u64 {
    return @as(u64, @truncate(key >> 64));
}

fn unpackBigramRight(key: u128) u64 {
    return @as(u64, @truncate(key & std.math.maxInt(u64)));
}

const BigramBuildResult = struct {
    token_total: u64,
    word_map: std.AutoHashMap(u64, u64),
    bigram_map: std.AutoHashMap(u128, u64),
};

fn buildBigramStatsAscii(input: []const u8, allocator: std.mem.Allocator) CountError!BigramBuildResult {
    var word_map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer word_map.deinit();

    var bigram_map = std.AutoHashMap(u128, u64).init(allocator);
    errdefer bigram_map.deinit();

    var in_token = false;
    var token_hash: u64 = FNV_OFFSET_BASIS;
    var token_total: u64 = 0;
    var prev_hash: ?u64 = null;

    for (input) |ch| {
        if (isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_hash = FNV_OFFSET_BASIS;
            }
            token_hash = tokenHashUpdate(token_hash, ch);
        } else if (in_token) {
            try updateCount(&word_map, token_hash);
            if (prev_hash) |prev| {
                try updateCountU128(&bigram_map, packBigramKey(prev, token_hash));
            }
            prev_hash = token_hash;
            token_total += 1;
            in_token = false;
        }
    }

    if (in_token) {
        try updateCount(&word_map, token_hash);
        if (prev_hash) |prev| {
            try updateCountU128(&bigram_map, packBigramKey(prev, token_hash));
        }
        token_total += 1;
    }

    return .{
        .token_total = token_total,
        .word_map = word_map,
        .bigram_map = bigram_map,
    };
}

fn collectTokenHashesAscii(input: []const u8, allocator: std.mem.Allocator) CountError![]u64 {
    var hashes = std.ArrayListUnmanaged(u64).empty;
    errdefer hashes.deinit(allocator);

    var in_token = false;
    var token_hash: u64 = FNV_OFFSET_BASIS;

    for (input) |ch| {
        if (isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_hash = FNV_OFFSET_BASIS;
            }
            token_hash = tokenHashUpdate(token_hash, ch);
        } else if (in_token) {
            hashes.append(allocator, token_hash) catch return error.OutOfMemory;
            in_token = false;
        }
    }

    if (in_token) {
        hashes.append(allocator, token_hash) catch return error.OutOfMemory;
    }

    return hashes.toOwnedSlice(allocator) catch return error.OutOfMemory;
}

fn buildWindowedBigramStatsAscii(input: []const u8, window_size: usize, allocator: std.mem.Allocator) CountError!BigramBuildResult {
    if (window_size < 2) return error.InvalidN;

    const token_hashes = try collectTokenHashesAscii(input, allocator);
    defer allocator.free(token_hashes);

    var word_map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer word_map.deinit();
    for (token_hashes) |token_hash| {
        try updateCount(&word_map, token_hash);
    }

    var bigram_map = std.AutoHashMap(u128, u64).init(allocator);
    errdefer bigram_map.deinit();

    for (token_hashes, 0..) |left_hash, i| {
        const end = @min(token_hashes.len, i + window_size);
        var j = i + 1;
        while (j < end) : (j += 1) {
            const right_hash = token_hashes[j];
            try updateCountU128(&bigram_map, packBigramKey(left_hash, right_hash));
        }
    }

    return .{
        .token_total = @as(u64, token_hashes.len),
        .word_map = word_map,
        .bigram_map = bigram_map,
    };
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
        if (pmiEntryWorse(entries[i], entries[worst_idx])) {
            worst_idx = i;
        }
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

fn fillTopPmiBigramsAscii(
    input: []const u8,
    window_size: usize,
    top_k: usize,
    out_left_hashes: []u64,
    out_right_hashes: []u64,
    out_scores: []f64,
    allocator: std.mem.Allocator,
) CountError!u64 {
    if (top_k == 0 or input.len == 0) return 0;
    if (out_left_hashes.len != out_right_hashes.len or out_left_hashes.len != out_scores.len) {
        return error.InsufficientCapacity;
    }
    if (out_left_hashes.len == 0) {
        return error.InsufficientCapacity;
    }

    var stats = if (window_size == 2)
        try buildBigramStatsAscii(input, allocator)
    else
        try buildWindowedBigramStatsAscii(input, window_size, allocator);
    defer stats.word_map.deinit();
    defer stats.bigram_map.deinit();

    if (stats.token_total < 2 or stats.bigram_map.count() == 0) {
        return 0;
    }

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
            if (pmiEntryBetter(cand, best[idx])) {
                best[idx] = cand;
            }
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

pub export fn bunnltk_last_error_code() u32 {
    return last_error_code;
}

pub export fn bunnltk_count_tokens_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    resetError();
    if (input_len == 0) return 0;
    const input = input_ptr[0..input_len];
    return tokenCountAscii(input);
}

pub export fn bunnltk_count_unique_tokens_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    resetError();
    if (input_len == 0) return 0;

    const allocator = std.heap.c_allocator;
    const input = input_ptr[0..input_len];

    var map = buildTokenFreqMapAscii(input, allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer map.deinit();

    return @as(u64, map.count());
}

pub export fn bunnltk_count_ngrams_ascii(input_ptr: [*]const u8, input_len: usize, n: u32) u64 {
    resetError();
    if (n == 0) {
        setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    const token_count = bunnltk_count_tokens_ascii(input_ptr, input_len);
    const n_u64 = @as(u64, n);
    if (token_count < n_u64) return 0;
    return token_count - n_u64 + 1;
}

pub export fn bunnltk_count_unique_ngrams_ascii(input_ptr: [*]const u8, input_len: usize, n: u32) u64 {
    resetError();
    if (n == 0) {
        setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    const allocator = std.heap.c_allocator;
    const input = input_ptr[0..input_len];

    var map = buildNgramFreqMapAscii(input, @as(usize, n), allocator) catch |err| {
        switch (err) {
            error.InvalidN => setError(.invalid_n),
            error.OutOfMemory => setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer map.deinit();

    return @as(u64, map.count());
}

pub export fn bunnltk_fill_token_freqdist_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    out_hashes_ptr: [*]u64,
    out_counts_ptr: [*]u64,
    capacity: usize,
) u64 {
    resetError();
    if (input_len == 0) return 0;

    const allocator = std.heap.c_allocator;
    const input = input_ptr[0..input_len];

    var map = buildTokenFreqMapAscii(input, allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer map.deinit();

    const unique = map.count();
    const out_hashes = out_hashes_ptr[0..capacity];
    const out_counts = out_counts_ptr[0..capacity];

    fillFromMap(&map, out_hashes, out_counts) catch |err| {
        switch (err) {
            error.InsufficientCapacity => setError(.insufficient_capacity),
            else => unreachable,
        }
    };

    return @as(u64, unique);
}

pub export fn bunnltk_fill_ngram_freqdist_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    n: u32,
    out_hashes_ptr: [*]u64,
    out_counts_ptr: [*]u64,
    capacity: usize,
) u64 {
    resetError();
    if (n == 0) {
        setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    const allocator = std.heap.c_allocator;
    const input = input_ptr[0..input_len];

    var map = buildNgramFreqMapAscii(input, @as(usize, n), allocator) catch |err| {
        switch (err) {
            error.InvalidN => setError(.invalid_n),
            error.OutOfMemory => setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer map.deinit();

    const unique = map.count();
    const out_hashes = out_hashes_ptr[0..capacity];
    const out_counts = out_counts_ptr[0..capacity];

    fillFromMap(&map, out_hashes, out_counts) catch |err| {
        switch (err) {
            error.InsufficientCapacity => setError(.insufficient_capacity),
            else => unreachable,
        }
    };

    return @as(u64, unique);
}

pub export fn bunnltk_fill_token_offsets_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    out_offsets_ptr: [*]u32,
    out_lengths_ptr: [*]u32,
    capacity: usize,
) u64 {
    resetError();
    if (input_len == 0) return 0;

    const input = input_ptr[0..input_len];
    const out_offsets = out_offsets_ptr[0..capacity];
    const out_lengths = out_lengths_ptr[0..capacity];

    if (out_offsets.len != out_lengths.len) {
        setError(.insufficient_capacity);
        return 0;
    }

    const total = fillTokenOffsetsAscii(input, out_offsets, out_lengths);
    if (total > capacity) {
        setError(.insufficient_capacity);
    }
    return total;
}

pub export fn bunnltk_fill_top_pmi_bigrams_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    top_k: u32,
    out_left_hashes_ptr: [*]u64,
    out_right_hashes_ptr: [*]u64,
    out_scores_ptr: [*]f64,
    capacity: usize,
) u64 {
    resetError();
    if (input_len == 0 or top_k == 0) return 0;

    const input = input_ptr[0..input_len];
    const out_left = out_left_hashes_ptr[0..capacity];
    const out_right = out_right_hashes_ptr[0..capacity];
    const out_scores = out_scores_ptr[0..capacity];

    if (@as(usize, top_k) > capacity) {
        setError(.insufficient_capacity);
    }

    return fillTopPmiBigramsAscii(
        input,
        2,
        @as(usize, top_k),
        out_left,
        out_right,
        out_scores,
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InsufficientCapacity => setError(.insufficient_capacity),
            error.OutOfMemory => setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
}

pub export fn bunnltk_fill_top_pmi_bigrams_window_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    window_size: u32,
    top_k: u32,
    out_left_hashes_ptr: [*]u64,
    out_right_hashes_ptr: [*]u64,
    out_scores_ptr: [*]f64,
    capacity: usize,
) u64 {
    resetError();
    if (input_len == 0 or top_k == 0) return 0;
    if (window_size < 2) {
        setError(.invalid_n);
        return 0;
    }

    const input = input_ptr[0..input_len];
    const out_left = out_left_hashes_ptr[0..capacity];
    const out_right = out_right_hashes_ptr[0..capacity];
    const out_scores = out_scores_ptr[0..capacity];

    if (@as(usize, top_k) > capacity) {
        setError(.insufficient_capacity);
    }

    return fillTopPmiBigramsAscii(
        input,
        @as(usize, window_size),
        @as(usize, top_k),
        out_left,
        out_right,
        out_scores,
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => setError(.invalid_n),
            error.InsufficientCapacity => setError(.insufficient_capacity),
            error.OutOfMemory => setError(.out_of_memory),
        }
        return 0;
    };
}

test "token count and unique token count" {
    const input = "This this is is a a test test";
    try std.testing.expectEqual(@as(u64, 8), bunnltk_count_tokens_ascii(input.ptr, input.len));
    try std.testing.expectEqual(@as(u64, 4), bunnltk_count_unique_tokens_ascii(input.ptr, input.len));
    try std.testing.expectEqual(@as(u32, @intFromEnum(ErrorCode.ok)), bunnltk_last_error_code());
}

test "ngram counts" {
    const input = "this this is is a a test test";
    try std.testing.expectEqual(@as(u64, 7), bunnltk_count_ngrams_ascii(input.ptr, input.len, 2));
    try std.testing.expectEqual(@as(u64, 7), bunnltk_count_unique_ngrams_ascii(input.ptr, input.len, 2));
    try std.testing.expectEqual(@as(u64, 6), bunnltk_count_ngrams_ascii(input.ptr, input.len, 3));
}

test "fill token freqdist writes all counts" {
    const input = "a a b test test";
    var hashes = [_]u64{0} ** 3;
    var counts = [_]u64{0} ** 3;

    const unique = bunnltk_fill_token_freqdist_ascii(input.ptr, input.len, &hashes, &counts, hashes.len);
    try std.testing.expectEqual(@as(u64, 3), unique);
    try std.testing.expectEqual(@as(u32, @intFromEnum(ErrorCode.ok)), bunnltk_last_error_code());

    var total: u64 = 0;
    for (counts) |count| {
        total += count;
    }
    try std.testing.expectEqual(@as(u64, 5), total);
}

test "insufficient capacity sets error" {
    const input = "a b c d";
    var hashes = [_]u64{0};
    var counts = [_]u64{0};

    const unique = bunnltk_fill_token_freqdist_ascii(input.ptr, input.len, &hashes, &counts, hashes.len);
    try std.testing.expectEqual(@as(u64, 4), unique);
    try std.testing.expectEqual(@as(u32, @intFromEnum(ErrorCode.insufficient_capacity)), bunnltk_last_error_code());
}

test "invalid n sets error" {
    const input = "abc";
    _ = bunnltk_count_unique_ngrams_ascii(input.ptr, input.len, 0);
    try std.testing.expectEqual(@as(u32, @intFromEnum(ErrorCode.invalid_n)), bunnltk_last_error_code());
}

test "fill token offsets materializes token windows" {
    const input = "This, this is a test.";
    var offsets = [_]u32{0} ** 5;
    var lengths = [_]u32{0} ** 5;

    const total = bunnltk_fill_token_offsets_ascii(input.ptr, input.len, &offsets, &lengths, offsets.len);
    try std.testing.expectEqual(@as(u64, 5), total);
    try std.testing.expectEqual(@as(u32, @intFromEnum(ErrorCode.ok)), bunnltk_last_error_code());

    try std.testing.expectEqualStrings("This", input[offsets[0] .. offsets[0] + lengths[0]]);
    try std.testing.expectEqualStrings("this", input[offsets[1] .. offsets[1] + lengths[1]]);
    try std.testing.expectEqualStrings("is", input[offsets[2] .. offsets[2] + lengths[2]]);
    try std.testing.expectEqualStrings("a", input[offsets[3] .. offsets[3] + lengths[3]]);
    try std.testing.expectEqualStrings("test", input[offsets[4] .. offsets[4] + lengths[4]]);
}

test "top pmi bigrams returns expected scores for repeated sentence" {
    const input = "this this is is a a test test";
    var left = [_]u64{0} ** 3;
    var right = [_]u64{0} ** 3;
    var scores = [_]f64{0} ** 3;

    const written = bunnltk_fill_top_pmi_bigrams_ascii(input.ptr, input.len, 3, &left, &right, &scores, left.len);
    try std.testing.expectEqual(@as(u64, 3), written);
    try std.testing.expectEqual(@as(u32, @intFromEnum(ErrorCode.ok)), bunnltk_last_error_code());

    for (scores[0..@as(usize, @intCast(written))]) |score| {
        try std.testing.expectApproxEqAbs(@as(f64, 1.0), score, 1e-12);
    }
}

test "top pmi sets insufficient capacity when top_k exceeds capacity" {
    const input = "a b c d";
    var left = [_]u64{0};
    var right = [_]u64{0};
    var scores = [_]f64{0};

    const written = bunnltk_fill_top_pmi_bigrams_ascii(input.ptr, input.len, 3, &left, &right, &scores, left.len);
    try std.testing.expectEqual(@as(u64, 1), written);
    try std.testing.expectEqual(@as(u32, @intFromEnum(ErrorCode.insufficient_capacity)), bunnltk_last_error_code());
}

fn findScore(
    left_hashes: []const u64,
    right_hashes: []const u64,
    scores: []const f64,
    left: u64,
    right: u64,
) ?f64 {
    for (left_hashes, 0..) |lh, i| {
        if (lh == left and right_hashes[i] == right) {
            return scores[i];
        }
    }
    return null;
}

test "windowed top pmi matches NLTK sample scores for window=3 and window=5" {
    const input = "this this is is a a test test";
    const hash_this = tokenHashUpdate(tokenHashUpdate(tokenHashUpdate(tokenHashUpdate(FNV_OFFSET_BASIS, 't'), 'h'), 'i'), 's');
    const hash_is = tokenHashUpdate(tokenHashUpdate(FNV_OFFSET_BASIS, 'i'), 's');
    const hash_a = tokenHashUpdate(FNV_OFFSET_BASIS, 'a');
    const hash_test = tokenHashUpdate(tokenHashUpdate(tokenHashUpdate(tokenHashUpdate(FNV_OFFSET_BASIS, 't'), 'e'), 's'), 't');

    var left3 = [_]u64{0} ** 16;
    var right3 = [_]u64{0} ** 16;
    var scores3 = [_]f64{0} ** 16;
    const written3 = bunnltk_fill_top_pmi_bigrams_window_ascii(input.ptr, input.len, 3, 16, &left3, &right3, &scores3, left3.len);
    try std.testing.expectEqual(@as(u64, 7), written3);

    const score_this_is_w3 = findScore(left3[0..@intCast(written3)], right3[0..@intCast(written3)], scores3[0..@intCast(written3)], hash_this, hash_is) orelse {
        try std.testing.expect(false);
        return;
    };
    const score_is_a_w3 = findScore(left3[0..@intCast(written3)], right3[0..@intCast(written3)], scores3[0..@intCast(written3)], hash_is, hash_a) orelse {
        try std.testing.expect(false);
        return;
    };
    const score_a_test_w3 = findScore(left3[0..@intCast(written3)], right3[0..@intCast(written3)], scores3[0..@intCast(written3)], hash_a, hash_test) orelse {
        try std.testing.expect(false);
        return;
    };
    try std.testing.expectApproxEqAbs(@as(f64, 1.584962500721156), score_this_is_w3, 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 1.584962500721156), score_is_a_w3, 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 1.584962500721156), score_a_test_w3, 1e-12);

    var left5 = [_]u64{0} ** 16;
    var right5 = [_]u64{0} ** 16;
    var scores5 = [_]f64{0} ** 16;
    const written5 = bunnltk_fill_top_pmi_bigrams_window_ascii(input.ptr, input.len, 5, 16, &left5, &right5, &scores5, left5.len);
    try std.testing.expectEqual(@as(u64, 9), written5);

    const score_this_a_w5 = findScore(left5[0..@intCast(written5)], right5[0..@intCast(written5)], scores5[0..@intCast(written5)], hash_this, hash_a) orelse {
        try std.testing.expect(false);
        return;
    };
    const score_is_test_w5 = findScore(left5[0..@intCast(written5)], right5[0..@intCast(written5)], scores5[0..@intCast(written5)], hash_is, hash_test) orelse {
        try std.testing.expect(false);
        return;
    };
    try std.testing.expectApproxEqAbs(@as(f64, 0.5849625007211562), score_this_a_w5, 1e-12);
    try std.testing.expectApproxEqAbs(@as(f64, 0.5849625007211562), score_is_test_w5, 1e-12);
}
