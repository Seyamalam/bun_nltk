const std = @import("std");

const NextToken = struct {
    start: usize,
    len: usize,
    is_upper_start: bool,
    is_lower_start: bool,
};

fn isWhitespace(ch: u8) bool {
    return ch == ' ' or ch == '\n' or ch == '\r' or ch == '\t';
}

fn isSentencePunct(ch: u8) bool {
    return ch == '.' or ch == '!' or ch == '?';
}

fn isCloser(ch: u8) bool {
    return ch == '"' or ch == '\'' or ch == ')' or ch == ']' or ch == '}';
}

fn isTokenChar(ch: u8) bool {
    return std.ascii.isAlphanumeric(ch) or ch == '.';
}

fn isSkippableLeft(ch: u8) bool {
    return isWhitespace(ch) or ch == '"' or ch == '\'' or ch == '(' or ch == ')' or ch == '[' or ch == ']' or ch == '{' or ch == '}';
}

fn lowerAscii(ch: u8) u8 {
    return if (ch >= 'A' and ch <= 'Z') ch + 32 else ch;
}

fn normalizeTokenLower(token: []const u8, out: *[32]u8) []const u8 {
    if (token.len == 0) return "";
    var end = token.len;
    while (end > 0 and token[end - 1] == '.') : (end -= 1) {}
    if (end == 0) return "";
    const write_len = @min(end, out.len);
    for (token[0..write_len], 0..) |ch, idx| {
        out[idx] = lowerAscii(ch);
    }
    return out[0..write_len];
}

fn isKnownAbbrev(token: []const u8) bool {
    var buf: [32]u8 = undefined;
    const norm = normalizeTokenLower(token, &buf);
    if (norm.len == 0) return false;
    return std.mem.eql(u8, norm, "mr") or
        std.mem.eql(u8, norm, "mrs") or
        std.mem.eql(u8, norm, "ms") or
        std.mem.eql(u8, norm, "dr") or
        std.mem.eql(u8, norm, "prof") or
        std.mem.eql(u8, norm, "sr") or
        std.mem.eql(u8, norm, "jr") or
        std.mem.eql(u8, norm, "st") or
        std.mem.eql(u8, norm, "vs") or
        std.mem.eql(u8, norm, "etc") or
        std.mem.eql(u8, norm, "e.g") or
        std.mem.eql(u8, norm, "i.e") or
        std.mem.eql(u8, norm, "u.s") or
        std.mem.eql(u8, norm, "u.k") or
        std.mem.eql(u8, norm, "a.m") or
        std.mem.eql(u8, norm, "p.m");
}

fn isTitleAbbrev(token: []const u8) bool {
    var buf: [32]u8 = undefined;
    const norm = normalizeTokenLower(token, &buf);
    if (norm.len == 0) return false;
    return std.mem.eql(u8, norm, "dr") or std.mem.eql(u8, norm, "prof");
}

fn findPrevToken(input: []const u8, idx: usize) []const u8 {
    if (input.len == 0) return "";
    var end_opt: ?usize = idx;
    while (end_opt) |end| {
        if (!isSkippableLeft(input[end])) break;
        if (end == 0) {
            end_opt = null;
        } else {
            end_opt = end - 1;
        }
    }
    const end = end_opt orelse return "";

    var start: usize = end;
    while (start > 0 and isTokenChar(input[start - 1])) : (start -= 1) {}
    return input[start .. end + 1];
}

fn findNextToken(input: []const u8, idx: usize) ?NextToken {
    if (idx >= input.len) return null;
    var i = idx;
    while (i < input.len and (isWhitespace(input[i]) or isCloser(input[i]))) : (i += 1) {}
    if (i >= input.len) return null;

    const start = i;
    while (i < input.len and isTokenChar(input[i])) : (i += 1) {}
    if (i <= start) return null;
    const first = input[start];
    return .{
        .start = start,
        .len = i - start,
        .is_upper_start = first >= 'A' and first <= 'Z',
        .is_lower_start = first >= 'a' and first <= 'z',
    };
}

fn shouldSplitAt(input: []const u8, punct_idx: usize) bool {
    const punct = input[punct_idx];
    const prev = if (punct_idx > 0) input[punct_idx - 1] else 0;
    const next = if (punct_idx + 1 < input.len) input[punct_idx + 1] else 0;

    if (punct == '.' and std.ascii.isDigit(prev) and std.ascii.isDigit(next)) return false;
    if (punct == '.' and next == '.') return false;

    if (punct == '.' and std.ascii.isAlphabetic(next) and punct_idx + 2 < input.len and input[punct_idx + 2] == '.') {
        return false;
    }

    const prev_token = findPrevToken(input, if (punct_idx == 0) 0 else punct_idx - 1);
    const look = findNextToken(input, punct_idx + 1) orelse return true;

    if (punct == '.' and isKnownAbbrev(prev_token)) {
        if (isTitleAbbrev(prev_token) and look.is_upper_start) return false;
        if (look.is_lower_start) return false;
    }

    if (look.is_upper_start) return true;
    if (std.ascii.isDigit(input[look.start])) return true;
    if (punct == '!' or punct == '?') return true;
    return false;
}

fn trimRange(input: []const u8, start: usize, end: usize) struct { start: usize, end: usize } {
    var s = start;
    var e = end;
    while (s < e and isWhitespace(input[s])) : (s += 1) {}
    while (e > s and isWhitespace(input[e - 1])) : (e -= 1) {}
    return .{ .start = s, .end = e };
}

pub fn countSentenceOffsetsAscii(input: []const u8) u64 {
    var total: u64 = 0;
    var start: usize = 0;
    var i: usize = 0;
    while (i < input.len) : (i += 1) {
        if (!isSentencePunct(input[i])) continue;
        if (!shouldSplitAt(input, i)) continue;

        var end = i + 1;
        while (end < input.len and isCloser(input[end])) : (end += 1) {}
        const trimmed = trimRange(input, start, end);
        if (trimmed.end > trimmed.start) total += 1;
        start = end;
    }

    const tail = trimRange(input, start, input.len);
    if (tail.end > tail.start) total += 1;
    return total;
}

pub fn fillSentenceOffsetsAscii(input: []const u8, out_offsets: []u32, out_lengths: []u32) u64 {
    var total: u64 = 0;
    var written: usize = 0;
    var start: usize = 0;
    var i: usize = 0;

    while (i < input.len) : (i += 1) {
        if (!isSentencePunct(input[i])) continue;
        if (!shouldSplitAt(input, i)) continue;

        var end = i + 1;
        while (end < input.len and isCloser(input[end])) : (end += 1) {}
        const trimmed = trimRange(input, start, end);
        if (trimmed.end > trimmed.start) {
            if (written < out_offsets.len) {
                const len = trimmed.end - trimmed.start;
                if (trimmed.start <= std.math.maxInt(u32) and len <= std.math.maxInt(u32)) {
                    out_offsets[written] = @intCast(trimmed.start);
                    out_lengths[written] = @intCast(len);
                    written += 1;
                }
            }
            total += 1;
        }
        start = end;
    }

    const tail = trimRange(input, start, input.len);
    if (tail.end > tail.start) {
        if (written < out_offsets.len) {
            const len = tail.end - tail.start;
            if (tail.start <= std.math.maxInt(u32) and len <= std.math.maxInt(u32)) {
                out_offsets[written] = @intCast(tail.start);
                out_lengths[written] = @intCast(len);
            }
        }
        total += 1;
    }

    return total;
}

test "punkt sentence offsets basic behavior" {
    const input = "Dr. Smith lives in the U.S. He works at 9 a.m.";
    var offsets = [_]u32{0} ** 4;
    var lengths = [_]u32{0} ** 4;
    const total = fillSentenceOffsetsAscii(input, &offsets, &lengths);
    try std.testing.expectEqual(@as(u64, 2), total);
    try std.testing.expectEqualStrings("Dr. Smith lives in the U.S.", input[offsets[0] .. offsets[0] + lengths[0]]);
    try std.testing.expectEqualStrings("He works at 9 a.m.", input[offsets[1] .. offsets[1] + lengths[1]]);
}

test "punkt sentence offsets title abbreviations and punctuation" {
    const input = "Prof. Ada wrote this. Did Dr. Bob agree? Yes!";
    try std.testing.expectEqual(@as(u64, 3), countSentenceOffsetsAscii(input));
}

