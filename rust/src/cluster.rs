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
    if points == 0 || dims == 0 || clusters == 0 || max_iterations == 0 {
        return Err(CoreError::InvalidN);
    }
    if vectors.len() < points * dims || means.len() < clusters * dims {
        return Err(CoreError::InsufficientCapacity);
    }
    if clusters >= points {
        return Ok(0);
    }

    let mut sums = vec![0.0; clusters * dims];
    let mut counts = vec![0usize; clusters];
    let mut next_means = vec![0.0; clusters * dims];
    for iteration in 1..=max_iterations {
        sums.fill(0.0);
        counts.fill(0);
        for point in 0..points {
            let vector = &vectors[point * dims..(point + 1) * dims];
            let mut best_cluster = 0usize;
            let mut best_distance = euclidean(vector, &means[..dims]);
            for cluster in 1..clusters {
                let distance = euclidean(vector, &means[cluster * dims..(cluster + 1) * dims]);
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
    fn kmeans_separates_two_groups() {
        let vectors = [0.0, 0.0, 0.0, 1.0, 10.0, 10.0, 10.0, 11.0];
        let mut means = [0.0, 0.0, 10.0, 10.0];
        let iterations =
            kmeans_fit_euclidean(&vectors, 4, 2, 2, 1e-9, false, 100, &mut means).unwrap();
        assert!(iterations > 0);
        assert_eq!(means, [0.0, 0.5, 10.0, 10.5]);
    }
}
