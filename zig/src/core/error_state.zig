const types = @import("types.zig");

var last_error_code: u32 = @intFromEnum(types.ErrorCode.ok);

pub fn setError(code: types.ErrorCode) void {
    last_error_code = @intFromEnum(code);
}

pub fn resetError() void {
    setError(.ok);
}

pub fn getLastErrorCode() u32 {
    return last_error_code;
}
