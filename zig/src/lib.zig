const ffi = @import("ffi_exports.zig");
comptime {
    _ = ffi;
}

test {
    _ = @import("core/ascii.zig");
    _ = @import("core/freqdist.zig");
    _ = @import("core/token_ids.zig");
    _ = @import("core/ngrams.zig");
    _ = @import("core/collocations.zig");
    _ = @import("core/stopwords.zig");
    _ = @import("core/normalize.zig");
    _ = @import("core/porter.zig");
    _ = @import("core/perceptron.zig");
    _ = @import("core/tagger.zig");
    _ = @import("core/punkt.zig");
    _ = @import("core/morphy.zig");
    _ = @import("core/lm.zig");
    _ = @import("core/chunk.zig");
    _ = @import("ffi_exports.zig");
}
