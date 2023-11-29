use std::collections::HashMap;

use anyhow::*;

use crate::native::hasher::hash;
use crate::native::project_graph::utils::find_project_for_path;

pub fn hash_tsconfig_selectively(
    project_name: &str,
    ts_config: &[u8],
    ts_config_paths: &HashMap<String, Vec<String>>,
    project_root_mappings: &HashMap<String, String>,
) -> Result<String> {
    let project_path =
        remove_other_project_paths(project_name, project_root_mappings, ts_config_paths);
    Ok(hash(&[project_path.as_bytes(), ts_config].concat()))
}

fn remove_other_project_paths(
    project_name: &str,
    project_root_mappings: &HashMap<String, String>,
    paths: &HashMap<String, Vec<String>>,
) -> String {
    let mut filtered_paths = paths
        .iter()
        .filter_map(|(key, files)| {
            let project_files = files
                .iter()
                .filter(|&file| {
                    find_project_for_path(file, project_root_mappings)
                        .map_or_else(|| false, |p| project_name == p)
                })
                .map(|file| file.as_str())
                .collect::<Vec<_>>();

            (!project_files.is_empty()).then(|| format!("{}:{}", key, project_files.join(";")))
        })
        .collect::<Vec<_>>();
    filtered_paths.sort();
    filtered_paths.join(";")
}

#[cfg(test)]
mod test {
    use std::collections::HashMap;

    use crate::native::project_graph::types::Project;
    use crate::native::project_graph::utils::create_project_root_mappings;

    use super::*;

    #[test]
    fn test_remove_other_project_paths() {
        let project_name = "project1";
        let project_root_mappings = create_test_project_root_mappings();

        let paths = &HashMap::from([
            (
                "@test/project1".into(),
                vec!["path1/index.ts".into(), "path1/index2.ts".into()],
            ),
            (
                "@test/project2".into(),
                vec!["packages/path2/index.ts".into()],
            ),
        ]);
        let result = remove_other_project_paths(project_name, &project_root_mappings, paths);
        assert_eq!(result, "@test/project1:path1/index.ts;path1/index2.ts");
    }

    #[test]
    fn test_hash_tsconfig() {
        let project_root_mappings = create_test_project_root_mappings();
        let tsconfig = r#"
{
    "compilerOptions": {
      "target": "ES2021",
      "importHelpers": true,
      "module": "commonjs",
      "moduleResolution": "node",
      "outDir": "build",
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true,
      "skipLibCheck": true,
      "types": ["node", "jest"],
      "lib": ["ES2021"],
      "declaration": true,
      "resolveJsonModule": true,
      "baseUrl": ".",
      "rootDir": ".",
      "allowJs": true
    }
  }
        "#;
        let paths: HashMap<String, Vec<String>> = HashMap::from([
            (
                "@test/project1".into(),
                vec!["path1/index.ts".into(), "path1/index2.ts".into()],
            ),
            (
                "@test/project2".into(),
                vec!["packages/path2/index.ts".into()],
            ),
        ]);

        let result = hash_tsconfig_selectively(
            "project1",
            tsconfig.as_bytes(),
            &paths,
            &project_root_mappings,
        )
        .unwrap();
        assert_eq!(result, "6431119472521503644");
        let result = hash_tsconfig_selectively(
            "project2",
            tsconfig.as_bytes(),
            &paths,
            &project_root_mappings,
        )
        .unwrap();
        assert_eq!(result, "13103308914505796317");
    }

    fn create_test_project_root_mappings() -> HashMap<String, String> {
        create_project_root_mappings(&HashMap::from([
            (
                "project1".into(),
                Project {
                    root: "path1".into(),
                    ..Default::default()
                },
            ),
            (
                "project2".into(),
                Project {
                    root: "packages/path2".into(),
                    ..Default::default()
                },
            ),
        ]))
    }
}
