use super::*;
#[test]
fn ascii_tokens_and_ngrams() {
    let v = Vectorizer {
        version: 1,
        ngram_min: 1,
        ngram_max: 2,
        binary: false,
        max_features: 64,
        vocabulary: vec![],
    };
    assert_eq!(
        v.features("É A café 'x"),
        ["a", "caf", "'x", "a\u{1}caf", "caf\u{1}'x"]
    );
    let v = v.fit(&["a a b".into()]).unwrap();
    assert_eq!(v.vocabulary, ["a", "a\u{1}a", "a\u{1}b", "b"]);
    assert_eq!(v.transform("a a unknown").values, [2.0, 1.0]);
}
#[test]
fn untrained_and_malformed_transport() {
    assert!(execute(br#"{"action":"loadSgd","model":{}}"#)
        .unwrap_err()
        .contains("missing field"));
    assert!(execute(br#"{"action":"loadIis","model":{"version":2,"algorithm":"gis","labels":["A"],"features":[],"weights":[],"epochs":1}}"#).is_err());
}
#[test]
fn label_order_uses_utf16() {
    assert_eq!(js_cmp("\u{10000}", "\u{e000}"), std::cmp::Ordering::Less);
}

fn golden() -> serde_json::Value {
    serde_json::from_slice(include_bytes!(
        "../../../test/fixtures/text_classifiers_405347e.json"
    ))
    .unwrap()
}

fn request(value: serde_json::Value) -> serde_json::Value {
    serde_json::from_slice(&execute(&serde_json::to_vec(&value).unwrap()).unwrap()).unwrap()
}

fn close(actual: &serde_json::Value, expected: &serde_json::Value) {
    use serde_json::Value;
    match (actual, expected) {
        (Value::Number(a), Value::Number(b)) => {
            let (a, b) = (a.as_f64().unwrap(), b.as_f64().unwrap());
            assert!((a - b).abs() <= 2e-12 * b.abs().max(1.0), "{a} != {b}");
        }
        (Value::Array(a), Value::Array(b)) => {
            assert_eq!(a.len(), b.len());
            for (a, b) in a.iter().zip(b) {
                close(a, b);
            }
        }
        (Value::Object(a), Value::Object(b)) => {
            assert_eq!(a.keys().collect::<Vec<_>>(), b.keys().collect::<Vec<_>>());
            for (key, a) in a {
                close(a, &b[key]);
            }
        }
        _ => assert_eq!(actual, expected),
    }
}

#[test]
fn frozen_vectorizer_and_tree_training() {
    let g = golden();
    let texts: Vec<_> = g["rows"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["text"].clone())
        .collect();
    for item in g["vectorizers"].as_array().unwrap() {
        let output = request(
            serde_json::json!({ "action": "fitVectorizer", "model": item["saved"], "texts": texts }),
        );
        close(&output, &item["saved"]);
        let vectors = request(
            serde_json::json!({ "action": "transformVectorizer", "model": output, "texts": g["queries"] }),
        );
        close(&vectors, &item["vectors"]);
    }
    for item in g["trees"].as_array().unwrap() {
        let saved = &item["saved"];
        let output = request(
            serde_json::json!({ "action": "trainTree", "labels": saved["labels"], "options": saved["options"],
                "vectorizer": saved["vectorizer"], "examples": g["rows"] }),
        );
        close(&output, saved);
    }
}

#[test]
fn frozen_sgd_and_iis_training_and_scoring() {
    let g = golden();
    for (family, train, predict) in [
        ("sgd", "trainSgd", "predictSgd"),
        ("iis", "trainIis", "predictIis"),
    ] {
        for item in g[family].as_array().unwrap() {
            let output = request(
                serde_json::json!({ "action": train, "model": item["saved"], "examples": g["rows"] }),
            );
            close(&output, &item["saved"]);
            for (q, text) in g["queries"].as_array().unwrap().iter().enumerate() {
                let scores = request(
                    serde_json::json!({ "action": predict, "model": output, "text": text }),
                );
                close(&scores, &item["predictions"][q]);
            }
        }
    }
}

#[test]
fn frozen_long_document_iis() {
    let g = golden();
    let long = &g["longIis"];
    let output = request(
        serde_json::json!({ "action": "trainIis", "model": long["saved"], "examples": long["rows"] }),
    );
    close(&output, &long["saved"]);
}
