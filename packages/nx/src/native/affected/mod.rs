//! `nx affected`: the touched-project locators and the task selection.
//!
//! Graph pruning stays in TypeScript: the native `ProjectGraph` models
//! `dependencies` as `HashMap<String, Vec<String>>`, with no edge `type` or
//! `source`, so it cannot rebuild what `filterAffected` returns.

mod dependency_closure;
pub mod dependent_outputs;
mod implicit_dependencies;
mod plan_ids;
mod project_glob_changes;
mod project_paths;
pub mod tasks;
#[cfg(test)]
mod test_support;
mod touched_projects;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::ThreadsafeFunction;
use std::sync::Arc;

use crate::native::project_graph::types::ProjectGraph;
use crate::native::types::NxJson;
use implicit_dependencies::implicitly_touched_projects;
use project_glob_changes::projects_from_project_glob_changes;
use touched_projects::touched_projects;

/// A locator implemented in JavaScript, called once per run with the changed paths.
///
/// `CalleeHandled = false` (the fifth generic) is load-bearing: the `true` default
/// calls back Node-style as `(err, value)`, which the hand-written `ts_arg_type`
/// below would not reflect. Never hold one of these on a `#[napi]` struct — it
/// keeps an event-loop reference and the host never exits.
pub type JsLocator =
    ThreadsafeFunction<Vec<String>, Promise<Vec<String>>, Vec<String>, Status, false>;

#[napi(object)]
pub struct AffectedOptions {
    /// `createNodes` globs of every loaded plugin. Resolved in TypeScript because
    /// `getPlugins` is async and spawns plugin workers.
    pub project_glob_patterns: Vec<String>,
    pub project_deletion_affects_all_projects: bool,
    pub workspace_root: String,
}

/// Runs every locator and returns the touched project names, in locator order,
/// unsorted overall and with duplicates. Callers dedupe by walking the graph.
///
/// Every branch is deterministic, and must stay so: this order reaches
/// `result.nodes` insertion order and so `nx show projects --affected`.
#[napi]
pub async fn locate_touched_projects(
    project_graph: &External<Arc<ProjectGraph>>,
    nx_json: NxJson,
    touched_files: Vec<String>,
    options: AffectedOptions,
    #[napi(ts_arg_type = "Array<(files: string[]) => Promise<string[]>>")] js_locators: Vec<
        JsLocator,
    >,
) -> Result<Vec<String>> {
    let graph = Arc::clone(project_graph);
    let mut touched: Vec<String> = Vec::new();

    touched.extend(touched_projects(&graph, &touched_files));
    touched.extend(implicitly_touched_projects(
        &graph,
        &nx_json,
        &touched_files,
    )?);
    touched.extend(projects_from_project_glob_changes(
        &graph,
        &touched_files,
        &options,
    )?);

    for locator in js_locators {
        let promise = locator.call_async(touched_files.clone()).await?;
        touched.extend(promise.await?);
    }

    Ok(touched)
}

/// Only the projects that own a changed file, one entry per file, in input
/// order. `nx release` version plans ignore implicit and config-derived touches.
#[napi]
pub fn directly_touched_projects(
    project_graph: &External<Arc<ProjectGraph>>,
    touched_files: Vec<String>,
) -> Vec<String> {
    touched_projects(project_graph, &touched_files)
}

/// Sorted, because `ProjectGraph.nodes` is a `HashMap` and callers surface this
/// list directly — `nx show projects --affected --json` would otherwise emit the
/// same set in a different order on every run.
fn all_project_names(graph: &ProjectGraph) -> Vec<String> {
    let mut names: Vec<String> = graph.nodes.keys().cloned().collect();
    names.sort();
    names
}
