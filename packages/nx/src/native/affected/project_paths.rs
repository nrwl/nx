//! Turning a changed path into the project that owns it.

use crate::native::project_graph::types::ProjectGraph;
use crate::native::project_graph::utils::{
    ProjectRootMappings, create_project_root_mappings, find_project_for_path,
};

/// Workspace-relative path -> owning project.
pub(crate) struct ProjectRoots {
    by_root: ProjectRootMappings,
}

impl ProjectRoots {
    pub(crate) fn new(graph: &ProjectGraph) -> Self {
        Self {
            by_root: create_project_root_mappings(&graph.nodes),
        }
    }

    /// The innermost project containing `path`, which must already be
    /// normalized. A path under no project root belongs to none.
    pub(crate) fn owner_of<'a>(&'a self, path: &str) -> Option<&'a str> {
        find_project_for_path(path, &self.by_root)
    }
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

    /// An empty root is the workspace root.
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
}
