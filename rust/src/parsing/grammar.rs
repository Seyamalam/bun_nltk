//! Typed CFG productions, text syntax, coverage and left corners.
use super::{python_repr, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum Symbol {
    Nonterminal(String),
    Terminal(String),
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Production {
    pub lhs: String,
    pub rhs: Vec<Symbol>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Grammar {
    pub start: String,
    pub productions: Vec<Production>,
}

impl Production {
    pub fn is_lexical(&self) -> bool {
        self.rhs.iter().any(|s| matches!(s, Symbol::Terminal(_)))
    }
    pub fn format(&self) -> String {
        format!(
            "{} -> {}",
            self.lhs,
            self.rhs
                .iter()
                .map(|s| match s {
                    Symbol::Terminal(s) => python_repr(s),
                    Symbol::Nonterminal(s) => s.clone(),
                })
                .collect::<Vec<_>>()
                .join(" ")
        )
    }
}

struct Cursor<'a> {
    s: &'a str,
    i: usize,
}
impl<'a> Cursor<'a> {
    fn skip(&mut self) {
        while let Some(c) = self.s[self.i..].chars().next() {
            if !c.is_whitespace() {
                break;
            }
            self.i += c.len_utf8();
        }
    }
    fn nonterminal(&mut self) -> Result<String> {
        let start = self.i;
        for c in self.s[start..].chars() {
            let word = c.is_alphanumeric() || c == '_' || c == '/';
            if !(word || (self.i > start && "^<>-".contains(c))) {
                break;
            }
            self.i += c.len_utf8();
        }
        if self.i == start {
            return Err(format!("expected nonterminal at byte {}", self.i));
        }
        let out = self.s[start..self.i].to_string();
        self.skip();
        Ok(out)
    }
    fn terminal(&mut self) -> Result<String> {
        let quote = self.s.as_bytes()[self.i];
        self.i += 1;
        let start = self.i;
        while self.i < self.s.len() && self.s.as_bytes()[self.i] != quote {
            self.i += 1;
        }
        if self.i == self.s.len() {
            return Err("unterminated terminal string".into());
        }
        let s = self.s[start..self.i].to_string();
        self.i += 1;
        self.skip();
        Ok(s)
    }
}

impl Grammar {
    pub fn fromstring(text: &str) -> Result<Self> {
        let mut productions = Vec::new();
        let mut start = None;
        let mut continuation = String::new();
        for (line_number, raw) in text.split('\n').enumerate() {
            let line = continuation.clone() + raw.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if line.ends_with('\\') {
                continuation = line[..line.len() - 1].trim_end().to_string() + " ";
                continue;
            }
            continuation.clear();
            let parse_line = || -> Result<(Option<String>, Vec<Production>)> {
                let mut c = Cursor { s: &line, i: 0 };
                if line.starts_with('%') {
                    if !line.starts_with("%start") || !line[6..].starts_with(char::is_whitespace) {
                        return Err("bad directive".into());
                    }
                    c.i = 6;
                    c.skip();
                    let symbol = c.nonterminal()?;
                    if c.i != line.len() {
                        return Err("bad start directive argument".into());
                    }
                    return Ok((Some(symbol), Vec::new()));
                }
                let lhs = c.nonterminal()?;
                if !line[c.i..].starts_with("->") {
                    return Err("expected an arrow".into());
                }
                c.i += 2;
                c.skip();
                let mut alternatives = vec![Vec::new()];
                while c.i < line.len() {
                    let byte = line.as_bytes()[c.i];
                    if byte == b'|' {
                        c.i += 1;
                        c.skip();
                        alternatives.push(Vec::new());
                    } else {
                        let symbol = if byte == b'\'' || byte == b'"' {
                            Symbol::Terminal(c.terminal()?)
                        } else {
                            Symbol::Nonterminal(c.nonterminal()?)
                        };
                        alternatives.last_mut().unwrap().push(symbol);
                    }
                }
                Ok((
                    None,
                    alternatives
                        .into_iter()
                        .map(|rhs| Production {
                            lhs: lhs.clone(),
                            rhs,
                        })
                        .collect(),
                ))
            };
            let (directive, rows) = parse_line()
                .map_err(|e| format!("Unable to parse line {}: {line}\n{e}", line_number + 1))?;
            if directive.is_some() {
                start = directive;
            }
            productions.extend(rows);
        }
        if productions.is_empty() {
            return Err("No productions found!".into());
        }
        Ok(Self {
            start: start.unwrap_or_else(|| productions[0].lhs.clone()),
            productions,
        })
    }

    pub fn validate(&self) -> Result<()> {
        if self.productions.is_empty() {
            return Err("grammar must contain productions".into());
        }
        Ok(())
    }

    pub fn coverage(&self, tokens: &[String]) -> Result<()> {
        let lexical: HashSet<_> = self
            .productions
            .iter()
            .flat_map(|p| p.rhs.iter())
            .filter_map(|s| {
                if let Symbol::Terminal(s) = s {
                    Some(s.as_str())
                } else {
                    None
                }
            })
            .collect();
        let missing: Vec<_> = tokens
            .iter()
            .filter(|t| !lexical.contains(t.as_str()))
            .map(|t| python_repr(t))
            .collect();
        if missing.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "Grammar does not cover some input words: {}",
                missing.join(", ")
            ))
        }
    }

    pub fn leftcorners(&self, category: &str) -> Vec<String> {
        let mut out = vec![category.to_string()];
        let mut i = 0;
        while i < out.len() {
            for p in &self.productions {
                if p.lhs == out[i] {
                    if let Some(Symbol::Nonterminal(s)) = p.rhs.first() {
                        if !out.contains(s) {
                            out.push(s.clone());
                        }
                    }
                }
            }
            i += 1;
        }
        out
    }
}
