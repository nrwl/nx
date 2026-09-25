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
//! An `IgnoredFileSet(globs)` comes from an `includeIgnored` fileset. I/O
//! tracing turns an observed read of a generated artifact into one of these,
//! which can preclude the explicit input entirely, so a plan can read a
//! dependency's output with no `TaskOutput` anywhere in it. It carries no
//! project and names no producer, so each pattern is compared to declared
//! outputs, over the consumer's dependency closure: by
//! directory containment when the read names one, and by what the glob can
//! match when it leads with a wildcard. That walk runs only for tasks carrying
//! a read.

use rayon::prelude::*;
use std::collections::{HashMap, HashSet};

use crate::native::affected::plan_ids::referenced_ids;
use crate::native::glob::build_glob_set;
use crate::native::tasks::types::{HashInstruction, HashPlans, TaskGraph};

/// Consumer task id -> the upstream task ids whose declared outputs it reads.
///
/// Producers are searched over the whole dependency closure, not just direct
/// dependencies: `TaskOutput` does not record whether its `transitive` flag was
/// set, and an observed read cannot say how deep the producer sits. Over-
/// reporting an edge costs a task that was going to be a cache hit; missing one
/// skips a task that needed to run.
pub(crate) fn compute_dependent_output_edges(
    hash_plans: &HashPlans,
    task_graph: &TaskGraph,
) -> HashMap<String, Vec<String>> {
    // Indexed both ways, because the two read kinds ask different questions:
    // TaskOutput matches an output vector whole, an includeIgnored glob is
    // tested against each output pattern.
    let mut producers_by_outputs: HashMap<&[String], Vec<&str>> = HashMap::new();
    let mut outputs_of: HashMap<&str, Vec<OutputPattern<'_>>> = HashMap::new();
    for (id, task) in &task_graph.tasks {
        if task.outputs.is_empty() {
            continue;
        }
        producers_by_outputs
            .entry(task.outputs.as_slice())
            .or_default()
            .push(id.as_str());
        outputs_of.insert(
            id.as_str(),
            task.outputs.iter().map(|o| OutputPattern::new(o)).collect(),
        );
    }

    // Resolved once per distinct instruction rather than once per task: one
    // instruction shared by a thousand plans is interned to a single id. Cloned
    // rather than borrowed, since the pool hands out a guard that cannot outlive
    // the lookup; the count is bounded by unique inputs, not by task count.
    let mut declared_reads: HashMap<u32, Vec<String>> = HashMap::new();
    let mut glob_reads: HashMap<u32, Vec<ReadPattern>> = HashMap::new();
    for id in referenced_ids(hash_plans) {
        match hash_plans.pool.get(id).value() {
            HashInstruction::TaskOutput(_, outputs) => {
                declared_reads.insert(id, outputs.clone());
            }
            HashInstruction::IgnoredFileSet(globs) => {
                // Negated patterns are exclusions, not things read.
                let reads = globs
                    .iter()
                    .filter(|glob| !glob.starts_with('!'))
                    .map(|glob| ReadPattern::new(glob))
                    .collect();
                glob_reads.insert(id, reads);
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
            let declared: Vec<&Vec<String>> = plan
                .iter()
                .filter_map(|id| declared_reads.get(id))
                .collect();
            let mut producers: Vec<&str> = Vec::new();
            if !declared.is_empty() {
                // Equality names the producer, but two unrelated tasks can
                // declare the same outputs, so only one the consumer depends on
                // counts.
                let upstream: HashSet<&str> =
                    closure_of(task_graph, consumer, seen).into_iter().collect();
                producers.extend(
                    declared
                        .iter()
                        .filter_map(|outputs| producers_by_outputs.get(outputs.as_slice()))
                        .flatten()
                        .copied()
                        .filter(|producer| upstream.contains(producer)),
                );
            }

            // Only an includeIgnored read needs the closure, so a plan without
            // one never pays for the walk.
            let reads: Vec<&ReadPattern> = plan
                .iter()
                .filter_map(|id| glob_reads.get(id))
                .flatten()
                .collect();
            if !reads.is_empty() {
                for upstream in closure_of(task_graph, consumer, seen) {
                    if let Some(outputs) = outputs_of.get(upstream) {
                        let claims = reads
                            .iter()
                            .any(|read| outputs.iter().any(|out| read.claims(out)));
                        if claims {
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

/// Every task reachable from `from` over regular and continuous edges,
/// excluding itself unless a cycle leads back. The planner splices a served
/// task's reads into its consumer's plan (`collect_continuous_dependencies`),
/// so either kind of read can name a producer behind a continuous edge.
/// `seen` is caller-owned so one allocation serves every consumer on a worker.
fn closure_of<'a>(
    task_graph: &'a TaskGraph,
    from: &str,
    seen: &mut HashSet<&'a str>,
) -> Vec<&'a str> {
    seen.clear();
    reach(task_graph, vec![from], seen)
}

/// `from` and every task reachable from it, sorted. Ids the graph does not
/// contain are dropped.
pub(crate) fn with_dependencies<'a>(
    task_graph: &TaskGraph,
    from: impl IntoIterator<Item = &'a str>,
) -> Vec<String> {
    let mut seen = HashSet::new();
    let starts: Vec<&str> = from
        .into_iter()
        .filter_map(|id| task_graph.tasks.get_key_value(id))
        .map(|(id, _)| id.as_str())
        .filter(|id| seen.insert(*id))
        .collect();
    let mut all = starts.clone();
    all.extend(reach(task_graph, starts, &mut seen));
    all.sort_unstable();
    all.into_iter().map(str::to_string).collect()
}

fn reach<'a: 'b, 'b>(
    task_graph: &'a TaskGraph,
    mut stack: Vec<&'b str>,
    seen: &mut HashSet<&'a str>,
) -> Vec<&'a str> {
    let mut reached = Vec::new();
    while let Some(current) = stack.pop() {
        let edges = [
            task_graph.dependencies.get(current),
            task_graph.continuous_dependencies.get(current),
        ];
        for dep in edges.into_iter().flatten().flatten() {
            if seen.insert(dep.as_str()) {
                reached.push(dep.as_str());
                stack.push(dep.as_str());
            }
        }
    }
    reached
}

/// A producer's declared output, with the literal directory it is under.
struct OutputPattern<'a> {
    raw: &'a str,
    prefix: &'a str,
}

impl<'a> OutputPattern<'a> {
    fn new(raw: &'a str) -> Self {
        Self {
            raw,
            prefix: literal_prefix(raw),
        }
    }
}

/// An observed or declared read, classified by how it can be compared to a
/// producer's outputs. Neither side is a concrete path, so this is containment
/// between patterns, and it errs towards claiming: an edge too many costs a
/// cache hit, one too few skips a task that needed to run.
enum ReadPattern {
    /// Leads with a literal directory, `dist/libs/ui/**/*.js`. Compared to an
    /// output by directory containment on their literal prefixes.
    Under(String),
    /// Leads with a wildcard and spans directories, `**/*.js` or
    /// `{dist,out}/lib/**`, so it can reach into any output directory. Ruled
    /// out only when both name a literal extension and the two differ.
    Anywhere(String),
    /// A single segment with a wildcard, `*.json`. Names only root-level paths,
    /// so it claims a literal output only when the glob itself matches it.
    RootLevel(String),
}

impl ReadPattern {
    fn new(pattern: &str) -> Self {
        let prefix = literal_prefix(pattern);
        if !prefix.is_empty() {
            Self::Under(prefix.to_string())
        } else if pattern.contains('/') || pattern.starts_with("**") {
            Self::Anywhere(pattern.to_string())
        } else {
            Self::RootLevel(pattern.to_string())
        }
    }

    fn claims(&self, output: &OutputPattern<'_>) -> bool {
        match self {
            // An output whose own prefix is empty leads with a wildcard and
            // could be anywhere, so it is claimed.
            Self::Under(prefix) => {
                output.prefix.is_empty()
                    || is_path_prefix(prefix, output.prefix)
                    || is_path_prefix(output.prefix, prefix)
            }
            Self::Anywhere(pattern) => !distinct_extensions(pattern, output.raw),
            Self::RootLevel(pattern) if output.prefix.is_empty() => {
                !distinct_extensions(pattern, output.raw)
            }
            Self::RootLevel(pattern) => build_glob_set(std::slice::from_ref(pattern))
                .map_or(true, |glob| glob.is_match(output.prefix)),
        }
    }
}

/// Whether a read and an output each end in a literal extension and the two
/// differ, in which case no path can match both. An output's extension counts
/// only after a wildcard: a literal output may be a directory, `dist/lib.v2`.
fn distinct_extensions(read: &str, output: &str) -> bool {
    let output_segment = output.rsplit('/').next().unwrap_or(output);
    let output_extension = output_segment
        .contains(['*', '?'])
        .then(|| literal_extension(output))
        .flatten();
    matches!(
        (literal_extension(read), output_extension),
        (Some(x), Some(y)) if x != y
    )
}

/// The literal extension a pattern's last segment ends in: `js` for
/// `dist/**/*.js`. None when the segment has no extension or the extension
/// itself carries a wildcard.
fn literal_extension(pattern: &str) -> Option<&str> {
    let segment = pattern.rsplit('/').next().unwrap_or(pattern);
    if segment.contains(['{', '(']) {
        return None;
    }
    let ext = segment.rsplit_once('.')?.1;
    (!ext.is_empty() && !ext.contains(['*', '?', '['])).then_some(ext)
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
/// segment is already a wildcard reduces to `""`; how it then compares to an
/// output is `ReadPattern`'s decision.
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
            deferred: Default::default(),
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

    /// A disk-backed fileset: workspace-relative globs with no project.
    fn include_ignored(globs: &[&str]) -> HashInstruction {
        HashInstruction::IgnoredFileSet(strings(globs))
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
                vec![include_ignored(&["dist/libs/ui/**/*.js"])],
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
            &[("app:build", vec![include_ignored(&["vendor/**/*.js"])])],
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
            &[("app:build", vec![include_ignored(&["dist/**/*.js"])])],
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
                vec![include_ignored(&["dist/libs/ui/**/*.js"])],
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
                vec![include_ignored(&["dist/libs/ui/**/*.js"])],
            )],
        );
        assert!(e.is_empty());
    }

    /// Instructions are interned per pool, so two producers with the same
    /// outputs vector share the TaskOutput that embeds it. Only the one the
    /// consumer depends on is its producer.
    #[test]
    fn a_task_output_names_only_the_producer_the_consumer_depends_on() {
        let e = edges(
            &[
                ("ui:build", &["dist/shared"]),
                ("other:build", &["dist/shared"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build"])],
            &[("app:build", vec![task_output(&["dist/shared"])])],
        );
        assert_eq!(e["app:build"], strings(&["ui:build"]));
    }

    /// A served task's outputs are read across a continuous dependency, by a
    /// disk-backed read and by a declared TaskOutput alike.
    #[test]
    fn a_read_reaches_across_a_continuous_dependency() {
        let mut tg = task_graph(&[("web:serve", &["dist/apps/web"]), ("e2e:e2e", &[])], &[]);
        tg.continuous_dependencies
            .insert("e2e:e2e".into(), strings(&["web:serve"]));
        let p = plans(&[
            ("e2e:e2e", vec![include_ignored(&["dist/apps/web/**"])]),
            ("e2e:declared", vec![task_output(&["dist/apps/web"])]),
        ]);
        tg.tasks.insert(
            "e2e:declared".into(),
            Task {
                id: "e2e:declared".into(),
                ..Default::default()
            },
        );
        tg.continuous_dependencies
            .insert("e2e:declared".into(), strings(&["web:serve"]));
        let e = compute_dependent_output_edges(&p, &tg);
        assert_eq!(e["e2e:e2e"], strings(&["web:serve"]));
        assert_eq!(e["e2e:declared"], strings(&["web:serve"]));
    }

    /// e2e serves web, and web builds from ui. The planner splices ui's
    /// TaskOutput into e2e's plan through web, so the edge follows the same two
    /// hops: one continuous, one regular.
    #[test]
    fn a_task_output_reaches_a_producer_behind_a_continuous_dependency() {
        let mut tg = task_graph(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("web:serve", &["dist/apps/web"]),
                ("e2e:e2e", &[]),
            ],
            &[("web:serve", &["ui:build"])],
        );
        tg.continuous_dependencies
            .insert("e2e:e2e".into(), strings(&["web:serve"]));
        let p = plans(&[("e2e:e2e", vec![task_output(&["dist/libs/ui"])])]);
        let e = compute_dependent_output_edges(&p, &tg);
        assert_eq!(e["e2e:e2e"], strings(&["ui:build"]));
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
                vec![include_ignored(&["dist/libs/core/**/*.js"])],
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
                vec![include_ignored(&["!dist/libs/ui/**/*.js"])],
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
            &[("a:build", vec![include_ignored(&["dist/**/*.js"])])],
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

    /// The producer lookup rests on a TaskOutput embedding the producer's own
    /// `outputs`, untransformed. Planned through the planner rather than built
    /// by hand, so a transform added on the way into the instruction fails here
    /// instead of silently unlinking every producer.
    #[test]
    fn a_planned_task_output_still_names_its_producer() {
        use crate::native::project_graph::types::{Project, ProjectGraph, Target};
        use crate::native::tasks::hash_planner::HashPlanner;
        use crate::native::types::{DepsOutputsInput, NxJson};
        use napi::bindgen_prelude::{Either9, External};

        let target = |reads_outputs: bool| Target {
            executor: None,
            inputs: reads_outputs.then(|| {
                vec![Either9::G(DepsOutputsInput {
                    dependent_tasks_output_files: "**/*.js".into(),
                    transitive: Some(false),
                })]
            }),
            outputs: None,
            options: None,
            configurations: None,
            parallelism: None,
        };
        let project = |root: &str, reads_outputs: bool| Project {
            root: root.into(),
            named_inputs: None,
            tags: None,
            targets: HashMap::from([("build".to_string(), target(reads_outputs))]),
        };
        let graph = ProjectGraph {
            nodes: HashMap::from([
                ("app".to_string(), project("apps/app", true)),
                ("ui".to_string(), project("libs/ui", false)),
            ]),
            dependencies: HashMap::from([
                ("app".to_string(), vec!["ui".to_string()]),
                ("ui".to_string(), vec![]),
            ]),
            external_nodes: HashMap::new(),
        };
        let graph_of_tasks = || {
            let app = Task::new("app", "build").with_outputs(strings(&["dist/apps/app"]));
            let ui = Task::new("ui", "build").with_outputs(strings(&["dist/libs/ui"]));
            TaskGraph {
                roots: vec![app.id.clone()],
                dependencies: HashMap::from([
                    (app.id.clone(), vec![ui.id.clone()]),
                    (ui.id.clone(), vec![]),
                ]),
                continuous_dependencies: HashMap::new(),
                tasks: HashMap::from([(app.id.clone(), app), (ui.id.clone(), ui)]),
            }
        };
        let planner = HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(graph)),
        );
        let plans = planner
            .get_plans_internal(vec!["app:build", "ui:build"], graph_of_tasks())
            .unwrap();
        let e = compute_dependent_output_edges(&plans, &graph_of_tasks());
        assert_eq!(e["app:build"], strings(&["ui:build"]));
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

    /// A read leading with `**` can reach into any output directory, so it
    /// still claims a directory output. It stops claiming an output whose
    /// literal extension it can never match.
    #[test]
    fn a_recursive_root_glob_claims_directories_but_not_a_different_extension() {
        let e = edges(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("js:build", &["dist/**/*.js"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build", "js:build"])],
            &[("app:build", vec![include_ignored(&["**/*.gen"])])],
        );
        assert_eq!(e["app:build"], strings(&["ui:build"]));
    }

    /// A single-level root glob names only root-level paths, so it claims an
    /// output only when the glob itself matches it.
    #[test]
    fn a_single_level_root_glob_claims_only_what_it_matches() {
        let e = edges(
            &[
                ("manifest:build", &["package.json"]),
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["manifest:build", "ui:build"])],
            &[("app:build", vec![include_ignored(&["*.json"])])],
        );
        assert_eq!(e["app:build"], strings(&["manifest:build"]));
    }

    /// A read that leads with a wildcard or a brace but spans directories is
    /// not root-level: it can reach inside an output directory.
    #[test]
    fn a_read_leading_with_a_wildcard_segment_reaches_into_directories() {
        for read in ["{dist,out}/lib/**/*.js", "*/lib/**/*.js"] {
            let e = edges(
                &[("lib:build", &["dist/lib"]), ("app:build", &["dist/app"])],
                &[("app:build", &["lib:build"])],
                &[("app:build", vec![include_ignored(&[read])])],
            );
            assert_eq!(e["app:build"], strings(&["lib:build"]), "{read}");
        }
    }

    /// Brace alternatives are not one extension, and a literal output may be a
    /// directory whose name has a dot, so neither rules a producer out.
    #[test]
    fn an_extension_is_only_compared_when_both_sides_fix_one() {
        for (read, output) in [
            ("**/*.{js,d.ts}", "dist/lib/index.js"),
            ("**/*.js", "dist/lib.v2"),
        ] {
            let e = edges(
                &[("lib:build", &[output]), ("app:build", &["dist/app"])],
                &[("app:build", &["lib:build"])],
                &[("app:build", vec![include_ignored(&[read])])],
            );
            assert_eq!(
                e["app:build"],
                strings(&["lib:build"]),
                "{read} vs {output}"
            );
        }
    }

    #[test]
    fn literal_extension_reads_only_a_fixed_suffix() {
        assert_eq!(literal_extension("dist/**/*.js"), Some("js"));
        assert_eq!(literal_extension("**/*.gen"), Some("gen"));
        assert_eq!(literal_extension("dist/out.d.ts"), Some("ts"));
        assert_eq!(literal_extension("dist/libs/ui"), None);
        assert_eq!(literal_extension("dist/**"), None);
        assert_eq!(literal_extension("dist/*.{js,ts}"), None);
        assert_eq!(literal_extension("**/*.{js,d.ts}"), None);
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
