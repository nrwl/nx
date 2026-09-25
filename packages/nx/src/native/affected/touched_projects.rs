use super::project_paths::{ProjectRoots, normalize_path};
use crate::native::project_graph::types::ProjectGraph;

/// Maps each changed file to the project that owns it.
pub(super) fn touched_projects(graph: &ProjectGraph, touched_files: &[String]) -> Vec<String> {
    let roots = ProjectRoots::new(graph);
    touched_files
        .iter()
        .filter_map(|file| roots.owner_of(&normalize_path(file)).map(String::from))
        .collect()
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

    /// `--files` arrives exactly as typed, so a Windows path has to resolve.
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

    /// `create_project_root_mappings` cannot reach a project whose root is `""`.
    #[test]
    fn finds_a_project_whose_root_is_empty() {
        let g = graph(vec![("root", project(""))]);
        assert_eq!(touched_projects(&g, &files(&["README.md"])), vec!["root"]);
    }
}
