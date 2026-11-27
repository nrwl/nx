//! A union of interned instructions. A dependency node owns its local ids and
//! references its direct children. Filtering a whole class of inputs (for
//! example, replacing declared files with observed reads) changes only the view.
use super::types::{CwdMode, HashInstruction, InstructionPool};
use std::{borrow::Cow, collections::BTreeMap, sync::Arc};

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
        | UltracacheConfiguration(_)
        | FolderState(_) => kind::OTHER,
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
        Self::collect_ids(plans).into_sorted_vec()
    }

    fn collect_ids<'a>(plans: impl IntoIterator<Item = &'a Plan>) -> InstructionIdSet {
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
        ids
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

const WORDS_PER_PAGE: usize = 8;
const IDS_PER_PAGE: usize = 64 * WORDS_PER_PAGE;

/// Only occupied pages are allocated and scanned, regardless of the largest pool id.
#[derive(Default)]
pub(super) struct InstructionIdSet {
    prefix: Vec<[u64; WORDS_PER_PAGE]>,
    sparse: BTreeMap<usize, [u64; WORDS_PER_PAGE]>,
}

impl Extend<u32> for InstructionIdSet {
    fn extend<T: IntoIterator<Item = u32>>(&mut self, values: T) {
        let mut values = values.into_iter().peekable();
        while let Some(first) = values.next() {
            let page = first as usize / IDS_PER_PAGE;
            let words = self.page_mut(page);
            // Local ids are sorted. Reuse the page for consecutive ids in that range.
            let mut insert = |id: u32| {
                let word = id as usize / 64 % WORDS_PER_PAGE;
                words[word] |= 1u64 << (id % 64);
            };
            insert(first);
            while let Some(id) = values.next_if(|id| *id as usize / IDS_PER_PAGE == page) {
                insert(id);
            }
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
    fn page_mut(&mut self, index: usize) -> &mut [u64; WORDS_PER_PAGE] {
        // Dense unions can index consecutive occupied pages directly.
        if index == self.prefix.len() {
            self.prefix.push([0; WORDS_PER_PAGE]);
            while let Some(next) = self.sparse.remove(&self.prefix.len()) {
                self.prefix.push(next);
            }
        }
        if index < self.prefix.len() {
            &mut self.prefix[index]
        } else {
            self.sparse.entry(index).or_default()
        }
    }

    fn words(&self) -> impl Iterator<Item = (usize, u64)> + '_ {
        let pages = self
            .prefix
            .iter()
            .enumerate()
            .chain(self.sparse.iter().map(|(&i, page)| (i, page)));
        pages.flat_map(|(i, page)| (i * WORDS_PER_PAGE..).zip(page.iter().copied()))
    }

    pub(super) fn into_sorted_vec(self) -> Vec<u32> {
        let count = self
            .words()
            .map(|(_, bits)| bits.count_ones() as usize)
            .sum();
        let mut result = Vec::with_capacity(count);
        for (word_index, mut word) in self.words() {
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
    fn star_plans_only_scan_words_for_their_own_instructions() {
        let pool = InstructionPool::new();
        let shared_id = pool.intern(HashInstruction::ProjectConfiguration("shared".into()));
        let shared = Plan::from_ids([shared_id], &pool);
        let projects = 4096;
        let mut words = 0;
        for i in 0..projects {
            let local_id = pool.intern(HashInstruction::ProjectConfiguration(i.to_string()));
            let mut task = PlanBuilder::default();
            task.ids([local_id]);
            task.include(shared.clone());
            let task = task.finish(&pool);
            words += Plan::collect_ids([&task]).words().count();
            assert_eq!(task.ids().as_ref(), [shared_id, local_id]);
        }
        assert!(
            words <= 2 * WORDS_PER_PAGE * projects,
            "{words} bitmap words for {projects} tasks"
        );
    }

    #[test]
    fn sparse_pages_preserve_order_and_deduplication_across_boundaries() {
        let boundary = IDS_PER_PAGE as u32;
        let mut ids = InstructionIdSet::default();
        ids.extend([u32::MAX, boundary, 63, boundary + 1, 64, boundary - 1]);
        ids.extend(0..=boundary + 1);
        ids.extend([u32::MAX, boundary, 0]);
        let expected: Vec<_> = (0..=boundary + 1).chain([u32::MAX]).collect();
        assert_eq!(ids.words().count(), 3 * WORDS_PER_PAGE);
        assert_eq!(ids.into_sorted_vec(), expected);
    }

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
