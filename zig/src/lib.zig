const ffi = @import("ffi_exports.zig");
comptime {
    _ = ffi;
}

test {
    _ = @import("core/ascii.zig");
    _ = @import("core/freqdist.zig");
    _ = @import("core/collocations.zig");
    _ = @import("ffi_exports.zig");
}
