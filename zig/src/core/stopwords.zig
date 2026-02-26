const ascii = @import("ascii.zig");

fn hashLiteral(comptime token: []const u8) u64 {
    var hash = ascii.FNV_OFFSET_BASIS;
    for (token) |ch| {
        hash = ascii.tokenHashUpdate(hash, ch);
    }
    return hash;
}

pub fn isStopwordHash(hash: u64) bool {
    return switch (hash) {
        hashLiteral("a"),
        hashLiteral("an"),
        hashLiteral("and"),
        hashLiteral("are"),
        hashLiteral("as"),
        hashLiteral("at"),
        hashLiteral("be"),
        hashLiteral("but"),
        hashLiteral("by"),
        hashLiteral("for"),
        hashLiteral("if"),
        hashLiteral("in"),
        hashLiteral("into"),
        hashLiteral("is"),
        hashLiteral("it"),
        hashLiteral("no"),
        hashLiteral("not"),
        hashLiteral("of"),
        hashLiteral("on"),
        hashLiteral("or"),
        hashLiteral("such"),
        hashLiteral("that"),
        hashLiteral("the"),
        hashLiteral("their"),
        hashLiteral("then"),
        hashLiteral("there"),
        hashLiteral("these"),
        hashLiteral("they"),
        hashLiteral("this"),
        hashLiteral("to"),
        hashLiteral("was"),
        hashLiteral("will"),
        hashLiteral("with"),
        hashLiteral("you"),
        hashLiteral("your"),
        hashLiteral("we"),
        hashLiteral("our"),
        hashLiteral("he"),
        hashLiteral("she"),
        hashLiteral("him"),
        hashLiteral("her"),
        hashLiteral("them"),
        hashLiteral("from"),
        hashLiteral("up"),
        hashLiteral("down"),
        hashLiteral("out"),
        hashLiteral("over"),
        hashLiteral("under"),
        hashLiteral("again"),
        hashLiteral("further"),
        hashLiteral("once"),
        hashLiteral("here"),
        hashLiteral("when"),
        hashLiteral("where"),
        hashLiteral("why"),
        hashLiteral("how"),
        hashLiteral("all"),
        hashLiteral("any"),
        hashLiteral("both"),
        hashLiteral("each"),
        hashLiteral("few"),
        hashLiteral("more"),
        hashLiteral("most"),
        hashLiteral("other"),
        hashLiteral("some"),
        hashLiteral("than"),
        hashLiteral("too"),
        hashLiteral("very"),
        hashLiteral("can"),
        hashLiteral("just"),
        hashLiteral("should"),
        hashLiteral("now"),
        hashLiteral("i"),
        hashLiteral("me"),
        hashLiteral("my"),
        hashLiteral("myself"),
        hashLiteral("yours"),
        hashLiteral("ours"),
        hashLiteral("ourselves"),
        hashLiteral("themselves"),
        => true,
        else => false,
    };
}

test "stopword hash contains expected members" {
    try @import("std").testing.expect(isStopwordHash(hashLiteral("the")));
    try @import("std").testing.expect(isStopwordHash(hashLiteral("and")));
    try @import("std").testing.expect(!isStopwordHash(hashLiteral("zig")));
}
