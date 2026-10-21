//! Shared safe targets for seeded replay and cargo-fuzz. Never call pointer ABIs.
use bun_nltk::{distance, exact_metrics_stream::ExactMetricsStream, parsing, tokenizers};

pub const MAX_BYTES: usize = 16_384;

pub fn exercise(data: &[u8]) {
    if data.is_empty() || data.len() > MAX_BYTES {
        return;
    }
    let payload = &data[1..];
    match data[0] % 6 {
        0 => {
            // Load/predict only: arbitrary iteration counts must not reach training.
            if let Ok(value) = serde_json::from_slice::<serde_json::Value>(payload) {
                let action = value.get("action").and_then(|v| v.as_str()).unwrap_or("");
                let bounded_prediction = value
                    .get("text")
                    .and_then(|v| v.as_str())
                    .map(|text| text.len() <= 256)
                    .unwrap_or(true);
                if action.starts_with("load")
                    || (action.starts_with("predict") && bounded_prediction)
                {
                    let _ = bun_nltk::text_naive_bayes::execute(payload);
                    let _ = bun_nltk::text_classifiers::execute(payload);
                }
            } else {
                let _ = bun_nltk::text_naive_bayes::execute(payload);
                let _ = bun_nltk::text_classifiers::execute(payload);
            }
        }
        1 => {
            let _ = bun_nltk::punkt_unicode::decode_model(payload);
        }
        2 => {
            if let Ok(text) = std::str::from_utf8(payload) {
                let _ = parsing::Tree::fromstring(text, "()", false);
                let _ = parsing::Grammar::fromstring(text);
            }
        }
        3 => {
            if let Ok(text) = std::str::from_utf8(payload) {
                // Structured text mutations reach algorithms instead of only JSON errors.
                for kind in ["wordpunct", "treebank", "whitespace"] {
                    for spans in [false, true] {
                        let request = serde_json::from_value::<tokenizers::Request>(
                            serde_json::json!({"kind": kind, "text": text, "spans": spans}),
                        )
                        .unwrap();
                        let _ = tokenizers::execute(request);
                    }
                }
            }
        }
        4 => {
            let values: Vec<u32> = String::from_utf8_lossy(payload)
                .chars()
                .take(65)
                .map(|c| c as u32)
                .collect();
            let split = values.len() / 2;
            let (left, right) = values.split_at(split);
            let d = distance::edit_distance(left, right, 1.0, false).unwrap();
            assert_eq!(d, distance::edit_distance(right, left, 1.0, false).unwrap());
            assert!(d >= left.len().abs_diff(right.len()) as f64);
            assert!(d <= left.len().max(right.len()) as f64);
            let _ = distance::edit_alignment(left, right, 0.5).unwrap();
            let _ = distance::edit_distance(left, right, 1.0, true).unwrap();
            assert!(distance::edit_distance(
                &vec![0; distance::MAX_INPUT_LEN + 1],
                &[],
                1.0,
                false
            )
            .is_err());
            assert!(distance::edit_distance(left, right, f64::NAN, false).is_err());
        }
        _ => {
            let order = 1 + payload.first().copied().unwrap_or(0) as usize % 8;
            let expected = bun_nltk::freqdist::exact_ascii_metrics(payload, order).unwrap();
            let mut stream =
                ExactMetricsStream::new(order, MAX_BYTES, MAX_BYTES, MAX_BYTES).unwrap();
            let chunk_size = 1 + payload.get(1).copied().unwrap_or(0) as usize % 64;
            for chunk in payload.chunks(chunk_size) {
                stream.update(chunk).unwrap();
            }
            assert_eq!(stream.finish().unwrap(), expected);
            assert_eq!(stream.finish().unwrap(), expected);
            assert!(stream.update(b" ").is_err());
            let mut limited = ExactMetricsStream::new(order, 1, 1, 1).unwrap();
            if limited.update(b"oversized-token").is_err() {
                assert!(limited.finish().is_err());
            }
        }
    }
}
