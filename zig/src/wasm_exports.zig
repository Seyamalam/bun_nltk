const std = @import("std");
const ascii = @import("core/ascii.zig");
const freqdist = @import("core/freqdist.zig");
const normalize = @import("core/normalize.zig");
const perceptron = @import("core/perceptron.zig");
const punkt = @import("core/punkt.zig");
const morphy = @import("core/morphy.zig");
const lm = @import("core/lm.zig");
const chunk = @import("core/chunk.zig");
const cyk = @import("core/cyk.zig");
const naive_bayes = @import("core/naive_bayes.zig");
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

pub export fn bunnltk_wasm_count_sentences_punkt_ascii(input_len: u32) u64 {
    error_state.resetError();
    const len = @min(@as(usize, input_len), input_buffer.len);
    return punkt.countSentenceOffsetsAscii(input_buffer[0..len]);
}

pub export fn bunnltk_wasm_fill_sentence_offsets_punkt_ascii(
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
    const total = punkt.fillSentenceOffsetsAscii(input_buffer[0..len], out_offsets, out_lengths);
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

pub export fn bunnltk_wasm_perceptron_predict_batch(
    feature_ids_ptr: u32,
    feature_ids_len: u32,
    token_offsets_ptr: u32,
    token_count: u32,
    weights_ptr: u32,
    model_feature_count: u32,
    tag_count: u32,
    out_tag_ids_ptr: u32,
) void {
    error_state.resetError();
    if (token_count == 0 or tag_count == 0) return;
    if (feature_ids_ptr == 0 or token_offsets_ptr == 0 or weights_ptr == 0 or out_tag_ids_ptr == 0) {
        error_state.setError(.insufficient_capacity);
        return;
    }

    perceptron.predictBatch(
        ptrFromOffset(u32, feature_ids_ptr)[0..@as(usize, feature_ids_len)],
        ptrFromOffset(u32, token_offsets_ptr)[0..@as(usize, token_count + 1)],
        ptrFromOffset(f32, weights_ptr)[0..@as(usize, model_feature_count * tag_count)],
        model_feature_count,
        tag_count,
        ptrFromOffset(u16, out_tag_ids_ptr)[0..@as(usize, token_count)],
        std.heap.wasm_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidDimensions => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
        }
    };
}

pub export fn bunnltk_wasm_wordnet_morphy_ascii(
    input_len: u32,
    pos: u32,
    out_ptr: u32,
    out_capacity: u32,
) u32 {
    error_state.resetError();
    if (out_ptr == 0 or out_capacity == 0) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }
    const len = @min(@as(usize, input_len), input_buffer.len);
    const out = ptrFromOffset(u8, out_ptr)[0..@as(usize, out_capacity)];
    const pos_tag: morphy.WordNetPos = switch (pos) {
        1 => .noun,
        2 => .verb,
        3 => .adjective,
        4 => .adverb,
        else => .any,
    };
    const written = morphy.morphyAscii(input_buffer[0..len], pos_tag, out);
    if (written == 0) error_state.setError(.insufficient_capacity);
    return @intCast(written);
}

fn lmModelTypeFromU32(value: u32) lm.ModelType {
    return switch (value) {
        0 => .mle,
        1 => .lidstone,
        else => .kneser_ney_interpolated,
    };
}

pub export fn bunnltk_wasm_lm_eval_ids(
    token_ids_ptr: u32,
    token_ids_len: u32,
    sentence_offsets_ptr: u32,
    sentence_offsets_len: u32,
    order: u32,
    model_type: u32,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
    probe_context_flat_ptr: u32,
    probe_context_flat_len: u32,
    probe_context_lens_ptr: u32,
    probe_words_ptr: u32,
    probe_count: u32,
    out_scores_ptr: u32,
    out_scores_len: u32,
    perplexity_tokens_ptr: u32,
    perplexity_len: u32,
    prefix_tokens_ptr: u32,
    prefix_len: u32,
) f64 {
    error_state.resetError();
    if (token_ids_ptr == 0 or sentence_offsets_ptr == 0 or out_scores_ptr == 0) {
        error_state.setError(.insufficient_capacity);
        return std.math.inf(f64);
    }
    if (order == 0 or order > 3) {
        error_state.setError(.invalid_n);
        return std.math.inf(f64);
    }

    return lm.evalIds(
        ptrFromOffset(u32, token_ids_ptr)[0..@as(usize, token_ids_len)],
        ptrFromOffset(u32, sentence_offsets_ptr)[0..@as(usize, sentence_offsets_len)],
        order,
        lmModelTypeFromU32(model_type),
        gamma,
        discount,
        vocab_size,
        ptrFromOffset(u32, probe_context_flat_ptr)[0..@as(usize, probe_context_flat_len)],
        ptrFromOffset(u32, probe_context_lens_ptr)[0..@as(usize, probe_count)],
        ptrFromOffset(u32, probe_words_ptr)[0..@as(usize, probe_count)],
        ptrFromOffset(f64, out_scores_ptr)[0..@as(usize, out_scores_len)],
        ptrFromOffset(u32, perplexity_tokens_ptr)[0..@as(usize, perplexity_len)],
        ptrFromOffset(u32, prefix_tokens_ptr)[0..@as(usize, prefix_len)],
        std.heap.wasm_allocator,
    ) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return std.math.inf(f64);
    };
}

pub export fn bunnltk_wasm_chunk_iob_ids(
    token_tag_ids_ptr: u32,
    token_count: u32,
    atom_allowed_offsets_ptr: u32,
    atom_allowed_lengths_ptr: u32,
    atom_allowed_flat_ptr: u32,
    atom_allowed_flat_len: u32,
    atom_mins_ptr: u32,
    atom_maxs_ptr: u32,
    atom_count: u32,
    rule_atom_offsets_ptr: u32,
    rule_atom_counts_ptr: u32,
    rule_label_ids_ptr: u32,
    rule_count: u32,
    out_label_ids_ptr: u32,
    out_begin_ptr: u32,
    out_capacity: u32,
) u64 {
    error_state.resetError();
    if (token_count == 0) return 0;
    if (token_tag_ids_ptr == 0 or out_label_ids_ptr == 0 or out_begin_ptr == 0) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }
    if (out_capacity < token_count) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }
    return chunk.fillChunkIobIds(
        ptrFromOffset(u16, token_tag_ids_ptr)[0..@as(usize, token_count)],
        ptrFromOffset(u32, atom_allowed_offsets_ptr)[0..@as(usize, atom_count)],
        ptrFromOffset(u32, atom_allowed_lengths_ptr)[0..@as(usize, atom_count)],
        ptrFromOffset(u16, atom_allowed_flat_ptr)[0..@as(usize, atom_allowed_flat_len)],
        ptrFromOffset(u8, atom_mins_ptr)[0..@as(usize, atom_count)],
        ptrFromOffset(u8, atom_maxs_ptr)[0..@as(usize, atom_count)],
        ptrFromOffset(u32, rule_atom_offsets_ptr)[0..@as(usize, rule_count)],
        ptrFromOffset(u32, rule_atom_counts_ptr)[0..@as(usize, rule_count)],
        ptrFromOffset(u16, rule_label_ids_ptr)[0..@as(usize, rule_count)],
        ptrFromOffset(u16, out_label_ids_ptr)[0..@as(usize, out_capacity)],
        ptrFromOffset(u8, out_begin_ptr)[0..@as(usize, out_capacity)],
    );
}

pub export fn bunnltk_wasm_cyk_recognize_ids(
    token_bits_ptr: u32,
    token_count: u32,
    binary_left_ptr: u32,
    binary_right_ptr: u32,
    binary_parent_ptr: u32,
    binary_count: u32,
    unary_child_ptr: u32,
    unary_parent_ptr: u32,
    unary_count: u32,
    start_symbol: u32,
) u32 {
    error_state.resetError();
    if (token_count == 0) return 0;
    if (token_bits_ptr == 0 or binary_left_ptr == 0 or binary_right_ptr == 0 or binary_parent_ptr == 0) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }
    if (start_symbol >= 64) {
        error_state.setError(.invalid_n);
        return 0;
    }
    const ok = cyk.cykRecognize(
        ptrFromOffset(u64, token_bits_ptr)[0..@as(usize, token_count)],
        ptrFromOffset(u16, binary_left_ptr)[0..@as(usize, binary_count)],
        ptrFromOffset(u16, binary_right_ptr)[0..@as(usize, binary_count)],
        ptrFromOffset(u16, binary_parent_ptr)[0..@as(usize, binary_count)],
        ptrFromOffset(u16, unary_child_ptr)[0..@as(usize, unary_count)],
        ptrFromOffset(u16, unary_parent_ptr)[0..@as(usize, unary_count)],
        @as(u16, @intCast(start_symbol)),
        std.heap.wasm_allocator,
    ) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
    return if (ok) 1 else 0;
}

pub export fn bunnltk_wasm_naive_bayes_log_scores_ids(
    doc_token_ids_ptr: u32,
    doc_token_count: u32,
    vocab_size: u32,
    token_counts_matrix_ptr: u32,
    token_counts_matrix_len: u32,
    label_doc_counts_ptr: u32,
    label_token_totals_ptr: u32,
    label_count: u32,
    total_docs: u32,
    smoothing: f64,
    out_scores_ptr: u32,
    out_scores_len: u32,
) void {
    error_state.resetError();
    if (label_count == 0) {
        error_state.setError(.insufficient_capacity);
        return;
    }
    if (doc_token_ids_ptr == 0 or token_counts_matrix_ptr == 0 or label_doc_counts_ptr == 0 or label_token_totals_ptr == 0 or out_scores_ptr == 0) {
        error_state.setError(.insufficient_capacity);
        return;
    }
    naive_bayes.logScores(
        ptrFromOffset(u32, doc_token_ids_ptr)[0..@as(usize, doc_token_count)],
        vocab_size,
        ptrFromOffset(u32, token_counts_matrix_ptr)[0..@as(usize, token_counts_matrix_len)],
        ptrFromOffset(u32, label_doc_counts_ptr)[0..@as(usize, label_count)],
        ptrFromOffset(u32, label_token_totals_ptr)[0..@as(usize, label_count)],
        total_docs,
        smoothing,
        ptrFromOffset(f64, out_scores_ptr)[0..@as(usize, out_scores_len)],
    );
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

test "wasm perceptron batch prediction" {
    const feature_ids = [_]u32{ 0, 1, 1 };
    const token_offsets = [_]u32{ 0, 1, 3 };
    const weights = [_]f32{
        // feature 0 -> tag0=1, tag1=0
        1.0, 0.0,
        // feature 1 -> tag0=0, tag1=1
        0.0, 1.0,
    };
    var out = [_]u16{0} ** 2;

    const fid_ptr = bunnltk_wasm_alloc(@as(u32, @intCast(feature_ids.len * @sizeOf(u32))));
    defer bunnltk_wasm_free(fid_ptr, @as(u32, @intCast(feature_ids.len * @sizeOf(u32))));
    const off_ptr = bunnltk_wasm_alloc(@as(u32, @intCast(token_offsets.len * @sizeOf(u32))));
    defer bunnltk_wasm_free(off_ptr, @as(u32, @intCast(token_offsets.len * @sizeOf(u32))));
    const w_ptr = bunnltk_wasm_alloc(@as(u32, @intCast(weights.len * @sizeOf(f32))));
    defer bunnltk_wasm_free(w_ptr, @as(u32, @intCast(weights.len * @sizeOf(f32))));
    const out_ptr = bunnltk_wasm_alloc(@as(u32, @intCast(out.len * @sizeOf(u16))));
    defer bunnltk_wasm_free(out_ptr, @as(u32, @intCast(out.len * @sizeOf(u16))));

    @memcpy(ptrFromOffset(u32, fid_ptr)[0..feature_ids.len], feature_ids[0..]);
    @memcpy(ptrFromOffset(u32, off_ptr)[0..token_offsets.len], token_offsets[0..]);
    @memcpy(ptrFromOffset(f32, w_ptr)[0..weights.len], weights[0..]);

    bunnltk_wasm_perceptron_predict_batch(fid_ptr, feature_ids.len, off_ptr, 2, w_ptr, 2, 2, out_ptr);
    try std.testing.expectEqual(@as(u32, 0), bunnltk_wasm_last_error_code());

    @memcpy(out[0..], ptrFromOffset(u16, out_ptr)[0..out.len]);
    try std.testing.expectEqual(@as(u16, 0), out[0]);
    try std.testing.expectEqual(@as(u16, 1), out[1]);
}
