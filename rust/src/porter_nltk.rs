//! NLTK 3.10.3 Porter modes, operating on Python-style Unicode code points.
//! The legacy ASCII core remains unchanged for callers using that API.
use crate::unicode;

pub const ORIGINAL: u32 = 0;
pub const MARTIN: u32 = 1;
pub const NLTK: u32 = 2;

fn flags(word: &[u32]) -> Vec<bool> {
    let mut out = Vec::with_capacity(word.len());
    for &ch in word {
        out.push(match ch {
            97 | 101 | 105 | 111 | 117 => false,
            121 => out.last().map_or(true, |last| !last),
            _ => true,
        });
    }
    out
}

fn consonant(word: &[u32], mut i: usize) -> bool {
    let mut negate = false;
    while i > 0 && word[i] == 121 { negate = !negate; i -= 1; }
    !matches!(word[i], 97 | 101 | 105 | 111 | 117) != negate
}
fn measure(word: &[u32]) -> usize { flags(word).windows(2).filter(|w| !w[0] && w[1]).count() }
fn vowel(word: &[u32]) -> bool { flags(word).contains(&false) }
fn double(word: &[u32]) -> bool {
    word.len() >= 2 && word[word.len()-1] == word[word.len()-2] && consonant(word, word.len()-1)
}
fn cvc(word: &[u32], mode: u32) -> bool {
    let n = word.len();
    (n >= 3 && consonant(word, n-3) && !consonant(word, n-2) && consonant(word, n-1)
        && !matches!(word[n-1], 119 | 120 | 121))
        || (mode == NLTK && n == 2 && !consonant(word, 0) && consonant(word, 1))
}
fn suffix(word: &[u32], text: &str) -> bool {
    word.len() >= text.len() && word[word.len()-text.len()..].iter().copied().eq(text.bytes().map(u32::from))
}
fn replace(word: &mut Vec<u32>, size: usize, text: &str) {
    word.truncate(word.len()-size); word.extend(text.bytes().map(u32::from));
}
fn rules(word: &mut Vec<u32>, rules: &[(&str, &str)], min: usize) {
    for &(s, r) in rules {
        if suffix(word, s) {
            if measure(&word[..word.len()-s.len()]) > min { replace(word, s.len(), r); }
            return;
        }
    }
}
fn step2(word: &mut Vec<u32>, mode: u32) {
    if mode == NLTK && suffix(word, "alli") && measure(&word[..word.len()-4]) > 0 {
        replace(word, 4, "al");
        // Replacing "alli" with "al" cannot leave another "alli" suffix,
        // so the recursive call has depth at most one.
        step2(word, mode); return;
    }
    let bli = if mode == ORIGINAL { ("abli", "able") } else { ("bli", "ble") };
    let before = word.clone();
    rules(word, &[("ational","ate"),("tional","tion"),("enci","ence"),("anci","ance"),
        ("izer","ize"),bli,("alli","al"),("entli","ent"),("eli","e"),("ousli","ous"),
        ("ization","ize"),("ation","ate"),("ator","ate"),("alism","al"),("iveness","ive"),
        ("fulness","ful"),("ousness","ous"),("aliti","al"),("iviti","ive"),("biliti","ble")],0);
    if *word != before { return; }
    if mode == NLTK && suffix(word, "fulli") { rules(word, &[("fulli","ful")],0); }
    if mode != ORIGINAL && suffix(word,"logi") {
        let size = if mode == NLTK { 3 } else { 4 };
        if measure(&word[..word.len()-size]) > 0 { replace(word,4,"log"); }
    }
}

pub fn stem(input: &[u32], mode: u32, lowercase: bool) -> Vec<u32> {
    let mut word = Vec::with_capacity(input.len());
    if lowercase {
        for (i, &ch) in input.iter().enumerate() {
            if ch == 0x3a3 {
                let previous = input[..i].iter().rev().find(|&&c| !unicode::is_case_ignorable(c));
                let next = input[i+1..].iter().find(|&&c| !unicode::is_case_ignorable(c));
                let final_sigma = previous.is_some_and(|&c| unicode::is_cased(c))
                    && !next.is_some_and(|&c| unicode::is_cased(c));
                word.push(if final_sigma { 0x3c2 } else { 0x3c3 });
            } else { unicode::lowercase_char(ch, &mut word); }
        }
    } else { word.extend(input); }
    if mode == NLTK {
        for (form, root) in [("sky","sky"),("skies","sky"),("dying","die"),("lying","lie"),("tying","tie"),
            ("news","news"),("innings","inning"),("inning","inning"),("outings","outing"),("outing","outing"),
            ("cannings","canning"),("canning","canning"),("howe","howe"),("proceed","proceed"),
            ("exceed","exceed"),("succeed","succeed")] {
            if word.len() == form.len() && suffix(&word,form) { return root.bytes().map(u32::from).collect(); }
        }
    }
    if mode != ORIGINAL && input.len() <= 2 { return word; }
    if mode == NLTK && word.len() == 4 && suffix(&word,"ies") { replace(&mut word,3,"ie"); }
    else if suffix(&word,"sses") || suffix(&word,"ies") { word.truncate(word.len()-2); }
    else if !suffix(&word,"ss") && suffix(&word,"s") { word.pop(); }

    if mode == NLTK && suffix(&word,"ied") {
        let r = if word.len() == 4 { "ie" } else { "i" }; replace(&mut word,3,r);
    } else if suffix(&word,"eed") {
        if measure(&word[..word.len()-3]) > 0 { word.pop(); }
    } else {
        for s in ["ed","ing"] {
            if suffix(&word,s) && vowel(&word[..word.len()-s.len()]) {
                word.truncate(word.len()-s.len());
                if ["at","bl","iz"].iter().any(|s| suffix(&word,s)) { word.push(101); }
                else if double(&word) {
                    if !matches!(word.last(),Some(108 | 115 | 122)) { word.pop(); }
                } else if measure(&word) == 1 && cvc(&word,mode) { word.push(101); }
                break;
            }
        }
    }
    if suffix(&word,"y") {
        let n = word.len()-1;
        let change = if mode == NLTK { n > 1 && consonant(&word[..n],n-1) } else { vowel(&word[..n]) };
        if change { word[n] = 105; }
    }
    step2(&mut word,mode);
    rules(&mut word,&[("icate","ic"),("ative",""),("alize","al"),("iciti","ic"),("ical","ic"),("ful",""),("ness","")],0);
    for s in ["al","ance","ence","er","ic","able","ible","ant","ement","ment","ent","ion","ou","ism","ate","iti","ous","ive","ize"] {
        if suffix(&word,s) {
            let n = word.len()-s.len();
            if measure(&word[..n]) > 1 && (s != "ion" || matches!(word.get(n.wrapping_sub(1)),Some(115 | 116))) { word.truncate(n); }
            break;
        }
    }
    if suffix(&word,"e") {
        let n = word.len()-1; let m = measure(&word[..n]);
        if m > 1 || (m == 1 && !cvc(&word[..n],mode)) { word.pop(); }
    }
    if suffix(&word,"ll") && measure(&word[..word.len()-1]) > 1 { word.pop(); }
    word
}

#[cfg(test)]
mod tests {
    use super::*;
    fn run(s: &str, mode: u32) -> String {
        stem(&s.chars().map(u32::from).collect::<Vec<_>>(),mode,true).into_iter().map(|c| char::from_u32(c).unwrap()).collect()
    }
    #[test] fn modes() {
        assert_eq!(run("skies",NLTK),"sky"); assert_eq!(run("skies",MARTIN),"ski");
        assert_eq!(run("ties",NLTK),"tie"); assert_eq!(run("ties",ORIGINAL),"ti");
        assert_eq!(run("s",ORIGINAL),""); assert_eq!(run("s",NLTK),"s");
    }
    #[test] fn unicode_and_long_y() {
        assert_eq!(run("ΟΣ",NLTK),"ος"); assert_eq!(run("İ",NLTK),"i\u{307}");
        assert_eq!(run(&"y".repeat(100000),NLTK).len(),100000);
    }
}
