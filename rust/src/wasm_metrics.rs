//! Stateless evaluation ABI. Status 1 is None, 2 division by zero, 3 invalid input.
//! Pointers are offsets in WASM linear memory; every range is checked before use.
use crate::metrics::{self, MetricError, MetricResult};

unsafe fn input<'a, T>(ptr: u32, len: u32) -> Result<&'a [T], MetricError> {
    if len == 0 {
        return Ok(&[]);
    }
    let bytes = (len as usize)
        .checked_mul(std::mem::size_of::<T>())
        .ok_or(MetricError::InvalidInput)?;
    let end = (ptr as usize)
        .checked_add(bytes)
        .ok_or(MetricError::InvalidInput)?;
    if ptr == 0 || !(ptr as usize).is_multiple_of(std::mem::align_of::<T>()) {
        return Err(MetricError::InvalidInput);
    }
    #[cfg(target_arch = "wasm32")]
    if end > core::arch::wasm32::memory_size(0) * 65536 {
        return Err(MetricError::InvalidInput);
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = end;
    Ok(crate::wasm_exports::offset_slice(ptr, len as usize))
}
unsafe fn output<'a, T>(ptr: u32, len: u32) -> Result<&'a mut [T], MetricError> {
    input::<T>(ptr, len)?;
    if len == 0 {
        return Ok(&mut []);
    }
    Ok(crate::wasm_exports::offset_slice_mut(ptr, len as usize))
}
fn status(error: MetricError) -> u32 {
    match error {
        MetricError::ZeroDivision => 2,
        MetricError::InvalidInput => 3,
        MetricError::MissingLabel => 4,
        MetricError::Overflow => 5,
    }
}
unsafe fn scalar(result: MetricResult, out: u32) -> u32 {
    match result {
        Ok(None) => 1,
        Ok(Some(value)) => match output::<f64>(out, 1) {
            Ok(out) => {
                out[0] = value;
                0
            }
            Err(e) => status(e),
        },
        Err(e) => status(e),
    }
}

/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_set_score(
    op: u32,
    ap: u32,
    an: u32,
    bp: u32,
    bn: u32,
    label: u32,
    alpha: f64,
    out: u32,
) -> u32 {
    scalar(
        (|| metrics::set_score(op, input(ap, an)?, input(bp, bn)?, label, alpha))(),
        out,
    )
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub extern "C" fn bunnltk_wasm_interval_score(a: f64, b: f64) -> f64 {
    metrics::interval(a, b)
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub extern "C" fn bunnltk_wasm_binary_score(equal: u32) -> f64 {
    if equal == 0 {
        1.0
    } else {
        0.0
    }
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_accuracy_score(
    ap: u32,
    an: u32,
    bp: u32,
    bn: u32,
    out: u32,
) -> u32 {
    scalar(
        (|| metrics::accuracy(input(ap, an)?, input(bp, bn)?))(),
        out,
    )
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_log_likelihood_score(p: u32, n: u32, out: u32) -> u32 {
    scalar((|| metrics::log_likelihood(input(p, n)?))(), out)
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_spearman_score(
    ap: u32,
    ar: u32,
    an: u32,
    bp: u32,
    br: u32,
    bn: u32,
    out: u32,
) -> u32 {
    scalar(
        (|| {
            metrics::spearman(
                input(ap, an)?,
                input(ar, an)?,
                input(bp, bn)?,
                input(br, bn)?,
            )
        })(),
        out,
    )
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_ranks_from_scores(p: u32, n: u32, gap: f64, out: u32) -> u32 {
    let result = (|| {
        let ranks = metrics::ranks_from_scores(input(p, n)?, gap);
        output::<u32>(out, n)?.copy_from_slice(&ranks);
        Ok::<_, MetricError>(())
    })();
    match result {
        Ok(()) => 0,
        Err(e) => status(e),
    }
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_segmentation_score(
    ap: u32,
    bp: u32,
    n: u32,
    abp: u32,
    abn: u32,
    bbp: u32,
    bbn: u32,
    flags: u32,
    k: f64,
    out: u32,
) -> u32 {
    let result = (|| {
        let k = if flags & 8 != 0 {
            None
        } else {
            if !k.is_finite() || k.fract() != 0.0 || k.abs() > 9007199254740991.0 {
                return Err(MetricError::InvalidInput);
            }
            Some(k as i64)
        };
        metrics::segmentation(
            metrics::Segmentation {
                values: input(ap, n)?,
                boundary: input(abp, abn)?,
                string: flags & 1 != 0,
            },
            metrics::Segmentation {
                values: input(bp, n)?,
                boundary: input(bbp, bbn)?,
                string: flags & 2 != 0,
            },
            k,
            flags & 4 != 0,
            flags & 16 != 0,
        )
    })();
    scalar(result, out)
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_confusion_build(
    ap: u32,
    bp: u32,
    n: u32,
    count: u32,
    mode: u32,
    keys: u32,
    offsets: u32,
    keys_len: u32,
    labels: u32,
    cells: u32,
    meta: u32,
) -> u32 {
    let result = (|| {
        let text;
        let order = match mode {
            0 => metrics::LabelOrder::Identity(count as usize),
            1 => metrics::LabelOrder::Numeric(input(keys, count)?),
            2 => {
                let keys: &[u32] = input(keys, keys_len)?;
                let offsets: &[u32] = input(
                    offsets,
                    count.checked_add(1).ok_or(MetricError::InvalidInput)?,
                )?;
                if offsets.first() != Some(&0)
                    || offsets.last() != Some(&keys_len)
                    || offsets.windows(2).any(|v| v[0] > v[1])
                {
                    return Err(MetricError::InvalidInput);
                }
                text = offsets
                    .windows(2)
                    .map(|v| keys[v[0] as usize..v[1] as usize].to_vec())
                    .collect::<Vec<_>>();
                metrics::LabelOrder::Text(&text)
            }
            _ => return Err(MetricError::InvalidInput),
        };
        let cm = metrics::confusion(input(ap, n)?, input(bp, n)?, order)?;
        output::<u32>(labels, count)?.copy_from_slice(&cm.labels);
        let out = output::<u32>(cells, n.checked_mul(3).ok_or(MetricError::InvalidInput)?)?;
        for (out, cell) in out.chunks_exact_mut(3).zip(&cm.cells) {
            out.copy_from_slice(cell);
        }
        let accuracy = if cm.total == 0 {
            0.0
        } else {
            cm.correct as f64 / cm.total as f64
        };
        output::<f64>(meta, 5)?.copy_from_slice(&[
            count as f64,
            cm.cells.len() as f64,
            cm.correct as f64,
            cm.total as f64,
            accuracy,
        ]);
        Ok::<_, MetricError>(())
    })();
    match result {
        Ok(()) => 0,
        Err(e) => status(e),
    }
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_confusion_score(
    op: u32,
    cells: u32,
    n: u32,
    label: u32,
    alpha: f64,
    out: u32,
) -> u32 {
    scalar(
        (|| metrics::confusion_score(op, input::<[u32; 3]>(cells, n)?, label, alpha))(),
        out,
    )
}

/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_translation_score(
    op: u32,
    p: u32,
    n: u32,
    min: u32,
    max: u32,
    beta: f64,
    whitespace: u32,
    out: u32,
) -> u32 {
    scalar(
        (|| {
            let sentences = crate::translation_metrics::unpack(input(p, n)?)?;
            match op {
                0 => crate::translation_metrics::chrf(
                    &sentences,
                    min as usize,
                    max as usize,
                    beta,
                    whitespace != 0,
                ),
                1 => crate::translation_metrics::nist(&sentences, max as usize),
                _ => Err(MetricError::InvalidInput),
            }
        })(),
        out,
    )
}
/// # Safety
/// All pointer arguments are offsets into WASM linear memory and are
/// range-checked against the memory size before any access.
#[no_mangle]
pub unsafe extern "C" fn bunnltk_wasm_nist_length_score(
    reference: f64,
    hypothesis: f64,
    out: u32,
) -> u32 {
    scalar(
        crate::translation_metrics::nist_length_penalty(reference, hypothesis),
        out,
    )
}
