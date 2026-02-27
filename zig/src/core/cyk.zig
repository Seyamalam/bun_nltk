const std = @import("std");

fn bitSet(bits: *u64, id: u16) void {
    if (id >= 64) return;
    bits.* |= (@as(u64, 1) << @as(u6, @intCast(id)));
}

fn bitHas(bits: u64, id: u16) bool {
    if (id >= 64) return false;
    return (bits & (@as(u64, 1) << @as(u6, @intCast(id)))) != 0;
}

fn applyUnaryClosure(bits: *u64, unary_child: []const u16, unary_parent: []const u16) void {
    var changed = true;
    while (changed) {
        changed = false;
        var i: usize = 0;
        while (i < unary_child.len and i < unary_parent.len) : (i += 1) {
            const child = unary_child[i];
            const parent = unary_parent[i];
            if (bitHas(bits.*, child) and !bitHas(bits.*, parent)) {
                bitSet(bits, parent);
                changed = true;
            }
        }
    }
}

fn cellIdx(n: usize, i: usize, j: usize) usize {
    return i * n + j;
}

pub fn cykRecognize(
    token_bits: []const u64,
    binary_left: []const u16,
    binary_right: []const u16,
    binary_parent: []const u16,
    unary_child: []const u16,
    unary_parent: []const u16,
    start_symbol: u16,
    allocator: std.mem.Allocator,
) !bool {
    if (token_bits.len == 0) return false;
    if (start_symbol >= 64) return false;
    if (binary_left.len != binary_right.len or binary_left.len != binary_parent.len) return false;
    if (unary_child.len != unary_parent.len) return false;

    const n = token_bits.len;
    var table = try allocator.alloc(u64, n * n);
    defer allocator.free(table);
    @memset(table, 0);

    var i: usize = 0;
    while (i < n) : (i += 1) {
        var bits = token_bits[i];
        applyUnaryClosure(&bits, unary_child, unary_parent);
        table[cellIdx(n, i, i)] = bits;
    }

    var span: usize = 2;
    while (span <= n) : (span += 1) {
        var start: usize = 0;
        while (start + span <= n) : (start += 1) {
            const end = start + span - 1;
            var bits: u64 = 0;
            var split = start;
            while (split < end) : (split += 1) {
                const left_bits = table[cellIdx(n, start, split)];
                const right_bits = table[cellIdx(n, split + 1, end)];
                if (left_bits == 0 or right_bits == 0) continue;
                var r: usize = 0;
                while (r < binary_left.len) : (r += 1) {
                    if (bitHas(left_bits, binary_left[r]) and bitHas(right_bits, binary_right[r])) {
                        bitSet(&bits, binary_parent[r]);
                    }
                }
            }
            applyUnaryClosure(&bits, unary_child, unary_parent);
            table[cellIdx(n, start, end)] = bits;
        }
    }

    return bitHas(table[cellIdx(n, 0, n - 1)], start_symbol);
}

test "cyk recognize simple grammar with unary closure" {
    const allocator = std.testing.allocator;
    // Symbols: 0=S, 1=NP, 2=VP, 3=V, 4=Name
    const token_bits = [_]u64{
        (@as(u64, 1) << 4), // Name -> "alice"
        (@as(u64, 1) << 3), // V -> "sees"
        (@as(u64, 1) << 4), // Name -> "alice"
    };
    const binary_left = [_]u16{ 1, 3 };
    const binary_right = [_]u16{ 2, 1 };
    const binary_parent = [_]u16{ 0, 2 };
    const unary_child = [_]u16{4};
    const unary_parent = [_]u16{1};

    const ok = try cykRecognize(
        &token_bits,
        &binary_left,
        &binary_right,
        &binary_parent,
        &unary_child,
        &unary_parent,
        0,
        allocator,
    );
    try std.testing.expect(ok);
}
