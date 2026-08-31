use napi::bindgen_prelude::*;
use std::path::Path;
use tracing::warn;

use super::{
    AffectedOptions, KIND_DELETED_PROJECT_CONFIGURATION, TouchedProject, all_projects_touched_by,
};
use crate::native::glob::build_glob_set;
use crate::native::project_graph::types::ProjectGraph;

/// A deleted project-configuration file invalidates the whole graph unless the
/// caller opts out: the project it described is gone and has no tasks left to
/// reason about. A modified one needs no handling — it lives under its project
/// root, so `touched_projects` already caught it.
pub(super) fn projects_from_project_glob_changes(
    graph: &ProjectGraph,
    touched_files: &[String],
    options: &AffectedOptions,
) -> Result<Vec<TouchedProject>> {
    // Load-bearing: with both the included and excluded sets empty, `is_match`
    // returns `!excluded.is_match(..)`, i.e. true for every file.
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
                    warn!("ignoring unparseable plugin createNodes glob: {pattern}");
                    None
                }
            },
        )
        .collect();
    let workspace_root = Path::new(&options.workspace_root);

    // Raw, not normalized, to match the TypeScript this replaced, which globbed
    // and stat'd the path exactly as given. This is parity, not containment:
    // `Path::join` drops the base on an absolute component, so a raw absolute
    // path still stats outside the workspace, and `..` escapes by ordinary
    // resolution. The probe only decides whether the file exists, and a path
    // that leaves the workspace was never a project config anyway.
    for file in touched_files {
        if !globs.iter().any(|glob| glob.is_match(file)) {
            continue;
        }
        if workspace_root.join(file).exists() {
            continue;
        }
        if options.project_deletion_affects_all_projects {
            return Ok(all_projects_touched_by(
                graph,
                KIND_DELETED_PROJECT_CONFIGURATION,
                Some(file),
                None,
            ));
        }
    }

    Ok(Vec::new())
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{files, graph, names, project};
    use super::*;

    fn projects_from_project_glob_changes(
        graph: &ProjectGraph,
        touched_files: &[String],
        options: &AffectedOptions,
    ) -> Result<Vec<String>> {
        Ok(names(super::projects_from_project_glob_changes(
            graph,
            touched_files,
            options,
        )?))
    }

    fn glob_options(deletion_affects_all: bool) -> AffectedOptions {
        AffectedOptions {
            project_glob_patterns: vec!["**/project.json".to_string()],
            project_deletion_affects_all_projects: deletion_affects_all,
            // Nothing exists under this root, so every matched file reads as deleted.
            workspace_root: "/nx-affected-tests-nonexistent".to_string(),
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
