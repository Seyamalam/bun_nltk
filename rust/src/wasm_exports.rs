//! WASM exports (port of zig/src/wasm_exports.zig).
//!
//! All functions take u32 byte offsets into linear memory instead of raw
//! pointers. The 128MB input staging buffer is allocated lazily on first use
//! so it does not bloat the .wasm data section.

use std::alloc::{alloc, dealloc, Layout};

use crate::ascii;
use crate::chunk;
use crate::cyk;
use crate::error_state;
use crate::freqdist;
use crate::lm;
use crate::morphy;
use crate::naive_bayes;
use crate::normalize;
use crate::perceptron;
use crate::punkt;

const INPUT_BUFFER_SIZE: usize = 128 * 1024 * 1024;
const ALLOC_ALIGN: usize = 16;

static mut INPUT_BUFFER_PTR: *mut u8 = std::ptr::null_mut();

fn alloc_layout(size: usize) -> Layout {
    Layout::from_size_align(size, ALLOC_ALIGN).expect("invalid layout")
}

/// Returns null if the lazy allocation failed (caller sets out_of_memory).
unsafe fn ensure_input_buffer() -> *mut u8 {
    unsafe {
        if !INPUT_BUFFER_PTR.is_null() {
            return INPUT_BUFFER_PTR;
        }
        let ptr = alloc(alloc_layout(INPUT_BUFFER_SIZE));
        if !ptr.is_null() {
            INPUT_BUFFER_PTR = ptr;
        }
        ptr
    }
}

/// Slice of the input staging buffer; None means allocation failure.
unsafe fn input_slice(len: usize) -> Option<&'static [u8]> {
    let len = len.min(INPUT_BUFFER_SIZE);
    let ptr = unsafe { ensure_input_buffer() };
    if ptr.is_null() {
        return None;
    }
    Some(unsafe { std::slice::from_raw_parts(ptr, len) })
}

/// Slice from a linear-memory offset, tolerating null / zero-length inputs.
unsafe fn offset_slice<'a, T>(offset: u32, len: usize) -> &'a [T] {
    if offset == 0 || len == 0 {
        &[]
    } else {
        unsafe { std::slice::from_raw_parts(offset as *const T, len) }
    }
}

unsafe fn offset_slice_mut<'a, T>(offset: u32, len: usize) -> &'a mut [T] {
    if offset == 0 || len == 0 {
        &mut []
    } else {
        unsafe { std::slice::from_raw_parts_mut(offset as *mut T, len) }
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_last_error_code() -> u32 {
    error_state::get_last_error_code()
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_input_ptr() -> u32 {
    let ptr = unsafe { ensure_input_buffer() };
    if ptr.is_null() {
        error_state::set_error(error_state::OUT_OF_MEMORY);
        return 0;
    }
    ptr as u32
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_input_capacity() -> u32 {
    INPUT_BUFFER_SIZE as u32
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_alloc(size: u32) -> u32 {
    error_state::reset_error();
    if size == 0 {
        return 0;
    }
    let ptr = unsafe { alloc(alloc_layout(size as usize)) };
    if ptr.is_null() {
        error_state::set_error(error_state::OUT_OF_MEMORY);
        return 0;
    }
    ptr as u32
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_free(ptr: u32, size: u32) {
    if ptr == 0 || size == 0 {
        return;
    }
    unsafe { dealloc(ptr as *mut u8, alloc_layout(size as usize)) };
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_count_tokens_ascii(input_len: u32) -> u64 {
    error_state::reset_error();
    match unsafe { input_slice(input_len as usize) } {
        Some(input) => ascii::token_count_ascii(input),
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_count_ngrams_ascii(input_len: u32, n: u32) -> u64 {
    error_state::reset_error();
    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    let input = match unsafe { input_slice(input_len as usize) } {
        Some(input) => input,
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            return 0;
        }
    };
    let token_count = ascii::token_count_ascii(input);
    let n_u64 = n as u64;
    if token_count < n_u64 {
        return 0;
    }
    token_count - n_u64 + 1
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_compute_ascii_metrics(
    input_len: u32,
    n: u32,
    out_metrics_ptr: u32,
    out_metrics_len: u32,
) {
    error_state::reset_error();
    if out_metrics_len < 4 || out_metrics_ptr == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }

    let out = unsafe { offset_slice_mut::<u64>(out_metrics_ptr, out_metrics_len as usize) };
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return;
    }

    let input = match unsafe { input_slice(input_len as usize) } {
        Some(input) => input,
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            return;
        }
    };

    out[0] = ascii::token_count_ascii(input);
    if out[0] >= n as u64 {
        out[2] = out[0] - n as u64 + 1;
    }

    match freqdist::build_token_freq_map_ascii(input) {
        Ok(map) => out[1] = map.len() as u64,
        Err(err) => {
            error_state::set_error(err.code());
            return;
        }
    }

    match freqdist::build_ngram_freq_map_ascii(input, n as usize) {
        Ok(map) => out[3] = map.len() as u64,
        Err(err) => {
            error_state::set_error(err.code());
            return;
        }
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_count_normalized_tokens_ascii(
    input_len: u32,
    remove_stopwords: u32,
) -> u64 {
    error_state::reset_error();
    let input = match unsafe { input_slice(input_len as usize) } {
        Some(input) => input,
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            return 0;
        }
    };
    normalize::count_normalized_tokens_ascii(input, remove_stopwords != 0)
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_fill_token_offsets_ascii(
    input_len: u32,
    out_offsets_ptr: u32,
    out_lengths_ptr: u32,
    capacity: u32,
) -> u64 {
    error_state::reset_error();
    if out_offsets_ptr == 0 || out_lengths_ptr == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }

    let input = match unsafe { input_slice(input_len as usize) } {
        Some(input) => input,
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            return 0;
        }
    };
    let cap = capacity as usize;
    let out_offsets = unsafe { offset_slice_mut::<u32>(out_offsets_ptr, cap) };
    let out_lengths = unsafe { offset_slice_mut::<u32>(out_lengths_ptr, cap) };

    let total = ascii::fill_token_offsets_ascii(input, out_offsets, out_lengths);
    if total > capacity as u64 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }
    total
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_count_sentences_punkt_ascii(input_len: u32) -> u64 {
    error_state::reset_error();
    let input = match unsafe { input_slice(input_len as usize) } {
        Some(input) => input,
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            return 0;
        }
    };
    punkt::count_sentence_offsets_ascii(input)
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_fill_sentence_offsets_punkt_ascii(
    input_len: u32,
    out_offsets_ptr: u32,
    out_lengths_ptr: u32,
    capacity: u32,
) -> u64 {
    error_state::reset_error();
    if out_offsets_ptr == 0 || out_lengths_ptr == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let input = match unsafe { input_slice(input_len as usize) } {
        Some(input) => input,
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            return 0;
        }
    };
    let cap = capacity as usize;
    let out_offsets = unsafe { offset_slice_mut::<u32>(out_offsets_ptr, cap) };
    let out_lengths = unsafe { offset_slice_mut::<u32>(out_lengths_ptr, cap) };
    let total = punkt::fill_sentence_offsets_ascii(input, out_offsets, out_lengths);
    if total > capacity as u64 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }
    total
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_fill_normalized_token_offsets_ascii(
    input_len: u32,
    remove_stopwords: u32,
    out_offsets_ptr: u32,
    out_lengths_ptr: u32,
    capacity: u32,
) -> u64 {
    error_state::reset_error();
    if out_offsets_ptr == 0 || out_lengths_ptr == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }

    let input = match unsafe { input_slice(input_len as usize) } {
        Some(input) => input,
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            return 0;
        }
    };
    let cap = capacity as usize;
    let out_offsets = unsafe { offset_slice_mut::<u32>(out_offsets_ptr, cap) };
    let out_lengths = unsafe { offset_slice_mut::<u32>(out_lengths_ptr, cap) };

    let total = normalize::fill_normalized_token_offsets_ascii(
        input,
        remove_stopwords != 0,
        out_offsets,
        out_lengths,
    );
    if total > capacity as u64 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }
    total
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_perceptron_predict_batch(
    feature_ids_ptr: u32,
    feature_ids_len: u32,
    token_offsets_ptr: u32,
    token_count: u32,
    weights_ptr: u32,
    model_feature_count: u32,
    tag_count: u32,
    out_tag_ids_ptr: u32,
) {
    error_state::reset_error();
    if token_count == 0 || tag_count == 0 {
        return;
    }
    if feature_ids_ptr == 0 || token_offsets_ptr == 0 || weights_ptr == 0 || out_tag_ids_ptr == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }

    if let Err(err) = perceptron::predict_batch(
        unsafe { offset_slice::<u32>(feature_ids_ptr, feature_ids_len as usize) },
        unsafe { offset_slice::<u32>(token_offsets_ptr, token_count as usize + 1) },
        unsafe {
            offset_slice::<f32>(
                weights_ptr,
                model_feature_count as usize * tag_count as usize,
            )
        },
        model_feature_count,
        tag_count,
        unsafe { offset_slice_mut::<u16>(out_tag_ids_ptr, token_count as usize) },
    ) {
        error_state::set_error(err.code());
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_wordnet_morphy_ascii(
    input_len: u32,
    pos: u32,
    out_ptr: u32,
    out_capacity: u32,
) -> u32 {
    error_state::reset_error();
    if out_ptr == 0 || out_capacity == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let input = match unsafe { input_slice(input_len as usize) } {
        Some(input) => input,
        None => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            return 0;
        }
    };
    let out = unsafe { offset_slice_mut::<u8>(out_ptr, out_capacity as usize) };
    let pos_tag = match pos {
        1 => morphy::WordNetPos::Noun,
        2 => morphy::WordNetPos::Verb,
        3 => morphy::WordNetPos::Adjective,
        4 => morphy::WordNetPos::Adverb,
        _ => morphy::WordNetPos::Any,
    };
    let written = morphy::morphy_ascii(input, pos_tag, out);
    if written == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }
    written as u32
}

fn lm_model_type_from_u32(value: u32) -> lm::ModelType {
    match value {
        0 => lm::ModelType::Mle,
        1 => lm::ModelType::Lidstone,
        _ => lm::ModelType::KneserNeyInterpolated,
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_lm_eval_ids(
    token_ids_ptr: u32,
    token_ids_len: u32,
    sentence_offsets_ptr: u32,
    sentence_offsets_len: u32,
    order: u32,
    model_type: u32,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
    probe_context_flat_ptr: u32,
    probe_context_flat_len: u32,
    probe_context_lens_ptr: u32,
    probe_words_ptr: u32,
    probe_count: u32,
    out_scores_ptr: u32,
    out_scores_len: u32,
    perplexity_tokens_ptr: u32,
    perplexity_len: u32,
    prefix_tokens_ptr: u32,
    prefix_len: u32,
) -> f64 {
    error_state::reset_error();
    if token_ids_ptr == 0 || sentence_offsets_ptr == 0 || out_scores_ptr == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return f64::INFINITY;
    }
    if order == 0 || order > 3 {
        error_state::set_error(error_state::INVALID_N);
        return f64::INFINITY;
    }

    lm::eval_ids(
        unsafe { offset_slice::<u32>(token_ids_ptr, token_ids_len as usize) },
        unsafe { offset_slice::<u32>(sentence_offsets_ptr, sentence_offsets_len as usize) },
        order,
        lm_model_type_from_u32(model_type),
        gamma,
        discount,
        vocab_size,
        unsafe { offset_slice::<u32>(probe_context_flat_ptr, probe_context_flat_len as usize) },
        unsafe { offset_slice::<u32>(probe_context_lens_ptr, probe_count as usize) },
        unsafe { offset_slice::<u32>(probe_words_ptr, probe_count as usize) },
        unsafe { offset_slice_mut::<f64>(out_scores_ptr, out_scores_len as usize) },
        unsafe { offset_slice::<u32>(perplexity_tokens_ptr, perplexity_len as usize) },
        unsafe { offset_slice::<u32>(prefix_tokens_ptr, prefix_len as usize) },
    )
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_chunk_iob_ids(
    token_tag_ids_ptr: u32,
    token_count: u32,
    atom_allowed_offsets_ptr: u32,
    atom_allowed_lengths_ptr: u32,
    atom_allowed_flat_ptr: u32,
    atom_allowed_flat_len: u32,
    atom_mins_ptr: u32,
    atom_maxs_ptr: u32,
    atom_count: u32,
    rule_atom_offsets_ptr: u32,
    rule_atom_counts_ptr: u32,
    rule_label_ids_ptr: u32,
    rule_count: u32,
    out_label_ids_ptr: u32,
    out_begin_ptr: u32,
    out_capacity: u32,
) -> u64 {
    error_state::reset_error();
    if token_count == 0 {
        return 0;
    }
    if token_tag_ids_ptr == 0 || out_label_ids_ptr == 0 || out_begin_ptr == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    if out_capacity < token_count {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    chunk::fill_chunk_iob_ids(
        unsafe { offset_slice::<u16>(token_tag_ids_ptr, token_count as usize) },
        unsafe { offset_slice::<u32>(atom_allowed_offsets_ptr, atom_count as usize) },
        unsafe { offset_slice::<u32>(atom_allowed_lengths_ptr, atom_count as usize) },
        unsafe { offset_slice::<u16>(atom_allowed_flat_ptr, atom_allowed_flat_len as usize) },
        unsafe { offset_slice::<u8>(atom_mins_ptr, atom_count as usize) },
        unsafe { offset_slice::<u8>(atom_maxs_ptr, atom_count as usize) },
        unsafe { offset_slice::<u32>(rule_atom_offsets_ptr, rule_count as usize) },
        unsafe { offset_slice::<u32>(rule_atom_counts_ptr, rule_count as usize) },
        unsafe { offset_slice::<u16>(rule_label_ids_ptr, rule_count as usize) },
        unsafe { offset_slice_mut::<u16>(out_label_ids_ptr, out_capacity as usize) },
        unsafe { offset_slice_mut::<u8>(out_begin_ptr, out_capacity as usize) },
    )
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_cyk_recognize_ids(
    token_bits_ptr: u32,
    token_count: u32,
    binary_left_ptr: u32,
    binary_right_ptr: u32,
    binary_parent_ptr: u32,
    binary_count: u32,
    unary_child_ptr: u32,
    unary_parent_ptr: u32,
    unary_count: u32,
    start_symbol: u32,
) -> u32 {
    error_state::reset_error();
    if token_count == 0 {
        return 0;
    }
    if token_bits_ptr == 0
        || binary_left_ptr == 0
        || binary_right_ptr == 0
        || binary_parent_ptr == 0
    {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    if start_symbol >= 64 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    let ok = cyk::cyk_recognize(
        unsafe { offset_slice::<u64>(token_bits_ptr, token_count as usize) },
        unsafe { offset_slice::<u16>(binary_left_ptr, binary_count as usize) },
        unsafe { offset_slice::<u16>(binary_right_ptr, binary_count as usize) },
        unsafe { offset_slice::<u16>(binary_parent_ptr, binary_count as usize) },
        unsafe { offset_slice::<u16>(unary_child_ptr, unary_count as usize) },
        unsafe { offset_slice::<u16>(unary_parent_ptr, unary_count as usize) },
        start_symbol as u16,
    );
    if ok {
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_naive_bayes_log_scores_ids(
    doc_token_ids_ptr: u32,
    doc_token_count: u32,
    vocab_size: u32,
    token_counts_matrix_ptr: u32,
    token_counts_matrix_len: u32,
    label_doc_counts_ptr: u32,
    label_token_totals_ptr: u32,
    label_count: u32,
    total_docs: u32,
    smoothing: f64,
    out_scores_ptr: u32,
    out_scores_len: u32,
) {
    error_state::reset_error();
    if label_count == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }
    if doc_token_ids_ptr == 0
        || token_counts_matrix_ptr == 0
        || label_doc_counts_ptr == 0
        || label_token_totals_ptr == 0
        || out_scores_ptr == 0
    {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }
    naive_bayes::log_scores(
        unsafe { offset_slice::<u32>(doc_token_ids_ptr, doc_token_count as usize) },
        vocab_size,
        unsafe { offset_slice::<u32>(token_counts_matrix_ptr, token_counts_matrix_len as usize) },
        unsafe { offset_slice::<u32>(label_doc_counts_ptr, label_count as usize) },
        unsafe { offset_slice::<u32>(label_token_totals_ptr, label_count as usize) },
        total_docs,
        smoothing,
        unsafe { offset_slice_mut::<f64>(out_scores_ptr, out_scores_len as usize) },
    );
}
