//! String-valued NLTK trees, typed CFGs and a packed Earley parser.
//! No CNF rewriting: the forest preserves the original production structure.
mod earley;
mod grammar;
mod tree;

pub use earley::{earley, ParseResult};
pub use grammar::{Grammar, Production, Symbol};
pub use tree::{python_repr, Child, Format, Tree};

pub type Result<T> = std::result::Result<T, String>;
const MAX_DEPTH: usize = 256;

#[cfg(test)]
mod tests;
