const std = @import("std");
const ascii = @import("ascii.zig");
const freqdist = @import("freqdist.zig");
const tagger = @import("tagger.zig");

pub const StreamFreqDistError = error{
    OutOfMemory,
    InsufficientCapacity,
};

const TokenEntry = struct {
    hash: u64,
    count: u64,
};

const BigramEntry = struct {
    left: u64,
    right: u64,
    count: u64,
};

const ConditionalEntry = struct {
    tag_id: u16,
    hash: u64,
    count: u64,
};

pub const StreamFreqDistBuilder = struct {
    allocator: std.mem.Allocator,
    token_counts: std.AutoHashMap(u64, u64),
    bigram_counts: std.AutoHashMap(u128, u64),
    conditional_counts: std.AutoHashMap(u128, u64),
    token_buffer: std.ArrayListUnmanaged(u8),
    in_token: bool,
    token_hash: u64,
    has_prev_token: bool,
    prev_token_hash: u64,

    pub fn create(allocator: std.mem.Allocator) StreamFreqDistError!*StreamFreqDistBuilder {
        const ptr = allocator.create(StreamFreqDistBuilder) catch return error.OutOfMemory;
        ptr.* = .{
            .allocator = allocator,
            .token_counts = std.AutoHashMap(u64, u64).init(allocator),
            .bigram_counts = std.AutoHashMap(u128, u64).init(allocator),
            .conditional_counts = std.AutoHashMap(u128, u64).init(allocator),
            .token_buffer = .empty,
            .in_token = false,
            .token_hash = ascii.FNV_OFFSET_BASIS,
            .has_prev_token = false,
            .prev_token_hash = 0,
        };
        return ptr;
    }

    pub fn destroy(self: *StreamFreqDistBuilder) void {
        self.token_buffer.deinit(self.allocator);
        self.token_counts.deinit();
        self.bigram_counts.deinit();
        self.conditional_counts.deinit();
        self.allocator.destroy(self);
    }

    pub fn updateAscii(self: *StreamFreqDistBuilder, input: []const u8) StreamFreqDistError!void {
        for (input) |ch| {
            if (ascii.isTokenChar(ch)) {
                if (!self.in_token) {
                    self.in_token = true;
                    self.token_hash = ascii.FNV_OFFSET_BASIS;
                    self.token_buffer.clearRetainingCapacity();
                }
                self.token_hash = ascii.tokenHashUpdate(self.token_hash, ch);
                self.token_buffer.append(self.allocator, ch) catch return error.OutOfMemory;
            } else if (self.in_token) {
                try self.finalizeCurrentToken();
            }
        }
    }

    pub fn flush(self: *StreamFreqDistBuilder) StreamFreqDistError!void {
        if (self.in_token) {
            try self.finalizeCurrentToken();
        }
    }

    pub fn tokenUniqueCount(self: *const StreamFreqDistBuilder) usize {
        return self.token_counts.count();
    }

    pub fn bigramUniqueCount(self: *const StreamFreqDistBuilder) usize {
        return self.bigram_counts.count();
    }

    pub fn conditionalUniqueCount(self: *const StreamFreqDistBuilder) usize {
        return self.conditional_counts.count();
    }

    pub fn fillTokenFreq(
        self: *const StreamFreqDistBuilder,
        out_hashes: []u64,
        out_counts: []u64,
    ) StreamFreqDistError!usize {
        if (out_hashes.len != out_counts.len) return error.InsufficientCapacity;
        const unique = self.token_counts.count();
        if (out_hashes.len < unique) return error.InsufficientCapacity;

        var idx: usize = 0;
        var iter = self.token_counts.iterator();
        while (iter.next()) |entry| {
            out_hashes[idx] = entry.key_ptr.*;
            out_counts[idx] = entry.value_ptr.*;
            idx += 1;
        }
        return unique;
    }

    pub fn fillBigramFreq(
        self: *const StreamFreqDistBuilder,
        out_left_hashes: []u64,
        out_right_hashes: []u64,
        out_counts: []u64,
    ) StreamFreqDistError!usize {
        if (out_left_hashes.len != out_right_hashes.len or out_left_hashes.len != out_counts.len) {
            return error.InsufficientCapacity;
        }
        const unique = self.bigram_counts.count();
        if (out_left_hashes.len < unique) return error.InsufficientCapacity;

        var idx: usize = 0;
        var iter = self.bigram_counts.iterator();
        while (iter.next()) |entry| {
            const decoded = decodeBigramKey(entry.key_ptr.*);
            out_left_hashes[idx] = decoded.left;
            out_right_hashes[idx] = decoded.right;
            out_counts[idx] = entry.value_ptr.*;
            idx += 1;
        }
        return unique;
    }

    pub fn fillConditionalFreq(
        self: *const StreamFreqDistBuilder,
        out_tag_ids: []u16,
        out_hashes: []u64,
        out_counts: []u64,
    ) StreamFreqDistError!usize {
        if (out_tag_ids.len != out_hashes.len or out_tag_ids.len != out_counts.len) {
            return error.InsufficientCapacity;
        }
        const unique = self.conditional_counts.count();
        if (out_tag_ids.len < unique) return error.InsufficientCapacity;

        var idx: usize = 0;
        var iter = self.conditional_counts.iterator();
        while (iter.next()) |entry| {
            const decoded = decodeConditionalKey(entry.key_ptr.*);
            out_tag_ids[idx] = decoded.tag_id;
            out_hashes[idx] = decoded.hash;
            out_counts[idx] = entry.value_ptr.*;
            idx += 1;
        }
        return unique;
    }

    pub fn countJsonBytes(self: *const StreamFreqDistBuilder) StreamFreqDistError!usize {
        var buffer = std.ArrayList(u8).empty;
        defer buffer.deinit(self.allocator);
        try self.writeJson(buffer.writer(self.allocator));
        return buffer.items.len;
    }

    pub fn fillJson(self: *const StreamFreqDistBuilder, out: []u8) StreamFreqDistError!usize {
        var buffer = std.ArrayList(u8).empty;
        defer buffer.deinit(self.allocator);
        try self.writeJson(buffer.writer(self.allocator));

        if (out.len < buffer.items.len) return error.InsufficientCapacity;
        @memcpy(out[0..buffer.items.len], buffer.items);
        return buffer.items.len;
    }

    fn finalizeCurrentToken(self: *StreamFreqDistBuilder) StreamFreqDistError!void {
        if (self.token_buffer.items.len == 0) {
            self.in_token = false;
            return;
        }

        freqdist.updateCount(&self.token_counts, self.token_hash) catch |err| switch (err) {
            error.OutOfMemory => return error.OutOfMemory,
            error.InvalidN => unreachable,
            error.InsufficientCapacity => unreachable,
        };

        if (self.has_prev_token) {
            freqdist.updateCountU128(
                &self.bigram_counts,
                encodeBigramKey(self.prev_token_hash, self.token_hash),
            ) catch |err| switch (err) {
                error.OutOfMemory => return error.OutOfMemory,
                error.InvalidN => unreachable,
                error.InsufficientCapacity => unreachable,
            };
        }

        const tag_id = @as(u16, @intFromEnum(tagger.classifyTokenAscii(self.token_buffer.items, self.token_hash)));
        freqdist.updateCountU128(
            &self.conditional_counts,
            encodeConditionalKey(tag_id, self.token_hash),
        ) catch |err| switch (err) {
            error.OutOfMemory => return error.OutOfMemory,
            error.InvalidN => unreachable,
            error.InsufficientCapacity => unreachable,
        };

        self.prev_token_hash = self.token_hash;
        self.has_prev_token = true;
        self.in_token = false;
        self.token_hash = ascii.FNV_OFFSET_BASIS;
        self.token_buffer.clearRetainingCapacity();
    }

    fn writeJson(self: *const StreamFreqDistBuilder, writer: anytype) StreamFreqDistError!void {
        try writer.writeAll("{\"tokens\":[");
        try self.writeTokenEntries(writer);
        try writer.writeAll("],\"bigrams\":[");
        try self.writeBigramEntries(writer);
        try writer.writeAll("],\"conditional_tags\":[");
        try self.writeConditionalEntries(writer);
        try writer.writeAll("]}");
    }

    fn writeTokenEntries(self: *const StreamFreqDistBuilder, writer: anytype) StreamFreqDistError!void {
        const allocator = self.allocator;
        var entries = allocator.alloc(TokenEntry, self.token_counts.count()) catch return error.OutOfMemory;
        defer allocator.free(entries);

        var idx: usize = 0;
        var iter = self.token_counts.iterator();
        while (iter.next()) |entry| {
            entries[idx] = .{
                .hash = entry.key_ptr.*,
                .count = entry.value_ptr.*,
            };
            idx += 1;
        }

        std.sort.pdq(TokenEntry, entries, {}, tokenEntryLessThan);

        var first = true;
        for (entries) |entry| {
            if (!first) try writer.writeByte(',');
            first = false;
            try writer.print("{{\"hash\":\"{}\",\"count\":{}}}", .{ entry.hash, entry.count });
        }
    }

    fn writeBigramEntries(self: *const StreamFreqDistBuilder, writer: anytype) StreamFreqDistError!void {
        const allocator = self.allocator;
        var entries = allocator.alloc(BigramEntry, self.bigram_counts.count()) catch return error.OutOfMemory;
        defer allocator.free(entries);

        var idx: usize = 0;
        var iter = self.bigram_counts.iterator();
        while (iter.next()) |entry| {
            const decoded = decodeBigramKey(entry.key_ptr.*);
            entries[idx] = .{
                .left = decoded.left,
                .right = decoded.right,
                .count = entry.value_ptr.*,
            };
            idx += 1;
        }

        std.sort.pdq(BigramEntry, entries, {}, bigramEntryLessThan);

        var first = true;
        for (entries) |entry| {
            if (!first) try writer.writeByte(',');
            first = false;
            try writer.print(
                "{{\"left\":\"{}\",\"right\":\"{}\",\"count\":{}}}",
                .{ entry.left, entry.right, entry.count },
            );
        }
    }

    fn writeConditionalEntries(self: *const StreamFreqDistBuilder, writer: anytype) StreamFreqDistError!void {
        const allocator = self.allocator;
        var entries = allocator.alloc(ConditionalEntry, self.conditional_counts.count()) catch return error.OutOfMemory;
        defer allocator.free(entries);

        var idx: usize = 0;
        var iter = self.conditional_counts.iterator();
        while (iter.next()) |entry| {
            const decoded = decodeConditionalKey(entry.key_ptr.*);
            entries[idx] = .{
                .tag_id = decoded.tag_id,
                .hash = decoded.hash,
                .count = entry.value_ptr.*,
            };
            idx += 1;
        }

        std.sort.pdq(ConditionalEntry, entries, {}, conditionalEntryLessThan);

        var first = true;
        for (entries) |entry| {
            if (!first) try writer.writeByte(',');
            first = false;
            try writer.print(
                "{{\"tag_id\":{},\"hash\":\"{}\",\"count\":{}}}",
                .{ entry.tag_id, entry.hash, entry.count },
            );
        }
    }
};

fn encodeBigramKey(left: u64, right: u64) u128 {
    return (@as(u128, left) << 64) | @as(u128, right);
}

fn decodeBigramKey(key: u128) struct { left: u64, right: u64 } {
    return .{
        .left = @as(u64, @intCast(key >> 64)),
        .right = @as(u64, @intCast(key & std.math.maxInt(u64))),
    };
}

fn encodeConditionalKey(tag_id: u16, hash: u64) u128 {
    return (@as(u128, tag_id) << 64) | @as(u128, hash);
}

fn decodeConditionalKey(key: u128) struct { tag_id: u16, hash: u64 } {
    return .{
        .tag_id = @as(u16, @intCast(key >> 64)),
        .hash = @as(u64, @intCast(key & std.math.maxInt(u64))),
    };
}

fn tokenEntryLessThan(_: void, a: TokenEntry, b: TokenEntry) bool {
    return a.hash < b.hash;
}

fn bigramEntryLessThan(_: void, a: BigramEntry, b: BigramEntry) bool {
    if (a.left != b.left) return a.left < b.left;
    return a.right < b.right;
}

fn conditionalEntryLessThan(_: void, a: ConditionalEntry, b: ConditionalEntry) bool {
    if (a.tag_id != b.tag_id) return a.tag_id < b.tag_id;
    return a.hash < b.hash;
}

fn hashToken(token: []const u8) u64 {
    var hash = ascii.FNV_OFFSET_BASIS;
    for (token) |ch| {
        hash = ascii.tokenHashUpdate(hash, ch);
    }
    return hash;
}

test "stream freqdist update and flush across chunk boundaries" {
    const allocator = std.testing.allocator;
    var builder = try StreamFreqDistBuilder.create(allocator);
    defer builder.destroy();

    try builder.updateAscii("Th");
    try builder.updateAscii("is this ");
    try builder.updateAscii("is a test");
    try builder.flush();

    try std.testing.expectEqual(@as(usize, 4), builder.tokenUniqueCount());
    try std.testing.expectEqual(@as(usize, 4), builder.bigramUniqueCount());

    var hashes = [_]u64{0} ** 8;
    var counts = [_]u64{0} ** 8;
    const written = try builder.fillTokenFreq(&hashes, &counts);
    try std.testing.expectEqual(@as(usize, 4), written);

    var out = std.AutoHashMap(u64, u64).init(allocator);
    defer out.deinit();
    for (0..written) |idx| {
        try out.put(hashes[idx], counts[idx]);
    }

    try std.testing.expectEqual(@as(?u64, 2), out.get(hashToken("this")));
    try std.testing.expectEqual(@as(?u64, 1), out.get(hashToken("is")));
    try std.testing.expectEqual(@as(?u64, 1), out.get(hashToken("a")));
    try std.testing.expectEqual(@as(?u64, 1), out.get(hashToken("test")));
}

test "stream freqdist json export" {
    const allocator = std.testing.allocator;
    var builder = try StreamFreqDistBuilder.create(allocator);
    defer builder.destroy();

    try builder.updateAscii("Quickly running quickly");
    try builder.flush();

    const bytes = try builder.countJsonBytes();
    var out = try allocator.alloc(u8, bytes);
    defer allocator.free(out);
    const written = try builder.fillJson(out);
    try std.testing.expectEqual(bytes, written);

    const json = out[0..written];
    try std.testing.expect(std.mem.startsWith(u8, json, "{\"tokens\":["));
    try std.testing.expect(std.mem.indexOf(u8, json, "\"bigrams\":[") != null);
    try std.testing.expect(std.mem.indexOf(u8, json, "\"conditional_tags\":[") != null);
}
