//! What a task depends on, directly or not, over regular and continuous edges.
//!
//! The planner splices a served task's reads into its consumer's plan
//! (`collect_continuous_dependencies`), so a continuous edge carries a read
//! like any other, and a run needs a served dependency as much as a built one.

use std::collections::HashSet;

use crate::native::tasks::types::TaskGraph;

/// The given tasks plus everything they depend on, sorted. Ids the graph does
/// not contain are dropped.
pub(crate) fn dependency_closure<'a>(
    task_graph: &TaskGraph,
    from: impl IntoIterator<Item = &'a str>,
) -> Vec<String> {
    let mut seen = HashSet::new();
    let starts: Vec<&str> = from
        .into_iter()
        .filter_map(|id| task_graph.tasks.get_key_value(id))
        .map(|(id, _)| id.as_str())
        .filter(|id| seen.insert(*id))
        .collect();
    let mut all = starts.clone();
    walk_dependencies(task_graph, starts, &mut seen, |id| all.push(id));
    all.sort_unstable();
    all.into_iter().map(str::to_string).collect()
}

/// Calls `visit` once for each task the given tasks depend on, directly or
/// not, skipping what `seen` already holds. A start is visited only when a
/// cycle leads back to it. `seen` is the caller's so one allocation can serve
/// many walks.
pub(crate) fn walk_dependencies<'a: 'b, 'b>(
    task_graph: &'a TaskGraph,
    mut stack: Vec<&'b str>,
    seen: &mut HashSet<&'a str>,
    mut visit: impl FnMut(&'a str),
) {
    while let Some(current) = stack.pop() {
        let edges = [
            task_graph.dependencies.get(current),
            task_graph.continuous_dependencies.get(current),
        ];
        for dep in edges.into_iter().flatten().flatten() {
            if seen.insert(dep.as_str()) {
                visit(dep.as_str());
                stack.push(dep.as_str());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::Task;
    use std::collections::HashMap;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
    }

    fn graph(deps: &[(&str, &[&str])], continuous: &[(&str, &[&str])]) -> TaskGraph {
        let edges = |pairs: &[(&str, &[&str])]| -> HashMap<String, Vec<String>> {
            pairs
                .iter()
                .map(|(id, d)| (id.to_string(), strings(d)))
                .collect()
        };
        let mut ids: Vec<&str> = deps
            .iter()
            .chain(continuous)
            .flat_map(|(id, d)| std::iter::once(*id).chain(d.iter().copied()))
            .collect();
        ids.sort_unstable();
        ids.dedup();
        TaskGraph {
            tasks: ids
                .into_iter()
                .map(|id| {
                    (
                        id.to_string(),
                        Task {
                            id: id.to_string(),
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            dependencies: edges(deps),
            continuous_dependencies: edges(continuous),
            roots: vec![],
        }
    }

    #[test]
    fn follows_regular_and_continuous_edges_transitively() {
        let g = graph(
            &[("e2e", &["app:build"]), ("app:build", &["lib:build"])],
            &[("e2e", &["app:serve"])],
        );
        assert_eq!(
            dependency_closure(&g, ["e2e"]),
            strings(&["app:build", "app:serve", "e2e", "lib:build"])
        );
    }

    #[test]
    fn a_cycle_ends_and_revisits_nothing() {
        let g = graph(&[("a", &["b"]), ("b", &["a"])], &[]);
        let mut visited = Vec::new();
        walk_dependencies(&g, vec!["a"], &mut HashSet::new(), |id| visited.push(id));
        assert_eq!(visited, vec!["b", "a"]);
        assert_eq!(dependency_closure(&g, ["a"]), strings(&["a", "b"]));
    }

    #[test]
    fn drops_ids_the_graph_does_not_contain() {
        let g = graph(&[("a", &["b"])], &[]);
        assert_eq!(dependency_closure(&g, ["gone", "a"]), strings(&["a", "b"]));
    }
}
