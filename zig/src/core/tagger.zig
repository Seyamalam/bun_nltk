const std = @import("std");
const ascii = @import("ascii.zig");

pub const TagId = enum(u16) {
    nn = 0,
    nnp = 1,
    cd = 2,
    vbg = 3,
    vbd = 4,
    rb = 5,
    dt = 6,
    cc = 7,
    prp = 8,
    vb = 9,
};

fn hashLiteral(comptime token: []const u8) u64 {
    var hash = ascii.FNV_OFFSET_BASIS;
    for (token) |ch| {
        hash = ascii.tokenHashUpdate(hash, ch);
    }
    return hash;
}

fn hasSuffixIgnoreCase(token: []const u8, comptime suffix: []const u8) bool {
    if (token.len < suffix.len) return false;
    const start = token.len - suffix.len;
    for (suffix, 0..) |expected, idx| {
        if (ascii.asciiLower(token[start + idx]) != expected) return false;
    }
    return true;
}

fn isAllDigits(token: []const u8) bool {
    if (token.len == 0) return false;
    for (token) |ch| {
        if (!std.ascii.isDigit(ch)) return false;
    }
    return true;
}

fn isDeterminer(hash: u64) bool {
    return switch (hash) {
        hashLiteral("a"),
        hashLiteral("an"),
        hashLiteral("the"),
        hashLiteral("this"),
        hashLiteral("that"),
        hashLiteral("these"),
        hashLiteral("those"),
        => true,
        else => false,
    };
}

fn isConjunction(hash: u64) bool {
    return switch (hash) {
        hashLiteral("and"),
        hashLiteral("or"),
        hashLiteral("but"),
        hashLiteral("yet"),
        hashLiteral("nor"),
        => true,
        else => false,
    };
}

fn isPronoun(hash: u64) bool {
    return switch (hash) {
        hashLiteral("i"),
        hashLiteral("you"),
        hashLiteral("he"),
        hashLiteral("she"),
        hashLiteral("it"),
        hashLiteral("we"),
        hashLiteral("they"),
        hashLiteral("me"),
        hashLiteral("him"),
        hashLiteral("her"),
        hashLiteral("us"),
        hashLiteral("them"),
        => true,
        else => false,
    };
}

fn isVerbBase(hash: u64) bool {
    return switch (hash) {
        hashLiteral("is"),
        hashLiteral("am"),
        hashLiteral("are"),
        hashLiteral("was"),
        hashLiteral("were"),
        hashLiteral("be"),
        hashLiteral("been"),
        hashLiteral("being"),
        hashLiteral("do"),
        hashLiteral("does"),
        hashLiteral("did"),
        hashLiteral("have"),
        hashLiteral("has"),
        hashLiteral("had"),
        => true,
        else => false,
    };
}

fn classifyToken(token: []const u8, hash: u64) TagId {
    if (isAllDigits(token)) return .cd;
    if (isPronoun(hash)) return .prp;
    if (isDeterminer(hash)) return .dt;
    if (isConjunction(hash)) return .cc;
    if (isVerbBase(hash)) return .vb;
    if (hasSuffixIgnoreCase(token, "ing")) return .vbg;
    if (hasSuffixIgnoreCase(token, "ed")) return .vbd;
    if (hasSuffixIgnoreCase(token, "ly")) return .rb;
    if (token.len > 1 and std.ascii.isUpper(token[0])) return .nnp;
    return .nn;
}

pub fn countPosTagsAscii(input: []const u8) u64 {
    return ascii.tokenCountAscii(input);
}

pub fn fillPosTagsAscii(
    input: []const u8,
    out_offsets: []u32,
    out_lengths: []u32,
    out_tag_ids: []u16,
) u64 {
    var total: u64 = 0;
    var written: usize = 0;
    var in_token = false;
    var token_start: usize = 0;
    var token_hash: u64 = ascii.FNV_OFFSET_BASIS;

    for (input, 0..) |ch, idx| {
        if (ascii.isTokenChar(ch)) {
            if (!in_token) {
                in_token = true;
                token_start = idx;
                token_hash = ascii.FNV_OFFSET_BASIS;
            }
            token_hash = ascii.tokenHashUpdate(token_hash, ch);
        } else if (in_token) {
            const token_len = idx - token_start;
            const token = input[token_start..idx];
            const tag = classifyToken(token, token_hash);
            if (written < out_offsets.len and written < out_lengths.len and written < out_tag_ids.len and token_start <= std.math.maxInt(u32) and token_len <= std.math.maxInt(u32)) {
                out_offsets[written] = @as(u32, @intCast(token_start));
                out_lengths[written] = @as(u32, @intCast(token_len));
                out_tag_ids[written] = @intFromEnum(tag);
                written += 1;
            }
            total += 1;
            in_token = false;
        }
    }

    if (in_token) {
        const token_len = input.len - token_start;
        const token = input[token_start..];
        const tag = classifyToken(token, token_hash);
        if (written < out_offsets.len and written < out_lengths.len and written < out_tag_ids.len and token_start <= std.math.maxInt(u32) and token_len <= std.math.maxInt(u32)) {
            out_offsets[written] = @as(u32, @intCast(token_start));
            out_lengths[written] = @as(u32, @intCast(token_len));
            out_tag_ids[written] = @intFromEnum(tag);
        }
        total += 1;
    }

    return total;
}

test "tagger basic heuristics" {
    const input = "Dr Smith is running quickly and he coded 123";
    var offsets = [_]u32{0} ** 16;
    var lengths = [_]u32{0} ** 16;
    var tags = [_]u16{0} ** 16;

    const total = fillPosTagsAscii(input, &offsets, &lengths, &tags);
    try std.testing.expectEqual(@as(u64, 9), total);
    try std.testing.expectEqual(@intFromEnum(TagId.nnp), tags[0]);
    try std.testing.expectEqual(@intFromEnum(TagId.nnp), tags[1]);
    try std.testing.expectEqual(@intFromEnum(TagId.vb), tags[2]);
    try std.testing.expectEqual(@intFromEnum(TagId.vbg), tags[3]);
    try std.testing.expectEqual(@intFromEnum(TagId.rb), tags[4]);
    try std.testing.expectEqual(@intFromEnum(TagId.cc), tags[5]);
    try std.testing.expectEqual(@intFromEnum(TagId.prp), tags[6]);
    try std.testing.expectEqual(@intFromEnum(TagId.vbd), tags[7]);
    try std.testing.expectEqual(@intFromEnum(TagId.cd), tags[8]);
}
