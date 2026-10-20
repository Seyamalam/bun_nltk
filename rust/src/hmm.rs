use crate::numeric_validation::{filled, product};
use crate::{CoreError, CoreResult};

// Negative infinity is NLTK's valid representation of impossible events.
fn valid_score(value: f32) -> bool {
    !value.is_nan() && value != f32::INFINITY
}

pub fn viterbi_ids(
    symbol_ids: &[u32],
    state_count: u32,
    symbol_count: u32,
    priors: &[f32],
    transitions: &[f32],
    outputs: &[f32],
    out_states: &mut [u32],
) -> CoreResult<()> {
    let states = state_count as usize;
    let symbols = symbol_count as usize;
    let steps = symbol_ids.len();
    if states == 0 || symbols == 0 {
        return Err(CoreError::InvalidN);
    }
    let transition_count = product(states, states)?;
    let output_count = product(states, symbols)?;
    let back_count = product(steps, states)?;
    if priors.len() < states
        || transitions.len() < transition_count
        || outputs.len() < output_count
        || out_states.len() < steps
        || symbol_ids.iter().any(|symbol| *symbol as usize >= symbols)
    {
        return Err(CoreError::InsufficientCapacity);
    }
    if priors[..states]
        .iter()
        .chain(&transitions[..transition_count])
        .chain(&outputs[..output_count])
        .any(|value| !valid_score(*value))
    {
        return Err(CoreError::InvalidN);
    }
    if steps == 0 {
        return Ok(());
    }

    let mut previous = filled(states, 0.0f32)?;
    let mut current = filled(states, 0.0f32)?;
    let mut back = filled(back_count, 0u32)?;
    let first_symbol = symbol_ids[0] as usize;
    for state in 0..states {
        previous[state] = priors[state] + outputs[state * symbols + first_symbol];
        if !valid_score(previous[state]) {
            return Err(CoreError::InvalidN);
        }
    }

    for step in 1..steps {
        let symbol = symbol_ids[step] as usize;
        for to_state in 0..states {
            let mut best_state = 0usize;
            let mut best_score = previous[0] + transitions[to_state];
            if !valid_score(best_score) {
                return Err(CoreError::InvalidN);
            }
            for from_state in 1..states {
                let score = previous[from_state] + transitions[from_state * states + to_state];
                if !valid_score(score) {
                    return Err(CoreError::InvalidN);
                }
                if score > best_score {
                    best_score = score;
                    best_state = from_state;
                }
            }
            current[to_state] = best_score + outputs[to_state * symbols + symbol];
            if !valid_score(current[to_state]) {
                return Err(CoreError::InvalidN);
            }
            back[step * states + to_state] = best_state as u32;
        }
        std::mem::swap(&mut previous, &mut current);
    }

    let mut state = 0usize;
    for candidate in 1..states {
        if previous[candidate] > previous[state] {
            state = candidate;
        }
    }
    out_states[steps - 1] = state as u32;
    for step in (1..steps).rev() {
        state = back[step * states + state] as usize;
        out_states[step - 1] = state as u32;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_dimensions_capacities_scores_and_symbols_before_output() {
        let mut out = [77];
        assert_eq!(
            viterbi_ids(&[0], u32::MAX, u32::MAX, &[], &[], &[], &mut out),
            Err(CoreError::InsufficientCapacity)
        );
        assert_eq!(
            viterbi_ids(&[1], 1, 1, &[0.0], &[0.0], &[0.0], &mut out),
            Err(CoreError::InsufficientCapacity)
        );
        for value in [f32::NAN, f32::INFINITY] {
            for (priors, transitions, outputs) in [
                ([value], [0.0], [0.0]),
                ([0.0], [value], [0.0]),
                ([0.0], [0.0], [value]),
            ] {
                assert_eq!(
                    viterbi_ids(&[0], 1, 1, &priors, &transitions, &outputs, &mut out),
                    Err(CoreError::InvalidN)
                );
            }
        }
        assert_eq!(
            viterbi_ids(&[0], 1, 1, &[f32::MAX], &[0.0], &[f32::MAX], &mut out),
            Err(CoreError::InvalidN)
        );
        assert_eq!(out, [77]);
    }

    #[test]
    fn supports_negative_infinity_and_preserves_ties_and_extra_output() {
        let mut out = [77; 3];
        viterbi_ids(
            &[0, 0],
            2,
            1,
            &[0.0, f32::NEG_INFINITY],
            &[0.0; 4],
            &[0.0, f32::NEG_INFINITY],
            &mut out,
        )
        .unwrap();
        assert_eq!(out, [0, 0, 77]);
        viterbi_ids(
            &[0, 0],
            2,
            1,
            &[f32::NEG_INFINITY; 2],
            &[f32::NEG_INFINITY; 4],
            &[f32::NEG_INFINITY; 2],
            &mut out,
        )
        .unwrap();
        assert_eq!(out, [0, 0, 77]);
    }

    #[test]
    fn viterbi_returns_expected_path() {
        let symbols = [0, 1, 1];
        let priors = [0.0, -2.0];
        let transitions = [0.0, -2.0, -2.0, 0.0];
        let outputs = [0.0, -3.0, -3.0, 0.0];
        let mut out = [0u32; 3];
        viterbi_ids(&symbols, 2, 2, &priors, &transitions, &outputs, &mut out).unwrap();
        assert_eq!(out, [0, 1, 1]);
    }
}
