const std = @import("std");
const ascii = @import("core/ascii.zig");
const freqdist = @import("core/freqdist.zig");
const collocations = @import("core/collocations.zig");
const token_ids = @import("core/token_ids.zig");
const ngrams = @import("core/ngrams.zig");
const normalize = @import("core/normalize.zig");
const porter = @import("core/porter.zig");
const tagger = @import("core/tagger.zig");
const stream_freqdist = @import("core/stream_freqdist.zig");
const types = @import("core/types.zig");
const error_state = @import("core/error_state.zig");

pub export fn bunnltk_last_error_code() u32 {
    return error_state.getLastErrorCode();
}

fn streamHandleFromPtr(ptr: *stream_freqdist.StreamFreqDistBuilder) u64 {
    return @as(u64, @intCast(@intFromPtr(ptr)));
}

fn streamPtrFromHandle(handle: u64) ?*stream_freqdist.StreamFreqDistBuilder {
    if (handle == 0) return null;
    return @as(*stream_freqdist.StreamFreqDistBuilder, @ptrFromInt(@as(usize, @intCast(handle))));
}

pub export fn bunnltk_count_tokens_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;
    return ascii.tokenCountAscii(input_ptr[0..input_len]);
}

pub export fn bunnltk_compute_ascii_metrics(
    input_ptr: [*]const u8,
    input_len: usize,
    n: u32,
    out_metrics_ptr: [*]u64,
    out_metrics_len: usize,
) void {
    error_state.resetError();
    if (out_metrics_len < 4) {
        error_state.setError(.insufficient_capacity);
        return;
    }

    const out = out_metrics_ptr[0..out_metrics_len];
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    if (input_len == 0) return;
    if (n == 0) {
        error_state.setError(.invalid_n);
        return;
    }

    const input = input_ptr[0..input_len];
    out[0] = ascii.tokenCountAscii(input);

    var tok_map = freqdist.buildTokenFreqMapAscii(input, std.heap.c_allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return;
    };
    defer tok_map.deinit();
    out[1] = @as(u64, tok_map.count());

    const n_usize = @as(usize, n);
    if (out[0] >= @as(u64, n)) {
        out[2] = out[0] - @as(u64, n) + 1;
    } else {
        out[2] = 0;
    }

    var ngram_map = freqdist.buildNgramFreqMapAscii(input, n_usize, std.heap.c_allocator) catch |err| {
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

pub export fn bunnltk_count_unique_tokens_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;

    var map = freqdist.buildTokenFreqMapAscii(input_ptr[0..input_len], std.heap.c_allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer map.deinit();

    return @as(u64, map.count());
}

pub export fn bunnltk_count_ngrams_ascii(input_ptr: [*]const u8, input_len: usize, n: u32) u64 {
    error_state.resetError();
    if (n == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    const token_count = ascii.tokenCountAscii(input_ptr[0..input_len]);
    const n_u64 = @as(u64, n);
    if (token_count < n_u64) return 0;
    return token_count - n_u64 + 1;
}

pub export fn bunnltk_count_unique_ngrams_ascii(input_ptr: [*]const u8, input_len: usize, n: u32) u64 {
    error_state.resetError();
    if (n == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    var map = freqdist.buildNgramFreqMapAscii(input_ptr[0..input_len], @as(usize, n), std.heap.c_allocator) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer map.deinit();

    return @as(u64, map.count());
}

pub export fn bunnltk_fill_token_freqdist_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    out_hashes_ptr: [*]u64,
    out_counts_ptr: [*]u64,
    capacity: usize,
) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;

    var map = freqdist.buildTokenFreqMapAscii(input_ptr[0..input_len], std.heap.c_allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer map.deinit();

    const unique = map.count();
    freqdist.fillFromMap(&map, out_hashes_ptr[0..capacity], out_counts_ptr[0..capacity]) catch |err| {
        switch (err) {
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            else => unreachable,
        }
    };

    return @as(u64, unique);
}

pub export fn bunnltk_fill_ngram_freqdist_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    n: u32,
    out_hashes_ptr: [*]u64,
    out_counts_ptr: [*]u64,
    capacity: usize,
) u64 {
    error_state.resetError();
    if (n == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    var map = freqdist.buildNgramFreqMapAscii(input_ptr[0..input_len], @as(usize, n), std.heap.c_allocator) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer map.deinit();

    const unique = map.count();
    freqdist.fillFromMap(&map, out_hashes_ptr[0..capacity], out_counts_ptr[0..capacity]) catch |err| {
        switch (err) {
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            else => unreachable,
        }
    };

    return @as(u64, unique);
}

pub export fn bunnltk_fill_token_offsets_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    out_offsets_ptr: [*]u32,
    out_lengths_ptr: [*]u32,
    capacity: usize,
) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;

    const out_offsets = out_offsets_ptr[0..capacity];
    const out_lengths = out_lengths_ptr[0..capacity];
    if (out_offsets.len != out_lengths.len) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }

    const total = ascii.fillTokenOffsetsAscii(input_ptr[0..input_len], out_offsets, out_lengths);
    if (total > capacity) error_state.setError(.insufficient_capacity);
    return total;
}

pub export fn bunnltk_count_normalized_tokens_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    remove_stopwords: u32,
) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;
    return normalize.countNormalizedTokensAscii(input_ptr[0..input_len], remove_stopwords != 0);
}

pub export fn bunnltk_fill_normalized_token_offsets_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    remove_stopwords: u32,
    out_offsets_ptr: [*]u32,
    out_lengths_ptr: [*]u32,
    capacity: usize,
) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;

    const out_offsets = out_offsets_ptr[0..capacity];
    const out_lengths = out_lengths_ptr[0..capacity];
    if (out_offsets.len != out_lengths.len) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }

    const total = normalize.fillNormalizedTokenOffsetsAscii(
        input_ptr[0..input_len],
        remove_stopwords != 0,
        out_offsets,
        out_lengths,
    );
    if (total > capacity) error_state.setError(.insufficient_capacity);
    return total;
}

pub export fn bunnltk_fill_top_pmi_bigrams_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    top_k: u32,
    out_left_hashes_ptr: [*]u64,
    out_right_hashes_ptr: [*]u64,
    out_scores_ptr: [*]f64,
    capacity: usize,
) u64 {
    error_state.resetError();
    if (input_len == 0 or top_k == 0) return 0;

    if (@as(usize, top_k) > capacity) error_state.setError(.insufficient_capacity);

    return collocations.fillTopPmiBigramsAscii(
        input_ptr[0..input_len],
        2,
        @as(usize, top_k),
        out_left_hashes_ptr[0..capacity],
        out_right_hashes_ptr[0..capacity],
        out_scores_ptr[0..capacity],
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
}

pub export fn bunnltk_fill_top_pmi_bigrams_window_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    window_size: u32,
    top_k: u32,
    out_left_hashes_ptr: [*]u64,
    out_right_hashes_ptr: [*]u64,
    out_scores_ptr: [*]f64,
    capacity: usize,
) u64 {
    error_state.resetError();
    if (input_len == 0 or top_k == 0) return 0;
    if (window_size < 2) {
        error_state.setError(.invalid_n);
        return 0;
    }

    if (@as(usize, top_k) > capacity) error_state.setError(.insufficient_capacity);

    return collocations.fillTopPmiBigramsAscii(
        input_ptr[0..input_len],
        @as(usize, window_size),
        @as(usize, top_k),
        out_left_hashes_ptr[0..capacity],
        out_right_hashes_ptr[0..capacity],
        out_scores_ptr[0..capacity],
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
}

pub export fn bunnltk_count_token_blob_bytes_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;

    return token_ids.countTokenBlobBytesAscii(input_ptr[0..input_len], std.heap.c_allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
}

pub export fn bunnltk_fill_token_freqdist_ids_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    out_blob_ptr: [*]u8,
    blob_capacity: usize,
    out_offsets_ptr: [*]u32,
    out_lengths_ptr: [*]u32,
    out_counts_ptr: [*]u64,
    vocab_capacity: usize,
) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;

    var data = token_ids.buildTokenIdDataAscii(input_ptr[0..input_len], std.heap.c_allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    defer data.deinit();

    token_ids.fillTokenFreqDistIdsAscii(
        &data,
        out_blob_ptr[0..blob_capacity],
        out_offsets_ptr[0..vocab_capacity],
        out_lengths_ptr[0..vocab_capacity],
        out_counts_ptr[0..vocab_capacity],
    ) catch |err| {
        switch (err) {
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
    };

    return @as(u64, data.uniqueCount());
}

pub export fn bunnltk_count_unique_bigrams_window_ascii_ids(
    input_ptr: [*]const u8,
    input_len: usize,
    window_size: u32,
) u64 {
    error_state.resetError();
    if (window_size < 2) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return collocations.countUniqueBigramsWindowIdsAscii(input_ptr[0..input_len], @as(usize, window_size), std.heap.c_allocator) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
}

pub export fn bunnltk_fill_bigram_window_stats_ascii_ids(
    input_ptr: [*]const u8,
    input_len: usize,
    window_size: u32,
    out_left_ids_ptr: [*]u32,
    out_right_ids_ptr: [*]u32,
    out_counts_ptr: [*]u64,
    out_pmis_ptr: [*]f64,
    capacity: usize,
) u64 {
    error_state.resetError();
    if (window_size < 2) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return collocations.fillBigramWindowStatsIdsAscii(
        input_ptr[0..input_len],
        @as(usize, window_size),
        out_left_ids_ptr[0..capacity],
        out_right_ids_ptr[0..capacity],
        out_counts_ptr[0..capacity],
        out_pmis_ptr[0..capacity],
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
}

pub export fn bunnltk_count_ngrams_ascii_ids(input_ptr: [*]const u8, input_len: usize, n: u32) u64 {
    error_state.resetError();
    if (n == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return ngrams.countNgramsIdsAscii(input_ptr[0..input_len], @as(usize, n), std.heap.c_allocator) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
}

pub export fn bunnltk_fill_ngrams_ascii_ids(
    input_ptr: [*]const u8,
    input_len: usize,
    n: u32,
    out_flat_ids_ptr: [*]u32,
    out_ids_capacity: usize,
) u64 {
    error_state.resetError();
    if (n == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return ngrams.fillNgramsIdsAscii(
        input_ptr[0..input_len],
        @as(usize, n),
        out_flat_ids_ptr[0..out_ids_capacity],
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
}

pub export fn bunnltk_count_everygrams_ascii_ids(
    input_ptr: [*]const u8,
    input_len: usize,
    min_len: u32,
    max_len: u32,
) u64 {
    error_state.resetError();
    if (min_len == 0 or max_len == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return ngrams.countEverygramsIdsAscii(
        input_ptr[0..input_len],
        @as(usize, min_len),
        @as(usize, max_len),
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
}

pub export fn bunnltk_count_everygram_id_values_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    min_len: u32,
    max_len: u32,
) u64 {
    error_state.resetError();
    if (min_len == 0 or max_len == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return ngrams.countEverygramIdValuesAscii(
        input_ptr[0..input_len],
        @as(usize, min_len),
        @as(usize, max_len),
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
}

pub export fn bunnltk_fill_everygrams_ascii_ids(
    input_ptr: [*]const u8,
    input_len: usize,
    min_len: u32,
    max_len: u32,
    out_lens_ptr: [*]u32,
    out_lens_capacity: usize,
    out_flat_ids_ptr: [*]u32,
    out_ids_capacity: usize,
) u64 {
    error_state.resetError();
    if (min_len == 0 or max_len == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return ngrams.fillEverygramsIdsAscii(
        input_ptr[0..input_len],
        @as(usize, min_len),
        @as(usize, max_len),
        out_lens_ptr[0..out_lens_capacity],
        out_flat_ids_ptr[0..out_ids_capacity],
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
}

pub export fn bunnltk_count_skipgrams_ascii_ids(
    input_ptr: [*]const u8,
    input_len: usize,
    n: u32,
    k: u32,
) u64 {
    error_state.resetError();
    if (n == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return ngrams.countSkipgramsIdsAscii(
        input_ptr[0..input_len],
        @as(usize, n),
        @as(usize, k),
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
}

pub export fn bunnltk_fill_skipgrams_ascii_ids(
    input_ptr: [*]const u8,
    input_len: usize,
    n: u32,
    k: u32,
    out_flat_ids_ptr: [*]u32,
    out_ids_capacity: usize,
) u64 {
    error_state.resetError();
    if (n == 0) {
        error_state.setError(.invalid_n);
        return 0;
    }
    if (input_len == 0) return 0;

    return ngrams.fillSkipgramsIdsAscii(
        input_ptr[0..input_len],
        @as(usize, n),
        @as(usize, k),
        out_flat_ids_ptr[0..out_ids_capacity],
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidN => error_state.setError(.invalid_n),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
}

pub export fn bunnltk_count_pos_tags_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;
    return tagger.countPosTagsAscii(input_ptr[0..input_len]);
}

pub export fn bunnltk_fill_pos_tags_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    out_offsets_ptr: [*]u32,
    out_lengths_ptr: [*]u32,
    out_tag_ids_ptr: [*]u16,
    capacity: usize,
) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;

    const out_offsets = out_offsets_ptr[0..capacity];
    const out_lengths = out_lengths_ptr[0..capacity];
    const out_tag_ids = out_tag_ids_ptr[0..capacity];
    if (out_offsets.len != out_lengths.len or out_offsets.len != out_tag_ids.len) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }

    const total = tagger.fillPosTagsAscii(input_ptr[0..input_len], out_offsets, out_lengths, out_tag_ids);
    if (total > capacity) error_state.setError(.insufficient_capacity);
    return total;
}

pub export fn bunnltk_freqdist_stream_new() u64 {
    error_state.resetError();
    const stream = stream_freqdist.StreamFreqDistBuilder.create(std.heap.c_allocator) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
        return 0;
    };
    return streamHandleFromPtr(stream);
}

pub export fn bunnltk_freqdist_stream_free(handle: u64) void {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return;
    };
    stream.destroy();
}

pub export fn bunnltk_freqdist_stream_update_ascii(
    handle: u64,
    input_ptr: [*]const u8,
    input_len: usize,
) void {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return;
    };
    if (input_len == 0) return;

    stream.updateAscii(input_ptr[0..input_len]) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
    };
}

pub export fn bunnltk_freqdist_stream_flush(handle: u64) void {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return;
    };
    stream.flush() catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            else => unreachable,
        }
    };
}

pub export fn bunnltk_freqdist_stream_token_unique(handle: u64) u64 {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return 0;
    };
    return @as(u64, @intCast(stream.tokenUniqueCount()));
}

pub export fn bunnltk_freqdist_stream_bigram_unique(handle: u64) u64 {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return 0;
    };
    return @as(u64, @intCast(stream.bigramUniqueCount()));
}

pub export fn bunnltk_freqdist_stream_conditional_unique(handle: u64) u64 {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return 0;
    };
    return @as(u64, @intCast(stream.conditionalUniqueCount()));
}

pub export fn bunnltk_freqdist_stream_fill_token(
    handle: u64,
    out_hashes_ptr: [*]u64,
    out_counts_ptr: [*]u64,
    capacity: usize,
) u64 {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return 0;
    };
    const written = stream.fillTokenFreq(out_hashes_ptr[0..capacity], out_counts_ptr[0..capacity]) catch |err| {
        switch (err) {
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
    return @as(u64, written);
}

pub export fn bunnltk_freqdist_stream_fill_bigram(
    handle: u64,
    out_left_hashes_ptr: [*]u64,
    out_right_hashes_ptr: [*]u64,
    out_counts_ptr: [*]u64,
    capacity: usize,
) u64 {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return 0;
    };
    const written = stream.fillBigramFreq(
        out_left_hashes_ptr[0..capacity],
        out_right_hashes_ptr[0..capacity],
        out_counts_ptr[0..capacity],
    ) catch |err| {
        switch (err) {
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
    return @as(u64, written);
}

pub export fn bunnltk_freqdist_stream_fill_conditional(
    handle: u64,
    out_tag_ids_ptr: [*]u16,
    out_hashes_ptr: [*]u64,
    out_counts_ptr: [*]u64,
    capacity: usize,
) u64 {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return 0;
    };
    const written = stream.fillConditionalFreq(
        out_tag_ids_ptr[0..capacity],
        out_hashes_ptr[0..capacity],
        out_counts_ptr[0..capacity],
    ) catch |err| {
        switch (err) {
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
    return @as(u64, written);
}

pub export fn bunnltk_freqdist_stream_count_json_bytes(handle: u64) u64 {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return 0;
    };
    const count = stream.countJsonBytes() catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
        }
        return 0;
    };
    return @as(u64, count);
}

pub export fn bunnltk_freqdist_stream_fill_json(
    handle: u64,
    out_ptr: [*]u8,
    capacity: usize,
) u64 {
    error_state.resetError();
    const stream = streamPtrFromHandle(handle) orelse {
        error_state.setError(.insufficient_capacity);
        return 0;
    };
    const written = stream.fillJson(out_ptr[0..capacity]) catch |err| {
        switch (err) {
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
    return @as(u64, written);
}

pub export fn bunnltk_porter_stem_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    out_ptr: [*]u8,
    out_capacity: usize,
) u32 {
    error_state.resetError();
    if (input_len == 0) return 0;

    const stem_len = porter.stemPorterAscii(input_ptr[0..input_len], out_ptr[0..out_capacity]) catch |err| {
        switch (err) {
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
            else => unreachable,
        }
        return 0;
    };

    return @as(u32, @intCast(stem_len));
}

test "ffi error behavior" {
    const input = "abc";
    _ = bunnltk_count_unique_ngrams_ascii(input.ptr, input.len, 0);
    try std.testing.expectEqual(@as(u32, @intFromEnum(types.ErrorCode.invalid_n)), bunnltk_last_error_code());
}
