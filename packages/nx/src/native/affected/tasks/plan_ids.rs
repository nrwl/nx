use crate::native::tasks::types::HashPlans;

/// The pool ids at least one plan references, sorted. A bitset, since interned ids are dense.
pub(crate) fn referenced_ids(hash_plans: &HashPlans) -> Vec<u32> {
    crate::native::tasks::plan::Plan::union_ids(hash_plans.plans.values())
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
            ])
            .into_iter()
            .map(|(id, v)| (id, crate::native::tasks::plan::Plan::from_ids(v, &pool)))
            .collect(),
            pool,
            deferred: Default::default(),
        };
        assert_eq!(
            referenced_ids(&plans),
            vec![ids[0], ids[63], ids[64], ids[129]]
        );
    }
}
