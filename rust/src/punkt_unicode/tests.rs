
use super::*;
fn sentences<'a>(m: &PunktModel, text: &'a str) -> Vec<&'a str> {
    m.spans(text, true)
        .into_iter()
        .map(|(s, e)| &text[s..e])
        .collect()
}
#[test]
fn unicode_initials_numbers_and_quotes() {
    let m = PunktModel::default();
    assert_eq!(
        sentences(&m, "É. Müller said ‘Oui.’ Next!"),
        ["É. Müller said ‘Oui.’", "Next!"]
    );
    assert_eq!(
        sentences(&m, "١. chapter. ². Bach."),
        ["١. chapter.", "². Bach."]
    );
}
#[test]
fn model_heuristics() {
    let mut m = PunktModel::default();
    m.abbreviations.insert("dr".into());
    m.sentence_starters.insert("he".into());
    m.collocations.insert(("j".into(), "smith".into()));
    m.ortho_context.insert("éclair".into(), 32);
    assert_eq!(
        sentences(
            &m,
            "Dr. Jones left. Dr. He stayed. J. Smith ate. Dr. Éclair!"
        ),
        [
            "Dr. Jones left.",
            "Dr.",
            "He stayed.",
            "J. Smith ate.",
            "Dr.",
            "Éclair!"
        ]
    );
}
#[test]
fn alignment_and_raw_spans() {
    let m = PunktModel::default();
    let text = "😀 (Hello.)\u{1c}Next.  ";
    assert_eq!(sentences(&m, text), ["😀 (Hello.)", "Next."]);
    assert_eq!(m.spans(text, false), [(0, 12), (12, 19)]);
    assert_eq!(m.spans("", true), []);
    assert_eq!(m.spans("", false), [(0, 0)]);
}
#[test]
fn tokenizer_regex_alternatives() {
    let m = PunktModel::default();
    let words: Vec<_> = tokenize("word,word, . . . -- x...y?! ‘É.’", &m)
        .iter()
        .map(|t| t.text)
        .collect();
    assert_eq!(
        words,
        [
            "word,word",
            ",",
            ". . .",
            "--",
            "x",
            "...",
            "y",
            "?",
            "!",
            "‘É.",
            "’"
        ]
    );
}
#[test]
fn invalid_model_payloads() {
    assert!(decode_model(&[]).is_none());
    assert!(decode_model(&[1, 0, 0, 0, 1, 0, 0, 0, 255, 255, 255, 255]).is_none());
    let empty = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    assert!(decode_model(&empty).is_some());
    assert!(decode_model(&[empty.as_slice(), &[0]].concat()).is_none());
}
