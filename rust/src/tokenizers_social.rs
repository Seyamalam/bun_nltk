//! Tweet/Toktok/MWE dispatch over the existing retained-output tokenizer ABI.
use super::{Request, Response};
use std::collections::BTreeMap;

#[path = "tokenizers_toktok.rs"]
mod toktok;
#[path = "tokenizers_tweet.rs"]
mod tweet;

#[derive(Default)]
struct Trie {
    terminal: bool,
    children: BTreeMap<String, usize>,
}

pub(super) fn execute(request: &Request) -> Result<Response, String> {
    if request.spans {
        return Err(format!("{} does not implement span_tokenize", request.kind));
    }
    match request.kind.as_str() {
        "tweet" => tweet::tokenize(request).map(Response::Tokens),
        "toktok" => {
            let text = toktok::tokenize(&request.text);
            Ok(if request.return_str {
                Response::Text(text)
            } else {
                Response::Tokens(
                    text.split(super::python_space)
                        .filter(|s| !s.is_empty())
                        .map(str::to_owned)
                        .collect(),
                )
            })
        }
        "mwe" => {
            // Flat arena avoids recursive destruction of long user phrases.
            let mut trie = vec![Trie::default()];
            for (phrase, remove) in request.mwes.iter().map(|phrase| (phrase, false)).chain(
                request
                    .mwe_updates
                    .iter()
                    .map(|update| (&update.tokens, update.remove)),
            ) {
                let mut node = 0;
                for token in phrase {
                    node = if let Some(&child) = trie[node].children.get(token) {
                        child
                    } else {
                        let child = trie.len();
                        trie.push(Trie::default());
                        trie[node].children.insert(token.clone(), child);
                        child
                    };
                }
                trie[node].terminal = !remove;
            }
            let mut out = Vec::new();
            let mut i = 0;
            while i < request.tokens.len() {
                let mut node = 0;
                let mut last = i + 1;
                for j in i..request.tokens.len() {
                    let Some(&child) = trie[node].children.get(&request.tokens[j]) else {
                        break;
                    };
                    node = child;
                    if trie[node].terminal {
                        last = j + 1;
                    }
                }
                out.push(request.tokens[i..last].join(&request.separator));
                i = last;
            }
            Ok(Response::Tokens(out))
        }
        _ => Err("unknown social tokenizer".into()),
    }
}

#[cfg(test)]
mod tests {
    fn run(request: serde_json::Value) -> String {
        serde_json::to_string(&super::execute(&serde_json::from_value(request).unwrap()).unwrap())
            .unwrap()
    }
    #[test]
    fn tweet_options_and_entities() {
        assert_eq!(
            run(serde_json::json!({"kind":"tweet", "text":"Hi café &amp; foo@example.com :D <3"})),
            r#"["Hi","café","&","foo@example.com",":D","<3"]"#
        );
        assert_eq!(
            run(
                serde_json::json!({"kind":"tweet", "text":"@remy: waaaaayyyy!!!!!! :D", "strip_handles":true, "reduce_len":true, "preserve_case":false})
            ),
            r#"[":","waaayyy","!","!","!",":D"]"#
        );
        let request =
            serde_json::from_value(serde_json::json!({"kind":"tweet","text":"&#xD800;"})).unwrap();
        assert!(super::execute(&request)
            .unwrap_err()
            .contains("non-scalar surrogate"));
    }
    #[test]
    fn toktok_rule_order() {
        assert_eq!(
            run(serde_json::json!({"kind":"toktok", "text":"café isn't bad.\n"})),
            r#"["café","isn","'","t","bad","."]"#
        );
        assert_eq!(
            run(
                serde_json::json!({"kind":"toktok", "text":"a\tb|c & d 525,600", "return_str":true})
            ),
            r#""a &#9; b &#124; c &amp; d 525,600""#
        );
    }
    #[test]
    fn mwe_exact_keys_and_backtracking() {
        assert_eq!(
            run(
                serde_json::json!({"kind":"mwe", "tokens":["a","b","c"], "mwe_updates":[{"tokens":["a","b"]},{"tokens":["a","b","c"]},{"tokens":["a","b","c"],"remove":true}]})
            ),
            r#"["a_b","c"]"#
        );
        assert_eq!(
            run(serde_json::json!({"kind":"mwe", "tokens":["a","b_c"], "mwes":[["a_b","c"]]})),
            r#"["a","b_c"]"#
        );
        assert_eq!(
            run(
                serde_json::json!({"kind":"mwe", "tokens":["a","b","c"], "mwes":[["a","b"],["a","b","x"]]})
            ),
            r#"["a_b","c"]"#
        );
        assert_eq!(
            run(
                serde_json::json!({"kind":"mwe", "tokens":[" a","b ",""], "mwes":[[" a","b "],[""]]})
            ),
            r#"[" a_b ",""]"#
        );
    }
}
