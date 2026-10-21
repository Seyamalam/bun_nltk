use super::*;

fn options(order: u32, model: ModelType) -> Options {
    Options {
        order,
        model,
        gamma: 0.2,
        discount: 0.75,
        alpha: 0.4,
        vocab_size: 6,
    }
}

#[test]
fn unique_predecessors_and_high_orders() {
    let counts = Counts::build(&[0, 0, 1, 3, 3], &[0, 5], 3).unwrap();
    let opts = options(3, ModelType::KneserNeyInterpolated);
    assert_eq!(counts.score(1, &[0, 0], &opts), 0.71875);
    assert_eq!(counts.score(1, &[0], &opts), 0.625);
    assert_eq!(counts.score(1, &[], &opts), 0.25);
    let counts = Counts::build(&[1, 2, 3, 4, 5, 1, 2, 3, 4, 6], &[0, 5, 10], 5).unwrap();
    assert_eq!(
        counts.score(5, &[1, 2, 3, 4], &options(5, ModelType::Mle)),
        0.5
    );
    assert_eq!(
        counts.score(6, &[99, 1, 2, 3, 4], &options(5, ModelType::Mle)),
        0.5
    );
}

#[test]
fn validated_work_and_transport_bounds() {
    assert!(Counts::build(&[1], &[0, 2], 4).is_err());
    assert!(Counts::build(&[], &[0], MAX_ORDER + 1).is_err());
    assert!(Counts::build(&vec![1; 20_000], &[0, 20_000], 64).is_err());
    let counts = Counts::build(&[], &[0], 4).unwrap();
    assert_eq!(counts.score(1, &[], &options(4, ModelType::Mle)), 0.0);
    assert_eq!(
        counts.score(1, &[], &options(4, ModelType::Lidstone)),
        1.0 / 6.0
    );
    assert!(counts
        .evaluate(
            &options(4, ModelType::Mle),
            &[],
            &[1],
            &[1],
            &mut [0.0],
            &[],
            &[]
        )
        .is_err());
}

#[test]
fn every_smoothing_family_uses_shared_counts() {
    let counts = Counts::build(&[1, 2, 1, 3], &[0, 4], 2).unwrap();
    assert_eq!(counts.score(2, &[1], &options(2, ModelType::Mle)), 0.5);
    assert_eq!(
        counts.score(2, &[1], &options(2, ModelType::Lidstone)),
        1.2 / 3.2
    );
    assert_eq!(
        counts.score(2, &[1], &options(2, ModelType::StupidBackoff)),
        0.5
    );
    assert_eq!(
        counts.score(2, &[99], &options(2, ModelType::StupidBackoff)),
        0.1
    );
    assert_eq!(
        counts.score(2, &[1], &options(2, ModelType::WittenBellInterpolated)),
        0.375
    );
    assert_eq!(
        counts.score(
            2,
            &[1],
            &options(2, ModelType::AbsoluteDiscountingInterpolated)
        ),
        0.3125
    );
}
