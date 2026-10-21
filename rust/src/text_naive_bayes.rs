//! Legacy text Naive Bayes contracts. Feature-dictionary models are separate:
//! no dictionary is converted to text by this module.
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

type Result<T> = std::result::Result<T, String>;

#[derive(Clone, Deserialize)]
pub struct Example {
    label: String,
    text: String,
}

fn tokens(text: &str) -> Vec<String> {
    text.as_bytes()
        .split(|&byte| !crate::ascii::is_token_char(byte))
        .filter(|token| !token.is_empty())
        .map(|token| token.iter().map(|byte| byte.to_ascii_lowercase() as char).collect())
        .collect()
}

fn counts(text: &str) -> Vec<(String, f64)> {
    let mut ids = HashMap::new();
    let mut out: Vec<(String, f64)> = Vec::new();
    for token in tokens(text) {
        let next = out.len();
        let id = *ids.entry(token.clone()).or_insert(next);
        if id == next { out.push((token, 0.0)); }
        out[id].1 += 1.0;
    }
    out
}

fn log2(value: f64) -> f64 {
    value.ln() / std::f64::consts::LN_2
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Categorical {
    version: u32,
    model: String,
    smoothing: f64,
    total_docs: f64,
    labels: Vec<String>,
    label_doc_counts: Vec<f64>,
    features: Vec<(String, Vec<Vec<(f64, f64)>>)>,
}

fn valid_count(value: f64, positive: bool) -> bool {
    value.is_finite() && value.fract() == 0.0 && value <= 9007199254740991.0
        && if positive { value > 0.0 } else { value >= 0.0 }
}

impl Categorical {
    fn validate(&self) -> Result<()> {
        if self.version != 2 || self.model != "categorical" || !self.smoothing.is_finite()
            || self.smoothing <= 0.0 || self.labels.len() != self.label_doc_counts.len()
            || self.labels.iter().collect::<HashSet<_>>().len() != self.labels.len()
            || self.label_doc_counts.iter().any(|&n| !valid_count(n, false))
            || self.label_doc_counts.iter().sum::<f64>() != self.total_docs {
            return Err("invalid categorical NaiveBayes document counts or smoothing".into());
        }
        let mut names = HashSet::new();
        for (word, rows) in &self.features {
            if !names.insert(word) || rows.len() != self.labels.len() {
                return Err("invalid categorical feature rows".into());
            }
            for (row, docs) in rows.iter().zip(&self.label_doc_counts) {
                let mut seen = HashSet::new();
                if row.iter().any(|&(value, n)| !valid_count(value, true) || !valid_count(n, true)
                    || !seen.insert(value as u64)) || row.iter().map(|(_, n)| n).sum::<f64>() > *docs {
                    return Err("invalid categorical feature counts".into());
                }
            }
        }
        Ok(())
    }

    fn train(mut self, examples: Vec<Example>) -> Result<Self> {
        self.validate()?;
        let mut label_ids: HashMap<String, usize> = self.labels.iter().cloned().enumerate().map(|(i, s)| (s, i)).collect();
        let mut feature_ids: HashMap<String, usize> = self.features.iter().enumerate().map(|(i, (s, _))| (s.clone(), i)).collect();
        for Example { label, text } in examples {
            let next = self.labels.len();
            let label_id = *label_ids.entry(label.clone()).or_insert(next);
            if label_id == next {
                self.labels.push(label);
                self.label_doc_counts.push(0.0);
                for (_, rows) in &mut self.features { rows.push(Vec::new()); }
            }
            self.total_docs += 1.0;
            self.label_doc_counts[label_id] += 1.0;
            for (word, value) in counts(&text) {
                let next = self.features.len();
                let id = *feature_ids.entry(word.clone()).or_insert(next);
                if id == next { self.features.push((word, vec![Vec::new(); self.labels.len()])); }
                let row = &mut self.features[id].1[label_id];
                if let Some((_, n)) = row.iter_mut().find(|(v, _)| *v == value) { *n += 1.0; }
                else { row.push((value, 1.0)); }
            }
        }
        Ok(self)
    }

    fn predict(&self, text: &str) -> Result<Vec<Prediction>> {
        self.validate()?;
        if self.labels.is_empty() { return Ok(Vec::new()); }
        let features: HashMap<&str, &Vec<Vec<(f64, f64)>>> = self.features.iter().map(|(s, rows)| (s.as_str(), rows)).collect();
        let gamma = self.smoothing;
        let mut scores: Vec<f64> = self.label_doc_counts.iter().map(|docs|
            log2((docs + gamma) / (self.total_docs + gamma * self.labels.len() as f64))).collect();
        for (word, value) in counts(text) {
            let Some(rows) = features.get(word.as_str()) else { continue; };
            let values: HashSet<u64> = rows.iter().flatten().map(|(v, _)| *v as u64).collect();
            let seen: f64 = rows.iter().flatten().map(|(_, n)| n).sum();
            let bins = values.len() + usize::from(seen < self.total_docs);
            for ((score, docs), row) in scores.iter_mut().zip(&self.label_doc_counts).zip(*rows) {
                let count = row.iter().find(|(v, _)| *v == value).map_or(0.0, |(_, n)| *n);
                *score += log2((count + gamma) / (docs + gamma * bins as f64));
            }
        }
        let max = scores.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let normalizer = max + scores.iter().map(|s| (s - max).exp2()).sum::<f64>().log2();
        let mut out: Vec<_> = self.labels.iter().zip(scores).map(|(label, score)|
            Prediction { label: label.clone(), log_prob: score - normalizer }).collect();
        out.sort_by(|a, b| b.log_prob.total_cmp(&a.log_prob).then_with(|| b.label.encode_utf16().cmp(a.label.encode_utf16())));
        Ok(out)
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(untagged)]
enum TokenCount { Token(String), Count(f64) }

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Multinomial {
    version: u32,
    smoothing: f64,
    total_docs: f64,
    labels: Vec<String>,
    label_doc_counts: Vec<f64>,
    label_token_totals: Vec<f64>,
    vocabulary: Vec<String>,
    token_counts_by_label: Vec<Vec<TokenCount>>,
}

impl Multinomial {
    fn validate(&self) -> Result<()> {
        if self.version != 1 || !self.smoothing.is_finite() || self.smoothing <= 0.0
            || self.labels.len() != self.label_doc_counts.len()
            || self.labels.len() != self.label_token_totals.len()
            || self.labels.len() != self.token_counts_by_label.len()
            || self.labels.iter().collect::<HashSet<_>>().len() != self.labels.len()
            || !valid_count(self.total_docs, false)
            || self.label_doc_counts.iter().chain(&self.label_token_totals).any(|&n| !valid_count(n, false)) {
            return Err("invalid NaiveBayes serialized payload lengths or counts".into());
        }
        self.rows()?;
        Ok(())
    }

    fn rows(&self) -> Result<Vec<HashMap<String, f64>>> {
        self.token_counts_by_label.iter().map(|row| {
            let mut out = HashMap::new();
            if !row.len().is_multiple_of(2) { return Err("invalid token counts".into()); }
            for pair in row.chunks_exact(2) {
                match (&pair[0], &pair[1]) {
                    (TokenCount::Token(token), TokenCount::Count(n)) if valid_count(*n, false) => { out.insert(token.clone(), *n); }
                    _ => return Err("invalid token counts".into()),
                }
            }
            Ok(out)
        }).collect()
    }

    fn train(mut self, examples: Vec<Example>) -> Result<Self> {
        self.validate()?;
        let mut rows = self.rows()?;
        let mut vocabulary: HashSet<String> = self.vocabulary.into_iter().collect();
        let mut labels: HashMap<String, usize> = self.labels.iter().cloned().enumerate().map(|(i, s)| (s, i)).collect();
        for Example { label, text } in examples {
            let next = self.labels.len();
            let id = *labels.entry(label.clone()).or_insert(next);
            if id == next {
                self.labels.push(label);
                self.label_doc_counts.push(0.0);
                self.label_token_totals.push(0.0);
                rows.push(HashMap::new());
            }
            self.total_docs += 1.0;
            self.label_doc_counts[id] += 1.0;
            for token in tokens(&text) {
                vocabulary.insert(token.clone());
                *rows[id].entry(token).or_default() += 1.0;
                self.label_token_totals[id] += 1.0;
            }
        }
        self.vocabulary = vocabulary.into_iter().collect();
        self.vocabulary.sort();
        self.token_counts_by_label = rows.into_iter().map(|row| {
            let mut row: Vec<_> = row.into_iter().collect();
            row.sort_by(|a, b| a.0.cmp(&b.0));
            row.into_iter().flat_map(|(s, n)| [TokenCount::Token(s), TokenCount::Count(n)]).collect()
        }).collect();
        Ok(self)
    }

    fn predict(&self, text: &str) -> Result<Vec<Prediction>> {
        self.validate()?;
        let rows = self.rows()?;
        let vocabulary: HashSet<&str> = self.vocabulary.iter().map(String::as_str).collect();
        // Legacy Bun FFI rejected a zero-length token ID buffer and invoked the
        // TS fallback. Preserve its observable all-OOV behavior without a catch.
        let all_tokens = tokens(text);
        let known: Vec<_> = all_tokens.iter().filter(|s| vocabulary.contains(s.as_str())).cloned().collect();
        let tokens = if known.is_empty() { all_tokens } else { known };
        let mut out = Vec::new();
        for (id, label) in self.labels.iter().enumerate() {
            let mut score = ((self.label_doc_counts[id] + self.smoothing)
                / (self.total_docs.max(1.0) + self.smoothing * self.labels.len() as f64)).ln();
            let denom = self.label_token_totals[id] + self.smoothing * self.vocabulary.len().max(1) as f64;
            for token in &tokens { score += ((rows[id].get(token).copied().unwrap_or(0.0) + self.smoothing) / denom).ln(); }
            out.push(Prediction { label: label.clone(), log_prob: score });
        }
        out.sort_by(|a, b| b.log_prob.total_cmp(&a.log_prob));
        Ok(out)
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositiveOptions { max_features: f64 }

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Positive {
    version: u32,
    positive_label: String,
    negative_label: String,
    positive_prior: f64,
    vocabulary: Vec<String>,
    present_log_pos: Vec<f64>,
    absent_log_pos: Vec<f64>,
    present_log_neg: Vec<f64>,
    absent_log_neg: Vec<f64>,
    absent_log_pos_sum: f64,
    absent_log_neg_sum: f64,
    options: PositiveOptions,
}

impl Positive {
    fn validate(&self) -> Result<()> {
        let size = self.vocabulary.len();
        if self.version != 1 || !self.positive_prior.is_finite() || self.positive_prior <= 0.0 || self.positive_prior >= 1.0
            || !valid_count(self.options.max_features, true)
            || [&self.present_log_pos, &self.absent_log_pos, &self.present_log_neg, &self.absent_log_neg].iter()
                .any(|row| row.len() != size || row.iter().any(|n| !n.is_finite()))
            || !self.absent_log_pos_sum.is_finite() || !self.absent_log_neg_sum.is_finite() {
            return Err("invalid PositiveNaiveBayes payload".into());
        }
        Ok(())
    }

    fn train(mut self, positive: Vec<String>, unlabeled: Vec<String>, prior: Option<f64>) -> Result<Self> {
        self.validate()?;
        if positive.is_empty() { return Err("PositiveNaiveBayes requires positive examples".into()); }
        if unlabeled.is_empty() { return Err("PositiveNaiveBayes requires unlabeled examples".into()); }
        if let Some(prior) = prior { self.positive_prior = prior.clamp(0.001, 0.999); }
        let sets = |texts: &[String]| texts.iter().map(|text| tokens(text).into_iter().collect::<HashSet<_>>()).collect::<Vec<_>>();
        let pos = sets(&positive);
        let unl = sets(&unlabeled);
        let mut frequencies: HashMap<String, (usize, usize)> = HashMap::new();
        for row in &pos { for token in row { frequencies.entry(token.clone()).or_default().0 += 1; } }
        for row in &unl { for token in row { frequencies.entry(token.clone()).or_default().1 += 1; } }
        let mut ranked: Vec<_> = frequencies.into_iter().collect();
        ranked.sort_by(|a, b| (b.1.0 + b.1.1).cmp(&(a.1.0 + a.1.1)).then_with(|| a.0.cmp(&b.0)));
        ranked.truncate(self.options.max_features as usize);
        self.vocabulary.clear();
        self.present_log_pos.clear(); self.absent_log_pos.clear();
        self.present_log_neg.clear(); self.absent_log_neg.clear();
        self.absent_log_pos_sum = 0.0; self.absent_log_neg_sum = 0.0;
        for (token, (pos_count, unl_count)) in ranked {
            self.vocabulary.push(token);
            let p_pos = (pos_count as f64 + 1.0) / (positive.len() as f64 + 2.0);
            let p_global = (unl_count as f64 + 1.0) / (unlabeled.len() as f64 + 2.0);
            let p_neg = ((p_global - self.positive_prior * p_pos) / (1.0 - self.positive_prior).max(1e-9)).clamp(1e-6, 1.0 - 1e-6);
            self.present_log_pos.push(p_pos.max(1e-12).ln());
            self.absent_log_pos.push((1.0 - p_pos).max(1e-12).ln());
            self.present_log_neg.push(p_neg.max(1e-12).ln());
            self.absent_log_neg.push((1.0 - p_neg).max(1e-12).ln());
            self.absent_log_pos_sum += self.absent_log_pos.last().unwrap();
            self.absent_log_neg_sum += self.absent_log_neg.last().unwrap();
        }
        Ok(self)
    }

    fn predict(&self, text: &str) -> Result<Vec<PositivePrediction>> {
        self.validate()?;
        if self.vocabulary.is_empty() { return Err("PositiveNaiveBayes classifier is not trained".into()); }
        let present: HashSet<_> = tokens(text).into_iter().collect();
        let mut pos = self.positive_prior.ln() + self.absent_log_pos_sum;
        let mut neg = (1.0 - self.positive_prior).ln() + self.absent_log_neg_sum;
        for (id, token) in self.vocabulary.iter().enumerate() {
            if present.contains(token) {
                pos += self.present_log_pos[id] - self.absent_log_pos[id];
                neg += self.present_log_neg[id] - self.absent_log_neg[id];
            }
        }
        let difference = pos - neg;
        let probability = if difference >= 0.0 { 1.0 / (1.0 + (-difference).exp()) }
            else { let z = difference.exp(); z / (1.0 + z) };
        let mut out = vec![
            PositivePrediction { label: self.positive_label.clone(), probability, log_prob: pos },
            PositivePrediction { label: self.negative_label.clone(), probability: 1.0 - probability, log_prob: neg },
        ];
        out.sort_by(|a, b| b.probability.total_cmp(&a.probability));
        Ok(out)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Prediction { label: String, log_prob: f64 }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PositivePrediction { label: String, probability: f64, log_prob: f64 }

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
enum Request {
    TrainCategorical { model: Categorical, examples: Vec<Example> },
    LoadCategorical { model: Categorical },
    PredictCategorical { model: Categorical, text: String },
    TrainMultinomial { model: Multinomial, examples: Vec<Example> },
    LoadMultinomial { model: Multinomial },
    PredictMultinomial { model: Multinomial, text: String },
    TrainPositive { model: Positive, positive: Vec<String>, unlabeled: Vec<String>, prior: Option<f64> },
    LoadPositive { model: Positive },
    PredictPositive { model: Positive, text: String },
}

fn encode(value: impl Serialize) -> Result<Vec<u8>> {
    serde_json::to_vec(&value).map_err(|e| e.to_string())
}

pub fn execute(input: &[u8]) -> Result<Vec<u8>> {
    let request: Request = serde_json::from_slice(input).map_err(|e| e.to_string())?;
    match request {
        Request::TrainCategorical { model, examples } => encode(model.train(examples)?),
        Request::LoadCategorical { model } => { model.validate()?; encode(model) },
        Request::PredictCategorical { model, text } => encode(model.predict(&text)?),
        Request::TrainMultinomial { model, examples } => encode(model.train(examples)?),
        Request::LoadMultinomial { model } => { model.validate()?; encode(model) },
        Request::PredictMultinomial { model, text } => encode(model.predict(&text)?),
        Request::TrainPositive { model, positive, unlabeled, prior } => encode(model.train(positive, unlabeled, prior)?),
        Request::LoadPositive { model } => { model.validate()?; encode(model) },
        Request::PredictPositive { model, text } => encode(model.predict(&text)?),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn token_count_order_and_ascii_contract() {
        assert_eq!(tokens("ÉA A' ' B_2"), ["a", "a'", "'", "b", "2"]);
        assert_eq!(counts("B a B"), [("b".into(), 2.0), ("a".into(), 1.0)]);
    }
    #[test]
    fn malformed_requests_are_rejected() {
        for input in [b"{}".as_slice(), b"[]", b"not JSON", b"{\"action\":\"nope\"}"] {
            assert!(execute(input).is_err());
        }
    }

    #[test]
    fn categorical_incremental_training_retains_counts_and_missing_values() {
        let model = Categorical {
            version: 2, model: "categorical".into(), smoothing: 0.5, total_docs: 0.0,
            labels: Vec::new(), label_doc_counts: Vec::new(), features: Vec::new(),
        }.train(vec![
            Example { label: "A".into(), text: "good good good".into() },
            Example { label: "B".into(), text: "bad".into() },
        ]).unwrap();
        assert_eq!(model.predict("good").unwrap()[0].label, "B");
        let predictions = model.predict("good good good").unwrap();
        assert_eq!(predictions[0].label, "A");
        assert!((predictions[0].log_prob.exp2() - 0.75).abs() < 1e-14);
        let model = model.train(vec![Example { label: "C".into(), text: "".into() }]).unwrap();
        assert_eq!(model.labels, ["A", "B", "C"]);
        assert_eq!(model.features[0].1.len(), 3);
        let bytes = encode(model.clone()).unwrap();
        let restored: Categorical = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(encode(restored.predict("good").unwrap()).unwrap(), encode(model.predict("good").unwrap()).unwrap());
    }

    #[test]
    fn multinomial_preserves_all_oov_fallback_but_ignores_mixed_oov() {
        let model = Multinomial {
            version: 1, smoothing: 1.0, total_docs: 0.0, labels: Vec::new(),
            label_doc_counts: Vec::new(), label_token_totals: Vec::new(),
            vocabulary: Vec::new(), token_counts_by_label: Vec::new(),
        }.train(vec![
            Example { label: "A".into(), text: "a a".into() },
            Example { label: "B".into(), text: "b".into() },
        ]).unwrap();
        assert_eq!(encode(model.predict("a unknown").unwrap()).unwrap(), encode(model.predict("a").unwrap()).unwrap());
        assert_ne!(encode(model.predict("unknown").unwrap()).unwrap(), encode(model.predict("").unwrap()).unwrap());
        assert_eq!(model.total_docs, 2.0);
        assert_eq!(model.label_token_totals, [2.0, 1.0]);
    }

    #[test]
    fn positive_model_uses_presence_not_frequency_and_replaces_training() {
        let empty = Positive {
            version: 1, positive_label: "pos".into(), negative_label: "neg".into(),
            positive_prior: 0.4, vocabulary: Vec::new(), present_log_pos: Vec::new(),
            absent_log_pos: Vec::new(), present_log_neg: Vec::new(), absent_log_neg: Vec::new(),
            absent_log_pos_sum: 0.0, absent_log_neg_sum: 0.0,
            options: PositiveOptions { max_features: 128.0 },
        };
        let model = empty.clone().train(vec!["a a".into()], vec!["a b".into(), "b".into()], None).unwrap();
        assert_eq!(encode(model.predict("a").unwrap()).unwrap(), encode(model.predict("a a").unwrap()).unwrap());
        let retrained = model.train(vec!["b".into()], vec!["a".into()], Some(0.7)).unwrap();
        let fresh = empty.train(vec!["b".into()], vec!["a".into()], Some(0.7)).unwrap();
        assert_eq!(encode(retrained).unwrap(), encode(fresh).unwrap());
    }
}
