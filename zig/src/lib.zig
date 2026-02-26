const std = @import("std");
const log = std.log.scoped(.bun_nltk);

const FNV_OFFSET_BASIS: u64 = 14695981039346656037;
const FNV_PRIME: u64 = 1099511628211;

const ErrorCode = enum(u32) {
    ok = 0,
    invalid_n = 1,
    out_of_memory = 2,
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

fn updateCount(map: *std.AutoHashMap(u64, u64), key: u64) !void {
    if (map.getPtr(key)) |count| {
        count.* += 1;
        return;
    }
    try map.put(key, 1);
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

fn uniqueTokenCountAscii(input: []const u8, allocator: std.mem.Allocator) !u64 {
    var map = std.AutoHashMap(u64, u64).init(allocator);
    defer map.deinit();

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

    return @as(u64, map.count());
}

fn ngramHash(window: []const u64, start: usize, n: usize) u64 {
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

fn uniqueNgramCountAscii(input: []const u8, n: usize, allocator: std.mem.Allocator) !u64 {
    if (n == 0) {
        return error.InvalidN;
    }

    var map = std.AutoHashMap(u64, u64).init(allocator);
    defer map.deinit();

    const window = try allocator.alloc(u64, n);
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
                try updateCount(&map, ngramHash(window, start, n));
            }
            in_token = false;
        }
    }

    if (in_token) {
        window[seen_tokens % n] = token_hash;
        seen_tokens += 1;
        if (seen_tokens >= n) {
            const start = (seen_tokens - n) % n;
            try updateCount(&map, ngramHash(window, start, n));
        }
    }

    return @as(u64, map.count());
}

pub export fn bunnltk_last_error_code() u32 {
    return last_error_code;
}

pub export fn bunnltk_count_tokens_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    resetError();
    if (input_len == 0) {
        return 0;
    }

    const input = input_ptr[0..input_len];
    return tokenCountAscii(input);
}

pub export fn bunnltk_count_unique_tokens_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    resetError();
    if (input_len == 0) {
        return 0;
    }

    const input = input_ptr[0..input_len];
    const allocator = std.heap.c_allocator;

    return uniqueTokenCountAscii(input, allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => setError(.out_of_memory),
        }
        return 0;
    };
}

pub export fn bunnltk_count_ngrams_ascii(input_ptr: [*]const u8, input_len: usize, n: u32) u64 {
    resetError();
    if (n == 0) {
        setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) {
        return 0;
    }

    const token_count = bunnltk_count_tokens_ascii(input_ptr, input_len);
    const n_u64 = @as(u64, n);
    if (token_count < n_u64) {
        return 0;
    }
    return token_count - n_u64 + 1;
}

pub export fn bunnltk_count_unique_ngrams_ascii(input_ptr: [*]const u8, input_len: usize, n: u32) u64 {
    resetError();
    if (n == 0) {
        setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) {
        return 0;
    }

    const input = input_ptr[0..input_len];
    const allocator = std.heap.c_allocator;

    return uniqueNgramCountAscii(input, @as(usize, n), allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => setError(.out_of_memory),
            error.InvalidN => setError(.invalid_n),
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

test "invalid n sets error" {
    const input = "abc";
    _ = bunnltk_count_unique_ngrams_ascii(input.ptr, input.len, 0);
    try std.testing.expectEqual(@as(u32, @intFromEnum(ErrorCode.invalid_n)), bunnltk_last_error_code());
}
