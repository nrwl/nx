use std::collections::{HashMap, HashSet};

use crate::native::cache::expand_outputs::match_output_paths;
use crate::native::glob::{NxGlobSetBuilder, expand_literal_braces};
use crate::native::io_snapshots::set::TaskIoSnapshot;
use crate::native::io_snapshots::{IoSnapshotResolution, IoSnapshots};
use crate::native::tasks::hash_planner::walk_root;
use crate::native::tasks::hashers::validate_files_glob;
use crate::native::tasks::types::TaskGraph;

/// What the eligibility walk needs from the workspace. Task-level opt-outs
/// and custom hashers are decided in JS, where target configuration and
/// executors are resolved.
#[derive(Default)]
pub(crate) struct EligibilityInputs {
    /// Tasks whose target sets `sandbox.enabled: false`.
    pub opted_out: HashSet<String>,
    /// Tasks whose executor ships a custom hasher.
    pub custom_hasher: HashSet<String>,
}

/// What JS knows about a run's tasks that the eligibility walk needs.
#[napi(object)]
#[derive(Default)]
pub struct IoSnapshotEligibilityOptions {
    /// Tasks whose target sets `sandbox.enabled: false`.
    pub opted_out_task_ids: Option<Vec<String>>,
    /// Tasks whose executor ships a custom hasher.
    pub custom_hasher_task_ids: Option<Vec<String>>,
}

impl From<IoSnapshotEligibilityOptions> for EligibilityInputs {
    fn from(options: IoSnapshotEligibilityOptions) -> Self {
        Self {
            opted_out: options
                .opted_out_task_ids
                .unwrap_or_default()
                .into_iter()
                .collect(),
            custom_hasher: options
                .custom_hasher_task_ids
                .unwrap_or_default()
                .into_iter()
                .collect(),
        }
    }
}

/// A task the hash planner hashes from its snapshot: observed reads as
/// workspace-relative globs (negations included), observed writes, and the
/// digest of its own entry that marks the plan.
#[derive(Clone, Debug)]
pub(crate) struct SnapshotTask {
    pub files: Vec<String>,
    /// Observed writes, confined to the workspace and outside ignored dirs;
    /// the runner unions them into the task's declared outputs.
    pub outputs: Vec<String>,
    pub digest: String,
}

/// Why a task (or the whole run) hashes natively; `reason` is rendered by the
/// run summary.
#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct IoSnapshotDiagnostic {
    pub reason: String,
    pub task_id: Option<String>,
    pub glob: Option<String>,
    pub message: Option<String>,
}

impl IoSnapshotDiagnostic {
    fn task(reason: &str, task_id: &str) -> Self {
        Self {
            reason: reason.into(),
            task_id: Some(task_id.into()),
            glob: None,
            message: None,
        }
    }

    /// A run-level diagnostic: nothing hashed from snapshots, for `reason`.
    fn run(reason: String, message: Option<String>) -> Self {
        Self {
            reason,
            task_id: None,
            glob: None,
            message,
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
    pub resolution: IoSnapshotResolution,
}

pub(crate) struct Resolved {
    pub tasks: HashMap<String, SnapshotTask>,
    pub diagnostics: Vec<IoSnapshotDiagnostic>,
    pub resolution: IoSnapshotResolution,
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

/// Decides per task whether its entry can be hashed; each withheld task gets
/// one diagnostic naming why. A set-level read failure yields one diagnostic
/// and no tasks.
pub(crate) fn resolve(
    snapshots: &IoSnapshots,
    task_graph: &TaskGraph,
    inputs: &EligibilityInputs,
) -> Resolved {
    resolve_scoped(snapshots, task_graph, inputs, None)
}

/// `resolve` for the given task ids only; eligibility is per task, so a
/// planner call for one task need not walk the whole graph.
pub(crate) fn resolve_scoped(
    snapshots: &IoSnapshots,
    task_graph: &TaskGraph,
    inputs: &EligibilityInputs,
    scope: Option<&[&str]>,
) -> Resolved {
    let resolution = snapshots.resolution_ref();

    let mut tasks = HashMap::new();
    let mut diagnostics = Vec::new();
    let mut task_ids: Vec<&String> = match scope {
        Some(ids) => ids
            .iter()
            .filter_map(|id| task_graph.tasks.get_key_value(*id).map(|(key, _)| key))
            .collect(),
        None => task_graph.tasks.keys().collect(),
    };
    task_ids.sort();
    let entries =
        match snapshots.entries_for(&task_ids.iter().map(|id| id.as_str()).collect::<Vec<_>>()) {
            Ok(entries) => entries,
            Err(err) => {
                return Resolved {
                    tasks: HashMap::new(),
                    diagnostics: vec![IoSnapshotDiagnostic::run(
                        "unreadable-set".to_string(),
                        Some(err.to_string()),
                    )],
                    resolution: resolution.clone(),
                };
            }
        };

    for task_id in task_ids {
        if inputs.opted_out.contains(task_id) {
            diagnostics.push(IoSnapshotDiagnostic::task("disabled", task_id));
            continue;
        }
        if inputs.custom_hasher.contains(task_id) {
            diagnostics.push(IoSnapshotDiagnostic::task("custom-hasher", task_id));
            continue;
        }
        let Some(stored) = entries.get(task_id) else {
            diagnostics.push(IoSnapshotDiagnostic::task("missing", task_id));
            continue;
        };
        let entry = stored.as_ref();

        let mut files = entry.inputs.clone();
        files.sort();
        files.dedup();
        if let Some(glob) = files.iter().find(|g| {
            if g.contains('{') {
                expand_literal_braces(g)
                    .iter()
                    .any(|e| escapes_workspace(e))
            } else {
                escapes_workspace(g)
            }
        }) {
            let mut diagnostic = IoSnapshotDiagnostic::task("escapes-workspace", task_id);
            diagnostic.glob = Some(glob.clone());
            diagnostics.push(diagnostic);
            continue;
        }
        // A read the hasher would reject fails the whole hash; fall back instead.
        if let Some(glob) = files
            .iter()
            .filter(|g| !g.starts_with('!'))
            .find(|g| validate_files_glob(g).is_err())
        {
            let mut diagnostic = IoSnapshotDiagnostic::task("invalid-glob", task_id);
            diagnostic.glob = Some(glob.clone());
            diagnostics.push(diagnostic);
            continue;
        }

        let (outputs, dropped_outputs) = observed_outputs(entry);
        for glob in dropped_outputs {
            let mut diagnostic = IoSnapshotDiagnostic::task("unusable-output", task_id);
            diagnostic.glob = Some(glob);
            diagnostics.push(diagnostic);
        }

        tasks.insert(
            task_id.clone(),
            SnapshotTask {
                files,
                outputs,
                digest: entry.digest(),
            },
        );
    }

    Resolved {
        tasks,
        diagnostics,
        resolution: resolution.clone(),
    }
}

/// The eligibility report, for the run summary.
#[napi]
pub fn get_io_snapshot_report(
    snapshots: &IoSnapshots,
    task_graph: TaskGraph,
    options: Option<IoSnapshotEligibilityOptions>,
) -> IoSnapshotReport {
    resolve(snapshots, &task_graph, &options.unwrap_or_default().into()).report()
}

/// The observed outputs a task's declared outputs get extended with: no
/// negations, nothing outside the workspace, nothing under node_modules,
/// .nx or .git (never cache content). Nx Cloud drops those before a set is
/// uploaded, so this is expected to keep everything; a write it does reject
/// means the two sides disagree, hence the second return value.
fn observed_outputs(entry: &TaskIoSnapshot) -> (Vec<String>, Vec<String>) {
    let (mut outputs, mut dropped): (Vec<String>, Vec<String>) =
        entry.outputs.iter().cloned().partition(|glob| {
            !glob.starts_with('!')
                && expand_literal_braces(glob).iter().all(|g| {
                    !escapes_workspace(g)
                        && !under_ignored_dir(g)
                        && !g.split(['/', '\\']).any(segment_could_disguise)
                })
        });
    outputs.sort();
    outputs.dedup();
    dropped.sort();
    dropped.dedup();
    (outputs, dropped)
}

/// Whether a segment could hide an excluded name behind glob syntax: a class,
/// an unexpanded brace group, `?`, or a partial `*` (`.gi[t]`, `{..,*}`,
/// `node_modul?s`, `node_modul*s`). A bare `*` or `**` is a plain wildcard
/// rather than a disguise, so `under_ignored_dir` judges those instead.
fn segment_could_disguise(segment: &str) -> bool {
    if segment.contains(['[', '{', '?']) {
        return true;
    }
    if !segment.contains('*') || segment.trim_matches('*').is_empty() {
        return false;
    }
    // Lowercased like `under_ignored_dir`, so `NODE_MODUL*S` cannot pass
    // where `node_modul*s` is caught; a leading `!` is dropped because the
    // glob builder would read the segment as a negation of its own.
    let segment = segment.strip_prefix('!').unwrap_or(segment).to_lowercase();
    NxGlobSetBuilder::new(&[segment])
        .and_then(|builder| builder.build())
        .map(|set| IGNORED_DIRS.iter().any(|dir| set.is_match(dir)))
        // A segment the glob engine rejects is not a name this can clear.
        .unwrap_or(true)
}

const IGNORED_DIRS: [&str; 3] = ["node_modules", ".nx", ".git"];

/// Case-insensitive: `.GIT/hooks` restores into `.git` on macOS and Windows.
fn under_ignored_dir(path: &str) -> bool {
    path.split(['/', '\\']).any(|segment| {
        IGNORED_DIRS
            .iter()
            .any(|dir| segment.eq_ignore_ascii_case(dir))
    })
}

/// Observed outputs per eligible task, for the runner to union into
/// `task.outputs`.
#[napi]
pub fn get_observed_io_snapshot_outputs(
    snapshots: &IoSnapshots,
    task_graph: TaskGraph,
    options: Option<IoSnapshotEligibilityOptions>,
) -> HashMap<String, Vec<String>> {
    resolve(snapshots, &task_graph, &options.unwrap_or_default().into())
        .tasks
        .into_iter()
        .filter(|(_, task)| !task.outputs.is_empty())
        .map(|(id, task)| (id, task.outputs))
        .collect()
}

/// Whether an observed read names exactly one path, with no glob syntax.
pub(crate) fn is_literal_path(glob: &str) -> bool {
    !glob.bytes().any(|b| matches!(b, b'*' | b'?' | b'[' | b'{'))
}

/// The candidates equal to `root` or below it, from a sorted list. An empty
/// root is the workspace itself and holds every candidate.
fn candidates_under(sorted: &[String], root: &str) -> Vec<String> {
    if root.is_empty() {
        return sorted.to_vec();
    }
    let prefix = format!("{root}/");
    let start = sorted.partition_point(|c| c.as_str() < prefix.as_str());
    let end = start + sorted[start..].partition_point(|c| c.starts_with(&prefix));
    let mut hits: Vec<String> = sorted[start..end].to_vec();
    if let Ok(i) = sorted.binary_search_by(|c| c.as_str().cmp(root)) {
        hits.push(sorted[i].clone());
    }
    hits
}

/// A glob that would resolve outside the workspace: absolute, drive-lettered,
/// or carrying a `..` segment. The set is server-supplied, so this is the
/// line that keeps a hostile snapshot from turning hashing into a read oracle.
fn escapes_workspace(glob: &str) -> bool {
    let path = glob.strip_prefix('!').unwrap_or(glob);
    let bytes = path.as_bytes();
    path.starts_with('/')
        || path.starts_with('\\')
        || (bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':')
        || path.split(['/', '\\']).any(|segment| segment == "..")
}

/// Whether an observed read falls under a declared output of one of the task's
/// direct or transitive dependencies.
fn reads_dependency_outputs(task_id: &str, files: &[String], task_graph: &TaskGraph) -> bool {
    let mut candidates: Vec<String> = files
        .iter()
        .filter(|f| !f.starts_with('!'))
        .cloned()
        .collect();
    if candidates.is_empty() {
        return false;
    }
    candidates.sort();
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
            // Only reads under an output's walk root can match it; glob
            // semantics (negations included) are settled on those few.
            let mut under: Vec<String> = producer
                .outputs
                .iter()
                .filter(|output| !output.starts_with('!'))
                .flat_map(|output| candidates_under(&candidates, &walk_root(output)))
                .collect();
            if under.is_empty() {
                continue;
            }
            under.sort();
            under.dedup();
            if match_output_paths(producer.outputs.clone(), under)
                .is_ok_and(|matched| matched.into_iter().any(|hit| hit))
            {
                return true;
            }
        }
    }
    false
}

/// Tasks whose snapshot read another task's outputs: they hash after their
/// producers ran, because those files only exist then. Needs no project graph,
/// so the client can call it before the first hashing wave on the daemon path.
/// Opted-out and custom-hasher tasks are not excluded: deferring a task that
/// ends up hashed natively only delays its hash, it never changes it.
#[napi]
pub fn get_io_snapshot_deferred_task_ids(
    snapshots: &IoSnapshots,
    task_graph: TaskGraph,
) -> Vec<String> {
    let ids: Vec<&str> = task_graph.tasks.keys().map(String::as_str).collect();
    let entries = snapshots.entries_for(&ids).unwrap_or_default();
    let mut deferred: Vec<String> = task_graph
        .tasks
        .keys()
        .filter(|task_id| {
            entries.get(*task_id).is_some_and(|stored| {
                reads_dependency_outputs(task_id, &stored.inputs, &task_graph)
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
    fn candidates_under_a_root_ignores_siblings_that_share_its_prefix() {
        let sorted: Vec<String> = [
            "dist/a",
            "dist/a-b/x.js",
            "dist/a/x.js",
            "dist/a/y/z.js",
            "dist/b/x.js",
        ]
        .into_iter()
        .map(String::from)
        .collect();
        assert_eq!(
            candidates_under(&sorted, "dist/a"),
            vec![
                "dist/a/x.js".to_string(),
                "dist/a/y/z.js".to_string(),
                "dist/a".to_string()
            ]
        );
        assert_eq!(candidates_under(&sorted, "dist/c"), Vec::<String>::new());
        assert_eq!(candidates_under(&sorted, "").len(), sorted.len());
        assert!(is_literal_path("dist/a/x.js") && !is_literal_path("dist/a/*.js"));
    }

    #[test]
    fn observed_outputs_are_confined_and_skip_cache_dirs() {
        let entry = TaskIoSnapshot {
            commit: "c".into(),
            inputs: vec![],
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
                ".GIT/hooks/x".into(),
                "{dist,.git}/x".into(),
                ".gi[t]/**".into(),
                "node_modul?s/**".into(),
                // A partial `*` hides the name from the plain-text check.
                "node_modul*s/**".into(),
                "NODE_MODUL*S/**".into(),
                "apps/*odules/x".into(),
                "{..,*}/x".into(),
                "dist/{a,b}.js".into(),
                // A plain wildcard is not a disguise and stays.
                "dist/*.js".into(),
            ],
        };
        assert_eq!(
            observed_outputs(&entry).0,
            vec![
                "apps/web/.next/cache/*",
                "dist/*.js",
                "dist/apps/web/**",
                "dist/{a,b}.js"
            ]
        );
    }

    #[test]
    fn a_write_the_filter_rejects_is_reported_and_the_task_keeps_its_snapshot() {
        let (outputs, dropped) = observed_outputs(&TaskIoSnapshot {
            commit: "c".into(),
            inputs: vec![],
            outputs: vec![
                "dist/apps/web/**".into(),
                "node_modules/.cache/x".into(),
                "../outside/y".into(),
            ],
        });
        assert_eq!(outputs, vec!["dist/apps/web/**"]);
        // Nx Cloud drops these before upload, so a rejection here means the
        // two sides disagree and the run should say so.
        assert_eq!(dropped, vec!["../outside/y", "node_modules/.cache/x"]);
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
