pub mod ascii;
pub mod chunk;
pub mod collocations;
pub mod cyk;
pub mod error_state;
pub mod freqdist;
pub mod linear;
pub mod lm;
pub mod morphy;
pub mod naive_bayes;
pub mod ngrams;
pub mod normalize;
pub mod perceptron;
pub mod punkt;
pub mod porter;
pub mod stopwords;
pub mod stream_freqdist;
pub mod tagger;
pub mod token_ids;

#[cfg(not(target_arch = "wasm32"))]
pub mod ffi;

#[cfg(target_arch = "wasm32")]
pub mod wasm_exports;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreError {
    InvalidN,
    OutOfMemory,
    InsufficientCapacity,
}

pub type CoreResult<T> = Result<T, CoreError>;

impl CoreError {
    pub fn code(self) -> u32 {
        match self {
            CoreError::InvalidN => error_state::INVALID_N,
            CoreError::OutOfMemory => error_state::OUT_OF_MEMORY,
            CoreError::InsufficientCapacity => error_state::INSUFFICIENT_CAPACITY,
        }
    }
}
