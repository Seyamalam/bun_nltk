const std = @import("std");

const UNCHUNKED_LABEL: u16 = std.math.maxInt(u16);

fn tagAllowed(tag_id: u16, allowed: []const u16) bool {
    for (allowed) |item| {
        if (item == tag_id) return true;
    }
    return false;
}

fn matchPatternRecursive(
    token_tag_ids: []const u16,
    token_labels: []const u16,
    rule_atom_offset: usize,
    rule_atom_count: usize,
    atom_idx: usize,
    token_idx: usize,
    atom_allowed_offsets: []const u32,
    atom_allowed_lengths: []const u32,
    atom_allowed_flat: []const u16,
    atom_mins: []const u8,
    atom_maxs: []const u8,
) ?usize {
    if (atom_idx >= rule_atom_count) return token_idx;

    const atom = rule_atom_offset + atom_idx;
    if (atom >= atom_allowed_offsets.len or atom >= atom_allowed_lengths.len or atom >= atom_mins.len or atom >= atom_maxs.len) {
        return null;
    }

    const allowed_start = @as(usize, atom_allowed_offsets[atom]);
    const allowed_len = @as(usize, atom_allowed_lengths[atom]);
    if (allowed_start + allowed_len > atom_allowed_flat.len) return null;
    const allowed = atom_allowed_flat[allowed_start .. allowed_start + allowed_len];

    const min_repeat = @as(usize, atom_mins[atom]);
    const max_raw = @as(usize, atom_maxs[atom]);
    const unbounded = atom_maxs[atom] == std.math.maxInt(u8);
    const max_limit = if (unbounded) token_tag_ids.len - token_idx else max_raw;

    var max_repeat: usize = 0;
    while (max_repeat < max_limit and token_idx + max_repeat < token_tag_ids.len) : (max_repeat += 1) {
        const pos = token_idx + max_repeat;
        if (token_labels[pos] != UNCHUNKED_LABEL) break;
        if (!tagAllowed(token_tag_ids[pos], allowed)) break;
    }

    if (max_repeat < min_repeat) return null;

    var used = max_repeat;
    while (true) {
        if (used >= min_repeat) {
            const end = matchPatternRecursive(
                token_tag_ids,
                token_labels,
                rule_atom_offset,
                rule_atom_count,
                atom_idx + 1,
                token_idx + used,
                atom_allowed_offsets,
                atom_allowed_lengths,
                atom_allowed_flat,
                atom_mins,
                atom_maxs,
            );
            if (end != null) return end;
        }
        if (used == 0) break;
        used -= 1;
        if (used < min_repeat) break;
    }
    return null;
}

pub fn fillChunkIobIds(
    token_tag_ids: []const u16,
    atom_allowed_offsets: []const u32,
    atom_allowed_lengths: []const u32,
    atom_allowed_flat: []const u16,
    atom_mins: []const u8,
    atom_maxs: []const u8,
    rule_atom_offsets: []const u32,
    rule_atom_counts: []const u32,
    rule_label_ids: []const u16,
    out_label_ids: []u16,
    out_begins: []u8,
) u64 {
    const token_count = token_tag_ids.len;
    if (out_label_ids.len < token_count or out_begins.len < token_count) return 0;
    if (rule_atom_offsets.len != rule_atom_counts.len or rule_atom_offsets.len != rule_label_ids.len) return 0;

    for (0..token_count) |i| {
        out_label_ids[i] = UNCHUNKED_LABEL;
        out_begins[i] = 0;
    }

    var rule_idx: usize = 0;
    while (rule_idx < rule_atom_offsets.len) : (rule_idx += 1) {
        const atom_offset = @as(usize, rule_atom_offsets[rule_idx]);
        const atom_count = @as(usize, rule_atom_counts[rule_idx]);
        const label_id = rule_label_ids[rule_idx];

        var i: usize = 0;
        while (i < token_count) {
            if (out_label_ids[i] != UNCHUNKED_LABEL) {
                i += 1;
                continue;
            }
            const end = matchPatternRecursive(
                token_tag_ids,
                out_label_ids[0..token_count],
                atom_offset,
                atom_count,
                0,
                i,
                atom_allowed_offsets,
                atom_allowed_lengths,
                atom_allowed_flat,
                atom_mins,
                atom_maxs,
            ) orelse {
                i += 1;
                continue;
            };
            if (end <= i) {
                i += 1;
                continue;
            }
            var j = i;
            while (j < end) : (j += 1) {
                out_label_ids[j] = label_id;
                out_begins[j] = if (j == i) 1 else 0;
            }
            i = end;
        }
    }

    return @intCast(token_count);
}

test "chunk iob ids basic NP/VP pattern" {
    const tags = [_]u16{ 1, 2, 2, 3, 4, 5, 1, 2, 3 };
    // atoms:
    // 0: DT optional -> {1}
    // 1: JJ* -> {2}
    // 2: NN+ -> {3}
    // 3: VB+ -> {4}
    // 4: IN? -> {5}
    const allowed_offsets = [_]u32{ 0, 1, 2, 3, 4 };
    const allowed_lens = [_]u32{ 1, 1, 1, 1, 1 };
    const allowed_flat = [_]u16{ 1, 2, 3, 4, 5 };
    const mins = [_]u8{ 0, 0, 1, 1, 0 };
    const maxs = [_]u8{ 1, std.math.maxInt(u8), std.math.maxInt(u8), std.math.maxInt(u8), 1 };
    const rule_offsets = [_]u32{ 0, 3 };
    const rule_counts = [_]u32{ 3, 2 };
    const rule_labels = [_]u16{ 0, 1 };

    var out_labels = [_]u16{0} ** tags.len;
    var out_begins = [_]u8{0} ** tags.len;
    const written = fillChunkIobIds(
        &tags,
        &allowed_offsets,
        &allowed_lens,
        &allowed_flat,
        &mins,
        &maxs,
        &rule_offsets,
        &rule_counts,
        &rule_labels,
        &out_labels,
        &out_begins,
    );
    try std.testing.expectEqual(@as(u64, tags.len), written);
    try std.testing.expectEqual(@as(u16, 0), out_labels[0]);
    try std.testing.expectEqual(@as(u16, 0), out_labels[3]);
    try std.testing.expectEqual(@as(u16, 1), out_labels[4]);
    try std.testing.expectEqual(@as(u16, 1), out_labels[5]);
}

