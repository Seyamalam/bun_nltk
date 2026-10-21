//! Batch oracle-verifier transport; no Python or JS algorithms in the candidate.
use std::io::{self, Read};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let requests: Vec<bun_nltk::tokenizers::Request> = serde_json::from_str(&input)?;
    let responses: Result<Vec<_>, _> = requests
        .into_iter()
        .map(bun_nltk::tokenizers::execute)
        .collect();
    println!("{}", serde_json::to_string(&responses?)?);
    Ok(())
}
