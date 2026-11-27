use crate::native::tasks::inputs::get_inputs_for_dependency_group;
use crate::native::tasks::plan::PlanBuilder;
use crate::native::tasks::types::{HashInstruction, InstructionPool};
use crate::native::types::Input;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use super::HashPlanner;
use super::dependencies::{SubtreeResult, local_input_cache_key};

/// Built once by whichever walk claims it first; `None` when building failed.
#[derive(Default)]
pub(super) struct CycleGroupsSlot {
    claimed: std::sync::atomic::AtomicBool,
    groups: OnceLock<Option<CycleGroups>>,
}

/// The projects one propagated input walks, condensed into strongly connected
/// components so a cyclic closure is shared like an acyclic one.
struct CycleGroups {
    index: hashbrown::HashMap<String, usize>,
    names: Vec<String>,
    /// A project's own instructions, or its whole closure when it reaches no cycle.
    own: Vec<SubtreeResult>,
    component: Vec<usize>,
    members: Vec<Vec<usize>>,
    successors: Vec<Vec<usize>>,
    /// A component's members and everything they reach.
    closures: Vec<SubtreeResult>,
}

impl HashPlanner {
    /// Mirrors the visited-set walk: own instructions from
    /// `local_dependency_inputs`, acyclic closures from `memoized_dep_subtree`.
    fn build_cycle_groups(
        &self,
        inputs: &[Input],
        external_deps_mapped: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<CycleGroups> {
        let pool = &self.instruction_pool;
        let names: Vec<String> = self.project_graph.nodes.keys().cloned().collect();
        let index: hashbrown::HashMap<String, usize> = names
            .iter()
            .enumerate()
            .map(|(i, name)| (name.clone(), i))
            .collect();
        let mut own = Vec::with_capacity(names.len());
        let mut edges = Vec::with_capacity(names.len());
        for name in &names {
            let mut next = Vec::new();
            if self.dependency_memo_enabled(name) {
                own.push(self.memoized_dep_subtree(name, inputs, external_deps_mapped)?);
            } else {
                let local = self
                    .local_dependency_inputs(name, inputs)?
                    .ok_or_else(|| anyhow::anyhow!("no cache key for {name}"))?;
                if local.needs_legacy {
                    // A project without the group stops the walk; any other needs it.
                    let stops = get_inputs_for_dependency_group(
                        &self.project_graph.nodes[name],
                        &self.nx_json,
                        inputs,
                    )?
                    .is_none();
                    own.push(SubtreeResult {
                        needs_legacy: !stops,
                        ..Default::default()
                    });
                } else {
                    let mut ids = PlanBuilder::default();
                    ids.ids(local.ids.iter().copied());
                    let mut externals = hashbrown::HashSet::new();
                    for dep in &self.project_graph.dependencies[name] {
                        if let Some(&i) = index.get(dep) {
                            next.push(i);
                        } else if let Some(mapped) = external_deps_mapped.get(dep) {
                            externals.insert(dep.as_str());
                            externals.extend(mapped.iter().map(String::as_str));
                        }
                    }
                    ids.ids(externals.into_iter().map(|external| {
                        pool.intern(HashInstruction::External(external.to_string()))
                    }));
                    let mut always = PlanBuilder::default();
                    always.ids(local.always.iter().copied());
                    own.push(SubtreeResult {
                        ids: ids.finish(pool),
                        always: always.finish(pool),
                        needs_legacy: false,
                    });
                }
            }
            edges.push(next);
        }
        let (component, members) = strongly_connected(&edges);
        let mut successors = Vec::with_capacity(members.len());
        let mut closures = Vec::with_capacity(members.len());
        for (c, group) in members.iter().enumerate() {
            let mut next: Vec<usize> = group
                .iter()
                .flat_map(|&m| &edges[m])
                .map(|&w| component[w])
                .filter(|&s| s != c)
                .collect();
            next.sort_unstable();
            next.dedup();
            let closure = combine(
                group
                    .iter()
                    .map(|&m| &own[m])
                    .chain(next.iter().map(|&s| &closures[s])),
                pool,
            );
            closures.push(closure);
            successors.push(next);
        }
        Ok(CycleGroups {
            index,
            names,
            own,
            component,
            members,
            successors,
            closures,
        })
    }

    /// `root`'s dependency plan from its components: each one its dependencies
    /// are in, but its own without itself. `None` where the walk must decide.
    pub(super) fn cycle_rooted_inputs(
        &self,
        root: &str,
        inputs: &[Input],
        project_deps: &[String],
        external_deps_mapped: &HashMap<String, Vec<String>>,
    ) -> Option<SubtreeResult> {
        let key = local_input_cache_key("", inputs)?;
        let slot = Arc::clone(&self.cycle_groups.entry(key).or_default());
        let groups = match slot.groups.get() {
            Some(groups) => groups,
            None if !slot.claimed.swap(true, std::sync::atomic::Ordering::AcqRel) => slot
                .groups
                .get_or_init(|| self.build_cycle_groups(inputs, external_deps_mapped).ok()),
            // Another thread is building them: walk instead of waiting.
            None => return None,
        };
        let groups = groups.as_ref()?;
        let own_component = groups.component[*groups.index.get(root)?];
        let mut parts = Vec::new();
        let mut components = hashbrown::HashSet::new();
        let mut externals = hashbrown::HashSet::new();
        for dep in project_deps {
            if dep == root {
                continue;
            }
            if let Some(&i) = groups.index.get(dep) {
                let c = groups.component[i];
                if !components.insert(c) {
                    continue;
                }
                if c == own_component {
                    parts.extend(
                        groups.members[c]
                            .iter()
                            .filter(|&&m| groups.names[m] != root)
                            .map(|&m| &groups.own[m]),
                    );
                    parts.extend(groups.successors[c].iter().map(|&s| &groups.closures[s]));
                } else {
                    parts.push(&groups.closures[c]);
                }
            } else if let Some(mapped) = external_deps_mapped.get(dep) {
                externals.insert(dep.as_str());
                externals.extend(mapped.iter().map(String::as_str));
            }
        }
        let pool = &self.instruction_pool;
        let mut rooted = combine(parts, pool);
        if rooted.needs_legacy {
            return None;
        }
        if !externals.is_empty() {
            let mut ids = PlanBuilder::default();
            ids.include(rooted.ids);
            ids.ids(
                externals
                    .into_iter()
                    .map(|external| pool.intern(HashInstruction::External(external.to_string()))),
            );
            rooted.ids = ids.finish(pool);
        }
        Some(rooted)
    }
}

/// The union of `parts`, which needs the walk if any part does.
fn combine<'a>(
    parts: impl IntoIterator<Item = &'a SubtreeResult>,
    pool: &InstructionPool,
) -> SubtreeResult {
    let mut ids = PlanBuilder::default();
    let mut always = PlanBuilder::default();
    let mut needs_legacy = false;
    for part in parts {
        ids.include(part.ids.clone());
        always.include(part.always.clone());
        needs_legacy |= part.needs_legacy;
    }
    SubtreeResult {
        ids: ids.finish(pool),
        always: always.finish(pool),
        needs_legacy,
    }
}

/// Tarjan's algorithm without recursion. Components come out in reverse
/// topological order, so every successor precedes the component it follows.
fn strongly_connected(edges: &[Vec<usize>]) -> (Vec<usize>, Vec<Vec<usize>>) {
    const UNSEEN: usize = usize::MAX;
    let n = edges.len();
    let mut index = vec![UNSEEN; n];
    let mut low = vec![0; n];
    let mut on_stack = vec![false; n];
    let mut stack = Vec::new();
    let mut component = vec![UNSEEN; n];
    let mut members = Vec::new();
    let mut next = 0;
    for root in 0..n {
        if index[root] != UNSEEN {
            continue;
        }
        index[root] = next;
        low[root] = next;
        next += 1;
        stack.push(root);
        on_stack[root] = true;
        let mut calls = vec![(root, 0)];
        while let Some(&(v, child)) = calls.last() {
            if let Some(&w) = edges[v].get(child) {
                calls.last_mut().unwrap().1 += 1;
                if index[w] == UNSEEN {
                    index[w] = next;
                    low[w] = next;
                    next += 1;
                    stack.push(w);
                    on_stack[w] = true;
                    calls.push((w, 0));
                } else if on_stack[w] {
                    low[v] = low[v].min(index[w]);
                }
                continue;
            }
            calls.pop();
            if let Some(&(parent, _)) = calls.last() {
                low[parent] = low[parent].min(low[v]);
            }
            if low[v] == index[v] {
                let id = members.len();
                let mut group = Vec::new();
                while let Some(w) = stack.pop() {
                    on_stack[w] = false;
                    component[w] = id;
                    group.push(w);
                    if w == v {
                        break;
                    }
                }
                members.push(group);
            }
        }
    }
    (component, members)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strongly_connected_groups_cycles_with_successors_first() {
        // 0 <-> 1 -> 2, 2 -> 2, 3 -> 2, 4 alone.
        let (component, members) =
            strongly_connected(&[vec![1], vec![0, 2], vec![2], vec![2], vec![]]);
        assert_eq!(component[0], component[1]);
        let mut sizes: Vec<_> = members.iter().map(Vec::len).collect();
        sizes.sort_unstable();
        assert_eq!(sizes, [1, 1, 1, 2]);
        assert!(component[2] < component[0] && component[2] < component[3]);
    }
}
