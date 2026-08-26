use crate::{CoreError, CoreResult};

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
    if priors.len() < states
        || transitions.len() < states * states
        || outputs.len() < states * symbols
        || out_states.len() < steps
        || symbol_ids.iter().any(|symbol| *symbol as usize >= symbols)
    {
        return Err(CoreError::InsufficientCapacity);
    }
    if steps == 0 {
        return Ok(());
    }

    let mut previous = vec![0.0f32; states];
    let mut current = vec![0.0f32; states];
    let mut back = vec![0u32; steps * states];
    let first_symbol = symbol_ids[0] as usize;
    for state in 0..states {
        previous[state] = priors[state] + outputs[state * symbols + first_symbol];
    }

    for step in 1..steps {
        let symbol = symbol_ids[step] as usize;
        for to_state in 0..states {
            let mut best_state = 0usize;
            let mut best_score = previous[0] + transitions[to_state];
            for from_state in 1..states {
                let score = previous[from_state] + transitions[from_state * states + to_state];
                if score > best_score {
                    best_score = score;
                    best_state = from_state;
                }
            }
            current[to_state] = best_score + outputs[to_state * symbols + symbol];
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
