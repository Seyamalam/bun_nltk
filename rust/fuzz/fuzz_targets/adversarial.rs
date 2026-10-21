#![no_main]
#[path = "../../examples/adversarial/targets.rs"]
mod targets;

libfuzzer_sys::fuzz_target!(|data: &[u8]| {
    targets::exercise(data);
});
