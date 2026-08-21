pub const OK: u32 = 0;
pub const INVALID_N: u32 = 1;
pub const OUT_OF_MEMORY: u32 = 2;
pub const INSUFFICIENT_CAPACITY: u32 = 3;

use std::sync::atomic::{AtomicU32, Ordering};

static LAST_ERROR_CODE: AtomicU32 = AtomicU32::new(OK);

pub fn set_error(code: u32) {
    LAST_ERROR_CODE.store(code, Ordering::Relaxed);
}

pub fn reset_error() {
    set_error(OK);
}

pub fn get_last_error_code() -> u32 {
    LAST_ERROR_CODE.load(Ordering::Relaxed)
}
