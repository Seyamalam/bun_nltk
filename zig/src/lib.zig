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
