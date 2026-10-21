//! Dedicated JSON ABI for Unicode tokenizer strings and scalar-index spans.
//! The output is retained until release, avoiding a second algorithm execution
//! merely to discover the encoded result size.
use crate::error_state;
use crate::tokenizers;
use crate::wasm_exports::offset_slice;
use std::cell::RefCell;

thread_local! {
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_tokenizer_run(input_ptr: u32, input_len: u32) -> u32 {
    error_state::reset_error();
    let result = serde_json::from_slice::<tokenizers::Request>(unsafe {
        offset_slice::<u8>(input_ptr, input_len as usize)
    })
    .map_err(|error| error.to_string())
    .and_then(tokenizers::execute);
    OUTPUT.with(|output| {
        let bytes = match result {
            Ok(response) => serde_json::to_vec(&response),
            Err(error) => {
                error_state::set_error(error_state::INVALID_N);
                serde_json::to_vec(&error)
            }
        };
        match bytes {
            Ok(bytes) => {
                let len = bytes.len() as u32;
                *output.borrow_mut() = bytes;
                len
            }
            Err(_) => {
                error_state::set_error(error_state::OUT_OF_MEMORY);
                0
            }
        }
    })
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_tokenizer_output_ptr() -> u32 {
    OUTPUT.with(|output| output.borrow().as_ptr() as u32)
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_tokenizer_release() {
    OUTPUT.with(|output| *output.borrow_mut() = Vec::new());
}
