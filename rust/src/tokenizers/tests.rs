use super::*;

#[test]
fn treebank_order_and_unicode() {
    assert_eq!(
        treebank("\"I can't, cannot GİMME 'tİs x:٣.\"", false).unwrap(),
        ["``", "I", "ca", "n't", ",", "can", "not", "GİM", "ME", "'t", "İs", "x:٣", ".", "''"]
    );
    assert_eq!(
        treebank("²cannot cannot\u{301} cannot\u{1c}.", false).unwrap(),
        ["²cannot", "can", "not", "\u{301}", "can", "not", "."]
    );
}

#[test]
fn unicode_quote_spans() {
    assert_eq!(
        treebank_spans("😀 \"can't\"").unwrap(),
        [(0, 1), (2, 3), (3, 5), (5, 8), (8, 9)]
    );
}

#[test]
fn reverse_nested_quotes() {
    let tokens = treebank("He said, \"'Hello.'\"", false).unwrap();
    assert_eq!(detokenize(&tokens, false).unwrap(), "He said, \"'Hello.'\"");
}

#[test]
fn python_line_breaks_and_empty_spans() {
    assert_eq!(
        line_tokens("a\r\n\u{2028}b\u{1c} \n", "keep").unwrap(),
        ["a", "", "b", " "]
    );
    assert_eq!(delimiter_spans(" a  ", " "), [(1, 2), (3, 3)]);
    assert_eq!(
        gap_spans("", simple_regex("line").unwrap(), false),
        [(0, 0)]
    );
}
