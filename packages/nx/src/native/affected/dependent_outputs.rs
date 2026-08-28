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
//!   the explicit input entirely. The plan then reads a dependency's build
//!   output with no `TaskOutput` anywhere in it.
//!
//! Both are matched pattern-to-pattern against the producer's *declared*
//! outputs. The artifact does not exist when affected runs (it is the thing the
//! run would produce) and it is gitignored, so it is in neither the file map nor
//! the diff. Anything that consults the filesystem here answers "no edge" for
//! every task that has not been built yet, which is exactly backwards.

use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::collections::HashMap;

use crate::native::tasks::types::{HashInstruction, HashPlans, TaskGraph};

/// Consumer task id -> the upstream task ids whose declared outputs it reads.
///
/// Producers are searched over the consumer's whole dependency closure rather
/// than its direct dependencies. `TaskOutput` does not record whether its
/// `transitive` flag was set, and an observed read cannot say how deep the
/// producer sits, so the closure is the only scope that cannot miss an edge.
/// Over-reporting an edge costs a task that was going to be a cache hit;
/// missing one skips a task that needed to run.
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
    let reads = resolve_reads(hash_plans);
    if reads.is_empty() {
        return HashMap::new();
    }
    let index = TaskIndex::new(task_graph);

    hash_plans
        .plans
        .par_iter()
        .map_init(
            || Traversal::new(index.len()),
            |traversal, (consumer, plan)| {
                let plan_reads: Vec<&InstructionReads> =
                    plan.iter().filter_map(|id| reads.get(id)).collect();
                if plan_reads.is_empty() {
                    return None;
                }
                let from = index.position(consumer)?;
                let mut producers: Vec<String> = traversal
                    .upstream_of(&index, from)
                    .filter(|&producer| {
                        let outputs = &index.outputs[producer];
                        !outputs.is_empty() && plan_reads.iter().any(|read| read.matches(outputs))
                    })
                    .map(|producer| index.ids[producer].clone())
                    .collect();
                // The closure walk order is not meaningful; sort for a stable answer.
                producers.sort_unstable();
                (!producers.is_empty()).then(|| (consumer.clone(), producers))
            },
        )
        .flatten()
        .collect()
}

/// What one interned instruction reads that an upstream task could produce.
///
/// Resolved once per distinct instruction rather than once per task. A glob set
/// shared by a thousand tasks is interned to one id, so it is reduced here once.
enum InstructionReads {
    /// Literal prefixes of the positive globs in an `includeIgnored` fileset.
    Globs(Vec<String>),
    /// Literal prefixes of the positive outputs a `TaskOutput` carries. It was
    /// cloned from one producer's `outputs`, so it identifies that producer by
    /// equality rather than overlap.
    Declared(Vec<String>),
}

impl InstructionReads {
    fn matches(&self, output_prefixes: &[String]) -> bool {
        match self {
            Self::Declared(prefixes) => prefixes == output_prefixes,
            Self::Globs(globs) => globs
                .iter()
                .any(|glob| output_prefixes.iter().any(|out| paths_overlap(glob, out))),
        }
    }
}

fn resolve_reads(hash_plans: &HashPlans) -> HashMap<u32, InstructionReads> {
    let mut ids: Vec<u32> = hash_plans.plans.values().flatten().copied().collect();
    ids.par_sort_unstable();
    ids.dedup();

    ids.into_par_iter()
        .filter_map(|id| {
            let reads = match hash_plans.pool.get(id).value() {
                HashInstruction::Files(globs) => InstructionReads::Globs(positive_prefixes(globs)),
                HashInstruction::TaskOutput(_, outputs) => {
                    InstructionReads::Declared(positive_prefixes(outputs))
                }
                _ => return None,
            };
            Some((id, reads))
        })
        .collect()
}

fn positive_prefixes(patterns: &[String]) -> Vec<String> {
    patterns
        .iter()
        .filter(|pattern| !pattern.starts_with('!'))
        .map(|pattern| literal_prefix(pattern).to_string())
        .collect()
}

/// The task graph flattened to positions, so the closure walk moves over
/// integers instead of hashing and cloning task ids at every hop.
struct TaskIndex<'a> {
    ids: Vec<&'a String>,
    positions: HashMap<&'a str, usize>,
    dependencies: Vec<Vec<usize>>,
    /// Positive declared outputs, reduced to their literal prefix once per task
    /// rather than once per (consumer, producer) pair.
    outputs: Vec<Vec<String>>,
}

impl<'a> TaskIndex<'a> {
    fn new(task_graph: &'a TaskGraph) -> Self {
        let ids: Vec<&String> = task_graph.tasks.keys().collect();
        let positions: HashMap<&str, usize> = ids
            .iter()
            .enumerate()
            .map(|(i, id)| (id.as_str(), i))
            .collect();

        let dependencies = ids
            .iter()
            .map(|id| {
                task_graph
                    .dependencies
                    .get(*id)
                    .map(|deps| {
                        deps.iter()
                            .filter_map(|dep| positions.get(dep.as_str()).copied())
                            .collect()
                    })
                    .unwrap_or_default()
            })
            .collect();

        let outputs = ids
            .iter()
            .map(|id| positive_prefixes(&task_graph.tasks[*id].outputs))
            .collect();

        Self {
            ids,
            positions,
            dependencies,
            outputs,
        }
    }

    fn len(&self) -> usize {
        self.ids.len()
    }

    fn position(&self, id: &str) -> Option<usize> {
        self.positions.get(id).copied()
    }
}

/// Reusable depth-first walk. `seen` is stamped with the current run rather than
/// cleared, so one allocation serves every consumer on a rayon worker.
struct Traversal {
    seen: Vec<u32>,
    run: u32,
    stack: Vec<usize>,
    reached: Vec<usize>,
}

impl Traversal {
    fn new(len: usize) -> Self {
        Self {
            seen: vec![0; len],
            run: 0,
            stack: Vec::new(),
            reached: Vec::new(),
        }
    }

    /// Every task reachable from `from` through `dependencies`, excluding itself
    /// unless a cycle leads back. `continuous_dependencies` are not traversed: a
    /// watch or serve task does not produce the artifacts a hash reads, matching
    /// `collect_task_dependencies`.
    fn upstream_of(&mut self, index: &TaskIndex<'_>, from: usize) -> impl Iterator<Item = usize> {
        self.run += 1;
        self.stack.clear();
        self.reached.clear();
        self.stack.push(from);
        self.seen[from] = self.run;

        while let Some(current) = self.stack.pop() {
            for &dep in &index.dependencies[current] {
                if self.seen[dep] != self.run {
                    self.seen[dep] = self.run;
                    self.reached.push(dep);
                    self.stack.push(dep);
                }
            }
        }
        self.reached.iter().copied()
    }
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

    fn graph(tasks: Vec<(&str, &[&str])>, deps: Vec<(&str, Vec<&str>)>) -> TaskGraph {
        TaskGraph {
            roots: vec![],
            tasks: tasks
                .into_iter()
                .map(|(id, outputs)| {
                    let (project, target) = id.split_once(':').unwrap();
                    let mut task = Task::new(project, target)
                        .with_outputs(outputs.iter().map(|o| o.to_string()).collect())
                        .with_project_root("test");
                    task.id = id.to_string();
                    (id.to_string(), task)
                })
                .collect(),
            dependencies: deps
                .into_iter()
                .map(|(id, ds)| (id.to_string(), ds.into_iter().map(String::from).collect()))
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

    fn producers_of(p: &HashPlans, g: &TaskGraph, consumer: &str) -> Vec<String> {
        compute_dependent_output_edges(p, g)
            .remove(consumer)
            .unwrap_or_default()
    }

    /// app -> ui -> core, each producing into its own dist directory.
    fn chain() -> TaskGraph {
        graph(
            vec![
                ("app:build", &[]),
                ("ui:build", &["dist/libs/ui"]),
                ("core:build", &["dist/libs/core"]),
            ],
            vec![
                ("app:build", vec!["ui:build"]),
                ("ui:build", vec!["core:build"]),
            ],
        )
    }

    /// `paths_overlap` compares prefixes, which is what the caller passes.
    fn overlaps(a: &str, b: &str) -> bool {
        paths_overlap(literal_prefix(a), literal_prefix(b))
    }

    fn reading(globs: &[&str]) -> Vec<HashInstruction> {
        vec![HashInstruction::Files(strings(globs))]
    }

    // --- pattern helpers ------------------------------------------------------

    #[test]
    fn literal_prefix_stops_at_the_last_whole_segment() {
        assert_eq!(literal_prefix("dist/libs/ui/**/*.js"), "dist/libs/ui");
        assert_eq!(literal_prefix("dist/li*"), "dist");
        assert_eq!(literal_prefix("dist/libs/ui"), "dist/libs/ui");
        assert_eq!(literal_prefix("dist/libs/ui/"), "dist/libs/ui");
        assert_eq!(literal_prefix("!dist/libs/ui/**"), "dist/libs/ui");
        assert_eq!(literal_prefix("**/*.js"), "");
    }

    /// The `libs/a` vs `libs/a-legacy` trap: a plain prefix compare says these
    /// overlap.
    #[test]
    fn overlap_is_compared_segment_wise() {
        assert!(overlaps("dist/libs/ui/**/*.js", "dist/libs/ui"));
        assert!(overlaps("dist/libs/ui", "dist/libs/ui/**"));
        assert!(!overlaps("dist/libs/ui-legacy/**", "dist/libs/ui"));
        assert!(!overlaps("dist/apps/web/**", "dist/libs/ui"));
    }

    /// A pattern with no literal segment could match anywhere, so it has to
    /// overlap rather than be silently dropped. `createTaskGraph` resolves
    /// `{workspaceRoot}` and `{projectRoot}` before an output reaches here, so
    /// in practice only a genuine leading wildcard lands in this branch.
    #[test]
    fn a_leading_wildcard_overlaps_everything() {
        assert!(overlaps("**/*.js", "dist/libs/ui"));
        assert!(overlaps("{workspaceRoot}/dist", "anything/at/all"));
    }

    /// A brace group is a wildcard, but the `*` before it truncates first, so
    /// the prefix stays useful.
    #[test]
    fn a_brace_group_does_not_collapse_the_prefix() {
        assert_eq!(
            literal_prefix("packages/ui/dist/**/*.{d.ts,d.cts}"),
            "packages/ui/dist"
        );
        assert!(!overlaps(
            "packages/ui/dist/**/*.{d.ts}",
            "packages/other/dist"
        ));
    }

    // --- edge inference -------------------------------------------------------

    #[test]
    fn explicit_task_output_yields_an_edge() {
        let g = chain();
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::TaskOutput(
                "**/*.js".into(),
                strings(&["dist/libs/ui"]),
            )],
        )]);
        assert_eq!(producers_of(&p, &g, "app:build"), strings(&["ui:build"]));
    }

    /// The case I/O tracing produces: an observed read of a generated artifact
    /// becomes an includeIgnored fileset, and no `dependentTasksOutputFiles`
    /// input is declared at all.
    #[test]
    fn an_include_ignored_fileset_overlapping_outputs_yields_an_edge() {
        let g = chain();
        let p = plans(vec![("app:build", reading(&["dist/libs/ui/**/*.js"]))]);
        assert_eq!(producers_of(&p, &g, "app:build"), strings(&["ui:build"]));
    }

    #[test]
    fn a_fileset_that_does_not_overlap_yields_no_edge() {
        let g = chain();
        let p = plans(vec![("app:build", reading(&["generated/openapi/**/*.ts"]))]);
        assert!(producers_of(&p, &g, "app:build").is_empty());
    }

    #[test]
    fn a_negated_consumer_glob_does_not_establish_an_edge() {
        let g = chain();
        let p = plans(vec![("app:build", reading(&["!dist/libs/ui/**/*.map"]))]);
        assert!(producers_of(&p, &g, "app:build").is_empty());
    }

    #[test]
    fn a_negated_producer_output_does_not_establish_an_edge() {
        let g = graph(
            vec![("app:build", &[]), ("ui:build", &["!dist/libs/ui"])],
            vec![("app:build", vec!["ui:build"])],
        );
        let p = plans(vec![("app:build", reading(&["dist/libs/ui/**/*.js"]))]);
        assert!(producers_of(&p, &g, "app:build").is_empty());
    }

    #[test]
    fn a_direct_producer_is_reached() {
        let g = chain();
        let p = plans(vec![("app:build", reading(&["dist/libs/ui/**/*.js"]))]);
        assert_eq!(producers_of(&p, &g, "app:build"), strings(&["ui:build"]));
    }

    #[test]
    fn a_transitive_producer_is_reached() {
        let g = chain();
        // app reads core's output directly, two hops down.
        let p = plans(vec![("app:build", reading(&["dist/libs/core/**/*.js"]))]);
        assert_eq!(producers_of(&p, &g, "app:build"), strings(&["core:build"]));
    }

    #[test]
    fn reading_the_whole_dist_tree_reaches_every_producer_in_the_closure() {
        let g = chain();
        let p = plans(vec![("app:build", reading(&["dist/**/*.js"]))]);
        assert_eq!(
            producers_of(&p, &g, "app:build"),
            strings(&["core:build", "ui:build"])
        );
    }

    #[test]
    fn a_task_outside_the_dependency_closure_is_not_a_producer() {
        let g = graph(
            vec![("app:build", &[]), ("unrelated:build", &["dist/libs/ui"])],
            vec![("app:build", vec![])],
        );
        let p = plans(vec![("app:build", reading(&["dist/libs/ui/**/*.js"]))]);
        assert!(producers_of(&p, &g, "app:build").is_empty());
    }

    #[test]
    fn a_producer_with_no_declared_outputs_is_skipped() {
        let g = graph(
            vec![("app:build", &[]), ("ui:build", &[])],
            vec![("app:build", vec!["ui:build"])],
        );
        let p = plans(vec![("app:build", reading(&["dist/libs/ui/**/*.js"]))]);
        assert!(producers_of(&p, &g, "app:build").is_empty());
    }

    #[test]
    fn a_cycle_terminates() {
        let g = graph(
            vec![("a:build", &["dist/a"]), ("b:build", &["dist/b"])],
            vec![("a:build", vec!["b:build"]), ("b:build", vec!["a:build"])],
        );
        let p = plans(vec![("a:build", reading(&["dist/**"]))]);
        // The walk terminates, and a task is never its own producer even when a
        // cycle leads back to it.
        assert_eq!(producers_of(&p, &g, "a:build"), strings(&["b:build"]));
    }

    #[test]
    fn a_plan_with_no_output_reading_instruction_yields_nothing() {
        let g = chain();
        let p = plans(vec![(
            "app:build",
            vec![HashInstruction::ProjectFileSet(
                "app".into(),
                strings(&["apps/app/**/*"]),
            )],
        )]);
        assert!(compute_dependent_output_edges(&p, &g).is_empty());
    }
}
