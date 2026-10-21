//! String-valued trees and Python-compatible tree formatting.
use super::{Production, Result, Symbol, MAX_DEPTH};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Child {
    Leaf(String),
    Tree(Tree),
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Tree {
    pub label: String,
    pub children: Vec<Child>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(default)]
pub struct Format {
    pub margin: i64,
    pub indent: usize,
    pub nodesep: String,
    pub parens: [String; 2],
    pub quotes: [String; 2],
    pub repr_leaves: bool,
}

impl Default for Format {
    fn default() -> Self {
        Self {
            margin: 70,
            indent: 0,
            nodesep: String::new(),
            parens: ["(".into(), ")".into()],
            quotes: [String::new(), String::new()],
            repr_leaves: false,
        }
    }
}

pub fn python_repr(text: &str) -> String {
    let quote = if text.contains('\'') && !text.contains('"') {
        '"'
    } else {
        '\''
    };
    let mut out = String::from(quote);
    for c in text.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c == quote => {
                out.push('\\');
                out.push(c);
            }
            c if c.is_control() => {
                let n = c as u32;
                if n <= 255 {
                    out.push_str(&format!("\\x{n:02x}"));
                } else {
                    out.push_str(&format!("\\u{n:04x}"));
                }
            }
            c => out.push(c),
        }
    }
    out.push(quote);
    out
}

fn brackets(value: &str) -> Result<(char, char)> {
    let chars: Vec<_> = value.chars().collect();
    if chars.len() != 2 || chars.iter().any(|c| c.is_whitespace()) || chars[0] == chars[1] {
        return Err("brackets must be two distinct non-whitespace characters".into());
    }
    Ok((chars[0], chars[1]))
}

impl Tree {
    pub fn fromstring(text: &str, bracket_chars: &str, remove_top: bool) -> Result<Child> {
        let (open, close) = brackets(bracket_chars)?;
        let chars: Vec<_> = text.chars().collect();
        let mut stack: Vec<Tree> = Vec::new();
        let mut root = None;
        let mut i = 0;
        fn token(chars: &[char], i: &mut usize, open: char, close: char) -> String {
            let mut s = String::new();
            while *i < chars.len() {
                let c = chars[*i];
                if c == '\\'
                    && *i + 1 < chars.len()
                    && (chars[*i + 1] == open || chars[*i + 1] == close)
                {
                    s.push(c);
                    s.push(chars[*i + 1]);
                    *i += 2;
                } else if c.is_whitespace() || c == open || c == close {
                    break;
                } else {
                    s.push(c);
                    *i += 1;
                }
            }
            s
        }
        while i < chars.len() {
            let c = chars[i];
            if c.is_whitespace() {
                i += 1;
                continue;
            }
            if c == open {
                if root.is_some() {
                    return Err(format!("expected end-of-string at index {i}"));
                }
                i += 1;
                while i < chars.len() && chars[i].is_whitespace() {
                    i += 1;
                }
                let label = token(&chars, &mut i, open, close);
                stack.push(Tree {
                    label,
                    children: Vec::new(),
                });
                if stack.len() >= MAX_DEPTH {
                    return Err("tree nesting depth exceeded".into());
                }
            } else if c == close {
                let tree = stack
                    .pop()
                    .ok_or_else(|| format!("unexpected closing bracket at index {i}"))?;
                if let Some(parent) = stack.last_mut() {
                    parent.children.push(Child::Tree(tree));
                } else {
                    root = Some(Child::Tree(tree));
                }
                i += 1;
            } else {
                let leaf = token(&chars, &mut i, open, close);
                stack
                    .last_mut()
                    .ok_or("expected opening bracket")?
                    .children
                    .push(Child::Leaf(leaf));
            }
        }
        if !stack.is_empty() {
            return Err("expected closing bracket at end-of-string".into());
        }
        let mut root = root.ok_or("expected opening bracket at end-of-string")?;
        if remove_top {
            if let Child::Tree(t) = &mut root {
                if t.label.is_empty() && t.children.len() == 1 {
                    root = t.children.remove(0);
                }
            }
        }
        Ok(root)
    }

    pub fn leaves(&self) -> Vec<String> {
        let mut leaves = Vec::new();
        for child in &self.children {
            match child {
                Child::Leaf(s) => leaves.push(s.clone()),
                Child::Tree(t) => leaves.extend(t.leaves()),
            }
        }
        leaves
    }

    pub fn height(&self) -> usize {
        1 + self
            .children
            .iter()
            .map(|c| match c {
                Child::Leaf(_) => 1,
                Child::Tree(t) => t.height(),
            })
            .max()
            .unwrap_or(0)
    }

    pub fn positions(&self, order: &str) -> Result<Vec<Vec<usize>>> {
        if !["preorder", "postorder", "bothorder", "leaves"].contains(&order) {
            return Err("unknown tree position order".into());
        }
        fn walk(tree: &Tree, path: &mut Vec<usize>, out: &mut Vec<Vec<usize>>, order: &str) {
            if order == "preorder" || order == "bothorder" {
                out.push(path.clone());
            }
            for (i, c) in tree.children.iter().enumerate() {
                path.push(i);
                match c {
                    Child::Leaf(_) => out.push(path.clone()),
                    Child::Tree(t) => walk(t, path, out, order),
                }
                path.pop();
            }
            if order == "postorder" || order == "bothorder" {
                out.push(path.clone());
            }
        }
        let mut out = Vec::new();
        walk(self, &mut Vec::new(), &mut out, order);
        Ok(out)
    }

    /// Validate Python negative indices and return a canonical path for marshaling live views.
    pub fn normalize_position(&self, position: &[i64]) -> Result<Vec<usize>> {
        let mut tree = self;
        let mut path = Vec::new();
        for (depth, &index) in position.iter().enumerate() {
            let len = tree.children.len() as i64;
            let index = if index < 0 { len + index } else { index };
            if index < 0 || index >= len {
                return Err("tree index out of range".into());
            }
            path.push(index as usize);
            if depth + 1 < position.len() {
                match &tree.children[index as usize] {
                    Child::Tree(t) => tree = t,
                    Child::Leaf(_) => return Err("tree position descends through a leaf".into()),
                }
            }
        }
        Ok(path)
    }

    pub fn leaf_position(&self, index: i64) -> Result<Vec<usize>> {
        if index < 0 {
            return Err("leaf index must be non-negative".into());
        }
        self.positions("leaves")?
            .get(index as usize)
            .cloned()
            .ok_or("leaf index out of range".into())
    }

    pub fn spanning(&self, start: i64, end: i64) -> Result<Vec<usize>> {
        if end <= start {
            return Err("end must be greater than start".into());
        }
        let a = self.leaf_position(start)?;
        let b = self.leaf_position(end - 1)?;
        Ok(a.iter()
            .zip(b.iter())
            .take_while(|(x, y)| x == y)
            .map(|(x, _)| *x)
            .collect())
    }

    pub fn pos(&self) -> Vec<(String, String)> {
        let mut out = Vec::new();
        for c in &self.children {
            match c {
                Child::Leaf(s) => out.push((s.clone(), self.label.clone())),
                Child::Tree(t) => out.extend(t.pos()),
            }
        }
        out
    }

    pub fn productions(&self) -> Vec<Production> {
        let rhs = self
            .children
            .iter()
            .map(|c| match c {
                Child::Leaf(s) => Symbol::Terminal(s.clone()),
                Child::Tree(t) => Symbol::Nonterminal(t.label.clone()),
            })
            .collect();
        let mut out = vec![Production {
            lhs: self.label.clone(),
            rhs,
        }];
        for c in &self.children {
            if let Child::Tree(t) = c {
                out.extend(t.productions());
            }
        }
        out
    }

    pub fn format(&self, f: &Format) -> Result<String> {
        if f.indent > 10000 {
            return Err("indent exceeds 10000".into());
        }
        fn leaf(s: &str, f: &Format) -> String {
            if f.repr_leaves {
                python_repr(s)
            } else {
                format!("{}{}{}", f.quotes[0], s, f.quotes[1])
            }
        }
        fn flat(t: &Tree, f: &Format) -> String {
            let children: Vec<_> = t
                .children
                .iter()
                .map(|c| match c {
                    Child::Leaf(s) => leaf(s, f),
                    Child::Tree(t) => flat(t, f),
                })
                .collect();
            format!(
                "{}{}{} {}{}",
                f.parens[0],
                t.label,
                f.nodesep,
                children.join(" "),
                f.parens[1]
            )
        }
        fn wrap(t: &Tree, f: &Format, indent: usize) -> String {
            let s = flat(t, f);
            if ((s.chars().count() + indent) as i64) < f.margin {
                return s;
            }
            let mut s = format!("{}{}{}", f.parens[0], t.label, f.nodesep);
            for c in &t.children {
                s.push('\n');
                s.push_str(&" ".repeat(indent + 2));
                s.push_str(&match c {
                    Child::Leaf(s) => leaf(s, f),
                    Child::Tree(t) => wrap(t, f, indent + 2),
                });
            }
            s.push_str(&f.parens[1]);
            s
        }
        Ok(wrap(self, f, f.indent))
    }
}
