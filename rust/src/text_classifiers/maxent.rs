use super::*;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SgdOptions {
    pub(crate) epochs: u64,
    pub(crate) learning_rate: f64,
    pub(crate) l2: f64,
    pub(crate) max_features: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Sgd {
    pub(crate) version: u32,
    pub(crate) labels: Vec<String>,
    pub(crate) vocabulary: Vec<String>,
    pub(crate) weights: Vec<Vec<f64>>,
    pub(crate) bias: Vec<f64>,
    pub(crate) options: SgdOptions,
}

#[derive(Serialize)]
pub struct Prediction {
    pub(crate) label: String,
    pub(crate) probability: f64,
    pub(crate) logit: f64,
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
pub(crate) fn predictions(labels: &[String], logits: Vec<f64>, base_two: bool) -> Vec<Prediction> {
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

pub(crate) fn encode_sparse(vocabulary: &[String], text: &str) -> Vec<(usize, f64)> {
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
    pub(crate) fn validate(&self, trained: bool) -> Result<()> {
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
    pub(crate) fn logits(&self, doc: &[(usize, f64)]) -> Vec<f64> {
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
    pub(crate) fn train(mut self, examples: &[Example]) -> Result<Self> {
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
    pub(crate) version: u32,
    pub(crate) algorithm: String,
    pub(crate) labels: Vec<String>,
    pub(crate) features: Vec<(String, f64, String)>,
    pub(crate) weights: Vec<f64>,
    pub(crate) epochs: f64,
}
impl Iis {
    pub(crate) fn validate(&self, trained: bool) -> Result<()> {
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
    pub(crate) fn mapping(&self) -> HashMap<(&str, u64, &str), usize> {
        self.features
            .iter()
            .enumerate()
            .map(|(id, (word, count, label))| ((word.as_str(), *count as u64, label.as_str()), id))
            .collect()
    }
    pub(crate) fn encode(
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
    pub(crate) fn logits(&self, doc: &[Vec<usize>]) -> Vec<f64> {
        doc.iter()
            .map(|ids| ids.iter().fold(0.0, |sum, &id| sum + self.weights[id]))
            .collect()
    }
    pub(crate) fn train(mut self, rows: &[Example]) -> Result<Self> {
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
