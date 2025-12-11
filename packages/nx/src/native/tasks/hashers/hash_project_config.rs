use std::collections::HashMap;

use anyhow::*;
use itertools::Itertools;

use crate::native::hasher::hash;
use crate::native::project_graph::types::Project;
use crate::native::types::Input;

/// Hashes project configuration for cache invalidation.
///
/// This function has been optimized to minimize allocations by:
/// 1. Writing directly to a single byte buffer instead of creating intermediate strings
/// 2. Avoiding .concat() calls which allocate new strings
/// 3. Using write! macro to append directly to buffer
pub fn hash_project_config(
    project_name: &str,
    projects: &HashMap<String, Project>,
) -> Result<String> {
    use std::fmt::Write;

    let project = projects
        .get(project_name)
        .ok_or_else(|| anyhow!("Could not find project '{}'", project_name))?;

    // Pre-allocate buffer with estimated capacity to avoid reallocations
    // Average project config is ~500 bytes, allocate more to be safe
    let mut buffer = String::with_capacity(1024);

    // Write root
    buffer.push_str(&project.root);

    // Write tags directly to buffer (avoiding .concat())
    if let Some(tags) = &project.tags {
        for tag in tags {
            buffer.push_str(tag);
        }
    }

    // Write targets in sorted order directly to buffer
    for (k, v) in project.targets.iter().sorted_by(|a, b| a.0.cmp(b.0)) {
        buffer.push_str(k);
        buffer.push_str(v.executor.as_deref().unwrap_or_default());
        // Write outputs directly instead of .concat()
        if let Some(outputs) = &v.outputs {
            for output in outputs {
                buffer.push_str(output);
            }
        }
        buffer.push_str(v.options.as_deref().unwrap_or_default());
        buffer.push_str(v.configurations.as_deref().unwrap_or_default());
        let _ = write!(buffer, "{}", v.parallelism.unwrap_or_default());
    }

    // Write named inputs in sorted order directly to buffer
    if let Some(named_inputs) = &project.named_inputs {
        for (_, v) in named_inputs.iter().sorted_by(|a, b| a.0.cmp(b.0)) {
            for input in v {
                let _ = write!(buffer, "{:?}", Input::from(input));
            }
        }
    }

    Ok(hash(buffer.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::Target;
    use std::collections::HashMap;

    #[test]
    fn test_hash_project_config_with_data() {
        let projects = HashMap::from([
            (
                "nx".into(),
                Project {
                    root: "".into(),
                    named_inputs: None,
                    tags: None,
                    targets: Default::default(),
                },
            ),
            (
                "js".into(),
                Project {
                    root: "libs/js".into(),
                    named_inputs: None,
                    tags: Some(vec!["type:lib".into(), "scope:js".into()]),
                    targets: HashMap::from([
                        (
                            "build".into(),
                            Target {
                                executor: Some("@nx/node:build".into()),
                                options: Some("{}".into()),
                                configurations: Some("{\"production\":{}}".into()),
                                ..Default::default()
                            },
                        ),
                        (
                            "test".into(),
                            Target {
                                executor: Some("@nx/node:test".into()),
                                options: Some("{}".into()),
                                configurations: Some("{\"production\":{}}".into()),
                                ..Default::default()
                            },
                        ),
                    ]),
                },
            ),
            (
                "js-unsorted".into(),
                Project {
                    root: "libs/js".into(),
                    named_inputs: None,
                    tags: Some(vec!["type:lib".into(), "scope:js".into()]),
                    targets: HashMap::from([
                        (
                            "test".into(),
                            Target {
                                executor: Some("@nx/node:test".into()),
                                options: Some("{}".into()),
                                configurations: Some("{\"production\":{}}".into()),
                                ..Default::default()
                            },
                        ),
                        (
                            "build".into(),
                            Target {
                                executor: Some("@nx/node:build".into()),
                                options: Some("{}".into()),
                                configurations: Some("{\"production\":{}}".into()),
                                ..Default::default()
                            },
                        ),
                    ]),
                },
            ),
        ]);

        let nx_project_hash = hash_project_config("nx", &projects);
        assert_eq!(nx_project_hash.unwrap(), "3244421341483603138");

        let js_project_hash = hash_project_config("js", &projects).unwrap();
        assert_eq!(js_project_hash, "13565578942842640362");

        let js_unsorted = hash_project_config("js-unsorted", &projects);
        assert_eq!(js_unsorted.unwrap(), js_project_hash);
    }

    #[test]
    fn test_hash_project_config_with_no_project() {
        let projects = HashMap::<String, Project>::new();

        let result = hash_project_config("nx", &projects);

        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().to_string(),
            "Could not find project 'nx'"
        );
    }
}
