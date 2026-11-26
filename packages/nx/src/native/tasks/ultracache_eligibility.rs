use std::collections::{HashMap, HashSet};

use crate::native::cache::expand_outputs::match_output_path_refs;
use crate::native::glob::expand_literal_braces;
use crate::native::tasks::hash_planner::walk_root;
use crate::native::tasks::hashers::{parse_group, validate_files_glob};
use crate::native::tasks::types::{TaskGraph, TaskUltracacheSettings, UltracacheMode};
use crate::native::ultracache::set::SharedInputs;
use crate::native::ultracache::{UltracacheConfigurationResolution, UltracacheConfigurations};
use rayon::prelude::*;
use std::sync::Arc;
use xxhash_rust::xxh3::Xxh3;

/// What the eligibility walk needs beyond each task's Ultracache settings.
/// Custom hashers are decided in JS, where executors are resolved.
#[derive(Default)]
pub(crate) struct EligibilityInputs {
    /// Tasks whose executor ships a custom hasher.
    pub custom_hasher: HashSet<String>,
    /// Continuous tasks: their reads depend on which clients they served.
    pub continuous: HashSet<String>,
}

/// What JS knows about a run's tasks that the eligibility walk needs.
#[napi(object)]
#[derive(Default)]
pub struct UltracacheEligibilityOptions {
    /// Tasks whose executor ships a custom hasher.
    pub custom_hasher_task_ids: Option<Vec<String>>,
    pub continuous_task_ids: Option<Vec<String>>,
}

impl From<UltracacheEligibilityOptions> for EligibilityInputs {
    fn from(options: UltracacheEligibilityOptions) -> Self {
        Self {
            custom_hasher: options
                .custom_hasher_task_ids
                .unwrap_or_default()
                .into_iter()
                .collect(),
            continuous: options
                .continuous_task_ids
                .unwrap_or_default()
                .into_iter()
                .collect(),
        }
    }
}

/// A task the hash planner hashes from its Ultracache configuration: observed
/// reads as workspace-relative globs (negations included), and the digest that
/// marks the plan.
#[derive(Clone, Debug)]
pub(crate) struct UltracacheTask {
    pub dictionary: SharedInputs,
    pub files: Vec<u32>,
    pub digest: String,
    /// Also hash the folder state of the task's project: the configurations
    /// ask for it and the target does not set `excludeFolderStateHash`.
    pub project_folder_state: bool,
}

/// Why a task (or the whole run) hashes natively; `reason` is rendered by the
/// run summary.
#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UltracacheDiagnostic {
    pub reason: String,
    pub task_id: Option<String>,
    pub glob: Option<String>,
    pub message: Option<String>,
}

impl UltracacheDiagnostic {
    fn task(reason: &str, task_id: &str) -> Self {
        Self {
            reason: reason.into(),
            task_id: Some(task_id.into()),
            glob: None,
            message: None,
        }
    }

    /// A run-level diagnostic: nothing hashed from Ultracache configurations, for `reason`.
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
pub struct UltracacheReport {
    /// Task ids hashed from their Ultracache configuration.
    pub used: Vec<String>,
    pub diagnostics: Vec<UltracacheDiagnostic>,
    pub resolution: UltracacheConfigurationResolution,
}

pub(crate) struct Resolved {
    pub tasks: HashMap<String, UltracacheTask>,
    pub diagnostics: Vec<UltracacheDiagnostic>,
    pub resolution: UltracacheConfigurationResolution,
}

impl Resolved {
    pub(crate) fn report(&self) -> UltracacheReport {
        let mut used: Vec<String> = self.tasks.keys().cloned().collect();
        used.sort();
        // Stable, so a task's own diagnostics keep the order the walk found them.
        let mut diagnostics = self.diagnostics.clone();
        diagnostics.sort_by(|a, b| a.task_id.cmp(&b.task_id));
        UltracacheReport {
            used,
            diagnostics,
            resolution: self.resolution.clone(),
        }
    }
}

/// Decides per task whether its entry can be hashed; each withheld task gets
/// one diagnostic naming why. A failure to read the configurations yields one diagnostic
/// and no tasks. Takes each task's id and Ultracache settings: all the
/// walk reads from a task, so callers need not transfer whole tasks.
pub(crate) fn resolve<'a>(
    configurations: &UltracacheConfigurations,
    ultracache_settings: impl IntoIterator<Item = (&'a str, Option<&'a TaskUltracacheSettings>)>,
    inputs: &EligibilityInputs,
) -> Resolved {
    let resolution = configurations.resolution_ref();
    let project_folder_state = configurations.hashes_project_folder_state();

    let ultracache_settings: Vec<_> = ultracache_settings.into_iter().collect();
    let task_ids: Vec<&str> = ultracache_settings.iter().map(|(id, _)| *id).collect();
    let entries = match configurations.entries_for(&task_ids) {
        Ok(entries) => entries,
        Err(err) => {
            return Resolved {
                tasks: HashMap::new(),
                diagnostics: vec![UltracacheDiagnostic::run(
                    "unreadable-set".to_string(),
                    Some(err.to_string()),
                )],
                resolution: resolution.clone(),
            };
        }
    };

    let mut diagnostics = Vec::new();
    let mut eligible = Vec::new();
    for (id, settings) in ultracache_settings {
        let reason = match settings.and_then(|s| s.mode.as_ref()) {
            Some(UltracacheMode::Off) => Some("disabled"),
            Some(UltracacheMode::Warn | UltracacheMode::Error) => Some("autofix-disabled"),
            _ if inputs.custom_hasher.contains(id) => Some("custom-hasher"),
            _ if inputs.continuous.contains(id) => Some("continuous"),
            _ => None,
        };
        if let Some(reason) = reason {
            diagnostics.push(UltracacheDiagnostic::task(reason, id));
        } else if let Some(stored) = entries.get(id) {
            eligible.push((id, settings, stored));
        } else {
            diagnostics.push(UltracacheDiagnostic::task("missing", id));
        }
    }
    // Give repeated reads one small ID. IDs are in text order so each task can
    // retain the diagnostic and grouping order using only its integer list.
    let unique = eligible
        .par_iter()
        .map(|(_, _, entry)| entry)
        .fold(hashbrown::HashSet::new, |mut row, e| {
            row.extend(e.iter());
            row
        })
        .reduce(hashbrown::HashSet::new, |mut a, mut b| {
            if a.len() < b.len() {
                std::mem::swap(&mut a, &mut b);
            }
            a.extend(b);
            a
        });
    let mut sorted: Vec<&Arc<str>> = unique.into_iter().collect();
    sorted.par_sort_unstable();
    let dictionary: SharedInputs = sorted.into_iter().cloned().collect();
    let ids: hashbrown::HashMap<&str, u32> = dictionary
        .iter()
        .enumerate()
        .map(|(i, g)| (g.as_ref(), i as u32))
        .collect();
    #[derive(Clone, Copy, PartialEq)]
    enum Issue {
        Escapes,
        Invalid,
    }
    let validation: Vec<_> = dictionary
        .par_iter()
        .map(|g| {
            let escaping = if g.contains('{') {
                expand_literal_braces(g)
                    .iter()
                    .any(|a| escapes_workspace(a))
            } else {
                escapes_workspace(g)
            };
            if escaping {
                Some(Issue::Escapes)
            } else if validate_files_glob(g).is_err()
                || parse_group(std::slice::from_ref(g)).is_err()
            {
                Some(Issue::Invalid)
            } else {
                None
            }
        })
        .collect();
    let resolved: Vec<_> = eligible
        .into_par_iter()
        .map(|(task_id, ultracache, stored)| {
            let mut files: Vec<u32> = stored.iter().map(|g| ids[g.as_ref()]).collect();
            // Stored input lists and dictionary IDs are both in glob-text order.
            files.dedup();
            if let Some((&id, reason)) = [
                (Issue::Escapes, "escapes-workspace"),
                (Issue::Invalid, "invalid-glob"),
            ]
            .into_iter()
            .find_map(|(kind, reason)| {
                files
                    .iter()
                    .find(|&&i| validation[i as usize] == Some(kind))
                    .map(|id| (id, reason))
            }) {
                let mut diagnostic = UltracacheDiagnostic::task(reason, task_id);
                diagnostic.glob = Some(dictionary[id as usize].to_string());
                return Err(diagnostic);
            }
            Ok((
                task_id.to_string(),
                UltracacheTask {
                    dictionary: Arc::clone(&dictionary),
                    files,
                    digest: configuration_digest(ultracache),
                    project_folder_state: project_folder_state
                        && !ultracache
                            .and_then(|ultracache| ultracache.exclude_folder_state_hash)
                            .unwrap_or(false),
                },
            ))
        })
        .collect();
    let mut tasks = HashMap::new();
    for task in resolved {
        match task {
            Ok((id, entry)) => {
                tasks.insert(id, entry);
            }
            Err(diagnostic) => diagnostics.push(diagnostic),
        }
    }

    Resolved {
        tasks,
        diagnostics,
        resolution: resolution.clone(),
    }
}

/// The eligibility report, for the run summary and the skipped task report.
#[napi]
pub fn get_ultracache_report(
    configurations: &UltracacheConfigurations,
    #[napi(ts_arg_type = "Record<string, TaskUltracacheSettings | null>")] tasks: HashMap<
        String,
        Option<TaskUltracacheSettings>,
    >,
    options: Option<UltracacheEligibilityOptions>,
) -> UltracacheReport {
    resolve(
        configurations,
        tasks
            .iter()
            .map(|(id, ultracache)| (id.as_str(), ultracache.as_ref())),
        &options.unwrap_or_default().into(),
    )
    .report()
}

/// The marker's digest: the task's `ignoreReads`, `collectStats`,
/// `includeUnstableFiles` and `excludeFolderStateHash`, which shape the reads its recording holds, so editing them re-runs the task and
/// records it afresh. Sorted, since glob order means nothing.
fn configuration_digest(ultracache: Option<&TaskUltracacheSettings>) -> String {
    // Destructured so a new ultracache key must be placed here: one left out
    // would never re-run a task that keeps hitting. Any mode but `on` means no
    // marker, since the task never reaches here. Recorded writes are never
    // used, so `ignoreWrites` can't change what the task caches.
    let (mut reads, collect_stats, include_unstable_files, exclude_folder_state_hash) =
        match ultracache {
            Some(TaskUltracacheSettings {
                ignore_reads,
                ignore_writes: _,
                mode: _,
                collect_stats,
                include_unstable_files,
                exclude_folder_state_hash,
            }) => (
                ignore_reads.clone().unwrap_or_default(),
                collect_stats.unwrap_or(false),
                include_unstable_files.unwrap_or(true),
                exclude_folder_state_hash.unwrap_or(false),
            ),
            None => (Vec::new(), false, true, false),
        };
    reads.sort();
    reads.dedup();
    // Equals the old marker of a task with no exclusions that recorded no writes.
    let base = Xxh3::new().digest().to_string();
    if reads.is_empty() && !collect_stats && !include_unstable_files && !exclude_folder_state_hash {
        return base;
    }
    let mut hasher = Xxh3::new();
    hasher.update(base.as_bytes());
    // Only `true` is hashed, so `false` keeps the marker of a tracked-only recording.
    // 0xFF never occurs in UTF-8, so no glob can produce this tag.
    if collect_stats {
        hasher.update(b"\xFFcollectStats\0");
    }
    if include_unstable_files {
        hasher.update(b"\xFFincludeUnstableFiles\0");
    }
    if exclude_folder_state_hash {
        hasher.update(b"\xFFexcludeFolderStateHash\0");
    }
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
fn candidates_under<'a>(sorted: &[&'a str], root: &str) -> Vec<&'a str> {
    if root.is_empty() {
        return sorted.to_vec();
    }
    let prefix = format!("{root}/");
    let start = sorted.partition_point(|c| *c < prefix.as_str());
    let end = start + sorted[start..].partition_point(|c| c.starts_with(&prefix));
    let mut hits: Vec<&str> = sorted[start..end].to_vec();
    if let Ok(i) = sorted.binary_search(&root) {
        hits.push(sorted[i]);
    }
    hits
}

/// A glob that would resolve outside the workspace: absolute, drive-lettered,
/// or carrying a `..` segment. Configurations are server-supplied, so this is
/// the line that keeps a hostile one from turning hashing into a read oracle.
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
fn reads_dependency_outputs(task_id: &str, files: &SharedInputs, task_graph: &TaskGraph) -> bool {
    if task_graph
        .dependencies
        .get(task_id)
        .is_none_or(Vec::is_empty)
    {
        return false;
    }
    let candidates: Vec<&str> = files
        .iter()
        .filter(|f| !f.starts_with('!'))
        .map(AsRef::as_ref)
        .collect();
    if candidates.is_empty() {
        return false;
    }
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
            let mut under: Vec<&str> = producer
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
            if match_output_path_refs(&producer.outputs, &under)
                .is_ok_and(|matched| matched.into_iter().any(|hit| hit))
            {
                return true;
            }
        }
    }
    false
}

/// Tasks hashing unstable files whose Ultracache configuration read another
/// task's outputs: they hash after their producers ran, because those files
/// only exist then. Any other task hashes its tracked reads alone. Needs
/// no project graph, so the client can call it before the first hashing wave
/// on the daemon path.
/// Opted-out and custom-hasher tasks are not excluded: deferring a task that
/// ends up hashed natively only delays its hash, it never changes it.
#[napi]
pub fn get_ultracache_deferred_task_ids(
    configurations: &UltracacheConfigurations,
    task_graph: TaskGraph,
) -> Vec<String> {
    let ids: Vec<&str> = task_graph
        .tasks
        .iter()
        .filter(|(_, task)| {
            task.ultracache
                .as_ref()
                .and_then(|ultracache| ultracache.include_unstable_files)
                .unwrap_or(true)
        })
        .map(|(id, _)| id.as_str())
        .collect();
    if ids.is_empty() {
        return Vec::new();
    }
    // An unreadable set makes the whole eligibility check fall back together.
    let all_ids: Vec<_> = task_graph.tasks.keys().map(String::as_str).collect();
    let entries = configurations.entries_for(&all_ids).unwrap_or_default();
    let mut deferred: Vec<String> = ids
        .into_par_iter()
        .filter(|id| {
            entries
                .get(*id)
                .is_some_and(|stored| reads_dependency_outputs(id, stored, &task_graph))
        })
        .map(str::to_owned)
        .collect();
    deferred.sort();
    deferred
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_under_a_root_ignores_siblings_that_share_its_prefix() {
        let sorted = [
            "dist/a",
            "dist/a-b/x.js",
            "dist/a/x.js",
            "dist/a/y/z.js",
            "dist/b/x.js",
        ];
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

    #[test]
    fn only_exclude_folder_state_hash_true_changes_the_configuration_digest() {
        let digest = |exclude_folder_state_hash, collect_stats| {
            configuration_digest(Some(&TaskUltracacheSettings {
                exclude_folder_state_hash,
                collect_stats,
                ..Default::default()
            }))
        };
        assert_eq!(digest(None, None), configuration_digest(None));
        assert_eq!(digest(Some(false), None), digest(None, None));
        assert_ne!(digest(Some(true), None), digest(None, None));
        assert_ne!(digest(Some(true), Some(true)), digest(None, Some(true)));
        assert_ne!(digest(Some(true), None), digest(None, Some(true)));
    }

    #[test]
    fn only_collect_stats_true_changes_the_configuration_digest() {
        let digest = |collect_stats, ignore_reads: Option<Vec<String>>| {
            configuration_digest(Some(&TaskUltracacheSettings {
                collect_stats,
                ignore_reads,
                ..Default::default()
            }))
        };
        let reads = Some(vec!["tmp/**".to_string()]);

        assert_eq!(digest(None, None), configuration_digest(None));
        assert_eq!(digest(Some(false), None), digest(None, None));
        assert_ne!(digest(Some(true), None), digest(None, None));
        assert_eq!(
            digest(Some(false), reads.clone()),
            digest(None, reads.clone())
        );
        assert_ne!(
            digest(Some(true), reads.clone()),
            digest(None, reads.clone())
        );
        assert_ne!(digest(Some(true), reads.clone()), digest(Some(true), None));
        assert_eq!(
            digest(Some(true), Some(vec!["b".into(), "a".into(), "a".into()])),
            digest(Some(true), Some(vec!["a".into(), "b".into()]))
        );
        assert_ne!(
            digest(Some(true), None),
            digest(None, Some(vec!["\u{1}collectStats".into()]))
        );
    }
}
