//! Whole-task plans kept between `get_plans` calls on one planner. A plan
//! reads its task's target, outputs, edges and snapshot eligibility and those
//! of everything it depends on, plus the snapshot set, so it stays valid while
//! none of those changed.

use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, MutexGuard};

use crate::native::tasks::types::{TaskGraph, TaskTarget, TaskUltracacheConfiguration};

#[derive(Default)]
pub(super) struct PlanMemo {
    recorded: Mutex<Option<Recorded>>,
}

/// Invariant: every task in `plans` has its closure described by `tasks`, as
/// it was when the plan was made.
struct Recorded {
    /// The snapshot set's commit and fetch time; plans made against another are dropped.
    snapshots: Option<(String, i64)>,
    tasks: HashMap<String, PlannedTask>,
    plans: HashMap<String, Vec<u32>>,
}

/// What planning reads from one task graph node.
#[derive(PartialEq)]
struct PlannedTask {
    target: TaskTarget,
    outputs: Vec<String>,
    dependencies: Vec<String>,
    continuous_dependencies: Vec<String>,
    ultracache: Option<TaskUltracacheConfiguration>,
    custom_hasher: bool,
}

impl PlannedTask {
    fn of(task_graph: &TaskGraph, custom_hasher: &HashSet<&str>, id: &str) -> Option<Self> {
        let task = task_graph.tasks.get(id)?;
        Some(Self {
            target: task.target.clone(),
            outputs: task.outputs.clone(),
            dependencies: edges(&task_graph.dependencies, id).to_vec(),
            continuous_dependencies: edges(&task_graph.continuous_dependencies, id).to_vec(),
            ultracache: task.ultracache.clone(),
            custom_hasher: custom_hasher.contains(id),
        })
    }

    fn matches(&self, task_graph: &TaskGraph, custom_hasher: &HashSet<&str>, id: &str) -> bool {
        task_graph.tasks.get(id).is_some_and(|task| {
            self.target == task.target
                && self.outputs == task.outputs
                && self.dependencies == edges(&task_graph.dependencies, id)
                && self.continuous_dependencies == edges(&task_graph.continuous_dependencies, id)
                && self.ultracache == task.ultracache
                && self.custom_hasher == custom_hasher.contains(id)
        })
    }
}

fn edges<'a>(edges: &'a HashMap<String, Vec<String>>, id: &str) -> &'a [String] {
    edges.get(id).map_or(&[], Vec::as_slice)
}

impl PlanMemo {
    /// Holds the memo for one planning call, with every plan that no longer
    /// holds for `task_graph` under `snapshots` dropped. `custom_hasher` are
    /// the tasks snapshot eligibility withholds.
    pub(super) fn begin(
        &self,
        task_graph: &TaskGraph,
        snapshots: Option<(String, i64)>,
        custom_hasher: &[String],
    ) -> PlanMemoGuard<'_> {
        let mut recorded = self.recorded.lock().expect("plan memo lock");
        if recorded
            .as_ref()
            .is_none_or(|recorded| recorded.snapshots != snapshots)
        {
            *recorded = Some(Recorded {
                snapshots,
                tasks: HashMap::new(),
                plans: HashMap::new(),
            });
        }
        let custom_hasher: HashSet<&str> = custom_hasher.iter().map(String::as_str).collect();
        recorded
            .as_mut()
            .expect("just set")
            .forget_what_changed(task_graph, &custom_hasher);
        PlanMemoGuard { recorded }
    }
}

/// The memo locked from `begin` to `finish`, so one call's lookups and inserts
/// agree on one task graph.
pub(super) struct PlanMemoGuard<'a> {
    recorded: MutexGuard<'a, Option<Recorded>>,
}

impl PlanMemoGuard<'_> {
    /// The tasks of `task_ids` with no plan kept.
    pub(super) fn missing<'t>(&self, task_ids: &[&'t str]) -> Vec<&'t str> {
        let plans = &self.recorded.as_ref().expect("begun").plans;
        task_ids
            .iter()
            .copied()
            .filter(|id| !plans.contains_key(*id))
            .collect()
    }

    /// Keeps `planned` and returns the plans of `task_ids`.
    pub(super) fn finish(
        mut self,
        planned: HashMap<String, Vec<u32>>,
        task_ids: &[&str],
    ) -> HashMap<String, Vec<u32>> {
        let plans = &mut self.recorded.as_mut().expect("begun").plans;
        plans.extend(planned);
        task_ids
            .iter()
            .filter_map(|id| Some((id.to_string(), plans.get(*id)?.clone())))
            .collect()
    }
}

impl Recorded {
    /// Brings `tasks` up to `task_graph` and drops every plan that no longer
    /// holds for it, keeping the invariant.
    fn forget_what_changed(&mut self, task_graph: &TaskGraph, custom_hasher: &HashSet<&str>) {
        let changed: Vec<&str> = task_graph
            .tasks
            .keys()
            .map(String::as_str)
            .filter(|id| {
                !self
                    .tasks
                    .get(*id)
                    .is_some_and(|recorded| recorded.matches(task_graph, custom_hasher, id))
            })
            .collect();
        for id in &changed {
            if let Some(task) = PlannedTask::of(task_graph, custom_hasher, id) {
                self.tasks.insert(id.to_string(), task);
            }
        }
        // A task outside this graph has no edges here to find it through.
        let stale = dependents_of(task_graph, changed);
        self.plans
            .retain(|id, _| task_graph.tasks.contains_key(id) && !stale.contains(id.as_str()));
    }
}

/// `changed` and every task that depends on one of them, through regular or
/// continuous edges.
fn dependents_of<'a>(task_graph: &'a TaskGraph, changed: Vec<&'a str>) -> HashSet<&'a str> {
    if changed.is_empty() {
        return HashSet::new();
    }
    let mut dependents: HashMap<&str, Vec<&str>> = HashMap::new();
    for edges in [
        &task_graph.dependencies,
        &task_graph.continuous_dependencies,
    ] {
        for (task, deps) in edges {
            for dep in deps {
                dependents
                    .entry(dep.as_str())
                    .or_default()
                    .push(task.as_str());
            }
        }
    }
    let mut stale: HashSet<&str> = changed.iter().copied().collect();
    let mut stack = changed;
    while let Some(id) = stack.pop() {
        for &dependent in dependents.get(id).into_iter().flatten() {
            if stale.insert(dependent) {
                stack.push(dependent);
            }
        }
    }
    stale
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::test_utils::task_graph;

    /// Plans every task of `graph` and returns which ones were planned.
    fn plan_all(memo: &PlanMemo, graph: &TaskGraph) -> Vec<String> {
        plan_all_under(memo, graph, None, &[])
    }

    fn plan_all_under(
        memo: &PlanMemo,
        graph: &TaskGraph,
        snapshots: Option<(String, i64)>,
        custom_hasher: &[String],
    ) -> Vec<String> {
        let ids: Vec<&str> = graph.tasks.keys().map(String::as_str).collect();
        let guard = memo.begin(graph, snapshots, custom_hasher);
        let mut missing = guard.missing(&ids);
        let planned = missing.iter().map(|id| (id.to_string(), vec![0])).collect();
        guard.finish(planned, &ids);
        missing.sort();
        missing.into_iter().map(String::from).collect()
    }

    fn graph() -> TaskGraph {
        task_graph(
            &[
                ("lib:build", &["dist/lib"]),
                ("app:build", &["dist/app"]),
                ("app:test", &[]),
                ("other:build", &["dist/other"]),
            ],
            &[("app:build", &["lib:build"]), ("app:test", &["app:build"])],
        )
    }

    #[test]
    fn the_first_call_plans_everything_and_an_unchanged_graph_nothing() {
        let memo = PlanMemo::default();
        assert_eq!(plan_all(&memo, &graph()).len(), 4);
        assert!(plan_all(&memo, &graph()).is_empty());
    }

    #[test]
    fn a_changed_output_replans_the_task_and_everything_depending_on_it() {
        let memo = PlanMemo::default();
        plan_all(&memo, &graph());
        let mut changed = graph();
        changed.tasks.get_mut("lib:build").unwrap().outputs = vec!["dist/lib-v2".into()];
        assert_eq!(
            plan_all(&memo, &changed),
            ["app:build", "app:test", "lib:build"]
        );
    }

    #[test]
    fn a_changed_edge_replans_the_task_and_its_dependents() {
        let memo = PlanMemo::default();
        plan_all(&memo, &graph());
        let mut changed = graph();
        changed.dependencies.remove("app:build");
        assert_eq!(plan_all(&memo, &changed), ["app:build", "app:test"]);
    }

    #[test]
    fn a_continuous_edge_counts() {
        let memo = PlanMemo::default();
        plan_all(&memo, &graph());
        let mut changed = graph();
        changed
            .continuous_dependencies
            .insert("app:test".into(), vec!["other:build".into()]);
        assert_eq!(plan_all(&memo, &changed), ["app:test"]);
    }

    /// What a run does after selection: ask again for some tasks of a smaller graph.
    #[test]
    fn a_smaller_graph_reuses_the_plans_of_the_tasks_it_still_has() {
        let memo = PlanMemo::default();
        plan_all(&memo, &graph());
        let mut narrowed = graph();
        narrowed.tasks.remove("other:build");
        assert!(plan_all(&memo, &narrowed).is_empty());
    }

    /// Its producers may change while it is outside the graph, with no edge to say so.
    #[test]
    fn a_task_that_left_the_graph_is_planned_again_when_it_returns() {
        let memo = PlanMemo::default();
        plan_all(&memo, &graph());
        let mut without_test = graph();
        without_test.tasks.remove("app:test");
        without_test.dependencies.remove("app:test");
        plan_all(&memo, &without_test);
        assert_eq!(plan_all(&memo, &graph()), ["app:test"]);
    }

    #[test]
    fn only_the_requested_plans_are_returned() {
        let memo = PlanMemo::default();
        plan_all(&memo, &graph());
        let plans = memo
            .begin(&graph(), None, &[])
            .finish(HashMap::new(), &["app:build"]);
        assert_eq!(plans.keys().collect::<Vec<_>>(), ["app:build"]);
    }

    #[test]
    fn another_snapshot_set_replans_everything() {
        let memo = PlanMemo::default();
        let set = |fetched_at| Some(("abc".to_string(), fetched_at));
        plan_all_under(&memo, &graph(), set(1), &[]);
        assert!(plan_all_under(&memo, &graph(), set(1), &[]).is_empty());
        assert_eq!(plan_all_under(&memo, &graph(), set(2), &[]).len(), 4);
        assert_eq!(plan_all(&memo, &graph()).len(), 4);
    }

    /// A custom hasher withholds the task's snapshot, so its plan and its dependents' differ.
    #[test]
    fn a_task_gaining_a_custom_hasher_replans_it_and_its_dependents() {
        let memo = PlanMemo::default();
        plan_all(&memo, &graph());
        assert_eq!(
            plan_all_under(&memo, &graph(), None, &["app:build".to_string()]),
            ["app:build", "app:test"]
        );
    }

    #[test]
    fn a_dependency_cycle_terminates() {
        let cyclic = || {
            task_graph(
                &[("a:build", &[]), ("b:build", &[])],
                &[("a:build", &["b:build"]), ("b:build", &["a:build"])],
            )
        };
        let memo = PlanMemo::default();
        plan_all(&memo, &cyclic());
        let mut changed = cyclic();
        changed.tasks.get_mut("a:build").unwrap().outputs = vec!["dist/a".into()];
        assert_eq!(plan_all(&memo, &changed), ["a:build", "b:build"]);
    }
}
