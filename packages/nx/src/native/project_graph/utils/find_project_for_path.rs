use crate::native::project_graph::utils::{ProjectRootMappings, normalize_project_root};
use std::path::Path;

/// Fast path for string inputs - avoids PathBuf allocation entirely
/// Works directly with string slices by finding parent directories via rfind('/')
#[inline]
fn find_project_for_path_str<'a>(
    file_path: &str,
    project_root_map: &'a ProjectRootMappings,
) -> Option<&'a str> {
    let mut current_path = file_path;

    // Walk up the directory tree using string slicing (zero allocation)
    loop {
        // Check if current path matches a project root
        if let Some(p) = project_root_map.get(current_path) {
            return Some(p);
        }

        // Find the last path separator to get parent directory
        match current_path.rfind('/') {
            Some(0) => {
                // We're at root level "/"
                break;
            }
            Some(pos) => {
                // Slice to parent directory
                current_path = &current_path[..pos];
            }
            None => {
                // No more path separators - we're at the base component
                break;
            }
        }
    }

    // Check for "." (standalone/root project) mapping - this handles cases where
    // a project is at the workspace root
    project_root_map.get(".").map(|s| s.as_str())
}

pub fn find_project_for_path<P: AsRef<Path>>(
    file_path: P,
    project_root_map: &ProjectRootMappings,
) -> Option<&str> {
    // Fast path: if input is a str or String, use zero-allocation string-based lookup
    let path_ref = file_path.as_ref();
    if let Some(path_str) = path_ref.to_str() {
        return find_project_for_path_str(path_str, project_root_map);
    }

    // Fallback path for non-UTF8 paths (rare case)
    let mut current_path = path_ref.to_path_buf();
    while let Some(parent) = current_path.parent() {
        if current_path == parent {
            break;
        }
        if let Some(current_path_str) = current_path.to_str() {
            if let Some(p) = project_root_map.get(current_path_str) {
                return Some(p);
            }
        }
        current_path.pop();
    }

    if let Some(current_path_str) = current_path.to_str() {
        let normalized_project_path = normalize_project_root(current_path_str);

        match project_root_map.get(&normalized_project_path) {
            Some(s) => Some(s),
            None => None,
        }
    } else {
        // current_path contained non-Unicode characters
        None
    }
}

#[cfg(test)]
mod test {
    use crate::native::project_graph::types::Project;
    use crate::native::project_graph::utils::{
        create_project_root_mappings, find_project_for_path,
    };
    use std::collections::HashMap;

    #[test]
    fn should_find_the_project_given_a_file_within_its_src_root() {
        let project_root_mapping = create_project_root_mappings(&HashMap::from([
            (
                "demo-app".into(),
                Project {
                    tags: None,
                    targets: Default::default(),
                    root: "apps/demo-app".into(),
                    named_inputs: None,
                },
            ),
            (
                "ui".into(),
                Project {
                    tags: None,
                    targets: Default::default(),
                    root: "libs/ui".into(),
                    named_inputs: None,
                },
            ),
            (
                "core".into(),
                Project {
                    tags: None,
                    targets: Default::default(),
                    root: "libs/core".into(),
                    named_inputs: None,
                },
            ),
            (
                "standalone".into(),
                Project {
                    tags: None,
                    targets: Default::default(),
                    root: ".".into(),
                    named_inputs: None,
                },
            ),
        ]));

        assert_eq!(
            find_project_for_path("apps/demo-app", &project_root_mapping),
            Some("demo-app")
        );
        assert_eq!(
            find_project_for_path("apps/demo-app/src", &project_root_mapping),
            Some("demo-app")
        );
        assert_eq!(
            find_project_for_path("apps/demo-app/src/subdir/blah", &project_root_mapping),
            Some("demo-app")
        );
        assert_eq!(
            find_project_for_path("src/standalone", &project_root_mapping),
            Some("standalone")
        )
    }
}
