use crate::native::project_graph::types::ProjectGraph;
use hashbrown::HashSet;

pub(super) fn find_all_project_node_dependencies<'a>(
    parent_node_name: &str,
    project_graph: &'a ProjectGraph,
    exclude_external_dependencies: bool,
) -> Vec<&'a str> {
    let mut dependent_node_names = HashSet::new();
    collect_dependent_project_node_names(
        project_graph,
        parent_node_name,
        &mut dependent_node_names,
        exclude_external_dependencies,
    );
    dependent_node_names.into_iter().collect()
}

fn collect_dependent_project_node_names<'a>(
    project_graph: &'a ProjectGraph,
    parent_node_name: &str,
    dependent_node_names: &mut HashSet<&'a str>,
    exclude_external_dependencies: bool,
) {
    let Some( dependencies ) = project_graph.dependencies.get(parent_node_name) else {
        return;
    };

    for dependency in dependencies {
        let dep = dependency.as_str();
        // skip dependencies already added (avoid circular dependencies)
        if dependent_node_names.contains(dep) {
            continue;
        }

        if exclude_external_dependencies && project_graph.external_nodes.contains_key(dep) {
            continue;
        }

        dependent_node_names.insert(dep);
        collect_dependent_project_node_names(
            project_graph,
            dependency.as_str(),
            dependent_node_names,
            exclude_external_dependencies,
        );
    }
}
