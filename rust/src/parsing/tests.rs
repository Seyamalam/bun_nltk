use super::*;
fn parse(text: &str, tokens: &[&str]) -> ParseResult {
    earley(
        &Grammar::fromstring(text).unwrap(),
        &tokens.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
        100,
        100000,
    )
    .unwrap()
}
#[test]
fn tree_contract() {
    let Child::Tree(t) = Tree::fromstring("(S (NP café) (VP runs) ())", "()", false).unwrap()
    else {
        panic!()
    };
    assert_eq!(t.leaves(), vec!["café", "runs"]);
    assert_eq!(t.height(), 3);
    assert_eq!(
        t.positions("preorder").unwrap(),
        vec![vec![], vec![0], vec![0, 0], vec![1], vec![1, 0], vec![2]]
    );
    assert_eq!(t.normalize_position(&[-2, -1]).unwrap(), vec![1, 0]);
    assert!(t.normalize_position(&[0, 0, 0]).is_err());
    assert_eq!(t.spanning(0, 2).unwrap(), Vec::<usize>::new());
    assert_eq!(
        t.format(&Format::default()).unwrap(),
        "(S (NP café) (VP runs) ( ))"
    );
}
#[test]
fn invalid_trees() {
    for s in ["", "a", "(S", ")", "(S) (T)", "(S))", "(S) x"] {
        assert!(Tree::fromstring(s, "()", false).is_err(), "{s}");
    }
}
#[test]
fn grammar_quotes_and_empty() {
    let g = Grammar::fromstring("%start NP\nS -> 'a|b' |\nNP -> S \\\n 'c'\n").unwrap();
    assert_eq!(g.start, "NP");
    assert_eq!(g.productions.len(), 3);
    assert_eq!(g.productions[0].rhs, vec![Symbol::Terminal("a|b".into())]);
    assert!(g.productions[1].rhs.is_empty());
    for s in ["", "S => A", "S -> 'x", "S -> @", "%bad S\nS -> 'a'"] {
        assert!(Grammar::fromstring(s).is_err(), "{s}");
    }
}
#[test]
fn ambiguity_and_left_recursion() {
    let p = parse("S -> S S | 'a'", &["a", "a", "a", "a"]);
    assert!(p.recognized);
    assert_eq!(p.trees.len(), 5);
    assert!(!p.cyclic);
}
#[test]
fn nullable_and_mixed() {
    let p = parse("S -> A A 'z'\nA -> | 'a'", &["a", "z"]);
    assert_eq!(p.trees.len(), 2);
    assert_eq!(parse("S -> A\nA ->", &[]).trees.len(), 1);
    assert!(!parse("S -> 'a' 'b'", &["b", "a"]).recognized);
}
#[test]
fn cycles_are_explicit() {
    let p = parse("S -> S | 'a'", &["a"]);
    assert!(p.recognized);
    assert!(p.cyclic);
    assert_eq!(p.trees.len(), 1);
    let g = Grammar::fromstring("S -> 'a' | A\nA -> A | 'a'").unwrap();
    assert!(earley(&g, &["a".into()], 0, 10000).unwrap().cyclic);
    assert!(earley(&g, &["a".into()], 1, 10000).unwrap().cyclic);
}
#[test]
fn limits_and_coverage() {
    let g = Grammar::fromstring("S -> S S | 'a'").unwrap();
    assert!(earley(&g, &["x".into()], 1, 100).is_err());
    let p = earley(&g, &vec!["a".into(); 4], 2, 10000).unwrap();
    assert_eq!(p.trees.len(), 2);
    assert!(p.truncated);
    assert!(earley(&g, &vec!["a".into(); 4], 2, 1).is_err());
}
