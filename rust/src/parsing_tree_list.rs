//! Python list index/slice plans. Payloads remain in JS so arbitrary leaves keep
//! their identity; Rust decides which child slots are retained or replaced.
use crate::parsing::Result;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Edit {
    Insert {
        index: i64,
    },
    Pop {
        index: i64,
    },
    Slice {
        start: Option<i64>,
        stop: Option<i64>,
        step: i64,
    },
    SetSlice {
        start: Option<i64>,
        stop: Option<i64>,
        step: i64,
        count: usize,
    },
    DeleteSlice {
        start: Option<i64>,
        stop: Option<i64>,
        step: i64,
    },
    Reverse,
}

fn slice(
    len: usize,
    start: Option<i64>,
    stop: Option<i64>,
    step: i64,
) -> Result<(i64, Vec<usize>)> {
    if step == 0 {
        return Err("slice step cannot be zero".into());
    }
    let n = len as i64;
    let normalize = |value: i64, low: i64, high: i64| {
        let value = if value < 0 {
            value.saturating_add(n)
        } else {
            value
        };
        value.clamp(low, high)
    };
    let (a, b) = if step > 0 {
        (
            start.map_or(0, |v| normalize(v, 0, n)),
            stop.map_or(n, |v| normalize(v, 0, n)),
        )
    } else {
        (
            start.map_or(n - 1, |v| normalize(v, -1, n - 1)),
            stop.map_or(-1, |v| normalize(v, -1, n - 1)),
        )
    };
    let mut indices = Vec::new();
    let mut i = a;
    while if step > 0 { i < b } else { i > b } {
        indices.push(i as usize);
        match i.checked_add(step) {
            Some(next) => i = next,
            None => break,
        }
    }
    Ok((a, indices))
}

/// Nonnegative slots refer to existing children; -1,-2,... to new payloads.
pub fn plan(len: usize, edit: Edit) -> Result<Vec<i64>> {
    if len > 1_000_000 {
        return Err("list exceeds 1000000 children".into());
    }
    let mut out: Vec<i64> = (0..len as i64).collect();
    match edit {
        Edit::Insert { index } => {
            if len == 1_000_000 {
                return Err("list exceeds 1000000 children".into());
            }
            let index = if index < 0 {
                index.saturating_add(len as i64)
            } else {
                index
            };
            out.insert(index.clamp(0, len as i64) as usize, -1);
        }
        Edit::Pop { index } => {
            let index = if index < 0 {
                index.saturating_add(len as i64)
            } else {
                index
            };
            if index < 0 || index >= len as i64 {
                return Err("pop index out of range".into());
            }
            out.remove(index as usize);
        }
        Edit::Slice { start, stop, step } => {
            return Ok(slice(len, start, stop, step)?
                .1
                .into_iter()
                .map(|i| i as i64)
                .collect());
        }
        Edit::SetSlice {
            start,
            stop,
            step,
            count,
        } => {
            if count > 1_000_000 {
                return Err("replacement exceeds 1000000 children".into());
            }
            let (a, indices) = slice(len, start, stop, step)?;
            if step == 1 {
                if len - indices.len() + count > 1_000_000 {
                    return Err("list exceeds 1000000 children".into());
                }
                out.splice(
                    a as usize..a as usize + indices.len(),
                    (0..count).map(|i| -(i as i64) - 1),
                );
            } else {
                if indices.len() != count {
                    return Err("extended slice replacement size mismatch".into());
                }
                for (i, slot) in indices.into_iter().enumerate() {
                    out[slot] = -(i as i64) - 1;
                }
            }
        }
        Edit::DeleteSlice { start, stop, step } => {
            let mut indices = slice(len, start, stop, step)?.1;
            indices.sort_unstable();
            let mut selected = indices.into_iter().peekable();
            out.retain(|slot| {
                if selected.peek() == Some(&(*slot as usize)) {
                    selected.next();
                    false
                } else {
                    true
                }
            });
        }
        Edit::Reverse => out.reverse(),
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn slices_and_mutations() {
        assert_eq!(
            plan(
                4,
                Edit::Slice {
                    start: None,
                    stop: None,
                    step: -1
                }
            )
            .unwrap(),
            vec![3, 2, 1, 0]
        );
        assert_eq!(
            plan(
                4,
                Edit::Slice {
                    start: None,
                    stop: Some(-1),
                    step: -1
                }
            )
            .unwrap(),
            Vec::<i64>::new()
        );
        assert_eq!(
            plan(4, Edit::Insert { index: i64::MIN }).unwrap(),
            vec![-1, 0, 1, 2, 3]
        );
        assert_eq!(
            plan(
                4,
                Edit::SetSlice {
                    start: Some(3),
                    stop: Some(1),
                    step: 1,
                    count: 2
                }
            )
            .unwrap(),
            vec![0, 1, 2, -1, -2, 3]
        );
        assert_eq!(
            plan(
                4,
                Edit::SetSlice {
                    start: None,
                    stop: None,
                    step: -2,
                    count: 2
                }
            )
            .unwrap(),
            vec![0, -2, 2, -1]
        );
        assert_eq!(
            plan(
                4,
                Edit::DeleteSlice {
                    start: None,
                    stop: None,
                    step: -2
                }
            )
            .unwrap(),
            vec![0, 2]
        );
        assert!(plan(
            4,
            Edit::SetSlice {
                start: None,
                stop: None,
                step: 2,
                count: 1
            }
        )
        .is_err());
        assert!(plan(0, Edit::Pop { index: -1 }).is_err());
        assert!(plan(
            4,
            Edit::Slice {
                start: None,
                stop: None,
                step: 0
            }
        )
        .is_err());
    }
}
