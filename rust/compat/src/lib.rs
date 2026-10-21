#[path = "../../src/porter_nltk.rs"]
pub mod porter;
#[path = "../../src/compat_unicode.rs"]
mod unicode;
#[path = "../../src/compat_ngrams.rs"]
pub mod ngrams;
#[path = "../../src/compat_word_tokenizer.rs"]
pub mod word_tokenizer;

use std::cell::RefCell;

thread_local! {
    static INPUT: RefCell<Vec<u32>> = const { RefCell::new(Vec::new()) };
    static OUTPUT: RefCell<Vec<u32>> = const { RefCell::new(Vec::new()) };
}

#[no_mangle]
pub extern "C" fn compat_input(length: u32) -> *mut u32 {
    INPUT.with(|input| {
        let mut input = input.borrow_mut();
        input.resize(length as usize, 0);
        input.as_mut_ptr()
    })
}

#[no_mangle]
pub extern "C" fn compat_output() -> *const u32 {
    OUTPUT.with(|output| output.borrow().as_ptr())
}

#[no_mangle]
pub extern "C" fn compat_porter(mode: u32, lowercase: u32) -> u32 {
    INPUT.with(|input| OUTPUT.with(|output| {
        let mut output = output.borrow_mut();
        *output = porter::stem(&input.borrow(), mode, lowercase != 0);
        output.len() as u32
    }))
}

/// Pairs of code-point offsets, with Python's exact Unicode word/space classes.
#[no_mangle]
pub extern "C" fn compat_wordpunct() -> u32 {
    INPUT.with(|input| OUTPUT.with(|output| {
        let input = input.borrow();
        let mut output = output.borrow_mut();
        output.clear();
        let mut i = 0;
        while i < input.len() {
            if unicode::is_space(input[i]) { i += 1; continue; }
            let start = i;
            let word = unicode::is_word(input[i]);
            i += 1;
            while i < input.len() && !unicode::is_space(input[i]) && unicode::is_word(input[i]) == word { i += 1; }
            output.extend([start as u32, i as u32]);
        }
        output.len() as u32
    }))
}

#[no_mangle]
pub extern "C" fn compat_word_tokenize() -> u32 {
    INPUT.with(|input| OUTPUT.with(|output| {
        let tokens = word_tokenizer::tokenize(&input.borrow());
        let mut output = output.borrow_mut();
        output.clear();
        for token in tokens {
            output.push(token.len() as u32);
            output.extend(token);
        }
        output.len() as u32
    }))
}
