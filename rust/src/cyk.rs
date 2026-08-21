fn bit_set(bits: &mut u64, id: u16) {
    if id >= 64 {
        return;
    }
    *bits |= 1u64 << id;
}

fn bit_has(bits: u64, id: u16) -> bool {
    if id >= 64 {
        return false;
    }
    (bits & (1u64 << id)) != 0
}

fn apply_unary_closure(bits: &mut u64, unary_child: &[u16], unary_parent: &[u16]) {
    let mut changed = true;
    while changed {
        changed = false;
        for i in 0..unary_child.len().min(unary_parent.len()) {
            let child = unary_child[i];
            let parent = unary_parent[i];
            if bit_has(*bits, child) && !bit_has(*bits, parent) {
                bit_set(bits, parent);
                changed = true;
            }
        }
    }
}

fn cell_idx(n: usize, i: usize, j: usize) -> usize {
    i * n + j
}

pub fn cyk_recognize(
    token_bits: &[u64],
    binary_left: &[u16],
    binary_right: &[u16],
    binary_parent: &[u16],
    unary_child: &[u16],
    unary_parent: &[u16],
    start_symbol: u16,
) -> bool {
    if token_bits.is_empty() {
        return false;
    }
    if start_symbol >= 64 {
        return false;
    }
    if binary_left.len() != binary_right.len() || binary_left.len() != binary_parent.len() {
        return false;
    }
    if unary_child.len() != unary_parent.len() {
        return false;
    }

    let n = token_bits.len();
    let mut table = vec![0u64; n * n];

    for i in 0..n {
        let mut bits = token_bits[i];
        apply_unary_closure(&mut bits, unary_child, unary_parent);
        table[cell_idx(n, i, i)] = bits;
    }

    for span in 2..=n {
        for start in 0..=(n - span) {
            let end = start + span - 1;
            let mut bits: u64 = 0;
            for split in start..end {
                let left_bits = table[cell_idx(n, start, split)];
                let right_bits = table[cell_idx(n, split + 1, end)];
                if left_bits == 0 || right_bits == 0 {
                    continue;
                }
                for r in 0..binary_left.len() {
                    if bit_has(left_bits, binary_left[r]) && bit_has(right_bits, binary_right[r]) {
                        bit_set(&mut bits, binary_parent[r]);
                    }
                }
            }
            apply_unary_closure(&mut bits, unary_child, unary_parent);
            table[cell_idx(n, start, end)] = bits;
        }
    }

    bit_has(table[cell_idx(n, 0, n - 1)], start_symbol)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cyk_recognize_simple_grammar_with_unary_closure() {
        // Symbols: 0=S, 1=NP, 2=VP, 3=V, 4=Name
        let token_bits: [u64; 3] = [1 << 4, 1 << 3, 1 << 4];
        let binary_left: [u16; 2] = [1, 3];
        let binary_right: [u16; 2] = [2, 1];
        let binary_parent: [u16; 2] = [0, 2];
        let unary_child: [u16; 1] = [4];
        let unary_parent: [u16; 1] = [1];

        let ok = cyk_recognize(
            &token_bits,
            &binary_left,
            &binary_right,
            &binary_parent,
            &unary_child,
            &unary_parent,
            0,
        );
        assert!(ok);
    }
}
