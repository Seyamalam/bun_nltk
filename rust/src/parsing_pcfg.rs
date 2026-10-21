//! Typed PCFG reading and bounded, production-shaped Viterbi parsing.
use crate::parsing::{Child, Grammar, Production, Result, Symbol, Tree};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct WeightedProduction {
    #[serde(flatten)]
    pub production: Production,
    pub prob: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Pcfg {
    pub start: String,
    pub productions: Vec<WeightedProduction>,
}

impl WeightedProduction {
    pub fn format(&self) -> String {
        let number = if self.prob == 1.0 {
            "1.0".into()
        } else if self.prob == 0.0 {
            "0".into()
        } else {
            // Python's %g uses six significant digits and a two-digit exponent.
            let scientific = format!("{:.5e}", self.prob);
            let (mantissa, exponent) = scientific.split_once('e').unwrap();
            let exponent: i32 = exponent.parse().unwrap();
            if !(-4..6).contains(&exponent) {
                format!(
                    "{}e{:+03}",
                    mantissa.trim_end_matches('0').trim_end_matches('.'),
                    exponent
                )
            } else {
                let decimals = (5 - exponent).max(0) as usize;
                let decimal = format!("{:.*}", decimals, self.prob);
                if decimal.contains('.') {
                    decimal
                        .trim_end_matches('0')
                        .trim_end_matches('.')
                        .to_string()
                } else {
                    decimal
                }
            }
        };
        format!("{} [{}]", self.production.format(), number)
    }
}

pub fn productions(
    grammar: Pcfg,
    lhs: Option<String>,
    rhs: Option<Symbol>,
    empty: bool,
) -> Result<Vec<WeightedProduction>> {
    if rhs.is_some() && empty {
        return Err("cannot select empty and non-empty productions together".into());
    }
    let mut out: Vec<WeightedProduction> = Vec::new();
    for p in grammar.productions {
        if lhs.as_ref().is_some_and(|lhs| &p.production.lhs != lhs)
            || rhs
                .as_ref()
                .is_some_and(|rhs| p.production.rhs.first() != Some(rhs))
            || (empty && !p.production.rhs.is_empty())
        {
            continue;
        }
        if empty {
            if let Some(i) = out
                .iter()
                .position(|prev| prev.production.lhs == p.production.lhs)
            {
                out[i] = p;
                continue;
            }
        }
        out.push(p);
    }
    Ok(out)
}

impl Pcfg {
    pub fn cfg(&self) -> Grammar {
        Grammar {
            start: self.start.clone(),
            productions: self
                .productions
                .iter()
                .map(|p| p.production.clone())
                .collect(),
        }
    }

    pub fn validate(&self) -> Result<()> {
        self.cfg().validate()?;
        let mut totals = HashMap::new();
        for p in &self.productions {
            if !p.prob.is_finite() || !(0.0..=1.0).contains(&p.prob) {
                return Err("production probability must be finite and in [0, 1]".into());
            }
            *totals.entry(&p.production.lhs).or_insert(0.0) += p.prob;
        }
        for (lhs, total) in totals {
            if !(0.99 < total && total < 1.01) {
                return Err(format!("Productions for {lhs} do not sum to 1"));
            }
        }
        Ok(())
    }

    pub fn fromstring(text: &str) -> Result<Self> {
        let mut stripped = String::new();
        let mut probabilities = Vec::new();
        let mut continuation = String::new();
        for raw in text.split('\n') {
            let line = continuation.clone() + raw.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if line.ends_with('\\') {
                continuation = line[..line.len() - 1].trim_end().to_string() + " ";
                continue;
            }
            continuation.clear();
            if line.starts_with('%') {
                stripped.push_str(&line);
                stripped.push('\n');
                continue;
            }
            let mut quote = None;
            let mut i = 0;
            let mut prob = 0.0;
            let arrow = line.find("->").ok_or("expected an arrow")?;
            while i < line.len() {
                let c = line[i..].chars().next().unwrap();
                if let Some(q) = quote {
                    stripped.push(c);
                    if c == q {
                        quote = None;
                    }
                    i += c.len_utf8();
                } else if c == '\'' || c == '"' {
                    quote = Some(c);
                    stripped.push(c);
                    i += 1;
                } else if c == '[' {
                    if i < arrow + 2 {
                        return Err("probability before RHS".into());
                    }
                    let end = line[i + 1..].find(']').ok_or("unterminated probability")? + i + 1;
                    let number = &line[i + 1..end];
                    if number.is_empty() || !number.bytes().all(|b| b.is_ascii_digit() || b == b'.')
                    {
                        return Err("invalid probability literal".into());
                    }
                    prob = number
                        .parse::<f64>()
                        .map_err(|_| "invalid probability literal")?;
                    if prob > 1.0 {
                        return Err("production probability exceeds 1".into());
                    }
                    stripped.push(' ');
                    i = end + 1;
                } else {
                    if c == '|' {
                        probabilities.push(prob);
                        prob = 0.0;
                    }
                    stripped.push(c);
                    i += c.len_utf8();
                }
            }
            probabilities.push(prob);
            stripped.push('\n');
        }
        let grammar = Grammar::fromstring(&stripped)?;
        if grammar.productions.len() != probabilities.len() {
            return Err("probability/production count mismatch".into());
        }
        let pcfg = Self {
            start: grammar.start,
            productions: grammar
                .productions
                .into_iter()
                .zip(probabilities)
                .map(|(production, prob)| WeightedProduction { production, prob })
                .collect(),
        };
        pcfg.validate()?;
        Ok(pcfg)
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct BestParse {
    pub tree: Tree,
    pub prob: f64,
    /// None represents -infinity for a zero/underflowed probability in JSON.
    pub log_prob: Option<f64>,
}

#[derive(Clone)]
struct Constituent {
    tree: Tree,
    prob: f64,
    depth: usize,
    nodes: usize,
}
type Chart = HashMap<(usize, usize, String), Constituent>;

struct Work {
    used: usize,
    limit: usize,
}
impl Work {
    fn tick(&mut self) -> Result<()> {
        self.charge(1)
    }
    fn charge(&mut self, amount: usize) -> Result<()> {
        self.used = self.used.saturating_add(amount);
        if self.used > self.limit {
            Err("Viterbi work resource limit exceeded".into())
        } else {
            Ok(())
        }
    }
}

struct Match {
    children: Vec<Child>,
    probabilities: Vec<f64>,
    depth: usize,
    nodes: usize,
}

/// Enumerate in NLTK's ascending split order, using the previous closure pass.
fn matches(
    rhs: &[Symbol],
    start: usize,
    end: usize,
    tokens: &[String],
    chart: &Chart,
    work: &mut Work,
) -> Result<Vec<Match>> {
    work.tick()?;
    if start >= end || rhs.is_empty() {
        return Ok(if start == end && rhs.is_empty() {
            vec![Match {
                children: Vec::new(),
                probabilities: Vec::new(),
                depth: 0,
                nodes: 0,
            }]
        } else {
            Vec::new()
        });
    }
    let mut out = Vec::new();
    for split in start + 1..=end {
        work.tick()?;
        let (child, prob, depth, nodes) = match &rhs[0] {
            Symbol::Terminal(s) if split == start + 1 && &tokens[start] == s => {
                (Child::Leaf(s.clone()), 1.0, 0, 1)
            }
            Symbol::Nonterminal(s) => match chart.get(&(start, split, s.clone())) {
                Some(c) => {
                    work.charge(c.nodes)?;
                    (Child::Tree(c.tree.clone()), c.prob, c.depth, c.nodes)
                }
                None => continue,
            },
            _ => continue,
        };
        for tail in matches(&rhs[1..], split, end, tokens, chart, work)? {
            work.charge(nodes)?;
            let mut children = vec![child.clone()];
            children.extend(tail.children);
            let mut probabilities = vec![prob];
            probabilities.extend(tail.probabilities);
            out.push(Match {
                children,
                probabilities,
                depth: depth.max(tail.depth),
                nodes: nodes + tail.nodes,
            });
        }
    }
    Ok(out)
}

pub fn viterbi(grammar: &Pcfg, tokens: &[String], max_work: usize) -> Result<Option<BestParse>> {
    grammar.validate()?;
    grammar.cfg().coverage(tokens)?;
    if tokens.len() > 512 || max_work == 0 || max_work > 2_000_000 {
        return Err("invalid Viterbi resource limits".into());
    }
    if grammar
        .productions
        .iter()
        .any(|p| p.production.rhs.len() > 256)
    {
        return Err("Viterbi RHS depth exceeds 256".into());
    }
    let mut work = Work {
        used: 0,
        limit: max_work,
    };
    let mut chart = Chart::new();
    for length in 1..=tokens.len() {
        for start in 0..=tokens.len() - length {
            let end = start + length;
            loop {
                let mut candidates = Vec::new();
                for p in &grammar.productions {
                    work.tick()?;
                    for m in matches(&p.production.rhs, start, end, tokens, &chart, &mut work)? {
                        // NLTK multiplies the rule then immediate child probabilities left-to-right.
                        let mut prob = p.prob;
                        for child_prob in &m.probabilities {
                            prob *= child_prob;
                        }
                        candidates.push((p.production.lhs.clone(), m, prob));
                    }
                }
                let mut changed = false;
                for (lhs, m, prob) in candidates {
                    work.tick()?;
                    let key = (start, end, lhs.clone());
                    if chart.get(&key).is_none_or(|prev| prob > prev.prob) {
                        if m.depth >= 256 {
                            return Err("Viterbi tree depth exceeds 256".into());
                        }
                        chart.insert(
                            key,
                            Constituent {
                                tree: Tree {
                                    label: lhs,
                                    children: m.children,
                                },
                                prob,
                                depth: m.depth + 1,
                                nodes: m.nodes + 1,
                            },
                        );
                        changed = true;
                    }
                }
                if !changed {
                    break;
                }
            }
        }
    }
    Ok(chart
        .remove(&(0, tokens.len(), grammar.start.clone()))
        .map(|c| BestParse {
            tree: c.tree,
            prob: c.prob,
            log_prob: (c.prob > 0.0).then(|| c.prob.ln()),
        }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pcfg_and_ambiguity() {
        let g = Pcfg::fromstring("S -> S S [.4] | 'a' [.6]").unwrap();
        let p = viterbi(&g, &["a".into(), "a".into(), "a".into()], 100000)
            .unwrap()
            .unwrap();
        assert!((p.prob - 0.03456).abs() < 1e-12);
        assert_eq!(p.tree.children.len(), 2);
        assert!(Pcfg::fromstring("S -> 'a' [.99]").is_err());
        assert!(Pcfg::fromstring("S -> 'a' [1.01]").is_err());
        assert!(viterbi(&g, &["a".into()], 1).is_err());
        assert!(viterbi(&g, &["x".into()], 100000).is_err());
        assert!(viterbi(&g, &[], 100000).unwrap().is_none());
    }
}
