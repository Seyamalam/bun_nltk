pub mod ascii;
pub mod categorical_nb;
pub mod chunk;
pub mod cluster;
pub mod collocations;
pub mod cyk;
pub mod distance;
pub mod error_state;
pub mod exact_metrics_stream;
pub mod freqdist;
pub mod hmm;
pub mod linear;
pub mod lm;
pub mod morphy;
pub mod naive_bayes;
pub mod ngrams;
pub mod normalize;
mod numeric_validation;
pub mod perceptron;
pub mod porter;
pub mod positive_categorical_nb;
pub mod punkt;
pub mod stopwords;
pub mod stream_freqdist;
pub mod tagger;
#[cfg(not(target_arch = "wasm32"))]
pub mod text_linear;
pub mod token_ids;
pub mod translation;

#[cfg(not(target_arch = "wasm32"))]
pub mod wordnet;

#[cfg(not(target_arch = "wasm32"))]
pub mod ffi;

pub mod wasm_exports;
pub mod wasm_metrics_stream;

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
