use crate::native::tasks::hashers::OnceCache;
use crate::native::tasks::inputs::get_inputs_for_dependency_group;
use crate::native::tasks::plan::{Plan, PlanBuilder};
use crate::native::tasks::types::{HashInstruction, Task, TaskGraph};
use crate::native::types::Input;
use std::collections::HashMap;
use std::sync::Arc;

use super::HashPlanner;
use super::ultracache::{AlwaysIds, retained_inputs};

/// Instruction ids contributed by one (project, propagated input) dependency subtree.
#[derive(Default, Clone)]
pub(super) struct SubtreeResult {
    pub(super) ids: Plan,
    /// See `AlwaysIds`. Fixed by the graph alone, never by the propagated
    /// input's own `always`, which the caller applies, so tasks can share it.
    pub(super) always: Plan,
    /// True when the subtree cannot be spliced from the memo: it contains
    /// deps-outputs inputs (whose resolution depends on the root task) or an
    /// unexpected propagation shape. Callers must use the per-task traversal.
    pub(super) needs_legacy: bool,
}

pub(super) struct LocalDependencyInputs {
    pub(super) ids: Vec<u32>,
    pub(super) always: Vec<u32>,
    pub(super) needs_legacy: bool,
}

/// Cycle-detection set with an undo log. Each dependency input needs its own
/// visitation scope (see `gather_dependency_inputs`); rolling insertions back
/// keeps that scoping without cloning the whole set per input.
pub(super) struct VisitedTracker<'a> {
    root: &'a str,
    set: hashbrown::HashSet<&'a str>,
    log: Vec<&'a str>,
}

impl<'a> VisitedTracker<'a> {
    /// The root project starts out visited, so a task never traverses
    /// itself as its own dependency.
    pub(super) fn new(root_project: &'a str) -> Self {
        Self {
            root: root_project,
            set: hashbrown::HashSet::from([root_project]),
            log: Vec::new(),
        }
    }

    /// The root, while nothing else is visited.
    fn only_root(&self) -> Option<&'a str> {
        (self.set.len() == 1).then_some(self.root)
    }

    /// Same contract as `HashSet::insert`: returns whether the project was
    /// newly inserted. New insertions are logged so `rollback_to` can undo them.
    fn insert(&mut self, project: &'a str) -> bool {
        let inserted = self.set.insert(project);
        if inserted {
            self.log.push(project);
        }
        inserted
    }

    fn scope_start(&self) -> usize {
        self.log.len()
    }

    /// Un-visits everything recorded since `scope_start`.
    fn rollback_to(&mut self, scope_start: usize) {
        for project in self.log.drain(scope_start..) {
            self.set.remove(project);
        }
    }
}

impl HashPlanner {
    /// A closure is safe to memoize only if no project in it reaches a cycle.
    /// This also prevents recursive OnceCell waits. Other projects retain the
    /// visited-scoped traversal even when they share acyclic dependencies.
    pub(super) fn dependency_memo_enabled(&self, project: &str) -> bool {
        self.acyclic_dependency_projects
            .get_or_init(|| self.find_acyclic_dependency_projects())
            .contains(project)
    }

    fn find_acyclic_dependency_projects(&self) -> hashbrown::HashSet<String> {
        // Remove sinks and then their parents (reverse topological order).
        // Exactly the nodes that cannot reach a project cycle are removed.
        // Count repeated edges consistently and ignore external-node cycles.
        let mut remaining = hashbrown::HashMap::new();
        let mut parents: hashbrown::HashMap<&str, Vec<&str>> = hashbrown::HashMap::new();
        let mut ready = Vec::new();
        for project in self.project_graph.nodes.keys() {
            let mut count = 0;
            if let Some(deps) = self.project_graph.dependencies.get(project) {
                for dep in deps {
                    if self.project_graph.nodes.contains_key(dep) {
                        count += 1;
                        parents
                            .entry(dep.as_str())
                            .or_default()
                            .push(project.as_str());
                    }
                }
            }
            remaining.insert(project.as_str(), count);
            if count == 0 {
                ready.push(project.as_str());
            }
        }
        let mut acyclic = hashbrown::HashSet::new();
        while let Some(project) = ready.pop() {
            acyclic.insert(project.to_string());
            if let Some(dependents) = parents.get(project) {
                for parent in dependents {
                    let count = remaining.get_mut(parent).unwrap();
                    *count -= 1;
                    if *count == 0 {
                        ready.push(parent);
                    }
                }
            }
        }
        acyclic
    }

    pub(super) fn memoized_dep_subtree(
        &self,
        dep: &str,
        inputs: &[Input],
        external_deps_mapped: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<SubtreeResult> {
        let key = group_cache_key(dep, inputs);
        if let Some(hit) = self.subtree_memo.get(&key) {
            return Ok(hit.clone());
        }
        // Builds missing nodes in postorder without a shared lock. Racing tasks
        // can expand the same key; the results are identical and the first wins.
        let memo = &self.subtree_memo;
        struct Frame<'a> {
            key: String,
            children: std::slice::Iter<'a, String>,
            ids: PlanBuilder,
            always: PlanBuilder,
            externals: hashbrown::HashSet<&'a str>,
            needs_legacy: bool,
        }
        impl Frame<'_> {
            fn include(&mut self, child: &SubtreeResult) {
                self.ids.include(child.ids.clone());
                self.always.include(child.always.clone());
                self.needs_legacy |= child.needs_legacy;
            }
        }

        let pool = &self.instruction_pool;
        let frame = |dep: &str, key: String| -> anyhow::Result<Frame<'_>> {
            let mut frame = Frame {
                key,
                children: [].iter(),
                ids: PlanBuilder::default(),
                always: PlanBuilder::default(),
                externals: Default::default(),
                needs_legacy: false,
            };
            if let Some(local) = get_inputs_for_dependency_group(
                &self.project_graph.nodes[dep],
                &self.nx_json,
                inputs,
            )? {
                frame.ids.ids(
                    self.gather_self_inputs(dep, &local.self_inputs, None)?
                        .into_iter()
                        .chain(self.declared_external_instructions(
                            dep,
                            &local.self_inputs,
                            external_deps_mapped,
                        )?)
                        .map(|i| pool.intern(i)),
                );
                frame
                    .always
                    .ids(self.gather_always_self_inputs(dep, &local.self_inputs)?);
                let propagates = inputs.len() == local.deps_inputs.len()
                    && inputs
                        .iter()
                        .zip(&local.deps_inputs)
                        .all(|(a, b)| propagates_unchanged(a, b));
                frame.needs_legacy = !propagates
                    || !local.deps_outputs.is_empty()
                    || !local.project_inputs.is_empty();
                // Validate the descendants in their original DFS order even if
                // output instructions later require task-specific resolution.
                if propagates && !local.deps_inputs.is_empty() {
                    frame.children = self.project_graph.dependencies[dep].iter();
                }
            }
            Ok(frame)
        };
        let mut stack = vec![frame(dep, key)?];
        loop {
            let current = stack.last_mut().unwrap();
            if let Some(child) = current.children.next() {
                if self.project_graph.nodes.contains_key(child) {
                    let key = group_cache_key(child, inputs);
                    if let Some(hit) = memo.get(&key) {
                        current.include(&hit);
                    } else {
                        stack.push(frame(child, key)?);
                    }
                } else if let Some(externals) = external_deps_mapped.get(child) {
                    current.externals.insert(child);
                    current
                        .externals
                        .extend(externals.iter().map(String::as_str));
                }
                continue;
            }
            let mut done = stack.pop().unwrap();
            done.ids.ids(
                done.externals
                    .into_iter()
                    .map(|name| pool.intern(HashInstruction::External(name.to_string()))),
            );
            let subtree = SubtreeResult {
                ids: done.ids.finish(pool),
                always: done.always.finish(pool),
                needs_legacy: done.needs_legacy,
            };
            let subtree = memo.entry(done.key).or_insert(subtree).clone();
            match stack.last_mut() {
                Some(parent) => parent.include(&subtree),
                None => return Ok(subtree),
            }
        }
    }

    pub(super) fn local_dependency_inputs(
        &self,
        dep: &str,
        group: &[Input],
    ) -> anyhow::Result<Option<Arc<LocalDependencyInputs>>> {
        let Some(key) = local_input_cache_key(dep, group) else {
            return Ok(None);
        };
        self.local_inputs_memo
            .get_or_init(OnceCache::new)
            .get_or_try_init(key, || {
                let Some(inputs) = get_inputs_for_dependency_group(
                    &self.project_graph.nodes[dep],
                    &self.nx_json,
                    group,
                )?
                else {
                    return Ok(LocalDependencyInputs {
                        ids: vec![],
                        always: vec![],
                        needs_legacy: true,
                    });
                };
                // Only cache canonical, task-independent expansion. Root-task
                // output resolution and unexpected propagation shapes keep their
                // original path. The initializer never follows project edges,
                // so cyclic graphs cannot introduce recursive cache waits.
                let same_propagation = group.len() == inputs.deps_inputs.len()
                    && group
                        .iter()
                        .zip(inputs.deps_inputs.iter())
                        .all(|(before, after)| propagates_unchanged(before, after));
                let needs_legacy = !same_propagation
                    || !inputs.deps_outputs.is_empty()
                    || !inputs.project_inputs.is_empty();
                let (ids, always) = if needs_legacy {
                    (vec![], vec![])
                } else {
                    (
                        self.gather_self_inputs(dep, &inputs.self_inputs, None)?
                            .into_iter()
                            .chain(
                                self.declared_external_instructions(
                                    dep,
                                    &inputs.self_inputs,
                                    self.external_deps_mapped
                                        .get_or_init(|| self.compute_external_deps()),
                                )?,
                            )
                            .map(|instruction| self.instruction_pool.intern(instruction))
                            .collect(),
                        self.gather_always_self_inputs(dep, &inputs.self_inputs)?,
                    )
                };
                Ok(LocalDependencyInputs {
                    ids,
                    always,
                    needs_legacy,
                })
            })
            .map(Some)
    }

    pub(super) fn gather_dependency_inputs<'a>(
        &'a self,
        task: &Task,
        inputs: &[Input],
        task_graph: &TaskGraph,
        project_deps: &'a [String],
        external_deps_mapped: &'a HashMap<String, Vec<String>>,
        visited: &mut VisitedTracker<'a>,
        always: &mut AlwaysIds,
    ) -> anyhow::Result<Plan> {
        if inputs.len() == 1 {
            let ids = self.gather_dependency_input(
                task,
                inputs,
                task_graph,
                project_deps,
                external_deps_mapped,
                visited,
                always,
            )?;
            if inputs[0].always() {
                always.include(&ids);
            }
            return Ok(ids);
        }

        let mut deps_inputs = PlanBuilder::default();

        // Scope cycle detection to each propagated unit so siblings all apply to
        // the same dependency, rolling its visits back instead of cloning the
        // set. The `includeIgnored` filesets are one unit: they resolve together
        // against each dependency, so a negation filters that group's positives.
        let ignored_group = ignored_dep_fileset_group(inputs);
        let group_first = ignored_group.len() > 1;
        if group_first {
            let scope = visited.scope_start();
            let ids = self.gather_dependency_input(
                task,
                &ignored_group,
                task_graph,
                project_deps,
                external_deps_mapped,
                visited,
                always,
            )?;
            visited.rollback_to(scope);
            // The group hashes as one instruction per dependency, so a part
            // of it is kept through a traversal of its own.
            let retained = retained_inputs(&ignored_group);
            if retained.len() == ignored_group.len() {
                always.include(&ids);
            } else if !retained.is_empty() && always.is_collecting() {
                let scope = visited.scope_start();
                let retained_ids = self.gather_dependency_input(
                    task,
                    &retained,
                    task_graph,
                    project_deps,
                    external_deps_mapped,
                    visited,
                    always,
                )?;
                visited.rollback_to(scope);
                always.include(&retained_ids);
            }
            deps_inputs.include(ids);
        }

        for input in inputs {
            if group_first && is_ignored_dep_fileset(input) {
                continue;
            }
            let scope = visited.scope_start();
            let ids = self.gather_dependency_input(
                task,
                std::slice::from_ref(input),
                task_graph,
                project_deps,
                external_deps_mapped,
                visited,
                always,
            )?;
            visited.rollback_to(scope);
            if input.always() {
                always.include(&ids);
            }
            deps_inputs.include(ids);
        }

        Ok(deps_inputs.finish(&self.instruction_pool))
    }

    fn gather_dependency_input<'a>(
        &'a self,
        task: &Task,
        inputs: &[Input],
        task_graph: &TaskGraph,
        project_deps: &'a [String],
        external_deps_mapped: &'a HashMap<String, Vec<String>>,
        visited: &mut VisitedTracker<'a>,
        always: &mut AlwaysIds,
    ) -> anyhow::Result<Plan> {
        if let Some(root) = visited.only_root()
            && std::ptr::eq(
                project_deps,
                self.project_graph.dependencies[root].as_slice(),
            )
            && !self.dependency_memo_enabled(root)
            && let Some(rooted) =
                self.cycle_rooted_inputs(root, inputs, project_deps, external_deps_mapped)
        {
            always.include(&rooted.always);
            return Ok(rooted.ids);
        }
        let pool = &self.instruction_pool;
        let mut deps_inputs = PlanBuilder::default();
        // External membership is separate from project cycle detection, whose
        // scopes must still be rolled back independently for sibling inputs.
        let mut external_inputs = hashbrown::HashSet::new();

        // Keep one accumulator for this propagated input. Returning a vector
        // from every intermediate project repeatedly copies the same closure.
        // Saving parent iterators preserves depth-first visitation and errors;
        // the stack stays unallocated when subtree memoization answers directly.
        let mut children = project_deps.iter();
        let mut parents = Vec::new();
        loop {
            let Some(dep) = children.next() else {
                if let Some(parent) = parents.pop() {
                    children = parent;
                    continue;
                }
                break;
            };
            if !visited.insert(dep.as_str()) {
                continue;
            }

            if self.project_graph.nodes.contains_key(dep) {
                if self.dependency_memo_enabled(dep) {
                    let sub = self.memoized_dep_subtree(dep, inputs, external_deps_mapped)?;
                    if !sub.needs_legacy {
                        // Shared closures are unioned by id before allocation,
                        // without changing the per-input visitation rules.
                        deps_inputs.include(sub.ids);
                        always.include(&sub.always);
                        continue;
                    }
                }
                if let Some(local) = self.local_dependency_inputs(dep, inputs)? {
                    if !local.needs_legacy {
                        deps_inputs.ids(local.ids.iter().copied());
                        always.extend(local.always.iter().copied());
                        parents.push(children);
                        children = self.project_graph.dependencies[dep].iter();
                        continue;
                    }
                }
                let Some(dep_inputs) = get_inputs_for_dependency_group(
                    &self.project_graph.nodes[dep],
                    &self.nx_json,
                    inputs,
                )?
                else {
                    continue;
                };
                deps_inputs.ids(
                    self.declared_external_instructions(
                        dep,
                        &dep_inputs.self_inputs,
                        external_deps_mapped,
                    )?
                    .into_iter()
                    .map(|instruction| pool.intern(instruction)),
                );
                deps_inputs.include(self.self_and_deps_inputs(
                    dep,
                    task,
                    &dep_inputs,
                    task_graph,
                    external_deps_mapped,
                    visited,
                    None,
                    always,
                )?);
            } else {
                // todo(jcammisuli): add a check to skip this when the new task hasher is ready, and when `AllExternalDependencies` is used
                if let Some(external_deps) = external_deps_mapped.get(dep) {
                    external_inputs.insert(dep);
                    external_inputs.extend(external_deps);
                }
            }
        }

        deps_inputs.ids(
            external_inputs
                .into_iter()
                .map(|s| pool.intern(HashInstruction::External(s.to_string()))),
        );
        Ok(deps_inputs.finish(&self.instruction_pool))
    }
}

/// Length-prefixing the project keeps arbitrary project and input strings
/// unambiguous, including ones containing the kind character.
fn prefixed_cache_key(dep: &str, kind: char, rest: &str) -> String {
    format!("{}:{dep}{kind}{rest}", dep.len())
}

/// The cache-key character for a fileset: `f` reads the file map, `d` reads
/// the disk (`includeIgnored`).
fn fileset_kind(include_ignored: bool) -> char {
    if include_ignored { 'd' } else { 'f' }
}

/// Unsupported kinds are uncached.
pub(super) fn local_input_cache_key(dep: &str, group: &[Input]) -> Option<String> {
    match group {
        [Input::Inputs { input, .. }] => Some(prefixed_cache_key(dep, 'i', input)),
        [
            Input::FileSet {
                fileset,
                dependencies: true,
                include_ignored,
                ..
            },
        ] => Some(prefixed_cache_key(
            dep,
            fileset_kind(*include_ignored),
            fileset,
        )),
        [_] | [] => None,
        _ => {
            debug_assert!(
                group.iter().all(is_ignored_dep_fileset),
                "a group reaching the key holds only includeIgnored dependency filesets"
            );
            Some(grouped_cache_key(dep, group))
        }
    }
}

/// One key per propagated group. A group holds more than one input, so its
/// kind never collides with a single input's key.
fn group_cache_key(dep: &str, inputs: &[Input]) -> String {
    match inputs {
        // Only `dependencies: true` filesets reach here, since that is what
        // get_inputs_for_dependency puts in deps_inputs. The kind keeps the
        // two backing stores apart: the same glob is a different subtree.
        [Input::Inputs { input, .. }] => prefixed_cache_key(dep, 'i', input),
        [
            Input::FileSet {
                fileset,
                include_ignored,
                ..
            },
        ] => prefixed_cache_key(dep, fileset_kind(*include_ignored), fileset),
        // Other input kinds never reach dependencies (get_inputs_for_dependency
        // returns None for them), so they share one empty entry per project.
        [_] | [] => prefixed_cache_key(dep, 'n', ""),
        _ => {
            debug_assert!(
                inputs.iter().all(is_ignored_dep_fileset),
                "a group reaching the key holds only includeIgnored dependency filesets"
            );
            grouped_cache_key(dep, inputs)
        }
    }
}

/// Group order is part of the key: it is the order the globs are hashed in.
/// So is each member's kind, so two groups naming the same filesets cannot
/// share a memo entry. No caller builds a mixed group today — each arm that
/// reaches here debug-asserts it — but the kind is in the key regardless,
/// since a debug assert is compiled out of the binary that ships.
fn grouped_cache_key(dep: &str, group: &[Input]) -> String {
    let globs = group
        .iter()
        .map(|input| match input {
            Input::FileSet {
                fileset,
                include_ignored,
                ..
            } => format!("{}{fileset}", fileset_kind(*include_ignored)),
            _ => String::new(),
        })
        .collect::<Vec<_>>()
        .join("\0");
    prefixed_cache_key(dep, 'g', &globs)
}

fn is_ignored_dep_fileset(input: &Input) -> bool {
    matches!(
        input,
        Input::FileSet {
            dependencies: true,
            include_ignored: true,
            ..
        }
    )
}

/// The `includeIgnored` filesets a project propagates to its dependencies.
/// Every member carries both flags, which is what lets `grouped_cache_key`
/// key a group on its globs and kinds without two groups colliding.
fn ignored_dep_fileset_group<'a>(inputs: &[Input<'a>]) -> Vec<Input<'a>> {
    inputs
        .iter()
        .filter(|input| is_ignored_dep_fileset(input))
        .cloned()
        .collect()
}

/// Whether an input reaches the dependency unchanged, so its expansion is
/// task-independent and cacheable.
fn propagates_unchanged(before: &Input, after: &Input) -> bool {
    match (before, after) {
        (
            Input::Inputs { input: before, .. },
            Input::Inputs {
                input: after,
                dependencies: true,
                ..
            },
        ) => before == after,
        (
            Input::FileSet {
                fileset: before,
                dependencies: true,
                include_ignored: before_ignored,
                ..
            },
            Input::FileSet {
                fileset: after,
                dependencies: true,
                include_ignored: after_ignored,
                ..
            },
        ) => before == after && before_ignored == after_ignored,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::{ExternalNode, Project, ProjectGraph, Target};
    use crate::native::tasks::plan::InstructionIdSet;
    use crate::native::test_utils::edges_to;
    use crate::native::types::NxJson;
    use napi::bindgen_prelude::External;

    fn mixed_cycle_planner(with_outputs: bool) -> HashPlanner {
        use crate::native::types::{DepsOutputsInput, JsInputs};
        use napi::bindgen_prelude::Either9;
        let edges = [
            ("app", vec!["cycle-a", "branch", "leaf"]),
            ("cycle-a", vec!["cycle-b", "branch"]),
            ("cycle-b", vec!["cycle-a", "leaf"]),
            ("branch", vec!["leaf", "leaf"]),
            ("leaf", vec!["npm:external"]),
            ("self-cycle", vec!["self-cycle"]),
            ("isolated", vec![]),
        ];
        let nodes = edges
            .iter()
            .map(|(name, _)| {
                let mut prod: Vec<JsInputs> = vec![Either9::B("{projectRoot}/prod".into())];
                if with_outputs && *name == "leaf" {
                    prod.push(Either9::G(DepsOutputsInput {
                        dependent_tasks_output_files: "**/*.js".into(),
                        transitive: Some(true),
                    }));
                }
                (
                    name.to_string(),
                    Project {
                        root: name.to_string(),
                        named_inputs: Some(HashMap::from([
                            ("prod".into(), prod),
                            ("spec".into(), vec![Either9::B("{projectRoot}/spec".into())]),
                        ])),
                        targets: HashMap::from([(
                            "build".into(),
                            Target {
                                inputs: Some(vec![
                                    Either9::B("default".into()),
                                    Either9::B("^prod".into()),
                                    Either9::B("^spec".into()),
                                ]),
                                ..Default::default()
                            },
                        )]),
                        ..Default::default()
                    },
                )
            })
            .collect();
        let mut dependencies: HashMap<String, Vec<String>> = edges
            .into_iter()
            .map(|(name, deps)| {
                (
                    name.to_string(),
                    deps.into_iter().map(str::to_string).collect(),
                )
            })
            .collect();
        dependencies.insert("npm:external".into(), vec!["npm:external".into()]);
        HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(ProjectGraph {
                nodes,
                dependencies,
                external_nodes: HashMap::from([(
                    "npm:external".into(),
                    ExternalNode {
                        r#type: Some("npm".into()),
                        package_name: Some("external".into()),
                        version: "1".into(),
                        hash: None,
                    },
                )]),
            })),
        )
    }

    #[test]
    fn roots_reaching_a_cycle_plan_from_cycle_groups_unless_the_walk_must_decide() {
        let prod = Input::Inputs {
            input: "prod",
            dependencies: true,
            always: false,
        };
        // With outputs, `leaf` hashes dependency outputs, which only the walk resolves.
        for with_outputs in [false, true] {
            let planner = mixed_cycle_planner(with_outputs);
            let externals = planner
                .external_deps_mapped
                .get_or_init(|| planner.compute_external_deps());
            for root in ["app", "cycle-a", "self-cycle"] {
                let deps = &planner.project_graph.dependencies[root];
                let rooted =
                    planner.cycle_rooted_inputs(root, std::slice::from_ref(&prod), deps, externals);
                assert_eq!(
                    rooted.is_some(),
                    !with_outputs || root == "self-cycle",
                    "{root}"
                );
            }
        }
    }

    #[test]
    fn only_project_closures_without_cycles_are_memoized() {
        let planner = mixed_cycle_planner(false);
        let safe = planner.find_acyclic_dependency_projects();
        assert_eq!(
            safe,
            hashbrown::HashSet::from(["branch".into(), "leaf".into(), "isolated".into()])
        );
        for name in planner.project_graph.nodes.keys() {
            assert_eq!(planner.dependency_memo_enabled(name), safe.contains(name));
        }
    }

    #[test]
    fn mixed_cycles_match_visited_traversal_with_multiple_inputs_and_output_fallback() {
        for with_outputs in [false, true] {
            let cached = mixed_cycle_planner(with_outputs);
            let legacy = mixed_cycle_planner(with_outputs);
            legacy
                .acyclic_dependency_projects
                .set(hashbrown::HashSet::new())
                .unwrap();
            // Force both optimizations off in the reference planner, retaining
            // the original visited traversal rather than comparing two cache paths.
            let local_cache = legacy.local_inputs_memo.get_or_init(OnceCache::new);
            for name in legacy.project_graph.nodes.keys() {
                for input in ["prod", "spec"] {
                    let input = Input::Inputs {
                        input,
                        dependencies: true,
                        always: false,
                    };
                    local_cache
                        .get_or_try_init(
                            local_input_cache_key(name, std::slice::from_ref(&input)).unwrap(),
                            || {
                                Ok::<_, ()>(LocalDependencyInputs {
                                    ids: vec![],
                                    always: vec![],
                                    needs_legacy: true,
                                })
                            },
                        )
                        .unwrap();
                }
            }
            let tasks = || {
                let tasks: HashMap<_, _> = cached
                    .project_graph
                    .nodes
                    .keys()
                    .map(|name| {
                        let task =
                            Task::new(name, "build").with_outputs(vec![format!("{name}/out.js")]);
                        (task.id.clone(), task)
                    })
                    .collect();
                TaskGraph {
                    roots: tasks.keys().cloned().collect(),
                    dependencies: tasks
                        .keys()
                        .map(|id| {
                            (
                                id.clone(),
                                if id == "app:build" {
                                    edges_to(&["leaf:build"])
                                } else {
                                    vec![]
                                },
                            )
                        })
                        .collect(),
                    continuous_dependencies: HashMap::new(),
                    tasks,
                }
            };
            let mut ids: Vec<_> = tasks().tasks.keys().cloned().collect();
            let expected = legacy
                .get_plans_materialized(
                    ids.iter().map(String::as_str).collect(),
                    tasks(),
                    None,
                    &[],
                )
                .unwrap();
            for _ in 0..3 {
                ids.reverse();
                assert_eq!(
                    cached
                        .get_plans_materialized(
                            ids.iter().map(String::as_str).collect(),
                            tasks(),
                            None,
                            &[]
                        )
                        .unwrap(),
                    expected
                );
            }
            for id in &ids {
                assert_eq!(
                    cached
                        .get_plans_materialized(vec![id], tasks(), None, &[])
                        .unwrap()[id],
                    expected[id]
                );
            }
        }
    }

    #[test]
    fn local_input_cache_is_non_recursive_and_retains_output_fallback() {
        let planner = mixed_cycle_planner(true);
        let input = Input::Inputs {
            input: "prod",
            dependencies: true,
            always: false,
        };
        let first = planner
            .local_dependency_inputs("cycle-a", std::slice::from_ref(&input))
            .unwrap()
            .unwrap();
        let second = planner
            .local_dependency_inputs("cycle-a", std::slice::from_ref(&input))
            .unwrap()
            .unwrap();
        assert!(Arc::ptr_eq(&first, &second));
        assert!(!first.needs_legacy);
        assert_eq!(first.ids.len(), 3);
        for id in &first.ids {
            match planner.instruction_pool.get(*id).value() {
                HashInstruction::ProjectConfiguration(name)
                | HashInstruction::TsConfiguration(name)
                | HashInstruction::ProjectFileSet(name, _) => assert_eq!(name, "cycle-a"),
                other => panic!("Unexpected local instruction: {other:?}"),
            }
        }
        assert_eq!(planner.local_inputs_memo.get().unwrap().len(), 1);
        assert_eq!(planner.subtree_memo.len(), 0);
        let output = planner
            .local_dependency_inputs("leaf", std::slice::from_ref(&input))
            .unwrap()
            .unwrap();
        assert!(output.needs_legacy);
        assert!(output.ids.is_empty());
    }

    #[test]
    fn local_input_keys_preserve_boundaries_and_input_kinds() {
        let named = |input| Input::Inputs {
            input,
            dependencies: true,
            always: false,
        };
        assert_ne!(
            local_input_cache_key("a", &[named("b\0i\0c")]),
            local_input_cache_key("a\0i\0b", &[named("c")])
        );
        assert_ne!(
            local_input_cache_key("a", &[named("{projectRoot}/file")]),
            local_input_cache_key(
                "a",
                &[Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: true,
                    include_ignored: false,
                    always: false,
                }]
            )
        );
        // The two backing stores are different subtrees for the same glob.
        assert_ne!(
            local_input_cache_key(
                "a",
                &[Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: true,
                    include_ignored: false,
                    always: false,
                }]
            ),
            local_input_cache_key(
                "a",
                &[Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: true,
                    include_ignored: true,
                    always: false,
                }]
            )
        );
        assert!(
            local_input_cache_key(
                "a",
                &[Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: false,
                    include_ignored: false,
                    always: false,
                }]
            )
            .is_none()
        );
        assert!(local_input_cache_key("a", &[Input::String("default")]).is_none());
    }

    /// The key carries each member's kind, not only its globs, so two groups
    /// naming the same filesets cannot share a memo entry. Callers do not
    /// build a mixed group — the arms into the key debug-assert it — and this
    /// pins the key itself, which is what still stands in a release binary.
    #[test]
    fn a_group_key_separates_members_by_kind() {
        let fs = |fileset, include_ignored| Input::FileSet {
            fileset,
            dependencies: true,
            include_ignored,
            always: false,
        };
        assert_ne!(
            grouped_cache_key("p", &[fs("x", true), fs("y", false)]),
            grouped_cache_key("p", &[fs("x", false), fs("y", true)])
        );
        assert_ne!(
            grouped_cache_key("p", &[fs("x", true), fs("y", true)]),
            grouped_cache_key("p", &[fs("x", false), fs("y", false)])
        );
    }

    #[test]
    fn group_keys_are_distinct_from_each_other_and_from_single_inputs() {
        let ignored = |fileset| Input::FileSet {
            fileset,
            dependencies: true,
            include_ignored: true,
            always: false,
        };
        let group = |globs: &[&'static str]| {
            let group: Vec<_> = globs.iter().map(|glob| ignored(glob)).collect();
            (
                group_cache_key("a", &group),
                local_input_cache_key("a", &group),
            )
        };
        assert_ne!(group(&["x", "!y"]), group(&["x", "!z"]));
        // Order is part of the key: it is the order the globs are hashed in.
        assert_ne!(group(&["x", "!y"]), group(&["!y", "x"]));
        // A joined group cannot be read as one glob holding the separator.
        assert_ne!(group(&["x", "!y"]), group(&["x\0!y", "x"]));
        assert_ne!(
            group(&["x", "!y"]).0,
            group_cache_key("a", &[ignored("x\0!y")])
        );
    }

    #[test]
    fn instruction_union_preserves_ids_across_word_boundaries() {
        let values = vec![1024, 0, 63, 64, 65, 127, 128, 63, 1024, 1, 0];
        let mut expected = values.clone();
        expected.sort_unstable();
        expected.dedup();
        let mut set: InstructionIdSet = values.into_iter().collect();
        set.extend([128, 65, 0]);
        assert_eq!(set.into_sorted_vec(), expected);
        assert!(InstructionIdSet::default().into_sorted_vec().is_empty());
    }

    #[test]
    fn overlapping_project_closures_retain_only_unique_instruction_capacity() {
        let branches: Vec<String> = (0..20).map(|i| format!("branch-{i}")).collect();
        let leaves: Vec<String> = (0..30).map(|i| format!("leaf-{i}")).collect();
        let names: Vec<String> = std::iter::once("app".to_string())
            .chain(branches.iter().cloned())
            .chain(leaves.iter().cloned())
            .collect();
        let mut dependencies = HashMap::from([("app".to_string(), branches.clone())]);
        for branch in &branches {
            dependencies.insert(branch.clone(), leaves.clone());
        }
        for leaf in &leaves {
            dependencies.insert(leaf.clone(), vec![]);
        }
        let graph = ProjectGraph {
            nodes: names
                .iter()
                .map(|name| {
                    (
                        name.clone(),
                        Project {
                            root: name.clone(),
                            targets: HashMap::from([("build".to_string(), Target::default())]),
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            dependencies,
            external_nodes: HashMap::new(),
        };
        let planner = HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(graph)),
        );
        let subtree = planner
            .memoized_dep_subtree(
                "app",
                &[Input::Inputs {
                    input: "default",
                    dependencies: true,
                    always: false,
                }],
                &HashMap::new(),
            )
            .unwrap();
        assert!(!subtree.needs_legacy);
        let ids = subtree.ids.ids().into_owned();
        let projects = ids
            .iter()
            .filter(|id| {
                matches!(
                    planner.instruction_pool.get(**id).value(),
                    HashInstruction::ProjectConfiguration(_)
                )
            })
            .count();
        assert_eq!(projects, names.len());
        assert!(ids.windows(2).all(|ids| ids[0] < ids[1]));
        assert!(
            ids.capacity() <= ids.len() * 2,
            "{} unique instructions retained {} slots",
            ids.len(),
            ids.capacity()
        );
    }

    #[test]
    fn insert_reports_first_insertion_only() {
        let mut visited = VisitedTracker::new("seed");
        assert!(!visited.insert("seed"));
        assert!(visited.insert("a"));
        assert!(!visited.insert("a"));
    }

    #[test]
    fn rollback_unvisits_only_the_scope() {
        let mut visited = VisitedTracker::new("seed");
        assert!(visited.insert("outer"));

        let scope = visited.scope_start();
        assert!(visited.insert("inner1"));
        assert!(visited.insert("inner2"));
        visited.rollback_to(scope);

        // Scoped visits are undone; earlier ones are not.
        assert!(visited.insert("inner1"));
        assert!(!visited.insert("outer"));
        assert!(!visited.insert("seed"));
    }

    #[test]
    fn overlapping_external_closures_retain_capacity_proportional_to_unique_inputs() {
        let direct_count = 50;
        let shared_count = 100;
        let direct: Vec<String> = (0..direct_count)
            .map(|i| format!("npm:direct-{i}"))
            .collect();
        let shared: Vec<String> = (0..shared_count)
            .map(|i| format!("npm:shared-{i}"))
            .collect();
        let mut dependencies = HashMap::from([("app".to_string(), direct.clone())]);
        for dep in &direct {
            dependencies.insert(dep.clone(), shared.clone());
        }
        let graph = ProjectGraph {
            nodes: HashMap::from([(
                "app".to_string(),
                Project {
                    root: "app".to_string(),
                    targets: HashMap::from([("build".to_string(), Target::default())]),
                    ..Default::default()
                },
            )]),
            dependencies,
            external_nodes: direct
                .into_iter()
                .chain(shared)
                .map(|name| {
                    (
                        name,
                        ExternalNode {
                            r#type: Some("npm".into()),
                            package_name: None,
                            version: "1.0.0".to_string(),
                            hash: None,
                        },
                    )
                })
                .collect(),
        };
        let planner = HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(graph)),
        );
        let task = Task::new("app", "build");
        let task_graph = TaskGraph {
            roots: vec![task.id.clone()],
            tasks: HashMap::from([(task.id.clone(), task)]),
            dependencies: HashMap::new(),
            continuous_dependencies: HashMap::new(),
        };
        let plans = planner
            .get_plans_internal(vec!["app:build"], task_graph, None, &[])
            .unwrap();
        let plan = plans.plans["app:build"].ids().into_owned();
        assert_eq!(
            plan.iter()
                .filter(|id| matches!(plans.pool.get(**id).value(), HashInstruction::External(_)))
                .count(),
            direct_count + shared_count
        );
        // Vec::dedup alone leaves storage for all 5,050 external occurrences.
        // Bound retained storage without depending on exact allocator growth.
        assert!(
            plan.capacity() <= plan.len() * 2,
            "{} unique instructions retained {} slots",
            plan.len(),
            plan.capacity()
        );
    }
}
