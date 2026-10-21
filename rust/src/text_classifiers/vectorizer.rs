use super::*;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vectorizer {
    pub(crate) version: u32,
    pub(crate) ngram_min: u64,
    pub(crate) ngram_max: u64,
    pub(crate) binary: bool,
    pub(crate) max_features: u64,
    pub(crate) vocabulary: Vec<String>,
}

#[derive(Serialize)]
pub struct Sparse {
    pub(crate) indices: Vec<usize>,
    pub(crate) values: Vec<f64>,
}

impl Vectorizer {
    pub(crate) fn validate(&self) -> Result<()> {
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

    pub(crate) fn features(&self, text: &str) -> Vec<String> {
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

    pub(crate) fn fit(mut self, texts: &[String]) -> Result<Self> {
        self.validate()?;
        let mut ranked = counts(texts.iter().flat_map(|text| self.features(text)).collect());
        ranked.sort_by(|a, b| b.1.total_cmp(&a.1).then_with(|| js_cmp(&a.0, &b.0)));
        let limit = self.max_features.min(ranked.len() as u64) as usize;
        self.vocabulary = ranked.into_iter().take(limit).map(|(w, _)| w).collect();
        Ok(self)
    }

    pub(crate) fn transform(&self, text: &str) -> Sparse {
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
