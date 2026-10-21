//! Packed Earley chart, recognition and bounded forest enumeration.
use super::{Child, Grammar, Production, Result, Symbol, Tree, MAX_DEPTH};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

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
