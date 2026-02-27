const std = @import("std");

pub const ModelType = enum(u32) {
    mle = 0,
    lidstone = 1,
    kneser_ney_interpolated = 2,
};

const Counts = struct {
    unigram: std.AutoHashMapUnmanaged(u32, u32) = .empty,
    bigram: std.AutoHashMapUnmanaged(u64, u32) = .empty,
    trigram: std.AutoHashMapUnmanaged(u128, u32) = .empty,

    followers1: std.AutoHashMapUnmanaged(u32, u32) = .empty,
    followers2: std.AutoHashMapUnmanaged(u64, u32) = .empty,
    continuation: std.AutoHashMapUnmanaged(u32, u32) = .empty,

    seen_bigram: std.AutoHashMapUnmanaged(u64, void) = .empty,
    seen_trigram: std.AutoHashMapUnmanaged(u128, void) = .empty,

    unigram_total: u64 = 0,
    continuation_type_count: u64 = 0,

    fn deinit(self: *Counts, allocator: std.mem.Allocator) void {
        self.unigram.deinit(allocator);
        self.bigram.deinit(allocator);
        self.trigram.deinit(allocator);
        self.followers1.deinit(allocator);
        self.followers2.deinit(allocator);
        self.continuation.deinit(allocator);
        self.seen_bigram.deinit(allocator);
        self.seen_trigram.deinit(allocator);
    }
};

fn incU32(map: *std.AutoHashMapUnmanaged(u32, u32), allocator: std.mem.Allocator, k: u32) !void {
    const entry = try map.getOrPut(allocator, k);
    if (!entry.found_existing) entry.value_ptr.* = 0;
    entry.value_ptr.* += 1;
}

fn incU64(map: *std.AutoHashMapUnmanaged(u64, u32), allocator: std.mem.Allocator, k: u64) !void {
    const entry = try map.getOrPut(allocator, k);
    if (!entry.found_existing) entry.value_ptr.* = 0;
    entry.value_ptr.* += 1;
}

fn incU128(map: *std.AutoHashMapUnmanaged(u128, u32), allocator: std.mem.Allocator, k: u128) !void {
    const entry = try map.getOrPut(allocator, k);
    if (!entry.found_existing) entry.value_ptr.* = 0;
    entry.value_ptr.* += 1;
}

fn keyBigram(a: u32, b: u32) u64 {
    return (@as(u64, a) << 32) | @as(u64, b);
}

fn keyTrigram(a: u32, b: u32, c: u32) u128 {
    return (@as(u128, a) << 64) | (@as(u128, b) << 32) | @as(u128, c);
}

fn markSeenBigram(counts: *Counts, allocator: std.mem.Allocator, prev: u32, word: u32) !void {
    const k = keyBigram(prev, word);
    const entry = try counts.seen_bigram.getOrPut(allocator, k);
    if (!entry.found_existing) {
        const follower = try counts.followers1.getOrPut(allocator, prev);
        if (!follower.found_existing) follower.value_ptr.* = 0;
        follower.value_ptr.* += 1;

        const cont = try counts.continuation.getOrPut(allocator, word);
        if (!cont.found_existing) cont.value_ptr.* = 0;
        cont.value_ptr.* += 1;
    }
}

fn markSeenTrigram(counts: *Counts, allocator: std.mem.Allocator, a: u32, b: u32, c: u32) !void {
    const trigram_k = keyTrigram(a, b, c);
    const entry = try counts.seen_trigram.getOrPut(allocator, trigram_k);
    if (!entry.found_existing) {
        const context_k = keyBigram(a, b);
        const follower = try counts.followers2.getOrPut(allocator, context_k);
        if (!follower.found_existing) follower.value_ptr.* = 0;
        follower.value_ptr.* += 1;
    }
}

fn buildCounts(
    token_ids: []const u32,
    sentence_offsets: []const u32,
    order: u32,
    allocator: std.mem.Allocator,
) !Counts {
    var counts: Counts = .{};
    errdefer counts.deinit(allocator);

    var sent_idx: usize = 0;
    while (sent_idx + 1 < sentence_offsets.len) : (sent_idx += 1) {
        const start = @as(usize, sentence_offsets[sent_idx]);
        const end = @as(usize, sentence_offsets[sent_idx + 1]);
        if (end <= start or end > token_ids.len) continue;
        const sentence = token_ids[start..end];

        for (sentence, 0..) |tok, i| {
            try incU32(&counts.unigram, allocator, tok);
            counts.unigram_total += 1;

            if (order >= 2 and i >= 1) {
                const prev = sentence[i - 1];
                try incU64(&counts.bigram, allocator, keyBigram(prev, tok));
                try markSeenBigram(&counts, allocator, prev, tok);
            }
            if (order >= 3 and i >= 2) {
                const a = sentence[i - 2];
                const b = sentence[i - 1];
                try incU128(&counts.trigram, allocator, keyTrigram(a, b, tok));
                try markSeenTrigram(&counts, allocator, a, b, tok);
            }
        }
    }

    counts.continuation_type_count = counts.seen_bigram.count();
    return counts;
}

fn countContext(counts: *const Counts, ctx: []const u32) u32 {
    if (ctx.len == 0) {
        if (counts.unigram_total > std.math.maxInt(u32)) return std.math.maxInt(u32);
        return @intCast(counts.unigram_total);
    }
    if (ctx.len == 1) {
        return counts.unigram.get(ctx[0]) orelse 0;
    }
    if (ctx.len == 2) {
        return counts.bigram.get(keyBigram(ctx[0], ctx[1])) orelse 0;
    }
    return 0;
}

fn ngramCount(counts: *const Counts, ctx: []const u32, word: u32) u32 {
    if (ctx.len == 0) return counts.unigram.get(word) orelse 0;
    if (ctx.len == 1) return counts.bigram.get(keyBigram(ctx[0], word)) orelse 0;
    if (ctx.len == 2) return counts.trigram.get(keyTrigram(ctx[0], ctx[1], word)) orelse 0;
    return 0;
}

fn followerCount(counts: *const Counts, ctx: []const u32) u32 {
    if (ctx.len == 1) return counts.followers1.get(ctx[0]) orelse 0;
    if (ctx.len == 2) return counts.followers2.get(keyBigram(ctx[0], ctx[1])) orelse 0;
    return 0;
}

fn backoffTail(ctx: []const u32) []const u32 {
    if (ctx.len == 0) return ctx;
    return ctx[1..];
}

fn scoreMle(counts: *const Counts, word: u32, ctx: []const u32) f64 {
    if (ctx.len == 0) {
        if (counts.unigram_total == 0) return 0;
        return @as(f64, @floatFromInt(ngramCount(counts, ctx, word))) / @as(f64, @floatFromInt(counts.unigram_total));
    }
    const ctx_count = countContext(counts, ctx);
    if (ctx_count == 0) return scoreMle(counts, word, backoffTail(ctx));
    const gram_count = ngramCount(counts, ctx, word);
    return @as(f64, @floatFromInt(gram_count)) / @as(f64, @floatFromInt(ctx_count));
}

fn scoreLidstone(counts: *const Counts, word: u32, ctx: []const u32, gamma: f64, vocab_size: u32) f64 {
    const vocab_f = @as(f64, @floatFromInt(@max(@as(u32, 1), vocab_size)));
    if (ctx.len == 0) {
        const gram = @as(f64, @floatFromInt(ngramCount(counts, ctx, word)));
        const denom = @as(f64, @floatFromInt(counts.unigram_total)) + gamma * vocab_f;
        if (denom <= 0) return 0;
        return (gram + gamma) / denom;
    }
    const ctx_count = countContext(counts, ctx);
    if (ctx_count == 0) return scoreLidstone(counts, word, backoffTail(ctx), gamma, vocab_size);
    const gram_count = @as(f64, @floatFromInt(ngramCount(counts, ctx, word)));
    const denom = @as(f64, @floatFromInt(ctx_count)) + gamma * vocab_f;
    if (denom <= 0) return 0;
    return (gram_count + gamma) / denom;
}

fn continuationProb(counts: *const Counts, word: u32) f64 {
    if (counts.continuation_type_count == 0) return 0;
    const cont = counts.continuation.get(word) orelse 0;
    if (cont == 0) {
        return 1.0 / (@as(f64, @floatFromInt(counts.continuation_type_count)) * 10.0);
    }
    return @as(f64, @floatFromInt(cont)) / @as(f64, @floatFromInt(counts.continuation_type_count));
}

fn scoreKneserNey(counts: *const Counts, word: u32, ctx: []const u32, discount: f64) f64 {
    if (ctx.len == 0) return continuationProb(counts, word);

    const ctx_count = countContext(counts, ctx);
    if (ctx_count == 0) return scoreKneserNey(counts, word, backoffTail(ctx), discount);

    const gram_count = ngramCount(counts, ctx, word);
    const followers = followerCount(counts, ctx);

    const ctx_f = @as(f64, @floatFromInt(ctx_count));
    const discounted = @max(@as(f64, @floatFromInt(gram_count)) - discount, 0.0) / ctx_f;
    const lambda = (discount * @as(f64, @floatFromInt(followers))) / ctx_f;
    return discounted + lambda * scoreKneserNey(counts, word, backoffTail(ctx), discount);
}

fn scoreWord(
    counts: *const Counts,
    word: u32,
    context: []const u32,
    order: u32,
    model: ModelType,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
) f64 {
    const keep = if (context.len > @as(usize, order -| 1)) context[context.len - @as(usize, order -| 1) ..] else context;
    return switch (model) {
        .mle => scoreMle(counts, word, keep),
        .lidstone => scoreLidstone(counts, word, keep, gamma, vocab_size),
        .kneser_ney_interpolated => scoreKneserNey(counts, word, keep, discount),
    };
}

pub fn evalIds(
    token_ids: []const u32,
    sentence_offsets: []const u32,
    order: u32,
    model: ModelType,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
    probe_context_flat: []const u32,
    probe_context_lens: []const u32,
    probe_words: []const u32,
    out_scores: []f64,
    perplexity_tokens: []const u32,
    prefix_tokens: []const u32,
    allocator: std.mem.Allocator,
) !f64 {
    var counts = try buildCounts(token_ids, sentence_offsets, order, allocator);
    defer counts.deinit(allocator);

    var ctx_cursor: usize = 0;
    const probe_count = @min(@min(probe_context_lens.len, probe_words.len), out_scores.len);
    var i: usize = 0;
    while (i < probe_count) : (i += 1) {
        const ctx_len = @as(usize, probe_context_lens[i]);
        if (ctx_cursor + ctx_len > probe_context_flat.len) {
            out_scores[i] = 0;
            continue;
        }
        const ctx = probe_context_flat[ctx_cursor .. ctx_cursor + ctx_len];
        ctx_cursor += ctx_len;
        out_scores[i] = scoreWord(&counts, probe_words[i], ctx, order, model, gamma, discount, vocab_size);
    }

    if (perplexity_tokens.len == 0) return std.math.inf(f64);
    var history = std.ArrayListUnmanaged(u32).empty;
    defer history.deinit(allocator);
    try history.appendSlice(allocator, prefix_tokens);

    var neg_log2: f64 = 0;
    for (perplexity_tokens) |tok| {
        const keep_len = @min(history.items.len, @as(usize, order -| 1));
        const ctx = if (keep_len == 0) history.items[0..0] else history.items[history.items.len - keep_len ..];
        var prob = scoreWord(&counts, tok, ctx, order, model, gamma, discount, vocab_size);
        if (!std.math.isFinite(prob) or prob <= 0) prob = 1e-12;
        neg_log2 += -std.math.log2(prob);
        try history.append(allocator, tok);
    }

    return std.math.pow(f64, 2.0, neg_log2 / @as(f64, @floatFromInt(perplexity_tokens.len)));
}

test "lm eval ids basic parity sanity" {
    const allocator = std.testing.allocator;
    const tokens = [_]u32{ 1, 2, 3, 4, 1, 2, 5, 4 };
    const offsets = [_]u32{ 0, 4, 8 };
    const probe_ctx = [_]u32{ 1, 2, 1, 2 };
    const probe_lens = [_]u32{ 2, 2 };
    const probe_words = [_]u32{ 3, 5 };
    var out = [_]f64{0} ** 2;
    const perplexity_tokens = [_]u32{ 1, 2, 3, 4 };
    const prefix = [_]u32{ 0, 0 };

    const ppl = try evalIds(
        &tokens,
        &offsets,
        3,
        .kneser_ney_interpolated,
        0.1,
        0.75,
        6,
        &probe_ctx,
        &probe_lens,
        &probe_words,
        &out,
        &perplexity_tokens,
        &prefix,
        allocator,
    );
    try std.testing.expect(out[0] > 0);
    try std.testing.expect(out[1] > 0);
    try std.testing.expect(std.math.isFinite(ppl));
}

