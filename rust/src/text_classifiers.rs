//! Versioned legacy text vectorizer, decision tree and MaxEnt contracts.
//! Deliberately separate from categorical feature APIs and batch text_linear.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

mod maxent;
mod transport;
mod tree;
mod vectorizer;

pub(crate) use maxent::{encode_sparse, predictions};
pub use maxent::{Iis, Prediction, Sgd, SgdOptions};
pub use transport::execute;
pub(crate) use tree::{build_tree, TreeRow};
pub use tree::{LabelCounts, Tree, TreeNode, TreeOptions};
pub use vectorizer::{Sparse, Vectorizer};

type Result<T> = std::result::Result<T, String>;
const MAX_SAFE: u64 = 9_007_199_254_740_991;

#[derive(Deserialize)]
pub struct Example {
    label: String,
    text: String,
}

fn tokens(text: &str) -> Vec<String> {
    text.as_bytes()
        .split(|&b| !crate::ascii::is_token_char(b))
        .filter(|s| !s.is_empty())
        .map(|s| s.iter().map(|b| b.to_ascii_lowercase() as char).collect())
        .collect()
}

fn counts(words: Vec<String>) -> Vec<(String, f64)> {
    let mut ids = HashMap::new();
    let mut out: Vec<(String, f64)> = Vec::new();
    for word in words {
        let next = out.len();
        let id = *ids.entry(word.clone()).or_insert(next);
        if id == next {
            out.push((word, 0.0));
        }
        out[id].1 += 1.0;
    }
    out
}

fn unique(words: &[String]) -> bool {
    words.iter().collect::<HashSet<_>>().len() == words.len()
}

fn js_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    a.encode_utf16().cmp(b.encode_utf16())
}

#[cfg(test)]
mod tests;
