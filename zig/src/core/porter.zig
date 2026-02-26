const std = @import("std");
const ascii = @import("ascii.zig");
const types = @import("types.zig");

fn isConsonant(word: []const u8, i: usize) bool {
    const ch = word[i];
    return switch (ch) {
        'a', 'e', 'i', 'o', 'u' => false,
        'y' => if (i == 0) true else !isConsonant(word, i - 1),
        else => true,
    };
}

fn measure(word: []const u8, len: usize) usize {
    var m: usize = 0;
    var i: usize = 0;

    while (i < len) {
        while (i < len and isConsonant(word, i)) : (i += 1) {}
        if (i >= len) break;
        while (i < len and !isConsonant(word, i)) : (i += 1) {}
        if (i >= len) break;
        m += 1;
    }

    return m;
}

fn containsVowel(word: []const u8, len: usize) bool {
    for (0..len) |i| {
        if (!isConsonant(word, i)) return true;
    }
    return false;
}

fn endsWith(word: []const u8, len: usize, suffix: []const u8) bool {
    if (len < suffix.len) return false;
    return std.mem.eql(u8, word[len - suffix.len .. len], suffix);
}

fn isDoubleConsonant(word: []const u8, len: usize) bool {
    if (len < 2) return false;
    if (word[len - 1] != word[len - 2]) return false;
    return isConsonant(word, len - 1);
}

fn isCvc(word: []const u8, len: usize) bool {
    if (len < 3) return false;

    const c1 = isConsonant(word, len - 1);
    const v = !isConsonant(word, len - 2);
    const c0 = isConsonant(word, len - 3);
    if (!(c0 and v and c1)) return false;

    const ch = word[len - 1];
    return !(ch == 'w' or ch == 'x' or ch == 'y');
}

fn appendE(word: []u8, len_ptr: *usize) void {
    word[len_ptr.*] = 'e';
    len_ptr.* += 1;
}

fn replaceSuffix(word: []u8, len_ptr: *usize, suffix: []const u8, repl: []const u8) void {
    const stem_len = len_ptr.* - suffix.len;
    @memcpy(word[stem_len .. stem_len + repl.len], repl);
    len_ptr.* = stem_len + repl.len;
}

fn step1a(word: []u8, len_ptr: *usize) void {
    if (endsWith(word, len_ptr.*, "sses")) {
        len_ptr.* -= 2;
    } else if (endsWith(word, len_ptr.*, "ies")) {
        len_ptr.* -= 2;
    } else if (endsWith(word, len_ptr.*, "ss")) {
        return;
    } else if (endsWith(word, len_ptr.*, "s")) {
        len_ptr.* -= 1;
    }
}

fn step1bPost(word: []u8, len_ptr: *usize) void {
    if (endsWith(word, len_ptr.*, "at") or endsWith(word, len_ptr.*, "bl") or endsWith(word, len_ptr.*, "iz")) {
        appendE(word, len_ptr);
    } else if (isDoubleConsonant(word, len_ptr.*)) {
        const last = word[len_ptr.* - 1];
        if (!(last == 'l' or last == 's' or last == 'z')) {
            len_ptr.* -= 1;
        }
    } else if (measure(word, len_ptr.*) == 1 and isCvc(word, len_ptr.*)) {
        appendE(word, len_ptr);
    }
}

fn step1b(word: []u8, len_ptr: *usize) void {
    if (endsWith(word, len_ptr.*, "eed")) {
        const stem = len_ptr.* - 3;
        if (measure(word, stem) > 0) len_ptr.* -= 1;
        return;
    }

    if (endsWith(word, len_ptr.*, "ed")) {
        const stem = len_ptr.* - 2;
        if (containsVowel(word, stem)) {
            len_ptr.* = stem;
            step1bPost(word, len_ptr);
        }
        return;
    }

    if (endsWith(word, len_ptr.*, "ing")) {
        const stem = len_ptr.* - 3;
        if (containsVowel(word, stem)) {
            len_ptr.* = stem;
            step1bPost(word, len_ptr);
        }
    }
}

fn step1c(word: []u8, len_ptr: *usize) void {
    if (len_ptr.* == 0) return;
    if (endsWith(word, len_ptr.*, "y") and containsVowel(word, len_ptr.* - 1)) {
        word[len_ptr.* - 1] = 'i';
    }
}

const Rule = struct {
    suffix: []const u8,
    replacement: []const u8,
};

fn applyRulesWithMinMeasure(word: []u8, len_ptr: *usize, rules: []const Rule, min_measure: usize) void {
    for (rules) |rule| {
        if (!endsWith(word, len_ptr.*, rule.suffix)) continue;
        const stem = len_ptr.* - rule.suffix.len;
        if (measure(word, stem) > min_measure) {
            replaceSuffix(word, len_ptr, rule.suffix, rule.replacement);
        }
        return;
    }
}

fn step2(word: []u8, len_ptr: *usize) void {
    const rules = [_]Rule{
        .{ .suffix = "ational", .replacement = "ate" },
        .{ .suffix = "tional", .replacement = "tion" },
        .{ .suffix = "enci", .replacement = "ence" },
        .{ .suffix = "anci", .replacement = "ance" },
        .{ .suffix = "izer", .replacement = "ize" },
        .{ .suffix = "abli", .replacement = "able" },
        .{ .suffix = "alli", .replacement = "al" },
        .{ .suffix = "entli", .replacement = "ent" },
        .{ .suffix = "eli", .replacement = "e" },
        .{ .suffix = "ousli", .replacement = "ous" },
        .{ .suffix = "ization", .replacement = "ize" },
        .{ .suffix = "ation", .replacement = "ate" },
        .{ .suffix = "ator", .replacement = "ate" },
        .{ .suffix = "alism", .replacement = "al" },
        .{ .suffix = "iveness", .replacement = "ive" },
        .{ .suffix = "fulness", .replacement = "ful" },
        .{ .suffix = "ousness", .replacement = "ous" },
        .{ .suffix = "aliti", .replacement = "al" },
        .{ .suffix = "iviti", .replacement = "ive" },
        .{ .suffix = "biliti", .replacement = "ble" },
        .{ .suffix = "logi", .replacement = "log" },
    };
    applyRulesWithMinMeasure(word, len_ptr, &rules, 0);
}

fn step3(word: []u8, len_ptr: *usize) void {
    const rules = [_]Rule{
        .{ .suffix = "icate", .replacement = "ic" },
        .{ .suffix = "ative", .replacement = "" },
        .{ .suffix = "alize", .replacement = "al" },
        .{ .suffix = "iciti", .replacement = "ic" },
        .{ .suffix = "ical", .replacement = "ic" },
        .{ .suffix = "ful", .replacement = "" },
        .{ .suffix = "ness", .replacement = "" },
    };
    applyRulesWithMinMeasure(word, len_ptr, &rules, 0);
}

fn step4(word: []u8, len_ptr: *usize) void {
    const rules = [_][]const u8{
        "ement", "ance", "ence", "able", "ible", "ment", "ant", "ent", "ism", "ate", "iti", "ous", "ive", "ize", "al", "er", "ic", "ou",
    };

    for (rules) |suffix| {
        if (!endsWith(word, len_ptr.*, suffix)) continue;
        const stem = len_ptr.* - suffix.len;
        if (measure(word, stem) > 1) {
            len_ptr.* = stem;
        }
        return;
    }

    if (endsWith(word, len_ptr.*, "ion")) {
        const stem = len_ptr.* - 3;
        if (measure(word, stem) > 1 and stem > 0) {
            const ch = word[stem - 1];
            if (ch == 's' or ch == 't') {
                len_ptr.* = stem;
            }
        }
    }
}

fn step5a(word: []u8, len_ptr: *usize) void {
    if (!endsWith(word, len_ptr.*, "e")) return;
    const stem = len_ptr.* - 1;
    const m = measure(word, stem);
    if (m > 1 or (m == 1 and !isCvc(word, stem))) {
        len_ptr.* = stem;
    }
}

fn step5b(word: []u8, len_ptr: *usize) void {
    if (measure(word, len_ptr.*) > 1 and isDoubleConsonant(word, len_ptr.*) and endsWith(word, len_ptr.*, "l")) {
        len_ptr.* -= 1;
    }
}

pub fn stemPorterAscii(input: []const u8, output: []u8) types.CountError!usize {
    if (output.len < input.len) return error.InsufficientCapacity;
    if (input.len == 0) return 0;

    var len = input.len;
    for (input, 0..) |ch, i| {
        output[i] = ascii.asciiLower(ch);
    }

    if (len <= 2) return len;

    step1a(output, &len);
    step1b(output, &len);
    step1c(output, &len);
    step2(output, &len);
    step3(output, &len);
    step4(output, &len);
    step5a(output, &len);
    step5b(output, &len);

    return len;
}

test "porter sample vectors" {
    const samples = [_][2][]const u8{
        .{ "caresses", "caress" },
        .{ "ponies", "poni" },
        .{ "ties", "ti" },
        .{ "cats", "cat" },
        .{ "feed", "feed" },
        .{ "agreed", "agre" },
        .{ "plastered", "plaster" },
        .{ "motoring", "motor" },
        .{ "sing", "sing" },
        .{ "conflated", "conflat" },
        .{ "hopping", "hop" },
        .{ "filing", "file" },
        .{ "happy", "happi" },
        .{ "sky", "sky" },
        .{ "relational", "relat" },
        .{ "triplicate", "triplic" },
        .{ "probate", "probat" },
        .{ "rate", "rate" },
        .{ "controll", "control" },
        .{ "roll", "roll" },
    };

    var buf = [_]u8{0} ** 64;
    for (samples) |pair| {
        const word = pair[0];
        const expected = pair[1];
        const got_len = try stemPorterAscii(word, &buf);
        try std.testing.expectEqualStrings(expected, buf[0..got_len]);
    }
}
