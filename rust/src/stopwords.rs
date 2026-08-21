use crate::ascii;
use std::sync::OnceLock;

const STOPWORD_HASHES: [u64; 80] = [
    ascii::hash_token_const(b"a"),
    ascii::hash_token_const(b"again"),
    ascii::hash_token_const(b"all"),
    ascii::hash_token_const(b"an"),
    ascii::hash_token_const(b"and"),
    ascii::hash_token_const(b"any"),
    ascii::hash_token_const(b"are"),
    ascii::hash_token_const(b"as"),
    ascii::hash_token_const(b"at"),
    ascii::hash_token_const(b"be"),
    ascii::hash_token_const(b"both"),
    ascii::hash_token_const(b"but"),
    ascii::hash_token_const(b"by"),
    ascii::hash_token_const(b"can"),
    ascii::hash_token_const(b"down"),
    ascii::hash_token_const(b"each"),
    ascii::hash_token_const(b"few"),
    ascii::hash_token_const(b"for"),
    ascii::hash_token_const(b"from"),
    ascii::hash_token_const(b"further"),
    ascii::hash_token_const(b"he"),
    ascii::hash_token_const(b"her"),
    ascii::hash_token_const(b"here"),
    ascii::hash_token_const(b"him"),
    ascii::hash_token_const(b"how"),
    ascii::hash_token_const(b"i"),
    ascii::hash_token_const(b"if"),
    ascii::hash_token_const(b"in"),
    ascii::hash_token_const(b"into"),
    ascii::hash_token_const(b"is"),
    ascii::hash_token_const(b"it"),
    ascii::hash_token_const(b"just"),
    ascii::hash_token_const(b"me"),
    ascii::hash_token_const(b"more"),
    ascii::hash_token_const(b"most"),
    ascii::hash_token_const(b"my"),
    ascii::hash_token_const(b"myself"),
    ascii::hash_token_const(b"no"),
    ascii::hash_token_const(b"not"),
    ascii::hash_token_const(b"now"),
    ascii::hash_token_const(b"of"),
    ascii::hash_token_const(b"once"),
    ascii::hash_token_const(b"on"),
    ascii::hash_token_const(b"or"),
    ascii::hash_token_const(b"other"),
    ascii::hash_token_const(b"our"),
    ascii::hash_token_const(b"ours"),
    ascii::hash_token_const(b"ourselves"),
    ascii::hash_token_const(b"out"),
    ascii::hash_token_const(b"over"),
    ascii::hash_token_const(b"she"),
    ascii::hash_token_const(b"should"),
    ascii::hash_token_const(b"some"),
    ascii::hash_token_const(b"such"),
    ascii::hash_token_const(b"than"),
    ascii::hash_token_const(b"that"),
    ascii::hash_token_const(b"the"),
    ascii::hash_token_const(b"their"),
    ascii::hash_token_const(b"them"),
    ascii::hash_token_const(b"themselves"),
    ascii::hash_token_const(b"then"),
    ascii::hash_token_const(b"there"),
    ascii::hash_token_const(b"these"),
    ascii::hash_token_const(b"they"),
    ascii::hash_token_const(b"this"),
    ascii::hash_token_const(b"to"),
    ascii::hash_token_const(b"too"),
    ascii::hash_token_const(b"under"),
    ascii::hash_token_const(b"up"),
    ascii::hash_token_const(b"very"),
    ascii::hash_token_const(b"was"),
    ascii::hash_token_const(b"we"),
    ascii::hash_token_const(b"when"),
    ascii::hash_token_const(b"where"),
    ascii::hash_token_const(b"why"),
    ascii::hash_token_const(b"will"),
    ascii::hash_token_const(b"with"),
    ascii::hash_token_const(b"you"),
    ascii::hash_token_const(b"your"),
    ascii::hash_token_const(b"yours"),
];

static SORTED: OnceLock<Vec<u64>> = OnceLock::new();

fn sorted_hashes() -> &'static [u64] {
    SORTED.get_or_init(|| {
        let mut v = STOPWORD_HASHES.to_vec();
        v.sort_unstable();
        v
    })
}

pub fn is_stopword_hash(hash: u64) -> bool {
    sorted_hashes().binary_search(&hash).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ascii;

    #[test]
    fn stopword_hash_contains_expected_members() {
        assert!(is_stopword_hash(ascii::hash_token(b"the")));
        assert!(is_stopword_hash(ascii::hash_token(b"and")));
        assert!(!is_stopword_hash(ascii::hash_token(b"rust")));
        assert!(sorted_hashes().windows(2).all(|w| w[0] < w[1]));
    }
}

