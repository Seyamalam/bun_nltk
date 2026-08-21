use crate::ascii;
use crate::CoreError;
use crate::CoreResult;

fn is_consonant(word: &[u8], i: usize) -> bool {
    match word[i] {
        b'a' | b'e' | b'i' | b'o' | b'u' => false,
        b'y' => {
            if i == 0 {
                true
            } else {
                !is_consonant(word, i - 1)
            }
        }
        _ => true,
    }
}

fn measure(word: &[u8], len: usize) -> usize {
    let mut m: usize = 0;
    let mut i: usize = 0;

    while i < len {
        while i < len && is_consonant(word, i) {
            i += 1;
        }
        if i >= len {
            break;
        }
        while i < len && !is_consonant(word, i) {
            i += 1;
        }
        if i >= len {
            break;
        }
        m += 1;
    }

    m
}

fn contains_vowel(word: &[u8], len: usize) -> bool {
    for i in 0..len {
        if !is_consonant(word, i) {
            return true;
        }
    }
    false
}

fn ends_with(word: &[u8], len: usize, suffix: &[u8]) -> bool {
    if len < suffix.len() {
        return false;
    }
    &word[len - suffix.len()..len] == suffix
}

fn is_double_consonant(word: &[u8], len: usize) -> bool {
    if len < 2 {
        return false;
    }
    if word[len - 1] != word[len - 2] {
        return false;
    }
    is_consonant(word, len - 1)
}

fn is_cvc(word: &[u8], len: usize) -> bool {
    if len < 3 {
        return false;
    }

    let c1 = is_consonant(word, len - 1);
    let v = !is_consonant(word, len - 2);
    let c0 = is_consonant(word, len - 3);
    if !(c0 && v && c1) {
        return false;
    }

    let ch = word[len - 1];
    !(ch == b'w' || ch == b'x' || ch == b'y')
}

fn append_e(word: &mut [u8], len: &mut usize) {
    word[*len] = b'e';
    *len += 1;
}

fn replace_suffix(word: &mut [u8], len: &mut usize, suffix_len: usize, repl: &[u8]) {
    let stem_len = *len - suffix_len;
    word[stem_len..stem_len + repl.len()].copy_from_slice(repl);
    *len = stem_len + repl.len();
}

fn step1a(word: &mut [u8], len: &mut usize) {
    if ends_with(word, *len, b"sses") {
        *len -= 2;
    } else if ends_with(word, *len, b"ies") {
        *len -= 2;
    } else if ends_with(word, *len, b"ss") {
        return;
    } else if ends_with(word, *len, b"s") {
        *len -= 1;
    }
}

fn step1b_post(word: &mut [u8], len: &mut usize) {
    if ends_with(word, *len, b"at") || ends_with(word, *len, b"bl") || ends_with(word, *len, b"iz") {
        append_e(word, len);
    } else if is_double_consonant(word, *len) {
        let last = word[*len - 1];
        if !(last == b'l' || last == b's' || last == b'z') {
            *len -= 1;
        }
    } else if measure(word, *len) == 1 && is_cvc(word, *len) {
        append_e(word, len);
    }
}

fn step1b(word: &mut [u8], len: &mut usize) {
    if ends_with(word, *len, b"eed") {
        let stem = *len - 3;
        if measure(word, stem) > 0 {
            *len -= 1;
        }
        return;
    }

    if ends_with(word, *len, b"ed") {
        let stem = *len - 2;
        if contains_vowel(word, stem) {
            *len = stem;
            step1b_post(word, len);
        }
        return;
    }

    if ends_with(word, *len, b"ing") {
        let stem = *len - 3;
        if contains_vowel(word, stem) {
            *len = stem;
            step1b_post(word, len);
        }
    }
}

fn step1c(word: &mut [u8], len: &mut usize) {
    if *len == 0 {
        return;
    }
    if ends_with(word, *len, b"y") && contains_vowel(word, *len - 1) {
        word[*len - 1] = b'i';
    }
}

struct Rule {
    suffix: &'static [u8],
    replacement: &'static [u8],
}

fn apply_rules_with_min_measure(word: &mut [u8], len: &mut usize, rules: &[Rule], min_measure: usize) {
    for rule in rules {
        if !ends_with(word, *len, rule.suffix) {
            continue;
        }
        let stem = *len - rule.suffix.len();
        if measure(word, stem) > min_measure {
            replace_suffix(word, len, rule.suffix.len(), rule.replacement);
        }
        return;
    }
}

fn step2(word: &mut [u8], len: &mut usize) {
    const RULES: [Rule; 21] = [
        Rule { suffix: b"ational", replacement: b"ate" },
        Rule { suffix: b"tional", replacement: b"tion" },
        Rule { suffix: b"enci", replacement: b"ence" },
        Rule { suffix: b"anci", replacement: b"ance" },
        Rule { suffix: b"izer", replacement: b"ize" },
        Rule { suffix: b"abli", replacement: b"able" },
        Rule { suffix: b"alli", replacement: b"al" },
        Rule { suffix: b"entli", replacement: b"ent" },
        Rule { suffix: b"eli", replacement: b"e" },
        Rule { suffix: b"ousli", replacement: b"ous" },
        Rule { suffix: b"ization", replacement: b"ize" },
        Rule { suffix: b"ation", replacement: b"ate" },
        Rule { suffix: b"ator", replacement: b"ate" },
        Rule { suffix: b"alism", replacement: b"al" },
        Rule { suffix: b"iveness", replacement: b"ive" },
        Rule { suffix: b"fulness", replacement: b"ful" },
        Rule { suffix: b"ousness", replacement: b"ous" },
        Rule { suffix: b"aliti", replacement: b"al" },
        Rule { suffix: b"iviti", replacement: b"ive" },
        Rule { suffix: b"biliti", replacement: b"ble" },
        Rule { suffix: b"logi", replacement: b"log" },
    ];
    apply_rules_with_min_measure(word, len, &RULES, 0);
}

fn step3(word: &mut [u8], len: &mut usize) {
    const RULES: [Rule; 7] = [
        Rule { suffix: b"icate", replacement: b"ic" },
        Rule { suffix: b"ative", replacement: b"" },
        Rule { suffix: b"alize", replacement: b"al" },
        Rule { suffix: b"iciti", replacement: b"ic" },
        Rule { suffix: b"ical", replacement: b"ic" },
        Rule { suffix: b"ful", replacement: b"" },
        Rule { suffix: b"ness", replacement: b"" },
    ];
    apply_rules_with_min_measure(word, len, &RULES, 0);
}

fn step4(word: &mut [u8], len: &mut usize) {
    const RULES: [&[u8]; 18] = [
        b"ement", b"ance", b"ence", b"able", b"ible", b"ment", b"ant", b"ent", b"ism", b"ate",
        b"iti", b"ous", b"ive", b"ize", b"al", b"er", b"ic", b"ou",
    ];

    for suffix in RULES.iter() {
        if !ends_with(word, *len, suffix) {
            continue;
        }
        let stem = *len - suffix.len();
        if measure(word, stem) > 1 {
            *len = stem;
        }
        return;
    }

    if ends_with(word, *len, b"ion") {
        let stem = *len - 3;
        if measure(word, stem) > 1 && stem > 0 {
            let ch = word[stem - 1];
            if ch == b's' || ch == b't' {
                *len = stem;
            }
        }
    }
}

fn step5a(word: &mut [u8], len: &mut usize) {
    if !ends_with(word, *len, b"e") {
        return;
    }
    let stem = *len - 1;
    let m = measure(word, stem);
    if m > 1 || (m == 1 && !is_cvc(word, stem)) {
        *len = stem;
    }
}

fn step5b(word: &mut [u8], len: &mut usize) {
    if measure(word, *len) > 1 && is_double_consonant(word, *len) && ends_with(word, *len, b"l") {
        *len -= 1;
    }
}

pub fn stem_porter_ascii(input: &[u8], output: &mut [u8]) -> CoreResult<usize> {
    if output.len() < input.len() {
        return Err(CoreError::InsufficientCapacity);
    }
    if input.is_empty() {
        return Ok(0);
    }

    let mut len = input.len();
    for (i, &ch) in input.iter().enumerate() {
        output[i] = ascii::ascii_lower(ch);
    }

    if len <= 2 {
        return Ok(len);
    }

    step1a(output, &mut len);
    step1b(output, &mut len);
    step1c(output, &mut len);
    step2(output, &mut len);
    step3(output, &mut len);
    step4(output, &mut len);
    step5a(output, &mut len);
    step5b(output, &mut len);

    Ok(len)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn porter_sample_vectors() {
        const SAMPLES: [(&[u8], &[u8]); 20] = [
            (b"caresses", b"caress"),
            (b"ponies", b"poni"),
            (b"ties", b"ti"),
            (b"cats", b"cat"),
            (b"feed", b"feed"),
            (b"agreed", b"agre"),
            (b"plastered", b"plaster"),
            (b"motoring", b"motor"),
            (b"sing", b"sing"),
            (b"conflated", b"conflat"),
            (b"hopping", b"hop"),
            (b"filing", b"file"),
            (b"happy", b"happi"),
            (b"sky", b"sky"),
            (b"relational", b"relat"),
            (b"triplicate", b"triplic"),
            (b"probate", b"probat"),
            (b"rate", b"rate"),
            (b"controll", b"control"),
            (b"roll", b"roll"),
        ];

        let mut buf = [0u8; 64];
        for (word, expected) in SAMPLES.iter() {
            let got_len = stem_porter_ascii(word, &mut buf).unwrap();
            assert_eq!(&buf[0..got_len], *expected);
        }
    }
}
