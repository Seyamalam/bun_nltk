//! Dedicated f64-buffer ABI, separate from the categorical classifier ABI.
//! Input integers are checked before conversion. Outputs start with a status
//! (0 success, 1 invalid, 2 empty base, 3 division by zero, 4 None probability,
//! 5 bad feature id, 6 missing handle). No platform-specific native binary.
use crate::maxent_encoding::{InputFeature, Key, MaxentEncoding};
use crate::probability_contracts::{self as probability, ContractError, KneserNey, Result};
#[cfg(target_arch = "wasm32")]
use crate::wasm_exports::{offset_slice, offset_slice_mut};
use std::cell::RefCell;
use std::collections::HashMap;

enum Model {
    Kneser(KneserNey),
    Encoding(MaxentEncoding),
}
thread_local! {
    static MODELS: RefCell<(u32, HashMap<u32, Model>)> = RefCell::new((0, HashMap::new()));
}

struct Reader<'a> {
    input: &'a [f64],
    index: usize,
}
impl<'a> Reader<'a> {
    fn new(input: &'a [f64]) -> Self {
        Self { input, index: 0 }
    }
    fn number(&mut self) -> Result<f64> {
        let v = *self.input.get(self.index).ok_or(ContractError::Invalid)?;
        self.index += 1;
        Ok(v)
    }
    fn id(&mut self) -> Result<u32> {
        let n = probability::count(self.number()?)?;
        u32::try_from(n).map_err(|_| ContractError::Invalid)
    }
    fn end(&self) -> Result<()> {
        if self.index == self.input.len() {
            Ok(())
        } else {
            Err(ContractError::Invalid)
        }
    }
    fn features(&mut self) -> Result<Vec<InputFeature>> {
        let n = self.id()? as usize;
        if n > (self.input.len() - self.index) / 5 {
            return Err(ContractError::Invalid);
        }
        let mut result = Vec::with_capacity(n);
        for _ in 0..n {
            result.push(InputFeature {
                name: self.id()?,
                key: self.id()?,
                display: self.id()?,
                kind: self.id()?,
                value: self.number()?,
            });
        }
        Ok(result)
    }
}

fn register(model: Model) -> Result<Vec<f64>> {
    MODELS.with(|models| {
        let mut state = models.borrow_mut();
        let id = state.0.checked_add(1).ok_or(ContractError::Invalid)?;
        state.0 = id;
        state.1.insert(id, model);
        Ok(vec![id as f64])
    })
}

fn key_parts(key: Key) -> (f64, f64) {
    match key {
        Key::Value(id) => (0.0, id as f64),
        Key::Int => (1.0, 0.0),
        Key::Float => (2.0, 0.0),
        Key::Bool => (3.0, 0.0),
    }
}

fn dispatch(op: u32, input: &[f64]) -> Result<Vec<f64>> {
    let mut r = Reader::new(input);
    match op {
        1 => {
            let bins = r.number()?;
            let n = r.id()? as usize;
            if n > (input.len() - r.index) / 2 {
                return Err(ContractError::Invalid);
            }
            let mut base = Vec::with_capacity(n);
            let mut held = Vec::with_capacity(n);
            for _ in 0..n {
                base.push(r.number()?);
                held.push(r.number()?);
            }
            r.end()?;
            let estimates = probability::heldout(&base, &held, (!bins.is_nan()).then_some(bins))?;
            base.iter()
                .chain(std::iter::once(&0.0))
                .map(|&b| {
                    Ok(estimates
                        .get(&probability::count(b)?)
                        .copied()
                        .flatten()
                        .unwrap_or(f64::NAN))
                })
                .collect()
        }
        2 => {
            let bins = r.number()?;
            let n = r.id()? as usize;
            let width = r.id()? as usize;
            if n > input.len() - r.index || width > input.len() {
                return Err(ContractError::Invalid);
            }
            let mut rows = Vec::with_capacity(n);
            let mut identities = Vec::with_capacity(n);
            for _ in 0..n {
                identities.push(r.id()?);
                let mut row = Vec::with_capacity(width);
                for _ in 0..width {
                    row.push(r.number()?);
                }
                rows.push(row);
            }
            r.end()?;
            probability::cross_validation(&rows, &identities, (!bins.is_nan()).then_some(bins))
        }
        3 => {
            let discount = r.number()?;
            let n = r.id()? as usize;
            if n > (input.len() - r.index) / 4 {
                return Err(ContractError::Invalid);
            }
            let mut rows = Vec::with_capacity(n);
            for _ in 0..n {
                rows.push((r.id()?, r.id()?, r.id()?, r.number()?));
            }
            r.end()?;
            register(Model::Kneser(KneserNey::new(&rows, discount)?))
        }
        6 | 7 => {
            let typed = r.id()?;
            let always = r.id()?;
            let unseen = r.id()?;
            if typed > 1 || always > 1 || unseen > 1 {
                return Err(ContractError::Invalid);
            }
            let cutoff = r.number()?;
            let n = r.id()? as usize;
            if n > input.len() - r.index {
                return Err(ContractError::Invalid);
            }
            let mut labels = Vec::with_capacity(n);
            for _ in 0..n {
                labels.push(r.id()?);
            }
            let model = if op == 6 {
                let n = r.id()? as usize;
                if n > input.len() - r.index {
                    return Err(ContractError::Invalid);
                }
                let mut rows = Vec::with_capacity(n);
                for _ in 0..n {
                    let label = r.id()?;
                    rows.push((r.features()?, label));
                }
                MaxentEncoding::train(typed != 0, labels, &rows, cutoff, always != 0, unseen != 0)?
            } else {
                let n = r.id()? as usize;
                if n > (input.len() - r.index) / 5 {
                    return Err(ContractError::Invalid);
                }
                let mut features = Vec::with_capacity(n);
                let mut displays = Vec::with_capacity(n);
                for _ in 0..n {
                    let name = r.id()?;
                    let kind = r.id()?;
                    let value = r.id()?;
                    let label = r.id()?;
                    displays.push(r.id()?);
                    let key = match kind {
                        0 => Key::Value(value),
                        1 => Key::Int,
                        2 => Key::Float,
                        3 => Key::Bool,
                        _ => return Err(ContractError::Invalid),
                    };
                    features.push((name, key, label));
                }
                MaxentEncoding::new(
                    typed != 0,
                    labels,
                    features,
                    displays,
                    always != 0,
                    unseen != 0,
                )?
            };
            r.end()?;
            register(Model::Encoding(model))
        }
        4 | 5 | 8 | 9 | 10 => {
            let handle = r.id()?;
            MODELS.with(|models| {
                let mut state = models.borrow_mut();
                if op == 10 {
                    r.end()?;
                    state.1.remove(&handle);
                    return Ok(Vec::new());
                }
                let model = state
                    .1
                    .get_mut(&handle)
                    .ok_or(ContractError::MissingHandle)?;
                let result = match (op, model) {
                    (4, Model::Kneser(m)) => vec![m.prob((r.id()?, r.id()?, r.id()?))?],
                    (5, Model::Kneser(m)) => {
                        m.set_discount(r.number()?)?;
                        Vec::new()
                    }
                    (8, Model::Encoding(m)) => {
                        let label = r.id()?;
                        m.encode(&r.features()?, label)?
                            .into_iter()
                            .flat_map(|(id, v)| [id as f64, v])
                            .collect()
                    }
                    (9, Model::Encoding(m)) => {
                        let mut out = vec![
                            m.labels.len() as f64,
                            m.features.len() as f64,
                            m.always.len() as f64,
                            m.unseen.len() as f64,
                        ];
                        out.extend(m.labels.iter().map(|&l| l as f64));
                        for (index, &(name, key, label)) in m.features.iter().enumerate() {
                            let (kind, value) = key_parts(key);
                            out.extend([
                                name as f64,
                                kind,
                                value,
                                label as f64,
                                m.displays[index] as f64,
                            ]);
                        }
                        for &(label, id) in &m.always {
                            out.extend([label as f64, id as f64]);
                        }
                        for &(name, id) in &m.unseen {
                            out.extend([name as f64, id as f64]);
                        }
                        out
                    }
                    _ => return Err(ContractError::Invalid),
                };
                r.end()?;
                Ok(result)
            })
        }
        11 => {
            let p = r.number()?;
            r.end()?;
            if p.is_nan() {
                return Err(ContractError::NoneProbability);
            }
            if p < 0.0 {
                return Err(ContractError::Invalid);
            }
            Ok(vec![if p == 0.0 { -1e300 } else { p.log2() }])
        }
        12 => {
            let n = r.id()? as usize;
            if n == 0 {
                return Err(ContractError::EmptyBase);
            }
            let mut best = 0;
            let mut greatest = -1.0;
            for i in 0..n {
                let value = r.number()?;
                probability::count(value)?;
                if value > greatest {
                    best = i;
                    greatest = value;
                }
            }
            r.end()?;
            Ok(vec![best as f64])
        }
        _ => Err(ContractError::Invalid),
    }
}

#[no_mangle]
#[cfg(target_arch = "wasm32")]
pub extern "C" fn bunnltk_wasm_probability_contract(
    op: u32,
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    // Reject unaligned, overlapping or out-of-memory ranges before constructing
    // slices. All ABI callers allocate distinct aligned staging buffers.
    let memory_bytes = core::arch::wasm32::memory_size::<0>() as u64 * 65_536;
    let input_end = input_ptr as u64 + input_len as u64 * 8;
    let out_end = out_ptr as u64 + out_len as u64 * 8;
    if input_ptr % 8 != 0
        || out_ptr % 8 != 0
        || out_ptr == 0
        || out_len == 0
        || (input_len > 0 && input_ptr == 0)
        || input_end > memory_bytes
        || out_end > memory_bytes
        || (input_len > 0 && (input_ptr as u64) < out_end && (out_ptr as u64) < input_end)
        || (matches!(op, 3 | 6 | 7) && out_len < 2)
    {
        return 0;
    }
    let input = unsafe { offset_slice(input_ptr, input_len as usize) };
    let result = dispatch(op, input);
    let (status, values) = match result {
        Ok(values) => (0.0, values),
        Err(error) => (
            match error {
                ContractError::Invalid => 1.0,
                ContractError::EmptyBase => 2.0,
                ContractError::ZeroDivision => 3.0,
                ContractError::NoneProbability => 4.0,
                ContractError::BadFeatureId => 5.0,
                ContractError::MissingHandle => 6.0,
            },
            Vec::new(),
        ),
    };
    let out = unsafe { offset_slice_mut(out_ptr, out_len as usize) };
    if out.len() < values.len() + 1 {
        return 0;
    }
    out[0] = status;
    out[1..values.len() + 1].copy_from_slice(&values);
    (values.len() + 1) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn abi_rejects_malformed_buffers() {
        for op in 1..=10 {
            assert!(dispatch(op, &[]).is_err());
        }
        assert!(dispatch(6, &[1.0, 0.0, 0.0, 0.0, 1e9]).is_err());
        assert!(dispatch(3, &[0.75, 1.0, 0.0, 0.0, 0.0, -1.0]).is_err());
        assert!(dispatch(4, &[1.5, 0.0, 0.0, 0.0]).is_err());
    }
}
