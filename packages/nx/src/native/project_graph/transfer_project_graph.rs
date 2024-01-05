use napi::bindgen_prelude::External;

use crate::native::project_graph::types::ProjectGraph;

#[napi]
/// Transfer the project graph from the JS world to the Rust world, so that we can pass the project graph via memory quicker
/// This wont be needed once the project graph is created in Rust
pub fn transfer_project_graph(project_graph: ProjectGraph) -> External<ProjectGraph> {
    External::new(project_graph)
}

