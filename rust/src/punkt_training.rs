//! Batch/replayed incremental Punkt training. NLTK 3.10.3 default heuristics,
//! preserving the package's minimum-count options and score serialization.
use crate::punkt_unicode::{initial_char, tokenize, PunktModel};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingOptions {
    min_abbrev_count: Option<f64>,
    min_collocation_count: Option<f64>,
    min_sentence_starter_count: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainedModel {
    version: u32,
    abbreviations: Vec<String>,
    collocations: Vec<(String, String)>,
    sentence_starters: Vec<String>,
    ortho_context: BTreeMap<String, u32>,
    abbreviation_scores: BTreeMap<String, f64>,
}

fn count(freq: &HashMap<String, usize>, key: &str) -> usize {
    freq.get(key).copied().unwrap_or(0)
}
fn increment<K: std::hash::Hash + Eq>(freq: &mut HashMap<K, usize>, key: K) {
    *freq.entry(key).or_default() += 1;
}
fn likelihood(a: f64, b: f64, ab: f64, n: f64) -> f64 {
    let p = b / n;
    let p1 = ab / a;
    let p2 = if n == a { 1.0 } else { (b - ab) / (n - a) };
    let sum = |x: f64, y: f64, q: f64| {
        if q <= 0.0 || q >= 1.0 {
            0.0
        } else {
            x * q.ln() + y * (1.0 - q).ln()
        }
    };
    -2.0 * (sum(ab, a - ab, p) + sum(b - ab, n - a - b + ab, p)
        - sum(ab, a - ab, p1)
        - sum(b - ab, n - a - b + ab, p2))
}
fn non_punct(s: &str) -> bool {
    s.chars().any(initial_char)
}
fn js_sort(values: &mut [String]) {
    values.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
}

pub fn train(chunks: &[String], options: &TrainingOptions) -> TrainedModel {
    let mut freq = HashMap::new();
    let mut collocs = HashMap::new();
    let mut starts = HashMap::new();
    let mut model = PunktModel::default();
    let mut scores = BTreeMap::new();
    let (mut n, mut periods, mut breaks) = (0usize, 0usize, 0usize);
    for text in chunks {
        let mut tokens = tokenize(text, &PunktModel::default());
        let mut unique = Vec::new();
        let mut seen = HashSet::new();
        for t in &tokens {
            increment(&mut freq, t.typ.clone());
            n += 1;
            periods += usize::from(t.text.ends_with('.'));
            if seen.insert(t.typ.clone()) {
                unique.push(t.typ.clone());
            }
        }
        for mut typ in unique {
            if !non_punct(&typ) || typ == "##number##" {
                continue;
            }
            let add = typ.ends_with('.');
            if add {
                if model.abbreviations.contains(&typ) {
                    continue;
                }
                typ.pop();
            } else if !model.abbreviations.contains(&typ) {
                continue;
            }
            let dots = typ.chars().filter(|&c| c == '.').count() + 1;
            let length = (typ.chars().count() - dots + 1) as f64;
            let with_period = count(&freq, &format!("{typ}.")) as f64;
            let without = count(&freq, &typ) as f64;
            let p = periods as f64 / n as f64;
            let ll = -2.0
                * (with_period * (p + 1e-8).ln() + without * (1.0 - p + 1e-8).ln()
                    - with_period * 0.99f64.ln()
                    - without * 0.01f64.ln());
            let score = ll * (-length).exp() * dots as f64 * length.powf(-without);
            scores.insert(typ.clone(), score);
            if score >= 0.3 && with_period >= options.min_abbrev_count.unwrap_or(1.0) {
                if add {
                    model.abbreviations.insert(typ);
                }
            } else if !add {
                model.abbreviations.remove(&typ);
            }
        }
        // Tokenization above is untrained; first-pass annotation must observe
        // abbreviation reclassification for the entire chunk, not token order.
        for t in &mut tokens {
            if t.text.ends_with('.') && !t.text.ends_with("..") && t.text != "." {
                let base = t.text[..t.text.len() - 1].to_lowercase();
                t.abbr = model.abbreviations.contains(&base)
                    || model
                        .abbreviations
                        .contains(base.rsplit('-').next().unwrap());
                t.sentbreak = !t.abbr;
            }
        }
        // initial=0, internal=1, unknown=2
        let mut context = 1;
        for t in &tokens {
            if t.parastart && context != 2 {
                context = 0;
            }
            if t.linestart && context == 1 {
                context = 2;
            }
            let flag = if t.upper() {
                [2, 4, 8][context]
            } else if t.lower() {
                [16, 32, 64][context]
            } else {
                0
            };
            if flag != 0 {
                *model
                    .ortho_context
                    .entry(t.no_sent_period().into())
                    .or_default() |= flag;
            }
            if t.sentbreak {
                breaks += 1;
                context = if t.initial || t.typ == "##number##" {
                    2
                } else {
                    0
                };
            } else {
                context = if t.ellipsis || t.abbr { 2 } else { 1 };
            }
        }
        for pair in tokens.windows(2) {
            let (t, next) = (&pair[0], &pair[1]);
            if !t.text.ends_with('.') {
                continue;
            }
            let typ = t.no_sent_period();
            let ctx = model
                .ortho_context
                .get(next.no_sent_period())
                .copied()
                .unwrap_or(0);
            // NLTK's rare-abbreviation backoff really strips one further scalar.
            let shortened = typ
                .char_indices()
                .last()
                .map(|(i, _)| &typ[..i])
                .unwrap_or("");
            if !t.abbr
                && t.sentbreak
                && !model.abbreviations.contains(typ)
                && count(&freq, typ) + count(&freq, shortened) < 5
                && (next.text.starts_with([',', ':', ';'])
                    || (next.lower() && ctx & 2 != 0 && ctx & 4 == 0))
            {
                model.abbreviations.insert(t.no_period().into());
            }
            if t.sentbreak
                && !t.initial
                && t.typ != "##number##"
                && next.text.chars().all(initial_char)
            {
                increment(&mut starts, next.typ.clone());
            }
            if t.sentbreak
                && (t.initial || t.typ == "##number##")
                && non_punct(&t.typ)
                && non_punct(&next.typ)
            {
                increment(
                    &mut collocs,
                    (t.no_period().to_owned(), next.no_sent_period().to_owned()),
                );
            }
        }
    }
    let mut starters = Vec::new();
    for (typ, at_break) in starts {
        let total = count(&freq, &typ) + count(&freq, &format!("{typ}."));
        if total >= at_break
            && at_break as f64 >= options.min_sentence_starter_count.unwrap_or(1.0)
            && likelihood(breaks as f64, total as f64, at_break as f64, n as f64) >= 30.0
            && n as f64 / breaks as f64 > total as f64 / at_break as f64
        {
            starters.push(typ);
        }
    }
    let mut pairs = Vec::new();
    for ((a, b), together) in collocs {
        let ac = count(&freq, &a) + count(&freq, &format!("{a}."));
        let bc = count(&freq, &b) + count(&freq, &format!("{b}."));
        if !starters.contains(&b)
            && ac > 1
            && bc > 1
            && together as f64 >= options.min_collocation_count.unwrap_or(2.0)
            && together <= ac.min(bc)
            && likelihood(ac as f64, bc as f64, together as f64, n as f64) >= 7.88
            && n as f64 / ac as f64 > bc as f64 / together as f64
        {
            pairs.push((a, b));
        }
    }
    let mut abbreviations: Vec<_> = model.abbreviations.into_iter().collect();
    js_sort(&mut abbreviations);
    js_sort(&mut starters);
    pairs.sort_by(|a, b| {
        format!("{},{}", a.0, a.1)
            .encode_utf16()
            .cmp(format!("{},{}", b.0, b.1).encode_utf16())
    });
    TrainedModel {
        version: 2,
        abbreviations,
        collocations: pairs,
        sentence_starters: starters,
        ortho_context: model.ortho_context.into_iter().collect(),
        abbreviation_scores: scores,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn training_and_reclassification() {
        let first = "Dr. Smith left. Dr. Jones stayed. He slept. ".repeat(4);
        let m = train(&[first.clone()], &TrainingOptions::default());
        assert!(m.abbreviations.contains(&"dr".into()));
        assert_eq!(m.ortho_context.get("he"), Some(&2));
        let m = train(
            &[first, "Dr Smith stayed. ".repeat(40)],
            &TrainingOptions::default(),
        );
        assert!(!m.abbreviations.contains(&"dr".into()));
        assert!(train(&[], &TrainingOptions::default())
            .abbreviations
            .is_empty());
    }
}
