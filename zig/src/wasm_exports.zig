const ascii = @import("core/ascii.zig");

var input_buffer: [128 * 1024 * 1024]u8 = undefined;

pub export fn bunnltk_wasm_input_ptr() u32 {
    return @as(u32, @intCast(@intFromPtr(&input_buffer[0])));
}

pub export fn bunnltk_wasm_input_capacity() u32 {
    return @as(u32, @intCast(input_buffer.len));
}

pub export fn bunnltk_wasm_count_tokens_ascii(input_len: u32) u64 {
    const len = @min(@as(usize, input_len), input_buffer.len);
    return ascii.tokenCountAscii(input_buffer[0..len]);
}

pub export fn bunnltk_wasm_count_ngrams_ascii(input_len: u32, n: u32) u64 {
    if (n == 0) return 0;
    const len = @min(@as(usize, input_len), input_buffer.len);
    const token_count = ascii.tokenCountAscii(input_buffer[0..len]);
    const n_u64 = @as(u64, n);
    if (token_count < n_u64) return 0;
    return token_count - n_u64 + 1;
}

test "wasm exports basic counts" {
    const sample = "this this is is a a test test";
    @memcpy(input_buffer[0..sample.len], sample);

    try @import("std").testing.expectEqual(@as(u64, 8), bunnltk_wasm_count_tokens_ascii(@intCast(sample.len)));
    try @import("std").testing.expectEqual(@as(u64, 7), bunnltk_wasm_count_ngrams_ascii(@intCast(sample.len), 2));
}
