//! Ordered NLTK 3.10.3 destructive word-tokenizer substitutions.
//! Unicode predicates follow Python's standard `re` (not redos/regex).
use crate::unicode;

const SPACE: u32 = 32;
fn ascii(s: &str) -> Vec<u32> { s.bytes().map(u32::from).collect() }
fn padded(s: &[u32]) -> Vec<u32> {
    let mut out = vec![SPACE]; out.extend(s); out.push(SPACE); out
}
fn matches(text: &[u32], i: usize, s: &str) -> bool {
    text.get(i..i+s.len()).is_some_and(|t| t.iter().copied().eq(s.bytes().map(u32::from)))
}
fn insensitive(ch: u32, byte: u8) -> bool {
    ch == u32::from(byte) || ch == u32::from(byte.to_ascii_uppercase())
        || (byte == b'i' && matches!(ch,0x130 | 0x131))
        || (byte == b's' && ch == 0x17f) || (byte == b'k' && ch == 0x212a)
}
fn imatches(text: &[u32], i: usize, s: &str) -> bool {
    text.get(i..i+s.len()).is_some_and(|t| t.iter().zip(s.bytes()).all(|(&ch,b)| insensitive(ch,b)))
}
fn substitute<F>(text: &mut Vec<u32>, mut f: F)
where F: FnMut(&[u32],usize) -> Option<(usize,Vec<u32>)> {
    let mut out = Vec::with_capacity(text.len());
    let mut i = 0;
    while i < text.len() {
        if let Some((length,replacement)) = f(text,i) { out.extend(replacement); i += length; }
        else { out.push(text[i]); i += 1; }
    }
    *text = out;
}
fn literal(text: &mut Vec<u32>, from: &str, to: &str) {
    substitute(text,|t,i| matches(t,i,from).then(|| (from.len(),ascii(to))));
}
fn pad_chars(text: &mut Vec<u32>, chars: &[u32]) {
    substitute(text,|t,i| chars.contains(&t[i]).then(|| (1,padded(&t[i..i+1]))));
}
fn final_period(text: &mut Vec<u32>, curly: bool) {
    substitute(text,|t,i| {
        if t[i] == 46 || t.get(i+1) != Some(&46) { return None; }
        let mut j = i+2;
        while j < t.len() && (matches!(t[j],93 | 41 | 125 | 62 | 34 | 39) || (curly && matches!(t[j],0xbb | 0x201d | 0x2019 | 32))) { j += 1; }
        if t[j..].iter().any(|&c| !unicode::is_pyspace(c)) { return None; }
        let mut out = vec![t[i],SPACE,46];
        if curly { out.push(SPACE); }
        out.extend(&t[i+2..j]); out.push(SPACE);
        Some((t.len()-i,out))
    });
}
fn clitics(text: &mut Vec<u32>, forms: &[&str]) {
    substitute(text,|t,i| {
        if matches!(t[i],39 | 32) { return None; }
        for &s in forms {
            if matches(t,i+1,s) && t.get(i+1+s.len()) == Some(&SPACE) {
                let mut out = vec![t[i],SPACE]; out.extend(&t[i+1..i+1+s.len()]); out.push(SPACE);
                return Some((s.len()+2,out));
            }
        }
        None
    });
}

pub fn tokenize(input: &[u32]) -> Vec<Vec<u32>> {
    let mut text = input.to_vec();
    // STARTING_QUOTES
    substitute(&mut text,|t,i| {
        if matches!(t[i],0xab | 0x201c | 0x2018 | 0x201e) { return Some((1,padded(&t[i..i+1]))); }
        if t[i] != 96 { return None; }
        let mut j = i+1; while j < t.len() && t[j] == 96 { j += 1; }
        Some((j-i,padded(&t[i..j])))
    });
    if text.first() == Some(&34) { text.splice(0..1,[96,96]); }
    literal(&mut text,"``"," `` ");
    substitute(&mut text,|t,i| {
        if !matches!(t[i],32 | 40 | 91 | 123 | 60) { return None; }
        let size = if t.get(i+1) == Some(&34) { 1 } else if matches(t,i+1,"''") { 2 } else { return None; };
        Some((size+1,vec![t[i],SPACE,96,96,SPACE]))
    });
    substitute(&mut text,|t,i| {
        if t[i] != 39 || (i > 0 && unicode::is_pyword(t[i-1])) || !t.get(i+1).is_some_and(|&c| unicode::is_pyword(c)) { return None; }
        for s in ["re","ve","ll","m","t","s","d","n"] {
            if imatches(t,i+1,s) && !t.get(i+1+s.len()).is_some_and(|&c| unicode::is_pyword(c)) { return None; }
        }
        Some((1,vec![39,SPACE]))
    });
    // PUNCTUATION, in precisely NLTK's order.
    final_period(&mut text,true);
    substitute(&mut text,|t,i| {
        if !matches!(t[i],58 | 44) || i+1 >= t.len() || unicode::is_decimal(t[i+1]) { return None; }
        Some((2,vec![SPACE,t[i],SPACE,t[i+1]]))
    });
    substitute(&mut text,|t,i| (i+1 == t.len() && matches!(t[i],58 | 44)).then(|| (1,padded(&t[i..i+1]))));
    substitute(&mut text,|t,i| {
        if t[i] != 46 || t.get(i+1) != Some(&46) { return None; }
        let mut j=i+2; while j < t.len() && t[j] == 46 { j+=1; }
        Some((j-i,padded(&t[i..j])))
    });
    pad_chars(&mut text,&[59,64,35,36,37,38]);
    pad_chars(&mut text,&[0x2012,0x2013,0x2014,0x2015]);
    final_period(&mut text,false);
    pad_chars(&mut text,&[63,33]);
    substitute(&mut text,|t,i| (t[i] != 39 && matches(t,i+1,"' ")).then(|| (3,vec![t[i],SPACE,39,SPACE])));
    pad_chars(&mut text,&[42]);
    pad_chars(&mut text,&[93,91,40,41,123,125,60,62]);
    literal(&mut text,"--"," -- ");
    text = padded(&text);
    // ENDING_QUOTES
    pad_chars(&mut text,&[0xbb,0x201d,0x2019]);
    literal(&mut text,"''"," '' "); literal(&mut text,"\""," '' ");
    substitute(&mut text,|t,i| {
        if !unicode::is_pyspace(t[i]) { return None; }
        let mut j=i+1; while j < t.len() && unicode::is_pyspace(t[j]) { j+=1; }
        Some((j-i,vec![SPACE]))
    });
    clitics(&mut text,&["'s","'S","'m","'M","'d","'D","'"]);
    clitics(&mut text,&["'ll","'LL","'re","'RE","'ve","'VE","n't","N'T"]);
    // MacIntyre contractions. Python re uses Unicode-aware boundaries and i/s/k folding.
    for (left,right) in [("can","not"),("d","'ye"),("gim","me"),("gon","na"),("got","ta"),("lem","me"),("more","'n"),("wan","na")] {
        substitute(&mut text,|t,i| {
            if i > 0 && unicode::is_pyword(t[i-1]) { return None; }
            if !imatches(t,i,left) || !imatches(t,i+left.len(),right) { return None; }
            let j = i+left.len()+right.len();
            if left == "wan" {
                if !t.get(j).is_some_and(|&c| unicode::is_pyspace(c)) { return None; }
            } else if t.get(j).is_some_and(|&c| unicode::is_pyword(c)) { return None; }
            let mut out = vec![SPACE]; out.extend(&t[i..i+left.len()]); out.push(SPACE); out.extend(&t[i+left.len()..j]); out.push(SPACE);
            Some((j-i,out))
        });
    }
    for right in ["is","was"] {
        substitute(&mut text,|t,i| {
            if t[i] != SPACE || !imatches(t,i+1,"'t") || !imatches(t,i+3,right) { return None; }
            let j = i+3+right.len();
            if t.get(j).is_some_and(|&c| unicode::is_pyword(c)) { return None; }
            let mut out=vec![SPACE]; out.extend(&t[i+1..i+3]); out.push(SPACE); out.extend(&t[i+3..j]); out.push(SPACE);
            Some((j-i,out))
        });
    }
    text.split(|&c| unicode::is_pyspace(c)).filter(|s| !s.is_empty()).map(|s| s.to_vec()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn curly_quotes_and_contractions() {
        let words = tokenize(&"“Hello…” I can't—cannot.".chars().map(u32::from).collect::<Vec<_>>());
        let words: Vec<String> = words.iter().map(|w| w.iter().map(|&c| char::from_u32(c).unwrap()).collect()).collect();
        assert_eq!(words,["“","Hello…","”","I","ca","n't","—","can","not","."]);
    }
}
