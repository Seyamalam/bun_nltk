use crate::ascii;
use crate::freqdist;
use crate::tagger;
use crate::CoreError;
use std::collections::HashMap;

struct TokenEntry {
    hash: u64,
    count: u64,
}

struct BigramEntry {
    left: u64,
    right: u64,
    count: u64,
}

struct ConditionalEntry {
    tag_id: u16,
    hash: u64,
    count: u64,
}

pub struct StreamFreqDistBuilder {
    token_counts: HashMap<u64, u64>,
    bigram_counts: HashMap<u128, u64>,
    conditional_counts: HashMap<u128, u64>,
    token_buffer: Vec<u8>,
    in_token: bool,
    token_hash: u64,
    has_prev_token: bool,
    prev_token_hash: u64,
}

fn encode_bigram_key(left: u64, right: u64) -> u128 {
    ((left as u128) << 64) | (right as u128)
}

fn decode_bigram_key(key: u128) -> (u64, u64) {
    ((key >> 64) as u64, (key & (u64::MAX as u128)) as u64)
}

fn encode_conditional_key(tag_id: u16, hash: u64) -> u128 {
    ((tag_id as u128) << 64) | (hash as u128)
}

fn decode_conditional_key(key: u128) -> (u16, u64) {
    ((key >> 64) as u16, (key & (u64::MAX as u128)) as u64)
}

impl StreamFreqDistBuilder {
    pub fn create() -> Self {
        StreamFreqDistBuilder {
            token_counts: HashMap::new(),
            bigram_counts: HashMap::new(),
            conditional_counts: HashMap::new(),
            token_buffer: Vec::new(),
            in_token: false,
            token_hash: ascii::FNV_OFFSET_BASIS,
            has_prev_token: false,
            prev_token_hash: 0,
        }
    }

    pub fn update_ascii(&mut self, input: &[u8]) -> Result<(), CoreError> {
        for &ch in input {
            if ascii::is_token_char(ch) {
                if !self.in_token {
                    self.in_token = true;
                    self.token_hash = ascii::FNV_OFFSET_BASIS;
                    self.token_buffer.clear();
                }
                self.token_hash = ascii::token_hash_update(self.token_hash, ch);
                self.token_buffer.push(ch);
            } else if self.in_token {
                self.finalize_current_token()?;
            }
        }
        Ok(())
    }

    pub fn flush(&mut self) -> Result<(), CoreError> {
        if self.in_token {
            self.finalize_current_token()?;
        }
        Ok(())
    }

    pub fn token_unique_count(&self) -> usize {
        self.token_counts.len()
    }

    pub fn bigram_unique_count(&self) -> usize {
        self.bigram_counts.len()
    }

    pub fn conditional_unique_count(&self) -> usize {
        self.conditional_counts.len()
    }

    pub fn fill_token_freq(
        &self,
        out_hashes: &mut [u64],
        out_counts: &mut [u64],
    ) -> Result<usize, CoreError> {
        if out_hashes.len() != out_counts.len() {
            return Err(CoreError::InsufficientCapacity);
        }
        let unique = self.token_counts.len();
        if out_hashes.len() < unique {
            return Err(CoreError::InsufficientCapacity);
        }

        let mut idx: usize = 0;
        for (&hash, &count) in self.token_counts.iter() {
            out_hashes[idx] = hash;
            out_counts[idx] = count;
            idx += 1;
        }
        Ok(unique)
    }

    pub fn fill_bigram_freq(
        &self,
        out_left_hashes: &mut [u64],
        out_right_hashes: &mut [u64],
        out_counts: &mut [u64],
    ) -> Result<usize, CoreError> {
        if out_left_hashes.len() != out_right_hashes.len() || out_left_hashes.len() != out_counts.len() {
            return Err(CoreError::InsufficientCapacity);
        }
        let unique = self.bigram_counts.len();
        if out_left_hashes.len() < unique {
            return Err(CoreError::InsufficientCapacity);
        }

        let mut idx: usize = 0;
        for (&key, &count) in self.bigram_counts.iter() {
            let (left, right) = decode_bigram_key(key);
            out_left_hashes[idx] = left;
            out_right_hashes[idx] = right;
            out_counts[idx] = count;
            idx += 1;
        }
        Ok(unique)
    }

    pub fn fill_conditional_freq(
        &self,
        out_tag_ids: &mut [u16],
        out_hashes: &mut [u64],
        out_counts: &mut [u64],
    ) -> Result<usize, CoreError> {
        if out_tag_ids.len() != out_hashes.len() || out_tag_ids.len() != out_counts.len() {
            return Err(CoreError::InsufficientCapacity);
        }
        let unique = self.conditional_counts.len();
        if out_tag_ids.len() < unique {
            return Err(CoreError::InsufficientCapacity);
        }

        let mut idx: usize = 0;
        for (&key, &count) in self.conditional_counts.iter() {
            let (tag_id, hash) = decode_conditional_key(key);
            out_tag_ids[idx] = tag_id;
            out_hashes[idx] = hash;
            out_counts[idx] = count;
            idx += 1;
        }
        Ok(unique)
    }

    pub fn count_json_bytes(&self) -> Result<usize, CoreError> {
        Ok(self.write_json().len())
    }

    pub fn fill_json(&self, out: &mut [u8]) -> Result<usize, CoreError> {
        let json = self.write_json();
        if out.len() < json.len() {
            return Err(CoreError::InsufficientCapacity);
        }
        out[..json.len()].copy_from_slice(json.as_bytes());
        Ok(json.len())
    }

    fn finalize_current_token(&mut self) -> Result<(), CoreError> {
        if self.token_buffer.is_empty() {
            self.in_token = false;
            return Ok(());
        }

        freqdist::update_count(&mut self.token_counts, self.token_hash);

        if self.has_prev_token {
            freqdist::update_count_u128(
                &mut self.bigram_counts,
                encode_bigram_key(self.prev_token_hash, self.token_hash),
            );
        }

        let tag_id = tagger::classify_token_ascii(&self.token_buffer, self.token_hash) as u16;
        freqdist::update_count_u128(
            &mut self.conditional_counts,
            encode_conditional_key(tag_id, self.token_hash),
        );

        self.prev_token_hash = self.token_hash;
        self.has_prev_token = true;
        self.in_token = false;
        self.token_hash = ascii::FNV_OFFSET_BASIS;
        self.token_buffer.clear();
        Ok(())
    }

    fn write_json(&self) -> String {
        let mut out = String::new();
        out.push_str("{\"tokens\":[");
        self.write_token_entries(&mut out);
        out.push_str("],\"bigrams\":[");
        self.write_bigram_entries(&mut out);
        out.push_str("],\"conditional_tags\":[");
        self.write_conditional_entries(&mut out);
        out.push_str("]}");
        out
    }

    fn write_token_entries(&self, out: &mut String) {
        let mut entries: Vec<TokenEntry> = self
            .token_counts
            .iter()
            .map(|(&hash, &count)| TokenEntry { hash, count })
            .collect();

        entries.sort_by_key(|e| e.hash);

        let mut first = true;
        for entry in entries {
            if !first {
                out.push(',');
            }
            first = false;
            out.push_str(&format!("{{\"hash\":\"{}\",\"count\":{}}}", entry.hash, entry.count));
        }
    }

    fn write_bigram_entries(&self, out: &mut String) {
        let mut entries: Vec<BigramEntry> = self
            .bigram_counts
            .iter()
            .map(|(&key, &count)| {
                let (left, right) = decode_bigram_key(key);
                BigramEntry { left, right, count }
            })
            .collect();

        entries.sort_by(|a, b| a.left.cmp(&b.left).then(a.right.cmp(&b.right)));

        let mut first = true;
        for entry in entries {
            if !first {
                out.push(',');
            }
            first = false;
            out.push_str(&format!(
                "{{\"left\":\"{}\",\"right\":\"{}\",\"count\":{}}}",
                entry.left, entry.right, entry.count
            ));
        }
    }

    fn write_conditional_entries(&self, out: &mut String) {
        let mut entries: Vec<ConditionalEntry> = self
            .conditional_counts
            .iter()
            .map(|(&key, &count)| {
                let (tag_id, hash) = decode_conditional_key(key);
                ConditionalEntry { tag_id, hash, count }
            })
            .collect();

        entries.sort_by(|a, b| a.tag_id.cmp(&b.tag_id).then(a.hash.cmp(&b.hash)));

        let mut first = true;
        for entry in entries {
            if !first {
                out.push(',');
            }
            first = false;
            out.push_str(&format!(
                "{{\"tag_id\":{},\"hash\":\"{}\",\"count\":{}}}",
                entry.tag_id, entry.hash, entry.count
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ascii;

    #[test]
    fn stream_freqdist_update_and_flush_across_chunk_boundaries() {
        let mut builder = StreamFreqDistBuilder::create();

        builder.update_ascii(b"Th").unwrap();
        builder.update_ascii(b"is this ").unwrap();
        builder.update_ascii(b"is a test").unwrap();
        builder.flush().unwrap();

        assert_eq!(builder.token_unique_count(), 4);
        assert_eq!(builder.bigram_unique_count(), 4);

        let mut hashes = [0u64; 8];
        let mut counts = [0u64; 8];
        let written = builder.fill_token_freq(&mut hashes, &mut counts).unwrap();
        assert_eq!(written, 4);

        use std::collections::HashMap as Map;
        let mut out: Map<u64, u64> = Map::new();
        for idx in 0..written {
            out.insert(hashes[idx], counts[idx]);
        }

        assert_eq!(out.get(&ascii::hash_token(b"this")), Some(&2));
        assert_eq!(out.get(&ascii::hash_token(b"is")), Some(&1));
        assert_eq!(out.get(&ascii::hash_token(b"a")), Some(&1));
        assert_eq!(out.get(&ascii::hash_token(b"test")), Some(&1));
    }

    #[test]
    fn stream_freqdist_json_export() {
        let mut builder = StreamFreqDistBuilder::create();

        builder.update_ascii(b"Quickly running quickly").unwrap();
        builder.flush().unwrap();

        let bytes = builder.count_json_bytes().unwrap();
        let mut out = vec![0u8; bytes];
        let written = builder.fill_json(&mut out).unwrap();
        assert_eq!(bytes, written);

        let json = String::from_utf8(out[..written].to_vec()).unwrap();
        assert!(json.starts_with("{\"tokens\":["));
        assert!(json.contains("\"bigrams\":["));
        assert!(json.contains("\"conditional_tags\":["));
    }
}
