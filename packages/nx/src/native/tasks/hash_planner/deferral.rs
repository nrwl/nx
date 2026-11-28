use crate::native::glob::{normalize_glob, partition_glob};
use crate::native::tasks::hashers::{Positive, ProjectScope};
use crate::native::tasks::plan::{Plan, kind};
use crate::native::tasks::types::{HashInstruction, InstructionPool, TaskGraph};
use crate::native::utils::path::parent_dirs;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// Tasks the up-front batch must leave out because they read what a task
/// they depend on, directly or through the chain, writes: any task with a
/// `dependentTasksOutputFiles` instruction, and any task with a disk-backed
/// fileset that reads from a directory containing, or sitting inside, an
/// output an upstream task declares. An output inside a project nested below
/// the glob's own is not read by it, so it does not count. Any other
/// disk-backed fileset hashes up front like a tracked one. A task that hashes
/// its absolute cwd also waits: under distribution it runs on an agent whose
/// cwd differs from the coordinator's.
pub(super) fn deferred_tasks(
    plans: &HashMap<String, Plan>,
    pool: &InstructionPool,
    task_graph: &TaskGraph,
) -> HashSet<String> {
    // The common declared plan only reads tracked files. The class mask also
    // answers this for an entire shared dependency closure in constant time.
    let disk_plans: Vec<_> = plans
        .values()
        .filter(|p| p.has(kind::DISK) && !p.has(kind::ALWAYS_DEFERRED))
        .map(|p| p.only(kind::DISK))
        .collect();
    let mut disk_roots = HashMap::new();
    let mut outputs_by_task = HashMap::new();
    if !disk_plans.is_empty() {
        for (id, task) in &task_graph.tasks {
            let roots: Vec<_> = task
                .outputs
                .iter()
                .filter(|o| !o.starts_with('!'))
                .map(|o| walk_root(o))
                .collect();
            if !roots.is_empty() {
                outputs_by_task.insert(id.as_str(), roots);
            }
        }
        let mut all_outputs: Vec<_> = outputs_by_task.values().flatten().cloned().collect();
        all_outputs.sort_unstable();
        all_outputs.dedup();
        if !all_outputs.is_empty() {
            // Groups share interned globs, so resolve each glob's root once.
            let mut overlapping: hashbrown::HashMap<*const str, Option<String>> =
                hashbrown::HashMap::new();
            for id in Plan::union_ids(&disk_plans) {
                let instruction = pool.get(id);
                if let HashInstruction::IgnoredFileSet {
                    globs,
                    project_roots,
                    ..
                } = instruction.value()
                {
                    let mut scope = None;
                    let roots: Vec<_> = globs
                        .iter()
                        .filter(|g| !g.starts_with('!'))
                        .filter_map(|g| {
                            let root = overlapping
                                .entry(Arc::as_ptr(g))
                                .or_insert_with(|| {
                                    let root = walk_root(g);
                                    overlaps_any(&all_outputs, &root).then_some(root)
                                })
                                .clone()?;
                            let scope =
                                scope.get_or_insert_with(|| ProjectScope::new(project_roots));
                            let skipped = Positive::parse(g)
                                .map(|p| scope.nested_below(&p))
                                .unwrap_or_default();
                            Some((root, skipped))
                        })
                        .collect();
                    if !roots.is_empty() {
                        disk_roots.insert(id, roots);
                    }
                }
            }
        }
    }
    plans
        .par_iter()
        .filter(|(task_id, plan)| {
            if plan.has(kind::ALWAYS_DEFERRED) {
                return true;
            }
            if disk_roots.is_empty() || !plan.has(kind::DISK) {
                return false;
            }
            let direct: Vec<_> = task_dependencies(task_graph, task_id)
                .filter_map(|id| outputs_by_task.get(id))
                .flatten()
                .collect();
            let overlaps = |id, output: &String| {
                disk_roots[&id].iter().any(|(disk, skipped)| {
                    paths_overlap(disk, output)
                        && !skipped.iter().any(|root| {
                            output == root
                                || output
                                    .strip_prefix(root.as_str())
                                    .is_some_and(|r| r.starts_with('/'))
                        })
                })
            };
            // Follow shared plan nodes only until a direct producer accounts
            // for the wait. Otherwise keep the candidate ids for the transitive check.
            let mut reads = hashbrown::HashSet::new();
            if plan.only(kind::DISK).any_id(|id| {
                disk_roots.contains_key(&id)
                    && reads.insert(id)
                    && direct.iter().any(|o| overlaps(id, o))
            }) {
                return true;
            }
            !reads.is_empty()
                && any_upstream_task(task_graph, task_id, |upstream| {
                    outputs_by_task.get(upstream).is_some_and(|outputs| {
                        outputs
                            .iter()
                            .any(|o| reads.iter().any(|&id| overlaps(id, o)))
                    })
                })
        })
        .map(|(id, _)| id.clone())
        .collect()
}

/// The directory a glob reads from, spelled the way expansion reads it. A
/// glob with no literal prefix, or one that climbs out of the workspace,
/// reads as the workspace root, so a doubtful case errs toward deferring.
pub(crate) fn walk_root(glob: &str) -> String {
    // Legacy default outputs are spelled `./dist` and `dist/.`.
    let glob = glob.strip_prefix("./").unwrap_or(glob);
    let glob = glob.strip_suffix("/.").unwrap_or(glob);
    let glob = normalize_glob(glob);
    if glob.split('/').any(|segment| segment == "..") {
        return String::new();
    }
    partition_glob(&glob).0
}

/// Walk roots of every output declared by the tasks `task_id` depends on,
/// directly or through the chain, continuous dependencies included.
pub(super) fn upstream_output_roots(task_graph: &TaskGraph, task_id: &str) -> Vec<String> {
    let mut roots = Vec::new();
    any_upstream_task(task_graph, task_id, |id| {
        if let Some(task) = task_graph.tasks.get(id) {
            roots.extend(
                task.outputs
                    .iter()
                    .filter(|output| !output.starts_with('!'))
                    .map(|output| walk_root(output)),
            );
        }
        false
    });
    roots
}

fn task_dependencies<'a>(graph: &'a TaskGraph, id: &str) -> impl Iterator<Item = &'a str> {
    [
        graph.dependencies.get(id),
        graph.continuous_dependencies.get(id),
    ]
    .into_iter()
    .flatten()
    .flatten()
    .map(|edge| edge.id.as_str())
}

fn any_upstream_task(graph: &TaskGraph, id: &str, mut check: impl FnMut(&str) -> bool) -> bool {
    let mut visited = hashbrown::HashSet::new();
    let mut stack: Vec<_> = task_dependencies(graph, id).collect();
    while let Some(id) = stack.pop() {
        if visited.insert(id) {
            if check(id) {
                return true;
            }
            stack.extend(task_dependencies(graph, id));
        }
    }
    false
}

/// `paths_overlap` against each of `sorted_roots`, by lookup instead of a scan.
pub(in crate::native::tasks) fn overlaps_any(sorted_roots: &[String], root: &str) -> bool {
    if root.is_empty() || sorted_roots.first().is_some_and(|r| r.is_empty()) {
        return !sorted_roots.is_empty();
    }
    if std::iter::once(root)
        .chain(parent_dirs(root))
        .any(|ancestor| {
            sorted_roots
                .binary_search_by(|r| r.as_str().cmp(ancestor))
                .is_ok()
        })
    {
        return true;
    }
    let below = format!("{root}/");
    let start = sorted_roots.partition_point(|r| r.as_str() < below.as_str());
    sorted_roots
        .get(start)
        .is_some_and(|r| r.starts_with(&below))
}

/// Whether one path is the other or lies inside it. The workspace root, the
/// empty string, holds everything.
fn paths_overlap(a: &str, b: &str) -> bool {
    a.is_empty()
        || b.is_empty()
        || a == b
        || a.strip_prefix(b).is_some_and(|rest| rest.starts_with('/'))
        || b.strip_prefix(a).is_some_and(|rest| rest.starts_with('/'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::{CwdMode, Task};
    use crate::native::test_utils::edges_to;

    #[test]
    fn defers_a_task_that_reads_an_upstream_output() {
        let pool = InstructionPool::new();
        let disk = |_project: &str, glob: &str| {
            pool.intern(HashInstruction::ignored_files(vec![glob.into()]))
        };
        let tracked = pool.intern(HashInstruction::ProjectFileSet(
            "lib".into(),
            vec!["libs/lib/src/**".into()],
        ));
        let group = |_project: &str, globs: &[&str]| {
            pool.intern(HashInstruction::ignored_files(
                globs.iter().map(|g| g.to_string()).collect(),
            ))
        };
        let plans: HashMap<String, Plan> = [
            ("web:build", vec![disk("web", "apps/web/generated/**/*.ts")]),
            ("web:lint", vec![disk("web", "apps/web/.env.generated")]),
            ("web:test", vec![disk("web", "dist/**")]),
            ("web:bracket", vec![disk("web", "apps/web/[dir]/**")]),
            ("web:slashes", vec![disk("web", "apps/web//generated/**")]),
            (
                "web:negated",
                vec![group("web", &["apps/web/.env.generated", "!dist/**"])],
            ),
            ("web:dot", vec![disk("web", "apps/web/.env.generated")]),
            ("web:dotdist", vec![disk("web", "dist/legacy/**")]),
            ("web:outside", vec![disk("web", "apps/web/.env.generated")]),
            ("web:outslash", vec![disk("web", "dist/apps/web/**")]),
            ("lib:build", vec![tracked]),
            (
                "web:e2e",
                vec![pool.intern(HashInstruction::TaskOutput(
                    "**/*.js".into(),
                    vec!["apps/web/dist".into()],
                ))],
            ),
        ]
        .into_iter()
        .map(|(id, ids)| (id.to_string(), Plan::from_ids(ids, &pool)))
        .collect();
        let strings = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let tasks: HashMap<String, Task> = [
            ("web:build", vec![]),
            ("web:lint", vec![]),
            ("web:test", vec![]),
            ("web:bracket", vec![]),
            ("web:slashes", vec![]),
            ("web:negated", vec![]),
            ("web:dot", vec![]),
            ("web:dotdist", vec![]),
            ("web:outside", vec![]),
            ("web:outslash", vec![]),
            ("web:e2e", vec![]),
            ("web:codegen", vec!["apps/web/generated"]),
            ("web:serve", vec!["apps/web/d"]),
            (
                "lib:build",
                vec!["dist/libs/lib", "!apps/web/.env.generated"],
            ),
            ("lib:dot", vec!["./dist"]),
            ("lib:outside", vec!["../outside"]),
            ("lib:outslash", vec!["dist//apps/web"]),
        ]
        .into_iter()
        .map(|(id, outputs)| {
            let (project, target) = id.split_once(':').unwrap();
            (
                id.to_string(),
                Task::new(project, target).with_outputs(strings(&outputs)),
            )
        })
        .collect();
        let edges = |list: &[(&str, &[&str])]| {
            list.iter()
                .map(|(id, deps)| (id.to_string(), edges_to(deps)))
                .collect::<HashMap<_, _>>()
        };
        let task_graph = TaskGraph {
            roots: vec![],
            tasks,
            dependencies: edges(&[
                ("web:build", &["web:codegen", "lib:build"]),
                ("web:lint", &["lib:build"]),
                ("web:test", &["web:build"]),
                ("web:slashes", &["web:codegen"]),
                ("web:negated", &["lib:build"]),
                ("web:dot", &["lib:dot"]),
                ("web:dotdist", &["lib:dot"]),
                ("web:outside", &["lib:outside"]),
                ("web:outslash", &["lib:outslash"]),
            ]),
            continuous_dependencies: edges(&[("web:bracket", &["web:serve"])]),
        };

        let mut deferred: Vec<String> = deferred_tasks(&plans, &pool, &task_graph)
            .into_iter()
            .collect();
        deferred.sort();
        // web:build reads its codegen's output; web:test's `dist/**` holds
        // lib:build's `dist/libs/lib` two steps up; web:bracket's `[dir]`
        // counts as a wildcard, so `apps/web` meets the served `apps/web/d`;
        // `//` on either side reads as one slash; a legacy `./dist` output
        // is `dist`, so it holds `dist/legacy` but not `apps/web`; an output
        // the parser rejects (`../outside`) counts as the workspace root.
        // web:lint reads a file no upstream task writes, and a `!` entry on
        // either side is neither a read nor a write. web:e2e reads dependent
        // task outputs, which always wait.
        assert_eq!(
            deferred,
            vec![
                "web:bracket",
                "web:build",
                "web:dotdist",
                "web:e2e",
                "web:outside",
                "web:outslash",
                "web:slashes",
                "web:test"
            ]
        );
    }

    #[test]
    fn defers_a_task_that_hashes_its_absolute_cwd() {
        let pool = InstructionPool::new();
        let plans: HashMap<String, Plan> = [
            ("app:absolute", CwdMode::Absolute),
            ("app:relative", CwdMode::Relative),
        ]
        .into_iter()
        .map(|(id, mode)| {
            (
                id.to_string(),
                Plan::from_ids([pool.intern(HashInstruction::Cwd(mode))], &pool),
            )
        })
        .collect();
        let task_graph = TaskGraph {
            roots: vec![],
            tasks: ["app:absolute", "app:relative"]
                .into_iter()
                .map(|id| {
                    let (project, target) = id.split_once(':').unwrap();
                    (id.to_string(), Task::new(project, target))
                })
                .collect(),
            dependencies: HashMap::new(),
            continuous_dependencies: HashMap::new(),
        };

        let deferred = deferred_tasks(&plans, &pool, &task_graph);
        assert_eq!(deferred, HashSet::from(["app:absolute".to_string()]));
    }

    #[test]
    fn does_not_defer_for_an_output_in_a_nested_project_the_glob_skips() {
        let pool = InstructionPool::new();
        let scoped = pool.intern(HashInstruction::IgnoredFileSet {
            globs: vec!["packages/gradle/**/*".into()].into(),
            project_roots: vec!["packages/gradle".into(), "packages/gradle/runner".into()],
            from_ultracache: false,
        });
        let plans: HashMap<String, Plan> = [
            ("gradle:nested-output".to_string(), vec![scoped]),
            ("gradle:own-output".to_string(), vec![scoped]),
            ("gradle:holding-output".to_string(), vec![scoped]),
        ]
        .into_iter()
        .map(|(id, ids)| (id, Plan::from_ids(ids, &pool)))
        .collect();
        let task = |id: &str, outputs: &[&str]| {
            let (project, target) = id.split_once(':').unwrap();
            (
                id.to_string(),
                Task::new(project, target)
                    .with_outputs(outputs.iter().map(|o| o.to_string()).collect()),
            )
        };
        let task_graph = TaskGraph {
            roots: vec![],
            tasks: HashMap::from([
                task("gradle:nested-output", &[]),
                task("gradle:own-output", &[]),
                task("gradle:holding-output", &[]),
                task("runner:build", &["packages/gradle/runner/build"]),
                task("gradle:compile", &["packages/gradle/build"]),
                task("all:build", &["packages"]),
            ]),
            dependencies: HashMap::from([
                ("gradle:nested-output".into(), edges_to(&["runner:build"])),
                ("gradle:own-output".into(), edges_to(&["gradle:compile"])),
                ("gradle:holding-output".into(), edges_to(&["all:build"])),
            ]),
            continuous_dependencies: HashMap::new(),
        };
        let mut deferred: Vec<String> = deferred_tasks(&plans, &pool, &task_graph)
            .into_iter()
            .collect();
        deferred.sort();
        // `runner/build` is in a project the glob skips; `packages` holds the
        // glob's own folder, so it still counts.
        assert_eq!(deferred, vec!["gradle:holding-output", "gradle:own-output"]);
    }

    #[test]
    fn overlaps_any_matches_paths_overlap() {
        let roots = ["", "apps/web", "dist", "dist/libs/lib", "libs/a/b"];
        let probes = [
            "dist",
            "dist/libs",
            "distribution",
            "apps/webapp",
            "apps",
            "libs/a",
            "x",
            "",
        ];
        for count in 0..=roots.len() {
            for skip in 0..roots.len() {
                let mut sorted: Vec<String> = roots
                    .iter()
                    .skip(skip)
                    .take(count)
                    .map(|r| r.to_string())
                    .collect();
                sorted.sort();
                for probe in probes {
                    assert_eq!(
                        overlaps_any(&sorted, probe),
                        sorted.iter().any(|r| paths_overlap(r, probe)),
                        "{sorted:?} {probe}"
                    );
                }
            }
        }
    }

    #[test]
    fn paths_overlap_when_one_holds_the_other() {
        assert!(paths_overlap("dist", "dist/libs/lib"));
        assert!(paths_overlap("dist/libs/lib", "dist"));
        assert!(paths_overlap("dist", "dist"));
        assert!(paths_overlap("", "anything"));
        assert!(!paths_overlap("dist", "distribution"));
        assert!(!paths_overlap("apps/web/dist", "apps/webapp"));
    }
}
