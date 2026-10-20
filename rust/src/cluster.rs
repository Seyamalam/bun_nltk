use crate::numeric_validation::{filled, product};
use crate::{CoreError, CoreResult};

fn euclidean(left: &[f64], right: &[f64]) -> f64 {
    left.iter()
        .zip(right)
        .map(|(a, b)| {
            let delta = a - b;
            delta * delta
        })
        .sum::<f64>()
        .sqrt()
}

#[allow(clippy::too_many_arguments)]
pub fn kmeans_fit_euclidean(
    vectors: &[f64],
    point_count: u32,
    dimensions: u32,
    cluster_count: u32,
    convergence: f64,
    avoid_empty: bool,
    max_iterations: u32,
    means: &mut [f64],
) -> CoreResult<u32> {
    let points = point_count as usize;
    let dims = dimensions as usize;
    let clusters = cluster_count as usize;
    if points == 0
        || dims == 0
        || clusters == 0
        || max_iterations == 0
        || !convergence.is_finite()
        || convergence < 0.0
    {
        return Err(CoreError::InvalidN);
    }
    let vector_count = product(points, dims)?;
    let mean_count = product(clusters, dims)?;
    if vectors.len() < vector_count || means.len() < mean_count {
        return Err(CoreError::InsufficientCapacity);
    }
    let vectors = &vectors[..vector_count];
    let means = &mut means[..mean_count];
    if vectors
        .iter()
        .chain(means.iter())
        .any(|value| !value.is_finite())
    {
        return Err(CoreError::InvalidN);
    }
    if clusters >= points {
        return Ok(0);
    }

    let mut sums = filled(mean_count, 0.0)?;
    let mut counts = filled(clusters, 0usize)?;
    let mut next_means = filled(mean_count, 0.0)?;
    for iteration in 1..=max_iterations {
        sums.fill(0.0);
        counts.fill(0);
        for point in 0..points {
            let vector = &vectors[point * dims..(point + 1) * dims];
            let mut best_cluster = 0usize;
            let mut best_distance = euclidean(vector, &means[..dims]);
            if !best_distance.is_finite() {
                return Err(CoreError::InvalidN);
            }
            for cluster in 1..clusters {
                let distance = euclidean(vector, &means[cluster * dims..(cluster + 1) * dims]);
                if !distance.is_finite() {
                    return Err(CoreError::InvalidN);
                }
                if distance < best_distance {
                    best_distance = distance;
                    best_cluster = cluster;
                }
            }
            counts[best_cluster] += 1;
            for dim in 0..dims {
                sums[best_cluster * dims + dim] += vector[dim];
            }
        }

        if sums.iter().any(|value| !value.is_finite()) {
            return Err(CoreError::InvalidN);
        }
        for (cluster, count) in counts.iter().copied().enumerate().take(clusters) {
            if count == 0 && !avoid_empty {
                return Err(CoreError::InsufficientCapacity);
            }
            let divisor = if avoid_empty { count + 1 } else { count } as f64;
            for dim in 0..dims {
                let index = cluster * dims + dim;
                let base = if avoid_empty { means[index] } else { 0.0 };
                next_means[index] = (base + sums[index]) / divisor;
            }
        }

        let difference = (0..clusters)
            .map(|cluster| {
                euclidean(
                    &means[cluster * dims..(cluster + 1) * dims],
                    &next_means[cluster * dims..(cluster + 1) * dims],
                )
            })
            .sum::<f64>();
        if !difference.is_finite() || next_means.iter().any(|value| !value.is_finite()) {
            return Err(CoreError::InvalidN);
        }
        means.copy_from_slice(&next_means);
        if difference < convergence {
            return Ok(iteration);
        }
    }
    Err(CoreError::InvalidN)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn oversized_storage_keeps_unused_tail_unchanged() {
        let vectors = [0.0, 2.0, 10.0, 12.0, f64::NAN];
        let mut means = [0.0, 10.0, 77.0];
        kmeans_fit_euclidean(&vectors, 4, 1, 2, 1e-9, false, 100, &mut means).unwrap();
        assert_eq!(means, [1.0, 11.0, 77.0]);
    }

    #[test]
    fn rejects_dimensions_capacity_nonfinite_values_and_overflow() {
        let mut means = [0.0];
        for convergence in [f64::NAN, f64::INFINITY, -1.0] {
            assert_eq!(
                kmeans_fit_euclidean(&[0.0, 1.0], 2, 1, 1, convergence, false, 100, &mut means),
                Err(CoreError::InvalidN)
            );
        }
        for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, f64::MAX] {
            assert_eq!(
                kmeans_fit_euclidean(&[0.0, value], 2, 1, 1, 1.0, false, 100, &mut means),
                Err(CoreError::InvalidN)
            );
        }
        assert_eq!(
            kmeans_fit_euclidean(&[], u32::MAX, u32::MAX, 1, 1.0, false, 100, &mut means),
            Err(CoreError::InsufficientCapacity)
        );
        assert_eq!(means, [0.0]);
        assert_eq!(
            kmeans_fit_euclidean(&[0.0], 1, 1, 1, 1.0, false, 1, &mut [f64::NAN]),
            Err(CoreError::InvalidN)
        );
    }

    #[test]
    fn kmeans_separates_two_groups() {
        let vectors = [0.0, 0.0, 0.0, 1.0, 10.0, 10.0, 10.0, 11.0];
        let mut means = [0.0, 0.0, 10.0, 10.0];
        let iterations =
            kmeans_fit_euclidean(&vectors, 4, 2, 2, 1e-9, false, 100, &mut means).unwrap();
        assert!(iterations > 0);
        assert_eq!(means, [0.0, 0.5, 10.0, 10.5]);
    }
}
