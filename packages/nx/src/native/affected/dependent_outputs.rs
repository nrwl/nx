//! Which upstream task's build artifacts a task reads.
//!
//! Neither kind of read can be matched against the filesystem: the artifact does
//! not exist when affected runs (it is the thing the run would produce) and it is
//! gitignored, so it is in neither the file map nor the diff. Both are answered
//! from declared configuration.
//!
//! The two kinds need different work, and only one of them is expensive.
//!
//! `TaskOutput(glob, outputs)` comes from an explicit `dependentTasksOutputFiles`
//! input, and `process_tasks_outputs` builds one per dependent task from
//! `task.outputs.clone()`. The embedded vector *is* some producer's declared
//! outputs, so equality against `task.outputs` names that producer exactly. No
//! path analysis, and no dependency walk: the instruction exists only because the
//! producer was already a dependency.
//!
//! `Files(globs)` comes from an `includeIgnored` fileset. I/O tracing turns an
//! observed read of a generated artifact into one of these, which can preclude
//! the explicit input entirely, so a plan can read a dependency's output with no
//! `TaskOutput` anywhere in it. It names no producer, so the read patterns are
//! compared to declared outputs on their literal prefixes, over the consumer's
//! dependency closure. That walk runs only for the tasks that carry such a read.

use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};

use crate::native::tasks::types::{HashInstruction, HashPlans, TaskGraph};

/// Consumer task id -> the upstream task ids whose declared outputs it reads.
///
/// Producers are searched over the whole dependency closure, not just direct
/// dependencies: `TaskOutput` does not record whether its `transitive` flag was
/// set, and an observed read cannot say how deep the producer sits. Over-
/// reporting an edge costs a task that was going to be a cache hit; missing one
/// skips a task that needed to run.
#[napi(ts_return_type = "Record<string, Array<string>>")]
pub fn dependent_output_edges(
    #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    hash_plans: &External<HashPlans>,
    task_graph: TaskGraph,
) -> HashMap<String, Vec<String>> {
    compute_dependent_output_edges(hash_plans, &task_graph)
}

pub(crate) fn compute_dependent_output_edges(
    hash_plans: &HashPlans,
    task_graph: &TaskGraph,
) -> HashMap<String, Vec<String>> {
    // Indexed both ways, because the two read kinds ask different questions:
    // TaskOutput matches an output vector whole, an includeIgnored glob matches
    // a directory prefix.
    let mut producers_by_outputs: HashMap<&[String], Vec<&str>> = HashMap::new();
    let mut output_prefixes: HashMap<&str, Vec<String>> = HashMap::new();
    for (id, task) in &task_graph.tasks {
        if task.outputs.is_empty() {
            continue;
        }
        producers_by_outputs
            .entry(task.outputs.as_slice())
            .or_default()
            .push(id.as_str());
        output_prefixes.insert(id.as_str(), positive_prefixes(&task.outputs));
    }

    // Resolved once per distinct instruction rather than once per task: one
    // instruction shared by a thousand plans is interned to a single id. Cloned
    // rather than borrowed, since the pool hands out a guard that cannot outlive
    // the lookup; the count is bounded by unique inputs, not by task count.
    let mut ids: Vec<u32> = hash_plans.plans.values().flatten().copied().collect();
    ids.par_sort_unstable();
    ids.dedup();

    let mut declared_reads: HashMap<u32, Vec<String>> = HashMap::new();
    let mut glob_reads: HashMap<u32, Vec<String>> = HashMap::new();
    for id in ids {
        match hash_plans.pool.get(id).value() {
            HashInstruction::TaskOutput(_, outputs) => {
                declared_reads.insert(id, outputs.clone());
            }
            HashInstruction::Files(globs) => {
                glob_reads.insert(id, positive_prefixes(globs));
            }
            _ => {}
        }
    }
    if declared_reads.is_empty() && glob_reads.is_empty() {
        return HashMap::new();
    }

    hash_plans
        .plans
        .par_iter()
        .map_init(HashSet::new, |seen, (consumer, plan)| {
            let mut producers: Vec<&str> = plan
                .iter()
                .filter_map(|id| declared_reads.get(id))
                .filter_map(|outputs| producers_by_outputs.get(outputs.as_slice()))
                .flatten()
                .copied()
                .collect();

            // Only an includeIgnored read needs the closure, so a plan without
            // one never pays for the walk.
            let read_prefixes: Vec<&String> = plan
                .iter()
                .filter_map(|id| glob_reads.get(id))
                .flatten()
                .collect();
            if !read_prefixes.is_empty() {
                for upstream in closure_of(task_graph, consumer, seen) {
                    if let Some(outputs) = output_prefixes.get(upstream) {
                        let overlaps = read_prefixes
                            .iter()
                            .any(|read| outputs.iter().any(|out| paths_overlap(read, out)));
                        if overlaps {
                            producers.push(upstream);
                        }
                    }
                }
            }

            if producers.is_empty() {
                return None;
            }
            // The walk order is not meaningful; sort for a stable answer.
            producers.sort_unstable();
            producers.dedup();
            Some((
                consumer.clone(),
                producers.into_iter().map(str::to_string).collect(),
            ))
        })
        .flatten()
        .collect()
}

/// Every task reachable from `from` through `dependencies`, excluding itself
/// unless a cycle leads back. `continuous_dependencies` are not traversed: a
/// watch or serve task does not produce the artifacts a hash reads, matching
/// `collect_task_dependencies`. `seen` is caller-owned so one allocation serves
/// every consumer on a rayon worker.
fn closure_of<'a>(
    task_graph: &'a TaskGraph,
    from: &str,
    seen: &mut HashSet<&'a str>,
) -> Vec<&'a str> {
    seen.clear();
    let mut stack: Vec<&str> = vec![from];
    let mut reached = Vec::new();
    while let Some(current) = stack.pop() {
        let Some(deps) = task_graph.dependencies.get(current) else {
            continue;
        };
        for dep in deps {
            if seen.insert(dep.as_str()) {
                reached.push(dep.as_str());
                stack.push(dep.as_str());
            }
        }
    }
    reached
}

fn positive_prefixes(patterns: &[String]) -> Vec<String> {
    patterns
        .iter()
        .filter(|pattern| !pattern.starts_with('!'))
        .map(|pattern| literal_prefix(pattern).to_string())
        .collect()
}

/// Directory containment between two patterns, compared on their literal
/// prefixes because neither side is a concrete path. An empty prefix means the
/// pattern leads with a wildcard and could match anywhere.
fn paths_overlap(a: &str, b: &str) -> bool {
    a.is_empty() || b.is_empty() || is_path_prefix(a, b) || is_path_prefix(b, a)
}

/// Segment-wise, so `dist/libs/ui` does not contain `dist/libs/ui-legacy` the
/// way a plain `starts_with` would.
fn is_path_prefix(prefix: &str, path: &str) -> bool {
    path == prefix
        || path
            .strip_prefix(prefix)
            .is_some_and(|rest| rest.starts_with('/'))
}

/// The leading path segments of a glob that contain no wildcard, so
/// `dist/libs/ui/**/*.js` reduces to `dist/libs/ui`. A pattern whose first
/// segment is already a wildcard reduces to `""`, which overlaps everything.
fn literal_prefix(pattern: &str) -> &str {
    let pattern = pattern.strip_prefix('!').unwrap_or(pattern);
    let Some(wildcard) = pattern.find(['*', '?', '[', '{', '(']) else {
        return pattern.trim_end_matches('/');
    };
    // Back up to the last complete segment: `dist/li*` must not claim `dist/li`.
    pattern[..wildcard]
        .rfind('/')
        .map_or("", |slash| &pattern[..slash])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::{InstructionPool, Task};
    use std::sync::Arc;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
    }

    fn task_graph(tasks: &[(&str, &[&str])], deps: &[(&str, &[&str])]) -> TaskGraph {
        TaskGraph {
            tasks: tasks
                .iter()
                .map(|(id, outputs)| {
                    (
                        id.to_string(),
                        Task {
                            id: id.to_string(),
                            outputs: strings(outputs),
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            dependencies: deps
                .iter()
                .map(|(id, d)| (id.to_string(), strings(d)))
                .collect(),
            continuous_dependencies: HashMap::new(),
            roots: vec![],
        }
    }

    fn plans(entries: &[(&str, Vec<HashInstruction>)]) -> HashPlans {
        let pool = Arc::new(InstructionPool::new());
        HashPlans {
            plans: entries
                .iter()
                .map(|(task, instructions)| {
                    let ids = instructions
                        .iter()
                        .map(|i| pool.intern(i.clone()))
                        .collect();
                    (task.to_string(), ids)
                })
                .collect(),
            pool,
        }
    }

    fn edges(
        tasks: &[(&str, &[&str])],
        deps: &[(&str, &[&str])],
        entries: &[(&str, Vec<HashInstruction>)],
    ) -> HashMap<String, Vec<String>> {
        compute_dependent_output_edges(&plans(entries), &task_graph(tasks, deps))
    }

    fn task_output(outputs: &[&str]) -> HashInstruction {
        HashInstruction::TaskOutput("**/*.js".into(), strings(outputs))
    }

    /// The embedded vector is the producer's own `outputs`, so equality names it.
    #[test]
    fn resolves_the_producer_a_task_output_embeds() {
        let e = edges(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build"])],
            &[("app:build", vec![task_output(&["dist/libs/ui"])])],
        );
        assert_eq!(e["app:build"], strings(&["ui:build"]));
    }

    /// A sibling dependency whose outputs the consumer does not name is not a
    /// producer. This is what coarse propagation over-selects.
    #[test]
    fn ignores_a_dependency_it_does_not_read() {
        let e = edges(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("docs:build", &["dist/docs"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build", "docs:build"])],
            &[("app:build", vec![task_output(&["dist/libs/ui"])])],
        );
        assert_eq!(e["app:build"], strings(&["ui:build"]));
    }

    /// An observed read with no TaskOutput anywhere in the plan, which is what
    /// I/O tracing produces once it has preempted the declared input.
    #[test]
    fn resolves_an_include_ignored_read_by_overlap() {
        let e = edges(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build"])],
            &[(
                "app:build",
                vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
            )],
        );
        assert_eq!(e["app:build"], strings(&["ui:build"]));
    }

    #[test]
    fn an_include_ignored_read_that_overlaps_nothing_is_not_an_edge() {
        let e = edges(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build"])],
            &[(
                "app:build",
                vec![HashInstruction::Files(strings(&["vendor/**/*.js"]))],
            )],
        );
        assert!(e.is_empty());
    }

    /// Overlap is not containment in one direction: reading the whole dist tree
    /// covers a producer that writes one directory inside it.
    #[test]
    fn a_whole_tree_read_covers_a_producer_inside_it() {
        let e = edges(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build"])],
            &[(
                "app:build",
                vec![HashInstruction::Files(strings(&["dist/**/*.js"]))],
            )],
        );
        assert_eq!(e["app:build"], strings(&["ui:build"]));
    }

    /// Segment-wise, so a prefix does not claim a sibling with a longer name.
    #[test]
    fn a_prefix_does_not_claim_a_sibling_directory() {
        let e = edges(
            &[
                ("legacy:build", &["dist/libs/ui-legacy"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["legacy:build"])],
            &[(
                "app:build",
                vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
            )],
        );
        assert!(e.is_empty());
    }

    /// A task outside the closure is not a producer however well it overlaps:
    /// reading an artifact you do not depend on is a race, not an input.
    #[test]
    fn a_matching_task_outside_the_closure_is_not_a_producer() {
        let e = edges(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[],
            &[(
                "app:build",
                vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
            )],
        );
        assert!(e.is_empty());
    }

    /// Reached through an intermediate, since a read cannot say how deep the
    /// producer sits.
    #[test]
    fn a_transitive_producer_is_found() {
        let e = edges(
            &[
                ("core:build", &["dist/libs/core"]),
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build"]), ("ui:build", &["core:build"])],
            &[(
                "app:build",
                vec![HashInstruction::Files(strings(&["dist/libs/core/**/*.js"]))],
            )],
        );
        assert_eq!(e["app:build"], strings(&["core:build"]));
    }

    /// Negated patterns are exclusions, not things read.
    #[test]
    fn a_negated_read_pattern_is_not_matched() {
        let e = edges(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build"])],
            &[(
                "app:build",
                vec![HashInstruction::Files(strings(&["!dist/libs/ui/**/*.js"]))],
            )],
        );
        assert!(e.is_empty());
    }

    /// A cycle terminates rather than recursing. The task comes back as its own
    /// producer, because the cycle genuinely leads back to it; that is inert for
    /// propagation, since a task that is affected is already affected.
    #[test]
    fn a_cycle_terminates() {
        let e = edges(
            &[("a:build", &["dist/a"]), ("b:build", &["dist/b"])],
            &[("a:build", &["b:build"]), ("b:build", &["a:build"])],
            &[(
                "a:build",
                vec![HashInstruction::Files(strings(&["dist/**/*.js"]))],
            )],
        );
        assert_eq!(e["a:build"], strings(&["a:build", "b:build"]));
    }

    #[test]
    fn a_producer_with_no_declared_outputs_is_never_matched() {
        let e = edges(
            &[("ui:build", &[]), ("app:build", &["dist/app"])],
            &[("app:build", &["ui:build"])],
            &[("app:build", vec![task_output(&[])])],
        );
        assert!(e.is_empty());
    }

    #[test]
    fn a_plan_reading_only_its_own_sources_has_no_edges() {
        let e = edges(
            &[("app:build", &["dist/app"])],
            &[],
            &[(
                "app:build",
                vec![HashInstruction::ProjectFileSet(
                    "app".into(),
                    strings(&["apps/app/**/*"]),
                )],
            )],
        );
        assert!(e.is_empty());
    }

    #[test]
    fn literal_prefix_stops_at_the_last_complete_segment() {
        assert_eq!(literal_prefix("dist/libs/ui/**/*.js"), "dist/libs/ui");
        assert_eq!(literal_prefix("dist/li*"), "dist");
        assert_eq!(literal_prefix("dist/{a,b}/**"), "dist");
        assert_eq!(literal_prefix("**/*.js"), "");
        assert_eq!(literal_prefix("dist/libs/ui/"), "dist/libs/ui");
        assert_eq!(literal_prefix("!dist/libs/ui/**"), "dist/libs/ui");
    }
}
