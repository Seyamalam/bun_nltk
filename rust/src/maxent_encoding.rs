//! Standalone NLTK joint feature encodings. This does not replace or change
//! categorical_maxent's existing training/serialization contract.
use crate::probability_contracts::{ContractError, Result};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Key {
    Value(u32),
    Int,
    Float,
    Bool,
}

#[derive(Debug, Clone, Copy)]
pub struct InputFeature {
    pub name: u32,
    pub key: u32,
    pub display: u32,
    /// 0: nonnumeric, 1: int, 2: float, 3: bool.
    pub kind: u32,
    pub value: f64,
}

impl InputFeature {
    fn training_key(self, typed: bool) -> Key {
        match (typed, self.kind) {
            (true, 1) => Key::Int,
            (true, 2) => Key::Float,
            _ => Key::Value(self.key),
        }
    }
    fn prediction_key(self, typed: bool) -> Key {
        match (typed, self.kind) {
            (true, 3) => Key::Bool, // Python bool is an int subclass at encode time.
            _ => self.training_key(typed),
        }
    }
}

pub struct MaxentEncoding {
    pub typed: bool,
    pub labels: Vec<u32>,
    pub features: Vec<(u32, Key, u32)>,
    pub displays: Vec<u32>,
    mapping: HashMap<(u32, Key, u32), u32>,
    pub always: Vec<(u32, u32)>,
    pub unseen: Vec<(u32, u32)>,
}

impl MaxentEncoding {
    pub fn new(
        typed: bool,
        labels: Vec<u32>,
        features: Vec<(u32, Key, u32)>,
        displays: Vec<u32>,
        always: bool,
        unseen: bool,
    ) -> Result<Self> {
        if displays.len() != features.len() {
            return Err(ContractError::Invalid);
        }
        let mut mapping = HashMap::new();
        for (id, &feature) in features.iter().enumerate() {
            if mapping.insert(feature, id as u32).is_some() {
                return Err(ContractError::Invalid);
            }
        }
        let mut result = Self {
            typed,
            labels,
            features,
            displays,
            mapping,
            always: Vec::new(),
            unseen: Vec::new(),
        };
        if always {
            let mut seen = HashSet::new();
            for &label in &result.labels {
                if !seen.insert(label) {
                    return Err(ContractError::Invalid);
                }
                result
                    .always
                    .push((label, (result.features.len() + result.always.len()) as u32));
            }
        }
        if unseen {
            let mut names = HashSet::new();
            for &(name, _, _) in &result.features {
                if names.insert(name) {
                    result.unseen.push((
                        name,
                        (result.features.len() + result.always.len() + result.unseen.len()) as u32,
                    ));
                }
            }
        }
        Ok(result)
    }

    pub fn train(
        typed: bool,
        labels: Vec<u32>,
        rows: &[(Vec<InputFeature>, u32)],
        cutoff: f64,
        always: bool,
        unseen: bool,
    ) -> Result<Self> {
        if !cutoff.is_finite() {
            return Err(ContractError::Invalid);
        }
        let mut counts = HashMap::new();
        let mut mapped = HashSet::new();
        let mut features = Vec::new();
        let mut displays = Vec::new();
        for (row, label) in rows {
            for &input in row {
                if input.kind > 3 || input.value.is_nan() {
                    return Err(ContractError::Invalid);
                }
                let key = input.training_key(typed);
                // NLTK counts (name,value), shared across labels; it does not
                // retroactively include labels from before the cutoff.
                let n = counts.entry((input.name, key)).or_insert(0_u64);
                *n += 1;
                let feature = (input.name, key, *label);
                if *n as f64 >= cutoff && mapped.insert(feature) {
                    features.push(feature);
                    displays.push(input.display);
                }
            }
        }
        Self::new(typed, labels, features, displays, always, unseen)
    }

    pub fn length(&self) -> usize {
        self.features.len() + self.always.len() + self.unseen.len()
    }

    pub fn encode(&self, inputs: &[InputFeature], label: u32) -> Result<Vec<(u32, f64)>> {
        let mut encoded = Vec::new();
        for &input in inputs {
            if input.kind > 3 || input.value.is_nan() {
                return Err(ContractError::Invalid);
            }
            let key = input.prediction_key(self.typed);
            if let Some(&id) = self.mapping.get(&(input.name, key, label)) {
                encoded.push((
                    id,
                    if self.typed && input.kind > 0 {
                        input.value
                    } else {
                        1.0
                    },
                ));
            } else if !(self.typed && input.kind > 0)
                && !self
                    .labels
                    .iter()
                    .any(|&l| self.mapping.contains_key(&(input.name, key, l)))
            {
                if let Some(&(_, id)) = self.unseen.iter().find(|&&(name, _)| name == input.name) {
                    encoded.push((id, 1.0));
                }
            }
        }
        if let Some(&(_, id)) = self.always.iter().find(|&&(l, _)| l == label) {
            encoded.push((id, 1.0));
        }
        Ok(encoded)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn f(kind: u32, key: u32, value: f64) -> InputFeature {
        InputFeature {
            name: 0,
            kind,
            key,
            display: key,
            value,
        }
    }
    #[test]
    fn cutoff_is_shared_not_retroactive() {
        let m = MaxentEncoding::train(
            false,
            vec![0, 1],
            &[(vec![f(0, 1, 0.0)], 0), (vec![f(0, 1, 0.0)], 1)],
            2.0,
            true,
            true,
        )
        .unwrap();
        assert_eq!(m.features, vec![(0, Key::Value(1), 1)]);
        assert_eq!(m.encode(&[f(0, 1, 0.0)], 0).unwrap(), vec![(1, 1.0)]);
        assert_eq!(
            m.encode(&[f(0, 2, 0.0)], 0).unwrap(),
            vec![(3, 1.0), (1, 1.0)]
        );
    }
    #[test]
    fn typed_bool_and_numeric_types_are_distinct() {
        let m = MaxentEncoding::train(
            true,
            vec![0],
            &[
                (vec![f(3, 1, 1.0)], 0),
                (vec![f(1, 1, 1.0)], 0),
                (vec![f(2, 1, 1.0)], 0),
            ],
            0.0,
            false,
            true,
        )
        .unwrap();
        assert_eq!(m.encode(&[f(3, 1, 1.0)], 0).unwrap(), vec![]);
        assert_eq!(m.encode(&[f(1, 2, -2.0)], 0).unwrap(), vec![(1, -2.0)]);
        assert_eq!(m.encode(&[f(2, 2, 1.5)], 0).unwrap(), vec![(2, 1.5)]);
    }
}
