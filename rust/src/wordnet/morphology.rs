use std::collections::HashSet;

pub(super) fn normalize_lemma(value: &str) -> String {
    value
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("_")
}

fn unique(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

fn noun_candidates(word: &str) -> Vec<String> {
    let lower = normalize_lemma(word);
    let mut out = vec![lower.clone()];
    if lower.ends_with("ies") && lower.len() > 3 {
        out.push(format!("{}y", &lower[..lower.len() - 3]));
    }
    if lower.ends_with("ves") && lower.len() > 3 {
        out.push(format!("{}f", &lower[..lower.len() - 3]));
    }
    if lower.ends_with("es") && lower.len() > 2 {
        out.push(lower[..lower.len() - 2].to_string());
    }
    if lower.ends_with('s') && lower.len() > 1 {
        out.push(lower[..lower.len() - 1].to_string());
    }
    unique(out)
}

fn verb_candidates(word: &str) -> Vec<String> {
    let lower = normalize_lemma(word);
    let mut out = vec![lower.clone()];
    if lower.ends_with("ies") && lower.len() > 3 {
        out.push(format!("{}y", &lower[..lower.len() - 3]));
    }
    if lower.ends_with("ing") && lower.len() > 4 {
        let stem = &lower[..lower.len() - 3];
        out.push(stem.to_string());
        out.push(format!("{}e", stem));
        let bytes = stem.as_bytes();
        if bytes.len() >= 2 && bytes[bytes.len() - 1] == bytes[bytes.len() - 2] {
            out.push(stem[..stem.len() - 1].to_string());
        }
    }
    if lower.ends_with("ed") && lower.len() > 3 {
        let stem = &lower[..lower.len() - 2];
        out.push(stem.to_string());
        out.push(lower[..lower.len() - 1].to_string());
        let bytes = stem.as_bytes();
        if bytes.len() >= 2 && bytes[bytes.len() - 1] == bytes[bytes.len() - 2] {
            out.push(stem[..stem.len() - 1].to_string());
        }
    }
    if lower.ends_with('s') && lower.len() > 1 {
        out.push(lower[..lower.len() - 1].to_string());
    }
    unique(out)
}

fn adjective_candidates(word: &str) -> Vec<String> {
    let lower = normalize_lemma(word);
    let mut out = vec![lower.clone()];
    if lower.ends_with("er") && lower.len() > 2 {
        out.push(lower[..lower.len() - 2].to_string());
    }
    if lower.ends_with("est") && lower.len() > 3 {
        out.push(lower[..lower.len() - 3].to_string());
    }
    unique(out)
}

pub(super) fn morph_candidates(word: &str, pos: &str) -> Vec<String> {
    match pos {
        "n" => noun_candidates(word),
        "v" => verb_candidates(word),
        "a" => adjective_candidates(word),
        "r" => vec![normalize_lemma(word)],
        _ => unique(
            noun_candidates(word)
                .into_iter()
                .chain(verb_candidates(word))
                .chain(adjective_candidates(word))
                .chain(std::iter::once(normalize_lemma(word)))
                .collect(),
        ),
    }
}

// Preserve the candidate order exposed by the original stateless native helper.
// WordNet then validates the candidate against its lemma index before accepting it.
pub(super) fn legacy_morph_candidate(word: &str, pos: &str) -> String {
    let lower = normalize_lemma(word);
    let replace_suffix = |suffix: &str, replacement: &str| {
        format!("{}{}", &lower[..lower.len() - suffix.len()], replacement)
    };
    match pos {
        "v" => {
            if lower.ends_with("ies") && lower.len() > 3 {
                replace_suffix("ies", "y")
            } else if lower.ends_with("ing") && lower.len() > 4 {
                replace_suffix("ing", "")
            } else if lower.ends_with("ed") && lower.len() > 3 {
                replace_suffix("ed", "")
            } else if lower.ends_with('s') && lower.len() > 1 {
                replace_suffix("s", "")
            } else {
                lower
            }
        }
        "a" => {
            if lower.ends_with("est") && lower.len() > 3 {
                replace_suffix("est", "")
            } else if lower.ends_with("er") && lower.len() > 2 {
                replace_suffix("er", "")
            } else {
                lower
            }
        }
        "r" => lower,
        _ => {
            if lower.ends_with("ies") && lower.len() > 3 {
                replace_suffix("ies", "y")
            } else if lower.ends_with("ves") && lower.len() > 3 {
                replace_suffix("ves", "f")
            } else if lower.ends_with("es") && lower.len() > 2 {
                replace_suffix("es", "")
            } else if lower.ends_with('s') && lower.len() > 1 {
                replace_suffix("s", "")
            } else {
                lower
            }
        }
    }
}
