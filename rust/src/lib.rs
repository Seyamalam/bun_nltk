pub mod ascii;
pub mod categorical_maxent;
pub mod categorical_nb;
pub mod categorical_tree;
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
pub mod maxent_encoding;
pub mod metrics;
pub mod morphy;
pub mod naive_bayes;
pub mod ngrams;
pub mod normalize;
mod numeric_validation;
pub mod parsing;
pub mod parsing_abi;
pub mod perceptron;
pub mod porter;
pub mod positive_categorical_nb;
pub mod probability_contracts;
pub mod punkt;
pub mod punkt_legacy;
pub mod punkt_training;
pub mod punkt_unicode;
pub mod stopwords;
pub mod stream_freqdist;
pub mod tagger;
pub mod text_classifiers;
#[cfg(not(target_arch = "wasm32"))]
pub mod text_linear;
pub mod text_naive_bayes;
pub mod token_ids;
mod tokenizer_unicode;
pub mod tokenizers;
pub mod translation;
pub mod translation_metrics;
#[cfg(any(target_arch = "wasm32", test))]
pub mod wasm_probability_contracts;

#[cfg(not(target_arch = "wasm32"))]
pub mod wordnet;

#[cfg(not(target_arch = "wasm32"))]
pub mod ffi;

pub mod wasm_decision_tree;
pub mod wasm_exports;
pub mod wasm_metrics;
pub mod wasm_metrics_stream;
pub mod wasm_punkt;
pub mod wasm_text_classifiers;
pub mod wasm_text_naive_bayes;
pub mod wasm_tokenizers;

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
