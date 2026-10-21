//! Handle-based Unicode inference and stateless training/legacy/debug control ABI.
use crate::{
    error_state,
    punkt_unicode::{decode_model, PunktModel},
};
use serde::Deserialize;
use std::{cell::RefCell, collections::HashMap};

thread_local! {
    static MODELS: RefCell<(u32, HashMap<u32, PunktModel>)> = RefCell::new((0, HashMap::new()));
    static RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
enum Request {
    Train {
        chunks: Vec<String>,
        #[serde(default)]
        options: crate::punkt_training::TrainingOptions,
    },
    Legacy {
        units: Vec<u16>,
        model: crate::punkt_legacy::LegacyModel,
    },
    Debug {
        text: String,
        model: Vec<u8>,
    },
}

/// JSON control ABI for training, version-2 debug and frozen legacy inference.
#[no_mangle]
pub extern "C" fn bunnltk_wasm_punkt_request(input_len: u32) -> u32 {
    error_state::reset_error();
    let result = unsafe { crate::wasm_exports::input_slice(input_len as usize) }
        .ok_or_else(|| "invalid Punkt input".to_owned())
        .and_then(|bytes| serde_json::from_slice::<Request>(bytes).map_err(|e| e.to_string()))
        .and_then(|request| match request {
            Request::Train { chunks, options } => {
                serde_json::to_vec(&crate::punkt_training::train(&chunks, &options))
                    .map_err(|e| e.to_string())
            }
            Request::Legacy { units, model } => {
                serde_json::to_vec(&crate::punkt_legacy::spans(&units, model))
                    .map_err(|e| e.to_string())
            }
            Request::Debug { text, model } => decode_model(&model)
                .ok_or_else(|| "invalid Punkt debug model".to_owned())
                .and_then(|m| m.debug_decisions(&text))
                .and_then(|d| serde_json::to_vec(&d).map_err(|e| e.to_string())),
        });
    let bytes = result.unwrap_or_else(|message| {
        serde_json::to_vec(&serde_json::json!({ "error": message })).unwrap()
    });
    match u32::try_from(bytes.len()) {
        Ok(len) => {
            RESULT.with(|r| *r.borrow_mut() = bytes);
            len
        }
        Err(_) => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_punkt_copy(out_ptr: u32, out_len: u32) {
    error_state::reset_error();
    RESULT.with(|result| {
        let bytes = result.borrow();
        if out_ptr == 0 || (out_len as usize) < bytes.len() {
            error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
            return;
        }
        unsafe {
            crate::wasm_exports::offset_slice_mut::<u8>(out_ptr, bytes.len())
                .copy_from_slice(&bytes);
        }
    });
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_punkt_load(input_len: u32) -> u32 {
    error_state::reset_error();
    let model =
        unsafe { crate::wasm_exports::input_slice(input_len as usize) }.and_then(decode_model);
    let Some(model) = model else {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    };
    MODELS.with(|models| {
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
    })
}

/// capacity=0 counts spans; otherwise writes interleaved UTF-8 (start,end) u32s.
#[no_mangle]
pub extern "C" fn bunnltk_wasm_punkt_spans(
    handle: u32,
    input_len: u32,
    realign: u32,
    out_ptr: u32,
    capacity: u32,
) -> u32 {
    error_state::reset_error();
    let input = unsafe { crate::wasm_exports::input_slice(input_len as usize) }
        .and_then(|b| std::str::from_utf8(b).ok());
    let Some(text) = input else {
        error_state::set_error(error_state::INVALID_N);
        return 0;
    };
    MODELS.with(|models| {
        let state = models.borrow();
        let Some(model) = state.1.get(&handle) else {
            error_state::set_error(error_state::INVALID_N);
            return 0;
        };
        if realign > 1 {
            error_state::set_error(error_state::INVALID_N);
            return 0;
        }
        let spans = model.spans(text, realign != 0);
        if capacity != 0 {
            if out_ptr == 0 || !out_ptr.is_multiple_of(4) || (capacity as usize) < spans.len() {
                error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
                return spans.len() as u32;
            }
            let Some(len) = spans.len().checked_mul(2) else {
                error_state::set_error(error_state::INVALID_N);
                return 0;
            };
            let out = unsafe { crate::wasm_exports::offset_slice_mut::<u32>(out_ptr, len) };
            for (span, pair) in spans.iter().zip(out.chunks_exact_mut(2)) {
                pair[0] = span.0 as u32;
                pair[1] = span.1 as u32;
            }
        }
        spans.len() as u32
    })
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_punkt_free(handle: u32) {
    MODELS.with(|models| {
        models.borrow_mut().1.remove(&handle);
    });
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_punkt_clear() {
    RESULT.with(|r| *r.borrow_mut() = Vec::new());
    MODELS.with(|models| {
        models.borrow_mut().1.clear();
    });
}
