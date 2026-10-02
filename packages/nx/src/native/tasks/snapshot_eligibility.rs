use std::collections::{HashMap, HashSet};

use crate::native::cache::expand_outputs::match_output_paths;
use crate::native::glob::expand_literal_braces;
use crate::native::io_snapshots::{IoSnapshotResolution, IoSnapshots};
use crate::native::tasks::hash_planner::walk_root;
use crate::native::tasks::hashers::{parse_group, validate_files_glob};
use crate::native::tasks::types::{TaskGraph, TaskUltracacheConfiguration, UltracacheMode};
use xxhash_rust::xxh3::Xxh3;

/// What the eligibility walk needs beyond each task's ultracache configuration.
/// Custom hashers are decided in JS, where executors are resolved.
#[derive(Default)]
pub(crate) struct EligibilityInputs {
    /// Tasks whose executor ships a custom hasher.
    pub custom_hasher: HashSet<String>,
}

/// What JS knows about a run's tasks that the eligibility walk needs.
#[napi(object)]
#[derive(Default)]
pub struct IoSnapshotEligibilityOptions {
    /// Tasks whose executor ships a custom hasher.
    pub custom_hasher_task_ids: Option<Vec<String>>,
}

impl From<IoSnapshotEligibilityOptions> for EligibilityInputs {
    fn from(options: IoSnapshotEligibilityOptions) -> Self {
        Self {
            custom_hasher: options
                .custom_hasher_task_ids
                .unwrap_or_default()
                .into_iter()
                .collect(),
        }
    }
}

/// A task the hash planner hashes from its snapshot: observed reads as
/// workspace-relative globs (negations included), and the digest that marks
/// the plan.
#[derive(Clone, Debug)]
pub(crate) struct SnapshotTask {
    pub files: Vec<String>,
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
        // Stable, so a task's own diagnostics keep the order the walk found them.
        let mut diagnostics = self.diagnostics.clone();
        diagnostics.sort_by(|a, b| a.task_id.cmp(&b.task_id));
        IoSnapshotReport {
            used,
            diagnostics,
            resolution: self.resolution.clone(),
        }
    }
}

/// Decides per task whether its entry can be hashed; each withheld task gets
/// one diagnostic naming why. A set-level read failure yields one diagnostic
/// and no tasks. Takes each task's id and ultracache configuration: all the
/// walk reads from a task, so callers need not transfer whole tasks.
pub(crate) fn resolve<'a>(
    snapshots: &IoSnapshots,
    ultra_cache_config: impl IntoIterator<Item = (&'a str, Option<&'a TaskUltracacheConfiguration>)>,
    inputs: &EligibilityInputs,
) -> Resolved {
    let resolution = snapshots.resolution_ref();

    let mut tasks = HashMap::new();
    let mut diagnostics = Vec::new();
    let ultra_cache_config: Vec<_> = ultra_cache_config.into_iter().collect();
    let task_ids: Vec<&str> = ultra_cache_config.iter().map(|(id, _)| *id).collect();
    let entries = match snapshots.entries_for(&task_ids) {
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

    for (task_id, ultracache) in ultra_cache_config {
        // `On` is the only mode that lets a recording stand in for what the
        // target declared; `Warn` and `Error` still record, but report against
        // the declaration rather than replacing it.
        match ultracache.and_then(|ultracache| ultracache.mode.as_ref()) {
            Some(UltracacheMode::Off) => {
                diagnostics.push(IoSnapshotDiagnostic::task("disabled", task_id));
                continue;
            }
            Some(UltracacheMode::Warn) | Some(UltracacheMode::Error) => {
                diagnostics.push(IoSnapshotDiagnostic::task("autofix-disabled", task_id));
                continue;
            }
            Some(UltracacheMode::On) | None => {}
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
        if let Some(glob) = files.iter().find(|g| {
            validate_files_glob(g).is_err() || parse_group(std::slice::from_ref(*g)).is_err()
        }) {
            let mut diagnostic = IoSnapshotDiagnostic::task("invalid-glob", task_id);
            diagnostic.glob = Some(glob.clone());
            diagnostics.push(diagnostic);
            continue;
        }

        tasks.insert(
            task_id.to_string(),
            SnapshotTask {
                files,
                digest: snapshot_digest(ultracache),
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
    #[napi(ts_arg_type = "Record<string, TaskUltracacheConfiguration | null>")] tasks: HashMap<
        String,
        Option<TaskUltracacheConfiguration>,
    >,
    options: Option<IoSnapshotEligibilityOptions>,
) -> IoSnapshotReport {
    resolve(
        snapshots,
        tasks
            .iter()
            .map(|(id, ultracache)| (id.as_str(), ultracache.as_ref())),
        &options.unwrap_or_default().into(),
    )
    .report()
}

/// The marker's digest: the task's `ignoredReads`, which shape the reads its
/// recording holds, so editing them re-runs the task and records it afresh.
/// Sorted, since their order means nothing.
fn snapshot_digest(ultracache: Option<&TaskUltracacheConfiguration>) -> String {
    // Destructured so a new ultracache key must be placed here: one left out
    // would never re-run a task that keeps hitting. Any mode but `on` means no
    // marker, since the task never reaches here. Recorded writes are never
    // used, so `ignoredWrites` can't change what the task caches.
    let mut reads = match ultracache {
        Some(TaskUltracacheConfiguration {
            ignored_reads,
            ignored_writes: _,
            mode: _,
        }) => ignored_reads.clone().unwrap_or_default(),
        None => Vec::new(),
    };
    reads.sort();
    reads.dedup();
    // Equals the old marker of a task with no exclusions that recorded no writes.
    let base = Xxh3::new().digest().to_string();
    if reads.is_empty() {
        return base;
    }
    let mut hasher = Xxh3::new();
    hasher.update(base.as_bytes());
    // NUL after each glob, so adjacent globs cannot run together.
    for glob in reads {
        hasher.update(glob.as_bytes());
        hasher.update(&[0]);
    }
    hasher.digest().to_string()
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
    // A leading escape of a glob symbol names a root-level file like `!a.md`;
    // any other leading `\` could spell `\/etc`, `\\server` or `\C:`.
    let escaped_symbol = matches!(
        bytes,
        [
            b'\\',
            b'*' | b'?' | b'[' | b']' | b'{' | b'}' | b'(' | b')' | b'!',
            ..
        ]
    );
    path.starts_with('/')
        || (path.starts_with('\\') && !escaped_symbol)
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
            if !visited.insert(dep.id.as_str()) {
                continue;
            }
            queue.push(&dep.id);
            let Some(producer) = task_graph.tasks.get(&dep.id) else {
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
            r"\/etc/passwd",
            r"\C:/Windows",
            r"\../x",
        ] {
            assert!(escapes_workspace(glob), "{glob}");
        }
        for glob in [
            "libs/a/..b/c.ts",
            "dist/**",
            "!libs/a/**/*.spec.ts",
            "a..b",
            r"\!notes.md",
            r"!\!notes.md",
            r"\(group\)/page.tsx",
            r"\[id\].ts",
            r"\*x",
            r"\{a,b\}",
        ] {
            assert!(!escapes_workspace(glob), "{glob}");
        }
    }
}
