//! The touched-project locators behind `nx affected`.
//!
//! Graph pruning stays in TypeScript: the native `ProjectGraph` models
//! `dependencies` as `HashMap<String, Vec<String>>`, with no edge `type` or
//! `source`, so it cannot rebuild what `filterAffected` returns.

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
    ThreadsafeFunction<Vec<String>, Promise<Vec<TouchedProject>>, Vec<String>, Status, false>;

/// One locator's finding: a project, and enough about the signal to explain it.
///
/// `kind` is a discriminant the TypeScript side narrows on; the payload fields
/// are populated per kind rather than modelled as a union, because napi objects
/// carry no tag. A locator that cannot attribute a single file leaves `file`
/// unset rather than inventing one.
#[napi(object)]
#[derive(Clone, Debug)]
pub struct TouchedProject {
    pub project: String,
    pub kind: String,
    /// The changed file that triggered it, when one file is responsible.
    pub file: Option<String>,
    /// The `{workspaceRoot}` fileset or plugin glob that matched, when the
    /// signal came from a pattern rather than from ownership.
    pub pattern: Option<String>,
    /// The external package whose version moved. Set by the JS locators, which
    /// return through this same struct, so it has to be declared here or napi
    /// drops it on the way back.
    pub package: Option<String>,
}

/// A changed file the project owns, by root.
pub const KIND_PROJECT_FILE: &str = "project-file";
/// A `{workspaceRoot}` fileset a target declares as an input.
pub const KIND_IMPLICIT_DEPENDENCY: &str = "implicit-dependency";
/// `nx.json`, which can restructure the task graph, so every project is marked.
pub const KIND_WORKSPACE_CONFIGURATION: &str = "workspace-configuration";
/// A project config that no longer exists on disk, so its project is gone.
pub const KIND_DELETED_PROJECT_CONFIGURATION: &str = "deleted-project-configuration";

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
    #[napi(ts_arg_type = "Array<(files: string[]) => Promise<TouchedProject[]>>")] js_locators: Vec<
        JsLocator,
    >,
) -> Result<Vec<TouchedProject>> {
    let graph = Arc::clone(project_graph);
    let mut touched: Vec<TouchedProject> = Vec::new();

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

/// Sorted, because `ProjectGraph.nodes` is a `HashMap` and callers surface this
/// list directly — `nx show projects --affected --json` would otherwise emit the
/// same set in a different order on every run.
fn all_project_names(graph: &ProjectGraph) -> Vec<String> {
    let mut names: Vec<String> = graph.nodes.keys().cloned().collect();
    names.sort();
    names
}

/// Every project, each carrying the same reason. Used by the two blanket
/// triggers, where the signal is workspace-wide rather than project-specific.
fn all_projects_touched_by(
    graph: &ProjectGraph,
    kind: &str,
    file: Option<&String>,
    pattern: Option<&str>,
) -> Vec<TouchedProject> {
    all_project_names(graph)
        .into_iter()
        .map(|project| TouchedProject {
            project,
            kind: kind.to_string(),
            file: file.cloned(),
            pattern: pattern.map(String::from),
            package: None,
        })
        .collect()
}
