use std::cell::RefCell;
use std::collections::{HashMap, VecDeque};

pub const LEFT: u32 = u32::MAX;
pub const RIGHT: u32 = u32::MAX - 1;
struct Window { n: usize, values: VecDeque<u32>, right: usize, initial: bool }
thread_local! {
    static WINDOWS: RefCell<(u32, HashMap<u32, Window>)> = RefCell::new((0, HashMap::new()));
}
#[no_mangle]
pub extern "C" fn compat_ngram_new(n: u32, left: u32, right: u32) -> u32 {
    WINDOWS.with(|windows| {
        let mut state = windows.borrow_mut();
        let Some(id) = state.0.checked_add(1) else { return 0; }; state.0 = id;
        state.1.insert(id, Window { n: n as usize, values: std::iter::repeat_n(LEFT, if left != 0 { n.saturating_sub(1) as usize } else { 0 }).collect(),
            right: if right != 0 { n.saturating_sub(1) as usize } else { 0 }, initial: n == 0 });
        id
    })
}
/// 0: needs another input; 1: output window available; 2: exhausted.
#[no_mangle]
pub extern "C" fn compat_ngram_next(id: u32, value: u32, end: u32) -> u32 {
    WINDOWS.with(|windows| {
        let mut state = windows.borrow_mut();
        let Some(window) = state.1.get_mut(&id) else { return 2; };
        if end == 2 {
            if !window.initial { return 0; } window.initial = false;
        } else {
            let value = if end != 0 {
                if window.right == 0 { return 2; }
                window.right -= 1; RIGHT
            } else { value };
            if window.n > 0 {
                if window.values.len() == window.n { window.values.pop_front(); }
                window.values.push_back(value);
            }
            if window.values.len() < window.n { return 0; }
        }
        super::OUTPUT.with(|out| { *out.borrow_mut() = window.values.iter().copied().collect(); });
        1
    })
}
#[no_mangle]
pub extern "C" fn compat_ngram_free(id: u32) {
    WINDOWS.with(|windows| { windows.borrow_mut().1.remove(&id); });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn zero_and_padding() {
        let id = compat_ngram_new(0,1,1);
        assert_eq!(compat_ngram_next(id,0,2),1); assert_eq!(compat_ngram_next(id,0,0),1);
        assert_eq!(compat_ngram_next(id,0,1),2); compat_ngram_free(id);
        let id = compat_ngram_new(3,1,1);
        assert_eq!(compat_ngram_next(id,7,0),1); assert_eq!(compat_ngram_next(id,0,1),1);
        assert_eq!(compat_ngram_next(id,0,1),1); assert_eq!(compat_ngram_next(id,0,1),2); compat_ngram_free(id);
    }
}
