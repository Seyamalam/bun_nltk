const std = @import("std");
const ascii = @import("ascii.zig");
const stopwords = @import("stopwords.zig");

pub fn countNormalizedTokensAscii(input: []const u8, remove_stopwords: bool) u64 {
    if (!remove_stopwords) return ascii.tokenCountAscii(input);
    return countNormalizedTokensAsciiScalar(input, remove_stopwords);
}

pub fn countNormalizedTokensAsciiScalar(input: []const u8, remove_stopwords: bool) u64 {
    var total: u64 = 0;
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
            if (!remove_stopwords or !stopwords.isStopwordHash(token_hash)) {
                total += 1;
            }
            in_token = false;
        }
    }

    if (in_token) {
        if (!remove_stopwords or !stopwords.isStopwordHash(token_hash)) {
            total += 1;
        }
    }

    return total;
}

pub fn fillNormalizedTokenOffsetsAscii(
    input: []const u8,
    remove_stopwords: bool,
    out_offsets: []u32,
    out_lengths: []u32,
) u64 {
    if (!remove_stopwords) {
        return ascii.fillTokenOffsetsAscii(input, out_offsets, out_lengths);
    }
    return fillNormalizedTokenOffsetsAsciiScalar(input, remove_stopwords, out_offsets, out_lengths);
}

pub fn fillNormalizedTokenOffsetsAsciiScalar(
    input: []const u8,
    remove_stopwords: bool,
    out_offsets: []u32,
    out_lengths: []u32,
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
            const drop = remove_stopwords and stopwords.isStopwordHash(token_hash);
            if (!drop) {
                if (written < out_offsets.len and token_start <= std.math.maxInt(u32) and token_len <= std.math.maxInt(u32)) {
                    out_offsets[written] = @as(u32, @intCast(token_start));
                    out_lengths[written] = @as(u32, @intCast(token_len));
                    written += 1;
                }
                total += 1;
            }
            in_token = false;
        }
    }

    if (in_token) {
        const token_len = input.len - token_start;
        const drop = remove_stopwords and stopwords.isStopwordHash(token_hash);
        if (!drop) {
            if (written < out_offsets.len and token_start <= std.math.maxInt(u32) and token_len <= std.math.maxInt(u32)) {
                out_offsets[written] = @as(u32, @intCast(token_start));
                out_lengths[written] = @as(u32, @intCast(token_len));
            }
            total += 1;
        }
    }

    return total;
}

test "normalized offsets remove stopwords" {
    const input = "The quick brown fox and the dog";
    try std.testing.expectEqual(@as(u64, 4), countNormalizedTokensAscii(input, true));
    try std.testing.expectEqual(@as(u64, 7), countNormalizedTokensAscii(input, false));

    var offsets = [_]u32{0} ** 8;
    var lengths = [_]u32{0} ** 8;
    const total = fillNormalizedTokenOffsetsAscii(input, true, &offsets, &lengths);
    try std.testing.expectEqual(@as(u64, 4), total);

    try std.testing.expectEqualStrings("quick", input[offsets[0] .. offsets[0] + lengths[0]]);
    try std.testing.expectEqualStrings("brown", input[offsets[1] .. offsets[1] + lengths[1]]);
    try std.testing.expectEqualStrings("fox", input[offsets[2] .. offsets[2] + lengths[2]]);
    try std.testing.expectEqualStrings("dog", input[offsets[3] .. offsets[3] + lengths[3]]);
}
