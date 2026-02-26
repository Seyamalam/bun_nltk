const std = @import("std");
const token_ids = @import("token_ids.zig");
const types = @import("types.zig");

fn tokenCount(input: []const u8, allocator: std.mem.Allocator) types.CountError!usize {
    var data = try token_ids.buildTokenIdDataAscii(input, allocator);
    defer data.deinit();
    return data.token_ids.items.len;
}

pub fn countNgramsIdsAscii(input: []const u8, n: usize, allocator: std.mem.Allocator) types.CountError!u64 {
    if (n == 0) return error.InvalidN;
    const t = try tokenCount(input, allocator);
    if (t < n) return 0;
    return @as(u64, t - n + 1);
}

pub fn fillNgramsIdsAscii(input: []const u8, n: usize, out_flat_ids: []u32, allocator: std.mem.Allocator) types.CountError!u64 {
    if (n == 0) return error.InvalidN;

    var data = try token_ids.buildTokenIdDataAscii(input, allocator);
    defer data.deinit();

    const t = data.token_ids.items.len;
    if (t < n) return 0;

    const grams = t - n + 1;
    const needed_ids = grams * n;
    if (out_flat_ids.len < needed_ids) return error.InsufficientCapacity;

    var out_idx: usize = 0;
    for (0..grams) |start| {
        @memcpy(out_flat_ids[out_idx .. out_idx + n], data.token_ids.items[start .. start + n]);
        out_idx += n;
    }

    return @as(u64, grams);
}

pub fn countEverygramsIdsAscii(input: []const u8, min_len: usize, max_len: usize, allocator: std.mem.Allocator) types.CountError!u64 {
    if (min_len == 0 or max_len == 0) return error.InvalidN;
    if (min_len > max_len) return 0;

    const t = try tokenCount(input, allocator);
    if (t == 0) return 0;

    const max_n = @min(max_len, t);
    var total: usize = 0;

    for (0..t) |start| {
        const span = t - start;
        const upper = @min(max_n, span);
        if (upper < min_len) continue;
        total += upper - min_len + 1;
    }

    return @as(u64, total);
}

pub fn countEverygramIdValuesAscii(input: []const u8, min_len: usize, max_len: usize, allocator: std.mem.Allocator) types.CountError!u64 {
    if (min_len == 0 or max_len == 0) return error.InvalidN;
    if (min_len > max_len) return 0;

    var data = try token_ids.buildTokenIdDataAscii(input, allocator);
    defer data.deinit();

    const t = data.token_ids.items.len;
    if (t == 0) return 0;

    const max_n = @min(max_len, t);
    var total_ids: usize = 0;

    for (0..t) |start| {
        const span = t - start;
        const upper = @min(max_n, span);
        if (upper < min_len) continue;
        for (min_len..upper + 1) |n| {
            total_ids += n;
        }
    }

    return @as(u64, total_ids);
}

pub fn fillEverygramsIdsAscii(
    input: []const u8,
    min_len: usize,
    max_len: usize,
    out_lens: []u32,
    out_flat_ids: []u32,
    allocator: std.mem.Allocator,
) types.CountError!u64 {
    if (min_len == 0 or max_len == 0) return error.InvalidN;
    if (min_len > max_len) return 0;

    var data = try token_ids.buildTokenIdDataAscii(input, allocator);
    defer data.deinit();

    const t = data.token_ids.items.len;
    if (t == 0) return 0;

    const max_n = @min(max_len, t);
    var total_grams: usize = 0;
    var total_ids: usize = 0;

    for (0..t) |start| {
        const span = t - start;
        const upper = @min(max_n, span);
        if (upper < min_len) continue;
        total_grams += upper - min_len + 1;
        for (min_len..upper + 1) |n| {
            total_ids += n;
        }
    }

    if (out_lens.len < total_grams or out_flat_ids.len < total_ids) {
        return error.InsufficientCapacity;
    }

    var gram_idx: usize = 0;
    var id_idx: usize = 0;

    for (0..t) |start| {
        const span = t - start;
        const upper = @min(max_n, span);
        if (upper < min_len) continue;

        for (min_len..upper + 1) |n| {
            out_lens[gram_idx] = @as(u32, @intCast(n));
            @memcpy(out_flat_ids[id_idx .. id_idx + n], data.token_ids.items[start .. start + n]);
            gram_idx += 1;
            id_idx += n;
        }
    }

    return @as(u64, total_grams);
}

fn countSkipgramsFromSeq(token_seq: []const u32, n: usize, k: usize) usize {
    if (n == 0) return 0;
    if (n == 1) return token_seq.len;

    const tail_slots = n + k - 1;
    var total: usize = 0;

    var combo = std.ArrayListUnmanaged(usize).empty;
    defer combo.deinit(std.heap.page_allocator);
    combo.ensureTotalCapacityPrecise(std.heap.page_allocator, n - 1) catch return 0;

    const recurse = struct {
        fn run(
            token_seq_: []const u32,
            i: usize,
            tail_slots_: usize,
            need: usize,
            start_slot: usize,
            combo_ptr: *std.ArrayListUnmanaged(usize),
            total_ptr: *usize,
        ) void {
            if (need == 0) {
                for (combo_ptr.items) |slot| {
                    const idx = i + 1 + slot;
                    if (idx >= token_seq_.len) return;
                }
                total_ptr.* += 1;
                return;
            }

            var s = start_slot;
            while (s <= tail_slots_ - need) : (s += 1) {
                combo_ptr.appendAssumeCapacity(s);
                run(token_seq_, i, tail_slots_, need - 1, s + 1, combo_ptr, total_ptr);
                _ = combo_ptr.pop();
            }
        }
    }.run;

    for (0..token_seq.len) |i| {
        recurse(token_seq, i, tail_slots, n - 1, 0, &combo, &total);
    }

    return total;
}

pub fn countSkipgramsIdsAscii(input: []const u8, n: usize, k: usize, allocator: std.mem.Allocator) types.CountError!u64 {
    if (n == 0) return error.InvalidN;

    var data = try token_ids.buildTokenIdDataAscii(input, allocator);
    defer data.deinit();

    return @as(u64, countSkipgramsFromSeq(data.token_ids.items, n, k));
}

pub fn fillSkipgramsIdsAscii(
    input: []const u8,
    n: usize,
    k: usize,
    out_flat_ids: []u32,
    allocator: std.mem.Allocator,
) types.CountError!u64 {
    if (n == 0) return error.InvalidN;

    var data = try token_ids.buildTokenIdDataAscii(input, allocator);
    defer data.deinit();

    const token_seq = data.token_ids.items;
    const total = countSkipgramsFromSeq(token_seq, n, k);
    const needed_ids = total * n;
    if (out_flat_ids.len < needed_ids) return error.InsufficientCapacity;

    if (n == 1) {
        for (token_seq, 0..) |id, i| {
            out_flat_ids[i] = id;
        }
        return @as(u64, token_seq.len);
    }

    const tail_slots = n + k - 1;
    var combo = std.ArrayListUnmanaged(usize).empty;
    defer combo.deinit(allocator);
    combo.ensureTotalCapacityPrecise(allocator, n - 1) catch return error.OutOfMemory;

    var out_idx: usize = 0;

    const recurse = struct {
        fn run(
            token_seq_: []const u32,
            i: usize,
            n_: usize,
            tail_slots_: usize,
            need: usize,
            start_slot: usize,
            combo_ptr: *std.ArrayListUnmanaged(usize),
            out_ids: []u32,
            out_idx_ptr: *usize,
        ) void {
            if (need == 0) {
                for (combo_ptr.items) |slot| {
                    const idx = i + 1 + slot;
                    if (idx >= token_seq_.len) return;
                }

                out_ids[out_idx_ptr.*] = token_seq_[i];
                out_idx_ptr.* += 1;
                for (combo_ptr.items) |slot| {
                    const idx = i + 1 + slot;
                    out_ids[out_idx_ptr.*] = token_seq_[idx];
                    out_idx_ptr.* += 1;
                }
                return;
            }

            var s = start_slot;
            while (s <= tail_slots_ - need) : (s += 1) {
                combo_ptr.appendAssumeCapacity(s);
                run(token_seq_, i, n_, tail_slots_, need - 1, s + 1, combo_ptr, out_ids, out_idx_ptr);
                _ = combo_ptr.pop();
            }
        }
    }.run;

    for (0..token_seq.len) |i| {
        recurse(token_seq, i, n, tail_slots, n - 1, 0, &combo, out_flat_ids, &out_idx);
    }

    return @as(u64, total);
}

test "ngram ids and everygrams match expected counts" {
    const allocator = std.testing.allocator;
    const input = "a b c";

    const grams2 = try countNgramsIdsAscii(input, 2, allocator);
    try std.testing.expectEqual(@as(u64, 2), grams2);

    const every = try countEverygramsIdsAscii(input, 1, 3, allocator);
    try std.testing.expectEqual(@as(u64, 6), every);

    const every_ids = try countEverygramIdValuesAscii(input, 1, 3, allocator);
    try std.testing.expectEqual(@as(u64, 10), every_ids);
}

test "skipgram count example" {
    const allocator = std.testing.allocator;
    const input = "Insurgents killed in ongoing fighting";
    const count = try countSkipgramsIdsAscii(input, 2, 2, allocator);
    try std.testing.expectEqual(@as(u64, 9), count);
}
