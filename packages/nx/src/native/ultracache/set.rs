//! A snapshot refers to input lists, which in turn refer to one copy of each glob.
#[cfg(not(target_arch = "wasm32"))]
use std::collections::HashMap;
use std::sync::Arc;

#[cfg(not(target_arch = "wasm32"))]
use serde::Deserialize;

/// Shared by the handle, eligibility walk and hash planner. Sorted by glob text.
pub(crate) type SharedInputs = Arc<[Arc<str>]>;

/// The original Nx Cloud object and the JSON row written by older Nx versions.
/// Only observed reads participate in hashing.
#[cfg(not(target_arch = "wasm32"))]
#[derive(Deserialize)]
pub(super) struct LegacyEntry {
    #[serde(rename = "commit")]
    pub _commit: String,
    pub inputs: Vec<String>,
}

#[cfg(not(target_arch = "wasm32"))]
#[derive(Default)]
pub(super) struct CompactSet {
    pub globs: Vec<Arc<str>>,
    glob_ids: HashMap<Arc<str>, u32>,
    pub inputs: HashMap<Vec<u32>, u32>,
    pub tasks: HashMap<String, u32>,
    /// The manifest's `hashProjectFolderState`.
    pub hash_project_folder_state: bool,
}

#[cfg(not(target_arch = "wasm32"))]
impl CompactSet {
    pub fn intern_glob(&mut self, glob: String) -> u32 {
        if let Some(&id) = self.glob_ids.get(glob.as_str()) {
            return id;
        }
        let id = self.globs.len() as u32;
        let glob: Arc<str> = glob.into();
        self.globs.push(glob.clone());
        self.glob_ids.insert(glob, id);
        id
    }

    pub fn intern_inputs(&mut self, mut ids: Vec<u32>) -> u32 {
        ids.sort_unstable();
        ids.dedup();
        let next = self.inputs.len() as u32;
        *self.inputs.entry(ids).or_insert(next)
    }

    pub fn add_legacy(&mut self, task_id: String, inputs: Vec<String>) {
        let ids = inputs
            .into_iter()
            .map(|glob| self.intern_glob(glob))
            .collect();
        let artifact = self.intern_inputs(ids);
        self.tasks.insert(task_id, artifact);
    }
}
