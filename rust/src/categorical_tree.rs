//! NLTK error-minimizing categorical stumps with entropy/support/depth refinement.
//! Feature/value split ties use first-seen order, not Python's randomized sets.
use crate::numeric_validation::offsets;
use crate::{CoreError, CoreResult};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Copy)]
pub struct TreeOptions {
    pub entropy_cutoff: f64,
    pub depth_cutoff: u32,
    pub support_cutoff: u32,
    pub binary: bool,
}

struct Row {
    pairs: Vec<(u32, u32)>,
    label: u32,
}

impl Row {
    fn value(&self, name: u32) -> u32 {
        self.pairs
            .iter()
            .find(|pair| pair.0 == name)
            .map_or(0, |pair| pair.1)
    }
}

#[derive(Default)]
struct Counts(Vec<(u32, usize)>);

impl Counts {
    fn from_rows(rows: &[Row], indices: &[usize]) -> Self {
        let mut counts = Self::default();
        for &index in indices {
            let label = rows[index].label;
            if let Some(pair) = counts.0.iter_mut().find(|pair| pair.0 == label) {
                pair.1 += 1;
            } else {
                counts.0.push((label, 1));
            }
        }
        counts
    }

    fn majority(&self) -> (u32, usize) {
        self.0
            .iter()
            .copied()
            .reduce(|best, next| if next.1 > best.1 { next } else { best })
            .unwrap()
    }

    fn entropy(&self, total: usize) -> f64 {
        self.0
            .iter()
            .map(|pair| {
                let p = pair.1 as f64 / total as f64;
                -p * (p.ln() / std::f64::consts::LN_2)
            })
            .sum()
    }
}

struct Node {
    label: u32,
    name: Option<u32>,
    decisions: Vec<(u32, usize)>,
    default: Option<usize>,
}

impl Node {
    fn leaf(label: u32) -> Self {
        Self {
            label,
            name: None,
            decisions: Vec::new(),
            default: None,
        }
    }
}

struct Group {
    value: Option<u32>, // None is the binary default; Some(0) is Python None.
    indices: Vec<usize>,
    counts: Counts,
}

struct Split {
    name: u32,
    groups: Vec<Group>,
}

fn groups(rows: &[Row], indices: &[usize], name: u32, binary_value: Option<u32>) -> Vec<Group> {
    let mut groups: Vec<Group> = Vec::new();
    let mut lookup = HashMap::new();
    for &index in indices {
        let value = rows[index].value(name);
        let key = if binary_value.is_some_and(|target| target != value) {
            None
        } else {
            Some(value)
        };
        let group = *lookup.entry(key).or_insert_with(|| {
            groups.push(Group {
                value: key,
                indices: Vec::new(),
                counts: Counts::default(),
            });
            groups.len() - 1
        });
        groups[group].indices.push(index);
    }
    for group in &mut groups {
        group.counts = Counts::from_rows(rows, &group.indices);
    }
    groups
}

fn feature_names(rows: &[Row], indices: &[usize]) -> Vec<u32> {
    let mut seen = HashSet::new();
    indices
        .iter()
        .flat_map(|&index| &rows[index].pairs)
        .filter_map(|pair| seen.insert(pair.0).then_some(pair.0))
        .collect()
}

pub struct CategoricalDecisionTree {
    nodes: Vec<Node>,
}

impl CategoricalDecisionTree {
    pub fn train(
        pairs: &[u32],
        doc_offsets: &[u32],
        labels: &[u32],
        label_count: u32,
        options: TreeOptions,
    ) -> CoreResult<Self> {
        if labels.is_empty()
            || label_count == 0
            || label_count as usize > labels.len()
            || !pairs.len().is_multiple_of(2)
            || doc_offsets.len() != labels.len() + 1
            || labels.iter().any(|label| *label >= label_count)
            || !options.entropy_cutoff.is_finite()
            || options.entropy_cutoff < 0.0
            || options.depth_cutoff == 0
            || options.depth_cutoff > 100
        {
            return Err(CoreError::InvalidN);
        }
        offsets(doc_offsets, pairs.len() / 2)?;
        let mut rows = Vec::new();
        rows.try_reserve_exact(labels.len())
            .map_err(|_| CoreError::OutOfMemory)?;
        let mut values: HashMap<u32, Vec<u32>> = HashMap::new();
        for (index, &label) in labels.iter().enumerate() {
            let mut seen = HashSet::new();
            let mut row = Row {
                pairs: Vec::new(),
                label,
            };
            for pair in pairs[2 * doc_offsets[index] as usize..2 * doc_offsets[index + 1] as usize]
                .chunks_exact(2)
            {
                if !seen.insert(pair[0]) {
                    return Err(CoreError::InvalidN);
                }
                row.pairs.push((pair[0], pair[1]));
                let feature_values = values.entry(pair[0]).or_default();
                if !feature_values.contains(&pair[1]) {
                    feature_values.push(pair[1]);
                }
            }
            rows.push(row);
        }
        let mut model = Self {
            nodes: vec![Node::leaf(labels[0])],
        };
        let mut pending = vec![(0, (0..rows.len()).collect::<Vec<_>>(), options.depth_cutoff)];
        while let Some((node_index, indices, depth)) = pending.pop() {
            let counts = Counts::from_rows(&rows, &indices);
            let (label, correct) = counts.majority();
            model.nodes[node_index].label = label;
            let mut best_errors = indices.len() - correct;
            let mut best = None;
            for name in feature_names(&rows, &indices) {
                let candidates: Vec<Option<u32>> = if options.binary {
                    values[&name].iter().copied().map(Some).collect()
                } else {
                    vec![None]
                };
                for value in candidates {
                    let groups = groups(&rows, &indices, name, value);
                    let errors = groups
                        .iter()
                        .map(|group| group.indices.len() - group.counts.majority().1)
                        .sum();
                    if errors < best_errors {
                        best_errors = errors;
                        best = Some(Split { name, groups });
                    }
                }
            }
            if let Some(split) = best {
                // NLTK stump()/binary_stump() overwrite their majority `label`
                // variable in the row loop; unseen branches use the LAST label.
                model.nodes[node_index].label = rows[*indices.last().unwrap()].label;
                model.nodes[node_index].name = Some(split.name);
                for group in split.groups {
                    if model.nodes.len() >= 1_000_000 {
                        return Err(CoreError::InsufficientCapacity);
                    }
                    model
                        .nodes
                        .try_reserve(1)
                        .map_err(|_| CoreError::OutOfMemory)?;
                    let child = model.nodes.len();
                    model.nodes.push(Node::leaf(group.counts.majority().0));
                    if let Some(value) = group.value {
                        model.nodes[node_index].decisions.push((value, child));
                    } else {
                        model.nodes[node_index].default = Some(child);
                    }
                    // NLTK applies support to the parent before refining each child.
                    if indices.len() > options.support_cutoff as usize
                        && depth > 1
                        && group.counts.entropy(group.indices.len()) > options.entropy_cutoff
                    {
                        pending.push((child, group.indices, depth - 1));
                    }
                }
            }
        }
        Ok(model)
    }

    pub fn classify(&self, pairs: &[u32]) -> CoreResult<u32> {
        if !pairs.len().is_multiple_of(2) {
            return Err(CoreError::InvalidN);
        }
        let mut seen = HashSet::new();
        for pair in pairs.chunks_exact(2) {
            if !seen.insert(pair[0]) {
                return Err(CoreError::InvalidN);
            }
        }
        let mut index = 0;
        loop {
            let node = &self.nodes[index];
            let Some(name) = node.name else {
                return Ok(node.label);
            };
            let value = pairs
                .chunks_exact(2)
                .find(|pair| pair[0] == name)
                .map_or(0, |pair| pair[1]);
            let next = node
                .decisions
                .iter()
                .find(|pair| pair.0 == value)
                .map(|pair| pair.1)
                .or(node.default);
            if let Some(next) = next {
                index = next;
            } else {
                return Ok(node.label);
            }
        }
    }

    pub fn labels(&self) -> Vec<u32> {
        let mut seen = HashSet::new();
        self.nodes
            .iter()
            .filter_map(|node| seen.insert(node.label).then_some(node.label))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn options(binary: bool) -> TreeOptions {
        TreeOptions {
            entropy_cutoff: 0.05,
            depth_cutoff: 100,
            support_cutoff: 0,
            binary,
        }
    }

    #[test]
    fn preserves_categorical_associations_missing_values_and_defaults() {
        for binary in [false, true] {
            let model = CategoricalDecisionTree::train(
                &[0, 1, 0, 2],
                &[0, 1, 2, 2],
                &[0, 1, 1],
                2,
                options(binary),
            )
            .unwrap();
            assert_eq!(model.classify(&[0, 1]), Ok(0));
            assert_eq!(model.classify(&[0, 2]), Ok(1));
            assert_eq!(model.classify(&[]), Ok(1));
            assert_eq!(model.classify(&[0, 99]), Ok(1));
        }
    }

    #[test]
    fn rejects_empty_training_bad_offsets_duplicates_and_parameters() {
        assert!(CategoricalDecisionTree::train(&[], &[0], &[], 0, options(false)).is_err());
        assert!(
            CategoricalDecisionTree::train(&[0, 1, 0, 2], &[0, 2], &[0], 1, options(false))
                .is_err()
        );
        assert!(CategoricalDecisionTree::train(&[0, 1], &[1, 1], &[0], 1, options(false)).is_err());
        let mut opt = options(false);
        opt.entropy_cutoff = f64::NAN;
        assert!(CategoricalDecisionTree::train(&[], &[0, 0], &[0], 1, opt).is_err());
    }
}
