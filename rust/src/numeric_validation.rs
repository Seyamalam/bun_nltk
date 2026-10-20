use crate::{CoreError, CoreResult};

pub(crate) fn product(left: usize, right: usize) -> CoreResult<usize> {
    left.checked_mul(right)
        .ok_or(CoreError::InsufficientCapacity)
}

pub(crate) fn offsets(offsets: &[u32], input_len: usize) -> CoreResult<()> {
    if offsets.first() != Some(&0)
        || offsets.last().copied().map(u64::from) != Some(input_len as u64)
        || offsets.windows(2).any(|pair| pair[0] > pair[1])
    {
        return Err(CoreError::InsufficientCapacity);
    }
    Ok(())
}

pub(crate) fn filled<T: Clone>(len: usize, value: T) -> CoreResult<Vec<T>> {
    let mut values = Vec::new();
    values
        .try_reserve_exact(len)
        .map_err(|_| CoreError::OutOfMemory)?;
    values.resize(len, value);
    Ok(values)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dimensions_and_allocations_are_fallible() {
        assert_eq!(product(usize::MAX, 2), Err(CoreError::InsufficientCapacity));
        assert_eq!(filled(usize::MAX, 0f64), Err(CoreError::OutOfMemory));
    }
}
