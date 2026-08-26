use serde::Deserialize;
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;

const PACK_MAGIC: &[u8] = b"BNWN1";
const RESPONSE_MAGIC: &[u8] = b"BNWQ1";
const RESPONSE_NULL: u8 = 0;
const RESPONSE_SYNSET: u8 = 1;
const RESPONSE_SYNSETS: u8 = 2;
const RESPONSE_STRINGS: u8 = 3;
const RESPONSE_STRING: u8 = 4;
const RESPONSE_LOOKUPS: u8 = 5;
const RESPONSE_PATHS: u8 = 6;
const RESPONSE_U32: u8 = 7;
const RESPONSE_STATS: u8 = 8;

struct ResponseWriter {
    bytes: Vec<u8>,
}

impl ResponseWriter {
    fn new(tag: u8) -> Self {
        let mut bytes = Vec::with_capacity(256);
        bytes.extend_from_slice(RESPONSE_MAGIC);
        bytes.push(tag);
        Self { bytes }
    }

    fn u8(&mut self, value: u8) {
        self.bytes.push(value);
    }

    fn u32(&mut self, value: usize) {
        self.bytes.extend_from_slice(&(value as u32).to_le_bytes());
    }

    fn string(&mut self, value: &str) {
        self.u32(value.len());
        self.bytes.extend_from_slice(value.as_bytes());
    }

    fn strings(&mut self, values: &[String]) {
        self.u32(values.len());
        for value in values {
            self.string(value);
        }
    }
}

#[derive(Deserialize)]
struct RawPayload {
    synsets: Vec<RawSynset>,
}

#[derive(Deserialize)]
struct RawSynset {
    id: String,
    pos: String,
    #[serde(default)]
    lemmas: Vec<String>,
    #[serde(default)]
    gloss: String,
    #[serde(default)]
    examples: Vec<String>,
    #[serde(default)]
    hypernyms: Vec<String>,
    #[serde(default)]
    hyponyms: Vec<String>,
    #[serde(default, rename = "similarTo")]
    similar_to: Vec<String>,
    #[serde(default)]
    antonyms: Vec<String>,
}

struct Synset {
    id: String,
    pos: String,
    lemmas: Vec<String>,
    gloss: String,
    examples: Vec<String>,
    hypernyms: Vec<u32>,
    hyponyms: Vec<u32>,
    similar_to: Vec<u32>,
    antonyms: Vec<u32>,
}

#[derive(Deserialize)]
struct Query {
    op: String,
    #[serde(default)]
    id: String,
    #[serde(default)]
    other: String,
    #[serde(default)]
    word: String,
    #[serde(default)]
    pos: String,
    #[serde(default)]
    offset: String,
    #[serde(default = "default_max_depth")]
    max_depth: usize,
    #[serde(default)]
    relation: String,
    #[serde(default)]
    queries: Vec<LookupQuery>,
}

#[derive(Deserialize)]
struct LookupQuery {
    word: String,
    #[serde(default)]
    pos: String,
}

fn default_max_depth() -> usize {
    64
}

pub struct NativeWordNet {
    rows: Vec<Synset>,
    by_id: HashMap<String, u32>,
    lemma_index: HashMap<String, Vec<u32>>,
    last_request: Vec<u8>,
    last_response: Vec<u8>,
}

fn normalize_lemma(value: &str) -> String {
    value
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("_")
}

fn unique(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

fn noun_candidates(word: &str) -> Vec<String> {
    let lower = normalize_lemma(word);
    let mut out = vec![lower.clone()];
    if lower.ends_with("ies") && lower.len() > 3 {
        out.push(format!("{}y", &lower[..lower.len() - 3]));
    }
    if lower.ends_with("ves") && lower.len() > 3 {
        out.push(format!("{}f", &lower[..lower.len() - 3]));
    }
    if lower.ends_with("es") && lower.len() > 2 {
        out.push(lower[..lower.len() - 2].to_string());
    }
    if lower.ends_with('s') && lower.len() > 1 {
        out.push(lower[..lower.len() - 1].to_string());
    }
    unique(out)
}

fn verb_candidates(word: &str) -> Vec<String> {
    let lower = normalize_lemma(word);
    let mut out = vec![lower.clone()];
    if lower.ends_with("ies") && lower.len() > 3 {
        out.push(format!("{}y", &lower[..lower.len() - 3]));
    }
    if lower.ends_with("ing") && lower.len() > 4 {
        let stem = &lower[..lower.len() - 3];
        out.push(stem.to_string());
        out.push(format!("{}e", stem));
        let bytes = stem.as_bytes();
        if bytes.len() >= 2 && bytes[bytes.len() - 1] == bytes[bytes.len() - 2] {
            out.push(stem[..stem.len() - 1].to_string());
        }
    }
    if lower.ends_with("ed") && lower.len() > 3 {
        let stem = &lower[..lower.len() - 2];
        out.push(stem.to_string());
        out.push(lower[..lower.len() - 1].to_string());
        let bytes = stem.as_bytes();
        if bytes.len() >= 2 && bytes[bytes.len() - 1] == bytes[bytes.len() - 2] {
            out.push(stem[..stem.len() - 1].to_string());
        }
    }
    if lower.ends_with('s') && lower.len() > 1 {
        out.push(lower[..lower.len() - 1].to_string());
    }
    unique(out)
}

fn adjective_candidates(word: &str) -> Vec<String> {
    let lower = normalize_lemma(word);
    let mut out = vec![lower.clone()];
    if lower.ends_with("er") && lower.len() > 2 {
        out.push(lower[..lower.len() - 2].to_string());
    }
    if lower.ends_with("est") && lower.len() > 3 {
        out.push(lower[..lower.len() - 3].to_string());
    }
    unique(out)
}

fn morph_candidates(word: &str, pos: &str) -> Vec<String> {
    match pos {
        "n" => noun_candidates(word),
        "v" => verb_candidates(word),
        "a" => adjective_candidates(word),
        "r" => vec![normalize_lemma(word)],
        _ => unique(
            noun_candidates(word)
                .into_iter()
                .chain(verb_candidates(word))
                .chain(adjective_candidates(word))
                .chain(std::iter::once(normalize_lemma(word)))
                .collect(),
        ),
    }
}

// Preserve the candidate order exposed by the original stateless native helper.
// WordNet then validates the candidate against its lemma index before accepting it.
fn legacy_morph_candidate(word: &str, pos: &str) -> String {
    let lower = normalize_lemma(word);
    let replace_suffix = |suffix: &str, replacement: &str| {
        format!("{}{}", &lower[..lower.len() - suffix.len()], replacement)
    };
    match pos {
        "v" => {
            if lower.ends_with("ies") && lower.len() > 3 {
                replace_suffix("ies", "y")
            } else if lower.ends_with("ing") && lower.len() > 4 {
                replace_suffix("ing", "")
            } else if lower.ends_with("ed") && lower.len() > 3 {
                replace_suffix("ed", "")
            } else if lower.ends_with('s') && lower.len() > 1 {
                replace_suffix("s", "")
            } else {
                lower
            }
        }
        "a" => {
            if lower.ends_with("est") && lower.len() > 3 {
                replace_suffix("est", "")
            } else if lower.ends_with("er") && lower.len() > 2 {
                replace_suffix("er", "")
            } else {
                lower
            }
        }
        "r" => lower,
        _ => {
            if lower.ends_with("ies") && lower.len() > 3 {
                replace_suffix("ies", "y")
            } else if lower.ends_with("ves") && lower.len() > 3 {
                replace_suffix("ves", "f")
            } else if lower.ends_with("es") && lower.len() > 2 {
                replace_suffix("es", "")
            } else if lower.ends_with('s') && lower.len() > 1 {
                replace_suffix("s", "")
            } else {
                lower
            }
        }
    }
}

fn payload_bytes(bytes: &[u8]) -> Result<&[u8], String> {
    if !bytes.starts_with(PACK_MAGIC) {
        return Ok(bytes);
    }
    if bytes.len() < PACK_MAGIC.len() + 4 {
        return Err("wordnet pack header is truncated".to_string());
    }
    let start = PACK_MAGIC.len() + 4;
    let len = u32::from_le_bytes(bytes[PACK_MAGIC.len()..start].try_into().unwrap()) as usize;
    let end = start
        .checked_add(len)
        .ok_or_else(|| "wordnet pack length overflow".to_string())?;
    if end > bytes.len() {
        return Err("wordnet pack payload is truncated".to_string());
    }
    Ok(&bytes[start..end])
}

impl NativeWordNet {
    pub fn open(path: &str) -> Result<Self, String> {
        let bytes = fs::read(path).map_err(|error| error.to_string())?;
        let payload: RawPayload =
            serde_json::from_slice(payload_bytes(&bytes)?).map_err(|error| error.to_string())?;
        let mut by_id = HashMap::with_capacity(payload.synsets.len());
        for (index, row) in payload.synsets.iter().enumerate() {
            by_id.insert(row.id.clone(), index as u32);
        }

        let resolve = |ids: Vec<String>| -> Vec<u32> {
            ids.into_iter()
                .filter_map(|id| by_id.get(&id).copied())
                .collect()
        };
        let mut rows = Vec::with_capacity(payload.synsets.len());
        let mut lemma_index: HashMap<String, Vec<u32>> = HashMap::new();
        for (index, raw) in payload.synsets.into_iter().enumerate() {
            let lemmas: Vec<String> = raw
                .lemmas
                .into_iter()
                .map(|lemma| normalize_lemma(&lemma))
                .collect();
            for lemma in &lemmas {
                lemma_index
                    .entry(lemma.clone())
                    .or_default()
                    .push(index as u32);
            }
            rows.push(Synset {
                id: raw.id,
                pos: raw.pos,
                lemmas,
                gloss: raw.gloss,
                examples: raw.examples,
                hypernyms: resolve(raw.hypernyms),
                hyponyms: resolve(raw.hyponyms),
                similar_to: resolve(raw.similar_to),
                antonyms: resolve(raw.antonyms),
            });
        }

        Ok(Self {
            rows,
            by_id,
            lemma_index,
            last_request: Vec::new(),
            last_response: Vec::new(),
        })
    }

    fn write_row(&self, index: u32, writer: &mut ResponseWriter) {
        let row = &self.rows[index as usize];
        writer.string(&row.id);
        writer.u8(match row.pos.as_str() {
            "n" => 1,
            "v" => 2,
            "a" => 3,
            "r" => 4,
            _ => 0,
        });
        writer.strings(&row.lemmas);
        writer.string(&row.gloss);
        writer.strings(&row.examples);
        for relations in [
            &row.hypernyms,
            &row.hyponyms,
            &row.similar_to,
            &row.antonyms,
        ] {
            writer.u32(relations.len());
            for relation in relations {
                writer.string(&self.rows[*relation as usize].id);
            }
        }
    }

    fn write_rows(&self, indices: impl IntoIterator<Item = u32>, writer: &mut ResponseWriter) {
        let indices: Vec<u32> = indices.into_iter().collect();
        writer.u32(indices.len());
        for index in indices {
            self.write_row(index, writer);
        }
    }

    fn pos_matches(&self, index: u32, pos: &str) -> bool {
        pos.is_empty() || self.rows[index as usize].pos == pos
    }

    fn morphy(&self, word: &str, pos: &str) -> Option<String> {
        let legacy = legacy_morph_candidate(word, pos);
        if self
            .lemma_index
            .get(&legacy)
            .is_some_and(|rows| rows.iter().any(|index| self.pos_matches(*index, pos)))
        {
            return Some(legacy);
        }
        morph_candidates(word, pos).into_iter().find(|candidate| {
            self.lemma_index
                .get(candidate)
                .is_some_and(|rows| rows.iter().any(|index| self.pos_matches(*index, pos)))
        })
    }

    fn synsets(&self, word: &str, pos: &str) -> Vec<u32> {
        let lemma = self
            .morphy(word, pos)
            .unwrap_or_else(|| normalize_lemma(word));
        self.lemma_index
            .get(&lemma)
            .into_iter()
            .flatten()
            .copied()
            .filter(|index| self.pos_matches(*index, pos))
            .collect()
    }

    fn relation(&self, index: u32, relation: &str) -> &[u32] {
        let row = &self.rows[index as usize];
        match relation {
            "hypernyms" => &row.hypernyms,
            "hyponyms" => &row.hyponyms,
            "similarTo" => &row.similar_to,
            "antonyms" => &row.antonyms,
            _ => &[],
        }
    }

    fn hypernym_paths(&self, start: u32, max_depth: usize) -> Vec<Vec<u32>> {
        fn visit(
            model: &NativeWordNet,
            node: u32,
            path: &mut Vec<u32>,
            seen: &mut HashSet<u32>,
            depth: usize,
            max_depth: usize,
            out: &mut Vec<Vec<u32>>,
        ) {
            path.push(node);
            let parents: Vec<u32> = model.rows[node as usize]
                .hypernyms
                .iter()
                .copied()
                .filter(|parent| !seen.contains(parent))
                .collect();
            if parents.is_empty() || depth >= max_depth {
                out.push(path.clone());
            } else {
                for parent in parents {
                    seen.insert(parent);
                    visit(model, parent, path, seen, depth + 1, max_depth, out);
                    seen.remove(&parent);
                }
            }
            path.pop();
        }

        let mut out = Vec::new();
        let mut path = Vec::new();
        let mut seen = HashSet::from([start]);
        visit(
            self,
            start,
            &mut path,
            &mut seen,
            0,
            max_depth.max(1),
            &mut out,
        );
        out
    }

    fn shortest_path(&self, start: u32, target: u32, max_depth: usize) -> Option<usize> {
        if start == target {
            return Some(0);
        }
        let mut queue = VecDeque::from([(start, 0usize)]);
        let mut seen = HashSet::from([start]);
        while let Some((node, depth)) = queue.pop_front() {
            if depth >= max_depth.max(1) {
                continue;
            }
            let row = &self.rows[node as usize];
            for next in row.hypernyms.iter().chain(&row.hyponyms).copied() {
                if next == target {
                    return Some(depth + 1);
                }
                if seen.insert(next) {
                    queue.push_back((next, depth + 1));
                }
            }
        }
        None
    }

    fn ancestor_depths(&self, start: u32, max_depth: usize) -> HashMap<u32, usize> {
        let mut out = HashMap::new();
        let mut queue = VecDeque::from([(start, 0usize)]);
        while let Some((node, depth)) = queue.pop_front() {
            if out.get(&node).is_some_and(|previous| *previous <= depth) {
                continue;
            }
            out.insert(node, depth);
            if depth >= max_depth.max(1) {
                continue;
            }
            for parent in self.rows[node as usize].hypernyms.iter().copied() {
                queue.push_back((parent, depth + 1));
            }
        }
        out
    }

    fn lowest_common_hypernyms(&self, left: u32, right: u32, max_depth: usize) -> Vec<u32> {
        let left_depths = self.ancestor_depths(left, max_depth);
        let right_depths = self.ancestor_depths(right, max_depth);
        let mut best = usize::MAX;
        let mut out = Vec::new();
        for (index, left_depth) in left_depths {
            let Some(right_depth) = right_depths.get(&index) else {
                continue;
            };
            let score = left_depth + right_depth;
            if score < best {
                best = score;
                out.clear();
                out.push(index);
            } else if score == best {
                out.push(index);
            }
        }
        out.sort_by(|left, right| {
            self.rows[*left as usize]
                .id
                .cmp(&self.rows[*right as usize].id)
        });
        out
    }

    fn query_response(&self, query: Query) -> Result<Vec<u8>, String> {
        let index = |id: &str| self.by_id.get(id).copied();
        let pos_code = |pos: &str| match pos {
            "n" => 1,
            "v" => 2,
            "a" => 3,
            "r" => 4,
            _ => 0,
        };
        let mut writer;
        match query.op.as_str() {
            "stats" => {
                writer = ResponseWriter::new(RESPONSE_STATS);
                writer.u32(self.rows.len());
                writer.u32(self.lemma_index.len());
            }
            "synset" => {
                if let Some(row) = index(&query.id) {
                    writer = ResponseWriter::new(RESPONSE_SYNSET);
                    self.write_row(row, &mut writer);
                } else {
                    writer = ResponseWriter::new(RESPONSE_NULL);
                }
            }
            "all" => {
                writer = ResponseWriter::new(RESPONSE_SYNSETS);
                self.write_rows(
                    (0..self.rows.len() as u32).filter(|row| self.pos_matches(*row, &query.pos)),
                    &mut writer,
                );
            }
            "synsets" => {
                writer = ResponseWriter::new(RESPONSE_SYNSETS);
                self.write_rows(self.synsets(&query.word, &query.pos), &mut writer);
            }
            "lookup_batch" => {
                writer = ResponseWriter::new(RESPONSE_LOOKUPS);
                writer.u32(query.queries.len());
                for item in query.queries {
                    let root = self
                        .morphy(&item.word, &item.pos)
                        .unwrap_or_else(|| normalize_lemma(&item.word));
                    writer.string(&item.word);
                    writer.u8(pos_code(&item.pos));
                    writer.string(&root);
                    self.write_rows(self.synsets(&root, &item.pos), &mut writer);
                }
            }
            "lemmas" => {
                let mut lemmas: Vec<String> = self
                    .lemma_index
                    .iter()
                    .filter(|(_, rows)| rows.iter().any(|row| self.pos_matches(*row, &query.pos)))
                    .map(|(lemma, _)| lemma.clone())
                    .collect();
                lemmas.sort_unstable();
                writer = ResponseWriter::new(RESPONSE_STRINGS);
                writer.strings(&lemmas);
            }
            "morphy" => {
                if let Some(root) = self.morphy(&query.word, &query.pos) {
                    writer = ResponseWriter::new(RESPONSE_STRING);
                    writer.string(&root);
                } else {
                    writer = ResponseWriter::new(RESPONSE_NULL);
                }
            }
            "relation" => {
                writer = ResponseWriter::new(RESPONSE_SYNSETS);
                if let Some(row) = index(&query.id) {
                    self.write_rows(
                        self.relation(row, &query.relation).iter().copied(),
                        &mut writer,
                    );
                } else {
                    writer.u32(0);
                }
            }
            "from_offset" => {
                let digits: String = query
                    .offset
                    .chars()
                    .filter(|ch| ch.is_ascii_digit())
                    .collect();
                let id = format!("{:0>8}.{}", digits, query.pos);
                if let Some(row) = index(&id) {
                    writer = ResponseWriter::new(RESPONSE_SYNSET);
                    self.write_row(row, &mut writer);
                } else {
                    writer = ResponseWriter::new(RESPONSE_NULL);
                }
            }
            "from_sense_key" => {
                let lower = query.id.to_lowercase();
                let Some((lemma, rest)) = lower.split_once('%') else {
                    return Ok(ResponseWriter::new(RESPONSE_NULL).bytes);
                };
                let pos = match rest.chars().next() {
                    Some('1') => "n",
                    Some('2') => "v",
                    Some('3') => "a",
                    Some('4') => "r",
                    _ => "",
                };
                if let Some(row) = self.synsets(lemma, pos).first() {
                    writer = ResponseWriter::new(RESPONSE_SYNSET);
                    self.write_row(*row, &mut writer);
                } else {
                    writer = ResponseWriter::new(RESPONSE_NULL);
                }
            }
            "sense_keys" => {
                let rows = self.synsets(&query.word, &query.pos);
                let mut keys = Vec::new();
                for index in rows {
                    let row = &self.rows[index as usize];
                    let digit = match row.pos.as_str() {
                        "n" => "1",
                        "v" => "2",
                        "a" => "3",
                        _ => "4",
                    };
                    for lemma in &row.lemmas {
                        keys.push(format!("{}%{}:00:00::", lemma, digit));
                    }
                }
                keys.sort();
                keys.dedup();
                writer = ResponseWriter::new(RESPONSE_STRINGS);
                writer.strings(&keys);
            }
            "hypernym_paths" => {
                let Some(start) = index(&query.id) else {
                    let mut empty = ResponseWriter::new(RESPONSE_PATHS);
                    empty.u32(0);
                    return Ok(empty.bytes);
                };
                let paths = self.hypernym_paths(start, query.max_depth);
                writer = ResponseWriter::new(RESPONSE_PATHS);
                writer.u32(paths.len());
                for path in paths {
                    self.write_rows(path, &mut writer);
                }
            }
            "shortest_path" => {
                let (Some(left), Some(right)) = (index(&query.id), index(&query.other)) else {
                    return Ok(ResponseWriter::new(RESPONSE_NULL).bytes);
                };
                if let Some(distance) = self.shortest_path(left, right, query.max_depth) {
                    writer = ResponseWriter::new(RESPONSE_U32);
                    writer.u32(distance);
                } else {
                    writer = ResponseWriter::new(RESPONSE_NULL);
                }
            }
            "lowest_common_hypernyms" => {
                let (Some(left), Some(right)) = (index(&query.id), index(&query.other)) else {
                    let mut empty = ResponseWriter::new(RESPONSE_SYNSETS);
                    empty.u32(0);
                    return Ok(empty.bytes);
                };
                writer = ResponseWriter::new(RESPONSE_SYNSETS);
                self.write_rows(
                    self.lowest_common_hypernyms(left, right, query.max_depth),
                    &mut writer,
                );
            }
            _ => return Err(format!("unknown wordnet operation: {}", query.op)),
        }
        Ok(writer.bytes)
    }

    pub fn prepare_query(&mut self, request: &[u8]) -> Result<usize, String> {
        if self.last_request != request {
            let query: Query =
                serde_json::from_slice(request).map_err(|error| error.to_string())?;
            self.last_response = self.query_response(query)?;
            self.last_request.clear();
            self.last_request.extend_from_slice(request);
        }
        Ok(self.last_response.len())
    }

    pub fn fill_query(&self, out: &mut [u8]) -> Result<usize, String> {
        if out.len() < self.last_response.len() {
            return Err("wordnet response capacity is too small".to_string());
        }
        out[..self.last_response.len()].copy_from_slice(&self.last_response);
        Ok(self.last_response.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_match_basic_inflections() {
        assert!(noun_candidates("parties").contains(&"party".to_string()));
        assert!(verb_candidates("sprinted").contains(&"sprint".to_string()));
        assert!(adjective_candidates("faster").contains(&"fast".to_string()));
        assert_eq!(legacy_morph_candidate("aas", ""), "aa");
    }
}
