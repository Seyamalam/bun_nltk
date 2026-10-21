//! Dedicated JSON ABI: inputs are borrowed for one call; the result buffer lives
//! until the next call or release. Algorithms reside in cohesive parsing modules.
use crate::parsing::{earley, Child, Format, Grammar, Production, Symbol, Tree};
use serde::Deserialize;
use serde_json::{json, Value};
use std::cell::RefCell;

#[path = "parsing_pcfg.rs"]
mod pcfg;
#[path = "parsing_tree_list.rs"]
mod tree_list;

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
enum Request {
    TreeListPlan {
        len: usize,
        edit: tree_list::Edit,
    },
    PcfgFromstring {
        text: String,
    },
    PcfgValidate {
        grammar: pcfg::Pcfg,
    },
    PcfgProductions {
        grammar: pcfg::Pcfg,
        lhs: Option<String>,
        rhs: Option<Symbol>,
        empty: bool,
    },
    WeightedProductionFormat {
        production: pcfg::WeightedProduction,
    },
    Viterbi {
        grammar: pcfg::Pcfg,
        tokens: Vec<String>,
        max_work: usize,
    },
    TreeFromstring {
        text: String,
        brackets: String,
        remove_top: bool,
    },
    TreeLeaves {
        tree: Tree,
    },
    TreeHeight {
        tree: Tree,
    },
    TreePositions {
        tree: Tree,
        order: String,
    },
    TreePosition {
        tree: Tree,
        position: Vec<i64>,
    },
    TreeLeafPosition {
        tree: Tree,
        index: i64,
    },
    TreeSpanning {
        tree: Tree,
        start: i64,
        end: i64,
    },
    TreePos {
        tree: Tree,
    },
    TreeProductions {
        tree: Tree,
    },
    TreeFormat {
        tree: Tree,
        format: Format,
    },
    TreeSubtrees {
        tree: Tree,
    },
    GrammarFromstring {
        text: String,
    },
    GrammarCoverage {
        grammar: Grammar,
        tokens: Vec<String>,
    },
    GrammarInfo {
        grammar: Grammar,
    },
    GrammarProductions {
        grammar: Grammar,
        lhs: Option<String>,
        rhs: Option<Symbol>,
        empty: bool,
    },
    GrammarLeftcorners {
        grammar: Grammar,
        category: String,
    },
    GrammarLeftcornerParents {
        grammar: Grammar,
        category: String,
    },
    GrammarIsLeftcorner {
        grammar: Grammar,
        category: String,
        left: Symbol,
    },
    ProductionFormat {
        production: Production,
    },
    ProductionLexical {
        production: Production,
    },
    Parse {
        grammar: Grammar,
        tokens: Vec<String>,
        max_trees: usize,
        max_states: usize,
    },
}

fn dispatch(request: Request) -> crate::parsing::Result<Value> {
    Ok(match request {
        Request::TreeListPlan { len, edit } => json!(tree_list::plan(len, edit)?),
        Request::PcfgFromstring { text } => json!(pcfg::Pcfg::fromstring(&text)?),
        Request::PcfgValidate { grammar } => {
            grammar.validate()?;
            Value::Null
        }
        Request::PcfgProductions {
            grammar,
            lhs,
            rhs,
            empty,
        } => json!(pcfg::productions(grammar, lhs, rhs, empty)?),
        Request::WeightedProductionFormat { production } => json!(production.format()),
        Request::Viterbi {
            grammar,
            tokens,
            max_work,
        } => json!(pcfg::viterbi(&grammar, &tokens, max_work)?),
        Request::TreeFromstring {
            text,
            brackets,
            remove_top,
        } => json!(Tree::fromstring(&text, &brackets, remove_top)?),
        Request::TreeLeaves { tree } => json!(tree.leaves()),
        Request::TreeHeight { tree } => json!(tree.height()),
        Request::TreePositions { tree, order } => json!(tree.positions(&order)?),
        Request::TreePosition { tree, position } => json!(tree.normalize_position(&position)?),
        Request::TreeLeafPosition { tree, index } => json!(tree.leaf_position(index)?),
        Request::TreeSpanning { tree, start, end } => json!(tree.spanning(start, end)?),
        Request::TreePos { tree } => json!(tree.pos()),
        Request::TreeProductions { tree } => json!(tree.productions()),
        Request::TreeFormat { tree, format } => json!(tree.format(&format)?),
        Request::TreeSubtrees { tree } => {
            // Positions are returned so TS can expose live subtrees, not detached copies.
            let mut positions = Vec::new();
            for pos in tree.positions("preorder")? {
                let mut node = Some(&tree);
                for &i in &pos {
                    node = node.and_then(|t| match &t.children[i] {
                        Child::Tree(t) => Some(t),
                        Child::Leaf(_) => None,
                    });
                }
                if node.is_some() {
                    positions.push(pos);
                }
            }
            json!(positions)
        }
        Request::GrammarFromstring { text } => json!(Grammar::fromstring(&text)?),
        Request::GrammarCoverage { grammar, tokens } => {
            grammar.coverage(&tokens)?;
            Value::Null
        }
        Request::GrammarInfo { grammar } => {
            grammar.validate()?;
            let min = grammar
                .productions
                .iter()
                .map(|p| p.rhs.len())
                .min()
                .unwrap();
            let max = grammar
                .productions
                .iter()
                .map(|p| p.rhs.len())
                .max()
                .unwrap();
            let lexical = grammar.productions.iter().all(Production::is_lexical);
            let nonlexical = grammar
                .productions
                .iter()
                .filter(|p| p.rhs.len() != 1)
                .all(|p| !p.is_lexical());
            let unary_lexical = grammar
                .productions
                .iter()
                .filter(|p| p.rhs.len() == 1)
                .all(Production::is_lexical);
            json!({"min_len": min, "max_len": max, "is_lexical": lexical, "is_nonlexical": nonlexical,
                "is_nonempty": min > 0, "is_binarised": max <= 2,
                "is_flexible_chomsky_normal_form": min > 0 && max <= 2 && nonlexical,
                "is_chomsky_normal_form": min > 0 && max <= 2 && nonlexical && unary_lexical})
        }
        Request::GrammarProductions {
            grammar,
            lhs,
            rhs,
            empty,
        } => {
            if rhs.is_some() && empty {
                return Err("cannot select empty and non-empty productions together".into());
            }
            let mut rows: Vec<_> = grammar
                .productions
                .into_iter()
                .filter(|p| {
                    lhs.as_ref().is_none_or(|lhs| &p.lhs == lhs)
                        && rhs.as_ref().is_none_or(|rhs| p.rhs.first() == Some(rhs))
                        && (!empty || p.rhs.is_empty())
                })
                .collect();
            if empty {
                // NLTK's empty index retains the last empty production per LHS.
                let mut unique: Vec<Production> = Vec::new();
                for p in rows {
                    if let Some(i) = unique.iter().position(|r| r.lhs == p.lhs) {
                        unique[i] = p;
                    } else {
                        unique.push(p);
                    }
                }
                rows = unique;
            }
            json!(rows)
        }
        Request::GrammarLeftcorners { grammar, category } => json!(grammar.leftcorners(&category)),
        Request::GrammarLeftcornerParents { grammar, category } => {
            let mut parents = Vec::new();
            for p in &grammar.productions {
                if grammar.leftcorners(&p.lhs).contains(&category) && !parents.contains(&p.lhs) {
                    parents.push(p.lhs.clone());
                }
            }
            if parents.is_empty() {
                parents.push(category);
            }
            json!(parents)
        }
        Request::GrammarIsLeftcorner {
            grammar,
            category,
            left,
        } => {
            let corners = grammar.leftcorners(&category);
            json!(match left {
                Symbol::Nonterminal(s) => corners.contains(&s),
                Symbol::Terminal(s) => grammar.productions.iter().any(|p| corners.contains(&p.lhs)
                    && p.rhs.first() == Some(&Symbol::Terminal(s.clone()))),
            })
        }
        Request::ProductionFormat { production } => json!(production.format()),
        Request::ProductionLexical { production } => json!(production.is_lexical()),
        Request::Parse {
            grammar,
            tokens,
            max_trees,
            max_states,
        } => json!(earley(&grammar, &tokens, max_trees, max_states)?),
    })
}

thread_local! { static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; }

/// # Safety
/// `ptr` must reference `len` readable bytes in this module's linear memory.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_parsing_request(ptr: *const u8, len: usize) -> u32 {
    let result = if ptr.is_null() || len > 16 * 1024 * 1024 {
        Err("invalid parsing request buffer".to_string())
    } else {
        serde_json::from_slice::<Request>(std::slice::from_raw_parts(ptr, len))
            .map_err(|e| e.to_string())
            .and_then(dispatch)
    };
    let status = u32::from(result.is_err());
    let value = match result {
        Ok(value) => json!({"value": value}),
        Err(error) => json!({"error": error}),
    };
    OUTPUT.with(|out| *out.borrow_mut() = serde_json::to_vec(&value).unwrap());
    status
}

#[no_mangle]
pub extern "C" fn bunnltk_parsing_result_ptr() -> *const u8 {
    OUTPUT.with(|out| out.borrow().as_ptr())
}
#[no_mangle]
pub extern "C" fn bunnltk_parsing_result_len() -> usize {
    OUTPUT.with(|out| out.borrow().len())
}
#[no_mangle]
pub extern "C" fn bunnltk_parsing_release() {
    OUTPUT.with(|out| *out.borrow_mut() = Vec::new());
}
