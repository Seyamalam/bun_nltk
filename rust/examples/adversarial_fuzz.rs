//! Stable native seeded runner; for coverage-guided fuzzing see rust/fuzz.
#[path = "adversarial/seeds.rs"]
mod seeds;
#[path = "adversarial/targets.rs"]
mod targets;
use std::{env, fs, path::PathBuf};

fn main() {
    let mut seed = 1337u32;
    let mut count = 500usize;
    let mut replay = None;
    let mut replay_out: Option<PathBuf> = None;
    let mut corpus_dir: Option<PathBuf> = None;
    let mut args = env::args().skip(1);
    while let Some(flag) = args.next() {
        let value = args.next().expect("each flag requires a value");
        match flag.as_str() {
            "--seed" => seed = value.parse().expect("u32 seed"),
            "--cases" => count = value.parse().expect("integer cases"),
            "--replay" => replay = Some(PathBuf::from(value)),
            "--replay-out" => replay_out = Some(PathBuf::from(value)),
            "--write-corpus" => corpus_dir = Some(PathBuf::from(value)),
            _ => panic!("unknown flag: {flag}"),
        }
    }
    assert!((1..=100_000).contains(&count), "cases must be 1..100000");
    if let Some(path) = replay {
        assert!(
            fs::metadata(&path).unwrap().len() <= targets::MAX_BYTES as u64,
            "replay input exceeds 16 KiB"
        );
        let data = fs::read(path).unwrap();
        assert!(
            data.len() <= targets::MAX_BYTES,
            "replay input exceeds 16 KiB"
        );
        targets::exercise(&data);
        println!("replay completed");
        return;
    }
    let corpus = seeds::corpus();
    if let Some(path) = corpus_dir {
        fs::create_dir_all(&path).unwrap();
        for (i, data) in corpus.iter().enumerate() {
            fs::write(path.join(format!("seed-{i:03}")), data).unwrap();
        }
    }
    let initial_seed = seed;
    let mut random = || {
        seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
        seed
    };
    let execute = |data: &[u8]| {
        // Persist before entry: panics/aborts/timeouts leave an exact replay file.
        if let Some(path) = &replay_out {
            fs::write(path, data).unwrap();
        }
        targets::exercise(data);
    };
    for data in &corpus {
        execute(data);
    }
    for _ in 0..count {
        let mut data = corpus[random() as usize % corpus.len()].clone();
        for _ in 0..1 + random() % 8 {
            match random() % 4 {
                0 if data.len() > 1 => {
                    let i = 1 + random() as usize % (data.len() - 1);
                    data[i] ^= 1 << (random() % 8);
                }
                1 if data.len() > 1 => {
                    data.truncate(1 + random() as usize % data.len());
                }
                2 if data.len() < targets::MAX_BYTES => {
                    data.push(random() as u8);
                }
                _ => {
                    data[0] = (random() % 6) as u8;
                }
            }
        }
        execute(&data);
    }
    println!(
        "seed={initial_seed} corpus={} mutations={count} max_bytes={} completed",
        corpus.len(),
        targets::MAX_BYTES
    );
}
