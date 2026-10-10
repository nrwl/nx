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

/// Hashes every external node. The node hashes are sorted before they are
/// combined, so the result does not depend on node names. A lock file parser
/// can give a package a different name on each platform: the hoisted
/// `npm:fsevents` on macOS is `npm:fsevents@2.3.3` on Linux, where the package
/// is not installed. The hash must stay the same on both.
pub fn hash_all_externals(
    externals: &HashMap<String, ExternalNode>,
    cache: Arc<DashMap<String, String>>,
) -> Result<String> {
    let mut hashes = externals
        .keys()
        .map(|name| hash_external(name, externals, Arc::clone(&cache)))
        .collect::<Result<Vec<String>>>()?;
    hashes.sort_unstable();
    Ok(hash_array(hashes.into_iter().map(Some).collect()))
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
                    r#type: Some("npm".into()),
                    package_name: Some("my_external".into()),
                    version: "0.0.1".into(),
                    hash: None,
                },
            ),
            (
                "my_external_with_hash".to_string(),
                ExternalNode {
                    r#type: Some("npm".into()),
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
        let all_externals = hash_all_externals(&external_nodes, Arc::clone(&cache));
        assert_eq!(all_externals.unwrap(), "9354284926255893100");
    }

    #[test]
    fn test_hash_all_externals_ignores_node_names() {
        let node = |version: &str, hash: &str| ExternalNode {
            r#type: Some("npm".into()),
            package_name: Some("fsevents".into()),
            version: version.into(),
            hash: Some(hash.into()),
        };
        // The same lock file entries, named as the pnpm parser names them on
        // macOS (2.3.3 is installed and hoisted) and on Linux (nothing is
        // installed, so no version is hoisted).
        let darwin = HashMap::from([
            ("npm:fsevents".to_string(), node("2.3.3", "hash-2.3.3")),
            (
                "npm:fsevents@2.3.2".to_string(),
                node("2.3.2", "hash-2.3.2"),
            ),
        ]);
        let linux = HashMap::from([
            (
                "npm:fsevents@2.3.2".to_string(),
                node("2.3.2", "hash-2.3.2"),
            ),
            (
                "npm:fsevents@2.3.3".to_string(),
                node("2.3.3", "hash-2.3.3"),
            ),
        ]);

        assert_eq!(
            hash_all_externals(&darwin, Arc::new(DashMap::new())).unwrap(),
            hash_all_externals(&linux, Arc::new(DashMap::new())).unwrap()
        );
    }
}
