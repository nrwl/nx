//! Which upstream tasks' declared outputs a task reads, so a change propagates
//! producer -> consumer. Outputs are gitignored and may not exist yet, so this
//! compares declared configuration, never the filesystem. A `TaskOutput` embeds
//! its producer's `outputs` verbatim and is matched by equality. An
//! `IgnoredFileSet` (snapshot plans carry observed reads instead of any
//! `TaskOutput`) names no producer and is matched by pattern overlap.

use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::time::Instant;
use tracing::{debug, trace};

use super::dependency_closure::walk_dependencies;
use super::plan_ids::referenced_ids;
use crate::native::glob::{normalize_glob, parse_glob, partition_glob};
use crate::native::tasks::types::{HashInstruction, HashPlans, TaskGraph};

/// Consumer task id -> the upstream task ids whose declared outputs it reads.
/// Searched over the whole dependency closure: `TaskOutput` does not keep its
/// `transitive` flag, and an observed read cannot say how deep its producer sits.
pub(crate) fn compute_dependent_output_edges(
    hash_plans: &HashPlans,
    task_graph: &TaskGraph,
) -> HashMap<String, Vec<String>> {
    let start = Instant::now();
    let Some(reads) = OutputReads::from_plans(hash_plans) else {
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

    let edges = producers_by_consumer(hash_plans, &reads, &patterns_of, task_graph);
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

/// Every consumer that reads another task's outputs -> those producers.
fn producers_by_consumer(
    hash_plans: &HashPlans,
    reads: &OutputReads,
    patterns_of: &HashMap<&str, Vec<GlobShape>>,
    task_graph: &TaskGraph,
) -> HashMap<String, Vec<String>> {
    hash_plans
        .plans
        .par_iter()
        .map_init(HashSet::new, |seen, (consumer, plan)| {
            let producers = producers_read_by(consumer, plan, reads, patterns_of, task_graph, seen);
            (!producers.is_empty()).then(|| (consumer.clone(), producers))
        })
        .flatten()
        .collect()
}

/// Each task with declared outputs -> those outputs, parsed for comparison.
fn output_patterns(task_graph: &TaskGraph) -> HashMap<&str, Vec<GlobShape>> {
    task_graph
        .tasks
        .iter()
        .filter(|(_, task)| !task.outputs.is_empty())
        .map(|(id, task)| {
            (
                id.as_str(),
                task.outputs.iter().map(|o| GlobShape::new(o)).collect(),
            )
        })
        .collect()
}

/// Read instructions decoded once per interned id. Cloned because the pool's
/// `Ref` guard cannot outlive the lookup.
struct OutputReads {
    declared: HashMap<u32, Vec<String>>,
    globs: HashMap<u32, Vec<GlobShape>>,
}

impl OutputReads {
    /// None when no plan reads another task's output.
    fn from_plans(hash_plans: &HashPlans) -> Option<Self> {
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
                        .map(|pattern| GlobShape::new(pattern))
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
    patterns_of: &HashMap<&'a str, Vec<GlobShape>>,
    task_graph: &'a TaskGraph,
    seen: &mut HashSet<&'a str>,
) -> Vec<String> {
    let mut declared: HashSet<&[String]> = HashSet::new();
    let mut globs: Vec<&GlobShape> = Vec::new();
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
        let Some(task) = task_graph.tasks.get(upstream) else {
            return;
        };
        if task.outputs.is_empty() {
            return;
        }
        let outputs = patterns_of.get(upstream).map_or(&[][..], Vec::as_slice);
        if declared.contains(task.outputs.as_slice())
            || globs
                .iter()
                .any(|read| outputs.iter().any(|output| read.may_read(output)))
        {
            producers.push(upstream);
        }
    });

    // The walk order is not meaningful; sort for a stable answer.
    producers.sort_unstable();
    producers.into_iter().map(str::to_string).collect()
}

/// A glob reduced to what an overlap check compares, for reads and outputs
/// alike. Both may name a directory, so an extension counts only after a
/// wildcard: `dist/lib.v2` may be a folder.
struct GlobShape {
    prefix: String,
    extension: Option<String>,
}

impl GlobShape {
    fn new(glob: &str) -> Self {
        let glob = normalize_glob(glob);
        Self {
            prefix: partition_glob(&glob).0,
            extension: extension_after_wildcard(&glob),
        }
    }

    /// Whether some path could match both. Errs towards yes: an extra edge
    /// costs a cache hit, a missing one skips a task that needed to run.
    fn may_read(&self, output: &GlobShape) -> bool {
        // An empty prefix leads with a wildcard and could start anywhere.
        let folders_meet = self.prefix.is_empty()
            || output.prefix.is_empty()
            || is_path_prefix(&self.prefix, &output.prefix)
            || is_path_prefix(&output.prefix, &self.prefix);
        folders_meet && self.may_share_extension(output)
    }

    /// Only two different extensions rule a match out; an unknown one could be anything.
    fn may_share_extension(&self, other: &GlobShape) -> bool {
        match (&self.extension, &other.extension) {
            (Some(mine), Some(theirs)) => mine == theirs,
            _ => true,
        }
    }
}

/// The extension every match of `glob` ends in: `js` for `dist/**/*.js`. None
/// unless the last segment has a wildcard and ends in literal `.ext`: a literal
/// segment may be a folder, `dist/lib.v2`, and `*.{js,ts}` has no single one.
fn extension_after_wildcard(glob: &str) -> Option<String> {
    let (_, segments) = parse_glob(glob).ok()?;
    let last = segments.last()?;
    if last.iter().all(|group| group.literal_text().is_some()) {
        return None;
    }
    let (_, extension) = last.last()?.literal_text()?.rsplit_once('.')?;
    (!extension.is_empty()).then(|| extension.to_string())
}

/// Segment-wise, so `dist/libs/ui` does not contain `dist/libs/ui-legacy` the
/// way a plain `starts_with` would.
pub(super) fn is_path_prefix(prefix: &str, path: &str) -> bool {
    path == prefix
        || path
            .strip_prefix(prefix)
            .is_some_and(|rest| rest.starts_with('/'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::Task;
    use crate::native::test_utils::{hash_plans, strings, task_graph};
    use std::sync::Arc;

    fn edges(
        tasks: &[(&str, &[&str])],
        deps: &[(&str, &[&str])],
        entries: &[(&str, Vec<HashInstruction>)],
    ) -> HashMap<String, Vec<String>> {
        compute_dependent_output_edges(&hash_plans(entries), &task_graph(tasks, deps))
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
    fn repeated_slashes_in_a_read_or_an_output_still_overlap() {
        let e = edges(
            &[
                ("gen:build", &["dist/gen"]),
                ("gen2:build", &["out//types/"]),
            ],
            &[("app:build", &["gen:build", "gen2:build"])],
            &[(
                "app:build",
                vec![include_ignored(&["dist//gen/**", "out/types/**"])],
            )],
        );
        assert_eq!(e["app:build"], strings(&["gen2:build", "gen:build"]));
    }

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
    fn a_prefix_does_not_read_a_sibling_directory() {
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
        let p = hash_plans(&[
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
        let p = hash_plans(&[("e2e:e2e", vec![task_output(&["dist/libs/ui"])])]);
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
    fn a_recursive_root_glob_may_read_directories_but_not_a_different_extension() {
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

    /// A read with no literal folder compares only extensions, so `*.json`
    /// reaches a directory output even though `*` stops at the root. The extra
    /// edge costs a cache hit.
    #[test]
    fn a_root_glob_may_read_any_directory_output() {
        let e = edges(
            &[
                ("manifest:build", &["package.json"]),
                ("ui:build", &["dist/libs/ui"]),
                ("types:build", &["dist/**/*.d.ts"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["manifest:build", "ui:build", "types:build"])],
            &[("app:build", vec![include_ignored(&["*.json"])])],
        );
        assert_eq!(e["app:build"], strings(&["manifest:build", "ui:build"]));
    }

    #[test]
    fn nested_folders_with_different_extensions_do_not_meet() {
        let e = edges(
            &[
                ("css:build", &["dist/lib/**/*.css"]),
                ("js:build", &["dist/lib/**/*.js"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["css:build", "js:build"])],
            &[("app:build", vec![include_ignored(&["dist/**/*.js"])])],
        );
        assert_eq!(e["app:build"], strings(&["js:build"]));
    }

    /// A literal read may be a directory, so its dotted name is not an extension.
    #[test]
    fn a_literal_read_is_not_ruled_out_by_its_dotted_name() {
        let e = edges(
            &[("gen:build", &["**/*.js"]), ("app:build", &["dist/app"])],
            &[("app:build", &["gen:build"])],
            &[("app:build", vec![include_ignored(&["dist/lib.v2"])])],
        );
        assert_eq!(e["app:build"], strings(&["gen:build"]));
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

    /// Folders meet when either prefix contains the other, compared by whole
    /// segments. Checked both ways, since reads and outputs share one shape.
    #[test]
    fn folders_meet_only_when_one_prefix_contains_the_other() {
        let meet = |a: &str, b: &str| {
            let (a, b) = (GlobShape::new(a), GlobShape::new(b));
            let there = a.may_read(&b);
            assert_eq!(there, b.may_read(&a), "not symmetric");
            there
        };
        assert!(meet("dist/**", "dist/lib"));
        assert!(meet("dist/lib/esm/**", "dist/lib"));
        assert!(meet("dist/lib/**", "dist/lib"));
        assert!(!meet("dist/lib/**", "dist/app"));
        assert!(!meet("dist/lib/**", "dist/lib-legacy"));
        assert!(!meet("dist/lib-legacy/**", "dist/lib"));
    }

    #[test]
    fn an_extension_is_read_only_after_a_wildcard() {
        let ext = |glob| extension_after_wildcard(glob);
        assert_eq!(ext("dist/**/*.js"), Some("js".into()));
        assert_eq!(ext("**/*.gen"), Some("gen".into()));
        assert_eq!(ext("dist/*.d.ts"), Some("ts".into()));
        assert_eq!(ext("dist/@(a|b).js"), Some("js".into()));
        assert_eq!(ext("dist/out.d.ts"), None);
        assert_eq!(ext("dist/libs/ui"), None);
        assert_eq!(ext("dist/**"), None);
        assert_eq!(ext("dist/*.{js,ts}"), None);
        assert_eq!(ext("**/*.{js,d.ts}"), None);
        assert_eq!(ext("dist/*.[jt]s"), None);
    }

    /// The prefix comes from the glob parser, so an escaped bracket is part of
    /// the folder name rather than a class that ends the prefix at `dist`.
    #[test]
    fn an_escaped_bracket_stays_in_the_prefix() {
        let e = edges(
            &[
                ("id:build", &[r"dist/\[id\]"]),
                ("other:build", &["dist/other"]),
            ],
            &[("app:build", &["id:build", "other:build"])],
            &[("app:build", vec![include_ignored(&[r"dist/\[id\]/**"])])],
        );
        assert_eq!(e["app:build"], strings(&["id:build"]));
    }
}
