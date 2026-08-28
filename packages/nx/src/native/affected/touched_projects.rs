use std::collections::HashMap;

use crate::native::project_graph::types::ProjectGraph;
use crate::native::project_graph::utils::{find_project_for_path, normalize_project_root};

/// Maps each changed file to the project that owns it.
///
/// The mapping is built here rather than with `create_project_root_mappings`,
/// which normalizes the project *name* into the value instead of the root into
/// the key and so cannot match a project whose root is `""`.
pub(super) fn touched_projects(graph: &ProjectGraph, touched_files: &[String]) -> Vec<String> {
    let root_map: HashMap<String, String> = graph
        .nodes
        .iter()
        .map(|(name, project)| (normalize_project_root(&project.root), name.clone()))
        .collect();

    touched_files
        .iter()
        .filter_map(|file| find_project_for_path(normalize_path(file), &root_map).map(String::from))
        .collect()
}

/// Mirrors `normalizePath` in `packages/nx/src/utils/path.ts`: strip a Windows
/// drive letter, then swap separators. Root keys are unix-style, and `--files`
/// reaches us exactly as the user typed it, so a Windows path matches nothing
/// without this.
pub(super) fn normalize_path(path: &str) -> String {
    let without_drive = match path.as_bytes() {
        [drive, b':', ..] if drive.is_ascii_alphabetic() => &path[2..],
        _ => path,
    };
    without_drive.replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{files, graph, project};
    use super::*;

    /// Unsorted: `touched_projects` emits one entry per changed file, in input
    /// order, and downstream dedupes.
    #[test]
    fn maps_each_changed_file_to_its_owning_project() {
        let g = graph(vec![
            ("a", project("libs/a")),
            ("b", project("libs/b")),
            ("c", project("libs/c")),
        ]);
        assert_eq!(
            touched_projects(&g, &files(&["libs/b/index.ts", "libs/a/index.ts"])),
            vec!["b", "a"]
        );
    }

    /// `--files` arrives exactly as typed, so a Windows path has to resolve. The
    /// TS this replaced ran `normalizePath` first.
    #[test]
    fn resolves_windows_style_paths() {
        let g = graph(vec![("a", project("libs/a"))]);
        assert_eq!(
            touched_projects(&g, &files(&["libs\\a\\index.ts"])),
            vec!["a"]
        );
        // Parity, not an improvement: stripping the drive letter still leaves a
        // leading slash, which matches no root key. `normalizePath` did the same.
        assert!(touched_projects(&g, &files(&["C:\\libs\\a\\index.ts"])).is_empty());
    }

    #[test]
    fn matches_a_root_only_on_whole_directory_names() {
        let g = graph(vec![
            ("a", project("libs/a")),
            ("abc", project("libs/a-b-c")),
            ("ab", project("libs/a-b")),
        ]);
        assert_eq!(
            touched_projects(&g, &files(&["libs/a-b/index.ts"])),
            vec!["ab"]
        );
    }

    #[test]
    fn prefers_the_most_qualifying_root() {
        let g = graph(vec![
            ("aaaaa", project("libs/a")),
            ("ab", project("libs/a/b")),
        ]);
        assert_eq!(
            touched_projects(&g, &files(&["libs/a/b/index.ts"])),
            vec!["ab"]
        );
    }

    #[test]
    fn does_not_return_the_parent_when_a_nested_project_is_touched() {
        let g = graph(vec![("a", project("libs/a")), ("b", project("libs/a/b"))]);
        assert_eq!(
            touched_projects(&g, &files(&["libs/a/b/index.ts"])),
            vec!["b"]
        );
    }

    /// The TypeScript original normalized the root into the map key, so a
    /// root-level project is reachable. `create_project_root_mappings` does not,
    /// which is why this module builds its own mapping.
    #[test]
    fn finds_a_project_whose_root_is_empty() {
        let g = graph(vec![("root", project(""))]);
        assert_eq!(touched_projects(&g, &files(&["README.md"])), vec!["root"]);
    }
}
