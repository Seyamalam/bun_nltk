const std = @import("std");

pub const WordNetPos = enum(u32) {
    any = 0,
    noun = 1,
    verb = 2,
    adjective = 3,
    adverb = 4,
};

fn asciiLower(ch: u8) u8 {
    return if (ch >= 'A' and ch <= 'Z') ch + 32 else ch;
}

fn normalizeWord(input: []const u8, out: []u8) usize {
    const take = @min(input.len, out.len);
    for (input[0..take], 0..) |ch, idx| {
        out[idx] = switch (ch) {
            ' ' => '_',
            else => asciiLower(ch),
        };
    }
    return take;
}

fn endsWith(haystack: []const u8, needle: []const u8) bool {
    return haystack.len >= needle.len and std.mem.eql(u8, haystack[haystack.len - needle.len ..], needle);
}

fn writeCandidate(base: []const u8, suffix_trim: usize, suffix_add: []const u8, out: []u8) usize {
    if (base.len < suffix_trim) return 0;
    const left_len = base.len - suffix_trim;
    const total = left_len + suffix_add.len;
    if (total > out.len) return 0;
    @memcpy(out[0..left_len], base[0..left_len]);
    if (suffix_add.len > 0) @memcpy(out[left_len..total], suffix_add);
    return total;
}

fn nounMorph(word: []const u8, out: []u8) usize {
    if (endsWith(word, "ies") and word.len > 3) return writeCandidate(word, 3, "y", out);
    if (endsWith(word, "ves") and word.len > 3) return writeCandidate(word, 3, "f", out);
    if (endsWith(word, "es") and word.len > 2) return writeCandidate(word, 2, "", out);
    if (endsWith(word, "s") and word.len > 1) return writeCandidate(word, 1, "", out);
    return writeCandidate(word, 0, "", out);
}

fn verbMorph(word: []const u8, out: []u8) usize {
    if (endsWith(word, "ies") and word.len > 3) return writeCandidate(word, 3, "y", out);
    if (endsWith(word, "ing") and word.len > 4) return writeCandidate(word, 3, "", out);
    if (endsWith(word, "ed") and word.len > 3) return writeCandidate(word, 2, "", out);
    if (endsWith(word, "s") and word.len > 1) return writeCandidate(word, 1, "", out);
    return writeCandidate(word, 0, "", out);
}

fn adjectiveMorph(word: []const u8, out: []u8) usize {
    if (endsWith(word, "est") and word.len > 3) return writeCandidate(word, 3, "", out);
    if (endsWith(word, "er") and word.len > 2) return writeCandidate(word, 2, "", out);
    return writeCandidate(word, 0, "", out);
}

pub fn morphyAscii(input: []const u8, pos: WordNetPos, out: []u8) usize {
    if (input.len == 0 or out.len == 0) return 0;
    var normalized_buf: [128]u8 = undefined;
    const normalized_len = normalizeWord(input, &normalized_buf);
    const normalized = normalized_buf[0..normalized_len];

    return switch (pos) {
        .noun => nounMorph(normalized, out),
        .verb => verbMorph(normalized, out),
        .adjective => adjectiveMorph(normalized, out),
        .adverb => writeCandidate(normalized, 0, "", out),
        .any => blk: {
            const noun_len = nounMorph(normalized, out);
            if (noun_len > 0) break :blk noun_len;
            const verb_len = verbMorph(normalized, out);
            if (verb_len > 0) break :blk verb_len;
            break :blk adjectiveMorph(normalized, out);
        },
    };
}

test "morphy ascii noun rules" {
    var out: [64]u8 = undefined;
    const len1 = morphyAscii("dogs", .noun, &out);
    try std.testing.expectEqualStrings("dog", out[0..len1]);
    const len2 = morphyAscii("parties", .noun, &out);
    try std.testing.expectEqualStrings("party", out[0..len2]);
}

test "morphy ascii verb and adjective rules" {
    var out: [64]u8 = undefined;
    const len1 = morphyAscii("sprinted", .verb, &out);
    try std.testing.expectEqualStrings("sprint", out[0..len1]);
    const len2 = morphyAscii("faster", .adjective, &out);
    try std.testing.expectEqualStrings("fast", out[0..len2]);
}

