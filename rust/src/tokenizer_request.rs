use serde::Deserialize;

#[derive(Deserialize)]
pub struct Request {
    pub kind: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub tokens: Vec<String>,
    #[serde(default)]
    pub spans: bool,
    #[serde(default)]
    pub convert_parentheses: bool,
    #[serde(default = "default_blanklines")]
    pub blanklines: String,
    #[serde(default)]
    pub pattern: Option<String>,
    #[serde(default)]
    pub gaps: bool,
    #[serde(default = "yes")]
    pub discard_empty: bool,
    #[serde(default = "default_flags")]
    pub flags: u32,
    #[serde(default = "yes")]
    pub preserve_case: bool,
    #[serde(default)]
    pub reduce_len: bool,
    #[serde(default)]
    pub strip_handles: bool,
    #[serde(default = "yes")]
    pub match_phone_numbers: bool,
    #[serde(default)]
    pub return_str: bool,
    #[serde(default)]
    pub mwes: Vec<Vec<String>>,
    #[serde(default)]
    pub mwe_updates: Vec<MweUpdate>,
    #[serde(default = "default_separator")]
    pub separator: String,
}
#[derive(Deserialize)]
pub struct MweUpdate {
    pub tokens: Vec<String>,
    #[serde(default)]
    pub remove: bool,
}
fn yes() -> bool {
    true
}
fn default_flags() -> u32 {
    super::regexp_tokenizer::DEFAULT_FLAGS
}
fn default_blanklines() -> String {
    "discard".into()
}
fn default_separator() -> String {
    "_".into()
}
