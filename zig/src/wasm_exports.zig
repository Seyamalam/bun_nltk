const std = @import("std");
const ascii = @import("core/ascii.zig");
const freqdist = @import("core/freqdist.zig");
const normalize = @import("core/normalize.zig");
const error_state = @import("core/error_state.zig");

var input_buffer: [128 * 1024 * 1024]u8 = undefined;

fn ptrFromOffset(comptime T: type, offset: u32) [*]T {
    return @as([*]T, @ptrFromInt(@as(usize, offset)));
}

pub export fn bunnltk_wasm_last_error_code() u32 {
    return error_state.getLastErrorCode();
}

pub export fn bunnltk_wasm_input_ptr() u32 {
    return @as(u32, @intCast(@intFromPtr(&input_buffer[0])));
}

pub export fn bunnltk_wasm_input_capacity() u32 {
    return @as(u32, @intCast(input_buffer.len));
}

pub export fn bunnltk_wasm_alloc(size: u32) u32 {
    error_state.resetError();
    if (size == 0) return 0;
    const bytes = std.heap.wasm_allocator.alloc(u8, @as(usize, size)) catch {
        error_state.setError(.out_of_memory);
        return 0;
    };
    return @as(u32, @intCast(@intFromPtr(bytes.ptr)));
}

pub export fn bunnltk_wasm_free(ptr: u32, size: u32) void {
    if (ptr == 0 or size == 0) return;
    const slice = ptrFromOffset(u8, ptr)[0..@as(usize, size)];
    std.heap.wasm_allocator.free(slice);
}

pub export fn bunnltk_wasm_count_tokens_ascii(input_len: u32) u64 {
    error_state.resetError();
    const len = @min(@as(usize, input_len), input_buffer.len);
    return ascii.tokenCountAscii(input_buffer[0..len]);
}

pub export fn bunnltk_wasm_count_ngrams_ascii(input_len: u32, n: u32) u64 {
    error_state.resetError();
    if (n == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    const len = @min(@as(usize, input_len), input_buffer.len);
    const token_count = ascii.tokenCountAscii(input_buffer[0..len]);
    const n_u64 = @as(u64, n);
    if (token_count < n_u64) return 0;
    return token_count - n_u64 + 1;
}

pub export fn bunnltk_wasm_compute_ascii_metrics(
    input_len: u32,
    n: u32,
    out_metrics_ptr: u32,
    out_metrics_len: u32,
) void {
    error_state.resetError();
    if (out_metrics_len < 4 or out_metrics_ptr == 0) {
        error_state.setError(.insufficient_capacity);
        return;
    }

    const out = ptrFromOffset(u64, out_metrics_ptr)[0..@as(usize, out_metrics_len)];
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    if (n == 0) {
        error_state.setError(.invalid_n);
        return;
    }

    const len = @min(@as(usize, input_len), input_buffer.len);
    const input = input_buffer[0..len];
    out[0] = ascii.tokenCountAscii(input);
    if (out[0] >= @as(u64, n)) {
        out[2] = out[0] - @as(u64, n) + 1;
    }

    var token_map = freqdist.buildTokenFreqMapAscii(input, std.heap.wasm_allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return;
    };
    defer token_map.deinit();
    out[1] = @as(u64, token_map.count());

    var ngram_map = freqdist.buildNgramFreqMapAscii(input, @as(usize, n), std.heap.wasm_allocator) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return;
    };
    defer ngram_map.deinit();
    out[3] = @as(u64, ngram_map.count());
}

pub export fn bunnltk_wasm_count_normalized_tokens_ascii(input_len: u32, remove_stopwords: u32) u64 {
    error_state.resetError();
    const len = @min(@as(usize, input_len), input_buffer.len);
    return normalize.countNormalizedTokensAscii(input_buffer[0..len], remove_stopwords != 0);
}

pub export fn bunnltk_wasm_fill_token_offsets_ascii(
    input_len: u32,
    out_offsets_ptr: u32,
    out_lengths_ptr: u32,
    capacity: u32,
) u64 {
    error_state.resetError();
    if (out_offsets_ptr == 0 or out_lengths_ptr == 0) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }

    const len = @min(@as(usize, input_len), input_buffer.len);
    const cap = @as(usize, capacity);
    const out_offsets = ptrFromOffset(u32, out_offsets_ptr)[0..cap];
    const out_lengths = ptrFromOffset(u32, out_lengths_ptr)[0..cap];

    const total = ascii.fillTokenOffsetsAscii(input_buffer[0..len], out_offsets, out_lengths);
    if (total > capacity) error_state.setError(.insufficient_capacity);
    return total;
}

pub export fn bunnltk_wasm_fill_normalized_token_offsets_ascii(
    input_len: u32,
    remove_stopwords: u32,
    out_offsets_ptr: u32,
    out_lengths_ptr: u32,
    capacity: u32,
) u64 {
    error_state.resetError();
    if (out_offsets_ptr == 0 or out_lengths_ptr == 0) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }

    const len = @min(@as(usize, input_len), input_buffer.len);
    const cap = @as(usize, capacity);
    const out_offsets = ptrFromOffset(u32, out_offsets_ptr)[0..cap];
    const out_lengths = ptrFromOffset(u32, out_lengths_ptr)[0..cap];

    const total = normalize.fillNormalizedTokenOffsetsAscii(
        input_buffer[0..len],
        remove_stopwords != 0,
        out_offsets,
        out_lengths,
    );
    if (total > capacity) error_state.setError(.insufficient_capacity);
    return total;
}

test "wasm exports basic counts and metrics" {
    const sample = "this this is is a a test test";
    @memcpy(input_buffer[0..sample.len], sample);

    try std.testing.expectEqual(@as(u64, 8), bunnltk_wasm_count_tokens_ascii(@intCast(sample.len)));
    try std.testing.expectEqual(@as(u64, 7), bunnltk_wasm_count_ngrams_ascii(@intCast(sample.len), 2));

    const ptr = bunnltk_wasm_alloc(4 * @sizeOf(u64));
    defer bunnltk_wasm_free(ptr, 4 * @sizeOf(u64));
    bunnltk_wasm_compute_ascii_metrics(@intCast(sample.len), 2, ptr, 4);
    try std.testing.expectEqual(@as(u32, 0), bunnltk_wasm_last_error_code());
    const metrics = ptrFromOffset(u64, ptr)[0..4];
    try std.testing.expectEqual(@as(u64, 8), metrics[0]);
    try std.testing.expectEqual(@as(u64, 4), metrics[3]);
}
