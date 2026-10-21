//! Stateless request/copy/clear ABI for legacy text classifier snapshots.
use crate::{error_state, text_classifiers, wasm_exports};
use std::cell::RefCell;

thread_local! { static RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; }

#[no_mangle]
pub extern "C" fn bunnltk_wasm_text_classifiers(input_len: u32) -> u32 {
    error_state::reset_error();
    let input = unsafe { wasm_exports::input_slice(input_len as usize) };
    let result = match input {
        Some(input) => text_classifiers::execute(input),
        None => Err("invalid text classifier input".into()),
    };
    let bytes = result.unwrap_or_else(|message| {
        serde_json::to_vec(&serde_json::json!({ "error": message })).unwrap()
    });
    match u32::try_from(bytes.len()) {
        Ok(len) => {
            RESULT.with(|result| *result.borrow_mut() = bytes);
            len
        }
        Err(_) => {
            error_state::set_error(error_state::OUT_OF_MEMORY);
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_text_classifiers_copy(out_ptr: u32, out_len: u32) {
    error_state::reset_error();
    RESULT.with(|result| {
        let bytes = result.borrow();
        if out_ptr == 0 || (out_len as usize) < bytes.len() {
            error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
            return;
        }
        unsafe {
            wasm_exports::offset_slice_mut::<u8>(out_ptr, bytes.len()).copy_from_slice(&bytes);
        }
    });
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_text_classifiers_clear() {
    RESULT.with(|result| *result.borrow_mut() = Vec::new());
}
