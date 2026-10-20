use crate::categorical_tree::{CategoricalDecisionTree, TreeOptions};
use crate::error_state;
use crate::wasm_exports::{offset_slice, offset_slice_mut};
use std::cell::RefCell;
use std::collections::HashMap;

thread_local! {
    static MODELS: RefCell<(u32, HashMap<u32, CategoricalDecisionTree>)> = RefCell::new((0, HashMap::new()));
}

// Flat typed buffers preserve the feature-dictionary contract across the WASM ABI.
#[allow(clippy::too_many_arguments)]
#[no_mangle]
pub extern "C" fn bunnltk_wasm_decision_tree_train(
    pairs_ptr: u32,
    pairs_len: u32,
    offsets_ptr: u32,
    offsets_len: u32,
    labels_ptr: u32,
    labels_len: u32,
    label_count: u32,
    entropy_cutoff: f64,
    depth_cutoff: u32,
    support_cutoff: u32,
    binary: u32,
) -> u32 {
    error_state::reset_error();
    let model = unsafe {
        CategoricalDecisionTree::train(
            offset_slice(pairs_ptr, pairs_len as usize),
            offset_slice(offsets_ptr, offsets_len as usize),
            offset_slice(labels_ptr, labels_len as usize),
            label_count,
            TreeOptions {
                entropy_cutoff,
                depth_cutoff,
                support_cutoff,
                binary: binary != 0,
            },
        )
    };
    match model {
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
pub extern "C" fn bunnltk_wasm_decision_tree_classify(
    handle: u32,
    pairs_ptr: u32,
    pairs_len: u32,
) -> u32 {
    error_state::reset_error();
    MODELS.with(|models| {
        let state = models.borrow();
        let Some(model) = state.1.get(&handle) else {
            error_state::set_error(error_state::INVALID_N);
            return 0;
        };
        match model.classify(unsafe { offset_slice(pairs_ptr, pairs_len as usize) }) {
            Ok(label) => label,
            Err(error) => {
                error_state::set_error(error.code());
                0
            }
        }
    })
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_decision_tree_labels(
    handle: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    error_state::reset_error();
    MODELS.with(|models| {
        let state = models.borrow();
        let Some(model) = state.1.get(&handle) else {
            error_state::set_error(error_state::INVALID_N);
            return 0;
        };
        let labels = model.labels();
        let out = unsafe { offset_slice_mut(out_ptr, out_len as usize) };
        if out.len() < labels.len() {
            error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
            return 0;
        }
        out[..labels.len()].copy_from_slice(&labels);
        labels.len() as u32
    })
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_decision_tree_free(handle: u32) {
    error_state::reset_error();
    MODELS.with(|models| {
        models.borrow_mut().1.remove(&handle);
    });
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_decision_tree_clear() {
    error_state::reset_error();
    MODELS.with(|models| {
        models.borrow_mut().1.clear();
    });
}
