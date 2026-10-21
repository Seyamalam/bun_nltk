//! Native C ABI exports (port of zig/src/ffi_exports.zig).
//!
//! Error protocol: every export resets the last-error code on entry and sets
//! it via `error_state::set_error` on failure. Callers read the code with
//! `bunnltk_last_error_code` (0 = ok).
//!
//! Buffer contracts below additionally require each nonempty range to lie within
//! a single allocation, with its byte size no greater than `isize::MAX`. Output
//! elements must be initialized before a call, even when the algorithm overwrites
//! them. Pointer-backed native handles are not validated against a registry:
//! fabricated, freed or wrong-kind handles are invalid, not recoverable errors.

use crate::ascii;
use crate::chunk;
use crate::cluster;
use crate::collocations;
use crate::cyk;
use crate::error_state;
use crate::freqdist;
use crate::hmm;
use crate::linear;
use crate::lm;
use crate::morphy;
use crate::naive_bayes;
use crate::ngrams;
use crate::normalize;
use crate::perceptron;
use crate::porter;
use crate::punkt;
use crate::stream_freqdist::StreamFreqDistBuilder;
use crate::tagger;
use crate::text_linear::NativeLinearTextResult;
use crate::token_ids;
use crate::wordnet::NativeWordNet;

/// Build a slice from a raw pointer, tolerating null / zero-length inputs
/// (constructing a slice from a null pointer is UB even for len 0).
unsafe fn const_slice<'a, T>(ptr: *const T, len: usize) -> &'a [T] {
    if ptr.is_null() || len == 0 {
        &[]
    } else {
        unsafe { std::slice::from_raw_parts(ptr, len) }
    }
}

unsafe fn mut_slice<'a, T>(ptr: *mut T, len: usize) -> &'a mut [T] {
    if ptr.is_null() || len == 0 {
        &mut []
    } else {
        unsafe { std::slice::from_raw_parts_mut(ptr, len) }
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_last_error_code() -> u32 {
    error_state::get_last_error_code()
}

fn stream_handle_from_ptr(ptr: *mut StreamFreqDistBuilder) -> u64 {
    ptr as u64
}

fn stream_ptr_from_handle(handle: u64) -> *mut StreamFreqDistBuilder {
    if handle == 0 {
        std::ptr::null_mut()
    } else {
        handle as *mut StreamFreqDistBuilder
    }
}

fn wordnet_handle_from_ptr(ptr: *mut NativeWordNet) -> u64 {
    ptr as u64
}

fn wordnet_ptr_from_handle(handle: u64) -> *mut NativeWordNet {
    if handle == 0 {
        std::ptr::null_mut()
    } else {
        handle as *mut NativeWordNet
    }
}

fn linear_text_ptr_from_handle(handle: u64) -> *mut NativeLinearTextResult {
    if handle == 0 {
        std::ptr::null_mut()
    } else {
        handle as *mut NativeLinearTextResult
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_tokens_ascii(input_ptr: *const u8, input_len: usize) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }
    ascii::token_count_ascii(const_slice(input_ptr, input_len))
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_tokens_ascii_scalar(
    input_ptr: *const u8,
    input_len: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }
    ascii::token_count_ascii_scalar(const_slice(input_ptr, input_len))
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes. `out_metrics_ptr`
/// must reference `out_metrics_len` aligned, exclusively writable u64 elements.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_compute_ascii_metrics(
    input_ptr: *const u8,
    input_len: usize,
    n: u32,
    out_metrics_ptr: *mut u64,
    out_metrics_len: usize,
) {
    error_state::reset_error();
    let out = mut_slice(out_metrics_ptr, out_metrics_len);
    if out.len() < 4 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }

    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return;
    }

    let input = const_slice(input_ptr, input_len);
    match freqdist::exact_ascii_metrics(input, n as usize) {
        Ok(metrics) => out[..4].copy_from_slice(&metrics),
        Err(err) => {
            error_state::set_error(err.code());
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_unique_tokens_ascii(
    input_ptr: *const u8,
    input_len: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }

    match freqdist::exact_ascii_metrics(const_slice(input_ptr, input_len), 1) {
        Ok(metrics) => metrics[1],
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_ngrams_ascii(
    input_ptr: *const u8,
    input_len: usize,
    n: u32,
) -> u64 {
    error_state::reset_error();
    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    let token_count = ascii::token_count_ascii(const_slice(input_ptr, input_len));
    let n_u64 = n as u64;
    if token_count < n_u64 {
        return 0;
    }
    token_count - n_u64 + 1
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_unique_ngrams_ascii(
    input_ptr: *const u8,
    input_len: usize,
    n: u32,
) -> u64 {
    error_state::reset_error();
    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match freqdist::exact_ascii_metrics(const_slice(input_ptr, input_len), n as usize) {
        Ok(metrics) => metrics[3],
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable elements of its type.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_token_freqdist_ascii(
    input_ptr: *const u8,
    input_len: usize,
    out_hashes_ptr: *mut u64,
    out_counts_ptr: *mut u64,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }

    let map = match freqdist::build_token_freq_map_ascii(const_slice(input_ptr, input_len)) {
        Ok(map) => map,
        Err(err) => {
            error_state::set_error(err.code());
            return 0;
        }
    };

    let unique = map.len() as u64;
    let out_hashes = mut_slice(out_hashes_ptr, capacity);
    let out_counts = mut_slice(out_counts_ptr, capacity);
    if let Err(err) = freqdist::fill_from_map(&map, out_hashes, out_counts) {
        error_state::set_error(err.code());
    }

    unique
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable elements of its type.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_ngram_freqdist_ascii(
    input_ptr: *const u8,
    input_len: usize,
    n: u32,
    out_hashes_ptr: *mut u64,
    out_counts_ptr: *mut u64,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    let map =
        match freqdist::build_ngram_freq_map_ascii(const_slice(input_ptr, input_len), n as usize) {
            Ok(map) => map,
            Err(err) => {
                error_state::set_error(err.code());
                return 0;
            }
        };

    let unique = map.len() as u64;
    let out_hashes = mut_slice(out_hashes_ptr, capacity);
    let out_counts = mut_slice(out_counts_ptr, capacity);
    if let Err(err) = freqdist::fill_from_map(&map, out_hashes, out_counts) {
        error_state::set_error(err.code());
    }

    unique
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable u32 elements.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_token_offsets_ascii(
    input_ptr: *const u8,
    input_len: usize,
    out_offsets_ptr: *mut u32,
    out_lengths_ptr: *mut u32,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }

    let out_offsets = mut_slice(out_offsets_ptr, capacity);
    let out_lengths = mut_slice(out_lengths_ptr, capacity);
    if out_offsets.len() != out_lengths.len() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }

    let total = ascii::fill_token_offsets_ascii(
        const_slice(input_ptr, input_len),
        out_offsets,
        out_lengths,
    );
    if total > capacity as u64 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }
    total
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_sentences_punkt_ascii(
    input_ptr: *const u8,
    input_len: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }
    punkt::count_sentence_offsets_ascii(const_slice(input_ptr, input_len))
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable u32 elements.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_sentence_offsets_punkt_ascii(
    input_ptr: *const u8,
    input_len: usize,
    out_offsets_ptr: *mut u32,
    out_lengths_ptr: *mut u32,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }
    let out_offsets = mut_slice(out_offsets_ptr, capacity);
    let out_lengths = mut_slice(out_lengths_ptr, capacity);
    if out_offsets.len() != out_lengths.len() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }

    let total = punkt::fill_sentence_offsets_ascii(
        const_slice(input_ptr, input_len),
        out_offsets,
        out_lengths,
    );
    if total > capacity as u64 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }
    total
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_normalized_tokens_ascii(
    input_ptr: *const u8,
    input_len: usize,
    remove_stopwords: u32,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }
    normalize::count_normalized_tokens_ascii(
        const_slice(input_ptr, input_len),
        remove_stopwords != 0,
    )
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_normalized_tokens_ascii_scalar(
    input_ptr: *const u8,
    input_len: usize,
    remove_stopwords: u32,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }
    normalize::count_normalized_tokens_ascii_scalar(
        const_slice(input_ptr, input_len),
        remove_stopwords != 0,
    )
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable u32 elements.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_normalized_token_offsets_ascii(
    input_ptr: *const u8,
    input_len: usize,
    remove_stopwords: u32,
    out_offsets_ptr: *mut u32,
    out_lengths_ptr: *mut u32,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }

    let out_offsets = mut_slice(out_offsets_ptr, capacity);
    let out_lengths = mut_slice(out_lengths_ptr, capacity);
    if out_offsets.len() != out_lengths.len() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }

    let total = normalize::fill_normalized_token_offsets_ascii(
        const_slice(input_ptr, input_len),
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
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable elements of its type.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_top_pmi_bigrams_ascii(
    input_ptr: *const u8,
    input_len: usize,
    top_k: u32,
    out_left_hashes_ptr: *mut u64,
    out_right_hashes_ptr: *mut u64,
    out_scores_ptr: *mut f64,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 || top_k == 0 {
        return 0;
    }

    if top_k as usize > capacity {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }

    match collocations::fill_top_pmi_bigrams_ascii(
        const_slice(input_ptr, input_len),
        2,
        top_k as usize,
        mut_slice(out_left_hashes_ptr, capacity),
        mut_slice(out_right_hashes_ptr, capacity),
        mut_slice(out_scores_ptr, capacity),
    ) {
        Ok(written) => written,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable elements of its type.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_top_pmi_bigrams_window_ascii(
    input_ptr: *const u8,
    input_len: usize,
    window_size: u32,
    top_k: u32,
    out_left_hashes_ptr: *mut u64,
    out_right_hashes_ptr: *mut u64,
    out_scores_ptr: *mut f64,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 || top_k == 0 {
        return 0;
    }
    if window_size < 2 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }

    if top_k as usize > capacity {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }

    match collocations::fill_top_pmi_bigrams_ascii(
        const_slice(input_ptr, input_len),
        window_size as usize,
        top_k as usize,
        mut_slice(out_left_hashes_ptr, capacity),
        mut_slice(out_right_hashes_ptr, capacity),
        mut_slice(out_scores_ptr, capacity),
    ) {
        Ok(written) => written,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_token_blob_bytes_ascii(
    input_ptr: *const u8,
    input_len: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }

    match token_ids::count_token_blob_bytes_ascii(const_slice(input_ptr, input_len)) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes. `out_blob_ptr` must
/// reference `blob_capacity` writable bytes; the other outputs must each reference
/// `vocab_capacity` aligned, exclusively writable elements of their types.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_token_freqdist_ids_ascii(
    input_ptr: *const u8,
    input_len: usize,
    out_blob_ptr: *mut u8,
    blob_capacity: usize,
    out_offsets_ptr: *mut u32,
    out_lengths_ptr: *mut u32,
    out_counts_ptr: *mut u64,
    vocab_capacity: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }

    let data = match token_ids::build_token_id_data_ascii(const_slice(input_ptr, input_len)) {
        Ok(data) => data,
        Err(err) => {
            error_state::set_error(err.code());
            return 0;
        }
    };

    if let Err(err) = token_ids::fill_token_freq_dist_ids_ascii(
        &data,
        mut_slice(out_blob_ptr, blob_capacity),
        mut_slice(out_offsets_ptr, vocab_capacity),
        mut_slice(out_lengths_ptr, vocab_capacity),
        mut_slice(out_counts_ptr, vocab_capacity),
    ) {
        error_state::set_error(err.code());
    }

    data.unique_count() as u64
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_unique_bigrams_window_ascii_ids(
    input_ptr: *const u8,
    input_len: usize,
    window_size: u32,
) -> u64 {
    error_state::reset_error();
    if window_size < 2 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match collocations::count_unique_bigrams_window_ids_ascii(
        const_slice(input_ptr, input_len),
        window_size as usize,
    ) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable elements of its type.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_bigram_window_stats_ascii_ids(
    input_ptr: *const u8,
    input_len: usize,
    window_size: u32,
    out_left_ids_ptr: *mut u32,
    out_right_ids_ptr: *mut u32,
    out_counts_ptr: *mut u64,
    out_pmis_ptr: *mut f64,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if window_size < 2 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match collocations::fill_bigram_window_stats_ids_ascii(
        const_slice(input_ptr, input_len),
        window_size as usize,
        mut_slice(out_left_ids_ptr, capacity),
        mut_slice(out_right_ids_ptr, capacity),
        mut_slice(out_counts_ptr, capacity),
        mut_slice(out_pmis_ptr, capacity),
    ) {
        Ok(written) => written,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_ngrams_ascii_ids(
    input_ptr: *const u8,
    input_len: usize,
    n: u32,
) -> u64 {
    error_state::reset_error();
    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match ngrams::count_ngrams_ids_ascii(const_slice(input_ptr, input_len), n as usize) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; `out_flat_ids_ptr`
/// must reference `out_ids_capacity` aligned, exclusively writable u32 elements.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_ngrams_ascii_ids(
    input_ptr: *const u8,
    input_len: usize,
    n: u32,
    out_flat_ids_ptr: *mut u32,
    out_ids_capacity: usize,
) -> u64 {
    error_state::reset_error();
    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match ngrams::fill_ngrams_ids_ascii(
        const_slice(input_ptr, input_len),
        n as usize,
        mut_slice(out_flat_ids_ptr, out_ids_capacity),
    ) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_everygrams_ascii_ids(
    input_ptr: *const u8,
    input_len: usize,
    min_len: u32,
    max_len: u32,
) -> u64 {
    error_state::reset_error();
    if min_len == 0 || max_len == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match ngrams::count_everygrams_ids_ascii(
        const_slice(input_ptr, input_len),
        min_len as usize,
        max_len as usize,
    ) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_everygram_id_values_ascii(
    input_ptr: *const u8,
    input_len: usize,
    min_len: u32,
    max_len: u32,
) -> u64 {
    error_state::reset_error();
    if min_len == 0 || max_len == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match ngrams::count_everygram_id_values_ascii(
        const_slice(input_ptr, input_len),
        min_len as usize,
        max_len as usize,
    ) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes. Each output must
/// reference its named capacity of aligned, exclusively writable u32 elements.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_everygrams_ascii_ids(
    input_ptr: *const u8,
    input_len: usize,
    min_len: u32,
    max_len: u32,
    out_lens_ptr: *mut u32,
    out_lens_capacity: usize,
    out_flat_ids_ptr: *mut u32,
    out_ids_capacity: usize,
) -> u64 {
    error_state::reset_error();
    if min_len == 0 || max_len == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match ngrams::fill_everygrams_ids_ascii(
        const_slice(input_ptr, input_len),
        min_len as usize,
        max_len as usize,
        mut_slice(out_lens_ptr, out_lens_capacity),
        mut_slice(out_flat_ids_ptr, out_ids_capacity),
    ) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_skipgrams_ascii_ids(
    input_ptr: *const u8,
    input_len: usize,
    n: u32,
    k: u32,
) -> u64 {
    error_state::reset_error();
    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match ngrams::count_skipgrams_ids_ascii(
        const_slice(input_ptr, input_len),
        n as usize,
        k as usize,
    ) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; `out_flat_ids_ptr`
/// must reference `out_ids_capacity` aligned, exclusively writable u32 elements.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_skipgrams_ascii_ids(
    input_ptr: *const u8,
    input_len: usize,
    n: u32,
    k: u32,
    out_flat_ids_ptr: *mut u32,
    out_ids_capacity: usize,
) -> u64 {
    error_state::reset_error();
    if n == 0 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    if input_len == 0 {
        return 0;
    }

    match ngrams::fill_skipgrams_ids_ascii(
        const_slice(input_ptr, input_len),
        n as usize,
        k as usize,
        mut_slice(out_flat_ids_ptr, out_ids_capacity),
    ) {
        Ok(count) => count,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_count_pos_tags_ascii(
    input_ptr: *const u8,
    input_len: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }
    tagger::count_pos_tags_ascii(const_slice(input_ptr, input_len))
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; each output pointer
/// must reference `capacity` aligned, exclusively writable elements of its type.
/// Buffers must remain live and not overlap; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_fill_pos_tags_ascii(
    input_ptr: *const u8,
    input_len: usize,
    out_offsets_ptr: *mut u32,
    out_lengths_ptr: *mut u32,
    out_tag_ids_ptr: *mut u16,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }

    let out_offsets = mut_slice(out_offsets_ptr, capacity);
    let out_lengths = mut_slice(out_lengths_ptr, capacity);
    let out_tag_ids = mut_slice(out_tag_ids_ptr, capacity);
    if out_offsets.len() != out_lengths.len() || out_offsets.len() != out_tag_ids.len() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }

    let total = tagger::fill_pos_tags_ascii(
        const_slice(input_ptr, input_len),
        out_offsets,
        out_lengths,
        out_tag_ids,
    );
    if total > capacity as u64 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
    }
    total
}

#[no_mangle]
/// # Safety
/// Each input pointer must reference its named length of aligned, initialized
/// elements; `out_tag_ids_ptr` must reference `out_tag_ids_len` aligned writable
/// u16 elements. Buffers must remain live; outputs must be exclusive and disjoint
/// from inputs. Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_perceptron_predict_batch(
    feature_ids_ptr: *const u32,
    feature_ids_len: usize,
    token_offsets_ptr: *const u32,
    token_offsets_len: usize,
    weights_ptr: *const f32,
    weights_len: usize,
    model_feature_count: u32,
    tag_count: u32,
    out_tag_ids_ptr: *mut u16,
    out_tag_ids_len: usize,
) {
    error_state::reset_error();
    if (feature_ids_ptr.is_null() && feature_ids_len != 0)
        || (token_offsets_ptr.is_null() && token_offsets_len != 0)
        || (weights_ptr.is_null() && weights_len != 0)
        || (out_tag_ids_ptr.is_null() && out_tag_ids_len != 0)
    {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }

    if let Err(err) = perceptron::predict_batch(
        const_slice(feature_ids_ptr, feature_ids_len),
        const_slice(token_offsets_ptr, token_offsets_len),
        const_slice(weights_ptr, weights_len),
        model_feature_count,
        tag_count,
        mut_slice(out_tag_ids_ptr, out_tag_ids_len),
    ) {
        error_state::set_error(err.code());
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_freqdist_stream_new() -> u64 {
    error_state::reset_error();
    let stream = Box::new(StreamFreqDistBuilder::create());
    stream_handle_from_ptr(Box::into_raw(stream))
}

#[no_mangle]
/// # Safety
/// `path_ptr` must reference `path_len` initialized bytes for this call.
/// A zero-length buffer may be null; the input must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_wordnet_open(path_ptr: *const u8, path_len: usize) -> u64 {
    error_state::reset_error();
    let Ok(path) = std::str::from_utf8(const_slice(path_ptr, path_len)) else {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    };
    match NativeWordNet::open(path) {
        Ok(model) => wordnet_handle_from_ptr(Box::into_raw(Box::new(model))),
        Err(_) => {
            error_state::set_error(error_state::INVALID_N);
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live WordNet handle from `bunnltk_wordnet_open`.
/// A nonzero handle must be freed exactly once, with no concurrent model access.
pub unsafe extern "C" fn bunnltk_wordnet_free(handle: u64) {
    error_state::reset_error();
    let model = wordnet_ptr_from_handle(handle);
    if model.is_null() {
        return;
    }
    unsafe { drop(Box::from_raw(model)) };
}

#[no_mangle]
/// # Safety
/// `handle` must be a live WordNet handle; do not access or free it concurrently.
/// `request_ptr` must reference `request_len` initialized bytes for this call.
/// A zero-length request may be null and must not be mutated concurrently.
pub unsafe extern "C" fn bunnltk_wordnet_query_count(
    handle: u64,
    request_ptr: *const u8,
    request_len: usize,
) -> u64 {
    error_state::reset_error();
    let model = wordnet_ptr_from_handle(handle);
    if model.is_null() {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    match (&mut *model).prepare_query(const_slice(request_ptr, request_len)) {
        Ok(bytes) => bytes as u64,
        Err(_) => {
            error_state::set_error(error_state::INVALID_N);
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be a live WordNet handle; do not access or free it concurrently.
/// `out_ptr` must reference `out_capacity` exclusively writable bytes for this
/// call, disjoint from the model. A zero-length output may be null.
pub unsafe extern "C" fn bunnltk_wordnet_query_fill(
    handle: u64,
    out_ptr: *mut u8,
    out_capacity: usize,
) -> u64 {
    error_state::reset_error();
    let model = wordnet_ptr_from_handle(handle);
    if model.is_null() {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    match (&*model).fill_query(mut_slice(out_ptr, out_capacity)) {
        Ok(bytes) => bytes as u64,
        Err(_) => {
            error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live handle from `bunnltk_freqdist_stream_new`.
/// A nonzero handle must be freed exactly once, with no concurrent stream access.
pub unsafe extern "C" fn bunnltk_freqdist_stream_free(handle: u64) {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }
    unsafe { drop(Box::from_raw(stream)) };
}

#[no_mangle]
/// # Safety
/// `handle` must be a live stream handle; do not access or free it concurrently.
/// `input_ptr` must reference `input_len` initialized bytes for this call,
/// disjoint from stream storage. A zero-length input may be null.
pub unsafe extern "C" fn bunnltk_freqdist_stream_update_ascii(
    handle: u64,
    input_ptr: *const u8,
    input_len: usize,
) {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }
    if input_len == 0 {
        return;
    }

    let stream = unsafe { &mut *stream };
    if let Err(err) = stream.update_ascii(const_slice(input_ptr, input_len)) {
        error_state::set_error(err.code());
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live stream handle; do not access or free it
/// concurrently. Freed or fabricated handles are invalid.
pub unsafe extern "C" fn bunnltk_freqdist_stream_flush(handle: u64) {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }

    let stream = unsafe { &mut *stream };
    if let Err(err) = stream.flush() {
        error_state::set_error(err.code());
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live stream handle; do not mutate or free it
/// concurrently. Freed or fabricated handles are invalid.
pub unsafe extern "C" fn bunnltk_freqdist_stream_token_unique(handle: u64) -> u64 {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let stream = unsafe { &*stream };
    stream.token_unique_count() as u64
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live stream handle; do not mutate or free it
/// concurrently. Freed or fabricated handles are invalid.
pub unsafe extern "C" fn bunnltk_freqdist_stream_bigram_unique(handle: u64) -> u64 {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let stream = unsafe { &*stream };
    stream.bigram_unique_count() as u64
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live stream handle; do not mutate or free it
/// concurrently. Freed or fabricated handles are invalid.
pub unsafe extern "C" fn bunnltk_freqdist_stream_conditional_unique(handle: u64) -> u64 {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let stream = unsafe { &*stream };
    stream.conditional_unique_count() as u64
}

#[no_mangle]
/// # Safety
/// `handle` must be a live stream handle; do not access or free it concurrently.
/// Each output must reference `capacity` aligned, exclusively writable elements.
/// Outputs must be disjoint from each other and stream storage, and remain live
/// for the call. Zero-length outputs may be null.
pub unsafe extern "C" fn bunnltk_freqdist_stream_fill_token(
    handle: u64,
    out_hashes_ptr: *mut u64,
    out_counts_ptr: *mut u64,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let stream = unsafe { &*stream };
    match stream.fill_token_freq(
        mut_slice(out_hashes_ptr, capacity),
        mut_slice(out_counts_ptr, capacity),
    ) {
        Ok(written) => written as u64,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be a live stream handle; do not access or free it concurrently.
/// Each output must reference `capacity` aligned, exclusively writable elements.
/// Outputs must be disjoint from each other and stream storage, and remain live
/// for the call. Zero-length outputs may be null.
pub unsafe extern "C" fn bunnltk_freqdist_stream_fill_bigram(
    handle: u64,
    out_left_hashes_ptr: *mut u64,
    out_right_hashes_ptr: *mut u64,
    out_counts_ptr: *mut u64,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let stream = unsafe { &*stream };
    match stream.fill_bigram_freq(
        mut_slice(out_left_hashes_ptr, capacity),
        mut_slice(out_right_hashes_ptr, capacity),
        mut_slice(out_counts_ptr, capacity),
    ) {
        Ok(written) => written as u64,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be a live stream handle; do not access or free it concurrently.
/// Each output must reference `capacity` aligned, exclusively writable elements.
/// Outputs must be disjoint from each other and stream storage, and remain live
/// for the call. Zero-length outputs may be null.
pub unsafe extern "C" fn bunnltk_freqdist_stream_fill_conditional(
    handle: u64,
    out_tag_ids_ptr: *mut u16,
    out_hashes_ptr: *mut u64,
    out_counts_ptr: *mut u64,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let stream = unsafe { &*stream };
    match stream.fill_conditional_freq(
        mut_slice(out_tag_ids_ptr, capacity),
        mut_slice(out_hashes_ptr, capacity),
        mut_slice(out_counts_ptr, capacity),
    ) {
        Ok(written) => written as u64,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live stream handle; do not mutate or free it
/// concurrently. Freed or fabricated handles are invalid.
pub unsafe extern "C" fn bunnltk_freqdist_stream_count_json_bytes(handle: u64) -> u64 {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let stream = unsafe { &*stream };
    match stream.count_json_bytes() {
        Ok(count) => count as u64,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be a live stream handle; do not access or free it concurrently.
/// `out_ptr` must reference `capacity` exclusively writable bytes, disjoint from
/// stream storage and live for this call. A zero-length output may be null.
pub unsafe extern "C" fn bunnltk_freqdist_stream_fill_json(
    handle: u64,
    out_ptr: *mut u8,
    capacity: usize,
) -> u64 {
    error_state::reset_error();
    let stream = stream_ptr_from_handle(handle);
    if stream.is_null() {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    let stream = unsafe { &*stream };
    match stream.fill_json(mut_slice(out_ptr, capacity)) {
        Ok(written) => written as u64,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; `out_ptr` must
/// reference `out_capacity` exclusively writable bytes. Buffers must remain live
/// and not overlap for this call; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_porter_stem_ascii(
    input_ptr: *const u8,
    input_len: usize,
    out_ptr: *mut u8,
    out_capacity: usize,
) -> u32 {
    error_state::reset_error();
    if input_len == 0 {
        return 0;
    }

    match porter::stem_porter_ascii(
        const_slice(input_ptr, input_len),
        mut_slice(out_ptr, out_capacity),
    ) {
        Ok(stem_len) => stem_len as u32,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `input_ptr` must reference `input_len` initialized bytes; `out_ptr` must
/// reference `out_capacity` exclusively writable bytes. Buffers must remain live
/// and not overlap for this call; zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_wordnet_morphy_ascii(
    input_ptr: *const u8,
    input_len: usize,
    pos: u32,
    out_ptr: *mut u8,
    out_capacity: usize,
) -> u32 {
    error_state::reset_error();
    if input_len == 0 || out_capacity == 0 {
        return 0;
    }
    let pos_tag = match pos {
        1 => morphy::WordNetPos::Noun,
        2 => morphy::WordNetPos::Verb,
        3 => morphy::WordNetPos::Adjective,
        4 => morphy::WordNetPos::Adverb,
        _ => morphy::WordNetPos::Any,
    };
    let written = morphy::morphy_ascii(
        const_slice(input_ptr, input_len),
        pos_tag,
        mut_slice(out_ptr, out_capacity),
    );
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
/// # Safety
/// Inputs must reference their named lengths of aligned, initialized elements;
/// `probe_context_lens_ptr` and `probe_words_ptr` each contain `probe_count` u32s.
/// `out_scores_ptr` must reference `out_scores_len` aligned writable f64s.
/// Buffers must remain live, with exclusive outputs disjoint from inputs.
/// Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_lm_eval_ids(
    token_ids_ptr: *const u32,
    token_ids_len: usize,
    sentence_offsets_ptr: *const u32,
    sentence_offsets_len: usize,
    order: u32,
    model_type: u32,
    gamma: f64,
    discount: f64,
    vocab_size: u32,
    probe_context_flat_ptr: *const u32,
    probe_context_flat_len: usize,
    probe_context_lens_ptr: *const u32,
    probe_words_ptr: *const u32,
    probe_count: usize,
    out_scores_ptr: *mut f64,
    out_scores_len: usize,
    perplexity_tokens_ptr: *const u32,
    perplexity_len: usize,
    prefix_tokens_ptr: *const u32,
    prefix_len: usize,
) -> f64 {
    error_state::reset_error();
    if order == 0 || order > lm::MAX_ORDER {
        error_state::set_error(error_state::INVALID_N);
        return f64::INFINITY;
    }
    if sentence_offsets_len == 0 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return f64::INFINITY;
    }

    let result = lm::try_eval_ids(
        const_slice(token_ids_ptr, token_ids_len),
        const_slice(sentence_offsets_ptr, sentence_offsets_len),
        order,
        lm_model_type_from_u32(model_type),
        gamma,
        discount,
        vocab_size,
        const_slice(probe_context_flat_ptr, probe_context_flat_len),
        const_slice(probe_context_lens_ptr, probe_count),
        const_slice(probe_words_ptr, probe_count),
        mut_slice(out_scores_ptr, out_scores_len),
        const_slice(perplexity_tokens_ptr, perplexity_len),
        const_slice(prefix_tokens_ptr, prefix_len),
    );
    match result {
        Ok(value) => value,
        Err(error) => { error_state::set_error(error.code()); f64::INFINITY }
    }
}

#[no_mangle]
/// # Safety
/// Token tags contain `token_count` u16s. Atom arrays contain `atom_count`
/// elements, except the flat allowed array (`atom_allowed_flat_len` u16s).
/// Rule arrays contain `rule_count` elements; each output has `out_capacity`
/// writable elements. All buffers must be aligned and live, inputs initialized,
/// outputs exclusive and disjoint. Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_chunk_iob_ids(
    token_tag_ids_ptr: *const u16,
    token_count: usize,
    atom_allowed_offsets_ptr: *const u32,
    atom_allowed_lengths_ptr: *const u32,
    atom_allowed_flat_ptr: *const u16,
    atom_allowed_flat_len: usize,
    atom_mins_ptr: *const u8,
    atom_maxs_ptr: *const u8,
    atom_count: usize,
    rule_atom_offsets_ptr: *const u32,
    rule_atom_counts_ptr: *const u32,
    rule_label_ids_ptr: *const u16,
    rule_count: usize,
    out_label_ids_ptr: *mut u16,
    out_begin_ptr: *mut u8,
    out_capacity: usize,
) -> u64 {
    error_state::reset_error();
    if token_count == 0 {
        return 0;
    }
    if out_capacity < token_count {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return 0;
    }
    if rule_count == 0 || atom_count == 0 {
        let out_label_ids = mut_slice(out_label_ids_ptr, out_capacity);
        let out_begins = mut_slice(out_begin_ptr, out_capacity);
        for i in 0..token_count {
            out_label_ids[i] = u16::MAX;
            out_begins[i] = 0;
        }
        return token_count as u64;
    }

    let written = chunk::fill_chunk_iob_ids(
        const_slice(token_tag_ids_ptr, token_count),
        const_slice(atom_allowed_offsets_ptr, atom_count),
        const_slice(atom_allowed_lengths_ptr, atom_count),
        const_slice(atom_allowed_flat_ptr, atom_allowed_flat_len),
        const_slice(atom_mins_ptr, atom_count),
        const_slice(atom_maxs_ptr, atom_count),
        const_slice(rule_atom_offsets_ptr, rule_count),
        const_slice(rule_atom_counts_ptr, rule_count),
        const_slice(rule_label_ids_ptr, rule_count),
        mut_slice(out_label_ids_ptr, out_capacity),
        mut_slice(out_begin_ptr, out_capacity),
    );
    if written == 0 && token_count > 0 {
        error_state::set_error(error_state::INVALID_N);
    }
    written
}

#[no_mangle]
/// # Safety
/// `token_bits_ptr` contains `token_count` initialized u64s; binary and unary
/// arrays contain `binary_count` and `unary_count` initialized u16s respectively.
/// All buffers must remain aligned, live and immutable for this call.
/// Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_cyk_recognize_ids(
    token_bits_ptr: *const u64,
    token_count: usize,
    binary_left_ptr: *const u16,
    binary_right_ptr: *const u16,
    binary_parent_ptr: *const u16,
    binary_count: usize,
    unary_child_ptr: *const u16,
    unary_parent_ptr: *const u16,
    unary_count: usize,
    start_symbol: u16,
) -> u32 {
    error_state::reset_error();
    if token_count == 0 {
        return 0;
    }
    if start_symbol >= 64 {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    let ok = cyk::cyk_recognize(
        const_slice(token_bits_ptr, token_count),
        const_slice(binary_left_ptr, binary_count),
        const_slice(binary_right_ptr, binary_count),
        const_slice(binary_parent_ptr, binary_count),
        const_slice(unary_child_ptr, unary_count),
        const_slice(unary_parent_ptr, unary_count),
        start_symbol,
    );
    if ok {
        1
    } else {
        0
    }
}

#[no_mangle]
/// # Safety
/// Document and matrix inputs contain their named counts/lengths of initialized
/// u32s; each label input contains `label_count` u32s. `out_scores_ptr` contains
/// `out_scores_len` writable f64s. Buffers must remain aligned and live; output
/// is exclusive and disjoint from inputs. Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_naive_bayes_log_scores_ids(
    doc_token_ids_ptr: *const u32,
    doc_token_count: usize,
    vocab_size: u32,
    token_counts_matrix_ptr: *const u32,
    token_counts_matrix_len: usize,
    label_doc_counts_ptr: *const u32,
    label_token_totals_ptr: *const u32,
    label_count: usize,
    total_docs: u32,
    smoothing: f64,
    out_scores_ptr: *mut f64,
    out_scores_len: usize,
) {
    error_state::reset_error();
    if label_count == 0 || out_scores_len < label_count {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }
    naive_bayes::log_scores(
        const_slice(doc_token_ids_ptr, doc_token_count),
        vocab_size,
        const_slice(token_counts_matrix_ptr, token_counts_matrix_len),
        const_slice(label_doc_counts_ptr, label_count),
        const_slice(label_token_totals_ptr, label_count),
        total_docs,
        smoothing,
        mut_slice(out_scores_ptr, out_scores_len),
    );
}

#[no_mangle]
/// # Safety
/// Each input pointer must reference its named length of aligned, initialized
/// elements. `out_scores_ptr` must reference `out_scores_len` aligned writable
/// f64s. All buffers must remain live, with exclusive output disjoint from inputs.
/// Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_linear_scores_sparse_ids(
    doc_offsets_ptr: *const u32,
    doc_offsets_len: usize,
    feature_ids_ptr: *const u32,
    feature_ids_len: usize,
    feature_values_ptr: *const f64,
    feature_values_len: usize,
    class_count: u32,
    feature_count: u32,
    weights_ptr: *const f64,
    weights_len: usize,
    bias_ptr: *const f64,
    bias_len: usize,
    out_scores_ptr: *mut f64,
    out_scores_len: usize,
) {
    error_state::reset_error();
    if doc_offsets_len < 1 || class_count == 0 {
        error_state::set_error(error_state::INVALID_N);
        return;
    }

    if let Err(err) = linear::scores_sparse_ids(
        const_slice(doc_offsets_ptr, doc_offsets_len),
        const_slice(feature_ids_ptr, feature_ids_len),
        const_slice(feature_values_ptr, feature_values_len),
        class_count,
        feature_count,
        const_slice(weights_ptr, weights_len),
        const_slice(bias_ptr, bias_len),
        mut_slice(out_scores_ptr, out_scores_len),
    ) {
        error_state::set_error(err.code());
    }
}

#[no_mangle]
/// # Safety
/// Each input pointer must reference its named length of aligned, initialized
/// elements. Outputs must reference their named lengths of aligned, initialized
/// f64s (training reads and updates them). Buffers must remain live; outputs must
/// be exclusive and disjoint from each other and inputs. Zero lengths allow null.
pub unsafe extern "C" fn bunnltk_linear_train_sparse_ids(
    doc_offsets_ptr: *const u32,
    doc_offsets_len: usize,
    feature_ids_ptr: *const u32,
    feature_ids_len: usize,
    feature_values_ptr: *const f64,
    feature_values_len: usize,
    label_ids_ptr: *const u32,
    label_ids_len: usize,
    class_count: u32,
    feature_count: u32,
    algorithm: u32,
    epochs: u32,
    learning_rate: f64,
    l2: f64,
    margin: f64,
    out_weights_ptr: *mut f64,
    out_weights_len: usize,
    out_bias_ptr: *mut f64,
    out_bias_len: usize,
) {
    error_state::reset_error();
    let algorithm = match algorithm {
        0 => linear::TrainingAlgorithm::Logistic,
        1 => linear::TrainingAlgorithm::LinearSvm,
        _ => {
            error_state::set_error(error_state::INVALID_N);
            return;
        }
    };
    if let Err(err) = linear::train_sparse_ids(
        const_slice(doc_offsets_ptr, doc_offsets_len),
        const_slice(feature_ids_ptr, feature_ids_len),
        const_slice(feature_values_ptr, feature_values_len),
        const_slice(label_ids_ptr, label_ids_len),
        class_count,
        feature_count,
        algorithm,
        epochs,
        learning_rate,
        l2,
        margin,
        mut_slice(out_weights_ptr, out_weights_len),
        mut_slice(out_bias_ptr, out_bias_len),
    ) {
        error_state::set_error(err.code());
    }
}

#[no_mangle]
/// # Safety
/// Each input pointer must reference its named length of initialized elements
/// with the type's alignment. Inputs must remain live and immutable for this call.
/// Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_linear_text_train(
    text_blob_ptr: *const u8,
    text_blob_len: usize,
    text_offsets_ptr: *const u32,
    text_offsets_len: usize,
    label_ids_ptr: *const u32,
    label_ids_len: usize,
    class_count: u32,
    ngram_min: u32,
    ngram_max: u32,
    binary: u32,
    max_features: u32,
    algorithm: u32,
    epochs: u32,
    learning_rate: f64,
    l2: f64,
    margin: f64,
) -> u64 {
    error_state::reset_error();
    let algorithm = match algorithm {
        0 => linear::TrainingAlgorithm::Logistic,
        1 => linear::TrainingAlgorithm::LinearSvm,
        _ => {
            error_state::set_error(error_state::INVALID_N);
            return 0;
        }
    };
    match crate::text_linear::train(
        const_slice(text_blob_ptr, text_blob_len),
        const_slice(text_offsets_ptr, text_offsets_len),
        const_slice(label_ids_ptr, label_ids_len),
        class_count,
        ngram_min,
        ngram_max,
        binary != 0,
        max_features,
        algorithm,
        epochs,
        learning_rate,
        l2,
        margin,
    ) {
        Ok(result) => Box::into_raw(Box::new(result)) as u64,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live result from `bunnltk_linear_text_train`.
/// Do not free it concurrently. Freed or fabricated handles are invalid.
pub unsafe extern "C" fn bunnltk_linear_text_result_len(handle: u64) -> u64 {
    error_state::reset_error();
    let result = linear_text_ptr_from_handle(handle);
    if result.is_null() {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    unsafe { (&*result).len() as u64 }
}

#[no_mangle]
/// # Safety
/// `handle` must be a live result handle; do not access or free it concurrently.
/// `out_ptr` must reference `out_len` exclusively writable bytes, disjoint from
/// result storage and live for this call. A zero-length output may be null.
pub unsafe extern "C" fn bunnltk_linear_text_result_fill(
    handle: u64,
    out_ptr: *mut u8,
    out_len: usize,
) -> u64 {
    error_state::reset_error();
    let result = linear_text_ptr_from_handle(handle);
    if result.is_null() {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    }
    match (&*result).copy_to(mut_slice(out_ptr, out_len)) {
        Ok(written) => written as u64,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[no_mangle]
/// # Safety
/// `handle` must be zero or a live result from `bunnltk_linear_text_train`.
/// A nonzero handle must be freed exactly once, with no concurrent result access.
pub unsafe extern "C" fn bunnltk_linear_text_result_free(handle: u64) {
    error_state::reset_error();
    let result = linear_text_ptr_from_handle(handle);
    if !result.is_null() {
        unsafe { drop(Box::from_raw(result)) };
    }
}

#[no_mangle]
/// # Safety
/// Each input pointer must reference its named length of aligned, initialized
/// elements. `out_states_ptr` contains `out_states_len` aligned writable u32s.
/// Buffers must remain live, with exclusive output disjoint from inputs.
/// Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_hmm_viterbi_ids(
    symbol_ids_ptr: *const u32,
    symbol_ids_len: usize,
    state_count: u32,
    symbol_count: u32,
    priors_ptr: *const f32,
    priors_len: usize,
    transitions_ptr: *const f32,
    transitions_len: usize,
    outputs_ptr: *const f32,
    outputs_len: usize,
    out_states_ptr: *mut u32,
    out_states_len: usize,
) {
    error_state::reset_error();
    if let Err(err) = hmm::viterbi_ids(
        const_slice(symbol_ids_ptr, symbol_ids_len),
        state_count,
        symbol_count,
        const_slice(priors_ptr, priors_len),
        const_slice(transitions_ptr, transitions_len),
        const_slice(outputs_ptr, outputs_len),
        mut_slice(out_states_ptr, out_states_len),
    ) {
        error_state::set_error(err.code());
    }
}

#[no_mangle]
/// # Safety
/// `vectors_ptr` contains `vectors_len` initialized f64s; `means_ptr` contains
/// `means_len` initialized writable f64s (read as initial means, then updated).
/// Buffers must remain aligned and live, with exclusive means disjoint from input.
/// Zero-length buffers may be null.
pub unsafe extern "C" fn bunnltk_kmeans_fit_euclidean(
    vectors_ptr: *const f64,
    vectors_len: usize,
    point_count: u32,
    dimensions: u32,
    cluster_count: u32,
    convergence: f64,
    avoid_empty: u32,
    max_iterations: u32,
    means_ptr: *mut f64,
    means_len: usize,
) -> u32 {
    error_state::reset_error();
    match cluster::kmeans_fit_euclidean(
        const_slice(vectors_ptr, vectors_len),
        point_count,
        dimensions,
        cluster_count,
        convergence,
        avoid_empty != 0,
        max_iterations,
        mut_slice(means_ptr, means_len),
    ) {
        Ok(iterations) => iterations,
        Err(err) => {
            error_state::set_error(err.code());
            0
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn ffi_error_behavior() {
        let input = b"abc";
        unsafe {
            super::bunnltk_count_unique_ngrams_ascii(input.as_ptr(), input.len(), 0);
        }
        assert_eq!(
            super::bunnltk_last_error_code(),
            crate::error_state::INVALID_N
        );
    }
}
