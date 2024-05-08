use crate::native::hasher::{hash, hash_array};
use crate::native::project_graph::types::ExternalNode;
use std::collections::HashMap;
use std::sync::Arc;

use anyhow::*;
use dashmap::DashMap;

pub fn hash_external(
    external_name: &str,
    externals: &HashMap<String, ExternalNode>,
    cache: Arc<DashMap<String, String>>,
) -> Result<String> {
    let external = externals
        .get(external_name)
        .ok_or_else(|| anyhow!("Could not find external {}", external_name))?;

    if let Some(cached_hash) = cache.get(external_name) {
        return Ok(cached_hash.clone());
    }

    let hash = if let Some(external_hash) = &external.hash {
        hash(external_hash.as_bytes())
    } else {
        hash(external.version.as_bytes())
    };

    cache.insert(external_name.to_string(), hash.clone());

    Ok(hash)
}

pub fn hash_all_externals<S: AsRef<str>>(
    sorted_externals: &[S],
    externals: &HashMap<String, ExternalNode>,
    cache: Arc<DashMap<String, String>>,
) -> Result<String> {
    let hashes = sorted_externals
        .iter()
        .map(|name| hash_external(name.as_ref(), externals, Arc::clone(&cache)))
        .collect::<Result<Vec<_>>>()?;
    Ok(hash_array(hashes))
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::native::project_graph::types::ExternalNode;
    use dashmap::DashMap;
    use std::sync::Arc;

    fn get_external_nodes_map() -> HashMap<String, ExternalNode> {
        HashMap::from([
            (
                "my_external".to_string(),
                ExternalNode {
                    package_name: Some("my_external".into()),
                    version: "0.0.1".into(),
                    hash: None,
                },
            ),
            (
                "my_external_with_hash".to_string(),
                ExternalNode {
                    package_name: Some("my_external_with_hash".into()),
                    version: "0.0.1".into(),
                    hash: Some("hashvalue".into()),
                },
            ),
        ])
    }
    #[test]
    fn test_hash_external() {
        let external_nodes = get_external_nodes_map();
        let cache: Arc<DashMap<String, String>> = Arc::new(DashMap::new());
        let no_external_node_hash =
            hash_external("my_external", &external_nodes, Arc::clone(&cache));
        assert_eq!(no_external_node_hash.unwrap(), "3342527690135000204");

        let external_node_hash =
            hash_external("my_external_with_hash", &external_nodes, Arc::clone(&cache));
        assert_eq!(external_node_hash.unwrap(), "4204073044699973956");
    }

    #[test]
    fn test_hash_all_externals() {
        let external_nodes = get_external_nodes_map();
        let cache: Arc<DashMap<String, String>> = Arc::new(DashMap::new());
        let all_externals = hash_all_externals(
            &["my_external", "my_external_with_hash"],
            &external_nodes,
            Arc::clone(&cache),
        );
        assert_eq!(all_externals.unwrap(), "9354284926255893100");
    }
}
