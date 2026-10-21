#[path = "../examples/adversarial/seeds.rs"]
mod seeds;
#[path = "../examples/adversarial/targets.rs"]
mod targets;

#[test]
fn safe_native_adversarial_corpus() {
    for data in seeds::corpus() {
        targets::exercise(&data);
    }
}

#[test]
fn valid_model_seeds_reach_validation_and_roundtrip_exactly() {
    let mut accepted = 0;
    for data in seeds::corpus() {
        if data[0] != 0 {
            continue;
        }
        let Ok(request) = serde_json::from_slice::<serde_json::Value>(&data[1..]) else {
            continue;
        };
        if !request["action"].as_str().unwrap_or("").starts_with("load") {
            continue;
        }
        let output = bun_nltk::text_naive_bayes::execute(&data[1..])
            .or_else(|_| bun_nltk::text_classifiers::execute(&data[1..]));
        if let Ok(output) = output {
            assert_eq!(
                serde_json::from_slice::<serde_json::Value>(&output).unwrap(),
                request["model"]
            );
            accepted += 1;
        }
    }
    assert_eq!(accepted, 4); // Categorical NB, tree, vectorizer and SGD.
}
