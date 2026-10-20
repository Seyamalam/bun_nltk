//! Handle-based WASM ABI for exact streaming metrics.
use crate::{error_state, exact_metrics_stream::ExactMetricsStream, CoreError};
use std::cell::RefCell;
use std::collections::HashMap;

thread_local! {
    static STREAMS: RefCell<(u32, HashMap<u32, ExactMetricsStream>)> = RefCell::new((0, HashMap::new()));
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_metrics_stream_new(
    order: u32,
    max_token_bytes: u32,
    max_tokens: u32,
    max_grams: u32,
) -> u32 {
    error_state::reset_error();
    let stream = ExactMetricsStream::new(
        order as usize,
        max_token_bytes as usize,
        max_tokens as usize,
        max_grams as usize,
    );
    match stream {
        Ok(stream) => STREAMS.with(|streams| {
            let mut state = streams.borrow_mut();
            let Some(handle) = state.0.checked_add(1) else {
                error_state::set_error(error_state::OUT_OF_MEMORY);
                return 0;
            };
            if state.1.try_reserve(1).is_err() {
                error_state::set_error(error_state::OUT_OF_MEMORY);
                return 0;
            }
            state.0 = handle;
            state.1.insert(handle, stream);
            handle
        }),
        Err(error) => {
            error_state::set_error(error.code());
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_metrics_stream_update(handle: u32, input_len: u32) {
    error_state::reset_error();
    let input = unsafe { crate::wasm_exports::input_slice(input_len as usize) };
    let result = STREAMS.with(
        |streams| match (streams.borrow_mut().1.get_mut(&handle), input) {
            (Some(stream), Some(input)) => stream.update(input),
            _ => Err(CoreError::InvalidN),
        },
    );
    if let Err(error) = result {
        error_state::set_error(error.code());
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_metrics_stream_finish(handle: u32, out_ptr: u32, out_len: u32) {
    error_state::reset_error();
    if out_ptr == 0 || out_len < 4 {
        error_state::set_error(error_state::INSUFFICIENT_CAPACITY);
        return;
    }
    let result = STREAMS.with(|streams| match streams.borrow_mut().1.get_mut(&handle) {
        Some(stream) => stream.finish(),
        None => Err(CoreError::InvalidN),
    });
    match result {
        Ok(metrics) => unsafe {
            crate::wasm_exports::offset_slice_mut::<u64>(out_ptr, 4).copy_from_slice(&metrics);
        },
        Err(error) => error_state::set_error(error.code()),
    }
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_metrics_stream_free(handle: u32) {
    STREAMS.with(|streams| {
        streams.borrow_mut().1.remove(&handle);
    });
}

#[no_mangle]
pub extern "C" fn bunnltk_wasm_metrics_stream_clear() {
    STREAMS.with(|streams| {
        streams.borrow_mut().1.clear();
    });
}
