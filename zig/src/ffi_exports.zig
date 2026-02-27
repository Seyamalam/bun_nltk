const std = @import("std");
const ascii = @import("core/ascii.zig");
const freqdist = @import("core/freqdist.zig");
const collocations = @import("core/collocations.zig");
const token_ids = @import("core/token_ids.zig");
const ngrams = @import("core/ngrams.zig");
const normalize = @import("core/normalize.zig");
const porter = @import("core/porter.zig");
const perceptron = @import("core/perceptron.zig");
const tagger = @import("core/tagger.zig");
const stream_freqdist = @import("core/stream_freqdist.zig");
const punkt = @import("core/punkt.zig");
const morphy = @import("core/morphy.zig");
const lm = @import("core/lm.zig");
const chunk = @import("core/chunk.zig");
const cyk = @import("core/cyk.zig");
const naive_bayes = @import("core/naive_bayes.zig");
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

pub export fn bunnltk_count_tokens_ascii_scalar(input_ptr: [*]const u8, input_len: usize) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;
    return ascii.tokenCountAsciiScalar(input_ptr[0..input_len]);
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

pub export fn bunnltk_count_sentences_punkt_ascii(input_ptr: [*]const u8, input_len: usize) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;
    return punkt.countSentenceOffsetsAscii(input_ptr[0..input_len]);
}

pub export fn bunnltk_fill_sentence_offsets_punkt_ascii(
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

    const total = punkt.fillSentenceOffsetsAscii(input_ptr[0..input_len], out_offsets, out_lengths);
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

pub export fn bunnltk_count_normalized_tokens_ascii_scalar(
    input_ptr: [*]const u8,
    input_len: usize,
    remove_stopwords: u32,
) u64 {
    error_state.resetError();
    if (input_len == 0) return 0;
    return normalize.countNormalizedTokensAsciiScalar(input_ptr[0..input_len], remove_stopwords != 0);
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

pub export fn bunnltk_perceptron_predict_batch(
    feature_ids_ptr: [*]const u32,
    feature_ids_len: usize,
    token_offsets_ptr: [*]const u32,
    token_offsets_len: usize,
    weights_ptr: [*]const f32,
    weights_len: usize,
    model_feature_count: u32,
    tag_count: u32,
    out_tag_ids_ptr: [*]u16,
    out_tag_ids_len: usize,
) void {
    error_state.resetError();
    if (token_offsets_len == 0) return;
    if (feature_ids_len == 0 or weights_len == 0 or out_tag_ids_len == 0) {
        error_state.setError(.insufficient_capacity);
        return;
    }

    perceptron.predictBatch(
        feature_ids_ptr[0..feature_ids_len],
        token_offsets_ptr[0..token_offsets_len],
        weights_ptr[0..weights_len],
        model_feature_count,
        tag_count,
        out_tag_ids_ptr[0..out_tag_ids_len],
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.InvalidDimensions => error_state.setError(.invalid_n),
            error.OutOfMemory => error_state.setError(.out_of_memory),
            error.InsufficientCapacity => error_state.setError(.insufficient_capacity),
        }
    };
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

pub export fn bunnltk_wordnet_morphy_ascii(
    input_ptr: [*]const u8,
    input_len: usize,
    pos: u32,
    out_ptr: [*]u8,
    out_capacity: usize,
) u32 {
    error_state.resetError();
    if (input_len == 0 or out_capacity == 0) return 0;
    const pos_tag: morphy.WordNetPos = switch (pos) {
        1 => .noun,
        2 => .verb,
        3 => .adjective,
        4 => .adverb,
        else => .any,
    };
    const written = morphy.morphyAscii(input_ptr[0..input_len], pos_tag, out_ptr[0..out_capacity]);
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

pub export fn bunnltk_lm_eval_ids(
    token_ids_ptr: [*]const u32,
    token_ids_len: usize,
    sentence_offsets_ptr: [*]const u32,
    sentence_offsets_len: usize,
    order: u32,
    model_type: u32,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
    probe_context_flat_ptr: [*]const u32,
    probe_context_flat_len: usize,
    probe_context_lens_ptr: [*]const u32,
    probe_words_ptr: [*]const u32,
    probe_count: usize,
    out_scores_ptr: [*]f64,
    out_scores_len: usize,
    perplexity_tokens_ptr: [*]const u32,
    perplexity_len: usize,
    prefix_tokens_ptr: [*]const u32,
    prefix_len: usize,
) f64 {
    error_state.resetError();
    if (order == 0 or order > 3) {
        error_state.setError(.invalid_n);
        return std.math.inf(f64);
    }
    if (token_ids_len == 0 or sentence_offsets_len < 2) {
        error_state.setError(.insufficient_capacity);
        return std.math.inf(f64);
    }

    const ppl = lm.evalIds(
        token_ids_ptr[0..token_ids_len],
        sentence_offsets_ptr[0..sentence_offsets_len],
        order,
        lmModelTypeFromU32(model_type),
        gamma,
        discount,
        vocab_size,
        probe_context_flat_ptr[0..probe_context_flat_len],
        probe_context_lens_ptr[0..probe_count],
        probe_words_ptr[0..probe_count],
        out_scores_ptr[0..out_scores_len],
        perplexity_tokens_ptr[0..perplexity_len],
        prefix_tokens_ptr[0..prefix_len],
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return std.math.inf(f64);
    };
    return ppl;
}

pub export fn bunnltk_chunk_iob_ids(
    token_tag_ids_ptr: [*]const u16,
    token_count: usize,
    atom_allowed_offsets_ptr: [*]const u32,
    atom_allowed_lengths_ptr: [*]const u32,
    atom_allowed_flat_ptr: [*]const u16,
    atom_allowed_flat_len: usize,
    atom_mins_ptr: [*]const u8,
    atom_maxs_ptr: [*]const u8,
    atom_count: usize,
    rule_atom_offsets_ptr: [*]const u32,
    rule_atom_counts_ptr: [*]const u32,
    rule_label_ids_ptr: [*]const u16,
    rule_count: usize,
    out_label_ids_ptr: [*]u16,
    out_begin_ptr: [*]u8,
    out_capacity: usize,
) u64 {
    error_state.resetError();
    if (token_count == 0) return 0;
    if (out_capacity < token_count) {
        error_state.setError(.insufficient_capacity);
        return 0;
    }
    if (rule_count == 0 or atom_count == 0) {
        var i: usize = 0;
        while (i < token_count) : (i += 1) {
            out_label_ids_ptr[i] = std.math.maxInt(u16);
            out_begin_ptr[i] = 0;
        }
        return @intCast(token_count);
    }

    const written = chunk.fillChunkIobIds(
        token_tag_ids_ptr[0..token_count],
        atom_allowed_offsets_ptr[0..atom_count],
        atom_allowed_lengths_ptr[0..atom_count],
        atom_allowed_flat_ptr[0..atom_allowed_flat_len],
        atom_mins_ptr[0..atom_count],
        atom_maxs_ptr[0..atom_count],
        rule_atom_offsets_ptr[0..rule_count],
        rule_atom_counts_ptr[0..rule_count],
        rule_label_ids_ptr[0..rule_count],
        out_label_ids_ptr[0..out_capacity],
        out_begin_ptr[0..out_capacity],
    );
    if (written == 0 and token_count > 0) {
        error_state.setError(.invalid_n);
    }
    return written;
}

pub export fn bunnltk_cyk_recognize_ids(
    token_bits_ptr: [*]const u64,
    token_count: usize,
    binary_left_ptr: [*]const u16,
    binary_right_ptr: [*]const u16,
    binary_parent_ptr: [*]const u16,
    binary_count: usize,
    unary_child_ptr: [*]const u16,
    unary_parent_ptr: [*]const u16,
    unary_count: usize,
    start_symbol: u16,
) u32 {
    error_state.resetError();
    if (token_count == 0) return 0;
    if (start_symbol >= 64) {
        error_state.setError(.invalid_n);
        return 0;
    }
    const ok = cyk.cykRecognize(
        token_bits_ptr[0..token_count],
        binary_left_ptr[0..binary_count],
        binary_right_ptr[0..binary_count],
        binary_parent_ptr[0..binary_count],
        unary_child_ptr[0..unary_count],
        unary_parent_ptr[0..unary_count],
        start_symbol,
        std.heap.c_allocator,
    ) catch |err| {
        switch (err) {
            error.OutOfMemory => error_state.setError(.out_of_memory),
        }
        return 0;
    };
    return if (ok) 1 else 0;
}

pub export fn bunnltk_naive_bayes_log_scores_ids(
    doc_token_ids_ptr: [*]const u32,
    doc_token_count: usize,
    vocab_size: u32,
    token_counts_matrix_ptr: [*]const u32,
    token_counts_matrix_len: usize,
    label_doc_counts_ptr: [*]const u32,
    label_token_totals_ptr: [*]const u32,
    label_count: usize,
    total_docs: u32,
    smoothing: f64,
    out_scores_ptr: [*]f64,
    out_scores_len: usize,
) void {
    error_state.resetError();
    if (label_count == 0 or out_scores_len < label_count) {
        error_state.setError(.insufficient_capacity);
        return;
    }
    naive_bayes.logScores(
        doc_token_ids_ptr[0..doc_token_count],
        vocab_size,
        token_counts_matrix_ptr[0..token_counts_matrix_len],
        label_doc_counts_ptr[0..label_count],
        label_token_totals_ptr[0..label_count],
        total_docs,
        smoothing,
        out_scores_ptr[0..out_scores_len],
    );
}

test "ffi error behavior" {
    const input = "abc";
    _ = bunnltk_count_unique_ngrams_ascii(input.ptr, input.len, 0);
    try std.testing.expectEqual(@as(u32, @intFromEnum(types.ErrorCode.invalid_n)), bunnltk_last_error_code());
}
