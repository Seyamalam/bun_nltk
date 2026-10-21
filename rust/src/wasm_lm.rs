use crate::error_state;
use crate::lm::{ModelType, Options};
use crate::lm_model::{LanguageModel, Padding};
use crate::wasm_exports::{offset_slice, offset_slice_mut};
use std::cell::RefCell;
use std::collections::HashMap;

thread_local! {
    static MODELS: RefCell<(u32, HashMap<u32, LanguageModel>)> = RefCell::new((0, HashMap::new()));
}

// config = [order, model, left, right, start, end, unknown], params = [gamma, discount, alpha].
#[no_mangle]
pub extern "C" fn bunnltk_wasm_lm_train(
    tokens_ptr: u32,
    tokens_len: u32,
    offsets_ptr: u32,
    offsets_len: u32,
    config_ptr: u32,
    params_ptr: u32,
) -> u32 {
    error_state::reset_error();
    let config = unsafe { offset_slice::<u32>(config_ptr, 7) };
    let params = unsafe { offset_slice::<f64>(params_ptr, 3) };
    let result = ModelType::from_u32(config[1]).and_then(|model| {
        LanguageModel::train(
            unsafe { offset_slice(tokens_ptr, tokens_len as usize) },
            unsafe { offset_slice(offsets_ptr, offsets_len as usize) },
            Options {
                order: config[0],
                model,
                gamma: params[0],
                discount: params[1],
                alpha: params[2],
                vocab_size: 0,
            },
            Padding {
                left: config[2] != 0,
                right: config[3] != 0,
                start: config[4],
                end: config[5],
            },
            config[6],
        )
    });
    match result {
        Ok(model) => MODELS.with(|models| {
            let mut state = models.borrow_mut();
            let Some(handle) = state.0.checked_add(1) else {
                error_state::set_error(error_state::OUT_OF_MEMORY);
                return 0;
            };
            if state.1.try_reserve(1).is_err() {
                error_state::set_error(error_state::OUT_OF_MEMORY);
                return 0;
            }
            state.0 = handle;
            state.1.insert(handle, model);
            handle
        }),
        Err(error) => {
            error_state::set_error(error.code());
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_lm_vocabulary(handle: u32, out_ptr: u32, capacity: u32) -> u32 {
    error_state::reset_error();
    MODELS.with(|models| {
        let state = models.borrow();
        let Some(model) = state.1.get(&handle) else {
            error_state::set_error(error_state::INVALID_N);
            return 0;
        };
        if capacity > 0 {
            if capacity < model.vocabulary.len() as u32 {
                error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
                return 0;
            }
            unsafe { offset_slice_mut::<u32>(out_ptr, model.vocabulary.len()) }
                .copy_from_slice(&model.vocabulary);
        }
        model.vocabulary.len() as u32
    })
}

#[allow(clippy::too_many_arguments)]
#[no_mangle]
pub extern "C" fn bunnltk_wasm_lm_evaluate(
    handle: u32,
    flat_ptr: u32,
    flat_len: u32,
    lens_ptr: u32,
    words_ptr: u32,
    probe_count: u32,
    scores_ptr: u32,
    tokens_ptr: u32,
    tokens_len: u32,
    perplexity: u32,
) -> f64 {
    error_state::reset_error();
    MODELS.with(|models| {
        let state = models.borrow();
        let Some(model) = state.1.get(&handle) else {
            error_state::set_error(error_state::INVALID_N);
            return f64::INFINITY;
        };
        let result = model.evaluate(
            unsafe { offset_slice(flat_ptr, flat_len as usize) },
            unsafe { offset_slice(lens_ptr, probe_count as usize) },
            unsafe { offset_slice(words_ptr, probe_count as usize) },
            unsafe { offset_slice_mut(scores_ptr, probe_count as usize) },
            unsafe { offset_slice(tokens_ptr, tokens_len as usize) },
            perplexity & 1 != 0,
        );
        match result {
            Ok(value) => {
                if perplexity & 2 != 0 {
                    for score in
                        unsafe { offset_slice_mut::<f64>(scores_ptr, probe_count as usize) }
                    {
                        *score = crate::lm::safe_prob(*score).log2();
                    }
                }
                value
            }
            Err(error) => {
                error_state::set_error(error.code());
                f64::INFINITY
            }
        }
    })
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_lm_free(handle: u32) {
    error_state::reset_error();
    MODELS.with(|models| {
        models.borrow_mut().1.remove(&handle);
    });
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_lm_clear() {
    MODELS.with(|models| {
        models.borrow_mut().1.clear();
    });
}
