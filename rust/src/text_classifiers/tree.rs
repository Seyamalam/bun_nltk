use super::*;

// Retain first-seen count order in legacy leaf objects (including prototype names).
// serde_json::Map's default key sorting is not the legacy insertion order.
#[derive(Clone)]
pub struct LabelCounts(pub(crate) Vec<(String, usize)>);
impl Serialize for LabelCounts {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(self.0.len()))?;
        for (label, count) in &self.0 {
            map.serialize_entry(label, count)?;
        }
        map.end()
    }
}
impl<'de> Deserialize<'de> for LabelCounts {
    fn deserialize<D: serde::Deserializer<'de>>(
        deserializer: D,
    ) -> std::result::Result<Self, D::Error> {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = LabelCounts;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("label count object")
            }
            fn visit_map<M: serde::de::MapAccess<'de>>(
                self,
                mut map: M,
            ) -> std::result::Result<Self::Value, M::Error> {
                let mut rows = Vec::new();
                while let Some(row) = map.next_entry()? {
                    rows.push(row);
                }
                Ok(LabelCounts(rows))
            }
        }
        deserializer.deserialize_map(Visitor)
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TreeNode {
    Leaf {
        label: String,
        counts: LabelCounts,
    },
    Split {
        #[serde(rename = "featureId")]
        feature_id: usize,
        feature: String,
        absent: Box<TreeNode>,
        present: Box<TreeNode>,
    },
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeOptions {
    pub(crate) max_depth: u64,
    pub(crate) min_samples: u64,
    pub(crate) max_candidate_features: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Tree {
    pub(crate) version: u32,
    pub(crate) labels: Vec<String>,
    pub(crate) options: TreeOptions,
    pub(crate) vectorizer: Vectorizer,
    pub(crate) tree: TreeNode,
}

pub(crate) struct TreeRow {
    pub(crate) label: String,
    pub(crate) indices: Vec<usize>,
}
fn label_counts(rows: &[&TreeRow]) -> LabelCounts {
    let mut out: Vec<(String, usize)> = Vec::new();
    for row in rows {
        match out.iter_mut().find(|(label, _)| label == &row.label) {
            Some((_, n)) => *n += 1,
            None => out.push((row.label.clone(), 1)),
        }
    }
    LabelCounts(out)
}
fn majority(counts: &LabelCounts) -> String {
    let mut best = ("", 0);
    for (label, count) in &counts.0 {
        if *count > best.1 {
            best = (label, *count);
        }
    }
    best.0.into()
}
fn leaf(rows: &[&TreeRow]) -> TreeNode {
    let counts = label_counts(rows);
    TreeNode::Leaf {
        label: majority(&counts),
        counts,
    }
}
fn entropy(rows: &[&TreeRow]) -> f64 {
    let mut h = 0.0;
    for (_, count) in label_counts(rows).0 {
        let p = count as f64 / rows.len() as f64;
        h -= p * p.log2();
    }
    h
}
pub(crate) fn build_tree(
    rows: &[&TreeRow],
    vocabulary: &[String],
    options: &TreeOptions,
    depth: u64,
) -> TreeNode {
    let label = majority(&label_counts(rows));
    let mut best = leaf(rows);
    let mut best_error = rows.iter().filter(|r| r.label != label).count();
    let mut candidates: Vec<usize> = rows
        .iter()
        .flat_map(|r| r.indices.iter().copied())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    candidates.sort_by(|&a, &b| js_cmp(&vocabulary[a], &vocabulary[b]));
    let mut best_rows = (Vec::new(), Vec::new());
    let limit = options.max_candidate_features.min(candidates.len() as u64) as usize;
    for feature_id in candidates.into_iter().take(limit) {
        let (present, absent): (Vec<_>, Vec<_>) = rows
            .iter()
            .copied()
            .partition(|r| r.indices.binary_search(&feature_id).is_ok());
        if absent.is_empty() || present.is_empty() {
            continue;
        }
        let absent_label = majority(&label_counts(&absent));
        let present_label = majority(&label_counts(&present));
        let error = absent.iter().filter(|r| r.label != absent_label).count()
            + present.iter().filter(|r| r.label != present_label).count();
        if error < best_error {
            best_error = error;
            best = TreeNode::Split {
                feature_id,
                feature: vocabulary[feature_id].clone(),
                absent: Box::new(leaf(&absent)),
                present: Box::new(leaf(&present)),
            };
            best_rows = (absent, present);
        }
    }
    // Select the stump before NLTK's depth/support/entropy refinement cutoffs.
    if let TreeNode::Split {
        absent, present, ..
    } = &mut best
    {
        if rows.len() as u64 > options.min_samples && depth + 1 < options.max_depth {
            if entropy(&best_rows.0) > 0.05 {
                **absent = build_tree(&best_rows.0, vocabulary, options, depth + 1);
            }
            if entropy(&best_rows.1) > 0.05 {
                **present = build_tree(&best_rows.1, vocabulary, options, depth + 1);
            }
        }
    }
    best
}

impl Tree {
    pub(crate) fn validate(&self) -> Result<()> {
        self.vectorizer.validate()?;
        if self.version != 1
            || self.labels.is_empty()
            || !unique(&self.labels)
            || self.options.max_depth == 0
            || self.options.max_depth > MAX_SAFE
            || self.options.min_samples == 0
            || self.options.min_samples > MAX_SAFE
            || self.options.max_candidate_features < 4
            || self.options.max_candidate_features > MAX_SAFE
        {
            return Err("invalid text decision tree payload".into());
        }
        fn validate_node(node: &TreeNode, model: &Tree) -> Result<()> {
            match node {
                TreeNode::Leaf { label, counts } => {
                    if !model.labels.contains(label)
                        || counts
                            .0
                            .iter()
                            .any(|(l, n)| !model.labels.contains(l) || *n == 0)
                    {
                        return Err("invalid text decision tree leaf".into());
                    }
                }
                TreeNode::Split {
                    feature_id,
                    feature,
                    absent,
                    present,
                } => {
                    if model.vectorizer.vocabulary.get(*feature_id) != Some(feature) {
                        return Err("invalid text decision tree feature".into());
                    }
                    validate_node(absent, model)?;
                    validate_node(present, model)?;
                }
            }
            Ok(())
        }
        validate_node(&self.tree, self)
    }

    pub(crate) fn predict(&self, text: &str) -> String {
        let vector = self.vectorizer.transform(text);
        let mut node = &self.tree;
        loop {
            match node {
                TreeNode::Leaf { label, .. } => return label.clone(),
                TreeNode::Split {
                    feature_id,
                    absent,
                    present,
                    ..
                } => {
                    node = if vector.indices.binary_search(feature_id).is_ok() {
                        present
                    } else {
                        absent
                    };
                }
            }
        }
    }
}
