const UNCHUNKED_LABEL: u16 = u16::MAX;

fn tag_allowed(tag_id: u16, allowed: &[u16]) -> bool {
    allowed.iter().any(|&item| item == tag_id)
}

#[allow(clippy::too_many_arguments)]
fn match_pattern_recursive(
    token_tag_ids: &[u16],
    token_labels: &[u16],
    rule_atom_offset: usize,
    rule_atom_count: usize,
    atom_idx: usize,
    token_idx: usize,
    atom_allowed_offsets: &[u32],
    atom_allowed_lengths: &[u32],
    atom_allowed_flat: &[u16],
    atom_mins: &[u8],
    atom_maxs: &[u8],
) -> Option<usize> {
    if atom_idx >= rule_atom_count {
        return Some(token_idx);
    }

    let atom = rule_atom_offset + atom_idx;
    if atom >= atom_allowed_offsets.len()
        || atom >= atom_allowed_lengths.len()
        || atom >= atom_mins.len()
        || atom >= atom_maxs.len()
    {
        return None;
    }

    let allowed_start = atom_allowed_offsets[atom] as usize;
    let allowed_len = atom_allowed_lengths[atom] as usize;
    if allowed_start + allowed_len > atom_allowed_flat.len() {
        return None;
    }
    let allowed = &atom_allowed_flat[allowed_start..allowed_start + allowed_len];

    let min_repeat = atom_mins[atom] as usize;
    let max_raw = atom_maxs[atom] as usize;
    let unbounded = atom_maxs[atom] == u8::MAX;
    let max_limit = if unbounded {
        token_tag_ids.len() - token_idx
    } else {
        max_raw
    };

    let mut max_repeat: usize = 0;
    while max_repeat < max_limit && token_idx + max_repeat < token_tag_ids.len() {
        let pos = token_idx + max_repeat;
        if token_labels[pos] != UNCHUNKED_LABEL {
            break;
        }
        if !tag_allowed(token_tag_ids[pos], allowed) {
            break;
        }
        max_repeat += 1;
    }

    if max_repeat < min_repeat {
        return None;
    }

    let mut used = max_repeat;
    loop {
        if used >= min_repeat {
            let end = match_pattern_recursive(
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
            if end.is_some() {
                return end;
            }
        }
        if used == 0 {
            break;
        }
        used -= 1;
        if used < min_repeat {
            break;
        }
    }
    None
}

pub fn fill_chunk_iob_ids(
    token_tag_ids: &[u16],
    atom_allowed_offsets: &[u32],
    atom_allowed_lengths: &[u32],
    atom_allowed_flat: &[u16],
    atom_mins: &[u8],
    atom_maxs: &[u8],
    rule_atom_offsets: &[u32],
    rule_atom_counts: &[u32],
    rule_label_ids: &[u16],
    out_label_ids: &mut [u16],
    out_begins: &mut [u8],
) -> u64 {
    let token_count = token_tag_ids.len();
    if out_label_ids.len() < token_count || out_begins.len() < token_count {
        return 0;
    }
    if rule_atom_offsets.len() != rule_atom_counts.len()
        || rule_atom_offsets.len() != rule_label_ids.len()
    {
        return 0;
    }

    for i in 0..token_count {
        out_label_ids[i] = UNCHUNKED_LABEL;
        out_begins[i] = 0;
    }

    for rule_idx in 0..rule_atom_offsets.len() {
        let atom_offset = rule_atom_offsets[rule_idx] as usize;
        let atom_count = rule_atom_counts[rule_idx] as usize;
        let label_id = rule_label_ids[rule_idx];

        let mut i: usize = 0;
        while i < token_count {
            if out_label_ids[i] != UNCHUNKED_LABEL {
                i += 1;
                continue;
            }
            let end = match match_pattern_recursive(
                token_tag_ids,
                &out_label_ids[0..token_count],
                atom_offset,
                atom_count,
                0,
                i,
                atom_allowed_offsets,
                atom_allowed_lengths,
                atom_allowed_flat,
                atom_mins,
                atom_maxs,
            ) {
                Some(end) => end,
                None => {
                    i += 1;
                    continue;
                }
            };
            if end <= i {
                i += 1;
                continue;
            }
            for j in i..end {
                out_label_ids[j] = label_id;
                out_begins[j] = if j == i { 1 } else { 0 };
            }
            i = end;
        }
    }

    token_count as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunk_iob_ids_basic_np_vp_pattern() {
        let tags: [u16; 9] = [1, 2, 2, 3, 4, 5, 1, 2, 3];
        // atoms:
        // 0: DT optional -> {1}
        // 1: JJ* -> {2}
        // 2: NN+ -> {3}
        // 3: VB+ -> {4}
        // 4: IN? -> {5}
        let allowed_offsets: [u32; 5] = [0, 1, 2, 3, 4];
        let allowed_lens: [u32; 5] = [1, 1, 1, 1, 1];
        let allowed_flat: [u16; 5] = [1, 2, 3, 4, 5];
        let mins: [u8; 5] = [0, 0, 1, 1, 0];
        let maxs: [u8; 5] = [1, u8::MAX, u8::MAX, u8::MAX, 1];
        let rule_offsets: [u32; 2] = [0, 3];
        let rule_counts: [u32; 2] = [3, 2];
        let rule_labels: [u16; 2] = [0, 1];

        let mut out_labels = [0u16; 9];
        let mut out_begins = [0u8; 9];
        let written = fill_chunk_iob_ids(
            &tags,
            &allowed_offsets,
            &allowed_lens,
            &allowed_flat,
            &mins,
            &maxs,
            &rule_offsets,
            &rule_counts,
            &rule_labels,
            &mut out_labels,
            &mut out_begins,
        );
        assert_eq!(written, tags.len() as u64);
        assert_eq!(out_labels[0], 0);
        assert_eq!(out_labels[3], 0);
        assert_eq!(out_labels[4], 1);
        assert_eq!(out_labels[5], 1);
    }
}
