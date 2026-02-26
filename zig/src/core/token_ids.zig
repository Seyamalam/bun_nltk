const std = @import("std");
const ascii = @import("ascii.zig");
const types = @import("types.zig");

pub const TokenIdData = struct {
    allocator: std.mem.Allocator,
    arena: std.heap.ArenaAllocator,
    token_ids: std.ArrayListUnmanaged(u32) = .empty,
    token_texts: std.ArrayListUnmanaged([]const u8) = .empty,
    token_counts: std.ArrayListUnmanaged(u64) = .empty,

    pub fn deinit(self: *TokenIdData) void {
        self.token_ids.deinit(self.allocator);
        self.token_texts.deinit(self.allocator);
        self.token_counts.deinit(self.allocator);
        self.arena.deinit();
    }

    pub fn uniqueCount(self: *const TokenIdData) usize {
        return self.token_texts.items.len;
    }

    pub fn tokenBlobBytes(self: *const TokenIdData) usize {
        var total: usize = 0;
        for (self.token_texts.items) |token| {
            total += token.len;
        }
        return total;
    }
};

pub fn buildTokenIdDataAscii(input: []const u8, allocator: std.mem.Allocator) types.CountError!TokenIdData {
    var arena = std.heap.ArenaAllocator.init(allocator);
    errdefer arena.deinit();

    var result = TokenIdData{ .allocator = allocator, .arena = arena };
    errdefer result.deinit();

    var map = std.StringHashMap(u32).init(allocator);
    defer map.deinit();

    var scratch = std.ArrayListUnmanaged(u8).empty;
    defer scratch.deinit(allocator);

    var in_token = false;
    var token_start: usize = 0;

    const arena_alloc = result.arena.allocator();

    for (input, 0..) |ch, i| {
        if (ascii.isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_start = i;
            }
        } else if (in_token) {
            scratch.clearRetainingCapacity();
            for (input[token_start..i]) |token_ch| {
                scratch.append(allocator, ascii.asciiLower(token_ch)) catch return error.OutOfMemory;
            }

            if (map.get(scratch.items)) |id| {
                result.token_counts.items[id] += 1;
                result.token_ids.append(allocator, id) catch return error.OutOfMemory;
            } else {
                const key = arena_alloc.dupe(u8, scratch.items) catch return error.OutOfMemory;
                const id: u32 = @intCast(result.token_texts.items.len);
                map.put(key, id) catch return error.OutOfMemory;
                result.token_texts.append(allocator, key) catch return error.OutOfMemory;
                result.token_counts.append(allocator, 1) catch return error.OutOfMemory;
                result.token_ids.append(allocator, id) catch return error.OutOfMemory;
            }
            in_token = false;
        }
    }

    if (in_token) {
        scratch.clearRetainingCapacity();
        for (input[token_start..input.len]) |token_ch| {
            scratch.append(allocator, ascii.asciiLower(token_ch)) catch return error.OutOfMemory;
        }

        if (map.get(scratch.items)) |id| {
            result.token_counts.items[id] += 1;
            result.token_ids.append(allocator, id) catch return error.OutOfMemory;
        } else {
            const key = arena_alloc.dupe(u8, scratch.items) catch return error.OutOfMemory;
            const id: u32 = @intCast(result.token_texts.items.len);
            map.put(key, id) catch return error.OutOfMemory;
            result.token_texts.append(allocator, key) catch return error.OutOfMemory;
            result.token_counts.append(allocator, 1) catch return error.OutOfMemory;
            result.token_ids.append(allocator, id) catch return error.OutOfMemory;
        }
    }

    return result;
}

pub fn countTokenBlobBytesAscii(input: []const u8, allocator: std.mem.Allocator) types.CountError!u64 {
    var data = try buildTokenIdDataAscii(input, allocator);
    defer data.deinit();

    return @as(u64, data.tokenBlobBytes());
}

pub fn fillTokenFreqDistIdsAscii(
    data: *const TokenIdData,
    out_blob: []u8,
    out_offsets: []u32,
    out_lengths: []u32,
    out_counts: []u64,
) types.CountError!void {
    if (out_offsets.len != out_lengths.len or out_offsets.len != out_counts.len) {
        return error.InsufficientCapacity;
    }

    const unique = data.uniqueCount();
    if (out_offsets.len < unique) {
        return error.InsufficientCapacity;
    }

    var cursor: usize = 0;
    for (data.token_texts.items, 0..) |token, i| {
        if (cursor + token.len > out_blob.len) {
            return error.InsufficientCapacity;
        }

        @memcpy(out_blob[cursor .. cursor + token.len], token);
        out_offsets[i] = @intCast(cursor);
        out_lengths[i] = @intCast(token.len);
        out_counts[i] = data.token_counts.items[i];
        cursor += token.len;
    }
}

test "token id data is reversible and collision free" {
    const allocator = std.testing.allocator;
    const text = "Apple apple APPLE banana BANANA";

    var data = try buildTokenIdDataAscii(text, allocator);
    defer data.deinit();

    try std.testing.expectEqual(@as(usize, 2), data.uniqueCount());
    try std.testing.expectEqualStrings("apple", data.token_texts.items[0]);
    try std.testing.expectEqualStrings("banana", data.token_texts.items[1]);
    try std.testing.expectEqual(@as(u64, 3), data.token_counts.items[0]);
    try std.testing.expectEqual(@as(u64, 2), data.token_counts.items[1]);

    const needed = data.tokenBlobBytes();
    var blob = try allocator.alloc(u8, needed);
    defer allocator.free(blob);

    var offsets = [_]u32{0} ** 2;
    var lengths = [_]u32{0} ** 2;
    var counts = [_]u64{0} ** 2;
    try fillTokenFreqDistIdsAscii(&data, blob, &offsets, &lengths, &counts);

    try std.testing.expectEqualStrings("apple", blob[offsets[0] .. offsets[0] + lengths[0]]);
    try std.testing.expectEqualStrings("banana", blob[offsets[1] .. offsets[1] + lengths[1]]);
}
