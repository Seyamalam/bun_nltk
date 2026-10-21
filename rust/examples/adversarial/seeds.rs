pub fn corpus() -> Vec<Vec<u8>> {
    let mut cases = Vec::new();
    for text in [
        "",
        "{}",
        "[]",
        "null",
        "{",
        "{\"action\":\"loadTree\",\"model\":{}}",
        "{\"action\":\"loadPositive\",\"model\":{}}",
    ] {
        cases.push([&[0][..], text.as_bytes()].concat());
    }
    let model = serde_json::json!({
        "version":2,"model":"categorical","smoothing":0.7,"totalDocs":2.0,
        "labels":["A","B"],"labelDocCounts":[1.0,1.0],"features":[["a",[[[1.0,1.0]],[]]]]
    });
    for action in ["loadCategorical", "predictCategorical"] {
        let request = serde_json::json!({"action":action,"model":model,"text":"a"});
        cases.push([vec![0], serde_json::to_vec(&request).unwrap()].concat());
    }
    let vectorizer = serde_json::json!({"version":1,"ngramMin":1,"ngramMax":1,"binary":true,"maxFeatures":64,"vocabulary":["a"]});
    let tree = serde_json::json!({"version":1,"labels":["A"],"options":{"maxDepth":3,"minSamples":1,"maxCandidateFeatures":64},"vectorizer":vectorizer,"tree":{"kind":"leaf","label":"A","counts":{"A":1}}});
    let sgd = serde_json::json!({"version":1,"labels":["A"],"vocabulary":["a"],"weights":[[-1.2350633913959672]],"bias":[-5.694899900138186],"options":{"epochs":1,"learningRate":0.1,"l2":0.0,"maxFeatures":100}});
    for (action, model) in [
        ("loadTree", tree.clone()),
        ("predictTree", tree),
        ("loadVectorizer", vectorizer),
        ("loadSgd", sgd.clone()),
        ("predictSgd", sgd),
    ] {
        cases.push(
            [
                vec![0],
                serde_json::to_vec(&serde_json::json!({"action":action,"model":model,"text":"a"}))
                    .unwrap(),
            ]
            .concat(),
        );
    }
    cases.push(
        [
            vec![1],
            [1u32, 0, 0, 0, 0]
                .iter()
                .flat_map(|v| v.to_le_bytes())
                .collect(),
        ]
        .concat(),
    );
    cases.push(vec![1, 1, 0, 0, 0, 255, 255, 255, 255]);
    for depth in [1, 24, 255, 256, 300] {
        cases.push(
            [
                vec![2],
                format!("{}x{}", "(N ".repeat(depth), ")".repeat(depth)).into_bytes(),
            ]
            .concat(),
        );
    }
    for text in [
        "S -> S S | 'a'",
        "(N",
        ")",
        "(N 😀 e\u{301})",
        "\0can't\u{200d}😀\r\né中\u{10ffff}",
    ] {
        for family in [2, 3, 4, 5] {
            cases.push([vec![family], text.as_bytes().to_vec()].concat());
        }
    }
    cases.push(vec![3, 0xff, 0xc0, 0x80, 0xed, 0xa0, 0x80]);
    cases
}
