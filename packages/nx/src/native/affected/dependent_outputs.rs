//! Which upstream tasks' declared outputs a task reads, so a change propagates
//! producer -> consumer. Outputs are gitignored and may not exist yet, so this
//! compares declared configuration, never the filesystem. A `TaskOutput` embeds
//! its producer's `outputs` verbatim and is matched by equality. An
//! `IgnoredFileSet` (snapshot plans carry observed reads instead of any
//! `TaskOutput`) names no producer and is matched by pattern overlap.

use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;
use tracing::{debug, trace};

use crate::native::affected::dependency_closure::walk_dependencies;
use crate::native::affected::plan_ids::referenced_ids;
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::tasks::types::{HashInstruction, HashPlans, TaskGraph};

/// Consumer task id -> the upstream task ids whose declared outputs it reads.
/// Searched over the whole dependency closure: `TaskOutput` does not keep its
/// `transitive` flag, and an observed read cannot say how deep its producer sits.
pub(crate) fn compute_dependent_output_edges(
    hash_plans: &HashPlans,
    task_graph: &TaskGraph,
) -> HashMap<String, Vec<String>> {
    let start = Instant::now();
    let Some(reads) = OutputReads::resolve(hash_plans) else {
        trace!("no plan reads another task's outputs");
        return HashMap::new();
    };
    let patterns_of = output_patterns(task_graph);
    let setup_duration = start.elapsed();
    trace!(
        "{} output reads and {} producers' outputs decoded in {:?}",
        reads.declared.len() + reads.globs.len(),
        patterns_of.len(),
        setup_duration
    );

    let edges: HashMap<String, Vec<String>> = hash_plans
        .plans
        .par_iter()
        .map_init(HashSet::new, |seen, (consumer, plan)| {
            let producers =
                producers_read_by(consumer, plan, &reads, &patterns_of, task_graph, seen);
            (!producers.is_empty()).then(|| (consumer.clone(), producers))
        })
        .flatten()
        .collect();
    debug!(
        "output reads resolved in {:?} - {} plans, {} consumers, {} edges (setup: {:?})",
        start.elapsed(),
        hash_plans.plans.len(),
        edges.len(),
        edges.values().map(Vec::len).sum::<usize>(),
        setup_duration
    );
    edges
}

/// Each task with declared outputs -> those outputs, parsed for comparison.
fn output_patterns(task_graph: &TaskGraph) -> HashMap<&str, Vec<OutputPattern<'_>>> {
    task_graph
        .tasks
        .iter()
        .filter(|(_, task)| !task.outputs.is_empty())
        .map(|(id, task)| {
            (
                id.as_str(),
                task.outputs.iter().map(|o| OutputPattern::new(o)).collect(),
            )
        })
        .collect()
}

/// Read instructions decoded once per interned id. Cloned because the pool's
/// `Ref` guard cannot outlive the lookup.
struct OutputReads {
    declared: HashMap<u32, Vec<String>>,
    globs: HashMap<u32, Vec<ReadPattern>>,
}

impl OutputReads {
    /// None when no plan reads another task's output.
    fn resolve(hash_plans: &HashPlans) -> Option<Self> {
        let mut declared = HashMap::new();
        let mut globs = HashMap::new();
        for id in referenced_ids(hash_plans) {
            match hash_plans.pool.get(id).value() {
                HashInstruction::TaskOutput(_, outputs) => {
                    declared.insert(id, outputs.clone());
                }
                HashInstruction::IgnoredFileSet(patterns) => {
                    // Negated patterns are exclusions, not things read.
                    let reads = patterns
                        .iter()
                        .filter(|pattern| !pattern.starts_with('!'))
                        .map(|pattern| ReadPattern::new(pattern))
                        .collect();
                    globs.insert(id, reads);
                }
                _ => {}
            }
        }
        (!declared.is_empty() || !globs.is_empty()).then_some(Self { declared, globs })
    }
}

/// The producers whose outputs one consumer's plan reads, sorted.
fn producers_read_by<'a>(
    consumer: &str,
    plan: &[u32],
    reads: &OutputReads,
    patterns_of: &HashMap<&'a str, Vec<OutputPattern<'a>>>,
    task_graph: &'a TaskGraph,
    seen: &mut HashSet<&'a str>,
) -> Vec<String> {
    let mut declared: HashSet<&[String]> = HashSet::new();
    let mut globs: Vec<&ReadPattern> = Vec::new();
    for id in plan {
        if let Some(outputs) = reads.declared.get(id) {
            declared.insert(outputs.as_slice());
        }
        if let Some(patterns) = reads.globs.get(id) {
            globs.extend(patterns);
        }
    }
    if declared.is_empty() && globs.is_empty() {
        return Vec::new();
    }

    // Two unrelated tasks can declare the same outputs; only the consumer's own
    // closure picks the one it depends on.
    let mut producers: Vec<&str> = Vec::new();
    seen.clear();
    walk_dependencies(task_graph, vec![consumer], seen, |upstream| {
        let Some(patterns) = patterns_of.get(upstream) else {
            return;
        };
        let reads_declared = task_graph
            .tasks
            .get(upstream)
            .is_some_and(|task| declared.contains(task.outputs.as_slice()));
        if reads_declared
            || globs
                .iter()
                .any(|read| patterns.iter().any(|output| read.claims(output)))
        {
            producers.push(upstream);
        }
    });

    // The walk order is not meaningful; sort for a stable answer.
    producers.sort_unstable();
    producers.into_iter().map(str::to_string).collect()
}

/// A producer's declared output with its `literal_prefix`.
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

/// A read classified by how it compares to a producer's outputs. Both sides are
/// patterns, so this is overlap, and it errs towards claiming: an extra edge
/// costs a cache hit, a missing one skips a task that needed to run.
enum ReadPattern {
    /// Has a literal leading path, `dist/libs/ui/**/*.js` or `package.json`.
    /// Claims an output when either literal prefix contains the other.
    Under(String),
    /// Leads with a wildcard and spans directories, `**/*.js` or
    /// `{dist,out}/lib/**`, so it can reach into any output directory. Ruled
    /// out only when both name a literal extension and the two differ.
    Anywhere(String),
    /// A single wildcard segment, `*.json`, matching only root-level paths: it
    /// claims an output only when the glob matches the output's literal prefix.
    /// Precompiled because `claims` runs per output per consumer; a glob that
    /// fails to compile claims everything.
    RootLevel(String, Option<Arc<NxGlobSet>>),
}

impl ReadPattern {
    fn new(pattern: &str) -> Self {
        let prefix = literal_prefix(pattern);
        if !prefix.is_empty() {
            Self::Under(prefix.to_string())
        } else if pattern.contains('/') || pattern.starts_with("**") {
            Self::Anywhere(pattern.to_string())
        } else {
            Self::RootLevel(
                pattern.to_string(),
                build_glob_set(std::slice::from_ref(&pattern)).ok(),
            )
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
            Self::RootLevel(pattern, _) if output.prefix.is_empty() => {
                !distinct_extensions(pattern, output.raw)
            }
            Self::RootLevel(_, glob) => glob
                .as_ref()
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
/// `dist/**/*.js`. None when there is no extension, the extension has a
/// wildcard, or the segment has a brace or group.
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

/// The leading path segments of a glob that contain no wildcard:
/// `dist/libs/ui/**/*.js` -> `dist/libs/ui`, `**/*.js` -> `""`. A pattern with
/// no wildcard is returned whole.
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
            .get_plans_internal(vec!["app:build", "ui:build"], graph_of_tasks(), None, &[])
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
