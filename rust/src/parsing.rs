//! String-valued NLTK trees, typed CFGs and a packed Earley parser.
//! No CNF rewriting: the forest preserves the original production structure.
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub type Result<T> = std::result::Result<T, String>;
const MAX_DEPTH: usize = 256;

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

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct State {
    rule: usize,
    dot: usize,
    origin: usize,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
enum ForestChild {
    Leaf(String),
    Node(usize),
}
#[derive(Clone, Debug)]
struct ForestNode {
    label: String,
    alternatives: Vec<Vec<ForestChild>>,
}
#[derive(Clone, Debug)]
struct Entry {
    state: State,
    paths: Vec<Vec<ForestChild>>,
}
#[derive(Default)]
struct Column {
    entries: Vec<Entry>,
    index: HashMap<State, usize>,
}
impl Column {
    fn add(
        &mut self,
        state: State,
        paths: Vec<Vec<ForestChild>>,
        count: &mut usize,
        limit: usize,
    ) -> Result<bool> {
        let index = if let Some(&i) = self.index.get(&state) {
            i
        } else {
            let i = self.entries.len();
            self.index.insert(state.clone(), i);
            self.entries.push(Entry {
                state,
                paths: Vec::new(),
            });
            *count += 1;
            i
        };
        let mut changed = false;
        for path in paths {
            if !self.entries[index].paths.contains(&path) {
                self.entries[index].paths.push(path);
                *count += 1;
                changed = true;
            }
        }
        if *count > limit {
            return Err(format!("Earley chart resource limit exceeded ({limit})"));
        }
        Ok(changed)
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct ParseResult {
    pub recognized: bool,
    pub trees: Vec<Tree>,
    /// True when more trees exist than requested; no silent ambiguity truncation.
    pub truncated: bool,
    /// Same-span grammar cycles are recognized, but cyclic derivations are not enumerated.
    pub cyclic: bool,
    pub states: usize,
}

pub fn earley(
    grammar: &Grammar,
    tokens: &[String],
    max_trees: usize,
    max_states: usize,
) -> Result<ParseResult> {
    grammar.validate()?;
    grammar.coverage(tokens)?;
    if tokens.len() > 512 {
        return Err("input exceeds 512 tokens".into());
    }
    if max_trees > 10000 || max_states == 0 || max_states > 2_000_000 {
        return Err("invalid parser resource limits".into());
    }
    let mut rules = grammar.productions.clone();
    let augmented = rules.len();
    rules.push(Production {
        lhs: String::new(),
        rhs: vec![Symbol::Nonterminal(grammar.start.clone())],
    });
    let mut by_lhs: HashMap<String, Vec<usize>> = HashMap::new();
    for (i, p) in grammar.productions.iter().enumerate() {
        by_lhs.entry(p.lhs.clone()).or_default().push(i);
    }
    let mut chart: Vec<Column> = (0..=tokens.len()).map(|_| Column::default()).collect();
    let mut count = 0;
    chart[0].add(
        State {
            rule: augmented,
            dot: 0,
            origin: 0,
        },
        vec![Vec::new()],
        &mut count,
        max_states,
    )?;
    let mut forest: Vec<ForestNode> = Vec::new();
    let mut nodes: HashMap<(String, usize, usize), usize> = HashMap::new();
    for end in 0..=tokens.len() {
        // Fixed-point saturation also joins nullable completions discovered before their waiters.
        loop {
            let mut changed = false;
            let snapshot = chart[end].entries.clone();
            for entry in snapshot {
                let state = &entry.state;
                let p = &rules[state.rule];
                if state.dot == p.rhs.len() {
                    if state.rule == augmented {
                        continue;
                    }
                    let key = (p.lhs.clone(), state.origin, end);
                    let node = *nodes.entry(key).or_insert_with(|| {
                        let id = forest.len();
                        forest.push(ForestNode {
                            label: p.lhs.clone(),
                            alternatives: Vec::new(),
                        });
                        id
                    });
                    for path in &entry.paths {
                        if !forest[node].alternatives.contains(path) {
                            forest[node].alternatives.push(path.clone());
                        }
                    }
                    let waiting = chart[state.origin].entries.clone();
                    for waiter in waiting {
                        if rules[waiter.state.rule].rhs.get(waiter.state.dot)
                            == Some(&Symbol::Nonterminal(p.lhs.clone()))
                        {
                            let paths = waiter
                                .paths
                                .into_iter()
                                .map(|mut path| {
                                    path.push(ForestChild::Node(node));
                                    path
                                })
                                .collect();
                            let next = State {
                                dot: waiter.state.dot + 1,
                                ..waiter.state
                            };
                            changed |= chart[end].add(next, paths, &mut count, max_states)?;
                        }
                    }
                } else {
                    match &p.rhs[state.dot] {
                        Symbol::Nonterminal(symbol) => {
                            for &rule in by_lhs.get(symbol).into_iter().flatten() {
                                changed |= chart[end].add(
                                    State {
                                        rule,
                                        dot: 0,
                                        origin: end,
                                    },
                                    vec![Vec::new()],
                                    &mut count,
                                    max_states,
                                )?;
                            }
                            if let Some(&node) = nodes.get(&(symbol.clone(), end, end)) {
                                let paths = entry
                                    .paths
                                    .into_iter()
                                    .map(|mut path| {
                                        path.push(ForestChild::Node(node));
                                        path
                                    })
                                    .collect();
                                changed |= chart[end].add(
                                    State {
                                        dot: state.dot + 1,
                                        ..state.clone()
                                    },
                                    paths,
                                    &mut count,
                                    max_states,
                                )?;
                            }
                        }
                        Symbol::Terminal(symbol) => {
                            if tokens.get(end) == Some(symbol) {
                                let paths = entry
                                    .paths
                                    .into_iter()
                                    .map(|mut path| {
                                        path.push(ForestChild::Leaf(symbol.clone()));
                                        path
                                    })
                                    .collect();
                                chart[end + 1].add(
                                    State {
                                        dot: state.dot + 1,
                                        ..state.clone()
                                    },
                                    paths,
                                    &mut count,
                                    max_states,
                                )?;
                            }
                        }
                    }
                }
            }
            if !changed {
                break;
            }
        }
    }
    let root = nodes
        .get(&(grammar.start.clone(), 0, tokens.len()))
        .copied();
    // Inspect the entire reachable graph, independently of tree enumeration caps.
    // Otherwise a cycle in a later alternative could be hidden by maxTrees.
    let mut cyclic = false;
    if let Some(root) = root {
        let mut colors = vec![0u8; forest.len()];
        let mut stack = vec![(root, false)];
        while let Some((node, leaving)) = stack.pop() {
            if leaving {
                colors[node] = 2;
                continue;
            }
            if colors[node] == 1 {
                cyclic = true;
                continue;
            }
            if colors[node] == 2 {
                continue;
            }
            colors[node] = 1;
            stack.push((node, true));
            for alternative in forest[node].alternatives.iter().rev() {
                for child in alternative.iter().rev() {
                    if let ForestChild::Node(id) = child {
                        stack.push((*id, false));
                    }
                }
            }
        }
    }
    fn expand(
        id: usize,
        forest: &[ForestNode],
        active: &mut HashSet<usize>,
        cap: usize,
        work: &mut usize,
    ) -> Result<Vec<Tree>> {
        *work += 1;
        if *work > 1_000_000 {
            return Err("parse forest expansion resource limit exceeded".into());
        }
        if !active.insert(id) {
            return Ok(Vec::new());
        }
        if active.len() >= MAX_DEPTH {
            return Err("parse tree depth limit exceeded".into());
        }
        let mut trees = Vec::new();
        for alternative in &forest[id].alternatives {
            let mut paths = vec![Vec::new()];
            for child in alternative {
                let choices = match child {
                    ForestChild::Leaf(s) => vec![Child::Leaf(s.clone())],
                    ForestChild::Node(n) => expand(*n, forest, active, cap, work)?
                        .into_iter()
                        .map(Child::Tree)
                        .collect(),
                };
                let mut next = Vec::new();
                'product: for path in &paths {
                    for choice in &choices {
                        let mut p = path.clone();
                        p.push(choice.clone());
                        next.push(p);
                        if next.len() >= cap {
                            break 'product;
                        }
                    }
                }
                paths = next;
            }
            for children in paths {
                let t = Tree {
                    label: forest[id].label.clone(),
                    children,
                };
                if !trees.contains(&t) {
                    trees.push(t);
                }
                if trees.len() >= cap {
                    break;
                }
            }
            if trees.len() >= cap {
                break;
            }
        }
        active.remove(&id);
        Ok(trees)
    }
    let mut trees = if max_trees == 0 {
        Vec::new()
    } else if let Some(root) = root {
        expand(root, &forest, &mut HashSet::new(), max_trees + 1, &mut 0)?
    } else {
        Vec::new()
    };
    let truncated = trees.len() > max_trees;
    trees.truncate(max_trees);
    Ok(ParseResult {
        recognized: root.is_some(),
        trees,
        truncated,
        cyclic,
        states: count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn parse(text: &str, tokens: &[&str]) -> ParseResult {
        earley(
            &Grammar::fromstring(text).unwrap(),
            &tokens.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            100,
            100000,
        )
        .unwrap()
    }
    #[test]
    fn tree_contract() {
        let Child::Tree(t) = Tree::fromstring("(S (NP café) (VP runs) ())", "()", false).unwrap()
        else {
            panic!()
        };
        assert_eq!(t.leaves(), vec!["café", "runs"]);
        assert_eq!(t.height(), 3);
        assert_eq!(
            t.positions("preorder").unwrap(),
            vec![vec![], vec![0], vec![0, 0], vec![1], vec![1, 0], vec![2]]
        );
        assert_eq!(t.normalize_position(&[-2, -1]).unwrap(), vec![1, 0]);
        assert!(t.normalize_position(&[0, 0, 0]).is_err());
        assert_eq!(t.spanning(0, 2).unwrap(), Vec::<usize>::new());
        assert_eq!(
            t.format(&Format::default()).unwrap(),
            "(S (NP café) (VP runs) ( ))"
        );
    }
    #[test]
    fn invalid_trees() {
        for s in ["", "a", "(S", ")", "(S) (T)", "(S))", "(S) x"] {
            assert!(Tree::fromstring(s, "()", false).is_err(), "{s}");
        }
    }
    #[test]
    fn grammar_quotes_and_empty() {
        let g = Grammar::fromstring("%start NP\nS -> 'a|b' |\nNP -> S \\\n 'c'\n").unwrap();
        assert_eq!(g.start, "NP");
        assert_eq!(g.productions.len(), 3);
        assert_eq!(g.productions[0].rhs, vec![Symbol::Terminal("a|b".into())]);
        assert!(g.productions[1].rhs.is_empty());
        for s in ["", "S => A", "S -> 'x", "S -> @", "%bad S\nS -> 'a'"] {
            assert!(Grammar::fromstring(s).is_err(), "{s}");
        }
    }
    #[test]
    fn ambiguity_and_left_recursion() {
        let p = parse("S -> S S | 'a'", &["a", "a", "a", "a"]);
        assert!(p.recognized);
        assert_eq!(p.trees.len(), 5);
        assert!(!p.cyclic);
    }
    #[test]
    fn nullable_and_mixed() {
        let p = parse("S -> A A 'z'\nA -> | 'a'", &["a", "z"]);
        assert_eq!(p.trees.len(), 2);
        assert_eq!(parse("S -> A\nA ->", &[]).trees.len(), 1);
        assert!(!parse("S -> 'a' 'b'", &["b", "a"]).recognized);
    }
    #[test]
    fn cycles_are_explicit() {
        let p = parse("S -> S | 'a'", &["a"]);
        assert!(p.recognized);
        assert!(p.cyclic);
        assert_eq!(p.trees.len(), 1);
        let g = Grammar::fromstring("S -> 'a' | A\nA -> A | 'a'").unwrap();
        assert!(earley(&g, &["a".into()], 0, 10000).unwrap().cyclic);
        assert!(earley(&g, &["a".into()], 1, 10000).unwrap().cyclic);
    }
    #[test]
    fn limits_and_coverage() {
        let g = Grammar::fromstring("S -> S S | 'a'").unwrap();
        assert!(earley(&g, &["x".into()], 1, 100).is_err());
        let p = earley(&g, &vec!["a".into(); 4], 2, 10000).unwrap();
        assert_eq!(p.trees.len(), 2);
        assert!(p.truncated);
        assert!(earley(&g, &vec!["a".into(); 4], 2, 1).is_err());
    }
}
