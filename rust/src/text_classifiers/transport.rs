use super::*;

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
enum Request {
    FitVectorizer {
        model: Vectorizer,
        texts: Vec<String>,
    },
    LoadVectorizer {
        model: Vectorizer,
    },
    TransformVectorizer {
        model: Vectorizer,
        texts: Vec<String>,
    },
    TrainTree {
        labels: Vec<String>,
        options: TreeOptions,
        vectorizer: Vectorizer,
        examples: Vec<Example>,
    },
    LoadTree {
        model: Tree,
    },
    PredictTree {
        model: Tree,
        text: String,
    },
    SgdVocabulary {
        texts: Vec<String>,
    },
    TrainSgd {
        model: Sgd,
        examples: Vec<Example>,
    },
    LoadSgd {
        model: Sgd,
    },
    PredictSgd {
        model: Sgd,
        text: String,
    },
    TrainIis {
        model: Iis,
        examples: Vec<Example>,
    },
    LoadIis {
        model: Iis,
    },
    PredictIis {
        model: Iis,
        text: String,
    },
}

fn json<T: Serialize>(value: T) -> Result<Vec<u8>> {
    serde_json::to_vec(&value).map_err(|e| e.to_string())
}
pub fn execute(input: &[u8]) -> Result<Vec<u8>> {
    match serde_json::from_slice(input).map_err(|e| e.to_string())? {
        Request::FitVectorizer { model, texts } => json(model.fit(&texts)?),
        Request::LoadVectorizer { model } => {
            model.validate()?;
            json(model)
        }
        Request::TransformVectorizer { model, texts } => {
            model.validate()?;
            json(
                texts
                    .iter()
                    .map(|text| model.transform(text))
                    .collect::<Vec<_>>(),
            )
        }
        Request::TrainTree {
            labels,
            options,
            vectorizer,
            examples,
        } => {
            if examples.is_empty() {
                return Err("DecisionTree training requires examples".into());
            }
            let vectorizer =
                vectorizer.fit(&examples.iter().map(|r| r.text.clone()).collect::<Vec<_>>())?;
            // Validate all options before recursive training.
            let mut model = Tree {
                version: 1,
                labels,
                options,
                vectorizer,
                tree: TreeNode::Leaf {
                    label: examples[0].label.clone(),
                    counts: LabelCounts(vec![(examples[0].label.clone(), 1)]),
                },
            };
            model.validate()?;
            if examples.iter().any(|r| !model.labels.contains(&r.label)) {
                return Err("unknown decision tree label".into());
            }
            let rows: Vec<_> = examples
                .iter()
                .map(|r| TreeRow {
                    label: r.label.clone(),
                    indices: model.vectorizer.transform(&r.text).indices,
                })
                .collect();
            model.tree = build_tree(
                &rows.iter().collect::<Vec<_>>(),
                &model.vectorizer.vocabulary,
                &model.options,
                0,
            );
            json(model)
        }
        Request::LoadTree { model } => {
            model.validate()?;
            json(model)
        }
        Request::PredictTree { model, text } => {
            model.validate()?;
            json(model.predict(&text))
        }
        Request::SgdVocabulary { texts } => {
            json(counts(texts.iter().flat_map(|text| tokens(text)).collect()))
        }
        Request::TrainSgd { model, examples } => json(model.train(&examples)?),
        Request::LoadSgd { model } => {
            model.validate(true)?;
            json(model)
        }
        Request::PredictSgd { model, text } => {
            model.validate(false)?;
            if model.labels.is_empty() || model.vocabulary.is_empty() {
                return json(Vec::<Prediction>::new());
            }
            json(predictions(
                &model.labels,
                model.logits(&encode_sparse(&model.vocabulary, &text)),
                false,
            ))
        }
        Request::TrainIis { model, examples } => json(model.train(&examples)?),
        Request::LoadIis { model } => {
            model.validate(true)?;
            json(model)
        }
        Request::PredictIis { model, text } => {
            model.validate(false)?;
            let doc = model.encode(&counts(tokens(&text)), &model.mapping());
            json(predictions(&model.labels, model.logits(&doc), true))
        }
    }
}
