//! A union of interned instructions. A dependency node owns its local ids and
//! references its direct children. Filtering a whole class of inputs (for
//! example, replacing declared files with observed reads) changes only the view.
use super::types::{CwdMode, HashInstruction, InstructionPool};
use std::{borrow::Cow, sync::Arc};

pub(crate) mod kind {
    pub const OTHER: u8 = 1;
    pub const TRACKED: u8 = 2;
    pub const TS: u8 = 4;
    pub const JSON: u8 = 8;
    pub const OUTPUT: u8 = 16;
    pub const DECLARED_DISK: u8 = 32;
    pub const RECORDED_DISK: u8 = 64;
    pub const ABSOLUTE_CWD: u8 = 128;
    pub const ALWAYS_DEFERRED: u8 = OUTPUT | ABSOLUTE_CWD;
    pub const DISK: u8 = DECLARED_DISK | RECORDED_DISK;
}

fn kind_of(id: u32, pool: &InstructionPool) -> u8 {
    use HashInstruction::*;
    match pool.get(id).value() {
        WorkspaceFileSet(_) | ProjectFileSet(..) => kind::TRACKED,
        TsConfiguration(_) => kind::TS,
        JsonFileSet(_) => kind::JSON,
        TaskOutput(..) => kind::OUTPUT,
        Cwd(CwdMode::Absolute) => kind::ABSOLUTE_CWD,
        IgnoredFileSet {
            from_ultracache: true,
            ..
        } => kind::RECORDED_DISK,
        IgnoredFileSet { .. } => kind::DECLARED_DISK,
        Runtime(_)
        | Environment(_)
        | Cwd(CwdMode::Relative)
        | ProjectConfiguration(_)
        | AllExternalDependencies
        | External(_)
        | UltracacheConfiguration(_) => kind::OTHER,
    }
}

#[derive(Clone, Default)]
pub struct Plan {
    kinds: u8,
    node: Option<Arc<Node>>,
}

struct Node {
    local: Box<[u32]>,
    local_kinds: u8,
    classes: Box<[u8]>,
    children: Vec<Plan>,
}

impl Drop for Node {
    fn drop(&mut self) {
        // Last owners may disappear in any order when a planner or a batch of
        // references is dropped. Release even a single very deep chain iteratively.
        let mut pending = std::mem::take(&mut self.children);
        while let Some(child) = pending.pop() {
            if let Some(mut node) = child.node.and_then(Arc::into_inner) {
                pending.append(&mut node.children);
            }
        }
    }
}

#[derive(Default)]
pub(super) struct PlanBuilder {
    local: Vec<u32>,
    children: Vec<Plan>,
}

impl PlanBuilder {
    pub(super) fn ids(&mut self, ids: impl IntoIterator<Item = u32>) {
        self.local.extend(ids);
    }

    pub(super) fn include(&mut self, plan: Plan) {
        if plan.node.is_some() {
            self.children.push(plan);
        }
    }

    pub(super) fn finish(mut self, pool: &InstructionPool) -> Plan {
        if self.local.is_empty() && self.children.len() <= 1 {
            return self.children.pop().unwrap_or_default();
        }
        self.local.sort_unstable();
        self.local.dedup();
        let classes: Box<[u8]> = self.local.iter().map(|&id| kind_of(id, pool)).collect();
        let local_kinds = classes.iter().fold(0, |mask, class| mask | class);
        let kinds = self.children.iter().fold(local_kinds, |k, p| k | p.kinds);
        Plan {
            kinds,
            node: Some(Arc::new(Node {
                local: self.local.into_boxed_slice(),
                local_kinds,
                classes,
                children: self.children,
            })),
        }
    }
}

impl Plan {
    #[cfg(test)]
    pub(crate) fn from_ids(ids: impl IntoIterator<Item = u32>, pool: &InstructionPool) -> Self {
        let mut builder = PlanBuilder::default();
        builder.ids(ids);
        builder.finish(pool)
    }

    pub(crate) fn has(&self, kinds: u8) -> bool {
        self.kinds & kinds != 0
    }

    pub(crate) fn only(&self, kinds: u8) -> Self {
        if self.has(kinds) {
            Self {
                kinds: self.kinds & kinds,
                node: self.node.clone(),
            }
        } else {
            Self::default()
        }
    }

    pub(crate) fn ids(&self) -> Cow<'_, [u32]> {
        match self.node.as_deref() {
            None => Cow::Borrowed(&[]),
            Some(n) if n.children.is_empty() && self.kinds == n.local_kinds => {
                Cow::Borrowed(&n.local)
            }
            Some(_) => Cow::Owned(Self::union_ids([self])),
        }
    }

    /// Expand each reachable node at most once per requested class, even when
    /// many parents (or differently filtered views) reach the same diamond.
    pub(crate) fn union_ids<'a>(plans: impl IntoIterator<Item = &'a Plan>) -> Vec<u32> {
        let mut ids = InstructionIdSet::default();
        Self::visit(plans, |node, kinds| {
            if node.local_kinds & kinds == node.local_kinds {
                ids.extend(node.local.iter().copied());
            } else {
                ids.extend(
                    node.local
                        .iter()
                        .zip(&node.classes)
                        .filter_map(|(&id, class)| (class & kinds != 0).then_some(id)),
                );
            }
            false
        });
        ids.into_sorted_vec()
    }

    pub(super) fn any_id(&self, mut check: impl FnMut(u32) -> bool) -> bool {
        Self::visit([self], |node, kinds| {
            node.local
                .iter()
                .zip(&node.classes)
                .any(|(&id, class)| class & kinds != 0 && check(id))
        })
    }

    fn visit<'a>(
        plans: impl IntoIterator<Item = &'a Plan>,
        mut visit: impl FnMut(&Node, u8) -> bool,
    ) -> bool {
        let mut stack: Vec<_> = plans
            .into_iter()
            .filter_map(|p| Some((p.node.as_deref()?, p.kinds)))
            .collect();
        let mut seen = hashbrown::HashMap::<*const Node, u8>::new();
        while let Some((node, requested)) = stack.pop() {
            let visited = seen.entry(node as *const Node).or_default();
            let kinds = requested & !*visited;
            if kinds == 0 {
                continue;
            }
            *visited |= kinds;
            if node.local_kinds & kinds != 0 && visit(node, kinds) {
                return true;
            }
            stack.extend(node.children.iter().rev().filter_map(|p| {
                let child_kinds = p.kinds & kinds;
                (child_kinds != 0).then(|| (p.node.as_deref().unwrap(), child_kinds))
            }));
        }
        false
    }
}

/// A temporary union of dense pool ids. Merge dependency closures without
/// copying their repeated ids into a large Vec and sorting all occurrences.
/// The bitset is discarded once the exact-sized, sorted result is produced.
#[derive(Default)]
pub(super) struct InstructionIdSet {
    words: Vec<u64>,
}

impl Extend<u32> for InstructionIdSet {
    fn extend<T: IntoIterator<Item = u32>>(&mut self, values: T) {
        for id in values {
            let word = id as usize / 64;
            if word >= self.words.len() {
                self.words.resize(word + 1, 0);
            }
            self.words[word] |= 1u64 << (id % 64);
        }
    }
}

impl FromIterator<u32> for InstructionIdSet {
    fn from_iter<T: IntoIterator<Item = u32>>(values: T) -> Self {
        let mut result = Self::default();
        result.extend(values);
        result
    }
}

impl InstructionIdSet {
    pub(super) fn into_sorted_vec(self) -> Vec<u32> {
        let count = self
            .words
            .iter()
            .map(|word| word.count_ones() as usize)
            .sum();
        let mut result = Vec::with_capacity(count);
        for (word_index, mut word) in self.words.into_iter().enumerate() {
            while word != 0 {
                result.push(word_index as u32 * 64 + word.trailing_zeros());
                word &= word - 1;
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filtered_paths_through_a_diamond_keep_the_union_of_requested_classes() {
        let pool = InstructionPool::new();
        let tracked = pool.intern(HashInstruction::WorkspaceFileSet(vec!["a".into()]));
        let env = pool.intern(HashInstruction::Environment("B".into()));
        let ts = pool.intern(HashInstruction::TsConfiguration("p".into()));
        let leaf = Plan::from_ids([tracked, env, ts], &pool);
        let mut a = PlanBuilder::default();
        a.include(leaf.only(kind::TRACKED));
        a.include(leaf.only(kind::OTHER));
        let left = a.finish(&pool);
        let mut both = PlanBuilder::default();
        both.include(left.only(kind::TRACKED));
        both.include(leaf.only(kind::TS));
        both.include(leaf.only(kind::TRACKED));
        assert_eq!(&*both.finish(&pool).ids(), &[tracked, ts]);
    }

    #[test]
    fn deep_overlapping_plans_store_only_direct_edges_and_drop_iteratively() {
        let pool = InstructionPool::new();
        let mut previous = Plan::default();
        let mut current = Plan::default();
        let n = 8192;
        for i in 0..n {
            let mut b = PlanBuilder::default();
            b.ids([pool.intern(HashInstruction::Environment(i.to_string()))]);
            b.include(current.clone());
            b.include(previous);
            previous = current;
            current = b.finish(&pool);
            let node = current.node.as_deref().unwrap();
            assert_eq!(node.local.len(), 1);
            assert_eq!(node.children.len(), i.min(2));
        }
        assert_eq!(current.ids().len(), n);
    }
}
