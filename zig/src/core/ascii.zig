const std = @import("std");
const builtin = @import("builtin");
const types = @import("types.zig");

pub const FNV_OFFSET_BASIS: u64 = 14695981039346656037;
pub const FNV_PRIME: u64 = 1099511628211;

pub fn isTokenChar(ch: u8) bool {
    return std.ascii.isAlphanumeric(ch) or ch == '\'';
}

pub fn asciiLower(ch: u8) u8 {
    if (ch >= 'A' and ch <= 'Z') {
        return ch + 32;
    }
    return ch;
}

pub fn tokenHashUpdate(hash: u64, ch: u8) u64 {
    var next = hash;
    next ^= @as(u64, asciiLower(ch));
    next *%= FNV_PRIME;
    return next;
}

pub fn tokenCountAscii(input: []const u8) u64 {
    if (input.len >= 64 and builtin.cpu.arch == .x86_64) {
        return tokenCountAsciiSimd16(input);
    }
    return tokenCountAsciiScalar(input);
}

pub fn tokenCountAsciiScalar(input: []const u8) u64 {
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

fn tokenCountAsciiSimd16(input: []const u8) u64 {
    const lanes = 16;
    const Vec = @Vector(lanes, u8);

    var total: u64 = 0;
    var in_token = false;
    var idx: usize = 0;
    var chunk: [lanes]u8 = undefined;

    while (idx + lanes <= input.len) : (idx += lanes) {
        @memcpy(chunk[0..], input[idx .. idx + lanes]);
        const vec: Vec = chunk;
        const token_flags: [lanes]bool = tokenCharMask16(vec);
        for (token_flags) |is_token| {
            if (is_token) {
                if (!in_token) {
                    total += 1;
                    in_token = true;
                }
            } else {
                in_token = false;
            }
        }
    }

    while (idx < input.len) : (idx += 1) {
        const is_token = isTokenChar(input[idx]);
        if (is_token) {
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

fn tokenCharMask16(chunk: @Vector(16, u8)) [16]bool {
    const upper = (chunk >= @as(@Vector(16, u8), @splat(@as(u8, 'A')))) &
        (chunk <= @as(@Vector(16, u8), @splat(@as(u8, 'Z'))));
    const lower = (chunk >= @as(@Vector(16, u8), @splat(@as(u8, 'a')))) &
        (chunk <= @as(@Vector(16, u8), @splat(@as(u8, 'z'))));
    const digit = (chunk >= @as(@Vector(16, u8), @splat(@as(u8, '0')))) &
        (chunk <= @as(@Vector(16, u8), @splat(@as(u8, '9'))));
    const apostrophe = chunk == @as(@Vector(16, u8), @splat(@as(u8, '\'')));

    const mask = upper | lower | digit | apostrophe;
    return mask;
}

pub fn hashNgram(window: []const u64, start: usize, n: usize) u64 {
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

pub fn fillTokenOffsetsAscii(input: []const u8, out_offsets: []u32, out_lengths: []u32) u64 {
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

pub fn collectTokenHashesAscii(input: []const u8, allocator: std.mem.Allocator) types.CountError![]u64 {
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

test "ascii token counting and offsets" {
    const input = "This, this is a test.";
    try std.testing.expectEqual(@as(u64, 5), tokenCountAscii(input));

    var offsets = [_]u32{0} ** 5;
    var lengths = [_]u32{0} ** 5;
    const total = fillTokenOffsetsAscii(input, &offsets, &lengths);
    try std.testing.expectEqual(@as(u64, 5), total);

    try std.testing.expectEqualStrings("This", input[offsets[0] .. offsets[0] + lengths[0]]);
    try std.testing.expectEqualStrings("this", input[offsets[1] .. offsets[1] + lengths[1]]);
    try std.testing.expectEqualStrings("is", input[offsets[2] .. offsets[2] + lengths[2]]);
    try std.testing.expectEqualStrings("a", input[offsets[3] .. offsets[3] + lengths[3]]);
    try std.testing.expectEqualStrings("test", input[offsets[4] .. offsets[4] + lengths[4]]);
}

test "collect token hashes" {
    const allocator = std.testing.allocator;
    const input = "a b c";
    const hashes = try collectTokenHashesAscii(input, allocator);
    defer allocator.free(hashes);

    try std.testing.expectEqual(@as(usize, 3), hashes.len);
}

test "simd and scalar token counting match" {
    const input = "This this is a test with 123 numbers and contractions like don't over a long sample.";
    try std.testing.expectEqual(tokenCountAsciiScalar(input), tokenCountAsciiSimd16(input));
}
