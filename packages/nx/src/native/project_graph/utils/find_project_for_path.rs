use crate::native::project_graph::utils::{normalize_project_root, ProjectRootMappings};
use std::path::Path;

pub fn find_project_for_path<P: AsRef<Path>>(
    file_path: P,
    project_root_map: &ProjectRootMappings,
) -> Option<&str> {
    let mut current_path = file_path.as_ref().to_path_buf();
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
