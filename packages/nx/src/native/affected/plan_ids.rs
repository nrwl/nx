use crate::native::tasks::types::HashPlans;

/// The pool ids at least one plan references, sorted.
///
/// Interned ids are dense, so a bitset of one word per 64 ids covers the pool
/// and unioning the plans is one OR per occurrence. Collecting the occurrences
/// into a Vec and sorting would be bounded by the sum of every plan's length
/// instead, which grows with tasks times instructions per task.
pub(crate) fn referenced_ids(hash_plans: &HashPlans) -> Vec<u32> {
    let mut words = vec![0u64; hash_plans.pool.len().div_ceil(64)];
    for &id in hash_plans.plans.values().flatten() {
        let word = id as usize / 64;
        if word >= words.len() {
            words.resize(word + 1, 0);
        }
        words[word] |= 1 << (id % 64);
    }
    let count = words.iter().map(|word| word.count_ones() as usize).sum();
    let mut ids = Vec::with_capacity(count);
    for (index, mut word) in words.into_iter().enumerate() {
        while word != 0 {
            ids.push(index as u32 * 64 + word.trailing_zeros());
            word &= word - 1;
        }
    }
    ids
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::{HashInstruction, InstructionPool};
    use std::collections::HashMap;
    use std::sync::Arc;

    #[test]
    fn yields_each_referenced_id_once_in_order() {
        let pool = Arc::new(InstructionPool::new());
        let ids: Vec<u32> = (0..130)
            .map(|i| pool.intern(HashInstruction::Environment(format!("E{i}"))))
            .collect();
        let plans = HashPlans {
            plans: HashMap::from([
                ("a".to_string(), vec![ids[129], ids[0], ids[64]]),
                ("b".to_string(), vec![ids[64], ids[63], ids[0]]),
                ("c".to_string(), vec![]),
            ]),
            pool,
        };
        assert_eq!(
            referenced_ids(&plans),
            vec![ids[0], ids[63], ids[64], ids[129]]
        );
    }
}
