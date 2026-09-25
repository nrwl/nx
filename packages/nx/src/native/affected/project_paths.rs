//! Turning a changed path into the project that owns it.

use std::collections::HashMap;

use crate::native::project_graph::types::ProjectGraph;
use crate::native::project_graph::utils::{find_project_for_path, normalize_project_root};

/// Workspace-relative path -> owning project. Not `create_project_root_mappings`,
/// which keys by the raw root, so a project whose root is `""` is unreachable.
pub(crate) struct ProjectRoots {
    by_root: HashMap<String, String>,
}

impl ProjectRoots {
    pub(crate) fn new(graph: &ProjectGraph) -> Self {
        Self {
            by_root: graph
                .nodes
                .iter()
                .map(|(name, project)| (normalize_project_root(&project.root), name.clone()))
                .collect(),
        }
    }

    /// The innermost project containing `path`, which must already be
    /// normalized. A path under no project root belongs to none.
    pub(crate) fn owner_of<'a>(&'a self, path: &str) -> Option<&'a str> {
        find_project_for_path(path, &self.by_root)
    }
}

/// Mirrors `normalizePath` in `packages/nx/src/utils/path.ts`: strip a Windows drive
/// letter, then swap separators. `--files` arrives exactly as typed.
pub(crate) fn normalize_path(path: &str) -> String {
    let without_drive = match path.as_bytes() {
        [drive, b':', ..] if drive.is_ascii_alphabetic() => &path[2..],
        _ => path,
    };
    without_drive.replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::test_utils::graph_of_roots as graph;

    #[test]
    fn resolves_the_innermost_owning_project() {
        let roots = ProjectRoots::new(&graph(&[("a", "libs/a"), ("b", "libs/a/b")]));
        assert_eq!(roots.owner_of("libs/a/b/index.ts"), Some("b"));
        assert_eq!(roots.owner_of("libs/a/index.ts"), Some("a"));
    }

    /// A whole-segment match, so `libs/a` does not claim `libs/a-b`.
    #[test]
    fn does_not_match_a_partial_segment() {
        let roots = ProjectRoots::new(&graph(&[("a", "libs/a"), ("ab", "libs/a-b")]));
        assert_eq!(roots.owner_of("libs/a-b/index.ts"), Some("ab"));
    }

    /// The case `create_project_root_mappings` cannot answer.
    #[test]
    fn finds_a_project_whose_root_is_empty() {
        let roots = ProjectRoots::new(&graph(&[("root", "")]));
        assert_eq!(roots.owner_of("README.md"), Some("root"));
    }

    #[test]
    fn a_path_under_no_root_has_no_owner() {
        let roots = ProjectRoots::new(&graph(&[("a", "libs/a")]));
        assert_eq!(roots.owner_of("elsewhere/x.ts"), None);
    }

    #[test]
    fn normalizes_windows_paths() {
        assert_eq!(normalize_path("libs\\a\\index.ts"), "libs/a/index.ts");
        // Stripping the drive leaves a leading slash, which matches no root key.
        // Parity with `normalizePath`, not an improvement on it.
        assert_eq!(normalize_path("C:\\libs\\a"), "/libs/a");
        assert_eq!(normalize_path("libs/a/index.ts"), "libs/a/index.ts");
    }
}
