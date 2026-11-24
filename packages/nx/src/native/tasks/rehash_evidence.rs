//! Mutable paths and their unions are batch-local. Only unique strings and
//! unique arrays cross N-API, including when different plans yield the same set.
use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{Result, ensure};
use napi::Env;
use napi::bindgen_prelude::Array;

use super::id_set::IdSet;

pub(crate) type EvidenceId = usize;
pub(crate) const EMPTY: EvidenceId = 0;

pub(crate) struct RehashEvidence {
    remaining: u64,
    path_ids: HashMap<Arc<str>, u32>,
    paths: Vec<Arc<str>>,
    set_ids: HashMap<Arc<[u32]>, EvidenceId>,
    sets: Vec<Arc<[u32]>>,
}

impl RehashEvidence {
    pub(crate) fn new(limit: Option<f64>, tasks: usize) -> Result<Self> {
        if let Some(n) = limit {
            ensure!(
                (0.0..=9_007_199_254_740_991.0).contains(&n) && n.fract() == 0.0,
                "NX_REHASH_MEMORY_BUDGET: maxResultBytes must be a nonnegative safe integer"
            );
        }
        let mut pool = Self {
            remaining: limit.map_or(u64::MAX, |n| n as u64),
            path_ids: HashMap::new(),
            paths: Vec::new(),
            set_ids: HashMap::new(),
            sets: vec![Arc::from([])],
        };
        // Include the native and JS result records and both task hash strings.
        pool.charge((tasks as u64).saturating_mul(256))?;
        Ok(pool)
    }

    fn charge(&mut self, bytes: u64) -> Result<()> {
        self.remaining = self.remaining.checked_sub(bytes).ok_or_else(|| {
            anyhow::anyhow!("NX_REHASH_MEMORY_BUDGET: settled hash results exceed maxResultBytes")
        })?;
        Ok(())
    }

    pub(super) fn add_path(&mut self, members: &mut IdSet, path: &str) -> Result<()> {
        let id = if let Some(&id) = self.path_ids.get(path) {
            id
        } else {
            // Rust UTF-8 plus at most two JS bytes per UTF-8 byte. The fixed
            // allowance covers both indexes, string headers and assembly scratch.
            self.charge(160 + 3 * path.len() as u64)?;
            let id = u32::try_from(self.paths.len())?;
            let name: Arc<str> = path.into();
            self.paths.push(name.clone());
            self.path_ids.insert(name, id);
            id
        };
        members.extend([id]);
        Ok(())
    }

    pub(crate) fn from_paths<'a>(
        &mut self,
        paths: impl Iterator<Item = &'a str>,
    ) -> Result<EvidenceId> {
        let mut members = IdSet::default();
        for path in paths {
            self.add_path(&mut members, path)?;
        }
        self.intern(members)
    }

    pub(super) fn intern(&mut self, members: IdSet) -> Result<EvidenceId> {
        let ids = members.into_sorted_vec();
        if ids.is_empty() {
            return Ok(EMPTY);
        }
        if let Some(&set) = self.set_ids.get(ids.as_slice()) {
            return Ok(set);
        }
        // Rust membership, JS array slots and conversion scratch. Candidates
        // use one bit per already-charged path and are interned under one lock.
        self.charge(128 + 24 * ids.len() as u64)?;
        let set = self.sets.len();
        let ids: Arc<[u32]> = ids.into();
        self.sets.push(ids.clone());
        self.set_ids.insert(ids, set);
        Ok(set)
    }

    pub(crate) fn union(&mut self, sets: impl Iterator<Item = EvidenceId>) -> Result<EvidenceId> {
        let mut sets = sets.filter(|&set| set != EMPTY);
        let Some(first) = sets.next() else {
            return Ok(EMPTY);
        };
        let Some(second) = sets.find(|&id| id != first) else {
            return Ok(first);
        };
        let mut members = IdSet::default();
        for id in [first, second].into_iter().chain(sets) {
            members.extend(self.sets[id].iter().copied());
        }
        self.intern(members)
    }

    /// Convert only the groups actually returned. Copying an N-API Array
    /// handle preserves JS identity and does not allocate another backing array.
    pub(crate) fn into_arrays<'env>(
        self,
        env: &'env Env,
        used: impl Iterator<Item = EvidenceId>,
    ) -> napi::Result<Vec<Option<Array<'env>>>> {
        drop(self.path_ids);
        drop(self.set_ids);
        let mut arrays = vec![None; self.sets.len()];
        let mut names = vec![None; self.paths.len()];
        for set in used {
            if arrays[set].is_some() {
                continue;
            }
            let mut sorted = self.sets[set].to_vec();
            sorted.sort_unstable_by(|&a, &b| self.paths[a as usize].cmp(&self.paths[b as usize]));
            let mut array = env.create_array(sorted.len() as u32)?;
            for (slot, id) in sorted.into_iter().enumerate() {
                let i = id as usize;
                let name = match names[i] {
                    Some(name) => name,
                    None => {
                        let name = env.create_string(&self.paths[i])?;
                        names[i] = Some(name);
                        name
                    }
                };
                array.set(slot as u32, name)?;
            }
            arrays[set] = Some(array);
        }
        Ok(arrays)
    }

    #[cfg(test)]
    pub(crate) fn names(&self, id: EvidenceId) -> Vec<&str> {
        self.sets[id]
            .iter()
            .map(|&id| self.paths[id as usize].as_ref())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn charges_distinct_sets_and_paths_once_across_tasks() {
        let mut evidence = RehashEvidence::new(Some(1024.0), 0).unwrap();
        let a = evidence.from_paths(["a"].into_iter()).unwrap();
        let b = evidence.from_paths(["b"].into_iter()).unwrap();
        let both = evidence.union([b, a].into_iter()).unwrap();
        for _ in 0..1000 {
            assert_eq!(
                evidence.from_paths(["b", "a", "b"].into_iter()).unwrap(),
                both
            );
            assert_eq!(evidence.union([a, b].into_iter()).unwrap(), both);
            assert_eq!(
                evidence.union([EMPTY, both, both].into_iter()).unwrap(),
                both
            );
        }
        assert!(
            evidence
                .from_paths(["a previously unseen long path"].into_iter())
                .unwrap_err()
                .to_string()
                .contains("NX_REHASH_MEMORY_BUDGET")
        );
    }

    #[test]
    fn distinct_unions_exhaust_the_budget_even_when_every_path_is_shared() {
        let mut evidence = RehashEvidence::new(Some(32.0 * 1024.0), 0).unwrap();
        let names: Vec<_> = (0..100).map(|i| format!("output/{i}")).collect();
        evidence
            .from_paths(names.iter().map(String::as_str))
            .unwrap();
        let mut accepted = 0;
        for omitted in 0..names.len() {
            let set = evidence.from_paths(
                names
                    .iter()
                    .enumerate()
                    .filter(|&(i, _)| i != omitted)
                    .map(|(_, p)| p.as_str()),
            );
            if let Err(error) = set {
                assert!(error.to_string().contains("NX_REHASH_MEMORY_BUDGET"));
                break;
            }
            accepted += 1;
        }
        assert!(accepted > 0 && accepted < names.len());
    }

    #[test]
    fn rejects_over_budget_task_records_and_invalid_result_limits() {
        assert!(RehashEvidence::new(Some(0.0), 0).is_ok());
        assert!(RehashEvidence::new(Some(0.0), 1).is_err());
        for limit in [-1.0, 0.5, f64::INFINITY, f64::NAN, 9_007_199_254_740_992.0] {
            assert!(RehashEvidence::new(Some(limit), 0).is_err());
        }
    }
}
