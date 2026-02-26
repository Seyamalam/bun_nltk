const std = @import("std");
const ascii = @import("ascii.zig");
const types = @import("types.zig");

pub fn updateCount(map: *std.AutoHashMap(u64, u64), key: u64) types.CountError!void {
    if (map.getPtr(key)) |count| {
        count.* += 1;
        return;
    }
    map.put(key, 1) catch return error.OutOfMemory;
}

pub fn updateCountU128(map: *std.AutoHashMap(u128, u64), key: u128) types.CountError!void {
    if (map.getPtr(key)) |count| {
        count.* += 1;
        return;
    }
    map.put(key, 1) catch return error.OutOfMemory;
}

pub fn buildTokenFreqMapAscii(input: []const u8, allocator: std.mem.Allocator) types.CountError!std.AutoHashMap(u64, u64) {
    var map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer map.deinit();

    var in_token = false;
    var token_hash: u64 = ascii.FNV_OFFSET_BASIS;

    for (input) |ch| {
        if (ascii.isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_hash = ascii.FNV_OFFSET_BASIS;
            }
            token_hash = ascii.tokenHashUpdate(token_hash, ch);
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

pub fn buildNgramFreqMapAscii(input: []const u8, n: usize, allocator: std.mem.Allocator) types.CountError!std.AutoHashMap(u64, u64) {
    if (n == 0) return error.InvalidN;

    var map = std.AutoHashMap(u64, u64).init(allocator);
    errdefer map.deinit();

    const window = allocator.alloc(u64, n) catch return error.OutOfMemory;
    defer allocator.free(window);

    var seen_tokens: usize = 0;
    var in_token = false;
    var token_hash: u64 = ascii.FNV_OFFSET_BASIS;

    for (input) |ch| {
        if (ascii.isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_hash = ascii.FNV_OFFSET_BASIS;
            }
            token_hash = ascii.tokenHashUpdate(token_hash, ch);
        } else if (in_token) {
            window[seen_tokens % n] = token_hash;
            seen_tokens += 1;
            if (seen_tokens >= n) {
                const start = (seen_tokens - n) % n;
                try updateCount(&map, ascii.hashNgram(window, start, n));
            }
            in_token = false;
        }
    }

    if (in_token) {
        window[seen_tokens % n] = token_hash;
        seen_tokens += 1;
        if (seen_tokens >= n) {
            const start = (seen_tokens - n) % n;
            try updateCount(&map, ascii.hashNgram(window, start, n));
        }
    }

    return map;
}

pub fn fillFromMap(map: *std.AutoHashMap(u64, u64), out_hashes: []u64, out_counts: []u64) types.CountError!void {
    if (out_hashes.len != out_counts.len) return error.InsufficientCapacity;

    const unique = map.count();
    if (out_hashes.len < unique) return error.InsufficientCapacity;

    var idx: usize = 0;
    var iter = map.iterator();
    while (iter.next()) |entry| {
        out_hashes[idx] = entry.key_ptr.*;
        out_counts[idx] = entry.value_ptr.*;
        idx += 1;
    }
}

test "freqdist building" {
    const allocator = std.testing.allocator;
    const input = "this this is is a a test test";

    var token_map = try buildTokenFreqMapAscii(input, allocator);
    defer token_map.deinit();
    try std.testing.expectEqual(@as(usize, 4), token_map.count());

    var ngram_map = try buildNgramFreqMapAscii(input, 2, allocator);
    defer ngram_map.deinit();
    try std.testing.expectEqual(@as(usize, 7), ngram_map.count());
}

test "freqdist invalid n" {
    const allocator = std.testing.allocator;
    const result = buildNgramFreqMapAscii("abc", 0, allocator);
    try std.testing.expectError(error.InvalidN, result);
}
