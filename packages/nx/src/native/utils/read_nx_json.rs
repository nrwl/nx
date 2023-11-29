use crate::native::types::NxJson;
use std::path::Path;

pub fn read_nx_json<P: AsRef<Path>>(root: P) -> Option<NxJson> {
    let content = std::fs::read(root.as_ref().join("nx.json")).ok();

    if let Some(content) = content {
        serde_json::from_slice(&content).ok()
    } else {
        None
    }
}
