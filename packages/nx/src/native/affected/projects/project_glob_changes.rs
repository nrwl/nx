use napi::bindgen_prelude::*;
use std::path::{Component, Path, PathBuf};
use tracing::trace;

use super::locators::{AffectedOptions, all_project_names};
use crate::native::glob::build_glob_set;
use crate::native::project_graph::types::ProjectGraph;

/// A deleted project-configuration file invalidates the whole graph unless the
/// caller opts out: the project it described is gone and has no tasks left to
/// reason about. A modified one needs no handling — it lives under its project
/// root, so `touched_projects` already caught it.
///
/// A plugin's glob also matches config files nested inside a project, such as a
/// benchmark's `vitest.config.ts`. Deleting one of those removes no project, so
/// `is_deleted_nested_input` tells the two apart by what happened to the
/// directory the file lived in.
pub(super) fn projects_from_project_glob_changes(
    graph: &ProjectGraph,
    touched_files: &[String],
    options: &AffectedOptions,
) -> Result<Vec<String>> {
    if options.project_glob_patterns.is_empty() {
        return Ok(Vec::new());
    }
    // One set per plugin, so a glob one plugin cannot parse leaves the others'
    // deletion detection in place.
    let globs: Vec<_> = options
        .project_glob_patterns
        .iter()
        .filter_map(
            |pattern| match build_glob_set(std::slice::from_ref(pattern)) {
                Ok(glob) => Some(glob),
                Err(_) => {
                    trace!("ignoring unparseable plugin createNodes glob: {pattern}");
                    None
                }
            },
        )
        .collect();
    let workspace_root = Path::new(&options.workspace_root);

    // Matched and stat'd raw: normalizing `C:\etc\project.json` would match a
    // glob and stat `/etc/project.json`.
    for file in touched_files {
        if !globs.iter().any(|glob| glob.is_match(file)) {
            continue;
        }
        if workspace_root.join(file).exists() {
            continue;
        }
        // A config file in a subdirectory of a project describes something the
        // project root owns, not the project itself.
        if is_deleted_nested_input(graph, file, workspace_root) {
            trace!("ignoring a deleted plugin glob match nested in a project root: {file}");
            continue;
        }
        if options.project_deletion_affects_all_projects {
            return Ok(all_project_names(graph));
        }
    }

    Ok(Vec::new())
}

/// Reports whether `file` is an input a surviving project owns rather than the
/// config that defines a project.
///
/// A plugin's createNodes glob reaches files at any depth, so a nested input
/// such as a benchmark's `vitest.config.ts` matches one too; deleting it
/// removes no project, and the caller must not hear that one did.
///
/// The distinguishing signal is the directory. A project deleted with its
/// config leaves no directory behind, whether the config was `project.json`,
/// `pom.xml`, or a plugin's own; a nested input keeps its directory. A file
/// whose directory is still there and that sits below some project root is
/// therefore an input, and everything else keeps the caller's answer: the
/// file directly in a project root, the file under no root at all, and the
/// file whose directory went with the project.
///
/// Every root is checked before concluding: when projects nest, the file may
/// sit directly in one root while also being deeper inside another.
///
/// Roots are compared with `.` dropped: the workspace's own project has the
/// root `.`, and `Path::starts_with` is component-based, so it would never see
/// that `.` as an ancestor of `test/benchmark`.
fn is_deleted_nested_input(graph: &ProjectGraph, file: &str, workspace_root: &Path) -> bool {
    let inside = match Path::new(file).parent() {
        Some(parent) => without_dot(parent),
        None => return false,
    };
    if !workspace_root.join(&inside).is_dir() {
        return false;
    }

    if graph
        .nodes
        .values()
        .any(|project| without_dot(Path::new(&project.root)) == inside)
    {
        return false;
    }

    graph
        .nodes
        .values()
        .any(|project| inside.starts_with(without_dot(Path::new(&project.root))))
}

/// Drops `.` components, leaving the paths comparable by component.
fn without_dot(path: &Path) -> PathBuf {
    path.components()
        .filter(|component| !matches!(component, Component::CurDir))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::test_utils::{files, graph, project};

    fn glob_options(deletion_affects_all: bool) -> AffectedOptions {
        AffectedOptions {
            project_glob_patterns: vec!["**/project.json".to_string()],
            project_deletion_affects_all_projects: deletion_affects_all,
            // Nothing exists under this root, so every matched file reads as deleted.
            workspace_root: "/nx-affected-tests-nonexistent".to_string(),
        }
    }

    /// A workspace whose listed directories exist, all empty. A deleted file's
    /// directory surviving is what marks it as an input, so the cases that turn
    /// on that need real ones.
    fn workspace_with(dirs: &[&str]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for sub in dirs {
            std::fs::create_dir_all(dir.path().join(sub)).unwrap();
        }
        dir
    }

    fn options_in(root: &std::path::Path, patterns: &[&str]) -> AffectedOptions {
        AffectedOptions {
            project_glob_patterns: patterns.iter().map(|p| p.to_string()).collect(),
            project_deletion_affects_all_projects: true,
            workspace_root: root.to_string_lossy().into_owned(),
        }
    }

    /// Asserted sorted: `all_project_names` is what `nx show projects --affected`
    /// prints, and `ProjectGraph.nodes` is a `HashMap`.
    #[test]
    fn a_deleted_project_config_affects_every_project() {
        let g = graph(vec![
            ("zebra", project("libs/zebra")),
            ("alpha", project("libs/alpha")),
            ("mike", project("libs/mike")),
        ]);
        assert_eq!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/zebra/project.json"]),
                &glob_options(true)
            )
            .unwrap(),
            vec!["alpha", "mike", "zebra"]
        );
    }

    #[test]
    fn the_deletion_fallback_can_be_disabled() {
        let g = graph(vec![
            ("proj1", project("libs/proj1")),
            ("proj2", project("libs/proj2")),
        ]);
        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/removed/project.json"]),
                &glob_options(false)
            )
            .unwrap()
            .is_empty()
        );
    }

    /// The path is matched as given, so a Windows-style path never matches a
    /// plugin glob and the probe never reaches the disk for it. Normalizing it
    /// first would strip `C:` and match `/etc/project.json`, which `Path::join`
    /// then stats outside the root.
    #[test]
    fn a_windows_style_path_matches_no_plugin_glob() {
        let g = graph(vec![("proj1", project("libs/proj1"))]);
        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["C:\\etc\\project.json"]),
                &glob_options(true)
            )
            .unwrap()
            .is_empty()
        );
    }

    /// One plugin's glob failing to parse must not switch deletion detection
    /// off for every other plugin.
    #[test]
    fn an_unparseable_plugin_glob_does_not_disable_the_others() {
        let g = graph(vec![("proj1", project("libs/proj1"))]);
        let options = AffectedOptions {
            project_glob_patterns: vec!["[bad".to_string(), "**/project.json".to_string()],
            ..glob_options(true)
        };
        assert_eq!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/removed/project.json"]),
                &options
            )
            .unwrap(),
            vec!["proj1"]
        );
    }

    /// A plugin's createNodes glob matches a config file anywhere, including
    /// one nested inside a project. Deleting that does not remove the project,
    /// so the graph is still valid and the fallback must not fire.
    #[test]
    fn a_deleted_config_file_outside_every_project_root_affects_nothing() {
        let g = graph(vec![("proj1", project("libs/proj1"))]);
        let dir = workspace_with(&["libs/proj1/test/benchmark"]);

        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/proj1/test/benchmark/vitest.config.ts"]),
                &options_in(dir.path(), &["**/vitest.config.*"])
            )
            .unwrap()
            .is_empty(),
            "a nested config file is not a project, so deleting it removes no project"
        );
    }

    /// The same shape from a plugin whose config is not a project definition:
    /// the directory surviving is the signal, not the file name.
    #[test]
    fn a_deleted_plugin_config_in_a_surviving_directory_affects_nothing() {
        let g = graph(vec![("proj1", project("libs/proj1"))]);
        let dir = workspace_with(&["libs/proj1/bench"]);

        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/proj1/bench/detox.config.js"]),
                &options_in(dir.path(), &["**/detox.config.js"])
            )
            .unwrap()
            .is_empty(),
            "a plugin config whose directory survives did not define a project"
        );
    }

    /// Projects can nest, so a file sitting right in one root is also deeper
    /// inside another. It is still that inner project's own config.
    #[test]
    fn a_deleted_config_of_a_nested_project_affects_every_project() {
        let g = graph(vec![
            ("outer", project("apps/outer")),
            ("inner", project("apps/outer/inner")),
        ]);
        let dir = workspace_with(&["apps/outer/inner"]);

        assert_eq!(
            projects_from_project_glob_changes(
                &g,
                &files(&["apps/outer/inner/project.json"]),
                &options_in(dir.path(), &["**/project.json"])
            )
            .unwrap(),
            vec!["inner", "outer"]
        );
    }

    /// A nested project can be deleted together with its config, leaving only
    /// its ancestor root to match the path. The graph no longer has it, so the
    /// fallback must still fire — this is a project disappearing, not an input.
    #[test]
    fn a_deleted_nested_project_config_affects_every_project() {
        let g = graph(vec![("outer", project("apps/outer"))]);
        let dir = workspace_with(&["apps/outer"]);

        assert_eq!(
            projects_from_project_glob_changes(
                &g,
                &files(&["apps/outer/inner/project.json"]),
                &options_in(dir.path(), &["**/project.json"])
            )
            .unwrap(),
            vec!["outer"]
        );
    }

    /// The workspace's own project has the root `.`, which `Path::starts_with`
    /// never treats as an ancestor. A nested input below it is still nested.
    #[test]
    fn a_deleted_config_file_nested_under_the_root_project_affects_nothing() {
        let g = graph(vec![("root", project("."))]);
        let dir = workspace_with(&["test/benchmark"]);

        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["test/benchmark/vitest.config.ts"]),
                &options_in(dir.path(), &["**/vitest.config.*"])
            )
            .unwrap()
            .is_empty(),
            "a nested config under the root project is still not a project"
        );
    }

    /// Deleting the root project's own config is a project disappearing, so it
    /// keeps the fallback.
    #[test]
    fn a_deleted_root_project_config_affects_every_project() {
        let g = graph(vec![("root", project("."))]);
        let dir = workspace_with(&[]);

        assert_eq!(
            projects_from_project_glob_changes(
                &g,
                &files(&["project.json"]),
                &options_in(dir.path(), &["**/project.json"])
            )
            .unwrap(),
            vec!["root"]
        );
    }

    #[test]
    fn a_changed_file_that_is_not_a_project_config_affects_nothing() {
        let g = graph(vec![("proj1", project("libs/proj1"))]);
        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/proj1/src/index.ts"]),
                &glob_options(true)
            )
            .unwrap()
            .is_empty()
        );
    }
}
