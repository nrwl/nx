use std::collections::{BTreeMap, HashMap, HashSet};

use crate::native::cache::expand_outputs::match_output_paths;
use crate::native::io_snapshots::bundle::{TaskInputs, TaskIoSnapshot};
use crate::native::io_snapshots::{IoSnapshotResolution, IoSnapshots};
use crate::native::tasks::hashers::{expand_literal_braces, validate_files_globs};
use crate::native::tasks::types::TaskGraph;

/// What the eligibility walk needs from the workspace. The planner fills it
/// from the project graph and nx.json; the free `ioSnapshotReport` takes it
/// from JS so the client never has to transfer a graph just to print a line.
#[derive(Default)]
pub(crate) struct EligibilityInputs {
    /// Tasks whose target sets `ioSnapshots: false`.
    pub opted_out: HashSet<String>,
    /// Tasks whose executor ships a custom hasher.
    pub custom_hasher: HashSet<String>,
    /// Tasks with a declared `{ files }` glob the hasher would reject; natively
    /// that is an error, so a snapshot must not paper over it.
    pub invalid_files_input: HashSet<String>,
    /// Project name → root, for flattening pre-§2b bucketed bundles.
    pub project_roots: HashMap<String, String>,
}

/// A task the hash planner hashes from its snapshot: observed reads as
/// workspace-relative globs (negations included), and the producer tasks
/// whose outputs it read — those only order it after them.
#[derive(Clone, Debug)]
pub(crate) struct SnapshotTask {
    pub files: Vec<String>,
    pub task_outputs: BTreeMap<String, Vec<String>>,
    /// Observed writes, confined to the workspace and outside ignored dirs;
    /// the runner unions them into the task's declared outputs.
    pub outputs: Vec<String>,
    pub digest: String,
}

/// Why a task (or the whole run) hashes natively. `reason` strings are the
/// contract `nx show`, `nx graph`, and the run summary render.
#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct IoSnapshotDiagnostic {
    pub reason: String,
    pub task_id: Option<String>,
    pub project: Option<String>,
    pub glob: Option<String>,
    pub producer: Option<String>,
    pub file: Option<String>,
    pub message: Option<String>,
}

impl IoSnapshotDiagnostic {
    fn task(reason: &str, task_id: &str) -> Self {
        Self {
            reason: reason.into(),
            task_id: Some(task_id.into()),
            project: None,
            glob: None,
            producer: None,
            file: None,
            message: None,
        }
    }
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct IoSnapshotReport {
    /// Task ids hashed from their snapshot.
    pub used: Vec<String>,
    /// Subset of `used` whose snapshot also contributes observed outputs.
    pub tasks_with_outputs: Vec<String>,
    pub diagnostics: Vec<IoSnapshotDiagnostic>,
    pub resolution: Option<IoSnapshotResolution>,
}

pub(crate) struct Resolved {
    pub tasks: HashMap<String, SnapshotTask>,
    pub diagnostics: Vec<IoSnapshotDiagnostic>,
    pub resolution: Option<IoSnapshotResolution>,
}

impl Resolved {
    pub(crate) fn report(&self) -> IoSnapshotReport {
        let mut used: Vec<String> = self.tasks.keys().cloned().collect();
        used.sort();
        let mut tasks_with_outputs: Vec<String> = self
            .tasks
            .iter()
            .filter(|(_, task)| !task.outputs.is_empty())
            .map(|(id, _)| id.clone())
            .collect();
        tasks_with_outputs.sort();
        IoSnapshotReport {
            used,
            tasks_with_outputs,
            diagnostics: self.diagnostics.clone(),
            resolution: self.resolution.clone(),
        }
    }
}

/// Decides, per task in the graph, whether its bundle entry can be hashed:
/// the target has not opted out, no custom hasher, an entry exists, every
/// producer it read from is in this task graph, and no glob would walk the
/// whole workspace. A bundle-level failure yields one diagnostic and no tasks.
pub(crate) fn resolve(
    snapshots: &IoSnapshots,
    task_graph: &TaskGraph,
    inputs: &EligibilityInputs,
) -> Resolved {
    let Some(bundle) = snapshots.bundle.as_ref() else {
        return Resolved {
            tasks: HashMap::new(),
            diagnostics: vec![IoSnapshotDiagnostic {
                reason: snapshots
                    .reason()
                    .unwrap_or_else(|| "no-bundle".to_string()),
                task_id: None,
                project: None,
                glob: None,
                producer: None,
                file: snapshots.file(),
                message: snapshots.message(),
            }],
            resolution: None,
        };
    };

    let mut tasks = HashMap::new();
    let mut diagnostics = Vec::new();
    let mut task_ids: Vec<&String> = task_graph.tasks.keys().collect();
    task_ids.sort();

    for task_id in task_ids {
        if inputs.opted_out.contains(task_id) {
            diagnostics.push(IoSnapshotDiagnostic::task("disabled", task_id));
            continue;
        }
        if inputs.custom_hasher.contains(task_id) {
            diagnostics.push(IoSnapshotDiagnostic::task("custom-hasher", task_id));
            continue;
        }
        let Some(entry) = bundle.snapshots.get(task_id) else {
            diagnostics.push(IoSnapshotDiagnostic::task("missing", task_id));
            continue;
        };
        if inputs.invalid_files_input.contains(task_id) {
            diagnostics.push(IoSnapshotDiagnostic::task("invalid-files-input", task_id));
            continue;
        }

        let mut files: Vec<String> = Vec::new();
        let task_outputs: BTreeMap<String, Vec<String>> = match &entry.inputs {
            TaskInputs::Flat(globs) => {
                files.extend(globs.iter().cloned());
                entry.task_outputs.clone().unwrap_or_default()
            }
            TaskInputs::Structured(legacy) => {
                // Pre-§2b bundles bucket reads by project with project-relative globs.
                for (project, globs) in &legacy.projects {
                    let Some(root) = inputs.project_roots.get(project) else {
                        let mut diagnostic = IoSnapshotDiagnostic::task("unknown-project", task_id);
                        diagnostic.project = Some(project.clone());
                        diagnostics.push(diagnostic);
                        continue;
                    };
                    let prefix = if root == "." {
                        String::new()
                    } else {
                        format!("{root}/")
                    };
                    files.extend(globs.iter().map(|glob| match glob.strip_prefix('!') {
                        Some(rest) => format!("!{prefix}{rest}"),
                        None => format!("{prefix}{glob}"),
                    }));
                }
                files.extend(legacy.workspace.iter().cloned());
                if legacy.task_outputs.is_empty() {
                    entry.task_outputs.clone().unwrap_or_default()
                } else {
                    legacy.task_outputs.clone()
                }
            }
        };

        let mut dangling = None;
        for (producer, paths) in &task_outputs {
            if !task_graph.tasks.contains_key(producer) {
                dangling = Some(producer.clone());
                break;
            }
            // Output reads hash from disk like any other read; the producer
            // entry only orders this task after them.
            files.extend(paths.iter().cloned());
        }
        if let Some(producer) = dangling {
            let mut diagnostic = IoSnapshotDiagnostic::task("producer-not-in-graph", task_id);
            diagnostic.producer = Some(producer);
            diagnostics.push(diagnostic);
            continue;
        }

        files.sort();
        files.dedup();
        if let Some(glob) = files.iter().find(|g| {
            expand_literal_braces(g)
                .iter()
                .any(|e| escapes_workspace(e))
        }) {
            let mut diagnostic = IoSnapshotDiagnostic::task("escapes-workspace", task_id);
            diagnostic.glob = Some(glob.clone());
            diagnostics.push(diagnostic);
            continue;
        }
        // Reads inside a dependency's declared outputs defer the task even if
        // the server sent no taskOutputs: those files only exist after the
        // producer ran, and hashing their absence would be a false key.
        let mut task_outputs = task_outputs;
        for (producer, paths) in producers_by_declared_outputs(task_id, &files, task_graph) {
            task_outputs.entry(producer).or_default().extend(paths);
        }
        if let Some(glob) = files
            .iter()
            .filter(|g| !g.starts_with('!'))
            .find(|g| validate_files_globs(std::slice::from_ref(*g)).is_err())
        {
            let mut diagnostic = IoSnapshotDiagnostic::task("root-anchored-glob", task_id);
            diagnostic.glob = Some(glob.clone());
            diagnostics.push(diagnostic);
            continue;
        }

        tasks.insert(
            task_id.clone(),
            SnapshotTask {
                files,
                task_outputs,
                outputs: observed_outputs(entry),
                digest: bundle.resolution.digest.clone(),
            },
        );
    }

    Resolved {
        tasks,
        diagnostics,
        resolution: Some(bundle.resolution.clone()),
    }
}

/// The eligibility report without a planner: the client prints the run
/// summary from this on the daemon path, where it never transfers a project
/// graph. `invalid-files-input` needs nx.json to expand named inputs, so it
/// is only reported through the planner.
#[napi]
pub fn io_snapshot_report(
    snapshots: &IoSnapshots,
    task_graph: TaskGraph,
    opted_out_task_ids: Vec<String>,
    custom_hasher_task_ids: Vec<String>,
    project_roots: Option<HashMap<String, String>>,
) -> IoSnapshotReport {
    resolve(
        snapshots,
        &task_graph,
        &EligibilityInputs {
            opted_out: opted_out_task_ids.into_iter().collect(),
            custom_hasher: custom_hasher_task_ids.into_iter().collect(),
            invalid_files_input: HashSet::new(),
            project_roots: project_roots.unwrap_or_default(),
        },
    )
    .report()
}

/// The observed outputs a task's declared outputs get extended with: no
/// negations, nothing outside the workspace, nothing under node_modules,
/// .nx or .git (never cache content).
fn observed_outputs(entry: &TaskIoSnapshot) -> Vec<String> {
    let mut outputs: Vec<String> = entry
        .outputs
        .iter()
        .filter(|glob| {
            !glob.starts_with('!') && !escapes_workspace(glob) && !under_ignored_dir(glob)
        })
        .cloned()
        .collect();
    outputs.sort();
    outputs.dedup();
    outputs
}

fn under_ignored_dir(path: &str) -> bool {
    path.split(['/', '\\'])
        .any(|segment| matches!(segment, "node_modules" | ".nx" | ".git"))
}

/// Observed outputs per eligible task (same walk as hashing), for the runner
/// to union into `task.outputs` and for `nx show` to label them.
#[napi]
pub fn io_snapshot_outputs(
    snapshots: &IoSnapshots,
    task_graph: TaskGraph,
    opted_out_task_ids: Vec<String>,
    custom_hasher_task_ids: Vec<String>,
    project_roots: Option<HashMap<String, String>>,
) -> HashMap<String, Vec<String>> {
    resolve(
        snapshots,
        &task_graph,
        &EligibilityInputs {
            opted_out: opted_out_task_ids.into_iter().collect(),
            custom_hasher: custom_hasher_task_ids.into_iter().collect(),
            invalid_files_input: HashSet::new(),
            project_roots: project_roots.unwrap_or_default(),
        },
    )
    .tasks
    .into_iter()
    .filter(|(_, task)| !task.outputs.is_empty())
    .map(|(id, task)| (id, task.outputs))
    .collect()
}

/// A glob that would resolve outside the workspace: absolute, drive-lettered,
/// or carrying a `..` segment. The bundle is server-supplied, so this is the
/// line that keeps a hostile snapshot from turning hashing into a read oracle.
fn escapes_workspace(glob: &str) -> bool {
    let path = glob.strip_prefix('!').unwrap_or(glob);
    let bytes = path.as_bytes();
    path.starts_with('/')
        || path.starts_with('\\')
        || (bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':')
        || path.split(['/', '\\']).any(|segment| segment == "..")
}

/// Producer tasks (direct and transitive dependencies) whose declared outputs
/// contain one of the observed reads, with those reads.
fn producers_by_declared_outputs(
    task_id: &str,
    files: &[String],
    task_graph: &TaskGraph,
) -> BTreeMap<String, Vec<String>> {
    let candidates: Vec<String> = files
        .iter()
        .filter(|f| !f.starts_with('!'))
        .cloned()
        .collect();
    let mut producers = BTreeMap::new();
    if candidates.is_empty() {
        return producers;
    }
    let mut visited: HashSet<&str> = HashSet::new();
    let mut queue: Vec<&str> = vec![task_id];
    while let Some(current) = queue.pop() {
        for dep in task_graph.dependencies.get(current).into_iter().flatten() {
            if !visited.insert(dep.as_str()) {
                continue;
            }
            queue.push(dep);
            let Some(producer) = task_graph.tasks.get(dep) else {
                continue;
            };
            if producer.outputs.is_empty() {
                continue;
            }
            let Ok(matched) = match_output_paths(producer.outputs.clone(), candidates.clone())
            else {
                continue;
            };
            let paths: Vec<String> = candidates
                .iter()
                .zip(matched)
                .filter(|(_, hit)| *hit)
                .map(|(path, _)| path.clone())
                .collect();
            if !paths.is_empty() {
                producers.insert(dep.clone(), paths);
            }
        }
    }
    producers
}

fn entry_task_outputs(entry: &TaskIoSnapshot) -> BTreeMap<String, Vec<String>> {
    match &entry.inputs {
        TaskInputs::Structured(legacy) if !legacy.task_outputs.is_empty() => {
            legacy.task_outputs.clone()
        }
        _ => entry.task_outputs.clone().unwrap_or_default(),
    }
}

fn entry_files(entry: &TaskIoSnapshot) -> Vec<String> {
    match &entry.inputs {
        TaskInputs::Flat(globs) => globs.clone(),
        // Legacy project buckets are project-relative and cannot be matched
        // against outputs without the graph; the workspace bucket can.
        TaskInputs::Structured(legacy) => legacy.workspace.clone(),
    }
}

/// Tasks whose snapshot read another task's outputs: they hash after their
/// producers ran, because those files only exist then. Needs no project graph,
/// so the client can call it before the first hashing wave on the daemon path.
/// Opted-out and custom-hasher tasks are not excluded: deferring a task that
/// ends up hashed natively only delays its hash, it never changes it.
#[napi]
pub fn io_snapshot_deferred_task_ids(
    snapshots: &IoSnapshots,
    task_graph: TaskGraph,
) -> Vec<String> {
    let Some(bundle) = snapshots.bundle.as_ref() else {
        return vec![];
    };
    let mut deferred: Vec<String> = task_graph
        .tasks
        .keys()
        .filter(|task_id| {
            bundle.snapshots.get(*task_id).is_some_and(|entry| {
                let mut producers: Vec<String> = entry_task_outputs(entry).into_keys().collect();
                producers.extend(
                    producers_by_declared_outputs(task_id, &entry_files(entry), &task_graph)
                        .into_keys(),
                );
                !producers.is_empty()
                    && producers
                        .iter()
                        .all(|producer| task_graph.tasks.contains_key(producer))
            })
        })
        .cloned()
        .collect();
    deferred.sort();
    deferred
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn observed_outputs_are_confined_and_skip_cache_dirs() {
        let entry = TaskIoSnapshot {
            commit: "c".into(),
            inputs: TaskInputs::Flat(vec![]),
            task_outputs: None,
            outputs: vec![
                "dist/apps/web/**".into(),
                "dist/apps/web/**".into(),
                "apps/web/.next/cache/*".into(),
                "!dist/apps/web/*.map".into(),
                "../outside/**".into(),
                "node_modules/.cache/x".into(),
                "apps/web/node_modules/.vite/**".into(),
                ".nx/cache/1".into(),
                ".git/index".into(),
            ],
        };
        assert_eq!(
            observed_outputs(&entry),
            vec!["apps/web/.next/cache/*", "dist/apps/web/**"]
        );
    }

    #[test]
    fn brace_groups_are_expanded_before_the_escape_check() {
        assert!(
            expand_literal_braces("{..,libs}/x.ts")
                .iter()
                .any(|e| escapes_workspace(e))
        );
        assert!(
            !expand_literal_braces("{nx,tsconfig.base}.json")
                .iter()
                .any(|e| escapes_workspace(e))
        );
    }

    #[test]
    fn detects_globs_that_leave_the_workspace() {
        for glob in [
            "../secret.txt",
            "../**",
            "libs/../../x",
            "/etc/passwd",
            "C:/Users/x",
            "\\\\server\\share",
            "!../ignored",
        ] {
            assert!(escapes_workspace(glob), "{glob}");
        }
        for glob in ["libs/a/..b/c.ts", "dist/**", "!libs/a/**/*.spec.ts", "a..b"] {
            assert!(!escapes_workspace(glob), "{glob}");
        }
    }
}
