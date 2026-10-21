//! Versioned legacy text vectorizer, decision tree and MaxEnt contracts.
//! Deliberately separate from categorical feature APIs and batch text_linear.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

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

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vectorizer {
    version: u32,
    ngram_min: u64,
    ngram_max: u64,
    binary: bool,
    max_features: u64,
    vocabulary: Vec<String>,
}

#[derive(Serialize)]
pub struct Sparse {
    indices: Vec<usize>,
    values: Vec<f64>,
}

impl Vectorizer {
    fn validate(&self) -> Result<()> {
        if self.version != 1
            || self.ngram_min == 0
            || self.ngram_max < self.ngram_min
            || self.ngram_max > MAX_SAFE
            || self.max_features < 64
            || self.max_features > MAX_SAFE
            || !unique(&self.vocabulary)
        {
            return Err("invalid text vectorizer payload".into());
        }
        Ok(())
    }

    fn features(&self, text: &str) -> Vec<String> {
        let words = tokens(text);
        let mut out = Vec::new();
        // Clamping to document length also handles huge (but valid) ngram options.
        for n in self.ngram_min..=self.ngram_max.min(words.len() as u64) {
            for window in words.windows(n as usize) {
                out.push(window.join("\u{1}"));
            }
        }
        out
    }

    fn fit(mut self, texts: &[String]) -> Result<Self> {
        self.validate()?;
        let mut ranked = counts(texts.iter().flat_map(|text| self.features(text)).collect());
        ranked.sort_by(|a, b| b.1.total_cmp(&a.1).then_with(|| js_cmp(&a.0, &b.0)));
        let limit = self.max_features.min(ranked.len() as u64) as usize;
        self.vocabulary = ranked.into_iter().take(limit).map(|(w, _)| w).collect();
        Ok(self)
    }

    fn transform(&self, text: &str) -> Sparse {
        let mapping: HashMap<&str, usize> = self
            .vocabulary
            .iter()
            .enumerate()
            .map(|(i, w)| (w.as_str(), i))
            .collect();
        let mut values = BTreeMap::new();
        for word in self.features(text) {
            if let Some(&id) = mapping.get(word.as_str()) {
                let value = values.entry(id).or_insert(0.0);
                if self.binary {
                    *value = 1.0;
                } else {
                    *value += 1.0;
                }
            }
        }
        Sparse {
            indices: values.keys().copied().collect(),
            values: values.values().copied().collect(),
        }
    }
}

// Retain first-seen count order in legacy leaf objects (including prototype names).
// serde_json::Map's default key sorting is not the legacy insertion order.
#[derive(Clone)]
pub struct LabelCounts(Vec<(String, usize)>);
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
    max_depth: u64,
    min_samples: u64,
    max_candidate_features: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Tree {
    version: u32,
    labels: Vec<String>,
    options: TreeOptions,
    vectorizer: Vectorizer,
    tree: TreeNode,
}

struct TreeRow {
    label: String,
    indices: Vec<usize>,
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
fn build_tree(
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
                *absent = Box::new(build_tree(&best_rows.0, vocabulary, options, depth + 1));
            }
            if entropy(&best_rows.1) > 0.05 {
                *present = Box::new(build_tree(&best_rows.1, vocabulary, options, depth + 1));
            }
        }
    }
    best
}

impl Tree {
    fn validate(&self) -> Result<()> {
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

    fn predict(&self, text: &str) -> String {
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

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SgdOptions {
    epochs: u64,
    learning_rate: f64,
    l2: f64,
    max_features: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Sgd {
    version: u32,
    labels: Vec<String>,
    vocabulary: Vec<String>,
    weights: Vec<Vec<f64>>,
    bias: Vec<f64>,
    options: SgdOptions,
}

#[derive(Serialize)]
pub struct Prediction {
    label: String,
    probability: f64,
    logit: f64,
}

fn probabilities(logits: &[f64], base_two: bool) -> Vec<f64> {
    let max = logits.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let mut out: Vec<f64> = logits
        .iter()
        .map(|x| {
            if base_two {
                (x - max).exp2()
            } else {
                (x - max).exp()
            }
        })
        .collect();
    let sum = out.iter().sum::<f64>();
    if !base_two && (!sum.is_finite() || sum <= 0.0) {
        out.fill(1.0 / logits.len().max(1) as f64);
    } else {
        for value in &mut out {
            *value /= sum;
        }
    }
    out
}
fn predictions(labels: &[String], logits: Vec<f64>, base_two: bool) -> Vec<Prediction> {
    let probs = probabilities(&logits, base_two);
    let mut out: Vec<_> = labels
        .iter()
        .zip(logits)
        .zip(probs)
        .map(|((label, logit), probability)| Prediction {
            label: label.clone(),
            logit,
            probability,
        })
        .collect();
    out.sort_by(|a, b| {
        b.probability.total_cmp(&a.probability).then_with(|| {
            if base_two {
                js_cmp(&b.label, &a.label)
            } else {
                std::cmp::Ordering::Equal
            }
        })
    });
    out
}

fn encode_sparse(vocabulary: &[String], text: &str) -> Vec<(usize, f64)> {
    let mapping: HashMap<&str, usize> = vocabulary
        .iter()
        .enumerate()
        .map(|(i, w)| (w.as_str(), i))
        .collect();
    let mut values = BTreeMap::new();
    for token in tokens(text) {
        if let Some(&id) = mapping.get(token.as_str()) {
            *values.entry(id).or_insert(0.0) += 1.0;
        }
    }
    values.into_iter().collect()
}
impl Sgd {
    fn validate(&self, trained: bool) -> Result<()> {
        if self.version != 1
            || !unique(&self.labels)
            || !unique(&self.vocabulary)
            || (trained && (self.labels.is_empty() || self.vocabulary.is_empty()))
            || self.weights.len() != self.labels.len()
            || self.bias.len() != self.labels.len()
            || self
                .weights
                .iter()
                .any(|w| w.len() != self.vocabulary.len() || w.iter().any(|x| !x.is_finite()))
            || self.bias.iter().any(|x| !x.is_finite())
            || self.options.epochs == 0
            || self.options.epochs > MAX_SAFE
            || !self.options.learning_rate.is_finite()
            || self.options.learning_rate < 1e-6
            || !self.options.l2.is_finite()
            || self.options.l2 < 0.0
            || self.options.max_features < 100
            || self.options.max_features > MAX_SAFE
        {
            return Err("invalid MaxEnt weight/bias or options payload".into());
        }
        Ok(())
    }
    fn logits(&self, doc: &[(usize, f64)]) -> Vec<f64> {
        self.weights
            .iter()
            .zip(&self.bias)
            .map(|(weights, bias)| {
                // TS sums the dot product starting at zero, then adds bias once.
                let mut dot = 0.0;
                for &(id, value) in doc {
                    dot += weights[id] * value;
                }
                bias + dot
            })
            .collect()
    }
    fn train(mut self, examples: &[Example]) -> Result<Self> {
        if examples.is_empty() {
            return Err("MaxEnt training requires at least one example".into());
        }
        if self.labels.len() < 2 {
            return Err("MaxEnt training requires at least 2 labels".into());
        }
        if self.vocabulary.is_empty() {
            return Err("MaxEnt training produced an empty vocabulary".into());
        }
        self.weights = vec![vec![0.0; self.vocabulary.len()]; self.labels.len()];
        self.bias = vec![0.0; self.labels.len()];
        self.validate(true)?;
        let data: Result<Vec<_>> = examples
            .iter()
            .map(|r| {
                let label = self
                    .labels
                    .iter()
                    .position(|l| l == &r.label)
                    .ok_or("unknown MaxEnt label")?;
                Ok((encode_sparse(&self.vocabulary, &r.text), label))
            })
            .collect();
        let data = data?;
        for _ in 0..self.options.epochs {
            for (doc, label) in &data {
                let probs = probabilities(&self.logits(doc), false);
                for (l, &prob) in probs.iter().enumerate() {
                    let error = if l == *label { 1.0 } else { 0.0 } - prob;
                    self.bias[l] += self.options.learning_rate * error;
                    for &(id, count) in doc {
                        self.weights[l][id] += self.options.learning_rate
                            * (error * count - self.options.l2 * self.weights[l][id]);
                    }
                }
            }
        }
        self.validate(true)?;
        Ok(self)
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Iis {
    version: u32,
    algorithm: String,
    labels: Vec<String>,
    features: Vec<(String, f64, String)>,
    weights: Vec<f64>,
    epochs: f64,
}
impl Iis {
    fn validate(&self, trained: bool) -> Result<()> {
        let mut seen = HashSet::new();
        if self.version != 2
            || self.algorithm != "iis"
            || (trained && self.labels.is_empty())
            || !unique(&self.labels)
            || self.weights.len() != self.features.len()
            || self.weights.iter().any(|x| !x.is_finite())
            || !self.epochs.is_finite()
            || self.epochs.abs() > MAX_SAFE as f64
            || self.features.iter().any(|(word, count, label)| {
                !self.labels.contains(label)
                    || !count.is_finite()
                    || *count < 1.0
                    || count.fract() != 0.0
                    || *count > MAX_SAFE as f64
                    || !seen.insert((word, *count as u64, label))
            })
        {
            return Err("invalid IIS serialized payload".into());
        }
        Ok(())
    }
    fn mapping(&self) -> HashMap<(&str, u64, &str), usize> {
        self.features
            .iter()
            .enumerate()
            .map(|(id, (word, count, label))| ((word.as_str(), *count as u64, label.as_str()), id))
            .collect()
    }
    fn encode(
        &self,
        words: &[(String, f64)],
        mapping: &HashMap<(&str, u64, &str), usize>,
    ) -> Vec<Vec<usize>> {
        self.labels
            .iter()
            .map(|label| {
                words
                    .iter()
                    .filter_map(|(word, count)| {
                        mapping
                            .get(&(word.as_str(), *count as u64, label.as_str()))
                            .copied()
                    })
                    .collect()
            })
            .collect()
    }
    fn logits(&self, doc: &[Vec<usize>]) -> Vec<f64> {
        doc.iter()
            .map(|ids| ids.iter().fold(0.0, |sum, &id| sum + self.weights[id]))
            .collect()
    }
    fn train(mut self, rows: &[Example]) -> Result<Self> {
        if rows.is_empty() {
            return Err("MaxEnt training requires at least one example".into());
        }
        self.labels = rows
            .iter()
            .map(|r| r.label.clone())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        self.labels.sort_by(|a, b| js_cmp(a, b));
        self.features.clear();
        let data: Vec<_> = rows.iter().map(|r| counts(tokens(&r.text))).collect();
        let mut mapping = HashMap::new();
        let mut empirical = Vec::new();
        for (row, words) in rows.iter().zip(&data) {
            for (word, count) in words {
                let next = self.features.len();
                let id = *mapping
                    .entry((word.clone(), *count as u64, row.label.clone()))
                    .or_insert(next);
                if id == next {
                    self.features
                        .push((word.clone(), *count, row.label.clone()));
                    empirical.push(0.0);
                }
                empirical[id] += 1.0;
            }
        }
        for value in &mut empirical {
            *value /= rows.len() as f64;
        }
        self.weights = vec![0.0; empirical.len()];
        self.validate(true)?;
        let mapping = self.mapping();
        let encoded: Vec<_> = data
            .iter()
            .map(|words| self.encode(words, &mapping))
            .collect();
        // Legacy text IIS has its own base-2 softmax and Newton convergence
        // contract, unlike categorical_maxent's log-probability transport.
        for _ in 0..(self.epochs - 1.0).max(1.0).ceil() as u64 {
            let mut a = vec![BTreeMap::<usize, f64>::new(); empirical.len()];
            for doc in &encoded {
                let probs = probabilities(&self.logits(doc), true);
                for (ids, prob) in doc.iter().zip(probs) {
                    for &id in ids {
                        *a[id].entry(ids.len()).or_insert(0.0) += prob;
                    }
                }
            }
            let terms: Vec<Vec<_>> = a
                .into_iter()
                .map(|bucket| {
                    bucket
                        .into_iter()
                        .map(|(nf, p)| (nf as f64, p / rows.len() as f64))
                        .collect()
                })
                .collect();
            let mut deltas: Vec<f64> = terms
                .iter()
                .map(|t| {
                    let max_features = t.last().map(|(n, _)| *n).unwrap_or(1.0);
                    if max_features > 900.0 {
                        1.0 / max_features
                    } else {
                        1.0
                    }
                })
                .collect();
            for _ in 0..300 {
                let mut error = 0.0;
                let mut magnitude = 0.0;
                for id in 0..deltas.len() {
                    let (mut sum1, mut sum2) = (0.0, 0.0);
                    for &(nf, p) in &terms[id] {
                        let exp = (nf * deltas[id]).exp2();
                        sum1 += exp * p;
                        sum2 += nf * exp * p;
                    }
                    let delta = deltas[id] + (empirical[id] - sum1) / sum2;
                    if !delta.is_finite() {
                        return Err("IIS training failed to produce a finite feature update".into());
                    }
                    deltas[id] = delta;
                    error += (empirical[id] - sum1).abs();
                    magnitude += delta.abs();
                }
                if error / magnitude < 1e-12 {
                    break;
                }
            }
            for (weight, delta) in self.weights.iter_mut().zip(deltas) {
                *weight += delta;
                if !weight.is_finite() {
                    return Err("IIS training produced a nonfinite weight".into());
                }
            }
        }
        Ok(self)
    }
}

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
enum Request {
    FitVectorizer {
        model: Vectorizer,
        texts: Vec<String>,
    },
    LoadVectorizer {
        model: Vectorizer,
    },
    TransformVectorizer {
        model: Vectorizer,
        texts: Vec<String>,
    },
    TrainTree {
        labels: Vec<String>,
        options: TreeOptions,
        vectorizer: Vectorizer,
        examples: Vec<Example>,
    },
    LoadTree {
        model: Tree,
    },
    PredictTree {
        model: Tree,
        text: String,
    },
    SgdVocabulary {
        texts: Vec<String>,
    },
    TrainSgd {
        model: Sgd,
        examples: Vec<Example>,
    },
    LoadSgd {
        model: Sgd,
    },
    PredictSgd {
        model: Sgd,
        text: String,
    },
    TrainIis {
        model: Iis,
        examples: Vec<Example>,
    },
    LoadIis {
        model: Iis,
    },
    PredictIis {
        model: Iis,
        text: String,
    },
}

fn json<T: Serialize>(value: T) -> Result<Vec<u8>> {
    serde_json::to_vec(&value).map_err(|e| e.to_string())
}
pub fn execute(input: &[u8]) -> Result<Vec<u8>> {
    match serde_json::from_slice(input).map_err(|e| e.to_string())? {
        Request::FitVectorizer { model, texts } => json(model.fit(&texts)?),
        Request::LoadVectorizer { model } => {
            model.validate()?;
            json(model)
        }
        Request::TransformVectorizer { model, texts } => {
            model.validate()?;
            json(
                texts
                    .iter()
                    .map(|text| model.transform(text))
                    .collect::<Vec<_>>(),
            )
        }
        Request::TrainTree {
            labels,
            options,
            vectorizer,
            examples,
        } => {
            if examples.is_empty() {
                return Err("DecisionTree training requires examples".into());
            }
            let vectorizer =
                vectorizer.fit(&examples.iter().map(|r| r.text.clone()).collect::<Vec<_>>())?;
            // Validate all options before recursive training.
            let mut model = Tree {
                version: 1,
                labels,
                options,
                vectorizer,
                tree: TreeNode::Leaf {
                    label: examples[0].label.clone(),
                    counts: LabelCounts(vec![(examples[0].label.clone(), 1)]),
                },
            };
            model.validate()?;
            if examples.iter().any(|r| !model.labels.contains(&r.label)) {
                return Err("unknown decision tree label".into());
            }
            let rows: Vec<_> = examples
                .iter()
                .map(|r| TreeRow {
                    label: r.label.clone(),
                    indices: model.vectorizer.transform(&r.text).indices,
                })
                .collect();
            model.tree = build_tree(
                &rows.iter().collect::<Vec<_>>(),
                &model.vectorizer.vocabulary,
                &model.options,
                0,
            );
            json(model)
        }
        Request::LoadTree { model } => {
            model.validate()?;
            json(model)
        }
        Request::PredictTree { model, text } => {
            model.validate()?;
            json(model.predict(&text))
        }
        Request::SgdVocabulary { texts } => {
            json(counts(texts.iter().flat_map(|text| tokens(text)).collect()))
        }
        Request::TrainSgd { model, examples } => json(model.train(&examples)?),
        Request::LoadSgd { model } => {
            model.validate(true)?;
            json(model)
        }
        Request::PredictSgd { model, text } => {
            model.validate(false)?;
            if model.labels.is_empty() || model.vocabulary.is_empty() {
                return json(Vec::<Prediction>::new());
            }
            json(predictions(
                &model.labels,
                model.logits(&encode_sparse(&model.vocabulary, &text)),
                false,
            ))
        }
        Request::TrainIis { model, examples } => json(model.train(&examples)?),
        Request::LoadIis { model } => {
            model.validate(true)?;
            json(model)
        }
        Request::PredictIis { model, text } => {
            model.validate(false)?;
            let doc = model.encode(&counts(tokens(&text)), &model.mapping());
            json(predictions(&model.labels, model.logits(&doc), true))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ascii_tokens_and_ngrams() {
        let v = Vectorizer {
            version: 1,
            ngram_min: 1,
            ngram_max: 2,
            binary: false,
            max_features: 64,
            vocabulary: vec![],
        };
        assert_eq!(
            v.features("É A café 'x"),
            ["a", "caf", "'x", "a\u{1}caf", "caf\u{1}'x"]
        );
        let v = v.fit(&["a a b".into()]).unwrap();
        assert_eq!(v.vocabulary, ["a", "a\u{1}a", "a\u{1}b", "b"]);
        assert_eq!(v.transform("a a unknown").values, [2.0, 1.0]);
    }
    #[test]
    fn untrained_and_malformed_transport() {
        assert!(execute(br#"{"action":"loadSgd","model":{}}"#)
            .unwrap_err()
            .contains("missing field"));
        assert!(execute(br#"{"action":"loadIis","model":{"version":2,"algorithm":"gis","labels":["A"],"features":[],"weights":[],"epochs":1}}"#).is_err());
    }
    #[test]
    fn label_order_uses_utf16() {
        assert_eq!(js_cmp("\u{10000}", "\u{e000}"), std::cmp::Ordering::Less);
    }

    fn golden() -> serde_json::Value {
        serde_json::from_slice(include_bytes!(
            "../../test/fixtures/text_classifiers_405347e.json"
        ))
        .unwrap()
    }

    fn request(value: serde_json::Value) -> serde_json::Value {
        serde_json::from_slice(&execute(&serde_json::to_vec(&value).unwrap()).unwrap()).unwrap()
    }

    fn close(actual: &serde_json::Value, expected: &serde_json::Value) {
        use serde_json::Value;
        match (actual, expected) {
            (Value::Number(a), Value::Number(b)) => {
                let (a, b) = (a.as_f64().unwrap(), b.as_f64().unwrap());
                assert!((a - b).abs() <= 2e-12 * b.abs().max(1.0), "{a} != {b}");
            }
            (Value::Array(a), Value::Array(b)) => {
                assert_eq!(a.len(), b.len());
                for (a, b) in a.iter().zip(b) {
                    close(a, b);
                }
            }
            (Value::Object(a), Value::Object(b)) => {
                assert_eq!(a.keys().collect::<Vec<_>>(), b.keys().collect::<Vec<_>>());
                for (key, a) in a {
                    close(a, &b[key]);
                }
            }
            _ => assert_eq!(actual, expected),
        }
    }

    #[test]
    fn frozen_vectorizer_and_tree_training() {
        let g = golden();
        let texts: Vec<_> = g["rows"]
            .as_array()
            .unwrap()
            .iter()
            .map(|r| r["text"].clone())
            .collect();
        for item in g["vectorizers"].as_array().unwrap() {
            let output = request(
                serde_json::json!({ "action": "fitVectorizer", "model": item["saved"], "texts": texts }),
            );
            close(&output, &item["saved"]);
            let vectors = request(
                serde_json::json!({ "action": "transformVectorizer", "model": output, "texts": g["queries"] }),
            );
            close(&vectors, &item["vectors"]);
        }
        for item in g["trees"].as_array().unwrap() {
            let saved = &item["saved"];
            let output = request(
                serde_json::json!({ "action": "trainTree", "labels": saved["labels"], "options": saved["options"],
                "vectorizer": saved["vectorizer"], "examples": g["rows"] }),
            );
            close(&output, saved);
        }
    }

    #[test]
    fn frozen_sgd_and_iis_training_and_scoring() {
        let g = golden();
        for (family, train, predict) in [
            ("sgd", "trainSgd", "predictSgd"),
            ("iis", "trainIis", "predictIis"),
        ] {
            for item in g[family].as_array().unwrap() {
                let output = request(
                    serde_json::json!({ "action": train, "model": item["saved"], "examples": g["rows"] }),
                );
                close(&output, &item["saved"]);
                for (q, text) in g["queries"].as_array().unwrap().iter().enumerate() {
                    let scores = request(
                        serde_json::json!({ "action": predict, "model": output, "text": text }),
                    );
                    close(&scores, &item["predictions"][q]);
                }
            }
        }
    }

    #[test]
    fn frozen_long_document_iis() {
        let g = golden();
        let long = &g["longIis"];
        let output = request(
            serde_json::json!({ "action": "trainIis", "model": long["saved"], "examples": long["rows"] }),
        );
        close(&output, &long["saved"]);
    }
}
