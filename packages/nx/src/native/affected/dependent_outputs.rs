//! Effective dependent-output edges: which upstream task's artifacts a task
//! reads, from every instruction that can express it.
//!
//! Two instructions carry that relationship, and only one of them is declared:
//!
//!   `TaskOutput(glob, outputs)` comes from an explicit
//!   `dependentTasksOutputFiles` input. It embeds the producer's declared
//!   outputs but not the producer's task id, so the id has to be recovered.
//!
//!   `Files(globs)` comes from an `includeIgnored` fileset. I/O tracing turns an
//!   observed read of a generated artifact into one of these, which can preclude
//!   the explicit input entirely — the plan then reads a dependency's build
//!   output with no `TaskOutput` anywhere in it.
//!
//! Both are matched pattern-to-pattern against the producer's *declared*
//! outputs. The artifact does not exist when affected runs (it is the thing the
//! run would produce) and it is gitignored, so it is in neither the file map nor
//! the diff. Anything that consults the filesystem here answers "no edge" for
//! every task that has not been built yet, which is exactly backwards.

use napi::bindgen_prelude::*;
use std::collections::{HashMap, HashSet, VecDeque};

use crate::native::tasks::types::{HashInstruction, HashPlans, TaskGraph};

#[napi(object)]
pub struct DependentOutputEdge {
    /// The task whose plan reads the artifact.
    pub consumer: String,
    /// The task that declares it as an output.
    pub producer: String,
}

/// Consumer -> producer edges for every task in `hash_plans`.
///
/// Producers are searched over the consumer's whole dependency closure rather
/// than its direct dependencies. `TaskOutput` does not record whether its
/// `transitive` flag was set, and an observed read cannot say how deep the
/// producer sits, so the closure is the only scope that cannot miss an edge.
/// Over-reporting an edge costs a task that was going to be a cache hit;
/// missing one skips a task that needed to run.
#[napi]
pub fn dependent_output_edges(
    #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    hash_plans: &External<HashPlans>,
    task_graph: TaskGraph,
) -> Vec<DependentOutputEdge> {
    compute_dependent_output_edges(hash_plans, &task_graph)
}

pub(crate) fn compute_dependent_output_edges(
    hash_plans: &HashPlans,
    task_graph: &TaskGraph,
) -> Vec<DependentOutputEdge> {
    let mut edges = Vec::new();

    for (consumer, plan) in &hash_plans.plans {
        // Owned, because the pool hands out a guard that cannot outlive the
        // lookup it came from.
        let mut consumer_globs: Vec<String> = Vec::new();
        let mut declared_outputs: Vec<Vec<String>> = Vec::new();

        for id in plan {
            match hash_plans.pool.get(*id).value() {
                HashInstruction::Files(globs) => consumer_globs.extend(globs.iter().cloned()),
                HashInstruction::TaskOutput(_, outputs) => declared_outputs.push(outputs.clone()),
                _ => {}
            }
        }

        if consumer_globs.is_empty() && declared_outputs.is_empty() {
            continue;
        }

        for producer in upstream_task_ids(task_graph, consumer) {
            let Some(task) = task_graph.tasks.get(&producer) else {
                continue;
            };
            if task.outputs.is_empty() {
                continue;
            }
            // An explicit TaskOutput was built from this producer's outputs, so
            // the vectors are equal rather than merely overlapping.
            let explicit = declared_outputs.iter().any(|o| *o == task.outputs);
            let inferred = !explicit
                && consumer_globs
                    .iter()
                    .any(|glob| overlaps_any_output(glob, &task.outputs));
            if explicit || inferred {
                edges.push(DependentOutputEdge {
                    consumer: consumer.clone(),
                    producer,
                });
            }
        }
    }

    edges.sort_by(|a, b| (&a.consumer, &a.producer).cmp(&(&b.consumer, &b.producer)));
    edges
}

/// Every task reachable from `start` through `dependencies`, excluding itself.
/// `continuous_dependencies` are not traversed: a watch or serve task does not
/// produce the artifacts a hash reads, matching `collect_task_dependencies`.
fn upstream_task_ids(task_graph: &TaskGraph, start: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut queue = VecDeque::from([start.to_string()]);
    let mut out = Vec::new();

    while let Some(id) = queue.pop_front() {
        let Some(deps) = task_graph.dependencies.get(&id) else {
            continue;
        };
        for dep in deps {
            if seen.insert(dep.clone()) {
                out.push(dep.clone());
                queue.push_back(dep.clone());
            }
        }
    }
    out
}

/// Whether a consumer glob could match something produced under any of the
/// producer's outputs. Negated patterns on either side subtract, so neither can
/// establish an edge on its own.
fn overlaps_any_output(consumer_glob: &str, outputs: &[String]) -> bool {
    if consumer_glob.starts_with('!') {
        return false;
    }
    outputs
        .iter()
        .filter(|output| !output.starts_with('!'))
        .any(|output| paths_overlap(consumer_glob, output))
}

/// Directory containment between two patterns, compared on their literal
/// prefixes because neither side is a concrete path.
///
/// Segment-wise, so `dist/libs/ui` does not contain `dist/libs/ui-legacy` the
/// way a plain `starts_with` would.
fn paths_overlap(a: &str, b: &str) -> bool {
    let a = literal_prefix(a);
    let b = literal_prefix(b);
    // An empty prefix means the pattern starts with a wildcard and could match
    // anywhere, so it overlaps everything.
    if a.is_empty() || b.is_empty() {
        return true;
    }
    let (shorter, longer) = if a.len() <= b.len() { (a, b) } else { (b, a) };
    let mut short_segments = shorter.split('/');
    let mut long_segments = longer.split('/');
    loop {
        match (short_segments.next(), long_segments.next()) {
            (Some(s), Some(l)) if s == l => continue,
            (Some(_), _) => return false,
            (None, _) => return true,
        }
    }
}

/// The leading path segments of a glob that contain no wildcard, so
/// `dist/libs/ui/**/*.js` reduces to `dist/libs/ui`.
fn literal_prefix(pattern: &str) -> &str {
    let pattern = pattern.strip_prefix('!').unwrap_or(pattern);
    let end = pattern
        .find(|c| matches!(c, '*' | '?' | '[' | '{' | '(' | '!'))
        .unwrap_or(pattern.len());
    let truncated = &pattern[..end];
    // Back up to the last complete segment: `dist/li*` must not claim `dist/li`.
    match truncated.rfind('/') {
        Some(slash) if end < pattern.len() => &pattern[..slash],
        _ => truncated.trim_end_matches('/'),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::{InstructionPool, Task};
    use std::sync::Arc;

    fn task(id: &str, outputs: &[&str]) -> Task {
        Task::new(id.split(':').next().unwrap(), id.split(':').nth(1).unwrap())
            .with_outputs(outputs.iter().map(|o| o.to_string()).collect())
            .with_project_root("test")
    }

    fn graph(tasks: Vec<(&str, &[&str])>, deps: Vec<(&str, Vec<&str>)>) -> TaskGraph {
        TaskGraph {
            roots: vec![],
            tasks: tasks
                .into_iter()
                .map(|(id, outputs)| {
                    let mut t = task(id, outputs);
                    t.id = id.to_string();
                    (id.to_string(), t)
                })
                .collect(),
            dependencies: deps
                .into_iter()
                .map(|(id, ds)| {
                    (
                        id.to_string(),
                        ds.into_iter().map(String::from).collect::<Vec<_>>(),
                    )
                })
                .collect(),
            continuous_dependencies: HashMap::new(),
        }
    }

    fn plans(entries: Vec<(&str, Vec<HashInstruction>)>) -> HashPlans {
        let pool = Arc::new(InstructionPool::new());
        HashPlans {
            plans: entries
                .into_iter()
                .map(|(task, instructions)| {
                    (
                        task.to_string(),
                        instructions.into_iter().map(|i| pool.intern(i)).collect(),
                    )
                })
                .collect(),
            pool,
        }
    }

    fn strings(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    fn edges_of(p: &HashPlans, g: &TaskGraph) -> Vec<(String, String)> {
        compute_dependent_output_edges(p, g)
            .into_iter()
            .map(|e| (e.consumer, e.producer))
            .collect()
    }

    // --- literal_prefix / paths_overlap -------------------------------------

    #[test]
    fn literal_prefix_stops_at_the_last_whole_segment() {
        assert_eq!(literal_prefix("dist/libs/ui/**/*.js"), "dist/libs/ui");
        assert_eq!(literal_prefix("dist/li*"), "dist");
        assert_eq!(literal_prefix("dist/libs/ui"), "dist/libs/ui");
        assert_eq!(literal_prefix("!dist/libs/ui/**"), "dist/libs/ui");
        assert_eq!(literal_prefix("**/*.js"), "");
    }

    /// The `libs/a` vs `libs/a-legacy` trap: a plain prefix compare says these
    /// overlap.
    #[test]
    fn overlap_is_compared_segment_wise() {
        assert!(paths_overlap("dist/libs/ui/**/*.js", "dist/libs/ui"));
        assert!(paths_overlap("dist/libs/ui", "dist/libs/ui/**"));
        assert!(!paths_overlap("dist/libs/ui-legacy/**", "dist/libs/ui"));
        assert!(!paths_overlap("dist/apps/web/**", "dist/libs/ui"));
    }

    // --- edge inference ------------------------------------------------------

    #[test]
    fn explicit_task_output_yields_an_edge() {
        let g = graph(
            vec![("app:build", &[]), ("ui:build", &["dist/libs/ui"])],
            vec![("app:build", vec!["ui:build"])],
        );
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::TaskOutput(
                "**/*.js".into(),
                strings(&["dist/libs/ui"]),
            )],
        )]);
        assert_eq!(
            edges_of(&p, &g),
            vec![("app:build".to_string(), "ui:build".to_string())]
        );
    }

    /// The case I/O tracing produces: an observed read of a generated artifact
    /// becomes an includeIgnored fileset, and no `dependentTasksOutputFiles`
    /// input is declared at all.
    #[test]
    fn an_include_ignored_fileset_overlapping_outputs_yields_an_edge() {
        let g = graph(
            vec![("app:build", &[]), ("ui:build", &["dist/libs/ui"])],
            vec![("app:build", vec!["ui:build"])],
        );
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
        )]);
        assert_eq!(
            edges_of(&p, &g),
            vec![("app:build".to_string(), "ui:build".to_string())]
        );
    }

    #[test]
    fn a_fileset_that_does_not_overlap_yields_no_edge() {
        let g = graph(
            vec![("app:build", &[]), ("ui:build", &["dist/libs/ui"])],
            vec![("app:build", vec!["ui:build"])],
        );
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::Files(strings(&[
                "generated/openapi/**/*.ts",
            ]))],
        )]);
        assert!(edges_of(&p, &g).is_empty());
    }

    #[test]
    fn negated_patterns_do_not_establish_an_edge() {
        let g = graph(
            vec![("app:build", &[]), ("ui:build", &["dist/libs/ui"])],
            vec![("app:build", vec!["ui:build"])],
        );
        // Consumer-side negation.
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::Files(strings(&["!dist/libs/ui/**/*.map"]))],
        )]);
        assert!(edges_of(&p, &g).is_empty());

        // Producer-side negation.
        let g2 = graph(
            vec![("app:build", &[]), ("ui:build", &["!dist/libs/ui"])],
            vec![("app:build", vec!["ui:build"])],
        );
        let p2 = plans(vec![(
            "app:build",
            vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
        )]);
        assert!(edges_of(&p2, &g2).is_empty());
    }

    #[test]
    fn a_transitive_producer_is_reached() {
        let g = graph(
            vec![
                ("app:build", &[]),
                ("ui:build", &["dist/libs/ui"]),
                ("core:build", &["dist/libs/core"]),
            ],
            vec![
                ("app:build", vec!["ui:build"]),
                ("ui:build", vec!["core:build"]),
            ],
        );
        // app reads core's output directly, two hops down.
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::Files(strings(&["dist/libs/core/**/*.js"]))],
        )]);
        assert_eq!(
            edges_of(&p, &g),
            vec![("app:build".to_string(), "core:build".to_string())]
        );
    }

    #[test]
    fn a_task_outside_the_dependency_closure_is_not_a_producer() {
        let g = graph(
            vec![("app:build", &[]), ("unrelated:build", &["dist/libs/ui"])],
            vec![("app:build", vec![])],
        );
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
        )]);
        assert!(edges_of(&p, &g).is_empty());
    }

    #[test]
    fn a_producer_with_no_declared_outputs_is_skipped() {
        let g = graph(
            vec![("app:build", &[]), ("ui:build", &[])],
            vec![("app:build", vec!["ui:build"])],
        );
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
        )]);
        assert!(edges_of(&p, &g).is_empty());
    }
}
